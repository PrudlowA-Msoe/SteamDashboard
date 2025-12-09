import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GameMetadata } from "../types";

type CountState = { loading?: boolean; value?: number | null; error?: string };

interface Props {
  token: string;
  apiBase: string;
}

const DiscoverPage = ({ token, apiBase }: Props) => {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GameMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, CountState>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    const trimmed = query.trim();
    const url = new URL("/metadata/games", apiBase);
    if (trimmed.length) url.searchParams.append("q", trimmed);
    return url.toString();
  }, [query, apiBase]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(endpoint, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const payload = await res.json();
        setItems(payload.items || []);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError((err as Error).message);
        setItems([]);
        setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, token]);

  const fetchCount = async (appId: string) => {
    setCounts((prev) => ({ ...prev, [appId]: { loading: true } }));
    try {
      const res = await fetch(`${apiBase}/stats/games/${appId}/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to load count");
      setCounts((prev) => ({ ...prev, [appId]: { loading: false, value: json.item?.currentPlayers ?? null } }));
    } catch (err) {
      setCounts((prev) => ({ ...prev, [appId]: { loading: false, error: (err as Error).message } }));
    }
  };

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Discover</p>
          <h1>Browse cached Steam games</h1>
          <p className="subhead">Quickly browse popular titles from the cached metadata service and load live player counts.</p>
          <div className="search">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cached games..." aria-label="Search cached games" />
            <span className="hint">Powered by metadata-service (cached)</span>
          </div>
          <div className="quick-actions">
            <button className="ghost" onClick={() => setQuery("open world")}>
              Filter: Open World
            </button>
            <button className="ghost" onClick={() => setQuery("multiplayer")}>
              Filter: Multiplayer
            </button>
            <button className="ghost" onClick={() => setQuery("survival")}>
              Filter: Survival
            </button>
          </div>
        </div>
        <div className="hero-card">
          <div className="pill">Cached catalog</div>
          <h3>Low-latency search</h3>
          <p>Game metadata is cached to avoid hammering the Steam API and render instant lists.</p>
        </div>
      </header>

      <section className="results">
        <div className="results-head">
          <div>
            <h2>Cached Games</h2>
            <p className="meta">From metadata-service cache</p>
          </div>
          <div className="inline gap">
            {loading ? <span className="status">Loading…</span> : <span className="status">Found {items.length}</span>}
            {error ? <span className="status error">{error}</span> : null}
          </div>
        </div>
        <div className="grid">
          {items.map((game) => {
            const countState = counts[game.appId];
            return (
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
          <div className="count-row inline wrap">
            {countState?.loading ? (
              <span className="status">Loading count…</span>
            ) : typeof countState?.value === "number" ? (
              <span className="status">Current players: {countState.value.toLocaleString()}</span>
            ) : countState?.error ? (
              <span className="status error">Count failed</span>
            ) : (
              <button className="ghost" onClick={() => fetchCount(game.appId)}>
                Load player count
              </button>
            )}
            <Link className="ghost" to={`/games/${game.appId}`}>
              View details
            </Link>
            <button
              className="ghost"
              onClick={async () => {
                setStatusMsg(null);
                try {
                  const res = await fetch(`${apiBase}/metadata/games/cache`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ appId: game.appId }),
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json?.message || "Cache add failed");
                  setStatusMsg(`Cached ${json.item?.name || game.appId}`);
                } catch (err) {
                  setStatusMsg((err as Error).message);
                }
              }}
            >
              Add to cache
            </button>
          </div>
        </div>
      </article>
    );
  })}
          {!loading && !items.length && !error ? <p className="empty">No games matched your search.</p> : null}
          {statusMsg ? <p className="status">{statusMsg}</p> : null}
        </div>
      </section>
    </>
  );
};

export default DiscoverPage;
