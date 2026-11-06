import { useEffect, useState } from "react";
import {
  ListTodo, Eye, Wrench, CircleCheck, LayoutGrid, List, Clock3, ChevronDown, Send, X, FolderKanban,
} from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/InternPages.css";

const COLUMNS = [
  { key: "todo", label: "To Do", dot: "gray", match: (s) => ["PENDING", "TODO", "NEEDS_FIXES"].includes(s) },
  { key: "doing", label: "In Progress", dot: "orange", match: (s) => ["SUBMITTED", "IN_PROGRESS", "IN_REVIEW", "REVIEW"].includes(s) },
  { key: "done", label: "Done", dot: "green", match: (s) => ["COMPLETED", "DONE"].includes(s) },
];

function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState({}); // task_key -> {note, links}
  const [submitting, setSubmitting] = useState(null);
  const [view, setView] = useState("board");
  const [source, setSource] = useState("");
  const [openKey, setOpenKey] = useState(null);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([
      client.get("/api/interns/me/tasks/"),
      client.get("/api/projects/my-tasks/"),
    ])
      .then(([internRes, kanbanRes]) => {
        const internTasks = (internRes.data || []).map((t) => ({
          ...t,
          source: "intern",
          key: `intern-${t.intern_task_id}`,
        }));
        const kanbanTasks = (kanbanRes.data || []).map((t) => ({
          ...t,
          source: "kanban",
          key: `kanban-${t.task_id}`,
        }));
        setTasks([...internTasks, ...kanbanTasks]);
      })
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your tasks."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const updateDraft = (key, field, value) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const submitInternTask = async (t) => {
    const draft = drafts[t.key] || {};
    setSubmitting(t.key);
    setError("");
    try {
      await client.patch(`/api/interns/me/tasks/${t.intern_task_id}/`, {
        note: draft.note || "",
        links: draft.links || "",
      });
      setMessage("Task submitted.");
      setOpenKey(null);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit task.");
    } finally {
      setSubmitting(null);
    }
  };

  const statusTone = (status) => {
    if (status === "COMPLETED" || status === "DONE") return "green";
    if (status === "SUBMITTED" || status === "IN_PROGRESS") return "blue";
    if (status === "NEEDS_FIXES") return "red";
    return "orange"; // PENDING / TODO
  };

  const statusLabel = (status) => {
    if (status === "NEEDS_FIXES") return "Needs Fixes";
    if (status === "COMPLETED" || status === "DONE") return "Completed";
    if (status === "SUBMITTED") return "Submitted";
    if (status === "IN_PROGRESS") return "In Progress";
    return "Pending";
  };

  if (loading) return <p className="bp-loading">Loading…</p>;

  const st = (t) => (t.status || "PENDING").toUpperCase();
  const visible = tasks.filter((t) => !source || t.source === source);
  const count = (fn) => tasks.filter((t) => fn(st(t))).length;
  const today = new Date();

  const dueText = (t) => {
    if (!t.due_date) return "No due date";
    const days = Math.round((new Date(t.due_date) - today) / 86400000);
    if (["COMPLETED", "DONE"].includes(st(t))) return `Due ${t.due_date}`;
    if (days < 0) return `Overdue · ${t.due_date}`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due in ${days} days`;
  };

  const renderSubmission = (t) => {
    if (t.source !== "intern") {
      return <div className="in-box"><p>Update progress on the project Kanban board.</p></div>;
    }
    const canSubmit = t.status !== "COMPLETED";
    if (!canSubmit || t.status === "SUBMITTED") {
      return (
        <div className="in-box">
          <p><b>Your note:</b> {t.student_note || "—"}</p>
          <p><b>Links:</b> {t.links || "—"}</p>
          {t.status === "SUBMITTED" && <p className="bp-muted">Awaiting review from your project lead.</p>}
          {t.status === "COMPLETED" && <p className="in-green">✓ Approved — no further action needed.</p>}
          {t.feedback && <p><b>Feedback:</b> {t.feedback}</p>}
        </div>
      );
    }
    return (
      <div className="in-submit">
        {t.feedback && <div className="in-box"><p><b>Lead feedback:</b> {t.feedback}</p></div>}
        <label className="bp-field"><span>Submission note</span>
          <textarea rows={2} placeholder="Add a note about your submission…" value={drafts[t.key]?.note || ""} onChange={(e) => updateDraft(t.key, "note", e.target.value)} />
        </label>
        <label className="bp-field"><span>Links</span>
          <input placeholder="Links (repo, deployment, etc.)" value={drafts[t.key]?.links || ""} onChange={(e) => updateDraft(t.key, "links", e.target.value)} />
        </label>
        <button type="button" className="bp-btn navy" onClick={() => submitInternTask(t)} disabled={submitting === t.key}>
          <Send size={14} /> {submitting === t.key ? "Submitting…" : t.status === "NEEDS_FIXES" ? "Resubmit Task" : "Submit Task"}
        </button>
      </div>
    );
  };

  const card = (t, expanded) => {
    const s = st(t);
    const done = ["COMPLETED", "DONE"].includes(s);
    const open = expanded || openKey === t.key;
    return (
      <article key={t.key} className={`in-kcard ${done ? "done" : ""} ${s === "NEEDS_FIXES" ? "fix" : ""}`}>
        <div className="in-kcard-top">
          <small>{t.source === "intern" ? "INTERN TASK" : "PROJECT TASK"}</small>
          <span className={`bp-chip ${statusTone(s)}`}>{statusLabel(s)}</span>
        </div>
        <h4>{t.title || t.task_title}</h4>
        {t.project_name && <span className="bp-chip gray in-tag"><FolderKanban size={11} /> {t.project_name}</span>}
        <p className={`in-task-due ${!done && dueText(t).match(/Overdue|today|tomorrow/) ? "warm" : ""}`}><Clock3 size={12} /> {dueText(t)}</p>
        {open && (
          <>
            {t.description && <p className="in-card-text">{t.description}</p>}
            {renderSubmission(t)}
          </>
        )}
        {!expanded && (
          <button type="button" className="in-kcard-toggle" onClick={() => setOpenKey(open ? null : t.key)}>
            {open ? <><X size={12} /> Close</> : t.source === "intern" && !done && s !== "SUBMITTED" ? <><Send size={12} /> Open &amp; Submit</> : <><Eye size={12} /> View details</>}
          </button>
        )}
      </article>
    );
  };

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Intern Workspace / <span>My Tasks</span></p>
          <h1 className="bp-title">Sprint Tasks &amp; Assignments</h1>
          <p className="bp-sub">Tasks assigned by your project lead, and project tasks assigned to you on the Kanban board.</p>
        </div>
      </div>

      {error && <p className="bp-notice in-error">{error}</p>}
      {message && <p className="bp-notice in-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">OPEN TASKS</p><span className="tr-stat-icon blue"><ListTodo size={20} /></span></div>
          <p className="bp-stat-value">{count(COLUMNS[0].match)} <small className="in-unit">/ {tasks.length}</small></p>
          <div className="bp-meter"><span style={{ width: tasks.length ? `${(count(COLUMNS[2].match) / tasks.length) * 100}%` : "0%" }} /></div>
          <p className="in-foot"><span>{count(COLUMNS[2].match)} done so far</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">REVIEW QUEUE</p><span className="tr-stat-icon orange"><Eye size={20} /></span></div>
          <p className="bp-stat-value">{count((s) => s === "SUBMITTED")} <small className="in-unit">Submitted</small></p>
          <p className="in-foot"><span>Awaiting your lead's review</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">NEEDS FIXES</p><span className="tr-stat-icon orange"><Wrench size={20} /></span></div>
          <p className={`bp-stat-value ${count((s) => s === "NEEDS_FIXES") ? "tr-orange" : ""}`}>{count((s) => s === "NEEDS_FIXES")}</p>
          <p className="in-foot"><span>Resubmit after addressing feedback</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">COMPLETED</p><span className="tr-stat-icon green"><CircleCheck size={20} /></span></div>
          <p className="bp-stat-value in-green">{count(COLUMNS[2].match)}</p>
          <p className="in-foot"><span>Approved or done</span></p>
        </div>
      </div>

      <div className="bp-panel in-toolbar">
        <div className="bp-tabs">
          <button type="button" className={`bp-tab ${view === "board" ? "active" : ""}`} onClick={() => setView("board")}><LayoutGrid size={14} /> Kanban Board</button>
          <button type="button" className={`bp-tab ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}><List size={14} /> List View</button>
        </div>
        <label className="bp-select">
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All tasks</option>
            <option value="intern">Intern tasks</option>
            <option value="kanban">Project tasks</option>
          </select>
          <ChevronDown size={14} />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="bp-panel in-empty-panel">No tasks assigned yet.</p>
      ) : view === "board" ? (
        <div className="in-kanban">
          {COLUMNS.map((c) => {
            const list = visible.filter((t) => c.match(st(t)));
            return (
              <div key={c.key} className="in-kcol">
                <div className="in-col-head"><span><i className={c.dot} /> {c.label}</span><b>{list.length}</b></div>
                {list.length === 0 ? <p className="in-col-empty">Nothing here</p> : list.map((t) => card(t, false))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="in-list">{visible.map((t) => card(t, true))}</div>
      )}
    </div>
  );
}

export default MyTasks;
