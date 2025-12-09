import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import client, { collectDefaultMetrics, Registry } from "prom-client";
import { games, GameMetadata } from "./data/games";

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4002;
const metricsToken = process.env.METRICS_TOKEN || "prom-secret";

const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: "metadata_service_" });

const httpDuration = new client.Histogram({
  name: "metadata_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["route", "method", "status_code"],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2],
  registers: [metricsRegistry],
});

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use((req, res, next) => {
  const end = httpDuration.startTimer({ route: req.path, method: req.method });
  res.on("finish", () => end({ status_code: res.statusCode }));
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "metadata-service" });
});

app.get("/metrics", async (_req, res) => {
  if (_req.headers.authorization !== `Bearer ${metricsToken}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  res.set("Content-Type", metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

app.get("/games", (req, res) => {
  const query = (req.query.q as string | undefined)?.toLowerCase();
  const result = query
    ? games.filter((game) => game.name.toLowerCase().includes(query) || game.genres.some((g) => g.toLowerCase().includes(query)))
    : games;
  res.json({ count: result.length, items: result });
});

app.get("/search/live", async (req, res) => {
  const query = (req.query.q as string | undefined)?.trim();
  if (!query) {
    return res.status(400).json({ error: "missing_query" });
  }
  try {
    const searchUrl = `https://store.steampowered.com/api/storesearch?term=${encodeURIComponent(query)}&l=english&cc=US`;
    const resp = await fetch(searchUrl);
    if (!resp.ok) {
      throw new Error(`search failed ${resp.status}`);
    }
    const json = (await resp.json()) as any;
    const mapped =
      json?.items?.map((item: any) => ({
        appId: String(item.id),
        name: item.name,
        genres: [],
        developer: "",
        publisher: "",
        icon: item.tiny_image || item.header_image || item.capsule || "",
      })) || [];
    res.json({ count: mapped.length, items: mapped });
  } catch (err) {
    console.error("[metadata-service] search error", err);
    res.status(500).json({ error: "search_failed", message: (err as Error).message });
  }
});

app.get("/search", (req, res) => {
  const query = (req.query.q as string | undefined)?.toLowerCase();
  if (!query) {
    return res.status(400).json({ error: "missing_query" });
  }
  const matches = games.filter((game) => includesQuery(game, query));
  res.json({ count: matches.length, items: matches });
});

app.get("/games/:appId", (req, res) => {
  const appId = req.params.appId;
  const game = games.find((g) => g.appId === appId);
  if (!game) {
    return res.status(404).json({ error: "not_found" });
  }
  res.json({ item: game });
});

app.post("/games/cache", async (req, res) => {
  const appId = String(req.body?.appId || req.query.appId || "").trim();
  if (!appId) return res.status(400).json({ error: "missing_app_id" });
  try {
    const existing = games.find((g) => g.appId === appId);
    if (existing) {
      return res.json({ item: existing, cached: true });
    }
    const resp = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
    if (!resp.ok) throw new Error(`appdetails failed ${resp.status}`);
    const json = (await resp.json()) as any;
    const entry = json[appId];
    if (!entry?.success || !entry.data) throw new Error("app not found");
    const data = entry.data;
    const newGame: GameMetadata = {
      appId,
      name: data.name,
      genres: (data.genres || []).map((g: any) => g.description),
      developer: (data.developers || [])[0] || "",
      publisher: (data.publishers || [])[0] || "",
      icon: data.header_image,
      tags: (data.categories || []).map((c: any) => c.description),
    };
    games.push(newGame);
    res.json({ item: newGame, cached: false });
  } catch (err) {
    console.error("[metadata-service] cache add error", err);
    res.status(500).json({ error: "cache_add_failed", message: (err as Error).message });
  }
});

function includesQuery(game: GameMetadata, q: string) {
  const lower = q.toLowerCase();
  return (
    game.name.toLowerCase().includes(lower) ||
    game.developer.toLowerCase().includes(lower) ||
    game.publisher.toLowerCase().includes(lower) ||
    game.genres.some((g) => g.toLowerCase().includes(lower)) ||
    (game.tags || []).some((t) => t.toLowerCase().includes(lower))
  );
}

app.listen(port, () => {
  console.log(`[metadata-service] listening on port ${port}`);
});
