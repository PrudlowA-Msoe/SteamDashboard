import { useEffect, useMemo, useState } from "react";
import { GameMetadata, GameSummary, PlayerStats } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:4000";
const DEFAULT_TOKEN = (import.meta.env.VITE_AUTH_TOKEN as string) || "";

interface FetchState {
  loading: boolean;
  error: string | null;
  items: GameMetadata[];
}

const App = () => {
  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [query, setQuery] = useState("");
  const [{ loading, error, items }, setState] = useState<FetchState>({
    loading: true,
    error: null,
    items: [],
  });
  const [steamId, setSteamId] = useState("");
  const [playerState, setPlayerState] = useState<{ loading: boolean; error: string | null; data: PlayerStats | null }>({
    loading: false,
    error: null,
    data: null,
  });
  const [appIdQuery, setAppIdQuery] = useState("");
  const [gameState, setGameState] = useState<{ loading: boolean; error: string | null; data: GameSummary | null }>({
    loading: false,
    error: null,
    data: null,
  });

  const endpoint = useMemo(() => {
    const trimmed = query.trim();
    const url = new URL("/metadata/games", API_BASE);
    if (trimmed.length) {
      url.searchParams.append("q", trimmed);
    }
    return url.toString();
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetch(endpoint, {
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        const payload = await res.json();
        setState({ loading: false, error: null, items: payload.items ?? [] });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({ loading: false, error: err.message, items: [] });
      });
    return () => controller.abort();
  }, [endpoint, token]);

  const fetchPlayerStats = async () => {
    const id = steamId.trim();
    if (!id) {
      setPlayerState((prev) => ({ ...prev, error: "Enter a SteamID64 to query stats." }));
      return;
    }
    setPlayerState({ loading: true, error: null, data: null });
    try {
      const res = await fetch(`${API_BASE}/stats/players/${id}/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.message || "Request failed");
      }
      setPlayerState({ loading: false, error: null, data: payload.item });
    } catch (err) {
      setPlayerState({ loading: false, error: (err as Error).message, data: null });
    }
  };

  const fetchGameSummary = async () => {
    const appId = appIdQuery.trim();
    if (!appId) {
      setGameState((prev) => ({ ...prev, error: "Enter an appId to lookup metadata." }));
      return;
    }
    setGameState({ loading: true, error: null, data: null });
    try {
      const res = await fetch(`${API_BASE}/stats/games/${appId}/summary`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.message || "Request failed");
      }
      setGameState({ loading: false, error: null, data: payload.item });
    } catch (err) {
      setGameState({ loading: false, error: (err as Error).message, data: null });
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Steam Live Game Stats</p>
          <h1>Track popular games and get metadata instantly.</h1>
          <p className="subhead">
            Search cached Steam game metadata and preview how the dashboard can surface icons, genres, and publishers without hammering the Steam API.
          </p>
          <div className="inline token-row">
            <input
              className="compact"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste JWT from auth service"
            />
            <span className="hint">Authorization header for gateway (required)</span>
          </div>
          <div className="search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, genre, publisher..."
              aria-label="Search games"
            />
            <span className="hint">Powered by metadata-service (cached)</span>
          </div>
        </div>
        <div className="hero-card">
          <div className="pill">API Gateway</div>
          <h3>Proxy</h3>
          <p>Requests flow through the gateway to metadata-service. Swap environments via `VITE_API_BASE`.</p>
          <code>{endpoint}</code>
        </div>
      </header>

      <section className="results">
        <div className="results-head">
          <h2>Results</h2>
          {loading ? <span className="status">Loading…</span> : <span className="status">Found {items.length}</span>}
          {error ? <span className="status error">{error}</span> : null}
        </div>
        <div className="grid">
          {items.map((game) => (
            <article key={game.appId} className="card">
              <img src={game.icon} alt={game.name} />
              <div className="card-body">
                <div className="card-header">
                  <h3>{game.name}</h3>
                  <span className="app-id">AppID {game.appId}</span>
                </div>
                <p className="meta">
                  {game.developer} • {game.publisher}
                </p>
                <div className="tags">
                  {game.genres.map((genre) => (
                    <span key={genre} className="tag">
                      {genre}
                    </span>
                  ))}
                  {(game.tags || []).map((tag) => (
                    <span key={tag} className="tag subtle">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
          {!loading && !items.length && !error ? <p className="empty">No games matched your search.</p> : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Player Stats (Steam API)</p>
            <h2>Query a player</h2>
          </div>
          <div className="inline">
            <input
              className="compact"
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              placeholder="SteamID64 (e.g. 76561197960434622)"
            />
            <button onClick={fetchPlayerStats} disabled={playerState.loading}>
              {playerState.loading ? "Loading..." : "Fetch"}
            </button>
          </div>
        </div>
        {playerState.error ? <div className="status error">{playerState.error}</div> : null}
        {playerState.data ? (
          <div className="panel-body">
            <div className="player">
              <div>
                <h3>{playerState.data.profile?.personaname}</h3>
                <p className="meta">SteamID: {playerState.data.profile?.steamid}</p>
                <p className="meta">
                  Owned {playerState.data.totals.ownedGames} games · Total playtime{" "}
                  {playerState.data.totals.totalPlaytimeHours} hrs
                </p>
              </div>
            </div>
            <div className="two-col">
              <div>
                <h4>Top games (by hours)</h4>
                <ul className="list">
                  {playerState.data.topGames.map((g) => (
                    <li key={g.appId}>
                      <span>{g.name}</span>
                      <span className="meta">{g.playtimeHours} hrs</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Recently played (2 wks)</h4>
                <ul className="list">
                  {playerState.data.recentGames.map((g) => (
                    <li key={g.appId}>
                      <span>{g.name}</span>
                      <span className="meta">{g.playtime2WeeksHours} hrs</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Live metadata lookup</p>
            <h2>Steam app summary</h2>
          </div>
          <div className="inline">
            <input
              className="compact"
              value={appIdQuery}
              onChange={(e) => setAppIdQuery(e.target.value)}
              placeholder="AppID (e.g. 570)"
            />
            <button onClick={fetchGameSummary} disabled={gameState.loading}>
              {gameState.loading ? "Loading..." : "Lookup"}
            </button>
          </div>
        </div>
        {gameState.error ? <div className="status error">{gameState.error}</div> : null}
        {gameState.data ? (
          <div className="panel-body">
            <div className="summary">
              <img src={gameState.data.headerImage} alt={gameState.data.name} />
              <div>
                <h3>{gameState.data.name}</h3>
                <p className="meta">
                  {gameState.data.developers.join(", ")} • {gameState.data.publishers.join(", ")}
                </p>
                <p className="meta">{gameState.data.shortDescription}</p>
                {typeof gameState.data.currentPlayers === "number" ? (
                  <p className="status">Current players: {gameState.data.currentPlayers.toLocaleString()}</p>
                ) : (
                  <p className="hint">Current player count unavailable.</p>
                )}
                <div className="tags">
                  {gameState.data.genres.map((g) => (
                    <span key={g} className="tag">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default App;
