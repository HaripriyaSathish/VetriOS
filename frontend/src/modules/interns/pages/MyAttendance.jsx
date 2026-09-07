import { useEffect, useState } from "react";
import client from "../../../api/client";

function MyAttendance() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/api/interns/me/attendance/")
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your attendance."));
  }, []);

  if (error) return <p className="p-6 text-gray-400">{error}</p>;
  if (!data) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Attendance</h1>
      <p className="text-gray-500 mb-6">Your daily attendance record as an intern.</p>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase">Attendance %</p>
          <p className={`text-2xl font-bold mt-1 ${data.attendance_percentage >= 85 ? "text-green-600" : "text-red-600"}`}>
            {data.attendance_percentage != null ? `${data.attendance_percentage}%` : "—"}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase">Present Days</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.present_days}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase">Total Days</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.total_days}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {data.records.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">No records yet.</td></tr>
            ) : data.records.map((r, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-900">{r.date}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${r.status === "PRESENT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{r.remarks || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MyAttendance;