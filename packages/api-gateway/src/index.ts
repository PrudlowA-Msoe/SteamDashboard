import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";
import jwt from "jsonwebtoken";
import client, { collectDefaultMetrics, Registry } from "prom-client";

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

const metadataUrl = process.env.METADATA_SERVICE_URL || "http://localhost:4002";
const authUrl = process.env.AUTH_SERVICE_URL || "http://localhost:4001";
const liveUrl = process.env.LIVE_SERVICE_URL || "http://localhost:4003";
const statsUrl = process.env.STATS_SERVICE_URL || "http://localhost:4004";
const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";
const metricsToken = process.env.METRICS_TOKEN || "prom-secret";

const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: "gateway_" });

const httpDuration = new client.Histogram({
  name: "gateway_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["route", "method", "status_code"],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2],
  registers: [metricsRegistry],
});

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

app.get("/metrics", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${metricsToken}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  res.set("Content-Type", metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

app.get("/admin/usage", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), jwtSecret) as jwt.JwtPayload & { roles?: string[] };
    if (!payload.roles || !payload.roles.includes("admin")) {
      return res.status(403).json({ error: "forbidden" });
    }
    res.set("Content-Type", metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
});

app.use((req, res, next) => {
  const end = httpDuration.startTimer({ route: req.path, method: req.method });
  res.on("finish", () => end({ status_code: res.statusCode }));
  next();
});

app.use((req, res, next) => {
  if (shouldSkipAuth(req.path)) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), jwtSecret) as jwt.JwtPayload & { roles?: string[] };
    if (!payload.roles || payload.roles.length === 0) {
      return res.status(403).json({ error: "forbidden" });
    }
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
});

app.use(
  "/metadata",
  createProxyMiddleware({
    target: metadataUrl,
    changeOrigin: true,
    pathRewrite: { "^/metadata": "" },
  }),
);

const authProxy = createProxyMiddleware({
  target: authUrl,
  changeOrigin: false, // preserve original host for OpenID return_to/realm validation
  xfwd: true,
});

app.use((req, res, next) => {
  if (req.url.startsWith("/auth/")) {
    return authProxy(req, res, next);
  }
  return next();
});

app.use(
  "/live",
  createProxyMiddleware({
    target: liveUrl,
    changeOrigin: true,
    pathRewrite: { "^/live": "" },
  }),
);

app.use(
  "/stats",
  createProxyMiddleware({
    target: statsUrl,
    changeOrigin: true,
    pathRewrite: { "^/stats": "" },
  }),
);

function shouldSkipAuth(path: string) {
  if (path === "/health" || path.startsWith("/auth")) return true;
  if (path === "/metrics") return true; // handled separately via metrics token
  // Enforce auth for all proxied routes (metadata/live/stats)
  return false;
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "gateway_error", message: err.message });
});

app.listen(port, () => {
  console.log(`[api-gateway] listening on port ${port}`);
});
