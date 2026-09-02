import { useOutletContext } from "react-router-dom";
import "../styles/Dashboard.css";

// Landing page after login — proves the token/role data made it through.
// Real module dashboards replace this later; AppLayout owns the
// sidebar/topbar/logout around it.
function Dashboard() {
  const { user } = useOutletContext();

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
