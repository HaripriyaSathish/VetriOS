import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, CalendarCheck, CalendarClock, CircleCheck, MapPin, UserRound, Search } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import useClientName from "../components/useClientName";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const STATUS_CHIP = { SCHEDULED: "blue", IN_PROGRESS: "orange", COMPLETED: "green", CANCELLED: "red", POSTPONED: "orange" };

function Meetings() {
  const { clientId } = useParams();
  const clientName = useClientName(clientId);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingType, setMeetingType] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchMeetings = () =>
    client.get(`/api/projects/clients/${clientId}/meetings/`)
      .then(({ data }) => setMeetings(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load meetings."))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const createMeeting = async () => {
    if (!title.trim() || !scheduledStart) {
      setFormError("Meeting title and start time are required.");
      return;
    }
    setCreating(true);
    setFormError("");
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
      fetchMeetings();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't schedule meeting.");
    } finally {
      setCreating(false);
    }
  };

  const now = new Date();
  const sorted = [...meetings].sort((a, b) => new Date(b.scheduled_start) - new Date(a.scheduled_start));
  const upcoming = meetings.filter((m) => new Date(m.scheduled_start) >= now && m.status !== "CANCELLED");
  const next = [...upcoming].sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start))[0];
  const visible = sorted.filter((m) => {
    const q = search.trim().toLowerCase();
    return !q || [m.meeting_title, m.meeting_type, m.agenda, m.meeting_notes].some((v) => (v || "").toLowerCase().includes(q));
  });

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        eyebrow="Client Management"
        section="Meetings / Call Log"
        title={clientName ? `${clientName} Meetings` : "Meetings / Call Log"}
        subtitle="Calls, video meetings and visits with this client."
        back="/clients/meetings"
        backLabel="All clients"
      >
        <button type="button" className="bp-btn navy" onClick={() => { setShowForm(true); setFormError(""); }}><Plus size={16} /> Log Meeting</button>
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">MEETINGS</p><span className="pm-ico navy"><CalendarCheck size={20} /></span></div>
          <p className="bp-stat-value">{meetings.length}</p>
          <p className="pm-foot"><span>{meetings.filter((m) => m.status === "COMPLETED").length} completed</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">UPCOMING</p><span className="pm-ico orange"><CalendarClock size={20} /></span></div>
          <p className="bp-stat-value tr-orange">{upcoming.length}</p>
          <p className="pm-foot"><span>{next ? `Next ${new Date(next.scheduled_start).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : "Nothing scheduled"}</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">WITH NOTES</p><span className="pm-ico green"><CircleCheck size={20} /></span></div>
          <p className="bp-stat-value">{meetings.filter((m) => m.meeting_notes).length}</p>
          <p className="pm-foot"><span>Meetings with minutes</span></p>
        </div>
      </div>

      <div className="bp-panel pm-toolbar">
        <h3 className="pm-panel-title">Call Log</h3>
        <label className="bp-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search meetings…" />
        </label>
      </div>

      {loading ? (
        <p className="bp-loading">Loading meetings…</p>
      ) : visible.length === 0 ? (
        <p className="bp-panel pm-empty-panel">{meetings.length ? "No meetings match your search." : "No meetings logged yet."}</p>
      ) : (
        <div className="pm-list">
          {visible.map((m, idx) => (
            <article key={m.meeting_id} className="bp-panel pm-item" style={{ "--i": idx }}>
              <div className="pm-item-top">
                <div>
                  <h3 className="pm-item-title">{m.meeting_title}</h3>
                  <p className="pm-item-meta">
                    <span><CalendarClock size={12} /> {new Date(m.scheduled_start).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                    {m.meeting_type && <span>{m.meeting_type}</span>}
                    {m.meeting_location && <span><MapPin size={12} /> {m.meeting_location}</span>}
                  </p>
                </div>
                <span className={`bp-chip ${STATUS_CHIP[m.status] || "blue"}`}>{m.status}</span>
              </div>
              {m.agenda && <div><p className="pm-section-label">Agenda</p><p className="pm-item-text">{m.agenda}</p></div>}
              {m.meeting_notes && <div><p className="pm-section-label">Notes</p><p className="pm-item-text">{m.meeting_notes}</p></div>}
              {m.created_by_name && <div className="pm-item-foot"><span><UserRound size={12} /> Logged by {m.created_by_name}</span></div>}
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <div className="bp-modal-backdrop" onClick={() => !creating && setShowForm(false)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Log Meeting</h2>
            <p className="bp-sub">Schedule or record a meeting with {clientName || "this client"}.</p>
            <div className="bp-form-grid">
              <label className="bp-field full"><span>Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="bp-field"><span>Type</span>
                <input value={meetingType} onChange={(e) => setMeetingType(e.target.value)} placeholder="Call, Video, In-person" />
              </label>
              <label className="bp-field"><span>Starts</span>
                <input type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} />
              </label>
              <label className="bp-field full"><span>Location / meeting link</span>
                <input value={location} onChange={(e) => setLocation(e.target.value)} />
              </label>
              <label className="bp-field full"><span>Agenda</span>
                <textarea rows={3} value={agenda} onChange={(e) => setAgenda(e.target.value)} />
              </label>
            </div>
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setShowForm(false)} disabled={creating}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={createMeeting} disabled={creating}>{creating ? "Scheduling…" : "Log Meeting"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Meetings;
