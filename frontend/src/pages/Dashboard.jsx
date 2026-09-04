import { useOutletContext } from "react-router-dom";
import "../styles/Dashboard.css";

const ADMIN_ROLES = new Set(["HR Administrator", "System Administrator"]);

// Landing page after login. HR Administrator / System Administrator see
// the roles/permissions summary below (they have the full HR module for
// anything more); everyone else — Employee, Manager, Viewer — gets a
// light welcome, since their real workspace is the Attendance/Apply
// Leave sidebar items (see Sidebar.jsx), not this page.
function Dashboard() {
  const { user } = useOutletContext();

  const isAdmin = (user.roles || []).some((role) => ADMIN_ROLES.has(role));
  if (!isAdmin) {
    return (
      <div className="dash-body">
        <h1 className="dash-welcome">Welcome, {user.full_name}</h1>
        <p className="dash-subtitle">
          {user.designation ? `${user.designation} · ` : ""}
          Use Attendance to check in/out, or Apply Leave to request time off.
        </p>
      </div>
    );
  }

  return (
    <div className="dash-body">
      <h1 className="dash-welcome">Welcome, {user.full_name}</h1>
      <p className="dash-subtitle">Username: {user.username}</p>

      <div className="dash-cards">
        <div className="dash-card">
          <h3>Roles</h3>
          <div className="dash-tags">
            {user.roles.map((role) => (
              <span className="dash-tag dash-tag-role" key={role}>
                {role}
              </span>
            ))}
          </div>
        </div>

        <div className="dash-card">
          <h3>Permissions</h3>
          <div className="dash-tags">
            {user.permissions.map((permission) => (
              <span className="dash-tag" key={permission}>
                {permission}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
