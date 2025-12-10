import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import { nanoid } from "nanoid";
import client, { collectDefaultMetrics, Registry } from "prom-client";
import { Pool } from "pg";
import openid from "openid";

dotenv.config();

const app = express();
// Required when running behind reverse proxies (Caddy/API gateway) so the library
// can see the original protocol/host for OpenID validation.
app.set("trust proxy", true);
const port = process.env.PORT ? Number(process.env.PORT) : 4001;
const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";
const postgresUrl = process.env.POSTGRES_URL || "postgres://steamapp:steamapp@localhost:5432/steamapp";
const metricsToken = process.env.METRICS_TOKEN || "prom-secret";
// Public-facing origin (no trailing slash). Use FRONTEND_URL without path as a default.
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4173";
const publicOrigin = (process.env.PUBLIC_ORIGIN || frontendUrl).replace(/\/+$/, "");
// External auth mount path (as seen by the browser/gateway), default "/auth"
const authPrefix = process.env.AUTH_PREFIX || "/auth";
const externalCallback = `${publicOrigin}${authPrefix}/steam/callback`;
const steamApiKey = process.env.STEAM_API_KEY;

const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: "auth_service_" });

const httpDuration = new client.Histogram({
  name: "auth_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["route", "method", "status_code"],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2],
  registers: [metricsRegistry],
});

type Role = "user" | "admin";

interface Profile {
  id: string;
  steamId: string;
  personaName: string;
  roles: Role[];
}

const profiles = new Map<string, Profile>();
const pool = new Pool({ connectionString: postgresUrl });
pool.on("error", (err: Error) => console.error("[postgres] error", err));
const adminSteamIds = (process.env.ADMIN_STEAM_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);

const createRelyingParty = (returnTo: string) => new openid.RelyingParty(returnTo, publicOrigin, true, false, []);

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use((req, res, next) => {
  const end = httpDuration.startTimer({ route: req.path, method: req.method });
  res.on("finish", () => end({ status_code: res.statusCode }));
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "auth-service" });
});

app.get("/metrics", async (_req, res) => {
  if (_req.headers.authorization !== `Bearer ${metricsToken}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  res.set("Content-Type", metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

const issueToken = (profile: Profile) =>
  jwt.sign(
    {
      sub: profile.id,
      steamId: profile.steamId,
      personaName: profile.personaName,
      roles: profile.roles,
    },
    jwtSecret,
    { expiresIn: "1h", issuer: "auth-service" },
  );

const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const token = authHeader.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload & { steamId: string; personaName: string; roles: Role[] };
    const loaded = profiles.get(String(payload.sub)) || (await loadProfile(String(payload.sub)));
    if (loaded) {
      (req as any).user = loaded;
    } else {
      (req as any).user = payload;
    }
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
};

app.post("/steam/callback", (req, res) => {
  const steamId = String(req.body.steamId || nanoid());
  const personaName = String(req.body.personaName || `User-${steamId.slice(-6)}`);
  const isAdmin = Boolean(req.body.admin);
  const id = nanoid();
  const roles: Role[] = ["user", ...(isAdmin ? (["admin"] as Role[]) : []), ...(adminSteamIds.includes(steamId) ? (["admin"] as Role[]) : [])];
  const profile: Profile = { id, steamId, personaName, roles };
  profiles.set(id, profile);
  persistProfile(profile).catch((err) => console.error("[postgres] failed to persist profile", err));

  const token = issueToken(profile);
  res.json({ token, profile });
});

app.post("/refresh", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const token = authHeader.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    const profile = profiles.get(String(payload.sub)) || (await loadProfile(String(payload.sub)));
    if (!profile) {
      return res.status(404).json({ error: "profile_not_found" });
    }
    return res.json({ token: issueToken(profile) });
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
});

app.get("/me", authenticate, (req, res) => {
  const user = (req as any).user as Profile;
  res.json({ user });
});

app.get("/me/roles", authenticate, (req, res) => {
  const user = (req as any).user as Profile;
  res.json({ roles: user.roles });
});

const loginHandler = (req: express.Request, res: express.Response) => {
  const redirect = req.query.redirect ? String(req.query.redirect) : frontendUrl;
  const returnTo = `${externalCallback}?redirect=${encodeURIComponent(redirect)}`;
  const rp = createRelyingParty(returnTo);
  rp.authenticate("https://steamcommunity.com/openid", false, (error: any, authUrl: string | null) => {
    if (error || !authUrl) {
      return res.status(500).json({ error: "openid_init_failed", message: error?.message });
    }
    res.redirect(
      authUrl
        .replace(
          "openid.return_to=" + encodeURIComponent(externalCallback),
          "openid.return_to=" + encodeURIComponent(returnTo),
        )
        .replace("openid.realm=" + encodeURIComponent(publicOrigin), "openid.realm=" + encodeURIComponent(publicOrigin)),
    );
  });
};
app.get("/steam/login", loginHandler);
app.get(`${authPrefix}/steam/login`, loginHandler);

const callbackHandler = (req: express.Request, res: express.Response) => {
  const redirect = req.query.redirect ? String(req.query.redirect) : frontendUrl;
  const returnTo = `${externalCallback}?redirect=${encodeURIComponent(redirect)}`;
  const rp = createRelyingParty(returnTo);
  rp.verifyAssertion(req, async (err: any, result?: any) => {
    try {
      if (err || !result?.claimedIdentifier) {
        console.error("steam verify failed", {
          err,
          result,
          host: req.headers.host,
          url: req.url,
          originalUrl: req.originalUrl,
          protocol: req.protocol,
        });
        return res.status(401).send("Steam login failed");
      }
      const steamId = result.claimedIdentifier.split("/").pop() || "";
      const personaName = (await getPersona(steamId)) || `User-${steamId.slice(-6)}`;
      const id = nanoid();
      const profile: Profile = { id, steamId, personaName, roles: ["user", ...(adminSteamIds.includes(steamId) ? (["admin"] as Role[]) : [])] };
      profiles.set(id, profile);
      persistProfile(profile).catch((e) => console.error("[postgres] persist profile", e));
      const token = issueToken(profile);
      res.send(`
        <html><body>
        <script>
          (function(){
            if (window.opener) {
              window.opener.postMessage({ type: "steam-login", token: "${token}" }, "*");
              window.close();
            } else {
              window.location = "${redirect}?token=${token}";
            }
          })();
        </script>
        </body></html>
      `);
    } catch (e) {
      console.error("steam callback error", e);
      res.status(500).send("Steam login failed");
    }
  });
};
app.get("/steam/callback", callbackHandler);
app.get(`${authPrefix}/steam/callback`, callbackHandler);

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      steam_id TEXT NOT NULL,
      persona_name TEXT NOT NULL,
      roles TEXT[] NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  app.listen(port, () => {
    console.log(`[auth-service] listening on port ${port}`);
  });
}

async function persistProfile(profile: Profile) {
  await pool.query(
    `INSERT INTO profiles (id, steam_id, persona_name, roles, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE SET steam_id = EXCLUDED.steam_id, persona_name = EXCLUDED.persona_name, roles = EXCLUDED.roles, updated_at = now();`,
    [profile.id, profile.steamId, profile.personaName, profile.roles],
  );
}

async function loadProfile(id: string): Promise<Profile | null> {
  const res = await pool.query(`SELECT id, steam_id, persona_name, roles FROM profiles WHERE id = $1`, [id]);
  const row = res.rows[0];
  if (!row) return null;
  const profile: Profile = { id: row.id, steamId: row.steam_id, personaName: row.persona_name, roles: row.roles };
  profiles.set(id, profile);
  return profile;
}

async function getPersona(steamId: string): Promise<string | null> {
  if (!steamApiKey) return null;
  try {
    const resp = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamApiKey}&steamids=${steamId}`,
    );
    const json = (await resp.json()) as any;
    return json?.response?.players?.[0]?.personaname || null;
  } catch {
    return null;
  }
}

init().catch((err) => {
  console.error("failed to init auth-service", err);
  process.exit(1);
});
