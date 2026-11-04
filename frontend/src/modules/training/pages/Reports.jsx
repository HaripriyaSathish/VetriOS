import { useEffect, useMemo, useState } from "react";
import {
  Download, BadgeCheck, Gauge, UserRoundCheck, Rocket, BarChart3, CircleCheck, FileSpreadsheet, ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/TrainerDashboard.css";
import "../styles/TrainingBatches.css";
import "../styles/TrainerReports.css";

const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

// Readiness buckets from attendance and average graded task score.
function readinessOf(att, score) {
  if (score == null && att == null) return { key: "none", label: "No data", tone: "gray" };
  if ((score ?? 0) >= 85 && (att ?? 0) >= 90) return { key: "high", label: "Top Tier", tone: "green" };
  if ((score != null && score < 70) || (att != null && att < 80)) return { key: "attention", label: "Needs Coaching", tone: "orange" };
  return { key: "good", label: "On Track", tone: "blue" };
}

function Reports() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [savedReports, setSavedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [roster, setRoster] = useState([]);
  const [studentTasks, setStudentTasks] = useState([]);

  useEffect(() => {
    client.get("/api/training/trainer/overview/").then(({ data }) => {
      const b = data.all_batches || [];
      setBatches(b);
      const first = b.find((x) => x.is_active) || b[0];
      if (first) setSelectedBatchId(first.batch_id);
    }).catch(() => {
      // Admin roles have no trainer profile — fall back to the plain batch list.
      client.get("/api/training/dashboard/").then(({ data }) => {
        const b = data.batches || [];
        setBatches(b);
        if (b.length > 0) setSelectedBatchId(b[0].batch_id);
      });
    });
  }, []);

  useEffect(() => {
    if (!selectedBatchId) return;
    loadSavedReports();
    client.get(`/api/training/batches/${selectedBatchId}/roster/`).then(({ data }) => setRoster(data)).catch(() => setRoster([]));
    client.get(`/api/training/batches/${selectedBatchId}/student-tasks/`).then(({ data }) => setStudentTasks(data)).catch(() => setStudentTasks([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId]);

  const loadSavedReports = async () => {
    setLoading(true);
    try {
      const { data } = await client.get(`/api/training/batches/${selectedBatchId}/saved-reports/`);
      setSavedReports(data);
    } finally {
      setLoading(false);
    }
  };

  const downloadBlob = (response, filename) => {
    const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  };

  const generateZoneReport = async (period) => {
    setDownloading(true);
    setError("");
    try {
      let start, end;
      const today = new Date();
      if (period === "weekly") {
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        start = monday.toISOString().slice(0, 10);
        end = sunday.toISOString().slice(0, 10);
      } else {
        start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
      }

      const response = await client.get(`/api/training/batches/${selectedBatchId}/zone-report/`, {
        params: { start, end, period },
        responseType: "blob",
      });
      downloadBlob(response, `Zone_Report_${period}_${start}_to_${end}.xlsx`);
      loadSavedReports();
    } catch (err) {
      setError("Couldn't generate report — check there's enrollment/attendance data for this batch.");
    } finally {
      setDownloading(false);
    }
  };

  const downloadSaved = async (reportId, period, start, end) => {
    try {
      const response = await client.get(`/api/training/saved-reports/${reportId}/download/`, { responseType: "blob" });
      downloadBlob(response, `Zone_Report_${period}_${start}_to_${end}.xlsx`);
    } catch (err) {
      setError("Couldn't download this report.");
    }
  };

  const selected = batches.find((b) => String(b.batch_id) === String(selectedBatchId));

  // One row per trainee: roster attendance + their graded/submitted tasks.
  const trainees = useMemo(() => roster.map((r) => {
    const mine = studentTasks.filter((t) => t.student_name === r.student_name);
    const graded = mine.filter((t) => t.score !== null && t.score !== undefined);
    const avg = graded.length ? Math.round((graded.reduce((s, t) => s + Number(t.score), 0) / graded.length) * 10) / 10 : null;
    return {
      ...r,
      avgScore: avg,
      submitted: mine.filter((t) => t.submission_date).length,
      assigned: mine.length,
      readiness: readinessOf(r.attendance_percentage, avg),
    };
  }), [roster, studentTasks]);

  const gradedAll = studentTasks.filter((t) => t.score !== null && t.score !== undefined);
  const batchScore = gradedAll.length ? Math.round((gradedAll.reduce((s, t) => s + Number(t.score), 0) / gradedAll.length) * 10) / 10 : null;
  const passRate = gradedAll.length ? Math.round((gradedAll.filter((t) => Number(t.score) >= 50).length / gradedAll.length) * 1000) / 10 : null;
  const rates = batches.map((b) => b.attendance_rate).filter((r) => r != null);
  const avgAtt = selected?.attendance_rate ?? (rates.length ? Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 10) / 10 : null);
  const buckets = { high: 0, good: 0, attention: 0 };
  trainees.forEach((t) => { if (buckets[t.readiness.key] !== undefined) buckets[t.readiness.key] += 1; });
  const subRate = studentTasks.length ? Math.round((studentTasks.filter((t) => t.submission_date).length / studentTasks.length) * 100) : null;

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Trainer Workspace &gt; <span>Reports &amp; Analytics</span></p>
          <h1 className="bp-title">Batch-Wise Performance &amp; Academic Reports</h1>
          <p className="bp-sub">Compare cohort attendance, assignment scores and readiness across your batches, and download zone reports.</p>
        </div>
        <div className="bp-actions">
          <button type="button" className="bp-btn navy" onClick={() => generateZoneReport("monthly")} disabled={downloading || !selectedBatchId}>
            <Download size={16} /> {downloading ? "Generating…" : "Download Monthly Report"}
          </button>
        </div>
      </div>

      {error && <p className="bp-notice rp-error">{error}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Assignment Pass Rate</p>
            <span className="tr-stat-icon green"><BadgeCheck size={20} /></span>
          </div>
          <p className="bp-stat-value">{passRate != null ? `${passRate}%` : "—"}</p>
          <p className="tr-stat-sub">Graded tasks scoring 50 or more</p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Avg. Batch Score</p>
            <span className="tr-stat-icon blue"><Gauge size={20} /></span>
          </div>
          <p className="bp-stat-value">{batchScore != null ? batchScore : "—"} <small className="rp-unit">/ 100</small></p>
          <p className="tr-stat-sub">{gradedAll.length} graded submissions</p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Batch Attendance</p>
            <span className="tr-stat-icon blue"><UserRoundCheck size={20} /></span>
          </div>
          <p className="bp-stat-value">{avgAtt != null ? `${avgAtt}%` : "—"}</p>
          <p className="tr-stat-sub">Last 30 days · {roster.length} trainees</p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Syllabus Velocity</p>
            <span className="tr-stat-icon orange"><Rocket size={20} /></span>
          </div>
          <p className="bp-stat-value">{selected?.progress != null ? `${selected.progress}%` : "—"}</p>
          <p className="tr-stat-sub">{subRate != null ? `${subRate}% of assigned tasks submitted` : "Time elapsed in this batch"}</p>
        </div>
      </div>

      <div className="bp-panel rp-batchbar">
        <div className="rp-batch-chips">
          {batches.map((b) => (
            <button key={b.batch_id} type="button" className={`rp-chip ${String(b.batch_id) === String(selectedBatchId) ? "active" : ""}`} onClick={() => setSelectedBatchId(b.batch_id)}>
              {b.batch_name}
              <span className={`bp-chip ${b.is_active === false ? "gray" : "green"}`}>{(b.status || "").toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tr-grid">
        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <h3><BarChart3 size={18} /> Batch-Wise Performance Breakdown <span className="bp-chip blue">{batches.length} Cohorts</span></h3>
              <p>30-day attendance and time elapsed for every assigned batch.</p>
            </div>
          </div>
          {batches.map((b) => (
            <div key={b.batch_id} className="rp-break">
              <div className="rp-break-top">
                <span><i className={b.is_active === false ? "done" : ""} /> <b>{b.batch_name}</b> <span className={`bp-chip ${b.is_active === false ? "gray" : "green"}`}>{(b.status || "").toUpperCase()}</span></span>
                <span>{b.attendance_rate != null ? `${b.attendance_rate}% attendance` : "No attendance"}</span>
              </div>
              <div className={`tr-progress thin ${b.is_active === false ? "" : (b.progress ?? 0) >= 100 ? "warm" : ""}`}><span style={{ width: `${b.progress ?? 0}%` }} /></div>
              <div className="rp-break-foot">
                <span>Cohort: {b.students_enrolled ?? "—"} trainees</span>
                <span>Progress: {b.progress != null ? `${b.progress}%` : "—"}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <h3>Placement Readiness <CircleCheck size={16} className="rp-green" /></h3>
              <p>Grouped by attendance and average graded score.</p>
            </div>
            <span className="bp-chip green">{selected?.batch_code || ""}</span>
          </div>
          <div className="rp-bucket high"><b>{buckets.high}</b><span><strong>High Performers</strong><small>Score ≥ 85% · Attendance ≥ 90%</small></span><em>Interview Ready</em></div>
          <div className="rp-bucket good"><b>{buckets.good}</b><span><strong>Good Standing</strong><small>Between the two thresholds</small></span><em>Minor Refinement</em></div>
          <div className="rp-bucket attention"><b>{buckets.attention}</b><span><strong>Attention Needed</strong><small>Score &lt; 70% or Attendance &lt; 80%</small></span><em>Coaching</em></div>
          <div className="rp-bucket-foot">
            <span>Cohort: {roster.length} trainees</span>
            {selected && <Link to={`/training/batches/${selected.batch_id}`}>Batch Dossier <ArrowRight size={13} /></Link>}
          </div>
        </section>
      </div>

      <section className="bp-panel">
        <div className="rp-roster-head">
          <div>
            <h3>{selected?.batch_name || "Batch"} – Trainee Performance Roster <span className="bp-chip green">{roster.length} Students</span></h3>
            <p>Attendance, average grade, assignments and readiness for each trainee.</p>
          </div>
          <div className="rp-roster-chips">
            <span><i className="g" /> {buckets.high} Top tier</span>
            <span><i className="o" /> {buckets.attention} Needs coaching</span>
          </div>
        </div>
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr><th>Trainee Name</th><th>Attendance</th><th>Avg. Grade</th><th>Assignments</th><th>Readiness</th><th>Action</th></tr>
            </thead>
            <tbody>
              {trainees.length === 0 ? (
                <tr className="bp-empty-row"><td colSpan={6}>No trainees enrolled in this batch.</td></tr>
              ) : trainees.map((t, i) => (
                <tr key={t.enrollment_id}>
                  <td>
                    <div className="bp-person">
                      <span className={`bp-avatar t${i % 4}`}>{initialsOf(t.student_name)}</span>
                      <div><p className="bp-person-name">{t.student_name}</p><p className="bp-person-sub">{t.email}</p></div>
                    </div>
                  </td>
                  <td>
                    <div className="bp-att">
                      <b className={t.attendance_percentage != null && t.attendance_percentage < 80 ? "tr-orange" : ""}>{t.attendance_percentage != null ? `${t.attendance_percentage}%` : "—"}</b>
                      <div className="bp-meter"><span className={t.attendance_percentage != null && t.attendance_percentage < 80 ? "orange" : ""} style={{ width: `${t.attendance_percentage ?? 0}%` }} /></div>
                    </div>
                  </td>
                  <td className={`rp-grade ${t.avgScore != null && t.avgScore < 70 ? "tr-orange" : ""}`}>{t.avgScore != null ? `${t.avgScore}%` : "—"}</td>
                  <td>{t.submitted} of {t.assigned}</td>
                  <td><span className={`bp-chip ${t.readiness.tone}`}>{t.readiness.label}</span></td>
                  <td><Link to={`/training/batches/${selectedBatchId}`} className="rp-link">View Dossier</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bp-panel tr-card">
        <div className="tr-card-head">
          <div>
            <h3><FileSpreadsheet size={18} /> Zone Reports</h3>
            <p>Weekly or monthly attendance and task completion, saved for re-download.</p>
          </div>
          <div className="bp-actions">
            <button type="button" className="bp-btn soft" onClick={() => generateZoneReport("weekly")} disabled={downloading || !selectedBatchId}>{downloading ? "Generating…" : "Weekly Zone Report"}</button>
            <button type="button" className="bp-btn navy" onClick={() => generateZoneReport("monthly")} disabled={downloading || !selectedBatchId}>{downloading ? "Generating…" : "Monthly Zone Report"}</button>
          </div>
        </div>
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead><tr><th>Period</th><th>Date Range</th><th>Generated</th><th></th></tr></thead>
            <tbody>
              {loading ? (
                <tr className="bp-empty-row"><td colSpan={4}>Loading…</td></tr>
              ) : savedReports.length === 0 ? (
                <tr className="bp-empty-row"><td colSpan={4}>No reports generated yet for this batch.</td></tr>
              ) : savedReports.map((r) => (
                <tr key={r.report_id}>
                  <td className="bp-strong rp-cap">{r.period}</td>
                  <td>{r.start_date} → {r.end_date}</td>
                  <td className="bp-muted">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td><button type="button" className="bp-btn outline small" onClick={() => downloadSaved(r.report_id, r.period, r.start_date, r.end_date)}><Download size={13} /> Download</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default Reports;
