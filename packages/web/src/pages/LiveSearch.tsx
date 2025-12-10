import { useState } from "react";
import { Link } from "react-router-dom";
import { GameMetadata } from "../types";

interface Props {
  token: string;
  apiBase: string;
}

const LiveSearchPage = ({ token, apiBase }: Props) => {
  const [liveQuery, setLiveQuery] = useState("");
  const [results, setResults] = useState<GameMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, { loading?: boolean; value?: number | null; error?: string }>>({});
  const [cacheStatus, setCacheStatus] = useState<Record<string, string>>({});

  const search = async () => {
    const q = liveQuery.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/metadata/search/live?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Live search failed");
      setResults(json.items || []);
    } catch (err) {
      setError((err as Error).message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

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

  const addToCache = async (appId: string) => {
    setCacheStatus((prev) => ({ ...prev, [appId]: "Caching…" }));
    try {
      const res = await fetch(`${apiBase}/metadata/games/cache`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ appId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `Failed (${res.status})`);
      setCacheStatus((prev) => ({ ...prev, [appId]: json?.cached ? "Already cached" : "Cached" }));
    } catch (e: any) {
      setCacheStatus((prev) => ({ ...prev, [appId]: e?.message || "Cache failed" }));
    }
  };

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Live Search</p>
          <h1>Search the entire Steam catalog</h1>
          <p className="subhead">Powered by the Steam store search API. Jump into any app and load player counts.</p>
          <div className="inline">
            <input
              className="compact"
              value={liveQuery}
              onChange={(e) => setLiveQuery(e.target.value)}
              placeholder="Search all Steam games"
            />
            <button onClick={search} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
          {error ? <div className="status error">{error}</div> : null}
        </div>
      </header>

      <section className="results">
        <div className="results-head">
          <div>
            <h2>Results</h2>
            <p className="meta">Steam-wide search</p>
          </div>
          {loading ? <span className="status">Loading…</span> : null}
        </div>
        <div className="grid">
          {results.map((game) => {
            const state = counts[game.appId];
            return (
              <article key={game.appId} className="card">
                {game.icon ? <img src={game.icon} alt={game.name} /> : <div className="placeholder" />}
                <div className="card-body">
                  <div className="card-header">
                    <h3>{game.name}</h3>
                    <span className="app-id">AppID {game.appId}</span>
                  </div>
                  <div className="inline wrap">
                    <Link className="ghost" to={`/games/${game.appId}`}>
                      View details
                    </Link>
                    {state?.loading ? (
                      <span className="status">Loading count…</span>
                    ) : typeof state?.value === "number" ? (
                      <span className="status">Players: {state.value.toLocaleString()}</span>
                    ) : state?.error ? (
                      <span className="status error">Count failed</span>
                    ) : (
                      <button className="ghost" onClick={() => fetchCount(game.appId)}>
                        Load player count
                      </button>
                    )}
                    <button className="ghost" onClick={() => addToCache(game.appId)}>
                      Add to cache
                    </button>
                    {cacheStatus[game.appId] ? <span className="status">{cacheStatus[game.appId]}</span> : null}
                  </div>
                </div>
              </article>
            );
          })}
          {!loading && !results.length && !error ? <p className="empty">Search for any Steam game to see results.</p> : null}
        </div>
      </section>
    </>
  );
};

export default LiveSearchPage;
