import { useEffect, useMemo, useState } from "react";
import { Plus, Check, X } from "lucide-react";
import client from "../../../api/client";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import "../styles/HRDashboard.css";
import "../styles/Leave.css";

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

// Leave management screen — balances for the logged-in user (auto-
// allocated company-wide: 12 CL / 6 SL / 15 Earned / 182 Maternity),
// org-wide pending/upcoming stats, and the request list with
// approve/reject actions on pending rows.
function Leave() {
  const [summary, setSummary] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all"); // "all" | "pending" | "approved"

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [actionError, setActionError] = useState("");

  // { leave, action: "approve" | "reject" } — null when no confirm modal
  // is open. reject requires typing a reason before it can be confirmed.
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, typesRes] = await Promise.all([
        client.get("/api/hr/leave/summary/"),
        client.get("/api/hr/leave/types/"),
      ]);
      setSummary(summaryRes.data);
      setLeaveTypes(typesRes.data);
    } catch (err) {
      setError("Couldn't load leave data.");
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
      const data = err.response?.data;
      const firstError = data && Object.values(data)[0];
      setFormError(Array.isArray(firstError) ? firstError[0] : data?.detail || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const openConfirm = (leave, action) => {
    setConfirmTarget({ leave, action });
    setRejectReason("");
    setActionError("");
  };

  const closeConfirm = () => setConfirmTarget(null);

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    const { leave, action } = confirmTarget;
    setConfirming(true);
    setActionError("");
    try {
      if (action === "approve") {
        await client.post(`/api/hr/leave/requests/${leave.leave_id}/approve/`);
      } else {
        await client.post(`/api/hr/leave/requests/${leave.leave_id}/reject/`, { reason: rejectReason });
      }
      setConfirmTarget(null);
      await loadData();
    } catch (err) {
      const data = err.response?.data;
      setActionError(data?.reason?.[0] || data?.detail || `Couldn't ${action} that request.`);
    } finally {
      setConfirming(false);
    }
  };

  const requests = summary?.requests || [];
  const counts = useMemo(
    () => ({
      all: requests.length,
      pending: requests.filter((r) => r.status === "PENDING").length,
      approved: requests.filter((r) => r.status === "APPROVED").length,
    }),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    if (tab === "pending") return requests.filter((r) => r.status === "PENDING");
    if (tab === "approved") return requests.filter((r) => r.status === "APPROVED");
    return requests;
  }, [requests, tab]);

  return (
    <div className="att-screen">
      <div className="att-head">
        <div>
          <span className="att-eyebrow">Time off</span>
          <h1>Leave management</h1>
          <p>Review balances, requests, and upcoming time away.</p>
        </div>
        <button type="button" className="att-btn-accent" onClick={openNewRequest}>
          <Plus size={15} /> New request
        </button>
      </div>

      {error && <p className="att-error">{error}</p>}
      {actionError && <p className="att-error">{actionError}</p>}

      <div className="lv-balance-row">
        {(summary?.my_balances || []).map((b) => {
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
        {!loading && (summary?.my_balances || []).length === 0 && (
          <p className="hr-empty">No employee record is linked to your account — no personal balance to show.</p>
        )}
      </div>

      <div className="att-stats" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <div className="att-stat-card">
          <span className="att-stat-label">Pending approvals</span>
          <span className="att-stat-value">{summary?.stats.pending_approvals ?? "—"}</span>
          <span className="att-stat-sub">Need your review</span>
        </div>
        <div className="att-stat-card">
          <span className="att-stat-label">Upcoming time off</span>
          <span className="att-stat-value">{summary?.stats.upcoming_days ?? "—"}</span>
          <span className="att-stat-sub">
            days booked · across {summary?.stats.upcoming_employees ?? 0} employees
          </span>
        </div>
      </div>

      <div className="att-panel">
        <div className="att-panel-head">
          <div>
            <h3>Leave requests</h3>
            <p>Review and action requests from your team</p>
          </div>
          <div className="lv-tabs">
            <button
              type="button"
              className={"lv-tab" + (tab === "all" ? " active" : "")}
              onClick={() => setTab("all")}
            >
              All {counts.all}
            </button>
            <button
              type="button"
              className={"lv-tab" + (tab === "pending" ? " active" : "")}
              onClick={() => setTab("pending")}
            >
              Pending {counts.pending}
            </button>
            <button
              type="button"
              className={"lv-tab" + (tab === "approved" ? " active" : "")}
              onClick={() => setTab("approved")}
            >
              Approved {counts.approved}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="hr-empty">Loading…</p>
        ) : filteredRequests.length === 0 ? (
          <p className="hr-empty">No leave requests here.</p>
        ) : (
          <div className="hr-table-scroll">
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave type</th>
                  <th>Dates</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((r) => (
                  <tr key={r.leave_id}>
                    <td>
                      <div className="hr-cell-user">
                        <EmployeeAvatar personId={r.person_id} size={28} />
                        <div className="hr-name">{r.full_name}</div>
                      </div>
                    </td>
                    <td>{r.leave_type_name || "—"}</td>
                    <td>{formatDateRange(r.start_date, r.end_date)}</td>
                    <td className="hr-mono">
                      {r.total_days} {r.total_days === 1 ? "day" : "days"}
                    </td>
                    <td>
                      <span className={"att-pill " + (STATUS_CLASS[r.status] || "absent")}>
                        {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td>
                      {r.status === "PENDING" ? (
                        <div className="hr-row-actions">
                          <button
                            type="button"
                            className="lv-action-btn lv-action-approve"
                            title="Approve"
                            onClick={() => openConfirm(r, "approve")}
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            type="button"
                            className="lv-action-btn lv-action-reject"
                            title="Reject"
                            onClick={() => openConfirm(r, "reject")}
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      ) : (
                        "—"
                      )}
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
            <p className="hr-hint">Requests you submit here are for your own employee record.</p>

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

      {confirmTarget && (
        <div className="hr-modal-backdrop" onClick={closeConfirm}>
          <div className="hr-modal hr-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>
              {confirmTarget.action === "approve" ? "Approve" : "Reject"} {confirmTarget.leave.full_name}'s request?
            </h2>
            <p>
              {confirmTarget.leave.leave_type_name} · {formatDateRange(confirmTarget.leave.start_date, confirmTarget.leave.end_date)} ·{" "}
              {confirmTarget.leave.total_days} {confirmTarget.leave.total_days === 1 ? "day" : "days"}
            </p>

            {confirmTarget.action === "reject" && (
              <>
                <label>Reason for rejecting</label>
                <textarea
                  className="lv-textarea"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  autoFocus
                  required
                />
              </>
            )}

            {actionError && <p className="hr-error">{actionError}</p>}

            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={closeConfirm}>
                Cancel
              </button>
              <button
                type="button"
                className={confirmTarget.action === "reject" ? "hr-btn-sm hr-btn-danger" : "hr-btn-accent"}
                onClick={handleConfirm}
                disabled={confirming || (confirmTarget.action === "reject" && !rejectReason.trim())}
              >
                {confirming ? "Working…" : confirmTarget.action === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Leave;
