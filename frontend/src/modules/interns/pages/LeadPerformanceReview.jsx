import { useEffect, useState } from "react";
import client from "../../../api/client";

const SCORE_FIELDS = [
  { key: "technical_score", label: "Technical" },
  { key: "communication_score", label: "Communication" },
  { key: "teamwork_score", label: "Teamwork" },
  { key: "problem_solving_score", label: "Problem Solving" },
  { key: "overall_score", label: "Overall" },
];

function LeadPerformanceReview() {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [selectedIntern, setSelectedIntern] = useState(null);
  const [scores, setScores] = useState({});
  const [strengths, setStrengths] = useState("");
  const [improvementAreas, setImprovementAreas] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadInterns = () => {
    setLoading(true);
    setError("");
    client
      .get("/api/interns/lead/interns/")
      .then(({ data }) => setInterns(data || []))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your interns."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadInterns(); }, []);

  const openReviewForm = (intern) => {
    setSelectedIntern(intern);
    setScores({});
    setStrengths("");
    setImprovementAreas("");
    setFeedback("");
    setMessage("");
    setError("");
  };

  const closeReviewForm = () => setSelectedIntern(null);

  const updateScore = (key, value) => {
    setScores((prev) => ({ ...prev, [key]: value }));
  };

  const submitReview = async () => {
    if (!selectedIntern) return;
    setSubmitting(true);
    setError("");
    try {
      await client.post(`/api/interns/lead/interns/${selectedIntern.intern_id}/performance/`, {
        ...scores,
        strengths,
        improvement_areas: improvementAreas,
        feedback,
        review_status: "COMPLETED",
      });
      setMessage(`Review submitted for ${selectedIntern.name}.`);
      closeReviewForm();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit the review.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Intern Performance Review</h1>
      <p className="text-gray-500 mb-6">Submit a periodic review for an intern reporting to you.</p>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {interns.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No interns reporting to you yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {interns.map((i) => (
            <div
              key={i.intern_id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-gray-900">{i.name}</p>
                <p className="text-xs text-gray-500">
                  {i.intern_code} · Status: {i.status}
                  {i.internship_end_date ? ` · Ends: ${i.internship_end_date}` : ""}
                </p>
              </div>
              <button
                onClick={() => openReviewForm(i)}
                className="bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs font-semibold"
              >
                Submit Review
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedIntern && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Performance Review</h2>
            <p className="text-xs text-gray-500 mb-4">{selectedIntern.name}</p>

            {SCORE_FIELDS.map((f) => (
              <div key={f.key} className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">{f.label} (0–100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scores[f.key] || ""}
                  onChange={(e) => updateScore(f.key, e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            ))}

            <textarea
              placeholder="Strengths"
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
            />
            <textarea
              placeholder="Areas to improve"
              value={improvementAreas}
              onChange={(e) => setImprovementAreas(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
            />
            <textarea
              placeholder="General feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={closeReviewForm}
                className="px-4 py-2 rounded-md text-sm font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={submitReview}
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeadPerformanceReview;