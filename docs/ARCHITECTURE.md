# SteamDash Architecture Overview

## High-level
- **Pattern:** Microservices behind an API gateway, fronted by Caddy for TLS and path routing.
- **Runtime:** Docker Compose (multi-container); ready to run on a single host or cloud VM.
- **Data:** Postgres (user/profile/snapshots), Redis (caching), Kafka/Zookeeper (event streaming placeholder), Prometheus (metrics), Grafana (dashboards).
- **Auth:** Steam OpenID login (via auth-service) -> JWT with roles; RBAC enforced at the gateway and services.

## Services
| Service | Purpose | Key Ports | Notes |
| --- | --- | --- | --- |
| api-gateway | Single entry point; routes to services; enforces JWT/RBAC; exposes admin usage endpoint. | 4000 | Proxies /auth, /metadata, /stats, /live, /admin |
| auth-service | Steam OpenID flow; issues JWTs; admin override for SteamID 76561198168642529. | 4001 | Metrics at /metrics |
| metadata-service | Game metadata cache (names, icons, genres); used by Discover/search. | 4002 | |
| live-service | Live match streaming/events (e.g., Dota). | 4003 | |
| game-stats-service | Aggregates Steam API data: spotlight, player counts, achievements, news, Dota live hydration; stores snapshots. | 4004 | Metrics at /metrics |
| web | React/Vite frontend. | 4173 | Consumes gateway APIs |
| postgres | Primary DB for profiles, snapshots, usage. | 5432 | |
| redis | Cache for API responses and schemas. | 6379 | |
| kafka + zookeeper | Event streaming backbone (ready for live/event use). | 9092 / 2181 | |
| prometheus | Scrapes service metrics. | 9090 | |
| grafana | Dashboards (usage-overview, etc.). | 3000 (served via /grafana) | |
| caddy | TLS termination and reverse proxy for all routes. | 80/443 | Handles subpaths (/grafana, /admin, etc.) |

## Data flows
- **User login:** Frontend → gateway `/auth/steam/login` → auth-service (Steam OpenID) → gateway returns JWT → stored client-side → attached to API calls.
- **RBAC:** Gateway checks JWT roles; admin routes (`/admin/*`, usage metrics) require `admin`.
- **Spotlight:** Frontend `/stats/spotlight/:appid` → game-stats-service aggregates owned games, achievements, player counts, news, and cached player-count trend; writes snapshots (throttled).
- **Dota Live:** Frontend `/stats/live/dota/featured` and list → game-stats-service fetches Steam live leagues, hydrates league/team logos, series/state, caches responses.
- **Metrics:** Services expose `/metrics`; Prometheus scrapes; Grafana dashboards available at `/grafana`.
- **Usage tracking:** Gateway records per-endpoint usage; admin view via `/admin/usage` (JSON or Grafana dashboards).

## Storage & caching
- **Postgres:** Profiles, usage stats, player_count_snapshots (per app, with throttled writes).
- **Redis:** Short TTL caches for spotlight aggregates (~60s) and Steam schemas (achievements ~24h).
- **Prometheus:** Time-series for latency/RPS/error metrics.

## Security & access
- HTTPS via Caddy + Let’s Encrypt.
- JWT (HS256) with shared `JWT_SECRET` across gateway/services.
- Admin SteamID whitelist: 76561198168642529 (configurable via env).
- CORS: gateway allows frontend origin (configured via env).

## Observability
- **Metrics:** Prometheus scrape; Grafana dashboards (usage-overview) via `/grafana/d/usage-overview`.
- **Usage admin:** `/admin/usage` (gateway) returns parsed metrics; frontend Usage tab summarizes.
- **Logs:** Service stdout (Docker); Caddy logs requests.

## Deployment
- **Compose:** `docker compose up -d --build` (requires Steam API key, JWT secret, frontend/base URLs in `.env`).
- **Ingress:** Caddy proxies subpaths to internal services; Grafana served from subpath (`GF_SERVER_ROOT_URL=/grafana`).
- **Scaling:** Increase replicas per service in compose or migrate to Kubernetes. Frontend/API are stateless; DB/Redis single-instance in this setup.

## Notable endpoints (gateway-exposed)
- `/auth/steam/login`, `/auth/steam/callback` – Steam login.
- `/metadata/games` – Cached game metadata.
- `/stats/spotlight/owned` – Owned games (requires JWT).
- `/stats/spotlight/:appid` – Spotlight aggregate for a game.
- `/stats/live/dota/featured`, `/stats/live/dota/list` – Live Dota matches.
- `/admin/usage` – Admin-only usage/metrics JSON view.
- `/grafana` – Grafana UI (proxied).

## Frontend tabs
- Discover, Live Search, Featured, Dota Live, Game Spotlight, Usage (admin), Profile, News.
- Spotlight: picker (owned/recent), header, achievements, current players + trend, news.
- Dota Live: featured match + list selector with hydrated logos/series/state.
- Usage: parsed metrics and link to Grafana dashboard.

