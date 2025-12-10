import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SpotlightPayload, SpotlightAchievement, GameMetadata } from "../types";

interface Props {
  token: string;
  apiBase: string;
}

type OwnedGame = {
  appid: number;
  name: string;
  img_icon_url?: string;
  playtime_forever?: number;
  playtime_2weeks?: number;
  rtime_last_played?: number;
};

type SpotlightVM = SpotlightPayload & {
  playtimeForeverHours?: number;
  playtime2WeeksHours?: number;
  achievementsCompletionLabel: string;
  unlockedAchievements: SpotlightAchievement[];
  lockedAchievements: SpotlightAchievement[];
};

const normalize = (raw: SpotlightPayload): SpotlightVM => {
  const playtimeForeverHours = raw.playtimeForeverMinutes ? Math.round((raw.playtimeForeverMinutes / 60) * 10) / 10 : undefined;
  const playtime2WeeksHours = raw.playtime2WeeksMinutes ? Math.round((raw.playtime2WeeksMinutes / 60) * 10) / 10 : undefined;
  const unlockedAchievements = raw.achievements?.list?.filter((a) => a.achieved) || [];
  const lockedAchievements = raw.achievements?.list?.filter((a) => !a.achieved) || [];
  const completion = raw.achievements?.completionPct ?? 0;
  return {
    ...raw,
    playtimeForeverHours,
    playtime2WeeksHours,
    achievementsCompletionLabel: `${completion}% complete (${raw.achievements?.unlocked || 0}/${raw.achievements?.total || 0})`,
    unlockedAchievements,
    lockedAchievements,
  };
};

const useQueryParam = (key: string) => {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search).get(key), [location.search]);
};

const GameSpotlightPage = ({ token, apiBase }: Props) => {
  const navigate = useNavigate();
  const queryAppId = useQueryParam("appid");
  const [owned, setOwned] = useState<OwnedGame[]>([]);
  const [recent, setRecent] = useState<OwnedGame[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(queryAppId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightVM | null>(null);
  const [achFilter, setAchFilter] = useState<"all" | "unlocked" | "locked">("all");

  useEffect(() => {
    const loadOwned = async () => {
      try {
        const res = await fetch(new URL("/stats/spotlight/owned", apiBase).toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed to load library");
        setOwned(json.owned || []);
        setRecent(json.recent || []);
        if (!selectedAppId && (json.recent?.[0]?.appid || json.owned?.[0]?.appid)) {
          const appId = String(json.recent?.[0]?.appid || json.owned?.[0]?.appid);
          setSelectedAppId(appId);
          navigate(`?appid=${appId}`, { replace: true });
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load library");
      }
    };
    loadOwned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token]);

  useEffect(() => {
    if (!selectedAppId) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(new URL(`/stats/spotlight/${selectedAppId}`, apiBase).toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed to load spotlight");
        setSpotlight(normalize(json));
      } catch (e: any) {
        setError(e?.message || "Failed to load spotlight");
        setSpotlight(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedAppId, apiBase, token]);

  const onSelectApp = (appId: string) => {
    setSelectedAppId(appId);
    navigate(`?appid=${appId}`);
  };

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Game Spotlight</p>
          <h1>Deep dive into your games</h1>
          <p className="subhead">Pick a game from your library to see achievements, live players, and news at a glance.</p>
          {error ? <span className="status error">{error}</span> : null}
        </div>
      </header>

      <GamePicker owned={owned} recent={recent} selectedAppId={selectedAppId} onSelect={onSelectApp} />

      <section className="panel">
        {loading || !spotlight ? (
          <div className="skeleton" style={{ height: 140 }}>
            <div className="placeholder" style={{ height: 140 }} />
          </div>
        ) : (
          <SpotlightHeader spot={spotlight} />
        )}
      </section>

      <section className="panel">
        <div className="two-col">
          <AchievementsPanel spot={spotlight} filter={achFilter} onFilter={setAchFilter} loading={loading} />
          <PlayersNowPanel spot={spotlight} loading={loading} />
        </div>
      </section>

      <section className="panel">
        <NewsPanel spot={spotlight} loading={loading} />
      </section>
    </div>
  );
};

const GamePicker = ({
  owned,
  recent,
  selectedAppId,
  onSelect,
}: {
  owned: OwnedGame[];
  recent: OwnedGame[];
  selectedAppId: string | null;
  onSelect: (id: string) => void;
}) => {
  const [query, setQuery] = useState("");
  const library = useMemo(() => {
    const merged = [...new Map([...recent, ...owned].map((g) => [g.appid, g])).values()];
    if (!query.trim()) return merged.slice(0, 30);
    return merged.filter((g) => g.name.toLowerCase().includes(query.toLowerCase())).slice(0, 30);
  }, [owned, recent, query]);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Select a game</p>
          <h3>Recent first, then most played</h3>
        </div>
        <input
          className="compact"
          placeholder="Search your library"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search your games"
        />
      </div>
      <div className="grid">
        {library.map((g) => {
          const icon = g.img_icon_url
            ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`
            : undefined;
          return (
            <button
              key={g.appid}
              className={`card ${String(g.appid) === selectedAppId ? "active" : ""}`}
              onClick={() => onSelect(String(g.appid))}
              aria-pressed={String(g.appid) === selectedAppId}
            >
              {icon ? (
                <img
                  src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`}
                  alt={g.name}
                  style={{ objectFit: "cover", height: 180 }}
                />
              ) : (
                <div className="placeholder" style={{ height: 120 }} />
              )}
              <div className="card-body">
                <div className="card-header">
                  <h3>{g.name}</h3>
                  <span className="app-id">App {g.appid}</span>
                </div>
                <p className="meta">
                  {g.playtime_forever ? `${Math.round((g.playtime_forever / 60) * 10) / 10}h total` : "No playtime recorded"}
                </p>
              </div>
            </button>
          );
        })}
        {!library.length ? <div className="empty">No games found.</div> : null}
      </div>
    </div>
  );
};

const SpotlightHeader = ({ spot }: { spot: SpotlightVM }) => (
  <div className="hero-card">
    <div className="inline gap">
      {spot.iconUrl ? (
        <img
          src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${spot.appId}/header.jpg`}
          alt={spot.gameName}
          style={{ width: 260, height: 120, borderRadius: 12, objectFit: "cover" }}
        />
      ) : null}
      <div>
        <h2>{spot.gameName}</h2>
        <p className="subhead">
          {spot.playtimeForeverHours ? `${spot.playtimeForeverHours}h total` : "No playtime"} •{" "}
          {spot.playtime2WeeksHours ? `${spot.playtime2WeeksHours}h last 2 weeks` : "No recent playtime"}
        </p>
      </div>
    </div>
    <div className="pill-row">
      {spot.lastPlayedTimestamp ? <span className="chip">Last played {new Date(spot.lastPlayedTimestamp * 1000).toLocaleDateString()}</span> : null}
      <span className="chip">{spot.achievementsCompletionLabel}</span>
      {spot.currentPlayers != null ? <span className="chip">Players now: {spot.currentPlayers}</span> : <span className="chip">Players now: n/a</span>}
    </div>
  </div>
);

const AchievementsPanel = ({
  spot,
  filter,
  onFilter,
  loading,
}: {
  spot: SpotlightVM | null;
  filter: "all" | "unlocked" | "locked";
  onFilter: (f: "all" | "unlocked" | "locked") => void;
  loading: boolean;
}) => {
  const list = spot?.achievements?.list || [];
  const filtered =
    filter === "unlocked" ? list.filter((a) => a.achieved) : filter === "locked" ? list.filter((a) => !a.achieved) : list;
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Your Achievements</p>
          <h3>{spot?.achievementsCompletionLabel || "Achievements"}</h3>
        </div>
        <div className="inline gap">
          <button className="ghost" onClick={() => onFilter("all")} aria-pressed={filter === "all"}>
            All
          </button>
          <button className="ghost" onClick={() => onFilter("unlocked")} aria-pressed={filter === "unlocked"}>
            Unlocked
          </button>
          <button className="ghost" onClick={() => onFilter("locked")} aria-pressed={filter === "locked"}>
            Locked
          </button>
        </div>
      </div>
      {loading ? (
        <div className="placeholder" style={{ height: 120 }} />
      ) : filtered.length ? (
        <div className="grid">
          {filtered.map((a) => (
            <div className="card" key={a.apiName}>
              <div className="card-body">
                <div className="card-header">
                  <h3>{a.displayName}</h3>
                  <span className="status">{a.achieved ? "Unlocked" : "Locked"}</span>
                </div>
                <p className="meta">{a.description || "No description"}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">No achievements available for this title.</div>
      )}
    </div>
  );
};

const PlayersNowPanel = ({ spot, loading }: { spot: SpotlightVM | null; loading: boolean }) => {
  const trend = spot?.trend || [];
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Players right now</p>
          <h3>{spot?.currentPlayers != null ? `${spot.currentPlayers} online` : "Not available"}</h3>
          <p className="subhead">Trend based on stored samples (last 30 days).</p>
        </div>
      </div>
      {loading ? (
        <div className="placeholder" style={{ height: 120 }} />
      ) : trend.length ? (
        <PlayerCountMiniChart points={trend} />
      ) : (
        <div className="empty">Player count trend will appear after a few visits.</div>
      )}
    </div>
  );
};

const PlayerCountMiniChart = ({ points }: { points: { timestamp: number; playerCount: number | null }[] }) => {
  const valid = points.filter((p) => p.playerCount != null) as { timestamp: number; playerCount: number }[];
  if (!valid.length) return <div className="empty">No data</div>;
  const min = Math.min(...valid.map((p) => p.playerCount));
  const max = Math.max(...valid.map((p) => p.playerCount));
  const span = max - min || 1;
  const width = 260;
  const height = 80;
  const xScale = (i: number) => (i / Math.max(valid.length - 1, 1)) * width;
  const yScale = (v: number) => height - ((v - min) / span) * height;
  const path = valid
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(2)} ${yScale(p.playerCount).toFixed(2)}`)
    .join(" ");
  return (
    <svg width={width} height={height} role="img" aria-label="Player count trend">
      <path d={path} fill="none" stroke="#5eead4" strokeWidth={2} />
    </svg>
  );
};

const NewsPanel = ({ spot, loading }: { spot: SpotlightVM | null; loading: boolean }) => {
  const news = spot?.news || [];
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Latest News</p>
          <h3>{spot?.gameName || "News"}</h3>
        </div>
      </div>
      {loading ? (
        <div className="placeholder" style={{ height: 120 }} />
      ) : news.length ? (
        <div className="grid news-cards">
          {news.map((n) => (
            <article key={n.gid} className="card">
              <div className="card-body">
                <h3>{n.title}</h3>
                <p className="meta">{n.author ? `by ${n.author}` : null}</p>
                <p className="meta">{n.date ? new Date(n.date * 1000).toLocaleDateString() : ""}</p>
                <p className="news-card truncate">{n.contents}</p>
                <a className="ghost" href={n.url} target="_blank" rel="noreferrer">
                  Read more
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">No news posts.</div>
      )}
    </div>
  );
};

export default GameSpotlightPage;
