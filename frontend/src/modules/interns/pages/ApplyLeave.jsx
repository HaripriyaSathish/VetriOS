import { useEffect, useState } from "react";
import client from "../../../api/client";

function ApplyLeave() {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const load = () => {
    Promise.all([
      client.get("/api/interns/leave-types/"),
      client.get("/api/interns/me/leave/"),
    ]).then(([typesRes, leavesRes]) => {
      setLeaveTypes(typesRes.data);
      setLeaves(leavesRes.data);
    }).catch((err) => setError(err.response?.data?.detail || "Couldn't load leave data."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!leaveTypeId || !startDate || !endDate) {
      setError("Leave type, start date, and end date are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await client.post("/api/interns/me/leave/", {
        leave_type_id: leaveTypeId, start_date: startDate, end_date: endDate, reason,
      });
      setMessage("Leave application submitted.");
      setLeaveTypeId(""); setStartDate(""); setEndDate(""); setReason("");
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit leave application.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Apply Leave</h1>
      <p className="text-gray-500 mb-6">Submit a leave request and track its status.</p>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Leave Type</label>
            <select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="">Select…</option>
              {leaveTypes.map((t) => (
                <option key={t.leave_type_id} value={t.leave_type_id}>{t.name}{t.is_paid ? "" : " (Unpaid)"}</option>
              ))}
            </select>
          </div>
          <div />
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Reason</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4" />
        <button onClick={submit} disabled={submitting}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
          {submitting ? "Submitting…" : "Submit Application"}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Dates</th>
              <th className="px-4 py-2 text-left">Days</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {leaves.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No leave applications yet.</td></tr>
            ) : leaves.map((l) => (
              <tr key={l.leave_id} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-900">{l.leave_type}</td>
                <td className="px-4 py-3 text-gray-500">{l.start_date} – {l.end_date}</td>
                <td className="px-4 py-3 text-gray-500">{l.total_days ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    l.status === "APPROVED" ? "bg-green-100 text-green-700" :
                    l.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {l.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ApplyLeave;