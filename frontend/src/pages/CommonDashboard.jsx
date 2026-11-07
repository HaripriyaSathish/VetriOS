import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck, Palmtree, Briefcase, FileText, Mail, TrendingUp, FolderKanban, Activity, KeyRound,
} from "lucide-react";
import client from "../api/client";
import { groupPermissions } from "../components/PermissionsPanel";
import "../styles/CommonDashboard.css";
import "../modules/documents/styles/DocumentLibrary.css";

const PROJECT_STATUS_META = {
  Planned: { color: "#51607a", bg: "#eef2f8" },
  Active: { color: "#1f6837", bg: "#e3f5e9" },
  "On Hold": { color: "#93590c", bg: "#fdf0dc" },
  Completed: { color: "#1d4f91", bg: "#e4eefc" },
  Cancelled: { color: "#a32d2d", bg: "#fbe5e2" },
  Archived: { color: "#51607a", bg: "#eef2f8" },
};
const DEFAULT_STATUS_META = { color: "#51607a", bg: "#eef2f8" };

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Shared landing page for every role except System Administrator (which
// gets its own KPI/charts dashboard) — built from things true for any
// login: what you can actually do here (permissions), where to go next
// (quick links to whatever this user can access), and what's happened
// for you lately (your own notifications, no module filter).
function CommonDashboard({ user }) {
  const [activity, setActivity] = useState(null);
  const [projects, setProjects] = useState(null);
  const [attendance, setAttendance] = useState(null);

  useEffect(() => {
    client.get("/api/identity/my-activity/").then(({ data }) => setActivity(data)).catch(() => setActivity([]));
    // Read-only — module_05_clients_projects' own existing endpoint
    // (the same one Sidebar.jsx already calls to decide project nav
    // visibility), not a new endpoint of ours.
    client.get("/api/projects/me/").then(({ data }) => setProjects(data)).catch(() => setProjects([]));
    // Same endpoint the "My Attendance" page (/my/attendance) already uses.
    if (user.employee_code) {
      client.get("/api/hr/attendance/me/").then(({ data }) => setAttendance(data)).catch(() => setAttendance(null));
    }
  }, [user.employee_code]);

  const roles = user.roles || [];
  const permissions = user.permissions || [];
  const hasProjects = (projects?.length ?? 0) > 0;
  const history = attendance?.history ?? [];
  const hasAttendance = history.length > 0;

  const permissionGroups = groupPermissions(permissions);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (user.full_name || "").split(" ")[0];

  const quickLinks = [
    user.employee_code && { to: "/my/attendance", label: "Attendance", icon: CalendarCheck, primary: true },
    user.employee_code && { to: "/my/leave", label: "Apply leave", icon: Palmtree },
    hasProjects && { to: "/project/dashboard", label: "Projects", icon: FolderKanban },
    roles.includes("HR Administrator") && { to: "/hr", label: "HR", icon: Briefcase },
    permissions.includes("DOCUMENT_VIEW") && { to: "/documents", label: "Documents", icon: FileText },
    { to: "/email", label: "Email", icon: Mail },
  ].filter(Boolean);

  const cards = [
    hasAttendance && {
      label: `Days present · last ${history.length} ${history.length === 1 ? "day" : "days"}`,
      value: history.filter((d) => d.status === "PRESENT").length,
      tone: "green",
      Icon: CalendarCheck,
    },
    hasProjects && { label: "Projects assigned", value: projects.length, tone: "blue", Icon: FolderKanban },
    hasProjects && { label: "Active projects", value: projects.filter((p) => p.status === "Active").length, tone: "amber", Icon: Activity },
    { label: "Permissions granted", value: permissions.length, tone: "violet", Icon: KeyRound },
  ].filter(Boolean);

  return (
    <div className="cmnd-body cmn2 dl2">
      <div className="dl2-ban">
        <div className="dl2-ban-top">
          <div>
            <h1>{greeting}, {firstName}</h1>
            <p>
              {user.designation ? `${user.designation} · ` : ""}
              {roles.join(", ") || "No role assigned yet"}
            </p>
          </div>
        </div>
        {quickLinks.length > 0 && (
          <div className="cmn2-chips">
            {quickLinks.map((q) => (
              <Link to={q.to} key={q.to} className={`cmn2-chip${q.primary ? " primary" : ""}`}>
                <q.icon size={15} /> {q.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="dl2-body cmn2-body">
        <div className="cmn2-cards">
          {cards.map(({ label, value, tone, Icon }) => (
            <div key={label} className={`cmn2-card tone-${tone}`}>
              <span className="cmn2-card-top">
                <span className="cmn2-card-icon"><Icon size={17} /></span>
                <b>{value}</b>
              </span>
              <span className="cmn2-card-label">{label}</span>
            </div>
          ))}
        </div>

        <div className={`cmn2-grid${hasProjects ? "" : " single"}`}>
          {hasProjects && (
            <div className="cmn2-panel">
              <div className="cmn2-head">
                <b>My projects</b>
                <span>{projects.length} assigned</span>
              </div>
              {projects.map((p) => {
                const meta = PROJECT_STATUS_META[p.status] || DEFAULT_STATUS_META;
                return (
                  <Link to="/project/dashboard" className="cmn2-row" key={p.project_id}>
                    <span className="cmn2-tile"><FolderKanban size={16} /></span>
                    <div className="cmn2-text">
                      <b>{p.project_name}</b>
                      <small>{p.client_name} · {p.my_role}</small>
                    </div>
                    <span className="cmn2-pill" style={{ background: meta.bg, color: meta.color }}>{p.status}</span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="cmn2-panel">
            <div className="cmn2-head">
              <b>Your permissions</b>
              <span>{permissions.length} across {permissionGroups.length} modules</span>
            </div>
            {permissionGroups.length === 0 ? (
              <p className="cmnd-loading">No permissions yet.</p>
            ) : (
              permissionGroups.map((g) => (
                <div className="cmn2-perm" key={g.prefix} style={{ "--k": g.from }} title={g.items.join(", ")}>
                  <g.icon size={16} />
                  <b>{g.label}</b>
                  <span className="cmn2-count">{g.items.length}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="cmn2-panel">
          <div className="cmn2-head">
            <b>Recent activity</b>
            <span>your notifications</span>
          </div>
          {activity === null ? (
            <p className="cmnd-loading">Loading…</p>
          ) : activity.length === 0 ? (
            <p className="cmnd-loading">Nothing yet.</p>
          ) : (
            activity.map((a, i) => (
              <div className="cmn2-row static" key={i}>
                <span className="cmn2-dot"><TrendingUp size={15} /></span>
                <div className="cmn2-text">
                  <b>{a.title}</b>
                  {a.message && <small>{a.message}</small>}
                </div>
                <time className="cmn2-time">{formatTime(a.created_at)}</time>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default CommonDashboard;
