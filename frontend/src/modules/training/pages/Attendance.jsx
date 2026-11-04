import { useEffect, useMemo, useState } from "react";
import {
  Download, ListChecks, CircleCheck, UsersRound, ShieldAlert, ChevronDown, CalendarDays, Radio,
  CheckCheck, XCircle, TriangleAlert, FileSpreadsheet,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/TrainerDashboard.css";
import "../styles/StudentAttendance.css";

const RISK_THRESHOLD = 80;
const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function Attendance() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [roster, setRoster] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusByEnrollment, setStatusByEnrollment] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [filter, setFilter] = useState("all");

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    client.get("/api/training/dashboard/").then(({ data }) => {
      setBatches(data.batches || []);
      setLoading(false);
    }).catch((err) => {
      setError(err.response?.data?.detail || "Couldn't load your batches.");
      setLoading(false);
    });
  }, []);

  const loadRoster = async (batchId) => {
    if (!batchId) {
      setRoster([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get(`/api/training/batches/${batchId}/roster/`);
      setRoster(data);
      const defaults = {};
      data.forEach((r) => { defaults[r.enrollment_id] = "PRESENT"; });
      setStatusByEnrollment(defaults);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't load roster.");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchChange = (batchId) => {
    setSelectedBatchId(batchId);
    setSaveMessage("");
    setFilter("all");
    loadRoster(batchId);
  };

  const toggleStatus = (enrollmentId) => {
    setStatusByEnrollment((prev) => ({
      ...prev,
      [enrollmentId]: prev[enrollmentId] === "PRESENT" ? "ABSENT" : "PRESENT",
    }));
  };

  const markAll = (status) => {
    const next = {};
    roster.forEach((r) => { next[r.enrollment_id] = status; });
    setStatusByEnrollment(next);
  };

  const saveAttendance = async () => {
    setSaving(true);
    setSaveMessage("");
    setError("");
    try {
      const records = roster.map((r) => ({
        enrollment_id: r.enrollment_id,
        attendance_status: statusByEnrollment[r.enrollment_id] || "PRESENT",
      }));
      const { data } = await client.post(
        `/api/training/batches/${selectedBatchId}/mark-attendance/`,
        { date: attendanceDate, records }
      );
      if (data.errors && data.errors.length > 0) {
        setSaveMessage(`Saved ${data.updated_count}, with ${data.errors.length} error(s).`);
      } else {
        setSaveMessage(`Attendance saved for ${data.updated_count} students on ${attendanceDate}.`);
      }
      loadRoster(selectedBatchId);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const downloadReport = async (start, end, label) => {
    setDownloading(true);
    setError("");
    try {
      const response = await client.get(
        `/api/training/batches/${selectedBatchId}/training-log-download/`,
        { params: { start, end }, responseType: "blob" }
      );
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Training_Log_${label}_${start}_to_${end}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError("Couldn't generate report — check there's attendance data for this period.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadWeekly = () => {
    const selected = new Date(attendanceDate);
    const dayOfWeek = selected.getDay();
    const monday = new Date(selected);
    monday.setDate(selected.getDate() - ((dayOfWeek + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    downloadReport(monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10), "Weekly");
  };

  const handleDownloadMonthly = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const firstDay = `${selectedMonth}-01`;
    const lastDayNum = new Date(year, month, 0).getDate();
    const lastDay = `${selectedMonth}-${String(lastDayNum).padStart(2, "0")}`;
    downloadReport(firstDay, lastDay, "Monthly");
  };

  const selectedBatch = batches.find((b) => String(b.batch_id) === String(selectedBatchId));
  const presentCount = roster.filter((r) => statusByEnrollment[r.enrollment_id] === "PRESENT").length;
  const absentCount = roster.length - presentCount;
  const rollRate = roster.length ? Math.round((presentCount / roster.length) * 1000) / 10 : null;
  const withPct = roster.filter((r) => r.attendance_percentage !== null);
  const avgPct = withPct.length ? Math.round((withPct.reduce((s, r) => s + r.attendance_percentage, 0) / withPct.length) * 10) / 10 : null;
  const atRisk = useMemo(
    () => roster.filter((r) => r.attendance_percentage !== null && r.attendance_percentage < RISK_THRESHOLD)
      .sort((a, b) => a.attendance_percentage - b.attendance_percentage),
    [roster],
  );
  const visible = roster.filter((r) =>
    filter === "all" || (filter === "present" ? statusByEnrollment[r.enrollment_id] === "PRESENT" : statusByEnrollment[r.enrollment_id] !== "PRESENT"));
  const isToday = attendanceDate === new Date().toISOString().slice(0, 10);

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb sa-crumb">Trainer Workspace / <span>Student Attendance</span>{selectedBatch && <span className="bp-chip green">{selectedBatch.batch_name}</span>}</p>
          <h1 className="bp-title">Student Attendance &amp; Cohort Roll Call</h1>
          <p className="bp-sub">Record lecture attendance, track chronic absenteeism and download weekly or monthly training logs for your batches.</p>
        </div>
        <div className="bp-actions">
          <button type="button" className="bp-btn outline" onClick={handleDownloadMonthly} disabled={!selectedBatchId || downloading}>
            <Download size={16} /> {downloading ? "Generating…" : "Download Register (XLSX)"}
          </button>
          <button type="button" className="bp-btn navy" onClick={saveAttendance} disabled={!selectedBatchId || saving || loading || !roster.length}>
            <ListChecks size={16} /> {saving ? "Saving…" : `Save ${isToday ? "Today's " : ""}Roll Call`}
          </button>
        </div>
      </div>

      {error && <p className="bp-notice sa-error">{error}</p>}
      {saveMessage && <p className="bp-notice">{saveMessage}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label sa-label">ROLL CALL RATE</p>
            {selectedBatchId && <span className="bp-chip green">{isToday ? "Today" : attendanceDate}</span>}
          </div>
          <div className="sa-stat-row">
            <div>
              <p className="bp-stat-value">{rollRate != null ? `${rollRate}%` : "—"}</p>
              <p className="tr-stat-sub">{presentCount} of {roster.length} trainees marked present</p>
            </div>
            <span className="sa-icon green"><CircleCheck size={20} /></span>
          </div>
          <div className="bp-meter"><span style={{ width: `${rollRate ?? 0}%`, background: "#16a34a" }} /></div>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label sa-label">BATCH ATTENDANCE</p>
            {selectedBatch && <span className="bp-chip blue">{selectedBatch.course_name}</span>}
          </div>
          <div className="sa-stat-row">
            <div>
              <p className="bp-stat-value">{avgPct != null ? `${avgPct}%` : "—"}</p>
              <p className="tr-stat-sub">Average across all recorded days</p>
            </div>
            <span className="sa-icon navy"><UsersRound size={20} /></span>
          </div>
          <div className="bp-meter"><span style={{ width: `${avgPct ?? 0}%` }} /></div>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label sa-label">ENROLLED TRAINEES</p>
          </div>
          <div className="sa-stat-row">
            <div>
              <p className="bp-stat-value">{roster.length}</p>
              <p className="tr-stat-sub">{absentCount} marked absent in this roll call</p>
            </div>
            <span className="sa-icon violet"><ListChecks size={20} /></span>
          </div>
          <div className="bp-meter"><span style={{ width: roster.length ? "100%" : "0%", background: "#7c8cf0" }} /></div>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label sa-label">BELOW {RISK_THRESHOLD}%</p>
            {atRisk.length > 0 && <span className="bp-chip orange">Needs Review</span>}
          </div>
          <div className="sa-stat-row">
            <div>
              <p className="bp-stat-value tr-orange">{atRisk.length} <small className="sa-unit">At risk</small></p>
              <p className="tr-stat-sub">Overall attendance under the limit</p>
            </div>
            <span className="sa-icon orange"><ShieldAlert size={20} /></span>
          </div>
          <div className="bp-meter"><span className="orange" style={{ width: roster.length ? `${(atRisk.length / roster.length) * 100}%` : "0%" }} /></div>
        </div>
      </div>

      <div className="sa-grid">
        <div className="tr-col">
          <section className="bp-panel sa-controls">
            <div className="sa-control-row">
              <label className="bp-select sa-batch">
                <select value={selectedBatchId} onChange={(e) => handleBatchChange(e.target.value)}>
                  <option value="">Select a batch</option>
                  {batches.map((b) => (
                    <option key={b.batch_id} value={b.batch_id}>
                      {b.batch_name}{b.trainer_name ? ` — ${b.trainer_name}` : " — Unassigned"}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="sa-date">
                <CalendarDays size={15} />
                <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
              </label>
            </div>
            {selectedBatchId && (
              <>
                <div className="bp-tabs">
                  {[
                    { key: "all", label: `All (${roster.length})` },
                    { key: "present", label: `Present (${presentCount})` },
                    { key: "absent", label: `Absent (${absentCount})` },
                  ].map((t) => (
                    <button key={t.key} type="button" className={`bp-tab ${filter === t.key ? "active" : ""}`} onClick={() => setFilter(t.key)}>{t.label}</button>
                  ))}
                </div>
                <div className="sa-live">
                  <span className="sa-live-icon"><Radio size={16} /></span>
                  <div>
                    <b>Roll Call in Progress</b>
                    <p>Tap a status to switch it, then save the roll call for {attendanceDate}.</p>
                  </div>
                  <button type="button" className="bp-btn outline small" onClick={() => markAll("ABSENT")}><XCircle size={14} /> Mark All Absent</button>
                  <button type="button" className="bp-btn navy small" onClick={() => markAll("PRESENT")}><CheckCheck size={14} /> Quick Mark All Present</button>
                </div>
              </>
            )}
          </section>

          <section className="bp-panel">
            <div className="sa-ledger-head">
              <h3>Trainee Attendance Ledger {selectedBatchId && <span className="bp-chip blue">{roster.length} Enrolled</span>}</h3>
              <span>Overall % from every recorded day</span>
            </div>
            <div className="bp-table-wrap">
              <table className="bp-table">
                <thead>
                  <tr>
                    <th>Trainee</th>
                    <th>Contact</th>
                    <th>Overall Attendance</th>
                    <th>Days Recorded</th>
                    <th>Daily Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedBatchId ? (
                    <tr className="bp-empty-row"><td colSpan={5}>Select a batch to start the roll call.</td></tr>
                  ) : loading ? (
                    <tr className="bp-empty-row"><td colSpan={5}>Loading…</td></tr>
                  ) : visible.length === 0 ? (
                    <tr className="bp-empty-row"><td colSpan={5}>{roster.length ? "No trainees match this filter." : "No students enrolled yet."}</td></tr>
                  ) : visible.map((r, i) => {
                    const present = statusByEnrollment[r.enrollment_id] === "PRESENT";
                    const risky = r.attendance_percentage !== null && r.attendance_percentage < RISK_THRESHOLD;
                    return (
                      <tr key={r.enrollment_id} className={risky ? "sa-risk-row" : ""}>
                        <td>
                          <div className="bp-person">
                            <span className={`bp-avatar t${i % 4}`}>{initialsOf(r.student_name)}</span>
                            <div>
                              <p className={`bp-person-name ${risky ? "sa-red" : ""}`}>{r.student_name}</p>
                              <p className="bp-person-sub">{r.status}</p>
                            </div>
                          </div>
                        </td>
                        <td className="bp-muted">{r.email || "—"}</td>
                        <td>
                          <div className="bp-att">
                            <div className="bp-meter"><span className={risky ? "orange" : ""} style={{ width: `${r.attendance_percentage ?? 0}%` }} /></div>
                            <b>{r.attendance_percentage !== null ? `${r.attendance_percentage}%` : "—"}</b>
                          </div>
                        </td>
                        <td>{r.days_recorded}</td>
                        <td>
                          <button type="button" className={`sa-toggle ${present ? "present" : "absent"}`} onClick={() => toggleStatus(r.enrollment_id)}>
                            {present ? "● Present" : "● Absent"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="tr-col">
          <section className="bp-panel tr-card">
            <div className="tr-card-head">
              <div>
                <h3>Cohort Attendance</h3>
                <p>{selectedBatch ? `${selectedBatch.batch_name} · this roll call` : "Select a batch"}</p>
              </div>
            </div>
            <div className="sa-donut" style={{ "--p": `${rollRate ?? 0}%` }}>
              <div><b>{rollRate != null ? `${rollRate}%` : "—"}</b><small>ATTENDED</small></div>
            </div>
            <div className="sa-legend">
              <span><i className="g" /> {presentCount}<small>Present</small></span>
              <span><i className="r" /> {absentCount}<small>Absent</small></span>
            </div>
          </section>

          <section className="bp-panel tr-card sa-alert">
            <p className="sa-alert-kicker"><TriangleAlert size={14} /> RISK THRESHOLD ALERT {atRisk.length > 0 && <span className="bp-chip orange">{atRisk.length} Trainees</span>}</p>
            <h3>Certification Threat (&lt;{RISK_THRESHOLD}%)</h3>
            <p className="sa-alert-text">Trainees whose overall attendance is below {RISK_THRESHOLD}% across every recorded day.</p>
            {atRisk.length === 0 ? (
              <p className="tr-empty">{selectedBatchId ? "Nobody is below the threshold." : "Select a batch to check."}</p>
            ) : atRisk.slice(0, 4).map((r) => (
              <div key={r.enrollment_id} className="sa-risk">
                <span className="bp-avatar t3">{initialsOf(r.student_name)}</span>
                <div><b>{r.student_name}</b><small>{r.days_recorded} days recorded</small></div>
                <span className="sa-risk-pct">{r.attendance_percentage}%</span>
              </div>
            ))}
          </section>

          {selectedBatchId && (
            <section className="bp-panel tr-card">
              <div className="tr-card-head"><h3><FileSpreadsheet size={18} /> Training Logs</h3></div>
              <label className="bp-field">
                <span>Month</span>
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
              </label>
              <div className="sa-log-actions">
                <button type="button" className="bp-btn soft" onClick={handleDownloadWeekly} disabled={downloading}>{downloading ? "Generating…" : "Weekly Log"}</button>
                <button type="button" className="bp-btn navy" onClick={handleDownloadMonthly} disabled={downloading}>{downloading ? "Generating…" : "Monthly Log"}</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default Attendance;
