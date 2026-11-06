import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FlaskConical, BadgeCheck, Bug, Gauge, Paperclip, ListTodo, Search, CircleCheck, CircleAlert } from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/InternPages.css";

function TestingReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    client.get("/api/interns/me/testing-reports/")
      .then(({ data }) => setReports(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load testing reports."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="bp-loading">Loading…</p>;
  if (error) return <p className="bp-error">{error}</p>;

  const approved = reports.filter((r) => r.status === "APPROVED");
  const fixes = reports.filter((r) => r.status !== "APPROVED");
  const rate = reports.length ? Math.round((approved.length / reports.length) * 1000) / 10 : null;
  const tasksCovered = new Set(reports.map((r) => r.task_title)).size;
  const q = search.trim().toLowerCase();
  const visible = (tab === "approved" ? approved : tab === "fixes" ? fixes : reports)
    .filter((r) => !q || `${r.task_title} ${r.report_text} ${r.created_by}`.toLowerCase().includes(q));

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Intern Workspace &gt; Quality Assurance &gt; <span>Testing Reports</span></p>
          <h1 className="bp-title">Testing &amp; QA Reports</h1>
          <p className="in-kicker">
            {rate != null && <span className={`bp-chip ${rate >= 80 ? "green" : "orange"}`}>{rate}% approved</span>}
            <span className="bp-sub in-inline-sub">Feedback from your project lead on each task submission.</span>
          </p>
        </div>
        <div className="bp-actions">
          <Link to="/intern/tasks" className="bp-btn navy"><ListTodo size={16} /> Go to My Tasks</Link>
        </div>
      </div>

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">APPROVAL RATE</p><span className="tr-stat-icon green"><Gauge size={20} /></span></div>
          <p className="bp-stat-value">{rate != null ? `${rate}%` : "—"}</p>
          <p className="in-foot"><span>Reports marked approved</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">APPROVED</p><span className="tr-stat-icon blue"><BadgeCheck size={20} /></span></div>
          <p className="bp-stat-value">{approved.length}</p>
          <p className="in-foot"><span>No further action needed</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">TASKS TESTED</p><span className="tr-stat-icon blue"><FlaskConical size={20} /></span></div>
          <p className="bp-stat-value">{tasksCovered}</p>
          <p className="in-foot"><span>{reports.length} reports in total</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">OPEN DEFECTS</p><span className="tr-stat-icon orange"><Bug size={20} /></span></div>
          <p className={`bp-stat-value ${fixes.length ? "tr-orange" : ""}`}>{fixes.length} <small className="in-unit">Needs fixes</small></p>
          <p className="in-foot"><span>Fix and resubmit from My Tasks</span></p>
        </div>
      </div>

      <div className="tr-grid">
        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <h3>Report Breakdown by Task</h3>
              <p>Every report your lead has filed on your submissions</p>
            </div>
            <div className="bp-tabs">
              {[
                { k: "all", l: `All (${reports.length})` },
                { k: "fixes", l: `Needs Fixes (${fixes.length})` },
                { k: "approved", l: `Approved (${approved.length})` },
              ].map((t) => (
                <button key={t.k} type="button" className={`bp-tab ${tab === t.k ? "active" : ""}`} onClick={() => setTab(t.k)}>{t.l}</button>
              ))}
            </div>
          </div>
          <label className="bp-search">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search task, feedback or reviewer…" />
          </label>
          {visible.length === 0 ? <p className="tr-empty">{reports.length ? "No reports match." : "No testing reports yet."}</p> : visible.map((r) => {
            const ok = r.status === "APPROVED";
            return (
              <article key={r.report_id} className={`in-card ${ok ? "green" : "warm"}`}>
                <div className="in-card-top">
                  <div>
                    <small className="in-rep-id">#REP-{r.report_id}</small>
                    <h3>{r.task_title}</h3>
                  </div>
                  <span className={`bp-chip ${ok ? "green" : "orange"}`}>{ok ? <><CircleCheck size={12} /> Approved</> : <><CircleAlert size={12} /> Needs Fixes</>}</span>
                </div>
                <p className="in-card-text">{r.report_text}</p>
                <p className="in-card-meta">
                  <span>{r.created_by}</span>
                  <span>{new Date(r.created_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  {r.attachment_url && <a href={r.attachment_url} target="_blank" rel="noreferrer" className="in-attach"><Paperclip size={12} /> View Attachment</a>}
                </p>
              </article>
            );
          })}
        </section>

        <section className="bp-panel tr-card">
          <div className="tr-card-head"><h3>Review Pipeline</h3></div>
          {reports.length === 0 ? <p className="tr-empty">Nothing reviewed yet.</p> : (
            <ul className="in-timeline">
              {reports.slice(0, 6).map((r) => (
                <li key={r.report_id} className={r.status === "APPROVED" ? "ok" : "warn"}>
                  <b>{r.task_title}</b>
                  <small>{r.status === "APPROVED" ? "Approved" : "Fixes requested"} · {new Date(r.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</small>
                </li>
              ))}
            </ul>
          )}
          <div className="in-box">
            <p><b>How it works</b></p>
            <p>Submit a task from My Tasks. Your lead tests it and files a report here. If fixes are needed, update the task and resubmit.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default TestingReports;
