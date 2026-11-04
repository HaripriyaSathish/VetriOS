import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck, TriangleAlert, UserMinus, CalendarX2, ChevronDown, Download, MessageSquare, ClipboardCheck,
  SlidersHorizontal, RotateCcw,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/TrainerDashboard.css";
import "../styles/DropoutTracking.css";

// Mirrors STREAK_THRESHOLD in local_extensions EnrollmentStatusView.
const STREAK_THRESHOLD = 5;
const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function DropoutTracking() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("all");

  const [actionStudent, setActionStudent] = useState(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    client.get("/api/training/dashboard/").then(({ data }) => {
      const b = data.batches || [];
      setBatches(b);
      if (b.length > 0) setSelectedBatchId(b[0].batch_id);
    });
  }, []);

  useEffect(() => {
    if (selectedBatchId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId]);

  const load = () => {
    setLoading(true);
    client.get(`/api/admissions/batches/${selectedBatchId}/enrollment-status/`)
      .then(({ data }) => setStudents(data))
      .finally(() => setLoading(false));
  };

  const openDiscontinue = (s) => {
    setActionStudent(s);
    setReason("");
  };

  const confirmDiscontinue = async () => {
    setSaving(true);
    try {
      await client.post("/api/admissions/mark-discontinued/", {
        enrollment_id: actionStudent.enrollment_id,
        discontinued_date: new Date().toISOString().slice(0, 10),
        reason,
      });
      setActionStudent(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const reactivate = async (enrollmentId) => {
    await client.post("/api/admissions/reactivate-student/", { enrollment_id: enrollmentId });
    load();
  };

  const active = students.filter((s) => s.status === "ACTIVE");
  const candidates = students.filter((s) => s.is_candidate);
  const watch = active.filter((s) => !s.is_candidate && s.current_absence_streak > 0);
  const discontinued = students.filter((s) => s.status !== "ACTIVE");
  const retention = students.length ? Math.round((active.length / students.length) * 1000) / 10 : null;
  const avgAbsent = students.length ? Math.round((students.reduce((s, x) => s + x.total_absent_days, 0) / students.length) * 10) / 10 : null;
  const riskList = view === "all" ? [...candidates, ...watch] : view === "high" ? candidates : watch;
  const selectedBatch = batches.find((b) => String(b.batch_id) === String(selectedBatchId));

  const exportRisk = () => {
    const head = ["Student", "Status", "Current streak", "Total absent days", "Candidate", "Discontinued date", "Reason"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [head.join(",")].concat(students.map((s) => [
      s.name, s.status, s.current_absence_streak, s.total_absent_days, s.is_candidate ? "Yes" : "No", s.discontinued_date, s.discontinued_reason,
    ].map(esc).join(",")));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `dropout-risk-${selectedBatch?.batch_name || "batch"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Trainer Workspace &gt; <span>Dropout Tracking</span></p>
          <h1 className="bp-title">Dropout Risk &amp; Student Retention</h1>
          <p className="bp-sub">Monitor consecutive absence streaks, flag dropout candidates and record discontinuations for your cohorts.</p>
        </div>
        <div className="bp-actions">
          <button type="button" className="bp-btn outline" onClick={exportRisk} disabled={!students.length}><Download size={16} /> Export Risk Report</button>
          <Link to="/training/messages" className="bp-btn navy"><MessageSquare size={16} /> Message Trainees</Link>
        </div>
      </div>

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Overall Retention</p>
            <span className="tr-stat-icon green"><ShieldCheck size={20} /></span>
          </div>
          <p className="bp-stat-value">{retention != null ? `${retention}%` : "—"}</p>
          <p className="do-foot"><i className="g" /> {active.length} of {students.length} still active</p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">At-Risk Students</p>
            <span className="tr-stat-icon orange"><TriangleAlert size={20} /></span>
          </div>
          <p className="bp-stat-value tr-orange">{candidates.length} <small className="do-unit">Students</small>{candidates.length > 0 && <span className="bp-chip red">Attention</span>}</p>
          <p className="do-foot"><i className="o" /> {STREAK_THRESHOLD}+ days absent in a row</p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Discontinued</p>
            <span className="tr-stat-icon blue"><UserMinus size={20} /></span>
          </div>
          <p className="bp-stat-value">{discontinued.length} <small className="do-unit">Recorded</small></p>
          <p className="do-foot"><i className="n" /> Can be reactivated anytime</p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Avg. Absent Days</p>
            <span className="tr-stat-icon blue"><CalendarX2 size={20} /></span>
          </div>
          <p className="bp-stat-value">{avgAbsent != null ? avgAbsent : "—"} <small className="do-unit">days</small></p>
          <p className="do-foot"><i className="o" /> {watch.length} with a current streak</p>
        </div>
      </div>

      <div className="tr-grid">
        <div className="tr-col">
          <section className="bp-panel tr-card">
            <div className="tr-card-head do-watch-head">
              <div>
                <h3>Active Risk Watchlist {candidates.length > 0 && <span className="bp-chip orange">{candidates.length} Actions Required</span>}</h3>
                <p>Students with an ongoing absence streak in {selectedBatch?.batch_name || "this batch"}.</p>
              </div>
              <div className="do-controls">
                <label className="bp-select">
                  <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
                    {batches.map((b) => <option key={b.batch_id} value={b.batch_id}>{b.batch_name}</option>)}
                  </select>
                  <ChevronDown size={14} />
                </label>
                <div className="bp-tabs">
                  {[
                    { key: "all", label: `All (${candidates.length + watch.length})` },
                    { key: "high", label: `High Attention (${candidates.length})` },
                    { key: "watch", label: `Watch (${watch.length})` },
                  ].map((t) => (
                    <button key={t.key} type="button" className={`bp-tab ${view === t.key ? "active" : ""}`} onClick={() => setView(t.key)}>{t.label}</button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? <p className="tr-empty">Loading…</p> : riskList.length === 0 ? (
              <p className="tr-empty">Nobody has an ongoing absence streak. </p>
            ) : riskList.map((s, i) => {
              const high = s.is_candidate;
              const pct = Math.min(100, Math.round((s.current_absence_streak / STREAK_THRESHOLD) * 100));
              return (
                <article key={s.enrollment_id} className={`do-card ${high ? "high" : ""}`}>
                  <div className="do-card-top">
                    <span className={`bp-avatar t${i % 4}`}>{initialsOf(s.name)}</span>
                    <div className="do-who">
                      <b>{s.name} <span className={`bp-chip ${high ? "red" : "orange"}`}>{high ? "HIGH ATTENTION" : "MODERATE"}</span></b>
                      <small>{selectedBatch?.batch_name}</small>
                    </div>
                    <div className={`do-risk ${high ? "high" : ""}`}><small>STREAK RISK</small><b>{pct}%</b></div>
                  </div>
                  <div className="do-metrics">
                    <div><small>Current Streak</small><b className={high ? "do-red" : ""}>{s.current_absence_streak} days</b><span>Flag at {STREAK_THRESHOLD}</span></div>
                    <div><small>Total Absent</small><b>{s.total_absent_days} days</b><span>All recorded days</span></div>
                    <div><small>Status</small><b>{s.status}</b><span>Enrollment</span></div>
                  </div>
                  <div className="do-actions">
                    <Link to="/training/messages" className="bp-btn soft small">Notify Advisory</Link>
                    <Link to="/training/attendance" className="bp-btn outline small"><ClipboardCheck size={13} /> Attendance</Link>
                    <button type="button" className="bp-btn small do-danger" onClick={() => openDiscontinue(s)}>Mark Discontinued</button>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="bp-panel">
            <div className="do-table-head">
              <h3>Enrollment Status Ledger</h3>
              <span>{students.length} students</span>
            </div>
            <div className="bp-table-wrap">
              <table className="bp-table">
                <thead>
                  <tr><th>Student</th><th>Status</th><th>Current Streak</th><th>Total Absent</th><th>Discontinued</th><th>Reason</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className="bp-empty-row"><td colSpan={7}>Loading…</td></tr>
                  ) : students.length === 0 ? (
                    <tr className="bp-empty-row"><td colSpan={7}>No students enrolled in this batch yet.</td></tr>
                  ) : students.map((s, i) => (
                    <tr key={s.enrollment_id} className={s.is_candidate ? "do-cand-row" : ""}>
                      <td>
                        <div className="bp-person">
                          <span className={`bp-avatar t${i % 4}`}>{initialsOf(s.name)}</span>
                          <p className="bp-person-name">{s.name}{s.is_candidate && <span className="bp-chip orange do-ml">Candidate</span>}</p>
                        </div>
                      </td>
                      <td><span className={`bp-chip ${s.status === "ACTIVE" ? "green" : "red"}`}>{s.status}</span></td>
                      <td>{s.current_absence_streak} day(s)</td>
                      <td className={s.total_absent_days > 0 ? "do-red" : "bp-muted"}>{s.total_absent_days} day(s)</td>
                      <td>{s.discontinued_date || "—"}</td>
                      <td className="bp-muted">{s.discontinued_reason || "—"}</td>
                      <td>
                        {s.status === "ACTIVE" ? (
                          <button type="button" className="do-link red" onClick={() => openDiscontinue(s)}>Mark Discontinued</button>
                        ) : (
                          <button type="button" className="do-link green" onClick={() => reactivate(s.enrollment_id)}><RotateCcw size={12} /> Reactivate</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="tr-col">
          <section className="bp-panel tr-card">
            <div className="tr-card-head"><h3>Risk Formula</h3><SlidersHorizontal size={16} className="bp-muted" /></div>
            <p className="do-text">A student becomes a dropout candidate when they're still active but have been absent on consecutive recorded days.</p>
            <div className="do-rule"><span>Consecutive absent days</span><b>{STREAK_THRESHOLD}+ days</b></div>
            <div className="tr-progress thin"><span style={{ width: "100%" }} /></div>
            <div className="do-rule"><span>Enrollment status</span><b>Active</b></div>
            <div className="do-threshold"><span>Threshold for candidate flag</span><b>{STREAK_THRESHOLD} days in a row</b></div>
          </section>

          <section className="bp-panel tr-card">
            <div className="tr-card-head"><h3>Discontinued Students</h3><span className="bp-chip gray">{discontinued.length}</span></div>
            {discontinued.length === 0 ? <p className="tr-empty">No discontinuations recorded.</p> : discontinued.map((s, i) => (
              <div key={s.enrollment_id} className="do-disc">
                <span className={`bp-avatar t${i % 4}`}>{initialsOf(s.name)}</span>
                <span className="do-disc-name"><b>{s.name}</b><small>{s.discontinued_date || "—"}{s.discontinued_reason ? ` · ${s.discontinued_reason}` : ""}</small></span>
                <button type="button" className="bp-btn outline small" onClick={() => reactivate(s.enrollment_id)}><RotateCcw size={12} /> Reactivate</button>
              </div>
            ))}
          </section>
        </div>
      </div>

      {actionStudent && (
        <div className="bp-modal-backdrop" onClick={() => setActionStudent(null)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Mark {actionStudent.name} as Discontinued</h2>
            <p>This records today as the discontinued date. You can reactivate them later.</p>
            <label className="bp-field">
              <span>Reason (optional)</span>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Stopped attending, no response to outreach" />
            </label>
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setActionStudent(null)}>Cancel</button>
              <button type="button" className="bp-btn do-danger" onClick={confirmDiscontinue} disabled={saving}>{saving ? "Saving…" : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DropoutTracking;
