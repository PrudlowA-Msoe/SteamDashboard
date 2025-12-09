import { useEffect, useState } from "react";
import { GameSummary, NewsItem, GameMetadata } from "../types";

interface Props {
  token: string;
  apiBase: string;
}

const NewsPage = ({ token, apiBase }: Props) => {
  const [appId, setAppId] = useState("");
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedGames, setCachedGames] = useState<GameMetadata[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);

  useEffect(() => {
    const loadCached = async () => {
      setGamesLoading(true);
      try {
        const res = await fetch(`${apiBase}/metadata/games`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        setCachedGames(json.items || []);
      } catch {
        setCachedGames([]);
      } finally {
        setGamesLoading(false);
      }
    };
    loadCached();
  }, [apiBase, token]);

  const fetchSummaryAndNews = async (id?: string) => {
    const targetId = (id || appId).trim();
    if (!targetId) {
      setError("Enter an AppID");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/stats/games/${targetId}/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Summary fetch failed");
      setSummary(json.item);
      setAppId(targetId);
      await fetchNews(targetId);
    } catch (err) {
      setError((err as Error).message);
      setSummary(null);
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchNews = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/stats/games/${id}/news`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "News fetch failed");
      setNews(json.items || []);
    } catch (err) {
      setError((err as Error).message);
      setNews([]);
    }
  };

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">News</p>
          <h1>Game summaries and recent news</h1>
          <p className="subhead">Click any cached game to load its news and player counts, or enter an AppID.</p>
          <div className="inline">
            <input className="compact" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="AppID (e.g. 570)" />
            <button onClick={() => fetchSummaryAndNews()} disabled={loading}>
              {loading ? "Loading..." : "Load"}
            </button>
          </div>
          {error ? <div className="status error">{error}</div> : null}
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Cached Games</p>
            <h2>Pick a game to view news</h2>
          </div>
        </div>
        {gamesLoading ? <div className="status">Loading games…</div> : null}
        <div className="grid">
          {cachedGames.map((g) => (
            <article key={g.appId} className="card">
              <img src={g.icon} alt={g.name} />
              <div className="card-body">
                <div className="card-header">
                  <h3>{g.name}</h3>
                  <span className="app-id">AppID {g.appId}</span>
                </div>
                <button className="ghost" onClick={() => fetchSummaryAndNews(g.appId)}>
                  View news
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {summary ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">App summary</p>
              <h2>{summary.name}</h2>
              <p className="meta">
                {summary.developers.join(", ")} • {summary.publishers.join(", ")}
              </p>
              {typeof summary.currentPlayers === "number" ? (
                <p className="status">Current players: {summary.currentPlayers.toLocaleString()}</p>
              ) : (
                <p className="hint">Current player count unavailable.</p>
              )}
            </div>
            <div className="tags">
              {summary.genres.map((g) => (
                <span key={g} className="tag">
                  {g}
                </span>
              ))}
            </div>
          </div>
          <div className="panel-body news-grid">
            <h4>Recent news</h4>
            {!news.length ? <p className="meta">No news yet for this app.</p> : null}
            <div className="grid news-cards">
              {news.map((item) => (
                <article key={item.gid} className="card news-card">
                  <div className="card-body">
                    <div className="card-header">
                      <h3>{item.title}</h3>
                    </div>
                    <p className="meta">
                      {item.author ? `By ${item.author}` : "Steam News"} · {item.date ? new Date(item.date * 1000).toLocaleDateString() : ""}
                    </p>
                    <p className="meta truncate">{item.contents?.slice(0, 140) || ""}</p>
                    <a className="ghost small" href={item.url} target="_blank" rel="noreferrer">
                      Read more
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
};

export default NewsPage;
