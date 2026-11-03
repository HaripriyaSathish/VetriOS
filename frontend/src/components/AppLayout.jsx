import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, User, Settings, LogOut, Search } from "lucide-react";
import Sidebar from "./Sidebar";
import "../components-styles/AppLayout.css";
import "../modules/student/styles/StudentTheme.css";
import NotificationBell from "./NotificationBell";
import AIAssistantWidget from "./AIAssistantWidget";
import client from "../api/client";

// Shell for every signed-in page — sidebar on the left, topbar + routed
// page content on the right. Reads "user" once here so Sidebar and the
// topbar both see the same snapshot.

// Someone who has been promoted to Intern still keeps their underlying
// Student role active (so Student-only pages/data stay reachable), but
// the topbar should only read "Intern" for them, not "Student, Intern".
// Every other combination of roles displays exactly as-is, unchanged.
function displayRoles(roles) {
  if (!roles || roles.length === 0) return [];
  if (roles.includes("Employee") && (roles.includes("Intern") || roles.includes("Student"))) {
    return roles.filter((r) => r !== "Intern" && r !== "Student");
  }
  if (roles.includes("Intern")) {
    return roles.filter((r) => r !== "Student");
  }
  return roles;
}

// Pages the trainee topbar search can jump to (same list as their sidebar).
const STUDENT_PAGES = [
  { label: "My Dashboard", path: "/student/dashboard" },
  { label: "My Attendance", path: "/student/attendance" },
  { label: "Ask Trainer", path: "/student/ask-trainer" },
  { label: "Assessments", path: "/student/assessments" },
  { label: "Progress", path: "/student/progress" },
  { label: "Assignments", path: "/student/assignments" },
  { label: "Recordings", path: "/student/recordings" },
  { label: "Reports", path: "/student/reports" },
];

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [search, setSearch] = useState("");
  const isStudentArea = location.pathname.startsWith("/student");

  const handleSearch = (event) => {
    event.preventDefault();
    const query = search.trim().toLowerCase();
    if (!query) return;
    const match = STUDENT_PAGES.find((p) => p.label.toLowerCase().includes(query));
    if (match) {
      setSearch("");
      navigate(match.path);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lightweight fetch just for the avatar — login's cached "user" object
  // doesn't carry the photo, and it can change anytime from the Profile page.
  useEffect(() => {
    client
      .get("/api/identity/profile/")
      .then(({ data }) => setPhotoUrl(data.photo_url))
      .catch(() => {});
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

  const rolesToShow = displayRoles(user?.roles);
  const avatarInitial = (user?.full_name || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <header className="app-topbar">
          {user?.employee_code && <span className="app-topbar-empcode">{user.employee_code}</span>}

          {isStudentArea && (
            <form className="app-search" onSubmit={handleSearch} role="search">
              <Search size={17} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search anything..."
                list="app-search-pages"
                aria-label="Search pages"
              />
              <datalist id="app-search-pages">
                {STUDENT_PAGES.map((p) => <option key={p.path} value={p.label} />)}
              </datalist>
            </form>
          )}

          <div className="app-topbar-right">
            <NotificationBell />

            <div className="app-user-menu" ref={menuRef}>
              <button type="button" className="app-user-trigger" onClick={() => setMenuOpen((v) => !v)}>
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="app-topbar-avatar" />
                ) : (
                  <span className="app-topbar-avatar-fallback">{avatarInitial}</span>
                )}

                <span className="app-topbar-identity">
                  <span className="app-topbar-user">
                    {user?.full_name}
                    {[user?.department, user?.designation].filter(Boolean).length > 0 &&
                      ` (${[user?.department, user?.designation].filter(Boolean).join(". ")})`}
                  </span>
                  {rolesToShow.length > 0 && (
                    <span className="app-topbar-designation">Role: {rolesToShow.join(", ")}</span>
                  )}
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
              <LogOut size={15} />
              Log out
            </button>
          </div>
        </header>

        <div className={"app-content" + (location.pathname.startsWith("/student") ? " student-theme" : "")}>
          <Outlet context={{ user }} />
        </div>
      </div>

      <AIAssistantWidget />
    </div>
  );
}

export default AppLayout;