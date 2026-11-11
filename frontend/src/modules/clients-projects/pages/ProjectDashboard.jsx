import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Rocket, ListTodo, ShieldAlert, CloudUpload, Gauge, ArrowRight, Plus, TriangleAlert, Flag,
  GraduationCap, Handshake, CalendarClock, Video, FolderPlus, Columns3, CircleCheck,
} from "lucide-react";
import client from "../../../api/client";
import LoginIllustration from "../../identity-access/components/LoginIllustration";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const HEALTH = {
  on_track: { label: "On Track", chip: "green", dot: "green", bar: "green" },
  at_risk: { label: "At Risk", chip: "red", dot: "red", bar: "red" },
  planned: { label: "Planned", chip: "blue", dot: "blue", bar: "" },
  on_hold: { label: "On Hold", chip: "orange", dot: "orange", bar: "orange" },
  completed: { label: "Completed", chip: "green", dot: "green", bar: "green" },
};

const MILESTONE = {
  overdue: { label: "Overdue", chip: "red" },
  due_soon: { label: "Due soon", chip: "orange" },
  scheduled: { label: "Scheduled", chip: "blue" },
  completed: { label: "Completed", chip: "green" },
};

const DEPLOY_CHIP = { SUCCESS: "green", STARTED: "blue", FAILED: "red", ROLLED_BACK: "orange", CANCELLED: "gray" };

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const day = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const when = (d) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const initials = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function relDay(d, today) {
  if (!d) return null;
  const diff = Math.round((new Date(d) - new Date(today)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${-diff}d overdue`;
  return `In ${diff} days`;
}

export default function ProjectDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const roles = user?.roles || [];
  const isAdmin = roles.includes("System Administrator");
  // /clients/my-clients is gated to these two roles in App.jsx.
  const canOpenClientHub = isAdmin || roles.includes("Project Manager");

  useEffect(() => {
    client.get("/api/projects/pm/overview/")
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your project dashboard."));
  }, []);

  if (error) return <div className="bp-page pm-page"><p className="bp-panel bp-error">{error}</p></div>;
  if (!data) return <div className="bp-page pm-page"><p className="bp-loading">Loading your projects…</p></div>;

  const { summary: s, projects, milestones, interns, meetings, payments, recent_deployments: deploys } = data;
  const t = s.tasks;
  const totalTasks = t.PENDING + t.IN_PROGRESS + t.IN_REVIEW + t.COMPLETED;
  const donePct = totalTasks ? Math.round((t.COMPLETED * 100) / totalTasks) : 0;
  const canManageAny = projects.some((p) => p.can_manage);
  const dep = s.deployments || {};
  const avgProgress = projects.length ? Math.round(projects.reduce((a, p) => a + p.progress, 0) / projects.length) : 0;
  const pendingReviews = interns.filter((i) => i.latest_score == null).length;

  return (
    <div className="bp-page tr-page pm-page">
      <section className="tr-hero">
        <div className="tr-hero-text">
          <span className="tr-alert"><i /> {projects.length} {projects.length === 1 ? "PROJECT" : "PROJECTS"} · {day(data.today).toUpperCase()}</span>
          <h2>
            Welcome back, {data.first_name}. {s.projects_active} active {s.projects_active === 1 ? "project" : "projects"} · {s.milestones_due_week}{" "}
            {s.milestones_due_week === 1 ? "milestone" : "milestones"} due this week.
          </h2>
          <p className="pm-hero-sub">
            {s.milestones_overdue > 0
              ? <><TriangleAlert size={14} /> <b>{s.milestones_overdue} overdue {s.milestones_overdue === 1 ? "milestone" : "milestones"}</b> to review</>
              : <><CircleCheck size={14} /> No overdue milestones</>}
            {interns.length > 0 && <> · <b>{interns.length} {interns.length === 1 ? "intern" : "interns"}</b> on your teams</>}
          </p>
        </div>
        <div className="pm-hero-art" aria-hidden="true"><LoginIllustration /></div>
        <div className="tr-hero-actions">
          {canManageAny && (
            <Link to="/project/requirements?new=1" className="pm-hero-btn"><Plus size={16} /> New Requirement</Link>
          )}
          {isAdmin && (
            <Link to="/project/create" className="tr-hero-ghost"><FolderPlus size={15} /> New Project</Link>
          )}
        </div>
      </section>

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <span className="bp-chip blue pm-stat-chip">{s.projects_active} Active</span>
            <span className="pm-ico navy"><Rocket size={20} /></span>
          </div>
          <p className="bp-stat-value">{s.projects_total}</p>
          <p className="bp-stat-label pm-label">MY PROJECTS</p>
          <p className="pm-foot">
            <span>{s.projects_planned} planned</span>
            <Link to="/project/kanban">View Board <ArrowRight size={12} /></Link>
          </p>
        </div>

        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <span className="bp-chip green pm-stat-chip">{t.COMPLETED} done</span>
            <span className="pm-ico soft"><Gauge size={20} /></span>
          </div>
          <p className="bp-stat-value">{s.tasks_open}</p>
          <p className="bp-stat-label pm-label">OPEN TASKS</p>
          <p className="pm-foot">
            <span className={s.tasks_overdue ? "pm-warm" : ""}>{s.tasks_overdue} overdue</span>
            <span className="pm-ok">{donePct}% complete</span>
          </p>
        </div>

        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <span className="bp-chip orange pm-stat-chip">Due this week</span>
            <span className="pm-ico orange"><ShieldAlert size={20} /></span>
          </div>
          <p className="bp-stat-value tr-orange">{s.milestones_due_week}</p>
          <p className="bp-stat-label pm-label">MILESTONES DUE</p>
          <p className="pm-foot">
            <span className={s.milestones_overdue ? "pm-warn" : ""}><TriangleAlert size={12} /> {s.milestones_overdue} overdue</span>
            <span>Next: {s.next_milestone_date ? relDay(s.next_milestone_date, data.today) : "—"}</span>
          </p>
        </div>

        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <span className="bp-chip blue pm-stat-chip">{dep.STARTED || 0} in progress</span>
            <span className="pm-ico red"><CloudUpload size={20} /></span>
          </div>
          <p className="bp-stat-value">{dep.SUCCESS || 0} <small className="pm-unit">Live</small></p>
          <p className="bp-stat-label pm-label">DEPLOYMENTS</p>
          <p className="pm-foot">
            <span className={dep.FAILED ? "pm-warn" : ""}>{dep.FAILED || 0} failed · {s.deployments_total} total</span>
            <Link to="/project/deployments">Manage <ArrowRight size={12} /></Link>
          </p>
        </div>
      </div>

      <div className="pm-grid">
        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div className="pm-card-title">
              <span className="pm-ico small soft"><Columns3 size={17} /></span>
              <div>
                <h3>Delivery Progress</h3>
                <p>Task completion across your projects</p>
              </div>
            </div>
            <span className="bp-chip orange">{s.requirements_open} open requirements</span>
          </div>

          <div className="pm-counts">
            <span className="pm-count"><i className="gray" /> To Do: <b>{t.PENDING}</b></span>
            <span className="pm-count"><i className="blue" /> In Progress: <b>{t.IN_PROGRESS}</b></span>
            <span className="pm-count"><i className="orange" /> In Review: <b>{t.IN_REVIEW}</b></span>
            <span className="pm-count"><i className="green" /> Done: <b>{t.COMPLETED}</b></span>
          </div>

          <div className="pm-projects">
            {projects.length === 0 && <p className="pm-empty">You aren&apos;t on any projects yet.</p>}
            {projects.map((p) => {
              const h = HEALTH[p.health] || HEALTH.planned;
              return (
                <Link key={p.project_id} to={`/project/${p.project_id}/kanban`} className="pm-proj">
                  <div className="pm-proj-top">
                    <span className="pm-proj-name"><i className={`pm-dot ${h.dot}`} /> {p.project_name} <small>· {p.client_name}</small></span>
                    <span className="pm-proj-right">
                      <span className={`bp-chip ${h.chip}`}>{h.label}</span>
                      <b>{p.progress}%</b>
                    </span>
                  </div>
                  <div className={`pm-bar ${h.bar}`}><span style={{ width: `${p.progress}%` }} /></div>
                  <div className="pm-proj-meta">
                    <span>{p.tasks_total ? `${p.tasks_done} of ${p.tasks_total} tasks done` : "No tasks yet"}</span>
                    <span>{p.my_role}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="pm-card-foot">
            <span><Gauge size={14} /> Average completion: {avgProgress}% across {projects.length} {projects.length === 1 ? "project" : "projects"}</span>
            <Link to="/project/kanban">Open Kanban Board <ArrowRight size={13} /></Link>
          </div>
        </section>

        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div className="pm-card-title">
              <span className="pm-ico small soft"><Flag size={17} /></span>
              <div>
                <h3>Key Milestones</h3>
                <p>{s.milestones_overdue ? "Overdue and upcoming deliverables" : "Next critical deliverables"}</p>
              </div>
            </div>
          </div>

          <div className="pm-milestones">
            {milestones.length === 0 && <p className="pm-empty">No milestones on your projects yet.</p>}
            {milestones.map((m) => {
              const st = MILESTONE[m.state] || MILESTONE.scheduled;
              return (
                <div key={m.project_milestone_id} className={`pm-ms ${m.state}`}>
                  <div>
                    <b>{m.milestone_name}</b>
                    <small>{m.project_name} · {day(m.planned_end_date)}</small>
                  </div>
                  <span className={`bp-chip ${st.chip}`}>{st.label}</span>
                </div>
              );
            })}
          </div>

          <div className="pm-card-foot">
            <Link to="/project/milestones">Manage all {s.milestones_total} milestones <ArrowRight size={13} /></Link>
          </div>
        </section>
      </div>

      <div className="pm-grid even">
        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div className="pm-card-title">
              <span className="pm-ico small soft"><GraduationCap size={17} /></span>
              <div>
                <h3>Intern Assessments</h3>
                <p>
                  {interns.length === 0
                    ? "Interns on your project teams"
                    : pendingReviews
                      ? `${pendingReviews} ${pendingReviews === 1 ? "intern hasn't" : "interns haven't"} been reviewed yet`
                      : "Latest review score for each intern on your teams"}
                </p>
              </div>
            </div>
            {interns.length > 0 && <span className="bp-chip orange">{interns.length} {interns.length === 1 ? "Intern" : "Interns"}</span>}
          </div>

          <div className="pm-people">
            {interns.length === 0 && <p className="pm-empty">No interns are on your project teams.</p>}
            {interns.map((i, idx) => (
              <div key={i.intern_id} className="pm-person">
                <span className={`bp-avatar t${idx % 4}`}>{initials(i.name)}</span>
                <div className="pm-person-main">
                  <b>{i.name}</b>
                  <small>{i.role} · {i.project_name}</small>
                </div>
                <div className="pm-score">
                  <b className={i.latest_score == null ? "none" : i.latest_score < 60 ? "warm" : ""}>
                    {i.latest_score == null ? "Not reviewed" : `${Math.round(i.latest_score)}% Score`}
                  </b>
                  {i.tasks_total ? `${i.tasks_done}/${i.tasks_total} tasks done` : "No tasks assigned"}
                </div>
                <Link to="/project/intern-performance-review" className="bp-btn outline small">Evaluate</Link>
              </div>
            ))}
          </div>

          <div className="pm-card-foot">
            <Link to="/project/intern-performance-review">Open Intern Performance Review <ArrowRight size={13} /></Link>
          </div>
        </section>

        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div className="pm-card-title">
              <span className="pm-ico small soft"><Handshake size={17} /></span>
              <div>
                <h3>Client Deliverables &amp; Releases</h3>
                <p>Upcoming client meetings, payments and recent releases</p>
              </div>
            </div>
            <span className="bp-chip blue">Received: {inr(s.payments_total)}</span>
          </div>

          <div className="pm-engagements">
            {meetings.length === 0 && payments.length === 0 && deploys.length === 0 && (
              <p className="pm-empty">No client meetings, payments or releases yet.</p>
            )}

            {meetings.length > 0 && <p className="pm-section-label">Upcoming meetings</p>}
            {meetings.map((m) => (
              <div key={`m${m.meeting_id}`} className="pm-eng">
                <div>
                  <b>{m.client_name} – {m.meeting_title} <span className="bp-chip green">{m.status}</span></b>
                  <small><CalendarClock size={11} /> {when(m.scheduled_start)}{m.meeting_type ? ` · ${m.meeting_type}` : ""}</small>
                </div>
                {m.meeting_url && (
                  <a className="pm-eng-link" href={m.meeting_url} target="_blank" rel="noreferrer" aria-label="Join meeting"><Video size={18} /></a>
                )}
              </div>
            ))}

            {payments.length > 0 && <p className="pm-section-label">Payments received</p>}
            {payments.map((p) => (
              <div key={`p${p.client_payment_id}`} className="pm-eng">
                <div>
                  <b>{p.client_name}{p.project_name ? ` – ${p.project_name}` : ""}</b>
                  <small>{p.payment_method} · {day(p.payment_date)}{p.transaction_id ? ` · ${p.transaction_id}` : ""}</small>
                </div>
                <span className="pm-amount">{inr(p.amount)}</span>
              </div>
            ))}

            {deploys.length > 0 && <p className="pm-section-label">Recent releases</p>}
            {deploys.map((d) => (
              <div key={`d${d.project_deployment_id}`} className="pm-eng">
                <div>
                  <b>{d.project_name} – {d.environment_name} <span className={`bp-chip ${DEPLOY_CHIP[d.deployment_status] || "gray"}`}>{d.deployment_status}</span></b>
                  <small>{d.deployment_version || "No version"} · {when(d.created_at)}</small>
                </div>
                <Link className="pm-eng-link" to={`/project/${d.project_id}/deployments`} aria-label="Open deployments"><ArrowRight size={18} /></Link>
              </div>
            ))}
          </div>

          <div className="pm-card-foot">
            <span><ListTodo size={14} /> {s.change_requests_open} open change {s.change_requests_open === 1 ? "request" : "requests"}</span>
            {canOpenClientHub && <Link to="/clients/my-clients">Client Engagements Hub <ArrowRight size={13} /></Link>}
          </div>
        </section>
      </div>
    </div>
  );
}
