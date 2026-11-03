import { useEffect, useState } from "react";
import {
  CircleCheck, Clock3, CalendarX, BarChart3, FileText, ChevronRight, Activity, TrendingUp,
  Download, ClipboardCheck, ArrowRight,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import client from "../../../api/client";
import StudentHero from "../components/StudentHero";
import ScoreRing from "../components/ScoreRing";
import "../styles/StudentDashboard.css";
import "../styles/StudentPages.css";
import "../styles/Reports.css";

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
const fmtTime = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

const BAR_COLORS = ["#1d4fb8", "#16a34a", "#2689ef", "#e7510c", "#0fb9cc"];

function Reports() {
  const [tasks, setTasks] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.allSettled([
      client.get("/api/student/assignments/"),
      client.get("/api/student/assessments/"),
      client.get("/api/student/progress/"),
    ]).then(([t, a, p]) => {
      if (t.status === "fulfilled") setTasks(t.value.data);
      if (a.status === "fulfilled") setAssessments(a.value.data);
      if (p.status === "fulfilled") setProgress(p.value.data);
      setLoaded(true);
    });
  }, []);

  const download = async (period) => {
    setDownloading(period);
    setError("");
    try {
      const response = await client.get(`/api/student/reports/${period}/download/`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${period}_zone_report.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to download report.");
    } finally {
      setDownloading(null);
    }
  };

  if (!loaded) return <p className="sd-loading">Loading…</p>;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isPast = (d) => d && new Date(`${d}T00:00:00`) < today;
  const graded = tasks.filter((t) => t.score != null);
  const overall = graded.length
    ? Math.round(graded.reduce((s, t) => s + Number(t.score), 0) / graded.length)
    : null;
  const completedCount = tasks.filter((t) => t.submitted).length;
  const missedCount = tasks.filter((t) => !t.submitted && isPast(t.due_date)).length;
  const pendingCount = tasks.filter((t) => !t.submitted && !isPast(t.due_date)).length;

  const stats = [
    { Icon: CircleCheck, tone: "green", value: completedCount, label: "Completed Assignments" },
    { Icon: Clock3, tone: "orange", value: pendingCount, label: `Pending Assignment${pendingCount === 1 ? "" : "s"}` },
    { Icon: CalendarX, tone: "red", value: missedCount, label: "Missed Deadlines" },
  ];

  const activity = [
    ...tasks.filter((t) => t.submission_date).map((t) => ({
      key: `t${t.student_task_id}`,
      Icon: t.score != null ? CircleCheck : FileText,
      tone: t.score != null ? "green" : "blue",
      title: `${t.title} ${t.score != null ? "completed" : "submitted"}`,
      sub: t.module_name ? `Module ${t.module_no} - ${t.module_name}` : null,
      at: t.submission_date,
    })),
    ...assessments.filter((a) => a.result?.assessed_at).map((a) => ({
      key: `a${a.assessment_id}`,
      Icon: ClipboardCheck,
      tone: "orange",
      title: `${a.name} assessed`,
      sub: `Module ${a.module_no} - ${a.module_name}`,
      at: a.result.assessed_at,
    })),
  ].sort((x, y) => String(y.at).localeCompare(String(x.at)));

  const trend = graded
    .filter((t) => t.submission_date || t.due_date)
    .sort((x, y) => String(x.submission_date || x.due_date).localeCompare(String(y.submission_date || y.due_date)))
    .map((t) => ({
      label: new Date(t.submission_date || `${t.due_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: Number(t.score),
      title: t.title,
    }));

  const modules = (progress?.modules || []);

  return (
    <div className="sd-page rp-page">
      <StudentHero
        eyebrow="Reports"
        title="Your Performance Overview"
        subtitle="Track your learning progress, view your scores and see where you can improve."
      />

      <div className="rp-stats">
        <div className="sp-card rp-stat rp-ring" style={{ "--delay": "0.06s" }}>
          <ScoreRing percent={overall} size={96} stroke={11} caption="Overall Score" />
          <p className="rp-stat-label">Overall Score</p>
        </div>
        {stats.map(({ Icon, tone, value, label }, i) => (
          <div key={label} className="sp-card rp-stat" style={{ "--delay": `${0.1 + i * 0.05}s` }}>
            <span className={`rp-stat-icon ${tone}`}><Icon size={18} /></span>
            <p className="rp-stat-value">{value}</p>
            <p className="rp-stat-label">{label}</p>
          </div>
        ))}
      </div>

      <div className="sp-card" style={{ "--delay": "0.2s" }}>
        <p className="sp-card-title"><span className="sd-panel-icon"><BarChart3 size={15} /></span>Module-wise Performance</p>
        {modules.length === 0 ? (
          <p className="sd-empty">No modules have been set up for this course yet.</p>
        ) : (
          <div className="rp-modules">
            {modules.map((m, i) => (
              <div key={m.module_id} className="rp-module" style={{ "--i": i }}>
                <span className={`sp-row-icon small sp-soft-${i % 4}`}><FileText size={15} /></span>
                <div className="rp-module-body">
                  <p className="rp-module-name">Module {m.module_no} - {m.module_name}</p>
                  <div className="sp-bar">
                    <span style={{ width: `${m.average_score ?? 0}%`, background: BAR_COLORS[i % BAR_COLORS.length], "--i": i }} />
                  </div>
                </div>
                <p className="rp-module-pct">{m.average_score != null ? `${m.average_score}%` : "—"}</p>
                <ChevronRight size={15} className="pg-chevron" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rp-bottom">
        <div className="sp-card" style={{ "--delay": "0.26s" }}>
          <p className="sp-card-title">
            <span className="sd-panel-icon"><Activity size={15} /></span>Recent Activity
            {activity.length > 4 && (
              <button type="button" className="sp-link" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show Less" : "View All"} <ArrowRight size={13} />
              </button>
            )}
          </p>
          {activity.length === 0 ? (
            <p className="sd-empty">No activity yet — submissions and graded work will appear here.</p>
          ) : (
            <div className="rp-activity">
              {(showAll ? activity : activity.slice(0, 4)).map(({ key, Icon, tone, title, sub, at }, i) => (
                <div key={key} className="rp-act" style={{ "--i": i }}>
                  <span className={`rp-stat-icon small ${tone}`}><Icon size={14} /></span>
                  <div className="rp-act-body">
                    <p className="rp-act-title">{title}</p>
                    {sub && <p className="rp-act-sub">{sub}</p>}
                  </div>
                  <div className="rp-act-when">
                    <p>{fmtDate(at)}</p>
                    <p>{fmtTime(at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sp-card" style={{ "--delay": "0.3s" }}>
          <p className="sp-card-title"><span className="sd-panel-icon"><TrendingUp size={15} /></span>Performance Trend</p>
          {trend.length < 2 ? (
            <p className="sd-empty">Your trend appears once at least two assignments are graded.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="rp-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2689ef" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2689ef" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e9f4" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7b88a6" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#7b88a6" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e3e9f4" }}
                  formatter={(v, _, p) => [`${v} / 100`, p.payload.title]}
                />
                <Area type="monotone" dataKey="score" stroke="#1d4fb8" strokeWidth={2.5} fill="url(#rp-trend)"
                  dot={{ r: 4, fill: "#1d4fb8", strokeWidth: 0 }} activeDot={{ r: 6 }} animationDuration={1200} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="sp-card rp-download" style={{ "--delay": "0.34s" }}>
        <div>
          <p className="sp-card-title"><span className="sd-panel-icon"><Download size={15} /></span>Batch Performance Reports</p>
          <p className="rp-download-text">Download your batch's zone report — attendance, task completion, and zone status.</p>
        </div>
        <div className="rp-download-actions">
          <button type="button" onClick={() => download("weekly")} disabled={downloading !== null} className="sp-btn sp-btn-orange">
            {downloading === "weekly" ? "Downloading…" : "Weekly Report"}
          </button>
          <button type="button" onClick={() => download("monthly")} disabled={downloading !== null} className="sp-btn sp-btn-navy">
            {downloading === "monthly" ? "Downloading…" : "Monthly Report"}
          </button>
        </div>
        {error && <p className="rp-error">{error}</p>}
      </div>
    </div>
  );
}

export default Reports;
