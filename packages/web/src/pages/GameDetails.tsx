import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { GameSummary, NewsItem } from "../types";

interface Props {
  token: string;
  apiBase: string;
}

const GameDetailsPage = ({ token, apiBase }: Props) => {
  const { appId } = useParams();
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appId) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBase}/stats/games/${appId}/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Summary fetch failed");
        setSummary(json.item);
        await fetchNews(appId);
        await fetch(`${apiBase}/metadata/games/cache`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ appId }),
        }).catch(() => undefined);
      } catch (err) {
        setError((err as Error).message);
        setSummary(null);
        setNews([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [appId, apiBase, token]);

  const fetchNews = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/stats/games/${id}/news`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "News fetch failed");
      setNews(json.items || []);
    } catch (err) {
      setNews([]);
    }
  };

  if (!appId) return <div className="status error">Missing appId</div>;

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Game Details</p>
          <h1>{summary?.name || `AppID ${appId}`}</h1>
          {summary ? (
            <>
              <p className="meta">
                {summary.developers.join(", ")} • {summary.publishers.join(", ")}
              </p>
              {typeof summary.currentPlayers === "number" ? (
                <p className="status">Current players: {summary.currentPlayers.toLocaleString()}</p>
              ) : (
                <p className="hint">Current player count unavailable.</p>
              )}
              <div className="tags">
                {summary.genres.map((g) => (
                  <span key={g} className="tag">
                    {g}
                  </span>
                ))}
              </div>
            </>
          ) : null}
          {error ? <div className="status error">{error}</div> : null}
        </div>
        {summary ? (
          <div className="hero-card">
            <div className="pill">Summary</div>
            <p className="meta">{summary.shortDescription}</p>
          </div>
        ) : null}
      </header>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">News</p>
            <h2>Latest updates</h2>
          </div>
        </div>
        <div className="panel-body news-grid">
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
    </>
  );
};

export default GameDetailsPage;
