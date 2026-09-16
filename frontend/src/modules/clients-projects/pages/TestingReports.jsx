import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../../api/client";

function TestingReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fixDrafts, setFixDrafts] = useState({});
  const [submitting, setSubmitting] = useState(null);

  const load = () => {
    client.get("/api/projects/my-testing-reports/")
      .then(({ data }) => setReports(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load testing reports."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const updateDraft = (reportId, field, value) => {
    setFixDrafts((prev) => ({
      ...prev,
      [reportId]: { ...prev[reportId], [field]: value },
    }));
  };

  const submitFix = async (reportId) => {
    const draft = fixDrafts[reportId] || {};
    if (!draft.resolution_link && !draft.resolution_notes) return;
    setSubmitting(reportId);
    try {
      await client.post(`/api/interns/testing-report/${reportId}/resolve/`, {
        resolution_link: draft.resolution_link || "",
        resolution_notes: draft.resolution_notes || "",
      });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit fix.");
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to="/project/dashboard" className="text-sm text-blue-600 hover:underline">
        ← Back to Projects
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mt-3 mb-1">Testing Reports</h1>
      <p className="text-gray-500 mb-6">Feedback from your lead on task submissions.</p>

      {reports.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No testing reports yet.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((r) => (
            <div key={r.report_id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-gray-900">{r.task_title}</p>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${r.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {r.status === "APPROVED" ? "Approved" : "Needs Fixes"}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{r.report_text}</p>
              {r.attachment_url && (
                <a href={r.attachment_url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline block mb-2">
                  View Attachment
                </a>
              )}
              <p className="text-xs text-gray-400 mb-3">
                {r.created_by} — {new Date(r.created_at).toLocaleString()}
              </p>

              {r.resolution_link || r.resolution_notes ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Fix submitted</p>
                  {r.resolution_link && (
                    <a href={r.resolution_link} target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline block">
                      {r.resolution_link}
                    </a>
                  )}
                  {r.resolution_notes && (
                    <p className="text-sm text-gray-600 mt-1">{r.resolution_notes}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(r.resolved_at).toLocaleString()}
                  </p>
                </div>
              ) : r.status === "NEEDS_FIXES" ? (
                <div className="border-t border-gray-100 pt-3 mt-2">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Submit your fix</p>
                  <input
                    type="text"
                    placeholder="Live link or PR URL"
                    value={fixDrafts[r.report_id]?.resolution_link || ""}
                    onChange={(e) => updateDraft(r.report_id, "resolution_link", e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-2"
                  />
                  <textarea
                    placeholder="Notes (optional)"
                    value={fixDrafts[r.report_id]?.resolution_notes || ""}
                    onChange={(e) => updateDraft(r.report_id, "resolution_notes", e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-2"
                    rows={2}
                  />
                  <button
                    onClick={() => submitFix(r.report_id)}
                    disabled={submitting === r.report_id}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
                  >
                    {submitting === r.report_id ? "Submitting…" : "Submit Fix"}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TestingReports;