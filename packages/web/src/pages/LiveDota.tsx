import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

export interface LivePlayer {
  accountId: number;
  heroId: number;
  kills: number;
  deaths: number;
  assists: number;
  gpm: number;
  xpm: number;
  netWorth: number;
  level: number;
  team: number;
  name?: string;
}

export interface LiveTeam {
  name: string;
  score: number;
  towers: number;
  barracks: number;
  logo?: string;
  id?: number;
}

export interface LiveGame {
  matchId: number;
  spectators: number;
  averageMmr: number;
  radiant: LiveTeam;
  dire: LiveTeam;
  durationSeconds: number;
  roshanRespawnTimer: number;
  league: number;
  leagueName?: string;
  seriesType?: string;
  gameNumber?: number;
  players: LivePlayer[];
  startTime?: number;
  state?: string;
}

type LiveMatchVM = {
  id: number;
  radiant: LiveTeam;
  dire: LiveTeam;
  spectators: number;
  averageMmr: number;
  duration: string;
  leagueName: string;
  badgeText: string;
  featuredSubtitle: string;
  scoreLine: string;
  stateSummary: string;
  listSortKey: number;
  startTimeLabel?: string;
  players: LivePlayer[];
  roshan: string;
};

interface Props {
  token: string;
  apiBase: string;
}

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export const normalizeLiveGames = (items: LiveGame[]): LiveMatchVM[] =>
  (items || []).map((g) => {
    const duration = formatDuration(g.durationSeconds || 0);
    const leagueName = g.leagueName || (g.league ? `League ${g.league}` : "Unspecified league");
    const badgeText = g.seriesType ? `${g.seriesType}${g.gameNumber ? ` • Game ${g.gameNumber}` : ""}` : "Live";
    const stateSummary =
      g.state ||
      `Roshan ${g.roshanRespawnTimer ? `in ${g.roshanRespawnTimer}s` : "unknown"} • Towers R${g.radiant.towers}/D${g.dire.towers} • Barracks R${g.radiant.barracks}/D${g.dire.barracks}`;
    const scoreLine = `${g.radiant.score} - ${g.dire.score}`;
    const startTimeLabel = g.startTime ? new Date(g.startTime * 1000).toLocaleTimeString() : undefined;
    const listSortKey = (g.spectators || 0) * 100000 + (g.averageMmr || 0);
    const roshan = g.roshanRespawnTimer ? `${g.roshanRespawnTimer}s` : "N/A";
    return {
      id: g.matchId,
      radiant: g.radiant,
      dire: g.dire,
      spectators: g.spectators,
      averageMmr: g.averageMmr,
      duration,
      leagueName,
      badgeText,
      featuredSubtitle: `${leagueName} • ${duration}`,
      scoreLine,
      stateSummary,
      listSortKey,
      startTimeLabel,
      players: g.players || [],
      roshan,
    };
  });

const LiveDotaPage = ({ token, apiBase }: Props) => {
  const [games, setGames] = useState<LiveMatchVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const fetchLive = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/stats/live/dota/featured`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Live fetch failed");
      const normalized = normalizeLiveGames(json.items || []);
      const sorted = [...normalized].sort((a, b) => b.listSortKey - a.listSortKey);
      setGames(sorted);
      setSelectedId((prev) => (prev && sorted.some((g) => g.id === prev) ? prev : sorted[0]?.id ?? null));
    } catch (err) {
      setError((err as Error).message);
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const featured = useMemo(() => games.find((g) => g.id === selectedId) || games[0], [games, selectedId]);

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Dota Live</p>
          <h1>Featured live matches</h1>
          <p className="subhead">Polled from Steam’s Top Live Games. Auto-refreshes every 15s.</p>
          <div className="inline">
            <button onClick={fetchLive} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh now"}
            </button>
            {error ? <span className="status error">{error}</span> : null}
            {!loading && !error ? <span className="status">{games.length} matches</span> : null}
          </div>
        </div>
      </header>

      <section className="panel">
        {loading ? (
          <FeaturedSkeleton />
        ) : featured ? (
          <FeaturedLiveMatch match={featured} />
        ) : (
          <div className="empty">No live featured games right now.</div>
        )}
      </section>

      <section className="panel">
        <div className="results-head">
          <div>
            <h2>All live matches</h2>
            <p className="meta">Tap/click to feature</p>
          </div>
        </div>
        {loading ? (
          <ListSkeleton />
        ) : games.length ? (
          <LiveMatchList matches={games} selectedId={featured?.id} onSelect={setSelectedId} />
        ) : (
          <div className="empty">No live matches to show.</div>
        )}
      </section>
    </>
  );
};

const FeaturedLiveMatch = ({ match }: { match: LiveMatchVM }) => (
  <div className="featured-card" aria-live="polite">
    <div className="featured-top">
      <div className="badge-row">
        <span className="pill">{match.badgeText}</span>
        <span className="status">{match.featuredSubtitle}</span>
      </div>
      <div className="scoreline">
        <TeamBlock team={match.radiant} side="Radiant" />
        <div className="score">
          <div className="score-value">{match.scoreLine}</div>
          <div className="meta">{match.leagueName}</div>
          <div className="meta">
            {match.startTimeLabel ? `Started ${match.startTimeLabel}` : "Live"} • {match.spectators || 0} spectators
          </div>
        </div>
        <TeamBlock team={match.dire} side="Dire" />
      </div>
    </div>
    <div className="featured-meta">
      <div>
        <p className="eyebrow">State of game</p>
        <p className="subhead">{match.stateSummary}</p>
      </div>
      <div className="pill-row">
        <span className="chip">Avg MMR: {match.averageMmr || "n/a"}</span>
        <span className="chip">Roshan: {match.roshan}</span>
        <span className="chip">Duration: {match.duration}</span>
      </div>
    </div>
    <div className="teams-grid">
      <MiniRoster title="Radiant" players={match.players.filter((p) => p.team === 0)} />
      <MiniRoster title="Dire" players={match.players.filter((p) => p.team === 1)} />
    </div>
  </div>
);

const LiveMatchList = ({
  matches,
  selectedId,
  onSelect,
}: {
  matches: LiveMatchVM[];
  selectedId: number | undefined;
  onSelect: (id: number) => void;
}) => (
  <div className="live-list" role="list">
    {matches.map((m) => (
      <LiveMatchListItem key={m.id} match={m} active={m.id === selectedId} onSelect={onSelect} />
    ))}
  </div>
);

const LiveMatchListItem = ({ match, active, onSelect }: { match: LiveMatchVM; active: boolean; onSelect: (id: number) => void }) => (
  <button
    className={`live-list-item ${active ? "active" : ""}`}
    onClick={() => onSelect(match.id)}
    aria-pressed={active}
    aria-label={`Feature match ${match.radiant.name} vs ${match.dire.name}`}
  >
    <div className="list-header">
      <span className="meta">{match.leagueName}</span>
      <span className="status">{match.badgeText}</span>
    </div>
    <div className="list-body">
      <div className="list-team">
        <strong>{match.radiant.name || "Radiant"}</strong>
        <span className="status">{match.radiant.score}</span>
      </div>
      <div className="list-team">
        <strong>{match.dire.name || "Dire"}</strong>
        <span className="status">{match.dire.score}</span>
      </div>
      <div className="list-meta">
        <span>{match.duration}</span>
        <span>Specs: {match.spectators || 0}</span>
      </div>
    </div>
  </button>
);

const TeamBlock = ({ team, side }: { team: LiveTeam; side: string }) => (
  <div className="team-block">
    <div className="team-name">
      <span className="eyebrow">{side}</span>
      <strong>{team.name || side}</strong>
    </div>
    <div className="tag subtle">Towers {team.towers} • Barracks {team.barracks}</div>
  </div>
);

const MiniRoster = ({ title, players }: { title: string; players: LivePlayer[] }) => (
  <div className="mini-roster">
    <div className="inline gap">
      <p className="eyebrow">{title}</p>
      <span className="status">{players.length} players</span>
    </div>
    <ul className="list">
      {players.map((p) => (
        <li key={`${p.accountId}-${p.heroId}`}>
          <span>
            {p.name || "Player"} • Hero {p.heroId} (Lv {p.level})
          </span>
          <span className="meta">
            {p.kills}/{p.deaths}/{p.assists} • GPM {p.gpm} • XPM {p.xpm} • NW {p.netWorth}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

const FeaturedSkeleton = () => (
  <div className="featured-card skeleton">
    <div className="placeholder" style={{ height: 32, marginBottom: 12 }} />
    <div className="placeholder" style={{ height: 140, marginBottom: 16 }} />
    <div className="placeholder" style={{ height: 80 }} />
  </div>
);

const ListSkeleton = () => (
  <div className="live-list">
    {Array.from({ length: 5 }).map((_, i) => (
      <div className="live-list-item skeleton" key={i}>
        <div className="placeholder" style={{ height: 16, marginBottom: 10 }} />
        <div className="placeholder" style={{ height: 32 }} />
      </div>
    ))}
  </div>
);

export default LiveDotaPage;
