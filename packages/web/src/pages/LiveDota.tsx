import { useEffect, useState } from "react";

interface LivePlayer {
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

interface LiveGame {
  matchId: number;
  spectators: number;
  averageMmr: number;
  radiant: { name: string; score: number; towers: number; barracks: number };
  dire: { name: string; score: number; towers: number; barracks: number };
  durationSeconds: number;
  roshanRespawnTimer: number;
  league: number;
  players: LivePlayer[];
}

interface Props {
  token: string;
  apiBase: string;
}

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const LiveDotaPage = ({ token, apiBase }: Props) => {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLive = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/stats/live/dota/featured`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Live fetch failed");
      setGames(json.items || []);
    } catch (err) {
      setError((err as Error).message);
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Dota Live</p>
          <h1>Featured live matches</h1>
          <p className="subhead">Polled from Steam’s Top Live Games. Auto-refreshes every 10s.</p>
          <div className="inline">
            <button onClick={fetchLive} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh now"}
            </button>
            {error ? <span className="status error">{error}</span> : null}
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="results-head">
          <div>
            <h2>Live Matches</h2>
            <p className="meta">Featured/league games</p>
          </div>
          <span className="status">{games.length} games</span>
        </div>
        <div className="grid">
          {games.map((g) => (
            <article key={g.matchId} className="card">
              <div className="card-body">
                <div className="card-header">
                  <h3>{g.radiant.name || "Radiant"} vs {g.dire.name || "Dire"}</h3>
                  <span className="app-id">Match {g.matchId}</span>
                </div>
                <p className="meta">
                  {g.radiant.score} - {g.dire.score} · {formatDuration(g.durationSeconds)} · Spectators {g.spectators}
                </p>
                <div className="two-col">
                  <div>
                    <h4>Radiant</h4>
                    <TeamList players={g.players.filter((p) => p.team === 0)} />
                    <p className="meta">Towers: {g.radiant.towers} · Barracks: {g.radiant.barracks}</p>
                  </div>
                  <div>
                    <h4>Dire</h4>
                    <TeamList players={g.players.filter((p) => p.team === 1)} />
                    <p className="meta">Towers: {g.dire.towers} · Barracks: {g.dire.barracks}</p>
                  </div>
                </div>
                <p className="meta">
                  Avg MMR: {g.averageMmr || "n/a"} · Roshan respawn: {g.roshanRespawnTimer ? `${g.roshanRespawnTimer}s` : "n/a"} · League:{" "}
                  {g.league || "n/a"}
                </p>
              </div>
            </article>
          ))}
          {!games.length && !loading && !error ? <p className="empty">No live featured games right now.</p> : null}
        </div>
      </section>
    </>
  );
};

const TeamList = ({ players }: { players: LivePlayer[] }) => (
  <ul className="list">
    {players.map((p) => (
      <li key={`${p.accountId}-${p.heroId}`}>
        <span>
          {p.name || "Player"} · Hero {p.heroId} (Lv {p.level})
        </span>
        <span className="meta">
          {p.kills}/{p.deaths}/{p.assists} · GPM {p.gpm} · XPM {p.xpm} · NW {p.netWorth}
        </span>
      </li>
    ))}
  </ul>
);

export default LiveDotaPage;
