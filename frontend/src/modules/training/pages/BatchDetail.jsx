import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, BookOpen, CalendarDays, ClipboardCheck, Flag, GraduationCap, Plus, Search,
  Trash2, UserRound, Users, Activity,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/TrainerDashboard.css";
import "../styles/TrainingBatches.css";
import "../styles/BatchDetail.css";

const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const initials = (name) => (name || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

function pacing(batch) {
  if (!batch?.start_date || !batch?.end_date) return null;
  const start = new Date(batch.start_date).getTime();
  const end = new Date(batch.end_date).getTime();
  if (end <= start) return null;
  return Math.max(0, Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100)));
}

function BatchDetail() {
  const { batchId } = useParams();
  const navigate = useNavigate();

  const [batch, setBatch] = useState(null);
  const [roster, setRoster] = useState([]);
  const [topicLogs, setTopicLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");

  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logTopic, setLogTopic] = useState("");
  const [logging, setLogging] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [batchRes, rosterRes, logsRes] = await Promise.all([
        client.get(`/api/training/batches/${batchId}/detail/`),
        client.get(`/api/training/batches/${batchId}/roster/`),
        client.get(`/api/training/batches/${batchId}/topic-log/`),
      ]);
      setBatch(batchRes.data);
      setRoster(rosterRes.data);
      setTopicLogs(logsRes.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't load this batch.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addTopicLog = async (event) => {
    event.preventDefault();
    if (!logTopic.trim()) return;
    setLogging(true);
    setActionError("");
    try {
      await client.post(`/api/training/batches/${batchId}/topic-log/`, {
        date: logDate,
        topic: logTopic.trim(),
      });
      setLogTopic("");
      await loadData();
    } catch (err) {
      setActionError(err.response?.data?.detail || "Couldn't log topic.");
    } finally {
      setLogging(false);
    }
  };

  const deleteLog = async (topicLogId) => {
    setActionError("");
    try {
      await client.delete(`/api/training/topic-log/${topicLogId}/`);
      await loadData();
    } catch (err) {
      setActionError(err.response?.data?.detail || "Couldn't delete entry.");
    }
  };

  const visibleRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((r) => [r.student_name, r.email].some((v) => (v || "").toLowerCase().includes(q)));
  }, [roster, search]);

  if (loading) return <p className="bp-loading">Loading…</p>;
  if (error) return <p className="bp-error">{error}</p>;
  if (!batch) return null;

  const progress = pacing(batch);
  const rates = roster.map((r) => r.attendance_percentage).filter((v) => v !== null && v !== undefined);
  const avgAttendance = rates.length ? Math.round((rates.reduce((s, v) => s + Number(v), 0) / rates.length) * 10) / 10 : null;
  const isActive = batch.status === "ACTIVE";
  const seatsPct = batch.capacity ? Math.min(100, Math.round((batch.students_enrolled / batch.capacity) * 100)) : null;

  return (
    <div className="bp-page tr-page">
      <button type="button" className="bd-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={15} /> Back
      </button>

      <div className="bp-head">
        <div>
          <p className="bp-crumb">
            Trainer Workspace / <Link to="/training/batches" className="bd-crumb-link">Training Batches</Link> / <span>{batch.batch_code}</span>
          </p>
          <div className="tr-title-row">
            <h1 className="bp-title">{batch.batch_name}</h1>
            <span className={`bp-chip ${isActive ? "green" : "gray"}`}>{batch.status}</span>
          </div>
          <p className="bp-sub">{batch.course_name} · {batch.batch_code}</p>
        </div>
        <div className="bp-actions">
          <Link to="/training/attendance" className="bp-btn orange">
            <ClipboardCheck size={16} /> Take Attendance
          </Link>
        </div>
      </div>

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label tb-label">TRAINER</p>
            <span className="tb-stat-icon navy"><UserRound size={20} /></span>
          </div>
          <p className="bp-stat-value bd-stat-text">{batch.trainer_name || "Unassigned"}</p>
          <p className="tr-stat-sub">Lead trainer for this cohort</p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label tb-label">BATCH TIMELINE</p>
            <span className="tb-stat-icon green"><CalendarDays size={20} /></span>
          </div>
          <p className="bp-stat-value">{progress != null ? `${progress}%` : "—"}</p>
          <div className="tr-progress thin"><span style={{ width: `${progress ?? 0}%` }} /></div>
          <p className="tb-foot"><span>{fmt(batch.start_date)}</span> → <span>{fmt(batch.end_date)}</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label tb-label">STUDENTS ENROLLED</p>
            <span className="tb-stat-icon blue"><Users size={20} /></span>
          </div>
          <p className="bp-stat-value">{batch.students_enrolled} <small className="tb-unit">/ {batch.capacity ?? "—"} seats</small></p>
          <div className="tr-progress thin warm"><span style={{ width: `${seatsPct ?? 0}%` }} /></div>
          <p className="tb-foot"><span className="bp-chip blue">{seatsPct != null ? `${seatsPct}% filled` : "No capacity set"}</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label tb-label">AVERAGE ATTENDANCE</p>
            <span className="tb-stat-icon orange"><Activity size={20} /></span>
          </div>
          <p className="bp-stat-value tr-orange">{avgAttendance != null ? `${avgAttendance}%` : "—"}</p>
          <p className="tr-stat-sub">Across {rates.length} of {roster.length} students</p>
          <p className="tb-foot"><span className="bp-chip green">{topicLogs.length} topics</span> <span>logged so far</span></p>
        </div>
      </div>

      {actionError && <p className="bd-alert">{actionError}</p>}

      <section className="bp-panel tr-card">
        <div className="tr-card-head">
          <div>
            <h3><BookOpen size={18} /> Topics Covered</h3>
            <p>Log what was taught in each session to keep curriculum pacing visible</p>
          </div>
          <span className="bp-chip blue">{topicLogs.length} entries</span>
        </div>

        <form onSubmit={addTopicLog} className="bd-log-form">
          <label className="bp-field">
            <span>Date</span>
            <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
          </label>
          <label className="bp-field bd-grow">
            <span>Topic covered</span>
            <input
              value={logTopic}
              onChange={(e) => setLogTopic(e.target.value)}
              placeholder="e.g. React Hooks — useState, useEffect"
            />
          </label>
          <button type="submit" disabled={logging || !logTopic.trim()} className="bp-btn navy bd-submit">
            <Plus size={16} /> {logging ? "Adding…" : "Add Entry"}
          </button>
        </form>

        {topicLogs.length === 0 ? (
          <div className="bd-empty">
            <Flag size={22} />
            <p>No topics logged yet. Add the first session above.</p>
          </div>
        ) : (
          <ol className="bd-timeline">
            {topicLogs.map((l, i) => (
              <li key={l.topic_log_id} style={{ "--row": i }}>
                <span className="bd-dot" />
                <div className="bd-tl-body">
                  <div className="bd-tl-top">
                    <span className="bd-tl-date"><CalendarDays size={13} /> {fmt(l.date)}</span>
                    <button type="button" className="bd-remove" onClick={() => deleteLog(l.topic_log_id)} title="Remove entry">
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                  <p className="bd-tl-topic">{l.topic}</p>
                  <p className="bd-tl-by">Logged by {l.logged_by || "—"}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="bp-panel">
        <div className="tr-card-head bd-roster-head">
          <div>
            <h3><GraduationCap size={18} /> Enrolled Students</h3>
            <p>{roster.length} students on this batch roster</p>
          </div>
          <label className="bp-search bd-search">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student or email…" />
          </label>
        </div>
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Phone</th>
                <th>Enrolled On</th>
                <th>Status</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {visibleRoster.length === 0 ? (
                <tr className="bp-empty-row">
                  <td colSpan={5}>{roster.length === 0 ? "No students enrolled yet." : "No students match your search."}</td>
                </tr>
              ) : (
                visibleRoster.map((r, i) => {
                  const pct = r.attendance_percentage;
                  const hasPct = pct !== null && pct !== undefined;
                  return (
                    <tr key={r.enrollment_id} style={{ "--row": i }}>
                      <td>
                        <div className="bp-person">
                          <span className={`bp-avatar t${(i % 3) + 1}`}>{initials(r.student_name)}</span>
                          <div>
                            <p className="bp-person-name">{r.student_name}</p>
                            <p className="bp-person-sub">{r.email || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="bp-muted">{r.phone || "—"}</td>
                      <td className="bp-muted">{fmt(r.enrollment_date)}</td>
                      <td>
                        <span className={`bp-chip ${r.status === "ACTIVE" ? "green" : r.status === "DROPPED" ? "red" : "gray"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        {hasPct ? (
                          <div className="bp-att">
                            <div className="bp-meter">
                              <span className={Number(pct) < 75 ? "orange" : ""} style={{ width: `${Math.min(100, Number(pct))}%` }} />
                            </div>
                            <b>{pct}%</b>
                          </div>
                        ) : (
                          <span className="bp-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default BatchDetail;
