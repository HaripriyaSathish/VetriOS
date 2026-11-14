import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Check, X, Sun, Palmtree, HeartPulse, Baby, CalendarDays, Hourglass } from "lucide-react";
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

function formatDateRange(start, end) {
  const opts = { day: "numeric", month: "short", year: "numeric" };
  const s = new Date(start).toLocaleDateString(undefined, opts);
  if (start === end) return s;
  const e = new Date(end).toLocaleDateString(undefined, opts);
  return `${s} – ${e}`;
}

// Leave-menu request kinds: what to show in the Type and Length columns.
function typeText(r) {
  if (r.request_kind === "PERMISSION") return `Hourly permission · ${r.from_time}–${r.to_time}`;
  if (r.request_kind === "ON_DUTY") return `On duty · ${r.on_duty_reason || ""}`;
  if (r.request_kind === "WFH") return "Work from home";
  return r.leave_type_name || "—";
}
function lengthText(r) {
  if (r.request_kind === "PERMISSION" && r.from_time && r.to_time) {
    const [h1, m1] = r.from_time.split(":").map(Number);
    const [h2, m2] = r.to_time.split(":").map(Number);
    return `${Math.round(((h2 * 60 + m2 - (h1 * 60 + m1)) / 60) * 100) / 100} h`;
  }
  return `${r.total_days} ${r.total_days === 1 ? "day" : "days"}`;
}
// A request sent to a specific approver is decided by that person (or any
// System Administrator); older requests with no approver by any HR admin.
function canDecide(r) {
  const me = JSON.parse(localStorage.getItem("user") || "null");
  const roles = me?.roles || [];
  if (roles.includes("System Administrator")) return true;
  if (r.approver_user_id) return r.approver_user_id === me?.user_id;
  return roles.includes("HR Administrator");
}

// Leave management screen — balances for the logged-in user (auto-
// allocated company-wide: 12 CL / 6 SL / 15 Earned / 182 Maternity),
// org-wide pending/upcoming stats, and the request list with
// approve/reject actions on pending rows.
function Leave() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTabState] = useState("all"); // "all" | "pending" | "approved"
  const [page, setPage] = useState(1);
  const setTab = (t) => {
    setTabState(t);
    setPage(1);
  };

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
      const { data } = await client.get("/api/hr/leave/summary/");
      setSummary(data);
    } catch {
      setError("Couldn't load leave data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // New requests (leave, hourly permission, work from home, on duty) are made on
  // the full New request page; it brings you back here afterwards.
  const openNewRequest = () => navigate("/my/leave/new", { state: { from: "/hr/leave" } });

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
          <p>Review balances and leave requests.</p>
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
        <div className="lv2-row lv2-row-1">
        <div className="lv2-stat lv2-tone-blue">
          <div className="lv2-balance-top">
            <span className="lv2-icon"><Hourglass size={18} /></span>
            <b>{summary?.stats.pending_approvals ?? "—"}</b>
          </div>
          <span className="lv2-stat-label">Pending approvals</span>
          <span className="lv2-stat-sub">Need your review</span>
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
                    <td>
                      {typeText(r)}
                      {r.approver_name && <div className="hr-sub">To {r.approver_name} · {r.approver_category}</div>}
                    </td>
                    <td>
                      <span className="lv2-dates"><CalendarDays size={14} />{formatDateRange(r.start_date, r.end_date)}</span>
                    </td>
                    <td className="hr-mono">{lengthText(r)}</td>
                    <td>
                      <span className={"att-pill " + (STATUS_CLASS[r.status] || "absent")}>
                        {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td>
                      {r.status === "PENDING" && canDecide(r) ? (
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
                      ) : r.status === "PENDING" ? (
                        <span className="hr-sub">Sent to {r.approver_name || "another approver"}</span>
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
