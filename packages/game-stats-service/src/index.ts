import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import { createClient as createRedisClient } from "redis";
import { Pool } from "pg";
import client, { collectDefaultMetrics, Registry } from "prom-client";
import { fetchWithRetry } from "./lib/http";

type OwnedGame = {
  appid: number;
  name: string;
  playtime_forever?: number;
  playtime_2weeks?: number;
  img_icon_url?: string;
};

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4004;
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const postgresUrl = process.env.POSTGRES_URL || "postgres://steamapp:steamapp@localhost:5432/steamapp";
const steamApiKey = process.env.STEAM_API_KEY;
const cacheTtlSeconds = process.env.CACHE_TTL_SECONDS ? Number(process.env.CACHE_TTL_SECONDS) : 3600;
const metricsToken = process.env.METRICS_TOKEN || "prom-secret";

const redis = createRedisClient({ url: redisUrl });
redis.on("error", (err: Error) => console.error("[redis] error", err));

const pool = new Pool({ connectionString: postgresUrl });
pool.on("error", (err: Error) => console.error("[postgres] error", err));

const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: "game_stats_" });

const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["route", "method", "status_code"],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

const upstreamDuration = new client.Histogram({
  name: "steam_upstream_duration_seconds",
  help: "Steam API upstream call duration in seconds",
  labelNames: ["endpoint"],
  buckets: [0.1, 0.3, 0.6, 1, 2, 4],
  registers: [metricsRegistry],
});

const cacheHits = new client.Counter({
  name: "cache_hits_total",
  help: "Cache hits by resource",
  labelNames: ["resource"],
  registers: [metricsRegistry],
});

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use((req, res, next) => {
  const end = httpDuration.startTimer({ route: req.path, method: req.method });
  res.on("finish", () => {
    end({ status_code: res.statusCode });
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "game-stats-service" });
});

app.get("/metrics", async (_req, res) => {
  const auth = _req.headers.authorization;
  if (auth !== `Bearer ${metricsToken}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  res.set("Content-Type", metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

app.get("/games/:appId/summary", async (req, res) => {
  const appId = req.params.appId;
  try {
    const data = await getGameSummary(appId);
    res.json({ item: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed_to_fetch_game", message: (err as Error).message });
  }
});

app.get("/players/:steamId/stats", async (req, res) => {
  const steamId = req.params.steamId;
  if (!steamApiKey) {
    return res.status(500).json({ error: "missing_api_key", message: "Set STEAM_API_KEY to query player stats." });
  }
  try {
    const data = await getPlayerStats(steamId);
    res.json({ item: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed_to_fetch_player", message: (err as Error).message });
  }
});

async function init() {
  await redis.connect();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_stats_snapshots (
      id SERIAL PRIMARY KEY,
      steam_id TEXT NOT NULL,
      snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_metadata_cache (
      app_id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  app.listen(port, () => {
    console.log(`[game-stats-service] listening on port ${port}`);
  });
}

async function getGameSummary(appId: string) {
  const cacheKey = `game:summary:${appId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    cacheHits.inc({ resource: "game_summary" });
    return JSON.parse(cached);
  }

  const timer = upstreamDuration.startTimer({ endpoint: "appdetails" });
  const resp = await fetchWithRetry(`https://store.steampowered.com/api/appdetails?appids=${appId}`, {}, 2, 300);
  timer();
  const json = (await resp.json()) as Record<string, { success: boolean; data?: any }>;
  const entry = json[appId];
  if (!entry?.success || !entry.data) {
    throw new Error("App not found");
  }
  const data = entry.data;

  const currentPlayers = await getCurrentPlayers(appId);

  const summary = {
    appId,
    name: data.name,
    type: data.type,
    isFree: Boolean(data.is_free),
    headerImage: data.header_image,
    shortDescription: data.short_description,
    genres: (data.genres || []).map((g: any) => g.description),
    platforms: data.platforms,
    price: data.price_overview || null,
    publishers: data.publishers || [],
    developers: data.developers || [],
    categories: (data.categories || []).map((c: any) => c.description),
    currentPlayers,
  };

  await redis.set(cacheKey, JSON.stringify(summary), { EX: cacheTtlSeconds });
  await persistGameMetadata(summary);
  return summary;
}

async function persistGameMetadata(payload: any) {
  try {
    await pool.query(
      `INSERT INTO game_metadata_cache (app_id, payload, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (app_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();`,
      [payload.appId, payload],
    );
  } catch (err) {
    console.error("[postgres] failed to upsert game metadata", err);
  }
}

async function getPlayerStats(steamId: string) {
  const cacheKey = `player:stats:${steamId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    cacheHits.inc({ resource: "player_stats" });
    return JSON.parse(cached);
  }

  const profile = await fetchPlayerSummary(steamId);
  const owned = await fetchOwnedGames(steamId);
  const recent = await fetchRecentlyPlayed(steamId);

  const totalPlaytimeMinutes = owned.reduce((acc: number, g: OwnedGame) => acc + (g.playtime_forever || 0), 0);
  const topGames = owned
    .sort((a: OwnedGame, b: OwnedGame) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
    .slice(0, 5)
    .map((g: OwnedGame) => ({
      appId: g.appid,
      name: g.name,
      playtimeHours: Number(((g.playtime_forever || 0) / 60).toFixed(1)),
      icon: g.img_icon_url,
    }));

  const payload = {
    profile,
    totals: {
      ownedGames: owned.length,
      recentGames: recent.length,
      totalPlaytimeHours: Number((totalPlaytimeMinutes / 60).toFixed(1)),
    },
    topGames,
    recentGames: recent.map((g: OwnedGame) => ({
      appId: g.appid,
      name: g.name,
      playtime2WeeksHours: Number(((g.playtime_2weeks || 0) / 60).toFixed(1)),
      playtimeForeverHours: Number(((g.playtime_forever || 0) / 60).toFixed(1)),
    })),
  };

  await redis.set(cacheKey, JSON.stringify(payload), { EX: 300 });
  await persistPlayerSnapshot(steamId, payload);
  return payload;
}

async function fetchPlayerSummary(steamId: string) {
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamApiKey}&steamids=${steamId}`;
  const timer = upstreamDuration.startTimer({ endpoint: "GetPlayerSummaries" });
  const resp = await fetchWithRetry(url, {}, 2, 300);
  timer();
  const json = (await resp.json()) as any;
  return json.response?.players?.[0] || null;
}

async function fetchOwnedGames(steamId: string): Promise<OwnedGame[]> {
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${steamApiKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`;
  const timer = upstreamDuration.startTimer({ endpoint: "GetOwnedGames" });
  const resp = await fetchWithRetry(url, {}, 2, 300);
  timer();
  const json = (await resp.json()) as any;
  return (json.response?.games || []) as OwnedGame[];
}

async function fetchRecentlyPlayed(steamId: string): Promise<OwnedGame[]> {
  const url = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${steamApiKey}&steamid=${steamId}`;
  const timer = upstreamDuration.startTimer({ endpoint: "GetRecentlyPlayedGames" });
  const resp = await fetchWithRetry(url, {}, 2, 300);
  timer();
  const json = (await resp.json()) as any;
  return (json.response?.games || []) as OwnedGame[];
}

async function getCurrentPlayers(appId: string): Promise<number | null> {
  if (!steamApiKey) return null;
  const url = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?key=${steamApiKey}&appid=${appId}`;
  const timer = upstreamDuration.startTimer({ endpoint: "GetNumberOfCurrentPlayers" });
  try {
    const resp = await fetchWithRetry(url, {}, 2, 300);
    timer();
    const json = (await resp.json()) as any;
    return json.response?.player_count ?? null;
  } catch (err) {
    timer();
    console.warn("[steam] failed to fetch current players", err);
    return null;
  }
}

async function persistPlayerSnapshot(steamId: string, payload: any) {
  try {
    await pool.query(
      `INSERT INTO player_stats_snapshots (steam_id, snapshot, created_at) VALUES ($1, $2, now());`,
      [steamId, payload],
    );
  } catch (err) {
    console.error("[postgres] failed to insert player snapshot", err);
  }
}

init().catch((err) => {
  console.error("failed to init game-stats-service", err);
  process.exit(1);
});
