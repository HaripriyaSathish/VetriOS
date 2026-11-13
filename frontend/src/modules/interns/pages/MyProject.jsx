import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layers, Activity, UserCog, Building2, MessageSquare, Kanban, ListTodo, ArrowRight } from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/InternPages.css";

const TONE = { ACTIVE: "green", IN_PROGRESS: "green", ON_HOLD: "orange", COMPLETED: "blue", PLANNING: "blue", CANCELLED: "red" };

function MyProject() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kanban, setKanban] = useState([]);

  useEffect(() => {
    client.get("/api/interns/me/project/")
      .then(({ data }) => setProjects(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your project."))
      .finally(() => setLoading(false));
    client.get("/api/projects/my-tasks/").then(({ data }) => setKanban(data || [])).catch(() => setKanban([]));
  }, []);

  if (loading) return <p className="bp-loading">Loading…</p>;
  if (error) return <p className="bp-error">{error}</p>;

  const main = projects[0];
  const tasksFor = (p) => kanban.filter((t) => t.project_id === p.project_id || t.project_name === p.project_name);
  const doneFor = (p) => tasksFor(p).filter((t) => ["DONE", "COMPLETED"].includes((t.status || "").toUpperCase())).length;

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Intern Workspace &gt; <span>My Project</span></p>
          <h1 className="bp-title">{main ? `${main.project_name} — Project Hub` : "My Project"}</h1>
          <p className="bp-sub">The project(s) you're currently staffed on, your role and your assigned work.</p>
        </div>
        {main && (
          <div className="bp-actions">
            <Link to={`/project/${main.project_id}/team-messages`} className="bp-btn outline"><MessageSquare size={16} /> Team Chat</Link>
            <Link to={`/project/${main.project_id}/kanban`} className="bp-btn navy"><Kanban size={16} /> Open Kanban Board</Link>
          </div>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="bp-panel in-empty-panel">You're not assigned to any project yet.</div>
      ) : (
        <>
          <div className="bp-stats tr-stats">
            <div className="bp-stat" style={{ "--i": 0 }}>
              <div className="bp-stat-top"><p className="bp-stat-label in-label">PROJECTS ASSIGNED</p><span className="tb-stat-icon-in navy"><Layers size={20} /></span></div>
              <p className="bp-stat-value">{projects.length}</p>
              <p className="in-foot"><span>Staffed on right now</span></p>
            </div>
            <div className="bp-stat" style={{ "--i": 1 }}>
              <div className="bp-stat-top"><p className="bp-stat-label in-label">PROJECT STATUS</p><span className="tb-stat-icon-in green"><Activity size={20} /></span></div>
              <p className="bp-stat-value in-small-val">{main.status}</p>
              <p className="in-foot"><span>{main.project_name}</span></p>
            </div>
            <div className="bp-stat" style={{ "--i": 2 }}>
              <div className="bp-stat-top"><p className="bp-stat-label in-label">YOUR ROLE</p><span className="tb-stat-icon-in orange"><UserCog size={20} /></span></div>
              <p className="bp-stat-value in-small-val">{main.my_role || "—"}</p>
              <p className="in-foot"><span>On the project team</span></p>
            </div>
            <div className="bp-stat" style={{ "--i": 3 }}>
              <div className="bp-stat-top"><p className="bp-stat-label in-label">MY PROJECT TASKS</p><span className="tb-stat-icon-in navy"><ListTodo size={20} /></span></div>
              <p className="bp-stat-value">{doneFor(main)} <small className="in-unit">/ {tasksFor(main).length} done</small></p>
              <p className="in-foot"><span>Kanban tasks assigned to you</span></p>
            </div>
          </div>

          <div className="in-proj-grid">
            {projects.map((p) => {
              const list = tasksFor(p);
              const pct = list.length ? Math.round((doneFor(p) / list.length) * 100) : 0;
              return (
                <section key={p.project_id} className="bp-panel tr-card">
                  <div className="tr-card-head">
                    <div>
                      <h3><Layers size={18} /> {p.project_name}</h3>
                      <p><Building2 size={12} /> Client: {p.client_name}</p>
                    </div>
                    <span className={`bp-chip ${TONE[(p.status || "").toUpperCase()] || "blue"}`}>{p.status}</span>
                  </div>
                  <div className="in-facts">
                    <div><small>MY ROLE</small><b>{p.my_role || "—"}</b></div>
                    <div><small>CLIENT</small><b>{p.client_name}</b></div>
                  </div>
                  <div className="in-score">
                    <div className="in-score-top"><b>My task completion</b><b>{list.length ? `${pct}%` : "—"}</b></div>
                    <div className="tr-progress thin"><span style={{ width: `${pct}%` }} /></div>
                    <small>{doneFor(p)} of {list.length} Kanban tasks done</small>
                  </div>
                  {list.length > 0 && (
                    <div className="in-mod-list">
                      <p className="in-mini">ASSIGNED TASKS</p>
                      {list.slice(0, 4).map((t) => (
                        <div key={t.task_id} className="in-report">
                          <div><small>{t.due_date ? `Due ${t.due_date}` : "No due date"}</small><b>{t.title || t.task_title}</b></div>
                          <span className={`bp-chip ${["DONE", "COMPLETED"].includes((t.status || "").toUpperCase()) ? "green" : "blue"}`}>{t.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="in-send-row">
                    <Link to={`/project/${p.project_id}/team-messages`} className="tr-link"><MessageSquare size={13} /> Team Chat</Link>
                    <Link to={`/project/${p.project_id}/kanban`} className="bp-btn soft small">Kanban Board <ArrowRight size={13} /></Link>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default MyProject;
