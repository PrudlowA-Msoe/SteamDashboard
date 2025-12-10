import { Link, useLocation } from "react-router-dom";

interface Props {
  onLogout: () => void;
}

const NavBar = ({ onLogout }: Props) => {
  const location = useLocation();
  const isActive = (path: string) => (location.pathname === path ? "active" : "");

  return (
    <nav className="navbar">
      <div className="brand">
        <img className="brand-logo" src="https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg" alt="Steam" />
        <div>
          <div className="brand-mark">SteamDash</div>
          <div className="brand-sub">Live stats & search</div>
        </div>
      </div>
      <div className="nav-links">
        <Link className={isActive("/")} to="/">
          Home
        </Link>
        <Link className={isActive("/discover")} to="/discover">
          Discover
        </Link>
        <Link className={isActive("/live-search")} to="/live-search">
          Live Search
        </Link>
        <Link className={isActive("/dota-live")} to="/dota-live">
          Dota Live
        </Link>
        <Link className={isActive("/profile") || isActive("/players")} to="/profile">
          Profile
        </Link>
        <Link className={isActive("/news")} to="/news">
          News
        </Link>
      </div>
      <div className="chip-row">
        <span className="chip chip-ok">Signed in</span>
        <button className="ghost" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </nav>
  );
};

export default NavBar;
