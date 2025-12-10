import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GameMetadata } from "../types";

interface Props {
  token: string;
  apiBase: string;
}

type Spotlight = {
  game?: GameMetadata;
  playerCount?: number | null;
  loading: boolean;
  error?: string | null;
};

const HomePage = ({ token, apiBase }: Props) => {
  const [games, setGames] = useState<GameMetadata[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [spotlight, setSpotlight] = useState<Spotlight>({ loading: true });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setStatus(null);
      try {
        const res = await fetch(new URL("/metadata/games", apiBase).toString(), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Failed to load games (${res.status})`);
        const data = await res.json();
        const items: GameMetadata[] = data.items || [];
        setGames(items);
      } catch (e: any) {
        setStatus(e?.message || "Failed to load games");
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [apiBase, token]);

  const pickSpotlight = useMemo(() => {
    if (!games.length) return null;
    return games[Math.floor(Math.random() * games.length)];
  }, [games]);

  useEffect(() => {
    if (!pickSpotlight) {
      setSpotlight({ loading: false });
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      setSpotlight({ game: pickSpotlight, loading: true });
      try {
        const res = await fetch(new URL(`/stats/games/${pickSpotlight.appId}/summary`, apiBase).toString(), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const data = await res.json();
        setSpotlight({ game: pickSpotlight, playerCount: data?.concurrentPlayers ?? null, loading: false });
      } catch (e: any) {
        setSpotlight({ game: pickSpotlight, loading: false, error: e?.message || "Failed to load count" });
      }
    };
    load();
    return () => controller.abort();
  }, [pickSpotlight, apiBase, token]);

  return (
    <div className="page">
      <div className="hero">
        <div className="hero-card">
          <span className="pill">Steam Live Dashboard</span>
          <h1>Track games, matches, friends, and your Steam profile in one place.</h1>
          <p className="subhead">
            Live player counts, cached game details, friend activity, and news—secured with Steam login. Jump into Dota live
            matches or explore any game on Steam with a clean UI.
          </p>
          <div className="hero-cta">
            <Link to="/discover">
              <button>Browse games</button>
            </Link>
            <Link to="/dota-live">
              <button className="ghost badge-ghost">Watch live Dota</button>
            </Link>
            <Link to="/profile">
              <button className="ghost badge-ghost">My profile</button>
            </Link>
          </div>
          <div className="pill-row" style={{ marginTop: 10 }}>
            <span className="chip">Live player counts</span>
            <span className="chip">Cached metadata</span>
            <span className="chip">Friends & inventory</span>
            <span className="chip">Steam OpenID login</span>
          </div>
        </div>
        <div className="hero-card">
          <span className="eyebrow">Spotlight</span>
          <h2>{spotlight.game?.name || "Loading spotlight..."}</h2>
          <p className="subhead">
            Quick peek at a cached game. Click through to see news, player stats, and add it to your cache.
          </p>
          <div className="stat-badge">
            <strong>
              {spotlight.loading
                ? "Loading..."
                : spotlight.playerCount != null
                  ? spotlight.playerCount.toLocaleString()
                  : "N/A"}
            </strong>
            <span>Concurrent players right now</span>
          </div>
          <div className="quick-actions">
            {spotlight.game && (
              <>
                <Link to={`/games/${spotlight.game.appId}`}>
                  <button className="ghost">View details</button>
                </Link>
                <Link to="/news">
                  <button className="ghost">Read news</button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Discover</p>
            <h2>Cached games (fast search)</h2>
            <p className="subhead">These are preloaded so you can jump to details and news without typing app IDs.</p>
          </div>
          <Link to="/discover">
            <button className="ghost">Open discover</button>
          </Link>
        </div>
        <div className="grid">
          {loading && <div className="empty">Loading cached games...</div>}
          {!loading && games.length === 0 && <div className="empty">No cached games yet.</div>}
          {games.slice(0, 6).map((g) => (
            <div className="card" key={g.appId}>
              <div className="card-body">
                <div className="card-header">
                  <h3>{g.name}</h3>
                  <span className="app-id">App {g.appId}</span>
                </div>
                <p className="meta">{g.genres?.slice(0, 3).join(", ") || "Game"}</p>
                <div className="quick-actions">
                  <Link to={`/games/${g.appId}`}>
                    <button className="ghost">Details</button>
                  </Link>
                  <Link to="/news">
                    <button className="ghost">News</button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
        {status && <div className="callout warn">{status}</div>}
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">New idea</p>
            <h2>Featured Steam Freebies (idea)</h2>
            <p className="subhead">
              Next iteration: surface free-to-play or discounted Steam games using the store API and let visitors add them to the
              cache with one click. This would show live player counts plus recent news for each pick.
            </p>
          </div>
          <Link to="/live-search">
            <button className="ghost">Try live search</button>
          </Link>
        </div>
        <div className="chip-row">
          <span className="chip">Free-to-play picks</span>
          <span className="chip">One-click cache</span>
          <span className="chip">Player counts + news</span>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
