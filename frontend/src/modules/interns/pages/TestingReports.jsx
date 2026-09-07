import { useEffect, useState } from "react";
import client from "../../../api/client";

function TestingReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/api/interns/me/testing-reports/")
      .then(({ data }) => setReports(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load testing reports."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Testing Reports</h1>
      <p className="text-gray-500 mb-6">Feedback from your project lead on task submissions.</p>

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
                <a href={r.attachment_url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline">
                  View Attachment
                </a>
              )}
              <p className="text-xs text-gray-400 mt-3">
                {r.created_by} — {new Date(r.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TestingReports;