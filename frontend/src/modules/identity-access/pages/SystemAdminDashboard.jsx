import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, ShieldCheck, UserX, KeyRound, UserPlus, AlertTriangle, Bell, ChevronRight,
  Server, Database, Mail, CheckCircle2, XCircle, CircleAlert, TrendingUp, Shield,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, BarChart as RBarChart, Bar, XAxis, CartesianGrid, Tooltip,
} from "recharts";
import client from "../../../api/client";
import PermissionsPanel from "../../../components/PermissionsPanel";
import StudentHero from "../../student/components/StudentHero";
import "../../student/styles/StudentDashboard.css";
import "../styles/SystemAdminDashboard.css";

// Fixed categorical order — never cycled, never reassigned per filter.
// A 6th+ role folds into "Other". Colours come from the Vetri palette.
const ROLE_COLORS = ["#002673", "#2689ef", "#e7510c", "#ffc83d", "#7b88a6"];
const OTHER_COLOR = "#c4cee3";
const BLUE = "#2689ef";
const ORANGE = "#ff8a4c";
const ORANGE_DARK = "#e7510c";

const isLoginRequest = (r) => r.permission_requested?.startsWith("Create login credentials for ");

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDay(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// "5 hours ago" for recent items, a short date once it's older than a week.
function timeAgo(iso) {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Pick an icon + tint for an activity row from its title, so approvals,
// rejections and new accounts read differently at a glance.
function activityMeta(title = "") {
  const t = title.toLowerCase();
  if (t.includes("reject")) return { Icon: XCircle, bg: "#fdecec", fg: "#d92d20" };
  if (t.includes("approv")) return { Icon: CheckCircle2, bg: "#e9f8ef", fg: "#16a34a" };
  if (t.includes("account") || t.includes("login")) return { Icon: UserPlus, bg: "#eef3fc", fg: "#0a3591" };
  if (t.includes("request")) return { Icon: KeyRound, bg: "#fff1ea", fg: "#e7510c" };
  return { Icon: Bell, bg: "#eef3fc", fg: "#0a3591" };
}

// Shared hover-tooltip shell, styled to match the app's card language —
// used by all three charts below so hovering a data point shows exactly
// what it represents instead of making the viewer eyeball pixel heights.
function ChartTooltip({ label, rows }) {
  return (
    <div className="sad-tooltip">
      {label && <div className="sad-tooltip-label">{label}</div>}
      {rows.map((r) => (
        <div className="sad-tooltip-row" key={r.name}>
          <span className="sad-tooltip-swatch" style={{ background: r.color }} />
          <span className="sad-tooltip-name">{r.name}</span>
          <span className="sad-tooltip-val">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ slices, total }) {
  return (
    <div className="sad-donut-wrap">
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie
            data={slices} dataKey="count" nameKey="role_name"
            innerRadius={52} outerRadius={72} paddingAngle={1.5} stroke="none"
          >
            {slices.map((s) => <Cell key={s.role_name} fill={s.color} />)}
          </Pie>
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0];
              const pct = total > 0 ? Math.round((p.value / total) * 100) : 0;
              return <ChartTooltip rows={[{ name: p.name, value: `${p.value} (${pct}%)`, color: p.payload.color }]} />;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="sad-donut-center">
        <span className="sad-donut-total">{total}</span>
        <span className="sad-donut-caption">total</span>
      </div>
    </div>
  );
}

function LineChart({ points }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={points} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="lineFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity="0.22" />
            <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#e3e9f4" />
        <XAxis
          dataKey="date" tickFormatter={formatDay} axisLine={{ stroke: "#c4cee3" }} tickLine={false}
          tick={{ fontSize: 10.5, fill: "#7b88a6", fontFamily: "Inter, sans-serif" }}
          interval="preserveStartEnd"
        />
        <Tooltip
          cursor={{ stroke: "#c4cee3", strokeDasharray: "3 3" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return <ChartTooltip label={formatDay(label)} rows={[{ name: "Accounts created", value: payload[0].value, color: BLUE }]} />;
          }}
        />
        <Area type="monotone" dataKey="count" stroke={BLUE} strokeWidth={2.5} fill="url(#lineFade)" activeDot={{ r: 4, fill: BLUE }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function BarChart({ bars }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <RBarChart data={bars} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="date" tickFormatter={(d) => formatDay(d).split(" ")[0]} axisLine={{ stroke: "#c4cee3" }} tickLine={false}
          tick={{ fontSize: 10.5, fill: "#7b88a6", fontFamily: "Inter, sans-serif" }}
          interval={bars.length > 4 ? 1 : 0}
        />
        <Tooltip
          cursor={{ fill: "#f5f8fd" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return <ChartTooltip label={formatDay(label)} rows={[{ name: "New requests", value: payload[0].value, color: ORANGE }]} />;
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {bars.map((b, i) => <Cell key={b.date} fill={i === bars.length - 1 ? ORANGE_DARK : ORANGE} />)}
        </Bar>
      </RBarChart>
    </ResponsiveContainer>
  );
}

const HEALTH_META = {
  online: { bg: "#e9f8ef", fg: "#16a34a", label: "Online" },
  connected: { bg: "#e9f8ef", fg: "#16a34a", label: "Connected" },
  reachable: { bg: "#e9f8ef", fg: "#16a34a", label: "Reachable" },
  unreachable: { bg: "#fff1ea", fg: "#c9450a", label: "Unreachable" },
  not_configured: { bg: "#fdecec", fg: "#d92d20", label: "Not configured" },
};

function HealthRow({ icon, name, sub, state }) {
  const meta = HEALTH_META[state];
  return (
    <div className="sad-health-row">
      <span className="sad-health-icon" style={{ background: meta.bg, color: meta.fg }}>{icon}</span>
      <div className="sad-health-text">
        <span className="sad-health-name">{name}</span>
        <span className="sad-health-sub">{sub}</span>
      </div>
      <span className="sad-health-badge" style={{ background: meta.bg, color: meta.fg }}>
        {state === "unreachable" || state === "not_configured" ? <CircleAlert size={11} /> : <CheckCircle2 size={11} />}
        {meta.label}
      </span>
    </div>
  );
}

function SystemAdminDashboard({ user }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState([]); // pending requests addressed to this admin

  useEffect(() => {
    client.get("/api/identity/admin-dashboard/")
      .then(({ data }) => setData(data))
      .catch(() => setError("Couldn't load the dashboard right now."));
    // Feeds the "Needs your attention" panel; the dashboard still works
    // without it, so a failure here is silent.
    client.get("/api/identity/permission-requests/", { params: { box: "received" } })
      .then(({ data }) => setPending(data.filter((r) => r.status === "PENDING")))
      .catch(() => setPending([]));
  }, []);

  if (error) return <div className="sad-body"><p className="sad-error">{error}</p></div>;
  if (!data) return <div className="sad-body"><p className="sad-loading">Loading dashboard…</p></div>;

  const { kpis, role_distribution, new_accounts_trend, approvals_trend, system_health, recent_activity, permissions } = data;

  const roleSlices = role_distribution.slice(0, 5).map((r, i) => ({ ...r, color: ROLE_COLORS[i] }));
  const otherCount = role_distribution.slice(5).reduce((sum, r) => sum + r.count, 0);
  if (otherCount > 0) roleSlices.push({ role_name: "Other", count: otherCount, color: OTHER_COLOR });
  const roleTotal = roleSlices.reduce((sum, r) => sum + r.count, 0);

  const db = system_health.database;
  const dbLabel = db.mode === "shared" ? "Shared Database (Tailscale)" : "Local Database (fallback)";
  const allHealthy = db.connected && system_health.email.configured;

  const pendingTotal = kpis.pending_login_requests + kpis.pending_permission_requests;
  const attentionCount = pendingTotal + kpis.employees_without_login;
  const newAccounts14d = new_accounts_trend.reduce((s, p) => s + p.count, 0);
  const firstName = (user?.full_name || "").trim().split(/\s+/)[0] || "there";

  // Same pastel stat-card look as the trainee dashboard in the VETRI OS
  // Figma, with Lucide icons; each card jumps to the page where you act on it.
  const kpiCards = [
    {
      label: "Total Users", value: kpis.total_users, to: "/identity/users", accent: "blue",
      art: <Users size={24} />,
      foot: <span className="sad-delta up"><TrendingUp size={12} /> +{newAccounts14d} in 14 days</span>,
    },
    {
      label: "Active Roles", value: kpis.active_roles, to: "/identity/roles", accent: "orange",
      art: <ShieldCheck size={24} />,
      foot: <span className="sad-muted">{role_distribution.length} with users assigned</span>,
    },
    {
      label: "Pending Requests", value: pendingTotal, to: "/request-access", accent: "blue",
      tone: pendingTotal > 0 ? "red" : "gray",
      art: <KeyRound size={24} />,
      foot: (
        <span className="sad-delta attn">
          <AlertTriangle size={12} /> {kpis.pending_login_requests} login &middot; {kpis.pending_permission_requests} permission
        </span>
      ),
    },
    {
      label: "No Login Yet", value: kpis.employees_without_login, to: "/identity/users", accent: "orange",
      tone: kpis.employees_without_login > 0 ? "red" : "gray",
      art: <UserX size={24} />,
      foot: <span className="sad-muted">employees awaiting a login</span>,
    },
  ];

  return (
    <div className="sad-body">
      <StudentHero
        eyebrow="Welcome Back!"
        title={`${greeting()}, ${firstName}. You're managing ${kpis.total_users} users across ${kpis.active_roles} roles.`}
        subtitle={`${
          attentionCount > 0
            ? `${attentionCount} ${attentionCount === 1 ? "item needs" : "items need"} your attention.`
            : "Nothing needs your attention right now."
        } ${allHealthy ? "All systems are running." : "Check the system health panel below."}`}
      >
        <div className="sad-banner-actions">
          <button type="button" className="sad-qa primary" onClick={() => navigate("/identity/users")}>
            <UserPlus size={15} /> Create account
          </button>
          <button type="button" className="sad-qa" onClick={() => navigate("/request-access")}>
            <KeyRound size={15} /> Review requests
          </button>
          <button type="button" className="sad-qa" onClick={() => navigate("/identity/roles")}>
            <Shield size={15} /> Manage roles
          </button>
        </div>
      </StudentHero>

      <div className="sd-stats">
        {kpiCards.map((k, i) => (
          <div
            key={k.label}
            role="button"
            tabIndex={0}
            className={`sd-card sd-card-${k.accent} sad-kpi`}
            style={{ "--delay": `${0.05 + i * 0.07}s` }}
            onClick={() => navigate(k.to)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(k.to); } }}
          >
            <span className="sd-card-blob" aria-hidden="true" />
            <span className="sd-card-icon">{k.art}</span>
            <p className={`sd-card-value sd-tone-${k.tone || "gray"}`}>{k.value}</p>
            <p className="sd-card-label">{k.label}</p>
            <div className="sad-kpi-foot">{k.foot}</div>
          </div>
        ))}
      </div>

      <div className="sad-attn-row">
        <div className="sad-card">
          <div className="sad-card-head">
            <span className="sad-card-title">Needs your attention</span>
            <span className={"sad-pill " + (pending.length > 0 ? "warn" : "ok")}>
              {pending.length > 0 ? `${pending.length} open` : "All clear"}
            </span>
          </div>
          {pending.length === 0 ? (
            <p className="sad-loading">No pending requests are waiting on you.</p>
          ) : (
            pending.slice(0, 4).map((r) => {
              const login = isLoginRequest(r);
              return (
                <div className="sad-attn-item" key={r.permission_request_id}>
                  <span
                    className="sad-activity-icon"
                    style={login ? { background: "#fff1ea", color: "#e7510c" } : { background: "#eef3fc", color: "#0a3591" }}
                  >
                    {login ? <UserPlus size={15} /> : <KeyRound size={15} />}
                  </span>
                  <div className="sad-activity-text">
                    <div className="sad-activity-title">{r.permission_requested}</div>
                    <div className="sad-activity-sub">{r.requester_name} · {timeAgo(r.created_at)}</div>
                  </div>
                  <button
                    type="button"
                    className={"sad-attn-btn" + (login ? "" : " ghost")}
                    onClick={() => navigate(login ? "/identity/users" : "/request-access")}
                  >
                    {login ? "Create" : "Review"}
                  </button>
                </div>
              );
            })
          )}
          {pending.length > 4 && (
            <button type="button" className="sad-viewall" onClick={() => navigate("/request-access")}>
              View all {pending.length} requests <ChevronRight size={14} />
            </button>
          )}
        </div>

        <div className="sad-card">
          <div className="sad-card-head">
            <span className="sad-card-title">System Health</span>
            <span className={"sad-pill " + (allHealthy ? "ok" : "warn")}>
              {allHealthy ? "All operational" : "Needs a look"}
            </span>
          </div>

          <HealthRow icon={<Server size={17} />} name="Backend API" sub="Django" state="online" />
          <HealthRow
            icon={<Database size={17} />}
            name={dbLabel}
            sub={db.host}
            state={db.connected ? "connected" : "unreachable"}
          />
          <HealthRow
            icon={<Mail size={17} />}
            name="Email Service"
            sub={system_health.email.backend.split(".").pop()}
            state={system_health.email.configured ? "online" : "not_configured"}
          />
        </div>
      </div>

      <div className="sad-charts-row">
        <div className="sad-card">
          <div className="sad-card-head">
            <span className="sad-card-title">Role Distribution</span>
            <span className="sad-card-sub">{roleTotal} users</span>
          </div>
          <DonutChart slices={roleSlices} total={roleTotal} />
          <div className="sad-legend">
            {roleSlices.map((s) => (
              <div className="sad-legend-row" key={s.role_name}>
                <span className="sad-legend-swatch" style={{ background: s.color }} />
                <span className="sad-legend-name">{s.role_name}</span>
                <span className="sad-legend-val">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sad-card">
          <div className="sad-card-head">
            <span className="sad-card-title">New Accounts</span>
            <span className="sad-card-sub">last 14 days</span>
          </div>
          <LineChart points={new_accounts_trend} />
          <div className="sad-legend-row" style={{ justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="sad-legend-swatch" style={{ background: BLUE, borderRadius: "999px" }} />
              Accounts created / day
            </span>
            <span className="sad-legend-val">{newAccounts14d} total</span>
          </div>
        </div>

        <div className="sad-card">
          <div className="sad-card-head">
            <span className="sad-card-title">Approvals Trend</span>
            <span className="sad-card-sub">last 7 days</span>
          </div>
          <BarChart bars={approvals_trend} />
          <div className="sad-legend-row" style={{ justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="sad-legend-swatch" style={{ background: ORANGE }} />
              New requests / day
            </span>
            <span className="sad-legend-val">{approvals_trend[approvals_trend.length - 1]?.count ?? 0} today</span>
          </div>
        </div>
      </div>

      <div className="sad-card">
        <div className="sad-card-head">
          <span className="sad-card-title">Recent Activity</span>
          <span className="sad-card-sub">your notifications</span>
        </div>
        {recent_activity.length === 0 ? (
          <p className="sad-loading">Nothing yet.</p>
        ) : (
          recent_activity.map((a, i) => {
            const { Icon, bg, fg } = activityMeta(a.title);
            return (
              <div className="sad-activity-row" key={i}>
                <span className="sad-activity-icon" style={{ background: bg, color: fg }}>
                  <Icon size={15} />
                </span>
                <div className="sad-activity-text">
                  <div className="sad-activity-title">{a.title}</div>
                  {a.message && <div className="sad-activity-sub">{a.message}</div>}
                </div>
                <span className="sad-activity-time" title={new Date(a.created_at).toLocaleString()}>{timeAgo(a.created_at)}</span>
              </div>
            );
          })
        )}
      </div>

      <PermissionsPanel permissions={permissions} />
    </div>
  );
}

export default SystemAdminDashboard;
