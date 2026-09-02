import { NavLink } from "react-router-dom";
import "../components-styles/Sidebar.css";

// Left nav — module list is deliberately left out for now until those
// modules have real pages; only Dashboard is linked.
function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-mark">V</span>
        <span className="sidebar-brand-name">VetriOS</span>
      </div>

      <NavLink
        to="/dashboard"
        className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
      >
        <span className="nav-icon">📊</span> Dashboard
      </NavLink>

      <NavLink
        to="/identity/users"
        className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
      >
        <span className="nav-icon">👤</span> User & Accounts
      </NavLink>

      <NavLink
        to="/identity/roles"
        className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
      >
        <span className="nav-icon">🔑</span> Roles
      </NavLink>

      <NavLink
        to="/identity/permissions"
        className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
      >
        <span className="nav-icon">🛡️</span> Permissions
      </NavLink>

    </aside>
  );
}

export default Sidebar;
