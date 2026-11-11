import { useEffect, useMemo, useState } from "react";
import { Plus, Check, X, Sun, Palmtree, HeartPulse, Baby, CalendarDays, CalendarPlus, Hourglass, CalendarClock } from "lucide-react";
import client from "../../../api/client";
import Pagination, { paginate } from "../../../components/Pagination";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import "../styles/HRDashboard.css";
import "../styles/Employees.css";
import "../styles/Leave.css";

const STATUS_CLASS = {
  PENDING: "half",
  APPROVED: "present",
  REJECTED: "absent",
  CANCELLED: "absent",
};

const PAGE_SIZE = 10;

const TONES = ["blue", "green", "orange", "violet"];

const leaveIcon = (name) => {
  const n = String(name || "").toLowerCase();
  if (n.includes("casual")) return Sun;
  if (n.includes("earned")) return Palmtree;
  if (n.includes("sick")) return HeartPulse;
  if (n.includes("matern")) return Baby;
  return CalendarDays;
};

// Inclusive count of calendar days between two yyyy-mm-dd dates (0 if unset or reversed).
const calendarDays = (start, end) => {
  if (!start || !end) return 0;
  const diff = Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1;
  return diff > 0 ? diff : 0;
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
  const [tab, setTabState] = useState("all"); // "all" | "pending" | "approved"
  const [page, setPage] = useState(1);
  const setTab = (t) => {
    setTabState(t);
    setPage(1);
  };

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

  const safePage = Math.min(page, Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE)));

  return (
    <div className="att-screen lv-v2">
      <div className="att-head">
        <div>
          <h1>Leave management</h1>
          <p>Review balances, requests, and upcoming time away.</p>
        </div>
        <button type="button" className="att-btn-accent" onClick={openNewRequest}>
          <Plus size={15} /> New request
        </button>
      </div>

      {error && <p className="att-error">{error}</p>}
      {actionError && <p className="att-error">{actionError}</p>}

      <div className="lv2-groups">
      <div className="lv2-group lv2-group-bal">
        <p className="lv2-label">My leave balance</p>
        <div className="lv2-row lv2-row-3">
        {(summary?.my_balances || []).filter((b) => !/maternity/i.test(b.leave_type_name)).map((b, i) => {
          const pct = b.allocated_days > 0 ? Math.min(100, (b.used_days / b.allocated_days) * 100) : 0;
          const Icon = leaveIcon(b.leave_type_name);
          return (
            <div className={`lv-balance-card lv2-tone-${TONES[i % TONES.length]}`} key={b.leave_type_id}>
              <div className="lv2-balance-top">
                <span className="lv2-icon"><Icon size={18} /></span>
                <div>
                  <span className="lv-balance-value">
                    {b.remaining_days} <span className="lv-balance-unit">days left</span>
                  </span>
                  <span className="lv-balance-label">{b.leave_type_name}</span>
                </div>
              </div>
              <div className="lv-balance-bar">
                <div className="lv-balance-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="lv-balance-sub">
                <span>{b.used_days} used</span>
                <span>{b.allocated_days} total</span>
              </span>
            </div>
          );
        })}
        </div>
      </div>

      <div className="lv2-group lv2-group-team">
        <p className="lv2-label">Team overview</p>
        <div className="lv2-row lv2-row-2">
        <div className="lv2-stat lv2-tone-blue">
          <div className="lv2-balance-top">
            <span className="lv2-icon"><Hourglass size={18} /></span>
            <b>{summary?.stats.pending_approvals ?? "—"}</b>
          </div>
          <span className="lv2-stat-label">Pending approvals</span>
          <span className="lv2-stat-sub">Need your review</span>
        </div>
        <div className="lv2-stat lv2-tone-green">
          <div className="lv2-balance-top">
            <span className="lv2-icon"><CalendarClock size={18} /></span>
            <b>{summary?.stats.upcoming_days ?? "—"}</b>
          </div>
          <span className="lv2-stat-label">Upcoming time off</span>
          <span className="lv2-stat-sub">days · {summary?.stats.upcoming_employees ?? 0} employees</span>
        </div>
        </div>
      </div>
      </div>
      {!loading && (summary?.my_balances || []).length === 0 && (
        <p className="hr-empty lv2-nobalance">No employee record is linked to your account — no personal balance to show.</p>
      )}

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
                {paginate(filteredRequests, safePage, PAGE_SIZE).map((r) => (
                  <tr key={r.leave_id} className={r.status === "PENDING" ? "lv-pending" : ""}>
                    <td>
                      <div className="hr-cell-user">
                        <EmployeeAvatar personId={r.person_id} size={28} />
                        <div className="hr-name">{r.full_name}</div>
                      </div>
                    </td>
                    <td>{r.leave_type_name || "—"}</td>
                    <td>
                      <span className="lv2-dates"><CalendarDays size={14} />{formatDateRange(r.start_date, r.end_date)}</span>
                    </td>
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
        <Pagination page={safePage} totalItems={filteredRequests.length} onPageChange={setPage} pageSize={PAGE_SIZE} />
      </div>

      {modalOpen && (
        <div className="hr-modal-backdrop" onClick={() => setModalOpen(false)}>
          <form className="hr-modal org-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <button type="button" className="hr-modal-x org-modal-x" onClick={() => setModalOpen(false)} aria-label="Close">
              ✕
            </button>
            <div className="org-modal-head">
              <span className="org-modal-ico"><CalendarPlus size={19} /></span>
              <div>
                <h2>New leave request</h2>
                <p>Requests are for your own employee record.</p>
              </div>
            </div>

            <div className="org-modal-body">
              <label>Leave type</label>
              <select
                value={form.leave_type_id}
                onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}
                required
              >
                <option value="">Select…</option>
                {leaveTypes.map((t) => {
                  const bal = (summary?.my_balances || []).find((x) => x.leave_type_id === t.leave_type_id);
                  return (
                    <option key={t.leave_type_id} value={t.leave_type_id}>
                      {t.leave_type_name}{bal ? ` · ${bal.remaining_days} days left` : ""}
                    </option>
                  );
                })}
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
                    min={form.start_date || undefined}
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              {calendarDays(form.start_date, form.end_date) > 0 && (
                <div className="lv2-total">
                  <span>Total</span>
                  <b>{calendarDays(form.start_date, form.end_date)} calendar {calendarDays(form.start_date, form.end_date) === 1 ? "day" : "days"}</b>
                </div>
              )}

              <label>Reason (optional)</label>
              <textarea
                className="lv-textarea"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                rows={3}
              />

              {formError && <p className="hr-error">{formError}</p>}
            </div>

            <div className="hr-modal-actions org-modal-foot">
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
