import { useEffect, useState } from "react";
import client from "../../../api/client";

function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState({}); // task_key -> {note, links}
  const [submitting, setSubmitting] = useState(null);

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
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit task.");
    } finally {
      setSubmitting(null);
    }
  };

  const statusBadgeClasses = (status) => {
    if (status === "COMPLETED" || status === "DONE") return "bg-green-100 text-green-700";
    if (status === "SUBMITTED" || status === "IN_PROGRESS") return "bg-blue-100 text-blue-700";
    if (status === "NEEDS_FIXES") return "bg-red-100 text-red-700";
    return "bg-amber-100 text-amber-700"; // PENDING / TODO
  };

  const statusLabel = (status) => {
    if (status === "NEEDS_FIXES") return "Needs Fixes";
    if (status === "COMPLETED" || status === "DONE") return "Completed";
    if (status === "SUBMITTED") return "Submitted";
    if (status === "IN_PROGRESS") return "In Progress";
    return "Pending";
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Tasks</h1>
      <p className="text-gray-500 mb-6">
        Tasks assigned by your project lead, and project tasks assigned to you on the Kanban board.
      </p>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {tasks.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No tasks assigned yet.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {tasks.map((t) => {
            if (t.source === "intern") {
              const canSubmit = t.status !== "COMPLETED";
              return (
                <div key={t.key} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{t.title}</p>
                      <p className="text-xs text-gray-500">Due: {t.due_date}</p>
                      <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                        Intern task
                      </span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeClasses(t.status)}`}>
                      {statusLabel(t.status)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">{t.description}</p>

                  {canSubmit ? (
                    <div className="space-y-2">
                      <textarea
                        placeholder="Add a note about your submission…"
                        value={drafts[t.key]?.note || ""}
                        onChange={(e) => updateDraft(t.key, "note", e.target.value)}
                        rows={2}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                      <input
                        placeholder="Links (repo, deployment, etc.)"
                        value={drafts[t.key]?.links || ""}
                        onChange={(e) => updateDraft(t.key, "links", e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => submitInternTask(t)}
                        disabled={submitting === t.key}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
                      >
                        {submitting === t.key
                          ? "Submitting…"
                          : t.status === "NEEDS_FIXES" ? "Resubmit Task" : "Submit Task"}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm">
                      <p className="text-gray-700 mb-1"><span className="font-semibold">Your note:</span> {t.student_note || "—"}</p>
                      <p className="text-gray-700"><span className="font-semibold">Links:</span> {t.links || "—"}</p>
                      {t.status === "SUBMITTED" && (
                        <p className="text-xs text-gray-400 mt-2">Awaiting review from your project lead.</p>
                      )}
                      {(t.status === "COMPLETED") && (
                        <p className="text-xs text-green-600 mt-2">✓ Approved — no further action needed.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // Kanban task — read-only. Status changes on the board; testing
            // reports are filed by the lead on their own Team Tasks page.
            return (
              <div key={t.key} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{t.title || t.task_title}</p>
                    <p className="text-xs text-gray-500">
                      {t.project_name ? `Project: ${t.project_name} · ` : ""}Due: {t.due_date}
                    </p>
                    <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                      Kanban task
                    </span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeClasses(t.status)}`}>
                    {statusLabel(t.status)}
                  </span>
                </div>

                {t.description && <p className="text-sm text-gray-600 mb-3">{t.description}</p>}

                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm">
                  <p className="text-gray-500">Update progress on the project Kanban board.</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MyTasks;