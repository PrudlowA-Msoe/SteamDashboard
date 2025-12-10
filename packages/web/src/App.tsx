import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NavBar from "./components/NavBar";
import DiscoverPage from "./pages/Discover";
import LiveSearchPage from "./pages/LiveSearch";
import ProfilePage from "./pages/Profile";
import NewsPage from "./pages/News";
import GameDetailsPage from "./pages/GameDetails";
import LiveDotaPage from "./pages/LiveDota";
import { decodeToken } from "./utils/token";

const runtimeOrigin = typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
const API_BASE = (import.meta.env.VITE_API_BASE as string) || runtimeOrigin || "http://localhost:4000";
const DEFAULT_TOKEN = (import.meta.env.VITE_AUTH_TOKEN as string) || "";
const DEMO_ADMIN_USER = "admin";
const DEMO_ADMIN_PASS = "admin123";
const DEMO_TOKEN =
  DEFAULT_TOKEN ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ3bVhoc2hOSlNJZklqRGpzVTJoTzUiLCJzdGVhbUlkIjoiNzY1NjExOTgxNjg2NDI1MjkiLCJwZXJzb25hTmFtZSI6IllvdSIsInJvbGVzIjpbInVzZXIiLCJhZG1pbiJdLCJpYXQiOjE3NjUzMDU0NTgsImV4cCI6MTc2NTMwOTA1OCwiaXNzIjoiYXV0aC1zZXJ2aWNlIn0.rGByTidG_abyIm_s-qHfn8pzEvOpCB5r2jioYBv4ESg";

const App = () => {
  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [authed, setAuthed] = useState(Boolean(DEFAULT_TOKEN));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("steamdash_token");
    if (stored) {
      setToken(stored);
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "steam-login" && event.data?.token) {
        const t = event.data.token as string;
        setToken(t);
        setAuthed(true);
        localStorage.setItem("steamdash_token", t);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleLogin = () => {
    if (username === DEMO_ADMIN_USER && password === DEMO_ADMIN_PASS) {
      setToken(DEMO_TOKEN);
      setAuthed(true);
      setLoginError(null);
      localStorage.setItem("steamdash_token", DEMO_TOKEN);
    } else {
      setLoginError("Invalid credentials. Try admin / admin123.");
    }
  };

  const handleLogout = () => {
    setAuthed(false);
    setToken("");
    setUsername("");
    setPassword("");
    localStorage.removeItem("steamdash_token");
  };

  const handleSteamLogin = () => {
    const redirect = encodeURIComponent(window.location.origin);
    const authBase = API_BASE;
    const url = `${authBase}/auth/steam/login?redirect=${redirect}`;
    window.open(url, "steam-login", "width=700,height=800");
  };

  const decoded = decodeToken(token);
  const steamId = decoded?.steamId || "";
  const personaName = decoded?.personaName || "User";

  if (!authed || !token) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div>
            <p className="eyebrow">Steam Dashboard</p>
            <h1>Admin sign in</h1>
            <p className="subhead">Use the demo admin credentials to inject a JWT and explore the dashboard.</p>
          </div>
          <div className="form">
            <label>
              <span>Username</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="admin123" />
            </label>
            {loginError ? <div className="status error full">{loginError}</div> : null}
            <button onClick={handleLogin}>Sign in</button>
            <div className="hint">Demo creds: admin / admin123</div>
          </div>
          <div className="callout">
            <p>Or sign in with Steam</p>
            <button className="ghost" onClick={handleSteamLogin}>
              Sign in with Steam
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="page">
        <NavBar onLogout={handleLogout} />
        <Routes>
          <Route path="/" element={<Navigate to="/discover" />} />
          <Route path="/discover" element={<DiscoverPage token={token} apiBase={API_BASE} />} />
          <Route path="/live-search" element={<LiveSearchPage token={token} apiBase={API_BASE} />} />
          <Route path="/dota-live" element={<LiveDotaPage token={token} apiBase={API_BASE} />} />
          <Route path="/players" element={<ProfilePage token={token} apiBase={API_BASE} steamId={steamId} personaName={personaName} />} />
          <Route path="/profile" element={<ProfilePage token={token} apiBase={API_BASE} steamId={steamId} personaName={personaName} />} />
          <Route path="/news" element={<NewsPage token={token} apiBase={API_BASE} />} />
          <Route path="/games/:appId" element={<GameDetailsPage token={token} apiBase={API_BASE} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
