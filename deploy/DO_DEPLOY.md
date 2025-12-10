## DigitalOcean deployment guide (HTTPS + Steam OpenID)

### Prereqs
- A domain pointing to your droplet (e.g., `steamviewdashboard.online`).
- Steam API key.
- JWT secret.
- Latest docker / docker compose plugin on the droplet.

### 1) Clone the repo on the droplet
```bash
git clone <your-repo>
cd <your-repo>
```

### 2) Set env vars (production)
Create `.env` (sibling of `docker-compose.yml`) with at least:
```
STEAM_API_KEY=your-steam-key
JWT_SECRET=change-me
METRICS_TOKEN=prom-secret
POSTGRES_USER=steamapp
POSTGRES_PASSWORD=steamapp
POSTGRES_DB=steamapp
BASE_URL=https://steamviewdashboard.online/auth
FRONTEND_URL=https://steamviewdashboard.online
```

### 3) Configure Caddy for HTTPS
Edit `deploy/Caddyfile`, replace `steamviewdashboard.online` and email (already set to andrewprudlow@gmail.com):
```caddy
steamviewdashboard.online, www.steamviewdashboard.online {
  encode zstd gzip
  tls andrewprudlow@gmail.com
  @frontend {
    path / /assets* /index.html
  }
  handle_path /auth/* {
    reverse_proxy api-gateway:4000
  }
  handle {
    reverse_proxy api-gateway:4000
  }
}
```

### 4) Update docker-compose for prod ports (optional)
If desired, remove host port bindings on internal services and expose only Caddy. Example overrides:
```yaml
api-gateway:
  ports: []  # rely on Caddy
caddy:
  ports:
    - "80:80"
    - "443:443"
```
Ensure `caddy` service exists (add it mirroring `deploy/Caddyfile` volume).

### 5) Build and start
```bash
docker compose up --build -d
```

### 6) Verify
- Open `https://steamviewdashboard.online` and confirm the app loads.
- Steam login popup redirects to `https://steamviewdashboard.online/auth/steam/callback` and succeeds (OpenID).
- Gateway/API reachable only through HTTPS via Caddy.

### 7) Optional hardening
- Set up a DO firewall to allow 80/443 only (and 22 for SSH).
- Add persistence backups for Postgres volume.
- Rotate `JWT_SECRET`/`METRICS_TOKEN` for production.
