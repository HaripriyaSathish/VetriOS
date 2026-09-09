import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../../api/client";

const STATUS_STYLES = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  RESCHEDULED: "bg-amber-100 text-amber-700",
};

function Meetings() {
  const { clientId } = useParams();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingType, setMeetingType] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    client.get(`/api/projects/clients/${clientId}/meetings/`)
      .then(({ data }) => setMeetings(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load meetings."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const createMeeting = async () => {
    if (!title.trim() || !scheduledStart) {
      setError("Meeting title and start time are required.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      await client.post(`/api/projects/clients/${clientId}/meetings/`, {
        meeting_title: title,
        meeting_type: meetingType,
        scheduled_start: scheduledStart,
        meeting_location: location,
        agenda,
      });
      setMessage("Meeting scheduled.");
      setTitle(""); setMeetingType(""); setScheduledStart(""); setLocation(""); setAgenda("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't schedule meeting.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  const sorted = [...meetings].sort((a, b) => new Date(b.scheduled_start) - new Date(a.scheduled_start));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/clients/meetings" className="text-sm text-blue-600 hover:underline">
        ← Back to Clients
      </Link>

      <div className="flex justify-between items-center mt-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Meetings / Call Log</h1>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
        >
          {showForm ? "Cancel" : "+ Log Meeting"}
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">New Meeting</h3>
          <input
            placeholder="Meeting title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              placeholder="Type (e.g. Call, Video, In-person)"
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <input
            placeholder="Location / meeting link"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <textarea
            placeholder="Agenda"
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
          />
          <button
            onClick={createMeeting}
            disabled={creating}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Scheduling…" : "Log Meeting"}
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No meetings logged yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((m) => (
            <div key={m.meeting_id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="font-medium text-gray-900">{m.meeting_title}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[m.status] || STATUS_STYLES.SCHEDULED}`}>
                  {m.status}
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                {new Date(m.scheduled_start).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                {m.meeting_type && ` · ${m.meeting_type}`}
                {m.meeting_location && ` · ${m.meeting_location}`}
              </p>
              {m.agenda && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-gray-700">Agenda</p>
                  <p className="text-sm text-gray-700">{m.agenda}</p>
                </div>
              )}
              {m.meeting_notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-700">Notes</p>
                  <p className="text-sm text-gray-700">{m.meeting_notes}</p>
                </div>
              )}
              {m.created_by_name && (
                <p className="text-xs text-gray-500 mt-2">Logged by {m.created_by_name}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Meetings;