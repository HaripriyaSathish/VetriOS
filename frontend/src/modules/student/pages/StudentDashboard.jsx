import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  ClipboardIcon, SparkleIcon, HeroExtras, WarningIcon, EnvelopeIcon, CalendarIllustration,
} from "../../../components/FigmaIcons";
import client from "../../../api/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { figmaImage } from "../../../assets/figmaImages";
import LoginIllustration from "../../identity-access/components/LoginIllustration";
import "../styles/StudentDashboard.css";

const ATTENDANCE_COLOR = { PRESENT: "url(#sd-bar-present)", ABSENT: "url(#sd-bar-absent)" };

// Animates a number from 0 up to `target` once it's known.
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (typeof target !== "number") return undefined;
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return typeof target === "number" ? value : target;
}

// Attendance range options for the chart's "Last N Days" picker.
const RANGES = [
  { key: "10", label: "Last 10 Days", count: 10 },
  { key: "30", label: "Last 30 Days", count: 30 },
  { key: "all", label: "All Days", count: Infinity },
];

function ProgressRing({ percent }) {
  const size = 110, stroke = 11, radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = useCountUp(percent);
  const offset = percent == null ? circumference : circumference - (shown / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="sd-ring sd-ring-mid">
      <circle className="sd-ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
      <circle className="sd-ring-value" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none"
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="sd-ring-text">
        {percent != null ? `${shown}%` : "—"}
      </text>
    </svg>
  );
}

function StatCard({ label, value, tone, accent, icon, delay }) {
  const shown = useCountUp(value);
  return (
    <div className={`sd-card sd-card-${accent}`} style={{ "--delay": delay }}>
      <span className="sd-card-blob" aria-hidden="true" />
      {icon && <span className="sd-card-icon">{icon}</span>}
      <p className={`sd-card-value sd-tone-${tone}`}>{shown}</p>
      <p className="sd-card-label">{label}</p>
    </div>
  );
}

function Dashboard() {
  const [dash, setDash] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [rangeKey, setRangeKey] = useState("10");

  useEffect(() => {
    Promise.all([
      client.get("/api/student/dashboard/"),
      client.get("/api/student/attendance/"),
    ]).then(([d, a]) => { setDash(d.data); setAttendance(a.data); }).catch(() => {});
  }, []);

  if (!dash) return <p className="sd-loading">Loading your dashboard…</p>;

  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[0];
  const chartData = [...attendance].slice(0, range.count).reverse().map((r) => ({
    date: r.attendance_date?.slice(5), value: 1, status: r.attendance_status,
  }));

  const heroImage = figmaImage("hero-student");
  const sparkleImage = figmaImage("welcome-sparkle");
  const pendingImage = figmaImage("stat-pending-tasks");

  return (
    <div className="sd-page">
      <section className="sd-hero">
        <span className="sd-hero-shine" aria-hidden="true" />
        <span className="sd-hero-blob blob-a" aria-hidden="true" />
        <span className="sd-hero-blob blob-b" aria-hidden="true" />

        <div className="sd-hero-text">
          <p className="sd-hero-eyebrow">
            <span className="sd-hero-line" aria-hidden="true" />
            Welcome back!
            {sparkleImage ? <img src={sparkleImage} alt="" /> : <SparkleIcon size={18} />}
          </p>
          <h1 className="sd-hero-title">
            You're enrolled in {dash.batch_name}, trained by {dash.trainer_name || "an unassigned trainer"}.
          </h1>
          <p className="sd-hero-sub">
            Keep learning, keep growing! Your Journey to success is just a step away.
          </p>
        </div>

        <div className="sd-hero-art" aria-hidden="true">
          {heroImage ? (
            <img src={heroImage} alt="" />
          ) : (
            <>
              <LoginIllustration />
              <HeroExtras />
            </>
          )}
        </div>
      </section>

      <div className="sd-stats">
        <div className="sd-card sd-card-orange sd-card-ring" style={{ "--delay": "0.05s" }}>
          <span className="sd-card-blob" aria-hidden="true" />
          <ProgressRing percent={dash.course_completion_percent} />
          <p className="sd-ring-label">Course<br />Completion</p>
        </div>
        <StatCard
          label="Pending Tasks"
          value={dash.pending_tasks_count}
          tone="gray"
          accent="blue"
          delay="0.12s"
          icon={pendingImage ? <img src={pendingImage} alt="" /> : <ClipboardIcon clock size={40} />}
        />
        <StatCard
          label="Overdue"
          value={dash.overdue_tasks_count}
          tone={dash.overdue_tasks_count > 0 ? "red" : "gray"}
          accent="orange"
          delay="0.19s"
          icon={<WarningIcon size={40} />}
        />
        <StatCard
          label="Unread Messages"
          value={dash.unread_messages}
          tone="gray"
          accent="blue"
          delay="0.26s"
          icon={<EnvelopeIcon size={40} />}
        />
      </div>

      <div className="sd-panel">
        <div className="sd-panel-head">
          <p className="sd-panel-title">
            <span className="sd-panel-icon"><CalendarDays size={16} /></span>
            Attendance — {range.label}
            {dash.attendance_percent != null && (
              <span className="sd-panel-chip">{dash.attendance_percent}% present</span>
            )}
          </p>
          <label className="sd-range">
            <CalendarDays size={14} />
            <select value={rangeKey} onChange={(e) => setRangeKey(e.target.value)} aria-label="Attendance range">
              {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
        </div>
        <div className="sd-chart-row">
        <div className="sd-chart">
        {chartData.length === 0 ? (
          <p className="sd-empty">No attendance data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="sd-bar-present" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2689ef" />
                  <stop offset="100%" stopColor="#002673" />
                </linearGradient>
                <linearGradient id="sd-bar-absent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff8a4c" />
                  <stop offset="100%" stopColor="#e7510c" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e9f4" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#7b88a6" }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, 1]} />
              <Tooltip
                cursor={{ fill: "rgba(0, 38, 115, 0.05)" }}
                contentStyle={{ borderRadius: 12, border: "1px solid #e3e9f4", boxShadow: "0 10px 30px -12px rgba(0,38,115,.25)" }}
                formatter={(_, __, props) => [props.payload.status, "Status"]}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={28} animationDuration={900}>
                {chartData.map((d, i) => <Cell key={i} fill={ATTENDANCE_COLOR[d.status] || "#c9d6ef"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        </div>
        <div className="sd-chart-art" aria-hidden="true">
          <CalendarIllustration />
        </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
