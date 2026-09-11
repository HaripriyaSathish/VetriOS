import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../../api/client";

const COLUMNS = [
  { key: "PENDING", label: "To Do" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "ON_HOLD", label: "On Hold" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

const PRIORITY_STYLES = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-red-100 text-red-700",
};

function TaskCard({ task, onStatusChange, requirementsMap, milestonesMap }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();

  const requirementTitle = task.requirement_id ? requirementsMap[task.requirement_id] : null;
  const milestoneName = task.milestone_id ? milestonesMap[task.milestone_id] : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3 relative">
      <p className="font-medium text-gray-900 text-sm mb-2">{task.title}</p>

      <div className="flex items-center flex-wrap gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.MEDIUM}`}>
          {task.priority}
        </span>
        {task.due_date && (
          <span className={`text-xs ${isOverdue ? "text-red-600" : "text-gray-600"}`}>
            Due {new Date(task.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>

      {(requirementTitle || milestoneName) && (
        <div className="flex flex-col gap-1 mb-2">
          {requirementTitle && (
            <span className="text-xs text-purple-700 bg-purple-50 rounded px-2 py-0.5 w-fit">
              → {requirementTitle}
            </span>
          )}
          {milestoneName && (
            <span className="text-xs text-teal-700 bg-teal-50 rounded px-2 py-0.5 w-fit">
              🎯 {milestoneName}
            </span>
          )}
        </div>
      )}

      {task.assignee && (
        <p className="text-xs text-gray-700 mb-2">
          Assigned to: <span className="font-medium">{task.assignee}</span>
        </p>
      )}

      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="w-full text-xs font-semibold text-blue-600 border border-gray-200 rounded-md py-1.5 hover:bg-blue-50"
      >
        Move to →
      </button>

      {menuOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-md z-10 overflow-hidden">
          {COLUMNS.filter((c) => c.key !== task.status).map((c) => (
            <button
              key={c.key}
              onClick={() => { onStatusChange(task.task_id, c.key); setMenuOpen(false); }}
              className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {c.label}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [linkedRequirement, setLinkedRequirement] = useState("");
  const [linkedMilestone, setLinkedMilestone] = useState("");
  const [creating, setCreating] = useState(false);

  const loadBoard = () => {
    return client.get(`/api/projects/${projectId}/kanban/`)
      .then(({ data }) => setBoard(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load the board."));
  };

  const loadTeam = () => {
    return client.get(`/api/projects/${projectId}/team/`)
      .then(({ data }) => setTeamMembers(data))
      .catch(() => {});
  };

  const loadRequirements = () => {
    return client.get(`/api/projects/${projectId}/requirements/`)
      .then(({ data }) => setRequirements(data))
      .catch(() => {});
  };

  const loadMilestones = () => {
    return client.get(`/api/projects/${projectId}/milestones/`)
      .then(({ data }) => setMilestones(data))
      .catch(() => {});
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadBoard(), loadTeam(), loadRequirements(), loadMilestones()])
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const requirementsMap = requirements.reduce((acc, r) => {
    acc[r.project_requirement_id] = r.requirement_title;
    return acc;
  }, {});

  const milestonesMap = milestones.reduce((acc, m) => {
    acc[m.project_milestone_id] = m.milestone_name;
    return acc;
  }, {});

  const handleStatusChange = async (taskId, newStatus) => {
    setBoard((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].filter((t) => t.task_id !== taskId);
      }
      return next;
    });
    try {
      await client.patch(`/api/projects/tasks/${taskId}/`, { status: newStatus });
    } finally {
      loadBoard();
    }
  };

  const createTask = async () => {
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }
    setCreating(true);
    setError("");
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
      setError(err.response?.data?.detail || "Couldn't create the task.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link to="/project/dashboard" className="text-sm text-blue-600 hover:underline">
        ← Back to Projects
      </Link>

      <div className="flex justify-between items-center mt-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Kanban Board</h1>
        <button
          onClick={() => setShowTaskForm((prev) => !prev)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
        >
          {showTaskForm ? "Cancel" : "+ New Task"}
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {showTaskForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">New Task</h3>
          <input
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          >
            <option value="">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.project_team_member_id} value={m.project_team_member_id}>
                {m.name} ({m.project_role})
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <select
              value={linkedRequirement}
              onChange={(e) => setLinkedRequirement(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">No linked requirement</option>
              {requirements.map((r) => (
                <option key={r.project_requirement_id} value={r.project_requirement_id}>
                  {r.requirement_title}
                </option>
              ))}
            </select>

            <select
              value={linkedMilestone}
              onChange={(e) => setLinkedMilestone(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">No linked milestone</option>
              {milestones.map((m) => (
                <option key={m.project_milestone_id} value={m.project_milestone_id}>
                  {m.milestone_name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={createTask}
            disabled={creating}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create Task"}
          </button>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const tasks = board[col.key] || [];
          return (
            <div key={col.key} className="min-w-[260px] flex-shrink-0">
              <div className="flex justify-between items-center px-1 mb-2">
                <span className="text-xs font-semibold text-gray-700">{col.label}</span>
                <span className="text-xs text-gray-600 bg-gray-100 rounded-full px-2 py-0.5 font-medium">
                  {tasks.length}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-2 min-h-[80px]">
                {tasks.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-5">No tasks here</p>
                ) : (
                  tasks.map((task) => (
                    <TaskCard
                      key={task.task_id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      requirementsMap={requirementsMap}
                      milestonesMap={milestonesMap}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default KanbanBoard;