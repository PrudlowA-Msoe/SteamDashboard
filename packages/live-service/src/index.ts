import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import { EventEmitter } from "events";
import client, { collectDefaultMetrics, Registry } from "prom-client";

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4003;
const tickMs = process.env.TICK_MS ? Number(process.env.TICK_MS) : 3000;
const metricsToken = process.env.METRICS_TOKEN || "prom-secret";

type MatchState = {
  matchId: string;
  radiantScore: number;
  direScore: number;
  durationSeconds: number;
  updatedAt: number;
  league?: string;
  teams?: { radiant: string; dire: string };
};

const matches = new Map<string, MatchState>();
const bus = new EventEmitter();

const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: "live_service_" });

const eventsDelivered = new client.Counter({
  name: "live_events_delivered_total",
  help: "Total SSE events delivered",
  labelNames: ["matchId"],
  registers: [metricsRegistry],
});

const watchersGauge = new client.Gauge({
  name: "live_watchers",
  help: "Current SSE watchers per match",
  labelNames: ["matchId"],
  registers: [metricsRegistry],
});

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "live-service" });
});

app.get("/metrics", async (_req, res) => {
  const auth = _req.headers.authorization;
  if (auth !== `Bearer ${metricsToken}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  res.set("Content-Type", metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

app.get("/dota/matches/:matchId", (req, res) => {
  const match = ensureMatch(req.params.matchId);
  res.json({ item: match });
});

app.get("/dota/matches/:matchId/stream", (req, res) => {
  const matchId = req.params.matchId;
  ensureMatch(matchId);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(`event: init\ndata: ${JSON.stringify(matches.get(matchId))}\n\n`);

  const handler = (payload: any) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    eventsDelivered.inc({ matchId });
  };
  bus.on(matchId, handler);
  watchersGauge.inc({ matchId });

  req.on("close", () => {
    bus.off(matchId, handler);
    watchersGauge.dec({ matchId });
  });
});

function ensureMatch(matchId: string): MatchState {
  const existing = matches.get(matchId);
  if (existing) return existing;
  const state: MatchState = {
    matchId,
    radiantScore: Math.floor(Math.random() * 5),
    direScore: Math.floor(Math.random() * 5),
    durationSeconds: 600 + Math.floor(Math.random() * 300),
    updatedAt: Date.now(),
    league: "Demo League",
    teams: { radiant: "Radiant Academy", dire: "Dire United" },
  };
  matches.set(matchId, state);
  return state;
}

function tickMatches() {
  matches.forEach((match, matchId) => {
    const delta = Math.floor(Math.random() * 3) + 1;
    match.durationSeconds += delta;
    if (Math.random() > 0.6) {
      if (Math.random() > 0.5) {
        match.radiantScore += 1;
      } else {
        match.direScore += 1;
      }
    }
    match.updatedAt = Date.now();
    matches.set(matchId, match);
    bus.emit(matchId, match);
  });
}

setInterval(tickMatches, tickMs);
ensureMatch("demo-570");

app.listen(port, () => {
  console.log(`[live-service] listening on port ${port}`);
});
