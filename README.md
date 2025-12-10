# Steam Live Game Stats Dashboard

Microservices web app that surfaces real-time and historical Steam game/player data (game metadata, live Dota matches, player stats, friends, news, player counts) with RBAC, usage metrics, and an admin Usage console.

## Architecture & Containers
- **api-gateway** (Node/Express): single entry point, JWT/RBAC enforcement, metrics, proxies `/auth`, `/metadata`, `/stats`, `/live`, `/players`, `/admin`.
- **auth-service** (Node/Express): Steam OpenID login, issues JWT with roles (admin/user). Admins can be force-listed via `ADMIN_STEAM_IDS`.
- **metadata-service** (Node/Express): cached game metadata, live store search, featured free/discounted games, cache add.
- **game-stats-service** (Node/Express): Steam Web API aggregation (owned games, spotlight, player stats, friends, inventory), Dota live feed, player-count snapshots, achievement aggregation, news.
- **live-service** (Node/Express): live/event placeholder (kept in stack for live updates).
- **web** (React/Vite): multi-page SPA (Discover, Live Search, Featured, Dota Live, Game Spotlight, Profile, News, Usage).
- **postgres**: persistent store (profiles, snapshots, player_count_snapshots, metadata cache).
- **redis**: caching for upstream calls, spotlight, schemas.
- **kafka + zookeeper**: event streaming backbone (included; Dota live scaffolding ready).
- **prometheus**: scrapes service metrics.
- **grafana**: dashboards (usage-overview, steam-dashboard).
- **caddy**: TLS termination + reverse proxy (serves `/`, proxies API paths, `/grafana`).

## Running locally / on the droplet
Prereqs: Docker + docker compose.

1) Set env in `.env` (root):
```
STEAM_API_KEY=your_steam_api_key
JWT_SECRET=your_strong_secret
ADMIN_STEAM_IDS=76561198168642529   # admins
AUTH_BASE_URL=https://steamviewdashboard.online/auth   # for prod; http://localhost:4001 for local
FRONTEND_URL=https://steamviewdashboard.online        # for prod; http://localhost:4173 for local
VITE_API_BASE=https://steamviewdashboard.online       # for prod; http://localhost:4000 for local
```

2) Build and run:
```
docker compose up -d --build
```

3) Services listen on:
- Gateway: 4000 (through Caddy at 80/443 in prod)
- Auth: 4001
- Metadata: 4002
- Live: 4003
- Game-stats: 4004
- Web: 4173 (through Caddy 80/443)
- Grafana: 3000 (exposed and also via `/grafana`)
- Prometheus: 9090

4) Steam login: use `/auth/steam/login?redirect=<front_end>` via the web UI. Admin SteamIDs automatically get `admin` role.

5) Usage/admin metrics:
- In-app: `/usage` (admin only) fetches gateway metrics.
- Grafana: `https://<your-domain>/grafana/d/usage-overview` (served from sub-path via Caddy); default Grafana admin password is set in compose (`admin`).

## API (selected endpoints)
- Auth: `POST /auth/steam/login` (redirect), `POST /auth/steam/callback`, `GET /auth/health`, `GET /auth/metrics` (Bearer prom-secret), `POST /auth/refresh`.
- Metadata: `GET /metadata/games`, `POST /metadata/games/cache` (body: `{appId}`), `GET /metadata/search/live?q=`, `GET /metadata/featured/free|discounts`.
- Stats / Spotlight:
  - `GET /stats/spotlight/owned` (auth) – owned + recent games.
  - `GET /stats/spotlight/:appId` (auth) – aggregated spotlight (playtime, achievements, current players, news, trend).
  - `GET /stats/games/:appId/summary` – game summary + current players.
  - `GET /stats/live/dota/featured` – live Dota matches (with league/team hydration).
  - `GET /players/:steamId/friends`, `GET /players/:steamId/inventory`.
- Admin metrics: `GET /admin/usage` and `/stats/admin/usage` (JWT admin role).

Simple use case (Game Spotlight):
1) User logs in with Steam.
2) Frontend calls `GET /stats/spotlight/owned` to seed picker, selects appId.
3) Frontend calls `GET /stats/spotlight/:appId` to render playtime, achievements, current players, trend, and news.

## How requirements are met
- **Microservices with multiple endpoints + consumer app:** Gateway, auth-service, metadata-service, game-stats-service, live-service, web SPA consuming REST APIs; Kafka included for event streaming.
- **Containerized deployment on cloud:** Docker Compose stack running on a cloud droplet with Caddy TLS.
- **Access controls:** JWT + roles enforced at gateway; admin-only endpoints (`/admin/usage`, `/stats/admin/usage`); metrics token on `/metrics`.
- **Usage stats per endpoint + admin access:** Prometheus metrics emitted by each service; admin endpoints expose metrics; Grafana dashboards available.

Additional requirements (fulfilled):
- **Storage in containers:** Postgres + Redis.
- **Event streaming:** Kafka + Zookeeper included for live/event streaming.
- **Monitoring:** Prometheus + Grafana provisioned dashboards.
- **Novel/entertainment value:** Steam game/live match dashboard with spotlight, achievements, live Dota, featured games, and admin usage views.

## Notes
- Admin SteamID default: `76561198168642529` (override via `ADMIN_STEAM_IDS`).
- Grafana served from `/grafana`; Prometheus at 9090.
- TLS handled by Caddy; set proper domain/email in `deploy/Caddyfile`.

## Performance/load test (k6)
We include a simple k6 script under `load/load-test.js` to measure latency under load.

### Prereqs
- k6 installed locally (`brew install k6`) **or** use Docker: `docker run --rm -i -v $PWD:/scripts grafana/k6 run /scripts/load/load-test.js`
- A valid JWT in `JWT` env var for authenticated endpoints.

### Run with k6 locally
```bash
JWT="Bearer your_jwt_here" BASE=https://steamviewdashboard.online VUS=30 DURATION=2m k6 run load/load-test.js
```
- Env vars:
  - `JWT`: auth header value (include `Bearer ...`), optional for public endpoints.
  - `BASE`: target base URL (default `https://steamviewdashboard.online`).
  - `VUS`: virtual users (default 20).
  - `DURATION`: test duration (default `2m`).

### Run with Docker k6
```bash
docker run --rm -i -e JWT="Bearer your_jwt_here" -e BASE=https://steamviewdashboard.online -e VUS=30 -e DURATION=2m -v $PWD:/scripts grafana/k6 run /scripts/load/load-test.js
```

### What it measures
- Requests to `/stats/spotlight/owned`, `/metadata/games`, `/stats/games/570/summary`
- Reports p50/p90/p95/p99 latencies, failure rate, and RPS in the k6 summary output.

### Reporting
- Save output to a file, e.g.: `k6 run load/load-test.js > reports/k6-spotlight.txt`
- Adjust VUs/duration/endpoints as needed; use thresholds in the script to assert targets (defaults: p95<600ms, p99<900ms, errors<1%).
