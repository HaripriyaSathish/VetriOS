import { useEffect, useState } from "react";
import { GraduationCap, BadgeCheck, CalendarPlus, CalendarDays, Search, TriangleAlert } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const COMPLETION_OUTCOMES = [
  { value: "CONVERTED_TO_EMPLOYEE", label: "Convert to Employee" },
  { value: "CERTIFICATE_ISSUED", label: "Issue Certificate (End Internship)" },
  { value: "DISCONTINUED", label: "Discontinued" },
  { value: "RESIGNED", label: "Resigned" },
  { value: "OTHER", label: "Other" },
];

const initials = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

function RecommendInternshipAction() {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [selectedIntern, setSelectedIntern] = useState(null);
  const [actionType, setActionType] = useState("completion"); // "completion" | "extension"
  const [outcome, setOutcome] = useState("CONVERTED_TO_EMPLOYEE");
  const [remarks, setRemarks] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    client.get("/api/interns/lead/interns/")
      .then(({ data }) => setInterns(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your interns."))
      .finally(() => setLoading(false));
  }, []);

  const open = (intern, type) => {
    setSelectedIntern(intern);
    setActionType(type);
    setOutcome("CONVERTED_TO_EMPLOYEE");
    setRemarks("");
    setNewEndDate("");
    setExtensionReason("");
    setFormError("");
    setMessage("");
  };

  const submit = async () => {
    if (actionType === "extension" && !newEndDate) {
      setFormError("New end date is required.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      if (actionType === "completion") {
        await client.post(`/api/interns/${selectedIntern.intern_id}/completion/recommend/`, { outcome, remarks });
        setMessage(`Completion recommendation submitted for ${selectedIntern.name}.`);
      } else {
        await client.post(`/api/interns/${selectedIntern.intern_id}/extension/recommend/`, { new_end_date: newEndDate, extension_reason: extensionReason });
        setMessage(`Extension recommendation submitted for ${selectedIntern.name}.`);
      }
      setSelectedIntern(null);
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't submit recommendation.");
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date(nowMs).toISOString().slice(0, 10);
  const in30 = new Date(nowMs + 30 * 86400000).toISOString().slice(0, 10);
  const endingSoon = interns.filter((i) => i.internship_end_date && i.internship_end_date >= today && i.internship_end_date <= in30).length;
  const noEnd = interns.filter((i) => !i.internship_end_date).length;
  const visible = interns.filter((i) => !search.trim() || [i.name, i.intern_code].some((v) => (v || "").toLowerCase().includes(search.trim().toLowerCase())));

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        section="Internship Completion"
        title="Recommend Completion / Extension"
        subtitle="Recommend an internship completion outcome or an end-date extension for your interns. The Business Team approves it."
      />

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">MY INTERNS</p><span className="pm-ico navy"><GraduationCap size={20} /></span></div>
          <p className="bp-stat-value">{interns.length}</p>
          <p className="pm-foot"><span>Reporting to you</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">ENDING IN 30 DAYS</p><span className="pm-ico orange"><CalendarDays size={20} /></span></div>
          <p className="bp-stat-value tr-orange">{endingSoon}</p>
          <p className="pm-foot"><span>Decide completion or extension</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">NO END DATE</p><span className="pm-ico red"><TriangleAlert size={20} /></span></div>
          <p className="bp-stat-value">{noEnd}</p>
          <p className="pm-foot"><span>Can't be extended until set</span></p>
        </div>
      </div>

      <section className="bp-panel">
        <div className="pm-toolbar pm-toolbar-flat">
          <h3 className="pm-panel-title">Interns</h3>
          <label className="bp-search">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search interns…" />
          </label>
        </div>
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead><tr><th>Intern</th><th>Status</th><th>Internship Ends</th><th style={{ textAlign: "right" }}>Recommend</th></tr></thead>
            <tbody>
              {loading && <tr className="bp-empty-row"><td colSpan={4}>Loading your interns…</td></tr>}
              {!loading && visible.length === 0 && <tr className="bp-empty-row"><td colSpan={4}>{interns.length ? "No interns match your search." : "No interns assigned to you right now."}</td></tr>}
              {visible.map((i, idx) => {
                const soon = i.internship_end_date && i.internship_end_date >= today && i.internship_end_date <= in30;
                return (
                  <tr key={i.intern_id} style={{ "--row": idx }}>
                    <td>
                      <div className="bp-person">
                        <span className={`bp-avatar t${idx % 4}`}>{initials(i.name)}</span>
                        <div><p className="bp-person-name">{i.name}</p><p className="bp-person-sub">{i.intern_code}</p></div>
                      </div>
                    </td>
                    <td><span className="bp-chip blue">{i.status}</span></td>
                    <td><span className={soon ? "pm-warm" : ""}>{day(i.internship_end_date)}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <div className="pm-row-actions">
                        <button type="button" className="bp-btn outline small" onClick={() => open(i, "extension")}><CalendarPlus size={13} /> Extension</button>
                        <button type="button" className="bp-btn navy small" onClick={() => open(i, "completion")}><BadgeCheck size={13} /> Completion</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedIntern && (
        <div className="bp-modal-backdrop" onClick={() => !submitting && setSelectedIntern(null)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{actionType === "completion" ? "Recommend Completion" : "Recommend Extension"}</h2>
            <p className="bp-sub">{selectedIntern.name} · {selectedIntern.intern_code}</p>
            <div className="bp-tabs pm-mode-tabs">
              <button type="button" className={`bp-tab ${actionType === "completion" ? "active" : ""}`} onClick={() => setActionType("completion")}>Completion</button>
              <button type="button" className={`bp-tab ${actionType === "extension" ? "active" : ""}`} onClick={() => setActionType("extension")}>Extension</button>
            </div>
            {actionType === "completion" ? (
              <div className="bp-form-grid">
                <label className="bp-field full"><span>Outcome</span>
                  <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                    {COMPLETION_OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label className="bp-field full"><span>Remarks</span>
                  <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional notes for the Business Team" />
                </label>
              </div>
            ) : (
              <>
                {!selectedIntern.internship_end_date && (
                  <p className="bp-notice pm-warn-box">This intern has no current end date on file — an extension can&apos;t be recommended until one is set.</p>
                )}
                <div className="bp-form-grid">
                  <label className="bp-field full"><span>New end date</span>
                    <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} min={selectedIntern.internship_end_date || undefined} disabled={!selectedIntern.internship_end_date} />
                  </label>
                  <label className="bp-field full"><span>Reason</span>
                    <textarea rows={3} value={extensionReason} onChange={(e) => setExtensionReason(e.target.value)} placeholder="Why does this internship need extending?" />
                  </label>
                </div>
              </>
            )}
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setSelectedIntern(null)} disabled={submitting}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={submit} disabled={submitting || (actionType === "extension" && !selectedIntern.internship_end_date)}>
                {submitting ? "Submitting…" : "Submit Recommendation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecommendInternshipAction;
