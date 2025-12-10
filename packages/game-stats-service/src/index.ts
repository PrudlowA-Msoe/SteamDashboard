import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import { createClient as createRedisClient } from "redis";
import { Pool } from "pg";
import client, { collectDefaultMetrics, Registry } from "prom-client";
import { fetchWithRetry } from "./lib/http";
import jwt from "jsonwebtoken";

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
const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";
const dotaLiveBase = "https://api.steampowered.com/IDOTA2Match_570";
const leagueCache: Map<number, { name: string; tier?: string; lastUpdated: number }> = new Map();
const teamCache: Map<number, { name: string; logo?: string; lastUpdated: number }> = new Map();

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

app.get("/games/:appId/news", async (req, res) => {
  const appId = req.params.appId;
  try {
    const items = await getGameNews(appId);
    res.json({ count: items.length, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed_to_fetch_news", message: (err as Error).message });
  }
});

app.get("/players/:steamId/stats", async (req, res) => {
  const steamId = resolveSteamId(req, req.params.steamId);
  if (!steamId) return res.status(401).json({ error: "unauthorized" });
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

app.get("/players/:steamId/friends", async (req, res) => {
  const steamId = resolveSteamId(req, req.params.steamId);
  if (!steamId) return res.status(401).json({ error: "unauthorized" });
  if (!steamApiKey) {
    return res.status(500).json({ error: "missing_api_key", message: "Set STEAM_API_KEY to query friends." });
  }
  try {
    const friends = await getFriendsWithProfiles(steamId);
    res.json({ count: friends.length, items: friends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed_to_fetch_friends", message: (err as Error).message });
  }
});

app.get("/players/:steamId/inventory", async (req, res) => {
  const steamId = resolveSteamId(req, req.params.steamId);
  if (!steamId) return res.status(401).json({ error: "unauthorized" });
  const appId = String(req.query.appId || "730");
  const contextId = String(req.query.contextId || "2");
  try {
    const items = await getInventory(steamId, appId, contextId);
    res.json({ count: items.length, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed_to_fetch_inventory", message: (err as Error).message });
  }
});

app.get("/live/dota/featured", async (_req, res) => {
  if (!steamApiKey) return res.status(500).json({ error: "missing_api_key" });
  try {
    const games = await getFeaturedDotaGames();
    res.json({ count: games.length, items: games });
  } catch (err) {
    console.error("[dota_live] failed", err);
    res.status(500).json({ error: "failed_to_fetch_live", message: (err as Error).message });
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

async function getFriendsWithProfiles(steamId: string) {
  const listUrl = `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${steamApiKey}&steamid=${steamId}`;
  const listResp = await fetchWithRetry(listUrl, {}, 2, 300);
  const listJson = (await listResp.json()) as any;
  const friends: string[] = listJson?.friendslist?.friends?.map((f: any) => f.steamid) || [];
  if (!friends.length) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < friends.length; i += 50) {
    chunks.push(friends.slice(i, i + 50));
  }
  const profiles: any[] = [];
  for (const chunk of chunks) {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamApiKey}&steamids=${chunk.join(",")}`;
    const resp = await fetchWithRetry(url, {}, 2, 300);
    const json = (await resp.json()) as any;
    profiles.push(...(json.response?.players || []));
  }

  return profiles.map((p) => ({
    steamId: p.steamid,
    personaName: p.personaname,
    avatar: p.avatarfull,
    profileUrl: p.profileurl,
    status: statusText(p.personastate),
    lastLogoff: p.lastlogoff,
    game: p.gameextrainfo,
  }));
}

function resolveSteamId(req: express.Request, paramId: string) {
  if (paramId !== "me") return paramId;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.slice("Bearer ".length);
    const decoded = jwt.verify(token, jwtSecret) as jwt.JwtPayload & { steamId?: string };
    return decoded.steamId || null;
  } catch {
    return null;
  }
}

async function getFeaturedDotaGames() {
  const url = `${dotaLiveBase}/GetTopLiveGame/v1/?key=${steamApiKey}&partner=0`;
  const resp = await fetchWithRetry(url, {}, 2, 300).catch((err) => {
    console.error("[dota_live] upstream error", err);
    return null;
  });
  if (!resp) return [];
  if (!resp.ok) {
    // Steam occasionally 404s this endpoint; return empty instead of throwing
    if (resp.status === 404) return [];
    const body = await resp.text();
    throw new Error(`top live failed ${resp.status} ${body}`);
  }
  const json = (await resp.json()) as any;
  const games = json?.game_list || [];

  // collect IDs for league/team hydration
  const leagueIds: number[] = Array.from(new Set(games.map((g: any) => Number(g.league_id)).filter((v: number) => Number.isFinite(v))));
  const teamIds: number[] = Array.from(
    new Set(
      games
        .map((g: any) => [g.radiant_team_id, g.dire_team_id])
        .flat()
        .map((id: any) => Number(id))
        .filter((id: number) => Number.isFinite(id)),
    ),
  );

  const [leagueMap, teamMap] = await Promise.all([hydrateLeagues(leagueIds), hydrateTeams(teamIds)]);

  return games.map((g: any) => ({
    matchId: g.match_id,
    spectators: g.spectators,
    averageMmr: g.average_mmr,
    radiant: {
      name: teamMap.get(g.radiant_team_id)?.name || g.radiant_name,
      score: g.radiant_score,
      towers: g.radiant_tower_state,
      barracks: g.radiant_barracks_state,
      logo: teamMap.get(g.radiant_team_id)?.logo,
      id: g.radiant_team_id,
    },
    dire: {
      name: teamMap.get(g.dire_team_id)?.name || g.dire_name,
      score: g.dire_score,
      towers: g.dire_tower_state,
      barracks: g.dire_barracks_state,
      logo: teamMap.get(g.dire_team_id)?.logo,
      id: g.dire_team_id,
    },
    durationSeconds: g.game_time,
    roshanRespawnTimer: g.roshan_respawn_timer,
    league: g.league_id,
    leagueName: leagueMap.get(g.league_id)?.name,
    seriesType: seriesText(g.series_type),
    gameNumber: g.game_number,
    startTime: g.start_time,
    state: formatObjectiveState(g),
    players: (g.players || []).map((p: any) => ({
      accountId: p.account_id,
      heroId: p.hero_id,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      gpm: p.gpm,
      xpm: p.xpm,
      netWorth: p.net_worth,
      level: p.level,
      team: p.team,
      name: p.name,
    })),
  }));
}

function seriesText(seriesType?: number) {
  switch (seriesType) {
    case 0:
      return "Bo1";
    case 1:
      return "Bo3";
    case 2:
      return "Bo5";
    default:
      return "Live";
  }
}

function formatObjectiveState(g: any) {
  const towers = `Towers R${g.radiant_tower_state} / D${g.dire_tower_state}`;
  const barracks = `Barracks R${g.radiant_barracks_state} / D${g.dire_barracks_state}`;
  const rosh = g.roshan_respawn_timer ? `Roshan in ${g.roshan_respawn_timer}s` : "Roshan unknown";
  return `${towers} • ${barracks} • ${rosh}`;
}

async function hydrateLeagues(ids: number[]) {
  const map = new Map<number, { name: string; tier?: string }>();
  const staleBefore = Date.now() - 5 * 60 * 1000;
  for (const id of ids) {
    const cached = leagueCache.get(id);
    if (cached && cached.lastUpdated > staleBefore) {
      map.set(id, { name: cached.name, tier: cached.tier });
    }
  }
  const missing = ids.filter((id) => !map.has(id));
  if (!missing.length) return new Map([...map]);
  const url = `${dotaLiveBase}/GetLeagueListing/v1?key=${steamApiKey}&l=english`;
  const resp = await fetchWithRetry(url, {}, 1, 300);
  const json = (await resp.json()) as any;
  const leagues = json?.result?.leagues || [];
  leagues.forEach((l: any) => {
    leagueCache.set(l.leagueid, { name: l.name, tier: l.tier, lastUpdated: Date.now() });
    if (ids.includes(l.leagueid)) {
      map.set(l.leagueid, { name: l.name, tier: l.tier });
    }
  });
  return map;
}

async function hydrateTeams(ids: number[]) {
  const map = new Map<number, { name: string; logo?: string }>();
  const staleBefore = Date.now() - 5 * 60 * 1000;
  const missing: number[] = [];
  for (const id of ids) {
    if (!id) continue;
    const cached = teamCache.get(id);
    if (cached && cached.lastUpdated > staleBefore) {
      map.set(id, { name: cached.name, logo: cached.logo });
    } else {
      missing.push(id);
    }
  }
  for (const id of missing) {
    const url = `${dotaLiveBase}/GetTeamInfoByTeamID/v1?key=${steamApiKey}&team_id=${id}&teams_requested=1`;
    try {
      const resp = await fetchWithRetry(url, {}, 1, 300);
      const json = (await resp.json()) as any;
      const entry = json?.result?.teams?.[0];
      if (entry) {
        const logo = entry.logo_url || entry.logo;
        teamCache.set(id, { name: entry.name || entry.tag || `Team ${id}`, logo, lastUpdated: Date.now() });
        map.set(id, { name: entry.name || entry.tag || `Team ${id}`, logo });
      }
    } catch (err) {
      console.error("[dota_live] team hydrate failed", err);
    }
  }
  return map;
}
function statusText(state: number) {
  switch (state) {
    case 0:
      return "Offline";
    case 1:
      return "Online";
    case 2:
      return "Busy";
    case 3:
      return "Away";
    case 4:
      return "Snooze";
    case 5:
      return "Looking to trade";
    case 6:
      return "Looking to play";
    default:
      return "Unknown";
  }
}

async function getInventory(steamId: string, appId: string, contextId: string) {
  const url = `https://steamcommunity.com/inventory/${steamId}/${appId}/${contextId}?l=english&count=200`;
  const resp = await fetchWithRetry(url, {}, 2, 300);
  const json = (await resp.json()) as any;
  const assets = json.assets || [];
  const descriptions = json.descriptions || [];
  const descMap = new Map<string, any>();
  descriptions.forEach((d: any) => {
    descMap.set(`${d.classid}_${d.instanceid || "0"}`, d);
  });
  return assets.map((a: any) => {
    const key = `${a.classid}_${a.instanceid || "0"}`;
    const d = descMap.get(key) || {};
    return {
      assetId: a.assetid,
      classId: a.classid,
      name: d.market_name || d.name || "Item",
      type: d.type,
      icon: d.icon_url ? `https://steamcommunity-a.akamaihd.net/economy/image/${d.icon_url}` : undefined,
      tradable: Boolean(d.tradable),
    };
  });
}

async function getGameNews(appId: string) {
  const keyParam = steamApiKey ? `&key=${steamApiKey}` : "";
  const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}&count=5${keyParam}`;
  const resp = await fetchWithRetry(url, {}, 2, 300);
  const json = (await resp.json()) as any;
  const newsItems = json?.appnews?.newsitems || [];
  return newsItems.map((item: any) => ({
    gid: item.gid,
    title: item.title,
    url: item.url,
    author: item.author,
    date: item.date,
    contents: item.contents,
  }));
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
