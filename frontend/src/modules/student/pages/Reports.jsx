import { useState } from "react";
import client from "../../../api/client";

function Reports() {
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState("");

  const download = async (period) => {
    setDownloading(period);
    setError("");
    try {
      const response = await client.get(`/api/student/reports/${period}/download/`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${period}_zone_report.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to download report.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Batch Performance Reports</h1>
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="text-sm text-gray-500 mb-5">Download your batch's zone report — attendance, task completion, and zone status.</p>
        <div className="flex gap-3">
          <button onClick={() => download("weekly")} disabled={downloading !== null} className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
            {downloading === "weekly" ? "Downloading…" : "Weekly Report"}
          </button>
          <button onClick={() => download("monthly")} disabled={downloading !== null} className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
            {downloading === "monthly" ? "Downloading…" : "Monthly Report"}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </div>
    </div>
  );
}

export default Reports;