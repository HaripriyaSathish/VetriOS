import { useEffect, useMemo, useState } from "react";
import { Bug, CircleCheck, Wrench, Paperclip, ExternalLink, UserRound, Clock3, Send } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const hasFix = (r) => !!(r.resolution_link || r.resolution_notes);
const TABS = [
  { key: "ALL", label: "All" },
  { key: "TODO", label: "Needs My Fix" },
  { key: "FIXED", label: "Fix Submitted" },
  { key: "APPROVED", label: "Approved" },
];
const bucket = (r) => (r.status === "APPROVED" ? "APPROVED" : hasFix(r) ? "FIXED" : "TODO");

function TestingReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fixDrafts, setFixDrafts] = useState({});
  const [submitting, setSubmitting] = useState(null);
  const [tab, setTab] = useState("ALL");

  const fetchReports = () =>
    client.get("/api/projects/my-testing-reports/")
      .then(({ data }) => setReports(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load testing reports."))
      .finally(() => setLoading(false));

  useEffect(() => { fetchReports(); }, []);

  const updateDraft = (reportId, field, value) => {
    setFixDrafts((prev) => ({ ...prev, [reportId]: { ...prev[reportId], [field]: value } }));
  };

  const submitFix = async (reportId) => {
    const draft = fixDrafts[reportId] || {};
    if (!draft.resolution_link && !draft.resolution_notes) {
      setError("Add a link or a note describing the fix.");
      return;
    }
    setSubmitting(reportId);
    setError("");
    try {
      await client.post(`/api/interns/testing-report/${reportId}/resolve/`, {
        resolution_link: draft.resolution_link || "",
        resolution_notes: draft.resolution_notes || "",
      });
      setMessage("Fix submitted to your lead.");
      fetchReports();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit fix.");
    } finally {
      setSubmitting(null);
    }
  };

  const counts = useMemo(() => {
    const c = { ALL: reports.length, TODO: 0, FIXED: 0, APPROVED: 0 };
    reports.forEach((r) => { c[bucket(r)] += 1; });
    return c;
  }, [reports]);
  const visible = reports.filter((r) => tab === "ALL" || bucket(r) === tab);

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader section="Testing Reports" title="Testing Reports" subtitle="Feedback from your lead on task submissions. Submit a fix for anything that needs changes." />

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">REPORTS</p><span className="pm-ico navy"><Bug size={20} /></span></div>
          <p className="bp-stat-value">{counts.ALL}</p>
          <p className="pm-foot"><span>Filed on your tasks</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">NEEDS MY FIX</p><span className="pm-ico orange"><Wrench size={20} /></span></div>
          <p className={`bp-stat-value ${counts.TODO ? "tr-orange" : ""}`}>{counts.TODO}</p>
          <p className="pm-foot"><span>{counts.FIXED} fixes submitted</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">APPROVED</p><span className="pm-ico green"><CircleCheck size={20} /></span></div>
          <p className="bp-stat-value">{counts.APPROVED}</p>
          <p className="pm-foot"><span className="pm-ok">{counts.ALL ? Math.round((counts.APPROVED * 100) / counts.ALL) : 0}% pass rate</span></p>
        </div>
      </div>

      <div className="bp-panel pm-toolbar">
        <div className="bp-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`bp-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}<small>({counts[t.key]})</small>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="bp-loading">Loading testing reports…</p>
      ) : visible.length === 0 ? (
        <p className="bp-panel pm-empty-panel">{reports.length ? "No reports in this view." : "No testing reports yet."}</p>
      ) : (
        <div className="pm-list">
          {visible.map((r, idx) => (
            <article key={r.report_id} className="bp-panel pm-item" style={{ "--i": idx }}>
              <div className="pm-item-top">
                <div>
                  <h3 className="pm-item-title">{r.task_title}</h3>
                  <p className="pm-item-meta">
                    <span><UserRound size={12} /> {r.created_by}</span>
                    <span><Clock3 size={12} /> {new Date(r.created_at).toLocaleString()}</span>
                  </p>
                </div>
                <span className={`bp-chip ${r.status === "APPROVED" ? "green" : "orange"}`}>{r.status === "APPROVED" ? "Approved" : "Needs Fixes"}</span>
              </div>
              <p className="pm-item-text">{r.report_text}</p>
              {r.attachment_url && (
                <a className="bp-btn outline small pm-fit" href={r.attachment_url} target="_blank" rel="noreferrer"><Paperclip size={12} /> View Attachment</a>
              )}

              {hasFix(r) ? (
                <div className="pm-fix">
                  <b>Fix submitted</b>
                  {r.resolution_link && <a href={r.resolution_link} target="_blank" rel="noreferrer"><ExternalLink size={12} /> {r.resolution_link}</a>}
                  {r.resolution_notes && <p>{r.resolution_notes}</p>}
                  {r.resolved_at && <small>{new Date(r.resolved_at).toLocaleString()}</small>}
                </div>
              ) : r.status === "NEEDS_FIXES" ? (
                <div className="pm-fix-form">
                  <p className="pm-section-label">Submit your fix</p>
                  <div className="bp-form-grid">
                    <label className="bp-field full"><span>Live link or PR URL</span>
                      <input value={fixDrafts[r.report_id]?.resolution_link || ""} onChange={(e) => updateDraft(r.report_id, "resolution_link", e.target.value)} />
                    </label>
                    <label className="bp-field full"><span>Notes (optional)</span>
                      <textarea rows={2} value={fixDrafts[r.report_id]?.resolution_notes || ""} onChange={(e) => updateDraft(r.report_id, "resolution_notes", e.target.value)} />
                    </label>
                  </div>
                  <button type="button" className="bp-btn navy small pm-fit" onClick={() => submitFix(r.report_id)} disabled={submitting === r.report_id}>
                    <Send size={12} /> {submitting === r.report_id ? "Submitting…" : "Submit Fix"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default TestingReports;
