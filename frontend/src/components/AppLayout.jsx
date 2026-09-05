import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { ChevronDown, User, Settings } from "lucide-react";
import Sidebar from "./Sidebar";
import "../components-styles/AppLayout.css";
import NotificationBell from "./NotificationBell";
import AIAssistantWidget from "./AIAssistantWidget";

// Shell for every signed-in page — sidebar on the left, topbar + routed
// page content on the right. Reads "user" once here so Sidebar and the
// topbar both see the same snapshot.
function AppLayout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const goTo = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <header className="app-topbar">
          {user?.employee_code && <span className="app-topbar-empcode">{user.employee_code}</span>}

          <div className="app-topbar-right">
            <NotificationBell />

            <div className="app-user-menu" ref={menuRef}>
              <button type="button" className="app-user-trigger" onClick={() => setMenuOpen((v) => !v)}>
                <span className="app-topbar-identity">
                  <span className="app-topbar-user">{user?.full_name}</span>
                  {user?.designation && <span className="app-topbar-designation">{user.designation}</span>}
                </span>
                <ChevronDown size={15} className={"app-user-chevron" + (menuOpen ? " open" : "")} />
              </button>

              {menuOpen && (
                <div className="app-user-dropdown">
                  <button type="button" className="app-user-dropdown-item" onClick={() => goTo("/profile")}>
                    <User size={15} /> Profile
                  </button>
                  <button type="button" className="app-user-dropdown-item" onClick={() => goTo("/settings")}>
                    <Settings size={15} /> Settings
                  </button>
                </div>
              )}
            </div>

            <button className="app-logout" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <div className="app-content">
          <Outlet context={{ user }} />
        </div>
      </div>

      <AIAssistantWidget />
    </div>
  );
}

export default AppLayout;