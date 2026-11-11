import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Plus, Clock3, Link2, Flag, UserRound, ChevronDown, ChevronUp, Send, MoveRight, Paperclip, Search,
  ListTodo, Gauge, Eye, CircleCheck,
} from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const COLUMNS = [
  { key: "PENDING", label: "To Do", dot: "gray" },
  { key: "IN_PROGRESS", label: "In Progress", dot: "blue" },
  { key: "IN_REVIEW", label: "In Review", dot: "orange" },
  { key: "NEEDS_FIXES", label: "Needs Fixes", dot: "red" },
  { key: "ON_HOLD", label: "On Hold", dot: "orange" },
  { key: "COMPLETED", label: "Completed", dot: "green" },
  { key: "CANCELLED", label: "Cancelled", dot: "gray" },
];

// task.priority check constraint (chk_task_priority).
const PRIORITIES = [
  { key: "LOW", label: "Low", chip: "gray" },
  { key: "MEDIUM", label: "Medium", chip: "blue" },
  { key: "HIGH", label: "High", chip: "orange" },
  { key: "URGENT", label: "Urgent", chip: "red" },
];
const PRIORITY_CHIP = Object.fromEntries(PRIORITIES.map((p) => [p.key, p.chip]));

const shortDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function TaskCard({ task, column, onStatusChange, requirementsMap, milestonesMap, onOpenSubmit }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && column !== "COMPLETED";

  const requirementTitle = task.requirement_id ? requirementsMap[task.requirement_id] : null;
  const milestoneName = task.milestone_id ? milestonesMap[task.milestone_id] : null;

  const toggleSubmissions = () => {
    if (!showSubmissions) {
      client.get(`/api/projects/tasks/${task.task_id}/submissions/`)
        .then(({ data }) => setSubmissions(data))
        .catch(() => setSubmissions([]));
    }
    setShowSubmissions((v) => !v);
  };

  return (
    <div className={`pm-kcard ${column === "COMPLETED" ? "done" : ""}`}>
      <div className="pm-kcard-top">
        <span className={`bp-chip ${PRIORITY_CHIP[task.priority] || "blue"}`}>{task.priority}</span>
        {task.due_date && (
          <span className={`pm-kdue ${isOverdue ? "late" : ""}`}><Clock3 size={11} /> {isOverdue ? "Overdue · " : "Due "}{shortDate(task.due_date)}</span>
        )}
      </div>
      <p className="pm-ktitle">{task.title}</p>

      {(requirementTitle || milestoneName) && (
        <div className="pm-klinks">
          {requirementTitle && <span><Link2 size={11} /> {requirementTitle}</span>}
          {milestoneName && <span><Flag size={11} /> {milestoneName}</span>}
        </div>
      )}

      <p className="pm-kassignee"><UserRound size={12} /> {task.assignee || "Unassigned"}</p>

      <button type="button" className="pm-ksubs-toggle" onClick={toggleSubmissions}>
        {showSubmissions ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {showSubmissions ? "Hide submissions" : "View submissions"}
      </button>

      {showSubmissions && (
        <div className="pm-ksubs">
          {submissions.length === 0 ? (
            <p>No submissions yet.</p>
          ) : submissions.map((s) => (
            <div key={s.task_submission_id}>
              {s.submission_url && <a href={s.submission_url} target="_blank" rel="noreferrer">{s.submission_url}</a>}
              {s.attachment_url && <a href={s.attachment_url} target="_blank" rel="noreferrer"><Paperclip size={11} /> Attachment</a>}
              {s.notes && <p>{s.notes}</p>}
              <small>{s.submitted_by} — {new Date(s.submitted_at).toLocaleString()}</small>
            </div>
          ))}
        </div>
      )}

      <div className="pm-kactions">
        <button type="button" className="bp-btn navy small" onClick={() => onOpenSubmit(task)}><Send size={12} /> Submit Work</button>
        <button type="button" className="bp-btn outline small" onClick={() => setMenuOpen((v) => !v)}><MoveRight size={12} /> Move to</button>
      </div>

      {menuOpen && (
        <div className="pm-kmenu">
          {COLUMNS.filter((c) => c.key !== column).map((c) => (
            <button key={c.key} type="button" onClick={() => { onStatusChange(task.task_id, c.key); setMenuOpen(false); }}>
              <i className={`pm-dot ${c.dot}`} /> {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanBoard() {
  const { projectId } = useParams();
  const [board, setBoard] = useState({});
  const [teamMembers, setTeamMembers] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [hideEmpty, setHideEmpty] = useState(true);

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [linkedRequirement, setLinkedRequirement] = useState("");
  const [linkedMilestone, setLinkedMilestone] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const [submitTask, setSubmitTask] = useState(null);
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const loadBoard = () =>
    client.get(`/api/projects/${projectId}/kanban/`)
      .then(({ data }) => setBoard(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load the board."));

  useEffect(() => {
    Promise.all([
      loadBoard(),
      client.get(`/api/projects/${projectId}/team/`).then(({ data }) => setTeamMembers(data)).catch(() => {}),
      client.get(`/api/projects/${projectId}/requirements/`).then(({ data }) => setRequirements(data)).catch(() => {}),
      client.get(`/api/projects/${projectId}/milestones/`).then(({ data }) => setMilestones(data)).catch(() => {}),
      client.get("/api/projects/me/").then(({ data }) => setProject(data.find((p) => String(p.project_id) === String(projectId)) || null)).catch(() => {}),
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const requirementsMap = useMemo(() => Object.fromEntries(requirements.map((r) => [r.project_requirement_id, r.requirement_title])), [requirements]);
  const milestonesMap = useMemo(() => Object.fromEntries(milestones.map((m) => [m.project_milestone_id, m.milestone_name])), [milestones]);

  const handleStatusChange = async (taskId, newStatus) => {
    setBoard((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) next[key] = next[key].filter((t) => t.task_id !== taskId);
      return next;
    });
    try {
      await client.patch(`/api/projects/tasks/${taskId}/`, { status: newStatus });
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't move the task.");
    } finally {
      loadBoard();
    }
  };

  const createTask = async () => {
    if (!title.trim()) {
      setFormError("Task title is required.");
      return;
    }
    setCreating(true);
    setFormError("");
    try {
      await client.post(`/api/projects/${projectId}/tasks/`, {
        task_title: title,
        description,
        priority,
        assigned_to_team_member_id: assignee || null,
        due_date: dueDate || null,
        project_requirement_id: linkedRequirement || null,
        project_milestone_id: linkedMilestone || null,
      });
      setMessage("Task created.");
      setTitle(""); setDescription(""); setPriority("MEDIUM"); setAssignee(""); setDueDate("");
      setLinkedRequirement(""); setLinkedMilestone("");
      setShowTaskForm(false);
      loadBoard();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't create the task.");
    } finally {
      setCreating(false);
    }
  };

  const openSubmitModal = (task) => {
    setSubmitTask(task);
    setSubmissionUrl("");
    setSubmissionNotes("");
    setSubmissionFile(null);
    setSubmitError("");
    setMessage("");
  };

  const submitWork = async () => {
    if (!submitTask) return;
    if (!submissionUrl.trim() && !submissionFile) {
      setSubmitError("Provide a link and/or a file.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const formData = new FormData();
      if (submissionUrl.trim()) formData.append("submission_url", submissionUrl.trim());
      if (submissionNotes.trim()) formData.append("notes", submissionNotes.trim());
      if (submissionFile) formData.append("attachment", submissionFile);
      await client.post(`/api/projects/tasks/${submitTask.task_id}/submissions/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("Work submitted.");
      setSubmitTask(null);
      loadBoard();
    } catch (err) {
      setSubmitError(err.response?.data?.detail || "Couldn't submit work.");
    } finally {
      setSubmitting(false);
    }
  };

  const matches = (t) => {
    const q = search.trim().toLowerCase();
    if (assigneeFilter && (t.assignee || "") !== assigneeFilter) return false;
    return !q || [t.title, t.assignee, requirementsMap[t.requirement_id], milestonesMap[t.milestone_id]].some((v) => (v || "").toLowerCase().includes(q));
  };

  const count = (key) => (board[key] || []).length;
  const total = COLUMNS.reduce((a, c) => a + count(c.key), 0);
  const assignees = [...new Set(Object.values(board).flat().map((t) => t.assignee).filter(Boolean))].sort();
  const visibleColumns = COLUMNS.filter((c) => !hideEmpty || count(c.key) > 0 || ["PENDING", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"].includes(c.key));

  return (
    <div className="bp-page tr-page pm-page pm-wide">
      <PmHeader
        section="Kanban Board"
        title={project ? `${project.project_name} Board` : "Kanban Board"}
        subtitle={project ? `${project.client_name} · ${total} ${total === 1 ? "task" : "tasks"}` : "Plan, move and review this project's tasks."}
        back="/project/kanban"
        backLabel="All projects"
      >
        <button type="button" className="bp-btn navy" onClick={() => { setShowTaskForm(true); setFormError(""); }}><Plus size={16} /> New Task</button>
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">TO DO</p><span className="pm-ico navy"><ListTodo size={20} /></span></div>
          <p className="bp-stat-value">{count("PENDING") + count("ON_HOLD")}</p>
          <p className="pm-foot"><span>{count("ON_HOLD")} on hold</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">IN PROGRESS</p><span className="pm-ico soft"><Gauge size={20} /></span></div>
          <p className="bp-stat-value">{count("IN_PROGRESS")}</p>
          <p className="pm-foot"><span>Being worked on</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">IN REVIEW</p><span className="pm-ico orange"><Eye size={20} /></span></div>
          <p className="bp-stat-value tr-orange">{count("IN_REVIEW") + count("NEEDS_FIXES")}</p>
          <p className="pm-foot"><span className={count("NEEDS_FIXES") ? "pm-warn" : ""}>{count("NEEDS_FIXES")} need fixes</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">COMPLETED</p><span className="pm-ico green"><CircleCheck size={20} /></span></div>
          <p className="bp-stat-value">{count("COMPLETED")}</p>
          <p className="pm-foot"><span className="pm-ok">{total ? Math.round((count("COMPLETED") * 100) / total) : 0}% of all tasks</span></p>
        </div>
      </div>

      <div className="bp-panel pm-toolbar">
        <label className="bp-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks, requirements, milestones…" />
        </label>
        <div className="pm-toolbar-right">
          <label className="bp-select">
            <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="">All assignees</option>
              {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="pm-check">
            <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} /> Hide empty extra columns
          </label>
        </div>
      </div>

      {loading ? (
        <p className="bp-loading">Loading the board…</p>
      ) : (
        <div className="pm-board">
          {visibleColumns.map((col) => {
            const tasks = (board[col.key] || []).filter(matches);
            return (
              <div key={col.key} className="pm-bcol">
                <div className="pm-bcol-head">
                  <span><i className={`pm-dot ${col.dot}`} /> {col.label}</span>
                  <b>{tasks.length}</b>
                </div>
                {tasks.length === 0 ? (
                  <p className="pm-bcol-empty">No tasks here</p>
                ) : tasks.map((task) => (
                  <TaskCard
                    key={task.task_id}
                    task={task}
                    column={col.key}
                    onStatusChange={handleStatusChange}
                    requirementsMap={requirementsMap}
                    milestonesMap={milestonesMap}
                    onOpenSubmit={openSubmitModal}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {showTaskForm && (
        <div className="bp-modal-backdrop" onClick={() => !creating && setShowTaskForm(false)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Task</h2>
            <p className="bp-sub">Adds a task to this project&apos;s board.</p>
            <div className="bp-form-grid">
              <label className="bp-field full"><span>Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
              </label>
              <label className="bp-field full"><span>Description</span>
                <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label className="bp-field"><span>Priority</span>
                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </label>
              <label className="bp-field"><span>Due date</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
              <label className="bp-field full"><span>Assign to</span>
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => <option key={m.project_team_member_id} value={m.project_team_member_id}>{m.name} ({m.project_role})</option>)}
                </select>
              </label>
              <label className="bp-field"><span>Linked requirement</span>
                <select value={linkedRequirement} onChange={(e) => setLinkedRequirement(e.target.value)}>
                  <option value="">None</option>
                  {requirements.map((r) => <option key={r.project_requirement_id} value={r.project_requirement_id}>{r.requirement_title}</option>)}
                </select>
              </label>
              <label className="bp-field"><span>Linked milestone</span>
                <select value={linkedMilestone} onChange={(e) => setLinkedMilestone(e.target.value)}>
                  <option value="">None</option>
                  {milestones.map((m) => <option key={m.project_milestone_id} value={m.project_milestone_id}>{m.milestone_name}</option>)}
                </select>
              </label>
            </div>
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setShowTaskForm(false)} disabled={creating}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={createTask} disabled={creating}>{creating ? "Creating…" : "Create Task"}</button>
            </div>
          </div>
        </div>
      )}

      {submitTask && (
        <div className="bp-modal-backdrop" onClick={() => !submitting && setSubmitTask(null)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Submit Work</h2>
            <p className="bp-sub">{submitTask.title}</p>
            <div className="bp-form-grid">
              <label className="bp-field full"><span>Link</span>
                <input value={submissionUrl} onChange={(e) => setSubmissionUrl(e.target.value)} placeholder="GitHub PR, live URL, etc." />
              </label>
              <label className="bp-field full"><span>Notes (optional)</span>
                <textarea rows={3} value={submissionNotes} onChange={(e) => setSubmissionNotes(e.target.value)} />
              </label>
              <label className="bp-field full"><span>Attachment (optional)</span>
                <input type="file" onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            {submitError && <p className="bp-form-error">{submitError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setSubmitTask(null)} disabled={submitting}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={submitWork} disabled={submitting}>{submitting ? "Submitting…" : "Submit"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanBoard;
