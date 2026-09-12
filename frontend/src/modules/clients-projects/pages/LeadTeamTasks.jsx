import { useEffect, useState } from "react";
import client from "../../../api/client";

function LeadTeamTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Testing-report modal state
  const [reportModalTask, setReportModalTask] = useState(null);
  const [reportText, setReportText] = useState("");
  const [reportStatus, setReportStatus] = useState("APPROVED");
  const [reportAttachment, setReportAttachment] = useState(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    client
      .get("/api/projects/my-team-tasks/")
      .then(({ data }) => setTasks(data || []))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your team's tasks."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openReportModal = (t) => {
    setReportModalTask(t);
    setReportText("");
    setReportStatus("APPROVED");
    setReportAttachment(null);
    setMessage("");
    setError("");
  };

  const closeReportModal = () => setReportModalTask(null);

  const submitTestingReport = async () => {
    if (!reportModalTask) return;
    if (!reportText.trim()) {
      setError("Report text is required.");
      return;
    }
    setReportSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("project_task_id", reportModalTask.project_task_id);
      formData.append("report_text", reportText);
      formData.append("status", reportStatus);
      if (reportAttachment) formData.append("attachment", reportAttachment);

      await client.post("/api/interns/lead/testing-report/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("Testing report submitted.");
      closeReportModal();
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit testing report.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const statusBadgeClasses = (status) => {
    if (status === "COMPLETED" || status === "DONE") return "bg-green-100 text-green-700";
    if (status === "IN_PROGRESS") return "bg-blue-100 text-blue-700";
    return "bg-amber-100 text-amber-700"; // PENDING / TODO
  };

  const statusLabel = (status) => {
    if (status === "COMPLETED" || status === "DONE") return "Completed";
    if (status === "IN_PROGRESS") return "In Progress";
    return "Pending";
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Team Tasks</h1>
      <p className="text-gray-500 mb-6">
        Kanban tasks assigned to people who report to you. File a testing report once you've reviewed their work.
      </p>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {tasks.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No tasks from your team yet.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {tasks.map((t) => (
            <div key={t.project_task_id || t.task_id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-500">
                    {t.assignee_name ? `Assigned to: ${t.assignee_name} · ` : ""}
                    {t.project_name ? `Project: ${t.project_name} · ` : ""}
                    Due: {t.due_date || "—"}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeClasses(t.status)}`}>
                  {statusLabel(t.status)}
                </span>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm flex items-center justify-between">
                <p className="text-gray-500">Priority: {t.priority || "—"}</p>
                <button
                  onClick={() => openReportModal(t)}
                  disabled={!t.project_task_id}
                  className="bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40"
                >
                  File Testing Report
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reportModalTask && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Testing Report</h2>
            <p className="text-xs text-gray-500 mb-4">
              {reportModalTask.title} — {reportModalTask.assignee_name}
            </p>

            <textarea
              placeholder="What did you test? What passed or failed?"
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
            />

            <select
              value={reportStatus}
              onChange={(e) => setReportStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
            >
              <option value="APPROVED">Approved</option>
              <option value="NEEDS_FIXES">Needs Fixes</option>
            </select>

            <input
              type="file"
              onChange={(e) => setReportAttachment(e.target.files?.[0] || null)}
              className="w-full text-sm mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={closeReportModal}
                className="px-4 py-2 rounded-md text-sm font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={submitTestingReport}
                disabled={reportSubmitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
              >
                {reportSubmitting ? "Submitting…" : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeadTeamTasks;