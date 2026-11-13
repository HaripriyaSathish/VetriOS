import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sun, Palmtree, HeartPulse, CalendarDays, Check, X } from "lucide-react";
import client from "../../../api/client";
import "../styles/HRDashboard.css";
import "../styles/Attendance.css";
import "../styles/Leave.css";
import "../styles/Employees.css";
import "../../documents/styles/DocumentLibrary.css";
import "../styles/EmployeePages.css";
import "../styles/LeaveRequest.css";

const STATUS_LABEL = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

const STATUS_CLASS = {
  PENDING: "half",
  APPROVED: "present",
  REJECTED: "absent",
  CANCELLED: "absent",
};

const BALANCE_TONES = ["blue", "green", "red", "violet", "amber"];
const BALANCE_ICONS = [Sun, Palmtree, HeartPulse, CalendarDays, CalendarDays];

// "Casual Leave" / "Hourly permission · 10:00–12:00" / "On duty · Exhibition"
function typeText(r) {
  if (r.request_kind === "PERMISSION") return `Hourly permission · ${r.from_time}–${r.to_time}`;
  if (r.request_kind === "ON_DUTY") return `On duty · ${r.on_duty_reason || ""}`;
  if (r.request_kind === "WFH") return "Work from home";
  return r.leave_type_name || "—";
}
const lengthText = (r) =>
  r.request_kind === "PERMISSION"
    ? (() => {
        const [h1, m1] = r.from_time.split(":").map(Number);
        const [h2, m2] = r.to_time.split(":").map(Number);
        const h = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
        return `${Math.round(h * 100) / 100} h`;
      })()
    : `${r.total_days} ${r.total_days === 1 ? "day" : "days"}`;

function formatDateRange(start, end) {
  const opts = { day: "numeric", month: "short", year: "numeric" };
  const s = new Date(start).toLocaleDateString(undefined, opts);
  if (start === end) return s;
  const e = new Date(end).toLocaleDateString(undefined, opts);
  return `${s} – ${e}`;
}

// Employee-facing Leave page — own balances, apply for leave, and see
// the status/history of every request you've made (including HR's
// rejection reason, when rejected). Not HR-gated: self-service only,
// approve/reject stay HR-only actions elsewhere.
function MyLeave() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deciding, setDeciding] = useState(null); // leave_id currently being approved/rejected
  const [rejecting, setRejecting] = useState(null); // leave_id with the reason box open
  const [rejectReason, setRejectReason] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [meRes, inboxRes] = await Promise.all([client.get("/api/hr/leave/me/"), client.get("/api/hr/leave/inbox/")]);
      setData(meRes.data);
      setInbox(inboxRes.data);
    } catch {
      setError("Couldn't load your leave data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const decide = async (leave, action) => {
    setDeciding(leave.leave_id);
    setError("");
    try {
      await client.post(
        `/api/hr/leave/requests/${leave.leave_id}/${action}/`,
        action === "reject" ? { reason: rejectReason } : undefined
      );
      setRejecting(null);
      setRejectReason("");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.reason?.[0] || "Couldn't update that request.");
    } finally {
      setDeciding(null);
    }
  };

  const pendingInbox = inbox.filter((r) => r.status === "PENDING");

  const requests = data?.requests || [];
  const balances = (data?.my_balances || []).filter((b) => !/maternity/i.test(b.leave_type_name));

  return (
    <div className="att-screen emp2 dl2">
      <div className="dl2-ban">
        <div className="dl2-ban-top">
          <div>
            <h1>Apply leave</h1>
            <p>Request leave, permission, work from home or on duty, and track each request.</p>
          </div>
          <div className="dl2-ban-actions">
            <button type="button" className="dl2-new" onClick={() => navigate("/my/leave/new")} disabled={!data?.employee_id}>
              <Plus size={15} /> New request
            </button>
          </div>
        </div>
      </div>

      <div className="dl2-body">
        {error && <p className="att-error">{error}</p>}
        {!loading && !data?.employee_id && (
          <p className="att-error">No employee record is linked to your account — leave can't be requested.</p>
        )}

        {balances.length > 0 && (
          <div className="att2-cards emp2-balance">
            {balances.map((b, i) => {
              const pct = b.allocated_days > 0 ? Math.min(100, (b.used_days / b.allocated_days) * 100) : 0;
              const Icon = BALANCE_ICONS[i % BALANCE_ICONS.length];
              return (
                <div className={`att2-card tone-${BALANCE_TONES[i % BALANCE_TONES.length]}`} key={b.leave_type_id}>
                  <span className="att2-card-top">
                    <span className="att2-card-icon"><Icon size={16} /></span>
                    <b>{b.remaining_days}</b>
                  </span>
                  <span className="att2-card-label">
                    <span>{b.leave_type_name}</span>
                    <em>{b.used_days} of {b.allocated_days} used · days left</em>
                  </span>
                  <span className="emp2-bar"><span style={{ width: `${pct}%` }} /></span>
                </div>
              );
            })}
          </div>
        )}

        {inbox.length > 0 && (
          <div className="emp2-panel">
            <div className="emp2-panel-head">
              <div>
                <h3>Requests sent to you</h3>
                <p>{pendingInbox.length ? `${pendingInbox.length} waiting for your decision` : "Nothing waiting for you"}</p>
              </div>
            </div>
            <div className="hr-table-scroll">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Request</th>
                    <th>Dates</th>
                    <th>Length</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inbox.map((r) => (
                    <tr key={r.leave_id}>
                      <td><b>{r.full_name}</b></td>
                      <td>{typeText(r)}</td>
                      <td>{formatDateRange(r.start_date, r.end_date)}</td>
                      <td className="hr-mono">{lengthText(r)}</td>
                      <td className="hr-sub">{r.reason || "—"}</td>
                      <td>
                        <span className={"att-pill " + (STATUS_CLASS[r.status] || "absent")}>{STATUS_LABEL[r.status] || r.status}</span>
                      </td>
                      <td>
                        {r.status === "PENDING" ? (
                          rejecting === r.leave_id ? (
                            <div className="lq-inbox-reason">
                              <input
                                autoFocus
                                placeholder="Reason for rejecting"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                              />
                              <button
                                type="button"
                                className="lv-action-btn lv-action-reject"
                                disabled={deciding === r.leave_id || !rejectReason.trim()}
                                onClick={() => decide(r, "reject")}
                              >
                                <X size={14} /> Reject
                              </button>
                              <button type="button" className="hr-btn-sm" onClick={() => { setRejecting(null); setRejectReason(""); }}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="lq-inbox-actions">
                              <button
                                type="button"
                                className="lv-action-btn lv-action-approve"
                                disabled={deciding === r.leave_id}
                                onClick={() => decide(r, "approve")}
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button type="button" className="lv-action-btn lv-action-reject" onClick={() => setRejecting(r.leave_id)}>
                                <X size={14} /> Reject
                              </button>
                            </div>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="emp2-panel">
          <div className="emp2-panel-head">
            <div>
              <h3>My requests</h3>
              <p>Leave, hourly permission, work from home and on-duty requests, and where each stands</p>
            </div>
          </div>

          {loading ? (
            <p className="hr-empty">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="hr-empty">You haven't requested any leave yet.</p>
          ) : (
            <div className="hr-table-scroll">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Dates</th>
                    <th>Length</th>
                    <th>Sent to</th>
                    <th>Reason</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.leave_id}>
                      <td>{typeText(r)}</td>
                      <td>{formatDateRange(r.start_date, r.end_date)}</td>
                      <td className="hr-mono">{lengthText(r)}</td>
                      <td className="hr-sub">{r.approver_name ? `${r.approver_name} · ${r.approver_category}` : "HR"}</td>
                      <td className="hr-sub">{r.reason || "—"}</td>
                      <td>
                        <span className={"att-pill " + (STATUS_CLASS[r.status] || "absent")}>
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyLeave;
