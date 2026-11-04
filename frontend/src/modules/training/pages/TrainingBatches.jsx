import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays, Download, GraduationCap, Rocket, UserRoundCheck, ClipboardList, Search, ChevronDown,
  Users, BookOpen, Flag, ClipboardCheck, ArrowRight, Activity, Radio,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/TrainerDashboard.css";
import "../styles/TrainingBatches.css";

const TABS = [
  { key: "all", label: "All Assigned" },
  { key: "active", label: "Active In-Session" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

function phaseOf(b, today) {
  if (!b.is_active) return "completed";
  if (new Date(b.start_date) > today || /PLANNED|UPCOMING/i.test(b.status || "")) return "upcoming";
  return "active";
}

function downloadSchedule(rows) {
  const head = ["Batch code", "Batch", "Course", "Status", "Start", "End", "Enrolled", "Capacity", "Progress %", "Attendance % (30d)", "Topics logged"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.join(",")].concat(rows.map((b) => [
    b.batch_code, b.batch_name, b.course_name, b.status, b.start_date, b.end_date, b.students_enrolled,
    b.capacity, b.progress, b.attendance_rate, b.topics_logged,
  ].map(esc).join(",")));
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `batch-schedule-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TrainingBatches() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("start");
  const [today] = useState(() => new Date());

  useEffect(() => {
    client.get("/api/training/trainer/overview/")
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your batches."));
  }, []);

  const all = useMemo(() => data?.all_batches || [], [data]);
  const counts = useMemo(() => {
    const c = { all: all.length, active: 0, upcoming: 0, completed: 0 };
    all.forEach((b) => { c[phaseOf(b, today)] += 1; });
    return c;
  }, [all, today]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = all.filter((b) =>
      (tab === "all" || phaseOf(b, today) === tab) &&
      (!q || [b.batch_code, b.batch_name, b.course_name].some((v) => (v || "").toLowerCase().includes(q))));
    const key = { start: (b) => b.start_date, progress: (b) => -(b.progress ?? -1), enrolled: (b) => -b.students_enrolled }[sort];
    return [...rows].sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0));
  }, [all, tab, search, sort, today]);

  if (error) return <p className="bp-error">{error}</p>;
  if (!data) return <p className="bp-loading">Loading…</p>;

  const active = data.batches;
  const withProgress = active.filter((b) => b.progress != null);
  const avgProgress = withProgress.length ? Math.round(withProgress.reduce((s, b) => s + b.progress, 0) / withProgress.length) : null;
  const rates = active.map((b) => b.attendance_rate).filter((r) => r != null);
  const avgAttendance = rates.length ? Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 10) / 10 : null;
  const pendingToday = active.filter((b) => !b.attendance_marked_today).length;

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Trainer Workspace / <span>Training Batches</span></p>
          <h1 className="bp-title">Assigned Training Batches &amp; Cohorts</h1>
          <p className="bp-sub">Manage curriculum delivery, trainee attendance rosters, topic pacing and batch timelines across your cohorts.</p>
        </div>
        <div className="bp-actions">
          <button type="button" className="bp-btn outline" onClick={() => downloadSchedule(all)} disabled={!all.length}>
            <Download size={16} /> Export Batch Schedule
          </button>
        </div>
      </div>

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label tb-label">ACTIVE ASSIGNED BATCHES</p>
            <span className="tb-stat-icon navy"><GraduationCap size={20} /></span>
          </div>
          <p className="bp-stat-value">{active.length} <small className="tb-unit">Running</small></p>
          <p className="tr-stat-sub">{data.stats.active_trainees} trainees across {active.length} cohorts</p>
          <p className="tb-foot"><span className="bp-chip green"><Radio size={12} /> {counts.active} in session</span> <span>{counts.upcoming} upcoming</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label tb-label">OVERALL CURRICULUM PACE</p>
            <span className="tb-stat-icon green"><Rocket size={20} /></span>
          </div>
          <p className="bp-stat-value">{avgProgress != null ? `${avgProgress}%` : "—"}</p>
          <p className="tr-stat-sub">Average time elapsed across active batches</p>
          <p className="tb-foot"><span className="bp-chip green">{active.reduce((s, b) => s + b.topics_logged, 0)} topics</span> <span>logged so far</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label tb-label">AVERAGE BATCH ATTENDANCE</p>
            <span className="tb-stat-icon blue"><UserRoundCheck size={20} /></span>
          </div>
          <p className="bp-stat-value">{avgAttendance != null ? `${avgAttendance}%` : "—"}</p>
          <p className="tr-stat-sub">Last 30 days, all active cohorts</p>
          <p className="tb-foot"><span className="bp-chip blue">{rates.length} of {active.length}</span> <span>batches with attendance</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label tb-label">ATTENDANCE PENDING TODAY</p>
            <span className="tb-stat-icon orange"><ClipboardList size={20} /></span>
          </div>
          <p className="bp-stat-value tr-orange">{pendingToday} <small className="tb-unit">Batches</small></p>
          <p className="tr-stat-sub">Not yet marked for {today.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
          <p className="tb-foot"><Link to="/training/attendance" className="bp-chip orange">Mark now</Link></p>
        </div>
      </div>

      <div className="bp-panel tb-toolbar">
        <div className="bp-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`bp-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label} <small>({counts[t.key]})</small>
            </button>
          ))}
        </div>
        <div className="tb-toolbar-right">
          <label className="bp-search">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter batch code or course…" />
          </label>
          <label className="bp-select">
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="start">Sort: Start date</option>
              <option value="progress">Sort: Pacing</option>
              <option value="enrolled">Sort: Enrolled</option>
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="bp-panel tb-empty">No batches in this view.</p>
      ) : (
        <div className="tb-grid">
          {visible.map((b, i) => {
            const phase = phaseOf(b, today);
            return (
              <article key={b.batch_id} className={`tb-card ${phase}`} style={{ "--i": i % 9 }}>
                <div className="tb-card-top">
                  <span className={`tb-status ${phase}`}>
                    <CalendarDays size={13} />
                    {phase === "active" ? (b.attendance_marked_today ? "In session · marked today" : "In session today")
                      : phase === "upcoming" ? `Starts ${fmt(b.start_date)}` : "Completed"}
                  </span>
                  <span className="tb-track"><small>CODE</small>{b.batch_code}</span>
                </div>
                <h3>{b.batch_name}</h3>
                <p className="tb-course">{b.course_name}</p>

                <div className="tb-banner">
                  <span><Users size={14} /> {b.students_enrolled} Enrolled{b.capacity ? ` / ${b.capacity} seats` : ""}</span>
                  <span><Activity size={14} /> {b.attendance_rate != null ? `${b.attendance_rate}% attendance` : "No attendance yet"}</span>
                </div>

                <div className="tb-progress-row">
                  <span>Curriculum Completion</span>
                  <b>{b.progress != null ? `${b.progress}%` : "—"}</b>
                </div>
                <div className={`tr-progress thin ${phase === "upcoming" ? "warm" : ""}`}><span style={{ width: `${b.progress ?? 0}%` }} /></div>

                <div className="tb-facts">
                  <div><small>STARTS</small><b>{fmt(b.start_date)}</b></div>
                  <div><small>ENDS</small><b>{fmt(b.end_date)}</b></div>
                </div>

                <p className="tb-line"><BookOpen size={14} /><span><small>LATEST TOPIC</small>{b.latest_topic || "No topic logged yet"}</span></p>
                <p className="tb-line warm"><Flag size={14} /><span><small>TOPICS LOGGED</small>{b.topics_logged} so far</span></p>

                <Link to={`/training/batches/${b.batch_id}`} className={`tb-primary ${phase === "active" ? "orange" : ""}`}>
                  Open Batch Workspace <ArrowRight size={15} />
                </Link>
                <div className="tb-actions">
                  <Link to={`/training/batches/${b.batch_id}`} className="tb-chip-btn"><Users size={14} /> View Roster</Link>
                  <Link to="/training/attendance" className="tb-chip-btn"><ClipboardCheck size={14} /> Take Attendance</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {active.length > 0 && (
        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <h3><Activity size={18} /> Curriculum Delivery Velocity &amp; Timeline</h3>
              <p>Time elapsed against each active batch's planned duration</p>
            </div>
            <span className="bp-chip green">{active.filter((b) => (b.progress ?? 0) < 100).length} on schedule</span>
          </div>
          <div className="tb-timeline">
            {active.map((b) => (
              <div key={b.batch_id} className="tb-tl-row">
                <span className="tb-tl-name"><b>{b.batch_code}</b><small>{b.course_name}</small></span>
                <div className="tb-tl-track">
                  <span className="tb-tl-fill" style={{ width: `${b.progress ?? 0}%` }} />
                  <i className="tb-tl-dot" style={{ left: `${Math.min(b.progress ?? 0, 100)}%` }} />
                </div>
                <b className="tb-tl-pct">{b.progress != null ? `${b.progress}%` : "—"}</b>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
