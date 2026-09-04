import { useOutletContext } from "react-router-dom";
import EmployeeDashboard from "../modules/hr/pages/EmployeeDashboard";
import "../styles/Dashboard.css";

const ADMIN_ROLES = new Set(["HR Administrator", "System Administrator"]);

// Landing page after login. HR Administrator / System Administrator see
// this generic roles/permissions summary (they have the full HR module
// for anything more); everyone else — Employee, Manager, Viewer — lands
// on EmployeeDashboard instead, since they have no other way to check
// themselves in (the rest of /hr/* is admin-gated).
function Dashboard() {
  const { user } = useOutletContext();

  const isAdmin = (user.roles || []).some((role) => ADMIN_ROLES.has(role));
  if (!isAdmin) {
    return <EmployeeDashboard user={user} />;
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
