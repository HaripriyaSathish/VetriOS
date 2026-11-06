import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap, CalendarClock, UserRound, BadgeCheck, CircleCheck, Circle, CircleDot, Users, Briefcase,
  MessageSquare, IdCard, ArrowRight,
} from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/InternPages.css";

const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

function MyInternship() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [now] = useState(() => new Date());

  useEffect(() => {
    client.get("/api/interns/me/")
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your internship details."));
    client.get("/api/interns/me/project/").then(({ data }) => setProjects(data)).catch(() => setProjects([]));
    client.get("/api/interns/me/tasks/").then(({ data }) => setTasks(data)).catch(() => setTasks([]));
  }, []);

  if (error) return <p className="bp-error">{error}</p>;
  if (!data) return <p className="bp-loading">Loading…</p>;

  const start = data.internship_start_date ? new Date(data.internship_start_date) : null;
  const end = data.internship_end_date ? new Date(data.internship_end_date) : null;
  const totalWeeks = start && end ? Math.max(1, Math.ceil((end - start) / (7 * 86400000))) : null;
  const week = start ? Math.max(1, Math.ceil((now - start) / (7 * 86400000))) : null;
  const progress = start && end && end > start ? Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100))) : null;
  const daysLeft = end ? Math.max(0, Math.ceil((end - now) / 86400000)) : null;
  const done = tasks.filter((t) => t.status === "COMPLETED").length;

  // Timeline built from the dates on the intern record: start, the midpoint
  // review window, and the end date.
  const mid = start && end ? new Date(start.getTime() + (end - start) / 2) : null;
  const steps = [
    { label: "Internship started", date: start, note: "Onboarding and project allocation" },
    { label: "Mid-internship review", date: mid, note: "Performance check-in with your lead" },
    { label: "Internship completes", date: end, note: data.conversion_status ? `Conversion: ${data.conversion_status}` : "Completion and next steps" },
  ];

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Intern Workspace &gt; <span>My Internship</span></p>
          <h1 className="bp-title">Internship Governance &amp; Overview</h1>
          <p className="bp-sub">Your internship details, timeline and reporting line.</p>
        </div>
        <div className="bp-actions">
          <Link to="/intern/performance" className="bp-btn outline"><BadgeCheck size={16} /> My Performance</Link>
          <Link to="/intern/ask-lead" className="bp-btn navy"><MessageSquare size={16} /> Ask Project Lead</Link>
        </div>
      </div>

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label in-label">INTERNSHIP PACING</p>
            {progress != null && <span className="bp-chip green">{progress}% done</span>}
          </div>
          <div className="in-stat-row">
            <span className="tb-stat-icon-in navy"><GraduationCap size={20} /></span>
            <p className="bp-stat-value">{week ? `Week ${week}` : "—"}{totalWeeks && <small className="in-unit"> / {totalWeeks}</small>}</p>
          </div>
          <p className="in-foot"><span>{daysLeft != null ? `${daysLeft} days to completion` : "No end date set"}</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label in-label">TIMELINE</p>
          </div>
          <div className="in-stat-row">
            <span className="tb-stat-icon-in orange"><CalendarClock size={20} /></span>
            <p className="bp-stat-value in-small-val">{fmt(data.internship_start_date)}</p>
          </div>
          <p className="in-foot"><span>Ends {fmt(data.internship_end_date)}</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label in-label">REPORTING MANAGER</p>
          </div>
          <div className="in-stat-row">
            <span className="tb-stat-icon-in green"><UserRound size={20} /></span>
            <p className="bp-stat-value in-small-val">{data.reporting_manager || "Not yet assigned"}</p>
          </div>
          <p className="in-foot"><span>Your day-to-day lead</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label in-label">TASKS COMPLETED</p>
            <span className="bp-chip blue">{data.status}</span>
          </div>
          <div className="in-stat-row">
            <span className="tb-stat-icon-in navy"><CircleCheck size={20} /></span>
            <p className="bp-stat-value">{done} <small className="in-unit">/ {tasks.length}</small></p>
          </div>
          <p className="in-foot"><span>Intern tasks approved by your lead</span></p>
        </div>
      </div>

      <div className="tr-grid">
        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <h3>Internship Roadmap</h3>
              <p>Key dates from your internship record</p>
            </div>
            {progress != null && <span className="bp-chip blue">{progress}% elapsed</span>}
          </div>
          <div className="tr-progress"><span style={{ width: `${progress ?? 0}%` }} /></div>
          {steps.map((s, i) => {
            const passed = s.date && s.date <= now;
            const current = !passed && (i === 0 || (steps[i - 1].date && steps[i - 1].date <= now));
            return (
              <div key={s.label} className={`in-step ${passed ? "done" : current ? "current" : ""}`}>
                <span className="in-step-icon">{passed ? <CircleCheck size={18} /> : current ? <CircleDot size={18} /> : <Circle size={18} />}</span>
                <div>
                  <small>STEP {String(i + 1).padStart(2, "0")} · {fmt(s.date)}</small>
                  <b>{s.label}</b>
                  <p>{s.note}</p>
                </div>
                <span className={`bp-chip ${passed ? "green" : current ? "orange" : "gray"}`}>{passed ? "Done" : current ? "Up next" : "Upcoming"}</span>
              </div>
            );
          })}
        </section>

        <div className="tr-col">
          <section className="bp-panel tr-card">
            <div className="tr-card-head"><h3><Users size={18} /> Supervision &amp; Team</h3></div>
            <div className="in-person">
              <span className="bp-avatar">{(data.reporting_manager || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
              <span><b>{data.reporting_manager || "Not yet assigned"}</b><small>Reporting Manager</small></span>
              <span className="bp-chip blue">Primary</span>
            </div>
            <div className="in-kv"><span>Intern ID</span><b>{data.intern_code}</b></div>
            <div className="in-kv"><span>Status</span><b>{data.status}</b></div>
            {data.conversion_status && <div className="in-kv"><span>Conversion</span><b>{data.conversion_status}</b></div>}
          </section>

          <section className="bp-panel tr-card">
            <div className="tr-card-head"><h3><Briefcase size={18} /> Assigned Projects</h3></div>
            {projects.length === 0 ? <p className="tr-empty">You're not assigned to any project yet.</p> : projects.map((p) => (
              <div key={p.project_id} className="in-report">
                <div><small>{p.client_name}</small><b>{p.project_name}</b></div>
                <span className="bp-chip blue">{p.my_role}</span>
              </div>
            ))}
            <Link to="/intern/project" className="tr-link in-more">Open My Project <ArrowRight size={13} /></Link>
          </section>

          <div className="in-id">
            <IdCard size={16} />
            <span><b>ID: {data.intern_code}</b><small>Started {fmt(data.internship_start_date)}</small></span>
            <span className="bp-chip green"><BadgeCheck size={12} /> {data.status}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MyInternship;
