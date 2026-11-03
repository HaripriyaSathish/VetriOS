import { useEffect, useMemo, useState } from "react";
import {
  MailPlus, MailCheck, Send, SendHorizontal, PenLine, Eye, CircleCheck, Search, Info,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/WelcomeEmails.css";

const DEFAULT_SUBJECT = "Welcome to VetriOS Training!";
const DEFAULT_BODY =
  "<p>Hi {{full_name}},</p><p>Welcome aboard! Your account has been created — we're excited to have you start your training journey with us.</p><p>Best,<br/>Vetri Technology Solutions</p>";

const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function WelcomeEmails() {
  const [enquiries, setEnquiries] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [cc, setCc] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState("queue");
  const [search, setSearch] = useState("");

  const loadData = async () => {
    setError("");
    try {
      const { data } = await client.get("/api/admissions/enquiries/");
      setEnquiries(data.filter((e) => e.status === "converted"));
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't load enquiries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const queued = useMemo(() => enquiries.filter((e) => !e.welcome_email_sent), [enquiries]);
  const sent = useMemo(() => enquiries.filter((e) => e.welcome_email_sent), [enquiries]);
  const sentToday = sent.filter((e) => e.welcome_email_sent_at && new Date(e.welcome_email_sent_at).toDateString() === new Date().toDateString()).length;

  const list = (view === "queue" ? queued : enquiries).filter((e) => {
    const q = search.trim().toLowerCase();
    return !q || [e.name, e.course_name, e.personal_email, e.official_email].some((v) => (v || "").toLowerCase().includes(q));
  });

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const sendTo = async (ids, key) => {
    if (ids.length === 0) {
      setError("Select at least one student.");
      return;
    }
    setSending(key);
    setError("");
    setResult(null);
    try {
      const { data } = await client.post("/api/admissions/send-welcome-email/", { enquiry_ids: ids, subject, body, cc });
      setResult(data);
      setSelected(new Set());
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't send emails.");
    } finally {
      setSending(null);
    }
  };

  if (loading) return <p className="bp-loading">Loading…</p>;

  const sample = queued[0] || enquiries[0];
  const previewHtml = body.replace(/\{\{\s*full_name\s*\}\}/g, sample ? sample.name : "Student Name");

  return (
    <div className="bp-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Student Communications › <span>Automated Outreach</span></p>
          <h1 className="bp-title">Welcome Emails</h1>
          <p className="bp-sub">Send induction emails to newly converted students and keep track of who has been welcomed.</p>
        </div>
      </div>

      {error && <p className="bp-error">{error}</p>}
      {result && (
        <p className="bp-notice">
          Sent to {result.sent_count} student(s).
          {result.skipped.length > 0 && ` ${result.skipped.length} skipped: ${result.skipped.map((s) => s.reason).join("; ")}`}
        </p>
      )}

      <div className="bp-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Queued Dispatches</p>
            <span className="bp-stat-icon"><MailPlus size={17} /></span>
          </div>
          <p className="bp-stat-value">{queued.length} {queued.length > 0 && <span className="bp-chip orange">Ready</span>}</p>
          <p className="bp-person-sub">Converted students not yet welcomed</p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Sent Today</p>
            <span className="bp-stat-icon"><MailCheck size={17} /></span>
          </div>
          <p className="bp-stat-value">{sentToday}</p>
          <p className="bp-person-sub">Welcome emails dispatched today</p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Total Welcomed</p>
            <span className="bp-stat-icon green"><CircleCheck size={17} /></span>
          </div>
          <p className="bp-stat-value">
            {sent.length}
            <span className="bp-chip green">{enquiries.length ? Math.round((sent.length / enquiries.length) * 100) : 0}% of students</span>
          </p>
          <div className="bp-meter"><span className="we-green" style={{ width: `${enquiries.length ? (sent.length / enquiries.length) * 100 : 0}%` }} /></div>
        </div>
      </div>

      <div className="we-layout">
        <div className="we-card">
          <div className="we-card-head">
            <div>
              <p className="we-eyebrow">Selected Blueprint</p>
              <h3>Template &amp; Quick Preview</h3>
            </div>
            <button type="button" className={`bp-btn small ${editing ? "outline" : "navy"}`} onClick={() => setEditing((v) => !v)}>
              {editing ? <><Eye size={13} /> Preview</> : <><PenLine size={13} /> Edit Template</>}
            </button>
          </div>

          {editing ? (
            <div className="we-edit">
              <label className="bp-field"><span>Subject</span>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
              <label className="bp-field"><span>Body (HTML) — use {"{{full_name}}"} for personalization</span>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
              </label>
              <label className="bp-field"><span>CC (comma-separated, optional)</span>
                <input value={cc} onChange={(e) => setCc(e.target.value)} />
              </label>
            </div>
          ) : (
            <>
              <p className="we-subject"><b>Subject:</b> {subject}</p>
              <div className="we-preview">
                <div className="we-preview-head">
                  <span className="we-mark">V</span>
                  <b>Vetri-AI-OS Learning Hub</b>
                  <span className="bp-muted">Preview{sample ? ` for ${sample.name}` : ""}</span>
                </div>
                {/* Template body is authored by the Business Team in this same form. */}
                <div className="we-preview-body" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
              {cc && <p className="bp-person-sub">CC: {cc}</p>}
            </>
          )}

          <div className="we-actions">
            <span className="bp-person-sub">{selected.size} selected</span>
            <button type="button" className="bp-btn orange" disabled={sending !== null || selected.size === 0}
              onClick={() => sendTo(Array.from(selected), "selected")}>
              <Send size={14} /> {sending === "selected" ? "Sending…" : `Send to ${selected.size} selected`}
            </button>
          </div>
        </div>

        <div className="we-card">
          <div className="we-card-head">
            <div>
              <h3>{view === "queue" ? "Pending Dispatch Queue" : "All Converted Students"}</h3>
              <p className="bp-person-sub">{queued.length} trainee{queued.length === 1 ? "" : "s"} awaiting dispatch</p>
            </div>
            <button type="button" className="bp-btn navy small" disabled={sending !== null || queued.length === 0}
              onClick={() => sendTo(queued.map((e) => e.enquiry_id), "all")}>
              <SendHorizontal size={13} /> {sending === "all" ? "Sending…" : `Send All (${queued.length})`}
            </button>
          </div>

          <div className="we-toolbar">
            <div className="bp-tabs">
              <button type="button" className={`bp-tab ${view === "queue" ? "active" : ""}`} onClick={() => setView("queue")}>Queue <small>({queued.length})</small></button>
              <button type="button" className={`bp-tab ${view === "all" ? "active" : ""}`} onClick={() => setView("all")}>All <small>({enquiries.length})</small></button>
            </div>
            <label className="bp-search">
              <Search size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." aria-label="Search students" />
            </label>
          </div>

          {list.length === 0 ? (
            <p className="we-empty">{view === "queue" ? "Everyone has been welcomed." : "No converted students yet."}</p>
          ) : (
            <div className="we-queue">
              {list.map((e, i) => {
                const on = selected.has(e.enquiry_id);
                const noEmail = !e.personal_email && !e.official_email;
                return (
                  <div key={e.enquiry_id} className={`we-row ${on ? "on" : ""}`} style={{ "--i": i }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(e.enquiry_id)} aria-label={`Select ${e.name}`} />
                    <span className={`bp-avatar t${i % 4}`}>{initialsOf(e.name)}</span>
                    <div className="we-row-text">
                      <p className="bp-person-name">{e.name}</p>
                      <p className="bp-person-sub">{e.course_name}</p>
                      {e.welcome_email_sent ? (
                        <p className="we-state sent">Welcomed {e.welcome_email_sent_at ? new Date(e.welcome_email_sent_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : ""}</p>
                      ) : noEmail ? (
                        <p className="we-state warn">No email on file</p>
                      ) : (
                        <p className="we-state ready">Ready to Dispatch</p>
                      )}
                    </div>
                    <button type="button" className={`bp-btn small ${e.welcome_email_sent ? "soft" : "navy"}`}
                      disabled={sending !== null || noEmail}
                      onClick={() => sendTo([e.enquiry_id], `one-${e.enquiry_id}`)}>
                      {sending === `one-${e.enquiry_id}` ? "Sending…" : e.welcome_email_sent ? "Resend" : "Send Now"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="we-info">
        <Info size={16} />
        <p>Each send uses the template above, personalises {"{{full_name}}"}, and records the date so the student leaves the queue.</p>
      </div>
    </div>
  );
}

export default WelcomeEmails;
