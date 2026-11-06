import { useEffect, useState } from "react";
import { CalendarClock, CircleCheck, Hourglass, CircleX, Send, History, Info, CalendarDays } from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/InternPages.css";

const TONE = { APPROVED: "green", REJECTED: "red", CANCELLED: "gray", PENDING: "orange" };

function ApplyLeave() {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const load = () => {
    Promise.all([
      client.get("/api/interns/leave-types/"),
      client.get("/api/interns/me/leave/"),
    ]).then(([typesRes, leavesRes]) => {
      setLeaveTypes(typesRes.data);
      setLeaves(leavesRes.data);
    }).catch((err) => setError(err.response?.data?.detail || "Couldn't load leave data."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!leaveTypeId || !startDate || !endDate) {
      setError("Leave type, start date, and end date are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await client.post("/api/interns/me/leave/", {
        leave_type_id: leaveTypeId, start_date: startDate, end_date: endDate, reason,
      });
      setMessage("Leave application submitted.");
      setLeaveTypeId(""); setStartDate(""); setEndDate(""); setReason("");
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit leave application.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="bp-loading">Loading…</p>;

  const by = (s) => leaves.filter((l) => l.status === s);
  const approvedDays = by("APPROVED").reduce((s, l) => s + Number(l.total_days || 0), 0);
  const spanDays = startDate && endDate && endDate >= startDate
    ? Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1
    : null;
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Intern Workspace / <span>Apply Leave</span></p>
          <h1 className="bp-title">Leave Management &amp; Time-Off</h1>
          <p className="bp-sub">Request time off and track the status of your applications.</p>
        </div>
      </div>

      {error && <p className="bp-notice in-error">{error}</p>}
      {message && <p className="bp-notice in-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">APPROVED LEAVE</p><span className="tr-stat-icon green"><CircleCheck size={20} /></span></div>
          <p className="bp-stat-value">{approvedDays} <small className="in-unit">Days</small></p>
          <p className="in-foot"><span>{by("APPROVED").length} approved applications</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">PENDING</p><span className="tr-stat-icon orange"><Hourglass size={20} /></span></div>
          <p className="bp-stat-value">{by("PENDING").length}</p>
          <p className="in-foot"><span>Waiting for approval</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">REJECTED</p><span className="tr-stat-icon orange"><CircleX size={20} /></span></div>
          <p className="bp-stat-value">{by("REJECTED").length}</p>
          <p className="in-foot"><span>Not approved</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">LEAVE TYPES</p><span className="tr-stat-icon blue"><CalendarClock size={20} /></span></div>
          <p className="bp-stat-value">{leaveTypes.length}</p>
          <p className="in-foot"><span>{leaveTypes.filter((t) => !t.is_paid).length} unpaid</span></p>
        </div>
      </div>

      <div className="tr-grid">
        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <h3><Send size={18} /> Submit Leave Request</h3>
              <p>Sent to your reporting manager for approval</p>
            </div>
            <span className="bp-chip blue">Draft</span>
          </div>
          <label className="bp-field">
            <span>Leave Category</span>
            <select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
              <option value="">Select…</option>
              {leaveTypes.map((t) => (
                <option key={t.leave_type_id} value={t.leave_type_id}>{t.name}{t.is_paid ? "" : " (Unpaid)"}</option>
              ))}
            </select>
          </label>
          <div className="bp-form-grid">
            <label className="bp-field"><span>From Date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="bp-field"><span>To Date</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>
          {spanDays != null && (
            <div className="in-span"><CalendarDays size={15} /> <span>Calendar span</span><b>{spanDays} {spanDays === 1 ? "day" : "days"}</b></div>
          )}
          <label className="bp-field">
            <span>Detailed Justification</span>
            <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do you need this leave?" />
          </label>
          <div className="bp-modal-actions">
            <button type="button" className="bp-btn navy" onClick={submit} disabled={submitting}><Send size={14} /> {submitting ? "Submitting…" : "Submit Application"}</button>
          </div>
        </section>

        <div className="tr-col">
          <section className="bp-panel tr-card">
            <div className="tr-card-head">
              <h3><History size={18} /> Recent Requests</h3>
              <span className="bp-muted in-small">{leaves.length} recorded</span>
            </div>
            {leaves.length === 0 ? <p className="tr-empty">No leave applications yet.</p> : leaves.slice(0, 6).map((l) => (
              <div key={l.leave_id} className="in-leave">
                <div className="in-leave-top">
                  <b>{l.leave_type || "Leave"}</b>
                  <span className={`bp-chip ${TONE[l.status] || "gray"}`}>{l.status.charAt(0) + l.status.slice(1).toLowerCase()}</span>
                </div>
                <p>{fmt(l.start_date)} – {fmt(l.end_date)}{l.total_days != null ? ` · ${l.total_days} day${Number(l.total_days) === 1 ? "" : "s"}` : ""}</p>
                {l.reason && <small>{l.reason}</small>}
              </div>
            ))}
          </section>

          <div className="in-notice">
            <Info size={16} />
            <div>
              <b>Leave Policy</b>
              <p>Apply ahead of time where you can, and let your project lead know who covers your tasks while you're away.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApplyLeave;
