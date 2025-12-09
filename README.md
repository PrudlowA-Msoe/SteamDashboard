# Steam Live Game Stats Dashboard

Microservice-based web app that surfaces real-time and historical stats for selected Steam games and players. Includes role-based auth, near real-time match updates, cached game metadata, and admin-facing usage metrics.

## Architecture (proposed)
- API Gateway: HTTPS entrypoint, JWT verification, request throttling, routes to downstream services; also upgrades to WebSocket for live feeds.
- Auth & Profile Service: Steam OpenID login, account linking, RBAC (user/admin), stores profiles/preferences.
- Game & Player Stats Service: Calls Steam Web API + third-party sources to aggregate player/game stats; exposes REST; caches responses.
- Live Match Service: Polls match endpoints (initially Dota 2), normalizes events, pushes to Kafka (or Redis Streams) + WebSocket topics.
- Game Metadata Service: Caches app metadata (name/icon/genre/tags/platform) with TTL; pre-warms popular titles.
- Usage Metrics Service: Ingests request/latency counters via OTLP; serves secured admin metrics API.
- Web Client: SPA for dashboards (player views, leaderboards, live match feed) and admin metrics console.

## Tech Stack (suggested)
- Backend: TypeScript + NestJS (HTTP + WebSocket + cron); zod for validation; axios/fetch for upstream calls.
- Data: PostgreSQL for persistent user/profile data; Redis for caching and rate-limits; Kafka (or Redis Streams if simpler) for live match/event fan-out.
- Metrics/Tracing: OpenTelemetry SDK -> Prometheus; Grafana dashboards.
- Auth: Steam OpenID -> JWT (RS256), refresh tokens, role claims; optional Discord linking later.
- Frontend: React + Vite + TypeScript; Socket.IO client (or native ws) for live channels; TanStack Query for data fetching; Tailwind for UI.
- Containers/Orchestration: Docker Compose for local; Kubernetes (Helm) for cloud deployment; Traefik/Ingress NGINX as ingress.

## Data Flow
1) User signs in via Steam OpenID at Auth service; receives JWT with roles + profile id.
2) Web client calls API Gateway with JWT; gateway forwards to services.
3) Game & Player Stats fetches from Steam Web API, normalizes, caches in Redis; writes historical snapshots to Postgres.
4) Live Match polls Dota 2 match endpoint on schedule, emits normalized events to Kafka; WebSocket gateway subscribes and fans out to rooms.
5) Usage Metrics receives OTLP spans/metrics from services and exposes admin-only metrics summaries.
6) Game Metadata serves cached app details to avoid repeated upstream calls.

## Key Endpoints (initial cut)
- Auth: `POST /auth/steam/callback`, `POST /auth/refresh`, `GET /me`, `GET /me/roles`
- Profiles: `GET /profiles/:id`, `PATCH /profiles/:id` (self/admin), `POST /profiles/link-steam`
- Game Stats: `GET /games/:appId/summary`, `GET /games/:appId/leaderboard`, `GET /players/:steamId/stats`
- Live Match: `GET /live/dota/matches/:matchId`, WS channel `ws://.../live/dota/:matchId`
- Metadata: `GET /metadata/games/:appId`, `GET /metadata/search?q=`
- Metrics (admin): `GET /admin/metrics/usage`, `GET /admin/metrics/latency`, `GET /admin/health`

## Events / Topics
- Kafka topics (or Redis Streams):
  - `live.dota.match.{matchId}`: match events (kills/objectives/timeline)
  - `metrics.requests`: summarized request counts/latencies
  - `metadata.refresh`: cache invalidation requests

## Config & Secrets
- `STEAM_API_KEY`, `JWT_PUBLIC/PRIVATE`, `POSTGRES_URL`, `REDIS_URL`, `KAFKA_BROKERS`, `OTLP_ENDPOINT`.
- Use Doppler/Vault/K8s secrets; never bake into images.

## Deployment
- Local: `docker compose up` with services + Postgres + Redis + Kafka + Prometheus + Grafana.
- Cloud: Container registry -> CI deploy to Kubernetes; ingress TLS via cert-manager; autoscale Live Match and Game Stats services independently.

## Observability & Ops
- OpenTelemetry tracing (HTTP + DB + Kafka) across services.
- Prometheus scraping + Grafana dashboards (user/API latency, cache hit rate, match ingest lag).
- Structured logging (JSON) with correlation ids; log aggregation via Loki/ELK.

## Security / RBAC
- Role claims: `user`, `admin`.
- Gateway enforces JWT + rate limits; admin routes require `admin`.
- Service-to-service auth via mTLS or signed service tokens.

## Initial Milestones
1) Skeleton repo: shared `proto`/contracts, docker-compose, gateway + Auth service stub with Steam login mocked.
2) Implement Game Metadata cache + endpoints; wire React UI to list/search games.
3) Add Game & Player Stats with caching and basic charts in UI.
4) Add Live Match polling + WebSocket fan-out; build live match viewer.
5) Integrate metrics OTEL -> Prometheus; admin metrics screen.

## Current Status (local dev scaffold)
- Monorepo with workspaces: `api-gateway`, `auth-service`, `metadata-service`, `game-stats-service`, `live-service`, `web`.
- Docker Compose includes gateway/services + Postgres, Redis, Kafka/ZooKeeper, Prometheus, Grafana.
- Game Stats service integrates Steam Web API (player summaries/owned/recent) with Redis + Postgres snapshotting; game metadata fetched from Steam Store API with caching.
- Live service exposes a Dota-style simulated live feed via SSE; designed to swap in real polling or Kafka later.
- Metrics: `/metrics` exposed on gateway, auth, metadata, live, game-stats; Prometheus config targets them.
- Web UI: search cached games; query player stats (needs `STEAM_API_KEY` + JWT); lookup live app summaries via stats service (shows current player counts when available).

### Install
```bash
npm install
```
Run tests for the retry helper:
```bash
npm test
```

### Run services (local, no containers)
- Gateway: `npm run dev:gateway`
- Auth stub: `npm run dev:auth`
- Metadata: `npm run dev:metadata`
- Game stats: `npm run dev:stats`
- Live: `npm run dev:live`
- Web (Vite dev server): `npm run dev:web`

> Services default to ports 4000 (gateway), 4001 (auth), 4002 (metadata), 4003 (live), 4004 (game-stats), 5173 (web). Adjust via env vars if needed.
> Gateway enforces JWT on proxied routes; paste a token from `POST /auth/steam/callback` into the web UI or set `VITE_AUTH_TOKEN`.

### Build (all workspaces)
```bash
npm run build
```

### Docker Compose
```bash
docker compose up --build
```
Services exposed:
- Gateway: http://localhost:4000
- Auth: http://localhost:4001
- Metadata: http://localhost:4002
- Live: http://localhost:4003
- Game Stats: http://localhost:4004
- Web (preview server): http://localhost:4173
- Postgres: localhost:5432 (`steamapp`/`steamapp`)
- Redis: localhost:6379
- Kafka: localhost:9092 (ZK at 2181)
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)

Prometheus config lives at `deploy/prometheus/prometheus.yml` (gateway/auth/metadata/live/stats scrape enabled).
Grafana provisioning at `deploy/grafana/...` with a starter dashboard plotting cache hit rates and gateway latency.

### Environment
- `STEAM_API_KEY` (required for player stats; set in shell or docker compose env)
- `REDIS_URL` (default `redis://localhost:6379` or service address)
- `POSTGRES_URL` (default `postgres://steamapp:steamapp@localhost:5432/steamapp`)
- `JWT_SECRET` (gateway/auth shared; defaults to `dev-secret-change-me`)
- `METRICS_TOKEN` (bearer token to scrape `/metrics`; defaults to `prom-secret` and used by Prometheus config)

### API sketch (stubs)
- Gateway health: `GET /health`
- Auth: `POST /auth/steam/callback` (body `{ steamId?, personaName?, admin? }`), `POST /auth/refresh`, `GET /auth/me`
- Metadata: `GET /metadata/games?q=`, `GET /metadata/search?q=`, `GET /metadata/games/:appId`
- Game Stats: `GET /stats/games/:appId/summary` (cached Steam Store metadata), `GET /stats/players/:steamId/stats` (Steam Web API, cached + snapshot to Postgres)
- Live (SSE demo): `GET /live/dota/matches/:matchId`, `GET /live/dota/matches/:matchId/stream`
- Metrics: `GET /metrics` on each service

### Web UI
- Dev server: `npm run dev:web`
- API base: set `VITE_API_BASE` (defaults to `http://localhost:4000`)
- Features: search/filter cached games; fetch player stats by SteamID; lookup live app summaries via stats service; demo live service endpoint for future integration.
