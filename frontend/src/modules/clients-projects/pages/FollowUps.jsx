import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, MessageCircle, CalendarClock, BellRing, Search, ChevronDown } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import useClientName from "../components/useClientName";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const TYPE_LABELS = {
  EMAIL: "Email",
  PHONE: "Phone Call",
  MEETING: "Meeting",
  CHAT: "Chat",
  VIDEO_CALL: "Video Call",
  OTHER: "Other",
};

const fmt = (d) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

function FollowUps() {
  const { clientId } = useParams();
  const clientName = useClientName(clientId);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [commType, setCommType] = useState("PHONE");
  const [subject, setSubject] = useState("");
  const [commDate, setCommDate] = useState("");
  const [summary, setSummary] = useState("");
  const [nextFollowup, setNextFollowup] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchFollowUps = () =>
    client.get(`/api/projects/clients/${clientId}/follow-ups/`)
      .then(({ data }) => setFollowUps(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load follow-ups."))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchFollowUps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const logFollowUp = async () => {
    if (!subject.trim()) {
      setFormError("Subject is required.");
      return;
    }
    setCreating(true);
    setFormError("");
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
      fetchFollowUps();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't log follow-up.");
    } finally {
      setCreating(false);
    }
  };

  const now = new Date();
  const due = followUps.filter((f) => f.next_followup_date && new Date(f.next_followup_date) <= new Date(now.getTime() + 7 * 86400000));
  const overdueCount = due.filter((f) => new Date(f.next_followup_date) < now).length;
  const visible = followUps.filter((f) => {
    if (typeFilter && f.communication_type !== typeFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || [f.subject, f.summary].some((v) => (v || "").toLowerCase().includes(q));
  });

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        eyebrow="Client Management"
        section="Follow-Ups"
        title={clientName ? `${clientName} Follow-Ups` : "Follow-Ups"}
        subtitle="Every call, email and chat with this client, and when to reach out next."
        back="/clients/follow-ups"
        backLabel="All clients"
      >
        <button type="button" className="bp-btn navy" onClick={() => { setShowForm(true); setFormError(""); }}><Plus size={16} /> Log Follow-up</button>
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">FOLLOW-UPS</p><span className="pm-ico navy"><MessageCircle size={20} /></span></div>
          <p className="bp-stat-value">{followUps.length}</p>
          <p className="pm-foot"><span>Logged communications</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">NEXT 7 DAYS</p><span className="pm-ico orange"><BellRing size={20} /></span></div>
          <p className="bp-stat-value tr-orange">{due.length}</p>
          <p className="pm-foot"><span className={overdueCount ? "pm-warn" : ""}>{overdueCount} overdue</span></p>
        </div>
      </div>

      <div className="bp-panel pm-toolbar">
        <label className="bp-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search follow-ups…" />
        </label>
        <label className="bp-select">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
      </div>

      {loading ? (
        <p className="bp-loading">Loading follow-ups…</p>
      ) : visible.length === 0 ? (
        <p className="bp-panel pm-empty-panel">{followUps.length ? "No follow-ups match these filters." : "No follow-ups logged yet."}</p>
      ) : (
        <div className="pm-list">
          {visible.map((f, idx) => {
            const late = f.next_followup_date && new Date(f.next_followup_date) < now;
            return (
              <article key={f.communication_id} className="bp-panel pm-item" style={{ "--i": idx }}>
                <div className="pm-item-top">
                  <div>
                    <h3 className="pm-item-title">{f.subject}</h3>
                    <p className="pm-item-meta"><span><CalendarClock size={12} /> {fmt(f.communication_date)}</span></p>
                  </div>
                  <span className="bp-chip blue">{TYPE_LABELS[f.communication_type] || f.communication_type}</span>
                </div>
                {f.summary && <p className="pm-item-text">{f.summary}</p>}
                {f.next_followup_date && (
                  <div className="pm-item-foot">
                    <span className={late ? "pm-warn" : "pm-warm"}><BellRing size={12} /> Next follow-up: {fmt(f.next_followup_date)}{late ? " (overdue)" : ""}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="bp-modal-backdrop" onClick={() => !creating && setShowForm(false)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Log Follow-up</h2>
            <p className="bp-sub">Record a communication with {clientName || "this client"}.</p>
            <div className="bp-form-grid">
              <label className="bp-field"><span>Type</span>
                <select value={commType} onChange={(e) => setCommType(e.target.value)}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="bp-field"><span>When</span>
                <input type="datetime-local" value={commDate} onChange={(e) => setCommDate(e.target.value)} />
              </label>
              <label className="bp-field full"><span>Subject</span>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
              <label className="bp-field full"><span>Summary</span>
                <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What was discussed / next steps" />
              </label>
              <label className="bp-field full"><span>Next follow-up (optional)</span>
                <input type="datetime-local" value={nextFollowup} onChange={(e) => setNextFollowup(e.target.value)} />
              </label>
            </div>
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setShowForm(false)} disabled={creating}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={logFollowUp} disabled={creating}>{creating ? "Logging…" : "Log Follow-up"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FollowUps;
