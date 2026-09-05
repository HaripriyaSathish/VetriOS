import { useEffect, useState } from "react";
import client from "../../../api/client";

function StudentAttendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/api/student/attendance/")
      .then(({ data }) => setRecords(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load attendance."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Attendance</h1>

      {records.length === 0 ? (
        <p className="text-gray-400">No attendance recorded yet.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.attendance_date} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-mono">{r.attendance_date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${r.attendance_status === "PRESENT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {r.attendance_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default StudentAttendance;