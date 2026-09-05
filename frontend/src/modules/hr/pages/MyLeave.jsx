import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import client from "../../../api/client";
import "../styles/HRDashboard.css";
import "../styles/Attendance.css";
import "../styles/Leave.css";

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

const EMPTY_FORM = { leave_type_id: "", start_date: "", end_date: "", reason: "" };

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
  const [data, setData] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [meRes, typesRes] = await Promise.all([
        client.get("/api/hr/leave/me/"),
        client.get("/api/hr/leave/types/"),
      ]);
      setData(meRes.data);
      setLeaveTypes(typesRes.data);
    } catch (err) {
      setError("Couldn't load your leave data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewRequest = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await client.post("/api/hr/leave/requests/", form);
      setModalOpen(false);
      await loadData();
    } catch (err) {
      const errData = err.response?.data;
      const firstError = errData && Object.values(errData)[0];
      setFormError(Array.isArray(firstError) ? firstError[0] : errData?.detail || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const requests = data?.requests || [];

  return (
    <div className="att-screen">
      <div className="att-head">
        <div>
          <span className="att-eyebrow">My workspace</span>
          <h1>Apply Leave</h1>
          <p>Request time off and track the status of your requests.</p>
        </div>
        <button type="button" className="att-btn-accent" onClick={openNewRequest} disabled={!data?.employee_id}>
          <Plus size={15} /> New request
        </button>
      </div>

      {error && <p className="att-error">{error}</p>}
      {!loading && !data?.employee_id && (
        <p className="att-error">No employee record is linked to your account — leave can't be requested.</p>
      )}

      <div className="lv-balance-row">
        {(data?.my_balances || []).map((b) => {
          const pct = b.allocated_days > 0 ? Math.min(100, (b.used_days / b.allocated_days) * 100) : 0;
          return (
            <div className="lv-balance-card" key={b.leave_type_id}>
              <span className="lv-balance-label">{b.leave_type_name}</span>
              <span className="lv-balance-value">
                {b.remaining_days} <span className="lv-balance-unit">days left</span>
              </span>
              <div className="lv-balance-bar">
                <div className="lv-balance-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="lv-balance-sub">
                {b.used_days} used of {b.allocated_days} total
              </span>
            </div>
          );
        })}
      </div>

      <div className="att-panel">
        <div className="att-panel-head">
          <div>
            <h3>My requests</h3>
            <p>Status and history of every leave you've requested</p>
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
                  <th>Leave type</th>
                  <th>Dates</th>
                  <th>Duration</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.leave_id}>
                    <td>{r.leave_type_name || "—"}</td>
                    <td>{formatDateRange(r.start_date, r.end_date)}</td>
                    <td className="hr-mono">
                      {r.total_days} {r.total_days === 1 ? "day" : "days"}
                    </td>
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

      {modalOpen && (
        <div className="hr-modal-backdrop" onClick={() => setModalOpen(false)}>
          <form className="hr-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <button type="button" className="hr-modal-x" onClick={() => setModalOpen(false)} aria-label="Close">
              ✕
            </button>
            <h2>New leave request</h2>
            <p className="hr-hint">This request will be reviewed by HR Administrator or System Administrator.</p>

            <label>Leave type</label>
            <select
              value={form.leave_type_id}
              onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}
              required
            >
              <option value="">Select…</option>
              {leaveTypes.map((t) => (
                <option key={t.leave_type_id} value={t.leave_type_id}>
                  {t.leave_type_name}
                </option>
              ))}
            </select>

            <div className="hr-form-row">
              <div>
                <label>Start date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>End date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <label>Reason (optional)</label>
            <textarea
              className="lv-textarea"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
            />

            {formError && <p className="hr-error">{formError}</p>}

            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="hr-btn-accent" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit request"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default MyLeave;
