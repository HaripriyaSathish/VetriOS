import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, UserCheck, GraduationCap, Building2, UserX, CalendarClock, UserPlus, FileText, Award, Bell, PartyPopper, ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import client from "../../../api/client";
import StudentHero from "../../student/components/StudentHero";
import "../../student/styles/StudentDashboard.css";
import "../styles/HROverview.css";

const DEPT_COLOR = "#2a78d6";
const LEAVE_COLOR = "#eb6834";

const ATTENDANCE_META = {
  PRESENT: { label: "Present", color: "#16a34a" },
  HALF_DAY: { label: "Half day", color: "#b45309" },
  ON_LEAVE: { label: "On leave", color: "#235777" },
  ABSENT: { label: "Absent", color: "#96271f" },
  NO_LOGIN: { label: "No login", color: "#6b7280" },
};

const PIPELINE_META = {
  NOT_STARTED: { label: "Not started", color: "#6b7280", bg: "#f0f2f5" },
  IN_PROGRESS: { label: "In progress", color: "#b45309", bg: "#ffedd5" },
  COMPLETED: { label: "Completed", color: "#16a34a", bg: "#dcfce7" },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

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

function formatDay(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChartTooltip({ label, rows }) {
  return (
    <div className="hrd-tooltip">
      {label && <div className="hrd-tooltip-label">{label}</div>}
      {rows.map((r) => (
        <div className="hrd-tooltip-row" key={r.name}>
          <span className="hrd-tooltip-swatch" style={{ background: r.color }} />
          <span className="hrd-tooltip-name">{r.name}</span>
          <span className="hrd-tooltip-val">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// Horizontal bars — the department name sits directly beside its own
// bar on the y-axis, so a long name (e.g. "Training and Development")
// just reads left-to-right on its own row instead of fighting its
// neighbors for space underneath a narrow vertical bar.
function DepartmentBarChart({ rows }) {
  const height = Math.max(150, rows.length * 38);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category" dataKey="department_name" width={120}
          axisLine={{ stroke: "#c3c2b7" }} tickLine={false}
          tick={{ fontSize: 11, fill: "#3a4152", fontFamily: "Manrope, sans-serif" }}
        />
        <Tooltip
          cursor={{ fill: "#f5f7fa" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return <ChartTooltip label={label} rows={[{ name: "Employees", value: payload[0].value, color: DEPT_COLOR }]} />;
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} fill={DEPT_COLOR} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LeaveTrendChart({ points }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={points} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="leaveFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LEAVE_COLOR} stopOpacity="0.18" />
            <stop offset="100%" stopColor={LEAVE_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#eef0f3" />
        <XAxis
          dataKey="date" tickFormatter={formatDay} axisLine={{ stroke: "#c3c2b7" }} tickLine={false}
          tick={{ fontSize: 10.5, fill: "#8a93a6", fontFamily: "Manrope, sans-serif" }}
          interval="preserveStartEnd"
        />
        <Tooltip
          cursor={{ stroke: "#c3c2b7", strokeDasharray: "3 3" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return <ChartTooltip label={formatDay(label)} rows={[{ name: "Leave requests", value: payload[0].value, color: LEAVE_COLOR }]} />;
          }}
        />
        <Area type="monotone" dataKey="count" stroke={LEAVE_COLOR} strokeWidth={2.5} fill="url(#leaveFade)" activeDot={{ r: 4, fill: LEAVE_COLOR }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function AttendanceDonut({ counts }) {
  const slices = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ key, count, ...ATTENDANCE_META[key] }));
  const total = slices.reduce((s, x) => s + x.count, 0);

  return (
    <div className="hrd-donut-wrap">
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie data={slices} dataKey="count" nameKey="label" innerRadius={52} outerRadius={72} paddingAngle={1.5} stroke="none">
            {slices.map((s) => <Cell key={s.key} fill={s.color} />)}
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
      <div className="hrd-donut-center">
        <span className="hrd-donut-total">{total}</span>
        <span className="hrd-donut-caption">active</span>
      </div>
    </div>
  );
}


function HROverview() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const firstName = (user?.full_name || "").trim().split(/\s+/)[0] || "there";

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    client.get("/api/hr/dashboard/")
      .then(({ data }) => setData(data))
      .catch(() => setError("Couldn't load the dashboard right now."));
    // Headcount cards (total / inactive / interns) count from the employee list.
    client.get("/api/hr/employees/")
      .then(({ data }) => setEmployees(data))
      .catch(() => setEmployees([]));
  }, []);

  if (error) return <div className="hrd-body"><p className="hrd-error">{error}</p></div>;
  if (!data) return <div className="hrd-body"><p className="hrd-loading">Loading dashboard…</p></div>;

  const { kpis, attendance_today, headcount_by_department, leave_trend, onboarding_pipeline, pending_promotions, recent_activity } = data;
  const pipelineTotal = Object.values(onboarding_pipeline).reduce((s, n) => s + n, 0);
  const inProgress = onboarding_pipeline.IN_PROGRESS || 0;

  // The same notification can be sent more than once — show each only once.
  const seen = new Set();
  const activity = recent_activity
    .filter((a) => {
      const key = `${a.title}|${a.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);

  const attention = [
    kpis.pending_leave_requests > 0 && {
      text: `${kpis.pending_leave_requests} leave ${kpis.pending_leave_requests === 1 ? "request" : "requests"} to review`,
      to: "/hr/leave", tone: "orange",
    },
    kpis.employees_without_login > 0 && {
      text: `${kpis.employees_without_login} ${kpis.employees_without_login === 1 ? "employee has" : "employees have"} never logged in`,
      to: "/hr/employees", tone: "orange",
    },
    pending_promotions.length > 0 && {
      text: `${pending_promotions.length} ${pending_promotions.length === 1 ? "promotion" : "promotions"} awaiting approval`,
      to: "/hr/promotions", tone: "blue",
    },
    inProgress > 0 && {
      text: `${inProgress} ${inProgress === 1 ? "intern" : "interns"} in onboarding`,
      to: "/hr/onboarding", tone: "blue",
    },
  ].filter(Boolean);

  const totalEmployees = employees.length;
  const inactiveEmployees = employees.filter((e) => e.status !== "ACTIVE").length;
  const internCount = employees.filter((e) => /intern/i.test(e.employment_type_name || "")).length;
  const deptCount = headcount_by_department.length;
  const largestDept = headcount_by_department[0];

  const statCards = [
    { label: "Total employees", value: totalEmployees, sub: "All records", icon: Users, accent: "blue", to: "/hr/employees", gray: totalEmployees === 0 },
    { label: "Active employees", value: kpis.total_active_employees, sub: `${inactiveEmployees} inactive`, icon: UserCheck, accent: "blue", to: "/hr/employees", gray: kpis.total_active_employees === 0 },
    { label: "Interns", value: internCount, sub: "On internship", icon: GraduationCap, accent: "blue", to: "/hr/employees", gray: internCount === 0 },
    { label: "Departments", value: deptCount, sub: largestDept ? `Largest: ${largestDept.department_name} (${largestDept.count})` : "", icon: Building2, accent: "blue", to: "/hr/employees", gray: deptCount === 0 },
    { label: "No login yet", value: kpis.employees_without_login, sub: "Never signed in", icon: UserX, accent: "orange", to: "/hr/employees", red: kpis.employees_without_login > 0, gray: kpis.employees_without_login === 0 },
  ];

  return (
    <div className="hrd-body">
      <StudentHero
        eyebrow="Welcome back!"
        title={`${greeting()}, ${firstName}. You have ${kpis.total_active_employees} active employees.`}
        subtitle={attention.length > 0
          ? `${attention.length} ${attention.length === 1 ? "item needs" : "items need"} your attention.`
          : "Nothing needs your attention right now."}
      >
        <div className="hrd-banner-actions">
          <button type="button" className="hrd-qa primary" onClick={() => navigate("/hr/employees")}>
            <UserPlus size={14} /> Add employee
          </button>
          <button type="button" className="hrd-qa" onClick={() => navigate("/hr/leave")}>
            <CalendarClock size={14} /> Review leave
          </button>
          <button type="button" className="hrd-qa" onClick={() => navigate("/hr/promotions")}>
            <FileText size={14} /> Draft promotion
          </button>
        </div>
      </StudentHero>

      <div className="sd-stats">
        {statCards.map((k) => (
          <div
            key={k.label}
            role="button"
            tabIndex={0}
            className={`sd-card sd-card-${k.accent} hrd-kpi`}
            onClick={() => navigate(k.to)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(k.to); } }}
          >
            <span className="sd-card-blob" aria-hidden="true" />
            <span className="sd-card-icon"><k.icon size={20} /></span>
            <p className={`sd-card-value${k.red ? " sd-tone-red" : k.gray ? " sd-tone-gray" : ""}`}>{k.value}</p>
            <p className="sd-card-label">{k.label}</p>
            {k.sub && <p className="hrd-kpi-sub">{k.sub}</p>}
          </div>
        ))}
      </div>

      {attention.length > 0 && (
        <div className="hrd-attn">
          <span className="hrd-attn-title">Needs attention</span>
          {attention.map((a) => (
            <button key={a.text} type="button" className={`hrd-chip ${a.tone}`} onClick={() => navigate(a.to)}>
              {a.text} <ArrowRight size={12} />
            </button>
          ))}
        </div>
      )}

      <div className="hrd-charts-row">
        <div className="hrd-card">
          <div className="hrd-card-head">
            <span className="hrd-card-title">Headcount by department</span>
            <span className="hrd-card-sub">{kpis.total_active_employees} active</span>
          </div>
          {headcount_by_department.length === 0 ? (
            <p className="hrd-loading">No department data yet.</p>
          ) : (
            <DepartmentBarChart rows={headcount_by_department} />
          )}
        </div>

        <div className="hrd-card">
          <div className="hrd-card-head">
            <span className="hrd-card-title">Leave requests</span>
            <span className="hrd-card-sub">last 7 days</span>
          </div>
          <LeaveTrendChart points={leave_trend} />
        </div>

        <div className="hrd-card">
          <div className="hrd-card-head">
            <span className="hrd-card-title">Today's attendance</span>
            <span className="hrd-card-sub">as of just now</span>
          </div>
          <AttendanceDonut counts={attendance_today} />
          <div className="hrd-legend">
            {Object.entries(attendance_today).filter(([, c]) => c > 0).map(([key, count]) => (
              <div className="hrd-legend-row" key={key}>
                <span className="hrd-legend-swatch" style={{ background: ATTENDANCE_META[key].color }} />
                <span className="hrd-legend-name">{ATTENDANCE_META[key].label}</span>
                <span className="hrd-legend-val">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hrd-bottom-row">
        <div className="hrd-card">
          <div className="hrd-card-head">
            <span className="hrd-card-title">Pending promotions</span>
            <span className="hrd-card-sub">{pending_promotions.length} awaiting approval</span>
          </div>
          {pending_promotions.length === 0 ? (
            <div className="hrd-empty">
              <PartyPopper size={22} />
              <strong>You're all caught up</strong>
              <span>No promotions are waiting for approval.</span>
            </div>
          ) : (
            pending_promotions.map((p, i) => (
              <div className="hrd-list-row" key={i}>
                <span className="hrd-list-icon" style={{ background: "#fff1ea", color: "#e7510c" }}><Award size={15} /></span>
                <div className="hrd-list-text">
                  <div className="hrd-list-title">{p.employee_name}</div>
                  <div className="hrd-list-sub">→ {p.new_designation}</div>
                </div>
                <span className="hrd-list-time">{p.effective_date}</span>
              </div>
            ))
          )}
        </div>

        <div className="hrd-card">
          <div className="hrd-card-head">
            <span className="hrd-card-title">Onboarding pipeline</span>
            <span className="hrd-card-sub">{pipelineTotal} interns</span>
          </div>
          {pipelineTotal === 0 ? (
            <p className="hrd-loading">No interns onboarding right now.</p>
          ) : (
            <div className="hrd-pipeline">
              {Object.entries(onboarding_pipeline).map(([key, count]) => (
                <div className="hrd-pipeline-row" key={key}>
                  <span className="hrd-pipeline-label" style={{ color: PIPELINE_META[key].color }}>{PIPELINE_META[key].label}</span>
                  <div className="hrd-pipeline-bar-track">
                    <div
                      className="hrd-pipeline-bar-fill"
                      style={{ width: `${pipelineTotal ? (count / pipelineTotal) * 100 : 0}%`, background: PIPELINE_META[key].color }}
                    />
                  </div>
                  <span className="hrd-pipeline-count" style={{ background: PIPELINE_META[key].bg, color: PIPELINE_META[key].color }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hrd-card">
          <div className="hrd-card-head">
            <span className="hrd-card-title">Recent activity</span>
            <span className="hrd-card-sub">your notifications</span>
          </div>
          {activity.length === 0 ? (
            <p className="hrd-loading">Nothing yet.</p>
          ) : (
            activity.map((a, i) => (
              <div className="hrd-list-row" key={i}>
                <span className="hrd-list-icon" style={{ background: "#eef3fc", color: "#0a3591" }}><Bell size={15} /></span>
                <div className="hrd-list-text">
                  <div className="hrd-list-title">{a.title}</div>
                  {a.message && <div className="hrd-list-sub">{a.message}</div>}
                </div>
                <span className="hrd-list-time">{timeAgo(a.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default HROverview;
