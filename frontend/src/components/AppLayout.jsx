import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../components-styles/AppLayout.css";

// Shell for every signed-in page — sidebar on the left, topbar + routed
// page content on the right. Reads "user" once here so Sidebar and the
// topbar both see the same snapshot.
function AppLayout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <header className="app-topbar">
          <span className="app-topbar-user">{user?.full_name}</span>
          <button className="app-logout" onClick={handleLogout}>
            Log out
          </button>
        </header>

        <div className="app-content">
          <Outlet context={{ user }} />
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
