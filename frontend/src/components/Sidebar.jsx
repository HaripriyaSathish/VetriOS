import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldCheck,
  KeyRound,
  Users,
  Lock,
  ChevronDown,
} from "lucide-react";
import { NAV_ITEMS, hasAccess } from "../config/nav";
import "../components-styles/Sidebar.css";

const SYSADMIN_PATHS = ["/dashboard", "/identity/users", "/identity/roles", "/identity/permissions"];

function Sidebar() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const location = useLocation();

  const identityRequirement = { type: "role", value: "System Administrator" };
  const businessTeamRequirement = { type: "role", value: "Business Team" };
  const trainingItem = NAV_ITEMS.find((item) => item.id === "training");
  const hrItem = NAV_ITEMS.find((item) => item.id === "hr");

  const isSystemAdministrator = hasAccess(identityRequirement, user);
  const isOnSysAdminPage = SYSADMIN_PATHS.some((path) => location.pathname.startsWith(path));
  const [sysAdminOpen, setSysAdminOpen] = useState(isOnSysAdminPage);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-mark">V</span>
        <span className="sidebar-brand-name">VetriOS</span>
      </div>

      {!isSystemAdministrator && (
        <NavLink
          to="/dashboard"
          className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
        >
          <span className="nav-icon">
            <LayoutDashboard size={16} />
          </span>
          Dashboard
        </NavLink>
      )}

      {isSystemAdministrator && (
        <>
          <button
            type="button"
            className={"nav-item nav-group-toggle" + (sysAdminOpen ? " open" : "")}
            onClick={() => setSysAdminOpen((prev) => !prev)}
          >
            <span className="nav-icon">
              <ShieldCheck size={16} />
            </span>
            System Administrator
            <span className="nav-chevron">
              <ChevronDown size={14} />
            </span>
          </button>

          {sysAdminOpen && (
            <div className="nav-subgroup">
              <NavLink
                to="/dashboard"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <LayoutDashboard size={14} />
                </span>
                Dashboard
              </NavLink>

              <NavLink
                to="/identity/roles"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <KeyRound size={14} />
                </span>
                Roles
              </NavLink>

              <NavLink
                to="/identity/users"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <Users size={14} />
                </span>
                User & Accounts
              </NavLink>

              <NavLink
                to="/identity/permissions"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <Lock size={14} />
                </span>
                Permissions
              </NavLink>
            </div>
          )}

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

      {hasAccess(businessTeamRequirement, user) && (
        <NavLink
          to="/training/enquiries"
          className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
        >
          <span className="nav-icon">📋</span> Enquiries
        </NavLink>
      )}
    </aside>
  );
}

export default Sidebar;