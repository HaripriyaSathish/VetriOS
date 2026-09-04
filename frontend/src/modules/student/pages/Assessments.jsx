import { useEffect, useState } from "react";
import client from "../../../api/client";

function Pill({ label, tone }) {
  const tones = {
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    gray: "bg-gray-100 text-gray-600",
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${tones[tone]}`}>{label}</span>;
}

function CategoryTable({ block }) {
  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-2">
        <p className="font-semibold text-gray-900 text-sm">{block.label}</p>
        <p className="text-xs text-gray-500">{block.submitted} / {block.total} submitted</p>
      </div>
      {block.rows.length === 0 ? (
        <p className="text-sm text-gray-400">None assigned yet.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Due Date</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Score</th>
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-900">{r.title}</td>
                  <td className="px-4 py-2 text-gray-500">{r.due_date}</td>
                  <td className="px-4 py-2">
                    {!r.submitted ? <Pill label="Not submitted" tone="red" /> : r.on_time ? <Pill label="On time" tone="green" /> : <Pill label="Late" tone="amber" />}
                  </td>
                  <td className="px-4 py-2 text-gray-900">{r.score != null ? `${r.score} / 100` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Assessments() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/api/student/eligibility/")
      .then(({ data }) => setData(data))
      .catch(() => setError("Not enrolled in a batch yet."));
  }, []);

  if (error) return <p className="p-6 text-gray-400">{error}</p>;
  if (!data) return <p className="p-6 text-gray-400">Loading…</p>;

  const mock = data.mock_interview;

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex justify-between items-center mb-5">
          <p className="font-semibold text-gray-900">{data.batch_label}</p>
          <Pill label={data.batch_status === "COMPLETED" ? "Course Completed" : "Ongoing"} tone={data.batch_status === "COMPLETED" ? "gray" : "green"} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase">Attendance</p>
            <p className={`text-2xl font-bold mt-1 ${data.attendance_percentage >= 85 ? "text-green-600" : "text-red-600"}`}>{data.attendance_percentage}%</p>
            <p className="text-xs text-gray-500 mt-1">{data.present_days} / {data.total_days} days present</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase">Tasks</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{data.assignments_submitted} / {data.total_assignments}</p>
            <p className={`text-xs mt-1 ${data.all_on_time ? "text-green-600" : "text-red-600"}`}>{data.all_on_time ? "All submitted on time" : "Some missing or late"}</p>
          </div>
          <div className={`rounded-lg p-4 flex flex-col justify-center ${data.eligible ? "bg-green-50" : "bg-red-50"}`}>
            <p className={`font-bold text-sm ${data.eligible ? "text-green-700" : "text-red-700"}`}>
              {data.eligible ? "Mock Interview Eligible" : "Not Yet Eligible"}
            </p>
            <p className="text-xs text-gray-500 mt-1">Needs 85%+ attendance & all on-time</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="font-semibold text-gray-900 mb-4">Assignment Breakdown</p>
        {data.category_breakdown.map((block) => <CategoryTable key={block.category} block={block} />)}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="font-semibold text-gray-900 mb-4">Mock Interview</p>
        {!mock.invited ? (
          <p className="text-sm text-gray-500">You haven't been invited to a mock interview yet. Reach the eligibility criteria above and your trainer will send an invite.</p>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-900 mb-2">{mock.scheduled_date ? mock.scheduled_date : "Not scheduled yet"}</p>
              <Pill
                label={mock.result_status === "PENDING" ? "Awaiting session" : mock.result_status}
                tone={mock.result_status === "PENDING" ? "amber" : mock.result_status === "PASS" ? "green" : "red"}
              />
              {mock.feedback && <p className="text-sm text-gray-600 mt-3 max-w-md">{mock.feedback}</p>}
            </div>
            {mock.score != null && <span className="text-3xl font-bold text-green-600">{mock.score}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default Assessments;