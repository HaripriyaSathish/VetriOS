import { useEffect, useState } from "react";
import client from "../../../api/client";

const COMPLETION_OUTCOMES = [
  { value: "CONVERTED_TO_EMPLOYEE", label: "Convert to Employee" },
  { value: "CERTIFICATE_ISSUED", label: "Issue Certificate (End Internship)" },
  { value: "DISCONTINUED", label: "Discontinued" },
  { value: "RESIGNED", label: "Resigned" },
  { value: "OTHER", label: "Other" },
];

function RecommendInternshipAction() {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [selectedIntern, setSelectedIntern] = useState(null);
  const [actionType, setActionType] = useState("completion"); // "completion" | "extension"
  const [outcome, setOutcome] = useState("CONVERTED_TO_EMPLOYEE");
  const [remarks, setRemarks] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      // Reuses the existing lead-scoped intern listing — adjust the
      // endpoint if your project-lead intern list lives elsewhere.
      const { data } = await client.get("/api/interns/lead/interns/");
      setInterns(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't load your interns.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setSelectedIntern(null);
    setActionType("completion");
    setOutcome("CONVERTED_TO_EMPLOYEE");
    setRemarks("");
    setNewEndDate("");
    setExtensionReason("");
  };

  const submitCompletion = async () => {
    setSubmitting(true);
    setError("");
    try {
      await client.post(`/api/interns/${selectedIntern.intern_id}/completion/recommend/`, {
        outcome,
        remarks,
      });
      setMessage(`Completion recommendation submitted for ${selectedIntern.name}.`);
      resetForm();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit recommendation.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitExtension = async () => {
    if (!newEndDate) {
      setError("New end date is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await client.post(`/api/interns/${selectedIntern.intern_id}/extension/recommend/`, {
        new_end_date: newEndDate,
        extension_reason: extensionReason,
      });
      setMessage(`Extension recommendation submitted for ${selectedIntern.name}.`);
      resetForm();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit recommendation.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Recommend Completion / Extension</h1>
      <p className="text-gray-500 mb-6">Recommend an internship completion outcome or an end-date extension for your interns.</p>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {!selectedIntern ? (
        interns.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
            No interns assigned to you right now.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {interns.map((i) => (
              <button
                key={i.intern_id}
                onClick={() => setSelectedIntern(i)}
                className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-blue-400 hover:shadow-sm transition"
              >
                <p className="font-semibold text-gray-900">{i.name}</p>
                <p className="text-xs text-gray-500">
                  {i.intern_code} · Status: {i.status}
                  {i.internship_end_date && ` · Ends ${new Date(i.internship_end_date).toLocaleDateString()}`}
                </p>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="font-semibold text-gray-900">{selectedIntern.name}</p>
              <p className="text-xs text-gray-500">{selectedIntern.intern_code}</p>
            </div>
            <button
              onClick={resetForm}
              className="text-xs font-semibold text-gray-500 hover:text-gray-700"
            >
              Change intern
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActionType("completion")}
              className={`px-4 py-2 rounded-md text-sm font-semibold ${
                actionType === "completion" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              Completion
            </button>
            <button
              onClick={() => setActionType("extension")}
              className={`px-4 py-2 rounded-md text-sm font-semibold ${
                actionType === "extension" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              Extension
            </button>
          </div>

          {actionType === "completion" ? (
            <>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Outcome</label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
              >
                {COMPLETION_OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <label className="block text-xs font-semibold text-gray-500 mb-1">Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
                placeholder="Optional notes for Business Team"
              />

              <button
                onClick={submitCompletion}
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Recommendation"}
              </button>
            </>
          ) : (
            <>
              {!selectedIntern.internship_end_date && (
                <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm mb-3">
                  This intern has no current end date on file — an extension can't be recommended until one is set.
                </p>
              )}

              <label className="block text-xs font-semibold text-gray-500 mb-1">New End Date</label>
              <input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                min={selectedIntern.internship_end_date || undefined}
                disabled={!selectedIntern.internship_end_date}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3 disabled:bg-gray-50"
              />

              <label className="block text-xs font-semibold text-gray-500 mb-1">Reason</label>
              <textarea
                value={extensionReason}
                onChange={(e) => setExtensionReason(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
                placeholder="Why does this internship need extending?"
              />

              <button
                onClick={submitExtension}
                disabled={submitting || !selectedIntern.internship_end_date}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Recommendation"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default RecommendInternshipAction;