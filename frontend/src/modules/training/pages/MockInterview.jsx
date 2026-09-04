import { useEffect, useState } from "react";
import client from "../../../api/client";

function MockInterview() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [eligibility, setEligibility] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [interviewDate, setInterviewDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("intermediate");
  const [questionCount, setQuestionCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState("");

  useEffect(() => {
    client.get("/api/training/dashboard/").then(({ data }) => {
      const b = data.batches || [];
      setBatches(b);
      if (b.length > 0) setSelectedBatchId(b[0].batch_id);
    });
  }, []);

  useEffect(() => {
    if (selectedBatchId) loadEligibility();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId]);

  const loadEligibility = async () => {
    setLoading(true);
    try {
      const { data } = await client.get(`/api/training/batches/${selectedBatchId}/mock-interview-eligibility/`);
      setEligibility(data);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (enrollmentId) => {
    const next = new Set(selected);
    next.has(enrollmentId) ? next.delete(enrollmentId) : next.add(enrollmentId);
    setSelected(next);
  };

  const generateQuestions = async () => {
    if (!topic.trim()) {
      setError("Enter a topic first.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const { data } = await client.post("/api/training/mock-interview-questions/generate/", {
        topic, count: questionCount, level,
      });
      setGeneratedQuestions(data.questions);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't generate questions.");
    } finally {
      setGenerating(false);
    }
  };

  const invite = async () => {
    if (!interviewDate || selected.size === 0) {
      setError("Pick a date and select at least one eligible student.");
      return;
    }
    setInviting(true);
    setError("");
    try {
      const { data } = await client.post(`/api/training/batches/${selectedBatchId}/mock-interview-eligibility/`, {
        interview_date: interviewDate,
        enrollment_ids: Array.from(selected),
        questions: generatedQuestions,
      });
      setMessage(`Invited ${data.invited_count} student(s).`);
      setSelected(new Set());
      loadEligibility();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't send invites.");
    } finally {
      setInviting(false);
    }
  };

  const updateResult = async (id, field, value) => {
    try {
      await client.patch(`/api/training/student-assessments/${id}/`, { [field]: value });
      loadEligibility();
    } catch (err) {
      setError("Couldn't update result.");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Mock Interview</h1>
      <p className="text-gray-500 mb-6">Invite eligible students (85%+ attendance) and record outcomes.</p>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Generate Interview Questions with AI</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Topic</label>
            <input
              value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. React Hooks, SQL Joins, System Design"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Level</label>
            <div className="flex gap-1">
              {[
                { value: "easy", label: "Easy", color: "bg-green-600" },
                { value: "intermediate", label: "Intermediate", color: "bg-amber-600" },
                { value: "advanced", label: "Advanced", color: "bg-red-600" },
              ].map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLevel(l.value)}
                  className={`px-3 py-2 rounded-md text-xs font-semibold border ${
                    level === l.value ? `${l.color} text-white border-transparent` : "bg-white text-gray-600 border-gray-300"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Number of Questions</label>
            <select
              value={questionCount} onChange={(e) => setQuestionCount(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button onClick={generateQuestions} disabled={generating} className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
            {generating ? "Generating…" : "Generate Questions"}
          </button>
        </div>

        {generatedQuestions && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4 whitespace-pre-wrap text-sm text-gray-700 max-h-72 overflow-y-auto">
            {generatedQuestions}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Batch</label>
            <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
              {batches.map((b) => (
  <option key={b.batch_id} value={b.batch_id}>
    {b.batch_name}{b.trainer_name ? ` — ${b.trainer_name}` : " — Unassigned"}
  </option>
))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Interview Date</label>
            <input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <button onClick={invite} disabled={inviting} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
            {inviting ? "Sending…" : `Invite ${selected.size} Selected`}
          </button>
        </div>
        {generatedQuestions && (
          <p className="text-xs text-gray-500 mt-2">The generated questions above will be attached to this interview when you invite students.</p>
        )}
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2 text-left">Student</th>
                <th className="px-4 py-2 text-left">Attendance</th>
                <th className="px-4 py-2 text-left">Eligible</th>
                <th className="px-4 py-2 text-left">Result</th>
                <th className="px-4 py-2 text-left">Score</th>
                <th className="px-4 py-2 text-left">Feedback / Link</th>
              </tr>
            </thead>
            <tbody>
              {eligibility.map((e) => (
                <tr key={e.enrollment_id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    {!e.invited && e.eligible && (
                      <input type="checkbox" checked={selected.has(e.enrollment_id)} onChange={() => toggle(e.enrollment_id)} />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{e.student_name}</td>
                  <td className="px-4 py-3 font-mono">{e.attendance_percentage}%</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${e.eligible ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {e.eligible ? "Eligible" : "Not Yet"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {e.invited ? (
                      <select
                        value={e.result_status || "PENDING"}
                        onChange={(ev) => updateResult(e.student_assessment_id, "result_status", ev.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                        <option value="ABSENT">Absent</option>
                      </select>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {e.invited ? (
                      <input
                        type="number" min="0" max="100" defaultValue={e.score ?? ""}
                        onBlur={(ev) => updateResult(e.student_assessment_id, "score", ev.target.value)}
                        className="w-16 border border-gray-300 rounded-md px-2 py-1 text-xs"
                      />
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {e.invited ? (
                      <input
                        defaultValue={e.feedback || ""}
                        placeholder="Meeting link / feedback"
                        onBlur={(ev) => updateResult(e.student_assessment_id, "feedback", ev.target.value)}
                        className="w-56 border border-gray-300 rounded-md px-2 py-1 text-xs"
                      />
                    ) : "—"}
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

export default MockInterview;