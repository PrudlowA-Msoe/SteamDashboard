import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GameMetadata } from "../types";

interface Props {
  token: string;
  apiBase: string;
}

const FeaturedPage = ({ token, apiBase }: Props) => {
  const [freeGames, setFreeGames] = useState<GameMetadata[]>([]);
  const [discounts, setDiscounts] = useState<GameMetadata[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [freeRes, discountRes] = await Promise.all([
        fetch(new URL("/metadata/featured/free?limit=24", apiBase).toString(), { headers }),
        fetch(new URL("/metadata/featured/discounts?limit=24", apiBase).toString(), { headers }),
      ]);
      if (!freeRes.ok) throw new Error(`free failed ${freeRes.status}`);
      if (!discountRes.ok) throw new Error(`discounts failed ${discountRes.status}`);
      const freeJson = await freeRes.json();
      const discountJson = await discountRes.json();
      setFreeGames(freeJson.items || []);
      setDiscounts(discountJson.items || []);
      setStatus(`Cached ${Number(freeJson.cached || 0) + Number(discountJson.cached || 0)} new titles.`);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e: any) {
      setStatus(e?.message || "Failed to load featured games");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(() => load(), 60000); // refresh every minute
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token]);

  const renderGrid = (items: GameMetadata[]) => (
    <div className="grid">
      {items.map((g) => (
        <div className="card" key={g.appId}>
          {g.icon && <img src={g.icon} alt={g.name} />}
          <div className="card-body">
            <div className="card-header">
              <h3>{g.name}</h3>
              <span className="app-id">App {g.appId}</span>
            </div>
            <p className="meta">{g.genres?.slice(0, 3).join(", ") || "Steam"}</p>
            <div className="tags">
              {(g.tags || []).slice(0, 3).map((t) => (
                <span className="tag subtle" key={t}>
                  {t}
                </span>
              ))}
            </div>
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
  );

  return (
    <div className="page">
      <div className="hero">
        <div className="hero-card">
          <span className="pill">Featured free & discounted</span>
          <h1>Discover free-to-play and discounted Steam games.</h1>
          <p className="subhead">
            We pull Steam store featured categories and automatically cache the picks, so you can open details, check news, and
            get live player counts without typing app IDs.
          </p>
          <div className="hero-cta">
            <button onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh picks"}
            </button>
            <Link to="/discover">
              <button className="ghost badge-ghost">Open Discover</button>
            </Link>
          </div>
          {status && <div className="callout">{status}</div>}
          {lastUpdated && <div className="hint">Last updated: {lastUpdated}</div>}
        </div>
        <div className="hero-card">
          <span className="eyebrow">Tip</span>
          <h2>One-click cache</h2>
          <p className="subhead">
            When you load this page, the featured results are cached automatically so you can search them instantly across the app.
          </p>
          <div className="stat-badge">
            <strong>{freeGames.length + discounts.length}</strong>
            <span>Featured items loaded</span>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Free to play</p>
            <h2>Top free featured</h2>
          </div>
        </div>
        {freeGames.length === 0 && !loading && <div className="empty">No free picks loaded.</div>}
        {renderGrid(freeGames)}
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Discounted</p>
            <h2>Featured specials</h2>
          </div>
        </div>
        {discounts.length === 0 && !loading && <div className="empty">No discounted picks loaded.</div>}
        {renderGrid(discounts)}
      </div>
    </div>
  );
};

export default FeaturedPage;
