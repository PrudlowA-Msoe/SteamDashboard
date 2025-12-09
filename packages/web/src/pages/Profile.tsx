import { useEffect, useState } from "react";
import { Friend, InventoryItem, PlayerStats } from "../types";

interface Props {
  token: string;
  apiBase: string;
  steamId?: string;
  personaName?: string;
}

const ProfilePage = ({ token, apiBase, steamId: steamIdProp, personaName }: Props) => {
  const [steamId] = useState(steamIdProp || "");
  const [playerState, setPlayerState] = useState<{ loading: boolean; error: string | null; data: PlayerStats | null }>({
    loading: false,
    error: null,
    data: null,
  });
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);
  const [appIdInv, setAppIdInv] = useState("730");

  const fetchPlayerStats = async () => {
    const id = steamId.trim();
    if (!id) {
      setPlayerState((prev) => ({ ...prev, error: "Enter a SteamID64 to query stats." }));
      return;
    }
    setPlayerState({ loading: true, error: null, data: null });
    try {
      const res = await fetch(`${apiBase}/stats/players/${id}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message || "Request failed");
      setPlayerState({ loading: false, error: null, data: payload.item });
    } catch (err) {
      setPlayerState({ loading: false, error: (err as Error).message, data: null });
    }
  };

  const fetchFriends = async () => {
    const id = steamId.trim();
    if (!id) {
      setFriendsError("Enter a SteamID64 to load friends.");
      return;
    }
    setFriendsLoading(true);
    setFriendsError(null);
    try {
      const res = await fetch(`${apiBase}/stats/players/${id}/friends`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Friends fetch failed");
      setFriends(json.items || []);
    } catch (err) {
      setFriendsError((err as Error).message);
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  };

  const fetchInventory = async () => {
    const id = steamId.trim();
    if (!id) {
      setInvError("Enter a SteamID64 to load inventory.");
      return;
    }
    setInvLoading(true);
    setInvError(null);
    try {
      const res = await fetch(`${apiBase}/stats/players/${id}/inventory?appId=${appIdInv}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Inventory fetch failed");
      setInventory(json.items || []);
    } catch (err) {
      setInvError((err as Error).message);
      setInventory([]);
    } finally {
      setInvLoading(false);
    }
  };

  useEffect(() => {
    if (steamId) {
      fetchPlayerStats();
      fetchFriends();
      fetchInventory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steamId]);

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>{personaName ? `${personaName}'s profile` : "Steam profile view"}</h1>
          <p className="subhead">View player stats, friends, and inventory from the Steam Web APIs.</p>
          <div className="inline">
            <button onClick={fetchPlayerStats} disabled={playerState.loading}>
              {playerState.loading ? "Loading..." : "Refresh stats"}
            </button>
            <button className="ghost" onClick={fetchFriends} disabled={friendsLoading}>
              {friendsLoading ? "Loading friends..." : "Refresh friends"}
            </button>
          </div>
          {playerState.error ? <div className="status error">{playerState.error}</div> : null}
        </div>
      </header>

      {playerState.data ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Player profile</p>
              <h2>{playerState.data.profile?.personaname}</h2>
              <p className="meta">
                SteamID: {playerState.data.profile?.steamid} · Owned {playerState.data.totals.ownedGames} games · Total playtime{" "}
                {playerState.data.totals.totalPlaytimeHours} hrs
              </p>
            </div>
          </div>
          <div className="panel-body two-col">
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
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Friends</p>
            <h2>Live friend statuses</h2>
          </div>
        </div>
        {friendsError ? <div className="status error">{friendsError}</div> : null}
        {!friendsLoading && !friends.length ? <p className="meta">No friends loaded yet.</p> : null}
        <div className="list friends">
          {friends.map((f) => (
            <div key={f.steamId} className="friend-row">
              <div className="friend-info">
                {f.avatar ? <img src={f.avatar} alt={f.personaName} /> : <div className="avatar-placeholder" />}
                <div>
                  <div className="friend-name">{f.personaName}</div>
                  <div className="meta">
                    {f.status}
                    {f.game ? ` · In-game: ${f.game}` : ""}
                  </div>
                </div>
              </div>
              <a className="ghost small" href={f.profileUrl} target="_blank" rel="noreferrer">
                View profile
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Inventory</p>
            <h2>View inventory</h2>
            <p className="meta">Set an AppID (default 730) and load the player inventory.</p>
          </div>
          <div className="inline">
            <input className="compact" value={appIdInv} onChange={(e) => setAppIdInv(e.target.value)} placeholder="AppID (e.g. 730)" />
            <button className="ghost" onClick={fetchInventory} disabled={invLoading}>
              {invLoading ? "Loading..." : "Load inventory"}
            </button>
          </div>
        </div>
        {invError ? <div className="status error">{invError}</div> : null}
        <div className="grid">
          {inventory.map((item) => (
            <article key={item.assetId} className="card">
              {item.icon ? <img src={item.icon} alt={item.name} /> : <div className="placeholder" />}
              <div className="card-body">
                <div className="card-header">
                  <h3>{item.name}</h3>
                </div>
                <p className="meta">{item.type}</p>
                <p className="meta">{item.tradable ? "Tradable" : "Not tradable"}</p>
              </div>
            </article>
          ))}
          {!invLoading && !inventory.length ? <p className="meta">No items loaded yet.</p> : null}
        </div>
      </section>
    </>
  );
};

export default ProfilePage;
