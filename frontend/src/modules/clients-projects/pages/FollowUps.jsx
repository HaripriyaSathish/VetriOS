import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../../api/client";

const TYPE_LABELS = {
  EMAIL: "Email",
  PHONE: "Phone Call",
  MEETING: "Meeting",
  CHAT: "Chat",
  VIDEO_CALL: "Video Call",
  OTHER: "Other",
};

function FollowUps() {
  const { clientId } = useParams();
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [commType, setCommType] = useState("PHONE");
  const [subject, setSubject] = useState("");
  const [commDate, setCommDate] = useState("");
  const [summary, setSummary] = useState("");
  const [nextFollowup, setNextFollowup] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    client.get(`/api/projects/clients/${clientId}/follow-ups/`)
      .then(({ data }) => setFollowUps(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load follow-ups."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const logFollowUp = async () => {
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      await client.post(`/api/projects/clients/${clientId}/follow-ups/`, {
        communication_type: commType,
        subject,
        communication_date: commDate || undefined,
        summary,
        next_followup_date: nextFollowup || null,
      });
      setMessage("Follow-up logged.");
      setCommType("PHONE"); setSubject(""); setCommDate(""); setSummary(""); setNextFollowup("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't log follow-up.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/clients/follow-ups" className="text-sm text-blue-600 hover:underline">
        ← Back to Clients
      </Link>

      <div className="flex justify-between items-center mt-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Follow-Ups</h1>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
        >
          {showForm ? "Cancel" : "+ Log Follow-up"}
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Log Follow-up</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <select
              value={commType}
              onChange={(e) => setCommType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="PHONE">Phone Call</option>
              <option value="EMAIL">Email</option>
              <option value="MEETING">Meeting</option>
              <option value="CHAT">Chat</option>
              <option value="VIDEO_CALL">Video Call</option>
              <option value="OTHER">Other</option>
            </select>
            <input
              type="datetime-local"
              value={commDate}
              onChange={(e) => setCommDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <textarea
            placeholder="What was discussed / next steps"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <label className="text-xs text-gray-600 block mb-1">Next follow-up (optional)</label>
          <input
            type="datetime-local"
            value={nextFollowup}
            onChange={(e) => setNextFollowup(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
          />
          <button
            onClick={logFollowUp}
            disabled={creating}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Logging…" : "Log Follow-up"}
          </button>
        </div>
      )}

      {followUps.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No follow-ups logged yet.
        </div>
      ) : (
        <div className="space-y-3">
          {followUps.map((f) => (
            <div key={f.communication_id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="font-medium text-gray-900">{f.subject}</p>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  {TYPE_LABELS[f.communication_type] || f.communication_type}
                </span>
              </div>
              {f.summary && <p className="text-sm text-gray-700 mb-2">{f.summary}</p>}
              <p className="text-xs text-gray-600">
                {new Date(f.communication_date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>
              {f.next_followup_date && (
                <p className="text-xs text-blue-700 font-medium mt-1">
                  Next follow-up: {new Date(f.next_followup_date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FollowUps;