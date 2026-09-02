import { NavLink } from "react-router-dom";
import { NAV_ITEMS, hasAccess } from "../config/nav";
import "../components-styles/Sidebar.css";

function Sidebar() {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const identityRequirement = { type: "role", value: "System Administrator" };
  const trainingItem = NAV_ITEMS.find((item) => item.id === "training");
  const hrItem = NAV_ITEMS.find((item) => item.id === "hr");

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

      {hasAccess(identityRequirement, user) && (
        <>
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

          {/* User Permissions menu hidden for now — page/route still exist,
              re-add this NavLink when it's needed again. */}
        </>
      )}

      {hrItem && hasAccess(hrItem.requirement, user) && (
        <NavLink
          to="/hr"
          className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
        >
          <span className="nav-icon">🧑‍💼</span> HR
        </NavLink>
      )}

      {trainingItem && hasAccess(trainingItem.requirement, user) && (
        <NavLink
          to="/training"
          className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
        >
          <span className="nav-icon">🎓</span> Training
        </NavLink>
      )}
    </aside>
  );
}

export default Sidebar;
