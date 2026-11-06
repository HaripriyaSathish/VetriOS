import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Rocket, GitBranch, Gauge, ListTodo, ShieldCheck, Bug, Flag, Clock3, CircleCheck, LogIn, LogOut,
  CalendarDays, BadgeCheck, Send, Plus, IdCard, MessageSquare, Columns3, ArrowRight,
} from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/InternPages.css";

const TODO = ["PENDING", "TODO", "NEEDS_FIXES"];
const DOING = ["SUBMITTED", "IN_PROGRESS", "IN_REVIEW", "REVIEW"];
const DONE = ["COMPLETED", "DONE"];

const taskStatus = (t) => (t.status || (t.submitted ? "SUBMITTED" : "PENDING")).toUpperCase();
const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");

function dueLabel(d, today) {
  if (!d) return null;
  const days = Math.round((new Date(d) - today) / 86400000);
  if (days < 0) return { text: `Overdue ${-days}d`, warm: true };
  if (days === 0) return { text: "Due today", warm: true };
  if (days === 1) return { text: "Due tomorrow", warm: true };
  return { text: `In ${days} days`, warm: false };
}

export default function InternDashboard() {
  const [me, setMe] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [projects, setProjects] = useState([]);
  const [reports, setReports] = useState([]);
  const [thread, setThread] = useState([]);
  const [shift, setShift] = useState(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [punching, setPunching] = useState(false);
  const [punchError, setPunchError] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sentNote, setSentNote] = useState("");

  const loadShift = () =>
    client.get("/api/hr/attendance/me/").then(({ data }) => setShift(data)).catch(() => setShift(null));
  const loadThread = () =>
    client.get("/api/interns/me/ask-lead/").then(({ data }) => setThread(data)).catch(() => setThread([]));

  useEffect(() => {
    const get = (url) => client.get(url).then((r) => r.data);
    Promise.allSettled([
      get("/api/interns/me/"),
      get("/api/interns/me/tasks/"),
      get("/api/projects/my-tasks/"),
      get("/api/interns/me/attendance/"),
      get("/api/interns/me/performance/"),
      get("/api/interns/me/project/"),
      get("/api/interns/me/testing-reports/"),
    ]).then(([m, it, kt, at, pf, pj, tr]) => {
      if (m.status === "fulfilled") setMe(m.value);
      else setError(m.reason?.response?.data?.detail || "Couldn't load your internship details.");
      const internTasks = it.status === "fulfilled" ? it.value.map((t) => ({ ...t, key: `i${t.intern_task_id}`, kind: "Intern task" })) : [];
      const kanban = kt.status === "fulfilled" ? kt.value.map((t) => ({ ...t, title: t.title || t.task_title, key: `k${t.task_id}`, kind: "Project task" })) : [];
      setTasks([...internTasks, ...kanban]);
      if (at.status === "fulfilled") setAttendance(at.value);
      if (pf.status === "fulfilled") setReviews(pf.value);
      if (pj.status === "fulfilled") setProjects(pj.value);
      if (tr.status === "fulfilled") setReports(tr.value);
    });
    loadShift();
    loadThread();
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const columns = useMemo(() => ({
    todo: tasks.filter((t) => TODO.includes(taskStatus(t))),
    doing: tasks.filter((t) => DOING.includes(taskStatus(t))),
    done: tasks.filter((t) => DONE.includes(taskStatus(t))),
  }), [tasks]);

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

  const sendMessage = async () => {
    if (!message.trim()) return;
    setSending(true);
    setSentNote("");
    try {
      await client.post("/api/interns/me/ask-lead/", { content: message.trim() });
      setMessage("");
      setSentNote("Sent to your project lead.");
      loadThread();
    } catch (err) {
      setSentNote(err.response?.data?.detail || "Couldn't send message.");
    } finally {
      setSending(false);
    }
  };

  if (error && !me) return <p className="bp-error">{error}</p>;
  if (!me) return <p className="bp-loading">Loading…</p>;

  const user = JSON.parse(localStorage.getItem("user") || "null");
  const firstName = (user?.full_name || "").split(" ")[0] || "there";
  const start = me.internship_start_date ? new Date(me.internship_start_date) : null;
  const end = me.internship_end_date ? new Date(me.internship_end_date) : null;
  const week = start ? Math.max(1, Math.ceil((now - start) / (7 * 86400000))) : null;
  const progress = start && end && end > start ? Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100))) : null;
  const weekAhead = new Date(now);
  weekAhead.setDate(now.getDate() + 7);
  const dueThisWeek = tasks.filter((t) => t.due_date && !DONE.includes(taskStatus(t)) && new Date(t.due_date) <= weekAhead).length;
  const project = projects[0];
  const latest = reviews[0];
  const approved = reports.filter((r) => r.status === "APPROVED").length;
  const todayStr = now.toISOString().slice(0, 10);
  const todayRecord = attendance?.records?.find((r) => r.date === todayStr);
  const hrToday = shift?.today;
  const hasEmployee = !!shift?.employee_id;
  const lastLeadMsg = [...thread].reverse().find((m) => m.sender !== user?.user_id);

  const pillars = latest ? [
    { label: "Technical", value: latest.technical_score },
    { label: "Communication", value: latest.communication_score },
    { label: "Teamwork", value: latest.teamwork_score },
    { label: "Problem Solving", value: latest.problem_solving_score },
  ].filter((p) => p.value != null) : [];

  const column = (title, dot, list) => (
    <div className="in-col">
      <div className="in-col-head"><span><i className={dot} /> {title}</span><b>{list.length}</b></div>
      {list.length === 0 ? <p className="in-col-empty">Nothing here</p> : list.slice(0, 4).map((t) => {
        const st = taskStatus(t);
        const due = dueLabel(t.due_date, now);
        return (
          <div key={t.key} className={`in-task ${DONE.includes(st) ? "done" : ""}`}>
            <div className="in-task-top">
              <small>{t.kind}</small>
              {st === "NEEDS_FIXES" && <span className="bp-chip red">Needs fixes</span>}
              {DONE.includes(st) && <span className="bp-chip green">Completed</span>}
              {DOING.includes(st) && <span className="bp-chip blue">{st === "SUBMITTED" ? "In Review" : "In Progress"}</span>}
            </div>
            <p className="in-task-title">{t.title}</p>
            <p className={`in-task-due ${due?.warm && !DONE.includes(st) ? "warm" : ""}`}>
              <Clock3 size={12} /> {DONE.includes(st) ? "Done" : due ? due.text : "No due date"}
              {t.project_name ? ` · ${t.project_name}` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="bp-page tr-page">
      <section className="tr-hero">
        <div className="tr-hero-text">
          <span className="tr-alert"><i /> {me.status}{week ? ` · Week ${week}` : ""}</span>
          <h2>Welcome back, {firstName}! You have {dueThisWeek} {dueThisWeek === 1 ? "task" : "tasks"} due this week.</h2>
          <p className="in-hero-sub">
            <GitBranch size={14} /> Reporting to <b>{me.reporting_manager || "a manager not yet assigned"}</b>
            {project ? <> on <b>{project.project_name}</b></> : null}
          </p>
        </div>
        <div className="tr-hero-actions in-hero-actions">
          <Link to="/intern/tasks" className="in-hero-btn light"><ListTodo size={15} /> View My Tasks</Link>
          <Link to="/intern/project" className="tr-hero-ghost"><Rocket size={15} /> My Project</Link>
        </div>
      </section>

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label in-label">INTERNSHIP PROGRESS</p>
            <span className="tb-stat-icon-in navy"><Gauge size={20} /></span>
          </div>
          <p className="bp-stat-value">{progress != null ? `${progress}%` : "—"}</p>
          <p className="in-foot"><span><Flag size={13} /> {end ? `Ends ${fmt(me.internship_end_date)}` : "No end date set"}</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label in-label">TASKS IN FLIGHT</p>
            <span className="tb-stat-icon-in orange"><ListTodo size={20} /></span>
          </div>
          <p className="bp-stat-value">{columns.todo.length + columns.doing.length} <small className="in-unit">Active</small></p>
          <p className="in-foot"><span>{columns.doing.length} in review · {columns.todo.length} to do</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label in-label">ATTENDANCE</p>
            <span className="tb-stat-icon-in navy"><ShieldCheck size={20} /></span>
          </div>
          <p className="bp-stat-value">{attendance?.attendance_percentage != null ? `${attendance.attendance_percentage}%` : "—"}</p>
          <p className="in-foot">
            <span className={todayRecord?.status === "PRESENT" ? "in-green" : ""}>
              <CircleCheck size={13} /> {todayRecord ? (todayRecord.status === "PRESENT" ? "Present today" : todayRecord.status) : "Not marked today"}
            </span>
            <span>{attendance ? `${attendance.present_days}/${attendance.total_days} days` : ""}</span>
          </p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label in-label">TESTING REPORTS</p>
            <span className="tb-stat-icon-in green"><Bug size={20} /></span>
          </div>
          <p className="bp-stat-value">{approved} <small className="in-unit">Approved</small></p>
          <p className="in-foot"><span>{reports.length - approved} need fixes</span><span>{reports.length} total</span></p>
        </div>
      </div>

      <div className="tr-grid">
        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <h3>Sprint Tasks Board</h3>
              <p>Intern tasks from your lead and your project Kanban tasks</p>
            </div>
            <span className="bp-chip blue"><Columns3 size={12} /> {tasks.length} Total Cards</span>
          </div>
          <div className="in-board">
            {column("To Do", "gray", columns.todo)}
            {column("In Progress", "blue", columns.doing)}
            {column("Done", "green", columns.done)}
          </div>
          <Link to="/intern/tasks" className="tr-link in-more">Open My Tasks <ArrowRight size={13} /></Link>
        </section>

        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <h3>Today&apos;s Shift</h3>
              <p>Live clock and today&apos;s attendance</p>
            </div>
            <span className="bp-chip blue">IST</span>
          </div>
          <div className="in-clock">
            <b>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</b>
            <span>{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
          </div>
          {hasEmployee ? (
            <>
              <div className={`in-checkin ${hrToday?.checked_in ? "on" : ""}`}>
                <CircleCheck size={16} />
                <span>
                  <b>{hrToday?.checked_in ? `Checked in at ${timeOf(hrToday.check_in_time)}` : "Not checked in yet"}</b>
                  <small>{hrToday?.checked_out ? `Checked out at ${timeOf(hrToday.check_out_time)}` : hrToday?.status || ""}</small>
                </span>
              </div>
              {punchError && <p className="bp-form-error">{punchError}</p>}
              {!hrToday?.checked_out && (
                <button type="button" className="bp-btn navy in-full" onClick={handlePunch} disabled={punching}>
                  {hrToday?.checked_in ? <LogOut size={15} /> : <LogIn size={15} />} {punching ? "Working…" : hrToday?.checked_in ? "Punch Out" : "Punch In"}
                </button>
              )}
            </>
          ) : (
            <div className={`in-checkin ${todayRecord?.status === "PRESENT" ? "on" : ""}`}>
              <CircleCheck size={16} />
              <span>
                <b>{todayRecord ? `Marked ${todayRecord.status.toLowerCase()} today` : "Attendance not marked yet today"}</b>
                <small>Your attendance is recorded by your project lead</small>
              </span>
            </div>
          )}
          <Link to="/intern/attendance" className="bp-btn soft in-full"><CalendarDays size={15} /> View My Attendance</Link>
        </section>
      </div>

      <div className="tr-grid in-grid-even">
        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <h3>My Performance</h3>
              <p>Latest evaluation from your project lead</p>
            </div>
            {latest?.overall_score != null && <span className="bp-chip blue">Overall: {latest.overall_score}%</span>}
          </div>
          {!latest ? <p className="tr-empty">No performance reviews yet.</p> : (
            <>
              {pillars.map((p, i) => (
                <div key={p.label} className="in-pillar">
                  <div><b>{p.label}</b><b className={i === pillars.length - 1 ? "in-green" : ""}>{p.value}%</b></div>
                  <div className={`tr-progress thin ${i % 3 === 2 ? "green" : ""}`}><span style={{ width: `${Math.min(100, p.value)}%` }} /></div>
                </div>
              ))}
              {latest.feedback && (
                <div className="in-quote">
                  <p className="in-quote-who"><b>{latest.reviewer || "Project lead"}</b><small>Review on {fmt(latest.review_date)}</small></p>
                  <p>&ldquo;{latest.feedback}&rdquo;</p>
                </div>
              )}
            </>
          )}
        </section>

        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <h3>Internship Details</h3>
              <p>Official enrollment record</p>
            </div>
            <span className="bp-chip green">{me.status}</span>
          </div>
          <div className="in-facts">
            <div><small>PROJECT</small><b>{project?.project_name || "Not assigned"}</b></div>
            <div><small>MY ROLE</small><b>{project?.my_role || "—"}</b></div>
            <div><small>REPORTING MANAGER</small><b>{me.reporting_manager || "Not yet assigned"}</b></div>
            <div><small>CLIENT</small><b>{project?.client_name || "—"}</b></div>
            <div><small>START DATE</small><b>{fmt(me.internship_start_date)}</b></div>
            <div><small>END DATE</small><b>{fmt(me.internship_end_date)}</b></div>
          </div>
          <div className="in-id">
            <IdCard size={16} />
            <span><b>ID: {me.intern_code}</b><small>{me.conversion_status ? `Conversion: ${me.conversion_status}` : "Intern record"}</small></span>
            <span className="bp-chip blue"><BadgeCheck size={12} /> Verified</span>
          </div>
          <Link to="/intern/my-internship" className="bp-btn soft in-full">View My Internship</Link>
        </section>
      </div>

      <div className="tr-grid in-grid-even">
        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <h3>Testing Reports</h3>
              <p>Feedback from your lead on task submissions</p>
            </div>
            <Link to="/intern/testing-reports" className="bp-btn navy small"><Plus size={13} /> View All</Link>
          </div>
          {reports.length === 0 ? <p className="tr-empty">No testing reports yet.</p> : reports.slice(0, 4).map((r) => (
            <div key={r.report_id} className="in-report">
              <div>
                <small className={r.status === "APPROVED" ? "" : "warm"}>#REP-{r.report_id}</small>
                <b>{r.task_title}</b>
              </div>
              <span className={`bp-chip ${r.status === "APPROVED" ? "green" : "orange"}`}>{r.status === "APPROVED" ? "Approved" : "Needs Fixes"}</span>
            </div>
          ))}
        </section>

        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <h3>Ask Project Lead</h3>
              <p>Direct line to {me.reporting_manager || "your project lead"}</p>
            </div>
            <span className="bp-chip green"><MessageSquare size={12} /> {thread.length} messages</span>
          </div>
          {lastLeadMsg && <p className="in-last">Last reply: &ldquo;{lastLeadMsg.content}&rdquo;</p>}
          <label className="bp-field">
            <span>Message</span>
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`Write your question for ${me.reporting_manager || "your lead"}…`} />
          </label>
          {sentNote && <p className="in-sent">{sentNote}</p>}
          <div className="in-send-row">
            <Link to="/intern/ask-lead" className="tr-link">Open full thread</Link>
            <button type="button" className="bp-btn navy" onClick={sendMessage} disabled={sending || !message.trim()}>
              <Send size={14} /> {sending ? "Sending…" : "Send Message"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
