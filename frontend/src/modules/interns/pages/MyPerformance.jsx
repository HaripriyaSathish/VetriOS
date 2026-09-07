import { useEffect, useState } from "react";
import client from "../../../api/client";

function ScoreBar({ label, value }) {
  const pct = value != null ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>{value != null ? `${value}/100` : "—"}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MyPerformance() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/api/interns/me/performance/")
      .then(({ data }) => setReviews(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load performance reviews."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Performance</h1>
      <p className="text-gray-500 mb-6">Periodic reviews from your project lead.</p>

      {reviews.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No performance reviews yet.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((r) => (
            <div key={r.performance_id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <p className="font-semibold text-gray-900">Review — {r.review_date}</p>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  {r.review_status}
                </span>
              </div>

              <ScoreBar label="Technical" value={r.technical_score} />
              <ScoreBar label="Communication" value={r.communication_score} />
              <ScoreBar label="Teamwork" value={r.teamwork_score} />
              <ScoreBar label="Problem Solving" value={r.problem_solving_score} />
              <ScoreBar label="Overall" value={r.overall_score} />

              {r.strengths && (
                <p className="text-sm text-gray-700 mt-3"><span className="font-semibold">Strengths:</span> {r.strengths}</p>
              )}
              {r.improvement_areas && (
                <p className="text-sm text-gray-700 mt-1"><span className="font-semibold">Areas to improve:</span> {r.improvement_areas}</p>
              )}
              {r.feedback && (
                <p className="text-sm text-gray-700 mt-1"><span className="font-semibold">Feedback:</span> {r.feedback}</p>
              )}
              <p className="text-xs text-gray-400 mt-3">Reviewed by {r.reviewer || "—"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyPerformance;