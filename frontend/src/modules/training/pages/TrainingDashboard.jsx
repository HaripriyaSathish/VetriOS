import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays, ClipboardCheck, Radio, MonitorPlay, ArrowRight, Presentation, Timer, FileCheck2,
  UserRoundCheck, TrendingUp, TrendingDown, CalendarClock, Users, BookOpenCheck, Fingerprint,
  LogIn, LogOut, FilePenLine, Rocket, Gauge, MessageCircleQuestion, Reply, CheckCircle2,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/TrainerDashboard.css";

const SHIFT_HOURS = 8;
const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function greetingFor(date) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function agoOf(iso, now) {
  const mins = Math.max(0, Math.round((now - new Date(iso)) / 60000));
  if (mins < 60) return `${mins} mins ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} hr ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");

function velocityTone(progress) {
  if (progress == null) return { label: "No dates", tone: "gray" };
  if (progress >= 100) return { label: "Past end date", tone: "orange" };
  if (progress >= 75) return { label: "Final stretch", tone: "blue" };
  return { label: "On Track", tone: "green" };
}

function TrainingDashboard() {
  const [data, setData] = useState(null);
  const [shift, setShift] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [punching, setPunching] = useState(false);
  const [punchError, setPunchError] = useState("");

  const loadShift = () =>
    client.get("/api/hr/attendance/me/").then(({ data: d }) => setShift(d)).catch(() => setShift(null));

  useEffect(() => {
    client.get("/api/training/trainer/overview/")
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your training dashboard."))
      .finally(() => setLoading(false));
    loadShift();
    const tick = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(tick);
  }, []);

  const handlePunch = async () => {
    setPunching(true);
    setPunchError("");
    try {
      await client.post(shift?.today?.checked_in ? "/api/hr/attendance/check-out/" : "/api/hr/attendance/check-in/");
      await loadShift();
    } catch (err) {
      setPunchError(err.response?.data?.detail || "Something went wrong.");
    } finally {
      setPunching(false);
    }
  };

  if (loading) return <p className="bp-loading">Loading…</p>;
  if (error) return <p className="bp-error">{error}</p>;

  const { stats, batches, recent_messages: messages } = data;
  const firstName = (data.full_name || "").split(" ")[0] || "Trainer";
  const focus = batches.find((b) => !b.attendance_marked_today) || batches[0];
  const delta = stats.attendance_rate != null && stats.attendance_rate_prev != null
    ? Math.round((stats.attendance_rate - stats.attendance_rate_prev) * 10) / 10
    : null;

  const today = shift?.today;
  const checkedIn = !!today?.checked_in;
  const checkedOut = !!today?.checked_out;
  const workedHrs = today?.check_in_time
    ? ((today.check_out_time ? new Date(today.check_out_time) : now) - new Date(today.check_in_time)) / 3600000
    : 0;
  const shiftPct = Math.min(100, Math.round((workedHrs / SHIFT_HOURS) * 100));
  const hrsLabel = (h) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Trainer Workspace &gt; <span>My Dashboard</span></p>
          <div className="tr-title-row">
            <h1 className="bp-title">Trainer Overview</h1>
            <span className="tr-date"><CalendarDays size={14} /> {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>
        <div className="bp-actions">
          <Link to="/training/attendance" className="bp-btn outline"><ClipboardCheck size={16} /> Mark Quick Attendance</Link>
          <Link to="/training/messages" className="bp-btn navy"><Radio size={16} /> Open Messages</Link>
        </div>
      </div>

      {/* ---------- Hero ---------- */}
      <section className="tr-hero">
        <div className="tr-hero-text">
          <span className="tr-alert"><i /> {focus ? (focus.attendance_marked_today ? "Attendance marked today" : "Attendance not marked yet today") : "No active batches"}</span>
          <h2>
            {greetingFor(now)}, {firstName}!{" "}
            {focus ? <>{focus.batch_name} is your focus for today.</> : <>You have no active batches right now.</>}
          </h2>
          <p>
            {focus ? `${focus.students_enrolled} students enrolled` : `${stats.active_batches} active batches`}
            {", "}
            {stats.unread_messages} {stats.unread_messages === 1 ? "message" : "messages"} waiting in Messages.
          </p>
        </div>
        {focus && (
          <div className="tr-hero-actions">
            <Link to="/training/attendance" className="bp-btn orange"><MonitorPlay size={16} /> Mark Attendance</Link>
            <Link to={`/training/batches/${focus.batch_id}`} className="tr-hero-ghost">View {focus.batch_code} <ArrowRight size={15} /></Link>
          </div>
        )}
      </section>

      {/* ---------- Stats ---------- */}
      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Active Batches</p>
            <span className="tr-stat-icon blue"><Presentation size={20} /></span>
          </div>
          <p className="bp-stat-value">{stats.active_batches} Running</p>
          <p className="tr-stat-sub">{stats.active_trainees} trainees actively enrolled</p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Topics Taught Today</p>
            <span className="tr-stat-icon orange"><Timer size={20} /></span>
          </div>
          <p className="bp-stat-value">{stats.topics_today}</p>
          <p className="tr-stat-sub">Logged across {stats.batches_taught_today} {stats.batches_taught_today === 1 ? "batch" : "batches"}</p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Pending Assignments</p>
            <span className="tr-stat-icon green"><FileCheck2 size={20} /></span>
          </div>
          <p className="bp-stat-value">{stats.pending_reviews} Reviews</p>
          <p className="tr-stat-sub">Submitted, waiting for a score</p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Student Attendance Ratio</p>
            <span className="tr-stat-icon blue"><UserRoundCheck size={20} /></span>
          </div>
          <p className="bp-stat-value">
            {stats.attendance_rate != null ? `${stats.attendance_rate}%` : "—"}
            {delta != null && (
              <span className={`bp-chip ${delta >= 0 ? "green" : "red"}`}>
                {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {delta >= 0 ? "+" : ""}{delta}%
              </span>
            )}
          </p>
          <p className="tr-stat-sub">{stats.attendance_rate != null ? "Last 30 days vs the 30 before" : "No attendance marked in 30 days"}</p>
        </div>
      </div>

      <div className="tr-grid">
        <div className="tr-col">
          {/* ---------- Batches ---------- */}
          <section className="bp-panel tr-card" id="batches">
            <div className="tr-card-head">
              <div>
                <h3><CalendarClock size={18} /> Today's Batches &amp; Sessions</h3>
                <p>Attendance and topic status for each of your active batches</p>
              </div>
              <span className="bp-chip blue">{batches.length} {batches.length === 1 ? "Batch" : "Batches"}</span>
            </div>
            <div className="tr-sessions">
              {batches.length === 0 && <p className="tr-empty">No active batches assigned yet.</p>}
              {batches.map((b) => (
                <article key={b.batch_id} className="tr-session">
                  <div className="tr-session-top">
                    <span className="tr-session-tags">
                      {b.attendance_marked_today ? (
                        <span className="bp-chip green"><CheckCircle2 size={12} /> Attendance marked</span>
                      ) : (
                        <span className="bp-chip orange"><i className="tr-live-dot" /> Attendance pending</span>
                      )}
                      <b>{b.batch_code}</b>
                    </span>
                    <span className="tr-session-time"><CalendarDays size={14} /> Since {new Date(b.start_date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                  </div>
                  <h4>{b.course_name}</h4>
                  <p className="tr-topic">Topic: {b.today_topic || b.latest_topic || "No topic logged yet"}</p>
                  <div className="tr-session-foot">
                    <span className="tr-session-meta">
                      <span><Users size={14} /> {b.students_enrolled} Enrolled</span>
                      <span><BookOpenCheck size={14} /> {b.topics_logged} topics logged</span>
                    </span>
                    {b.attendance_marked_today ? (
                      <Link to={`/training/batches/${b.batch_id}`} className="bp-btn outline small"><ArrowRight size={13} /> Open Batch</Link>
                    ) : (
                      <Link to="/training/attendance" className="bp-btn navy small"><ClipboardCheck size={13} /> Mark Attendance</Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ---------- Student queries ---------- */}
          <section className="bp-panel tr-card">
            <div className="tr-card-head">
              <h3><MessageCircleQuestion size={18} className="tr-orange" /> Recent Student Queries</h3>
              <Link to="/training/messages" className="tr-link">View All ({stats.unread_messages} unread)</Link>
            </div>
            <div className="tr-queries">
              {messages.length === 0 && <p className="tr-empty">No messages from students yet.</p>}
              {messages.map((m, i) => (
                <article key={m.message_id} className={`tr-query ${m.is_read ? "" : "unread"}`}>
                  <span className={`bp-avatar t${i % 4}`}>{initialsOf(m.sender_name)}</span>
                  <div className="tr-query-body">
                    <div className="tr-query-top">
                      <span><b>{m.sender_name}</b>{m.batch_code && <span className="bp-chip blue">{m.batch_code}</span>}</span>
                      <time>{agoOf(m.created_at, now)}</time>
                    </div>
                    <p>"{m.content}"</p>
                    <div className="tr-query-foot">
                      <span>{m.category === "doubt" ? "Doubt" : m.category === "leave" ? "Leave request" : "General"}</span>
                      <Link to="/training/messages" className="tr-reply"><Reply size={13} /> Reply</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="tr-col">
          {/* ---------- Shift & punch ---------- */}
          <section className="bp-panel tr-card">
            <div className="tr-card-head">
              <h3><Fingerprint size={18} /> Today's Shift &amp; Punch</h3>
              {shift?.employee_id && (
                <span className={`bp-chip ${checkedOut ? "gray" : checkedIn ? "green" : "orange"}`}>
                  {checkedOut ? "Punched Out" : checkedIn ? "Punched In" : "Not Punched"}
                </span>
              )}
            </div>
            {!shift?.employee_id ? (
              <p className="tr-empty">No employee record is linked to this login, so punching isn't available.</p>
            ) : (
              <>
                <div className="tr-shift">
                  <div className="tr-shift-top">
                    <div>
                      <p className="tr-mini">Current Time</p>
                      <p className="tr-clock">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      <p className="tr-shift-date">{now.toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}</p>
                    </div>
                    <div className="tr-shift-right">
                      <p className="tr-mini">Status</p>
                      <b>{today?.status || "—"}</b>
                      <span>Target {SHIFT_HOURS}h 00m</span>
                    </div>
                  </div>
                  <div className="tr-punch-row">
                    <span><LogIn size={14} /> {checkedIn ? `Punched in at ${timeOf(today.check_in_time)}` : "Not punched in yet"}</span>
                    {checkedOut && <span className="bp-chip gray">Out {timeOf(today.check_out_time)}</span>}
                  </div>
                  <div className="tr-progress-head">
                    <span>Shift Progress: {hrsLabel(workedHrs)}</span>
                    <span>Target: {SHIFT_HOURS}h 00m</span>
                  </div>
                  <div className="tr-progress"><span style={{ width: `${shiftPct}%` }} /></div>
                  <div className="tr-progress-foot">
                    <span>{workedHrs < SHIFT_HOURS ? `${hrsLabel(SHIFT_HOURS - workedHrs)} remaining until standard checkout` : "Standard hours complete"}</span>
                    <b>{shiftPct}% Completed</b>
                  </div>
                </div>
                {punchError && <p className="bp-form-error">{punchError}</p>}
                <div className="tr-shift-actions">
                  <Link to="/my/attendance" className="bp-btn soft"><FilePenLine size={15} /> Regularize Punch</Link>
                  {!checkedOut && (
                    <button type="button" className={`bp-btn ${checkedIn ? "tr-danger" : "navy"}`} onClick={handlePunch} disabled={punching}>
                      {checkedIn ? <LogOut size={15} /> : <LogIn size={15} />} {punching ? "Working…" : checkedIn ? "Check Out" : "Check In"}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>

          {/* ---------- Curriculum velocity ---------- */}
          <section className="bp-panel tr-card">
            <div className="tr-card-head">
              <h3><Rocket size={18} /> Curriculum Velocity</h3>
            </div>
            <div className="tr-velocity">
              {batches.length === 0 && <p className="tr-empty">No active batches.</p>}
              {batches.map((b) => {
                const v = velocityTone(b.progress);
                return (
                  <div key={b.batch_id} className="tr-vel-row">
                    <div className="tr-vel-top">
                      <span><b>{b.batch_code} · {b.course_name}</b> <span className={`bp-chip ${v.tone}`}>{v.label}</span></span>
                      <b className={v.tone === "orange" ? "tr-orange" : ""}>{b.progress != null ? `${b.progress}%` : "—"}</b>
                    </div>
                    <div className={`tr-progress thin ${v.tone === "orange" ? "warm" : ""}`}><span style={{ width: `${b.progress ?? 0}%` }} /></div>
                    <div className="tr-vel-foot">
                      <span>{b.topics_logged} topics logged</span>
                      <span>{b.end_date ? `Ends ${new Date(b.end_date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : "Course duration"}</span>
                    </div>
                  </div>
                );
              })}
              {batches.length > 0 && (
                <div className="tr-vel-sum">
                  <Gauge size={16} />
                  <span>Average progress: {Math.round(batches.reduce((s, b) => s + (b.progress ?? 0), 0) / batches.length)}%</span>
                  <Link to="/training/reports">Reports</Link>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default TrainingDashboard;
