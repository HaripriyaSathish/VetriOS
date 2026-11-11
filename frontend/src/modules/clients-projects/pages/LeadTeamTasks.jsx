import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, ListTodo, Gauge, CircleCheck, FileWarning, Clock3, UserRound, FolderKanban, Search, ExternalLink } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const isDone = (s) => s === "COMPLETED" || s === "DONE";
const statusLabel = (s) => (isDone(s) ? "Completed" : s === "IN_PROGRESS" ? "In Progress" : "Pending");
const statusChip = (s) => (isDone(s) ? "green" : s === "IN_PROGRESS" ? "blue" : "orange");

const TABS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
];

function LeadTeamTasks() {
  const [tasks, setTasks] = useState([]);
  const [reportsByTask, setReportsByTask] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("ALL");
  const [search, setSearch] = useState("");

  const [reportModalTask, setReportModalTask] = useState(null);
  const [reportText, setReportText] = useState("");
  const [reportStatus, setReportStatus] = useState("APPROVED");
  const [reportAttachment, setReportAttachment] = useState(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState("");

  const fetchData = () =>
    Promise.all([
      client.get("/api/projects/my-team-tasks/"),
      client.get("/api/projects/my-filed-testing-reports/"),
    ])
      .then(([tasksRes, reportsRes]) => {
        setTasks(tasksRes.data || []);
        const grouped = {};
        (reportsRes.data || []).forEach((r) => {
          if (!grouped[r.project_task_id]) grouped[r.project_task_id] = [];
          grouped[r.project_task_id].push(r);
        });
        setReportsByTask(grouped);
        setError("");
      })
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your team's tasks."))
      .finally(() => setLoading(false));

  useEffect(() => { fetchData(); }, []);

  const openReportModal = (t) => {
    setReportModalTask(t);
    setReportText("");
    setReportStatus("APPROVED");
    setReportAttachment(null);
    setReportError("");
    setMessage("");
  };

  const submitTestingReport = async () => {
    if (!reportModalTask) return;
    if (!reportText.trim()) {
      setReportError("Report text is required.");
      return;
    }
    setReportSubmitting(true);
    setReportError("");
    try {
      const formData = new FormData();
      formData.append("project_task_id", reportModalTask.project_task_id);
      formData.append("report_text", reportText);
      formData.append("status", reportStatus);
      if (reportAttachment) formData.append("attachment", reportAttachment);
      await client.post("/api/interns/lead/testing-report/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("Testing report submitted.");
      setReportModalTask(null);
      fetchData();
    } catch (err) {
      setReportError(err.response?.data?.detail || "Couldn't submit testing report.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const bucket = (s) => (isDone(s) ? "COMPLETED" : s === "IN_PROGRESS" ? "IN_PROGRESS" : "PENDING");
  const counts = useMemo(() => {
    const c = { ALL: tasks.length, PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0 };
    tasks.forEach((t) => { c[bucket(t.status)] += 1; });
    return c;
  }, [tasks]);
  const reportsFiled = Object.values(reportsByTask).flat();
  const awaitingFix = reportsFiled.filter((r) => r.status === "NEEDS_FIXES" && !r.resolution_link && !r.resolution_notes).length;

  const visible = tasks.filter((t) => {
    if (tab !== "ALL" && bucket(t.status) !== tab) return false;
    const q = search.trim().toLowerCase();
    return !q || [t.title, t.assignee_name, t.project_name].some((v) => (v || "").toLowerCase().includes(q));
  });

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        section="Team Tasks"
        title="Team Tasks"
        subtitle="Kanban tasks assigned to people who report to you. File a testing report once you've reviewed their work."
      />

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">TEAM TASKS</p><span className="pm-ico navy"><ListTodo size={20} /></span></div>
          <p className="bp-stat-value">{counts.ALL}</p>
          <p className="pm-foot"><span>{counts.PENDING} pending</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">IN PROGRESS</p><span className="pm-ico soft"><Gauge size={20} /></span></div>
          <p className="bp-stat-value">{counts.IN_PROGRESS}</p>
          <p className="pm-foot"><span>Being worked on</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">COMPLETED</p><span className="pm-ico green"><CircleCheck size={20} /></span></div>
          <p className="bp-stat-value">{counts.COMPLETED}</p>
          <p className="pm-foot"><span className="pm-ok">{counts.ALL ? Math.round((counts.COMPLETED * 100) / counts.ALL) : 0}% done</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">TESTING REPORTS</p><span className="pm-ico orange"><ClipboardCheck size={20} /></span></div>
          <p className="bp-stat-value">{reportsFiled.length}</p>
          <p className="pm-foot"><span className={awaitingFix ? "pm-warn" : ""}>{awaitingFix} awaiting a fix</span></p>
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
        <label className="bp-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search task, person, project…" />
        </label>
      </div>

      {loading ? (
        <p className="bp-loading">Loading your team's tasks…</p>
      ) : visible.length === 0 ? (
        <p className="bp-panel pm-empty-panel">{tasks.length ? "No tasks match these filters." : "No tasks from your team yet."}</p>
      ) : (
        <div className="pm-list">
          {visible.map((t, idx) => {
            const taskReports = reportsByTask[t.project_task_id] || [];
            return (
              <article key={t.project_task_id || t.task_id} className="bp-panel pm-item" style={{ "--i": idx }}>
                <div className="pm-item-top">
                  <div>
                    <h3 className="pm-item-title">{t.title}</h3>
                    <p className="pm-item-meta">
                      <span><UserRound size={12} /> {t.assignee_name || "Unassigned"}</span>
                      {t.project_name && <span><FolderKanban size={12} /> {t.project_name}</span>}
                      <span><Clock3 size={12} /> Due {t.due_date || "—"}</span>
                      <span>Priority: <b>{t.priority || "—"}</b></span>
                    </p>
                  </div>
                  <span className={`bp-chip ${statusChip(t.status)}`}>{statusLabel(t.status)}</span>
                </div>

                {taskReports.length > 0 && (
                  <div className="pm-reports">
                    {taskReports.map((r) => (
                      <div key={r.report_id} className={`pm-report ${r.status === "APPROVED" ? "ok" : "fix"}`}>
                        <div className="pm-report-top">
                          <p>{r.report_text}</p>
                          <span className={`bp-chip ${r.status === "APPROVED" ? "green" : "orange"}`}>{r.status === "APPROVED" ? "Approved" : "Needs Fixes"}</span>
                        </div>
                        <small>Filed {new Date(r.created_at).toLocaleString()}</small>
                        {(r.resolution_link || r.resolution_notes) ? (
                          <div className="pm-fix">
                            <b>Developer&apos;s fix</b>
                            {r.resolution_link && <a href={r.resolution_link} target="_blank" rel="noreferrer"><ExternalLink size={12} /> {r.resolution_link}</a>}
                            {r.resolution_notes && <p>{r.resolution_notes}</p>}
                            <small>Submitted {new Date(r.resolved_at).toLocaleString()}</small>
                          </div>
                        ) : r.status === "NEEDS_FIXES" ? (
                          <p className="pm-waiting"><FileWarning size={12} /> Waiting for the developer&apos;s fix…</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                <div className="pm-item-foot">
                  <span>{taskReports.length} {taskReports.length === 1 ? "report" : "reports"} filed</span>
                  <button type="button" className="bp-btn navy small" onClick={() => openReportModal(t)} disabled={!t.project_task_id}>
                    <ClipboardCheck size={13} /> File Testing Report
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {reportModalTask && (
        <div className="bp-modal-backdrop" onClick={() => !reportSubmitting && setReportModalTask(null)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Testing Report</h2>
            <p className="bp-sub">{reportModalTask.title}{reportModalTask.assignee_name ? ` — ${reportModalTask.assignee_name}` : ""}</p>
            <div className="bp-form-grid">
              <label className="bp-field full"><span>Report</span>
                <textarea rows={4} value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="What did you test? What passed or failed?" />
              </label>
              <label className="bp-field"><span>Result</span>
                <select value={reportStatus} onChange={(e) => setReportStatus(e.target.value)}>
                  <option value="APPROVED">Approved</option>
                  <option value="NEEDS_FIXES">Needs Fixes</option>
                </select>
              </label>
              <label className="bp-field"><span>Attachment (optional)</span>
                <input type="file" onChange={(e) => setReportAttachment(e.target.files?.[0] || null)} />
              </label>
            </div>
            {reportError && <p className="bp-form-error">{reportError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setReportModalTask(null)} disabled={reportSubmitting}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={submitTestingReport} disabled={reportSubmitting}>{reportSubmitting ? "Submitting…" : "Submit Report"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeadTeamTasks;
