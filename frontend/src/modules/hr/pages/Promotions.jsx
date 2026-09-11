import { useEffect, useMemo, useState } from "react";
import { Plus, Check, X } from "lucide-react";
import client from "../../../api/client";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import Pagination, { paginate } from "../../../components/Pagination";
import "../styles/HRDashboard.css";
import "../styles/Leave.css";

const STATUS_CLASS = {
  PENDING: "half",
  APPROVED: "present",
  REJECTED: "absent",
};

const EMPTY_FORM = { employee_id: "", new_designation_id: "", effective_date: "", reason: "" };

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Promotions screen — existing employees moving to a senior/higher
// designation. HR Administrator submits a request (always starts
// PENDING); only System Administrator can approve/reject it — approving
// immediately updates the employee's real designation.
//
// Approve/Reject is gated by VIEW, not just role: this component is
// mounted twice — read-only on HR's own Promotions page (so HR can
// always track status of what they drafted, but never acts on it from
// there, even if a System Administrator happens to open that page),
// and actionable on the System Administrator's own Promotion Approvals
// page (see PromotionApprovals.jsx). showDraftButton follows the same
// idea: drafting only ever happens from the HR side.
function Promotions({
  showActions = true,
  showDraftButton = true,
  eyebrow = "HR",
  title = "Promotions",
  subtitle = "Move an employee to a senior or higher designation.",
}) {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isSystemAdministrator = (user?.roles || []).includes("System Administrator");
  const canAct = isSystemAdministrator && showActions;

  const [promotions, setPromotions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all"); // "all" | "pending" | "approved" | "rejected"
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [actionError, setActionError] = useState("");
  // { promotion, action: "approve" | "reject" } — null when no confirm modal is open.
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const loadPromotions = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get("/api/hr/promotions/");
      setPromotions(data);
    } catch (err) {
      setError("Couldn't load promotions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPromotions();
    client
      .get("/api/hr/employees/")
      .then(({ data }) => setEmployees(data))
      .catch(() => {});
    client
      .get("/api/hr/designations/")
      .then(({ data }) => setDesignations(data.filter((d) => d.is_active)))
      .catch(() => {});
  }, []);

  const selectedEmployee = employees.find((e) => String(e.employee_id) === String(form.employee_id));

  const openNewPromotion = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await client.post("/api/hr/promotions/", form);
      setModalOpen(false);
      await loadPromotions();
    } catch (err) {
      const data = err.response?.data;
      const firstError = data && Object.values(data)[0];
      setFormError(Array.isArray(firstError) ? firstError[0] : data?.detail || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const openConfirm = (promotion, action) => {
    setConfirmTarget({ promotion, action });
    setActionError("");
  };

  const closeConfirm = () => setConfirmTarget(null);

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    const { promotion, action } = confirmTarget;
    setConfirming(true);
    setActionError("");
    try {
      await client.post(`/api/hr/promotions/${promotion.promotion_id}/${action}/`);
      setConfirmTarget(null);
      await loadPromotions();
    } catch (err) {
      const data = err.response?.data;
      setActionError(data?.detail || `Couldn't ${action} that request.`);
    } finally {
      setConfirming(false);
    }
  };

  const counts = useMemo(
    () => ({
      all: promotions.length,
      pending: promotions.filter((p) => p.status === "PENDING").length,
      approved: promotions.filter((p) => p.status === "APPROVED").length,
      rejected: promotions.filter((p) => p.status === "REJECTED").length,
    }),
    [promotions]
  );

  const filtered = useMemo(() => {
    if (tab === "pending") return promotions.filter((p) => p.status === "PENDING");
    if (tab === "approved") return promotions.filter((p) => p.status === "APPROVED");
    if (tab === "rejected") return promotions.filter((p) => p.status === "REJECTED");
    return promotions;
  }, [promotions, tab]);

  useEffect(() => setPage(1), [tab]);

  const currentYear = new Date().getFullYear();
  const [statsYear, setStatsYear] = useState(currentYear);
  const statsYearOptions = useMemo(() => {
    const years = new Set([currentYear]);
    promotions.forEach((p) => years.add(new Date(p.effective_date).getFullYear()));
    return [...years].sort((a, b) => b - a);
  }, [promotions, currentYear]);

  const promotionsInStatsYear = promotions.filter(
    (p) => p.status === "APPROVED" && new Date(p.effective_date).getFullYear() === statsYear
  ).length;

  return (
    <div className="att-screen">
      <div className="att-head">
        <div>
          <span className="att-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {showDraftButton && (
          <button type="button" className="att-btn-accent" onClick={openNewPromotion}>
            <Plus size={15} /> Draft Promotion
          </button>
        )}
      </div>

      {error && <p className="att-error">{error}</p>}
      {actionError && <p className="att-error">{actionError}</p>}

      <div className="hr-stats-head">
        <label>Stats for</label>
        <select value={statsYear} onChange={(e) => setStatsYear(Number(e.target.value))}>
          {statsYearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="att-stats" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <div className="att-stat-card">
          <span className="att-stat-label">Promotions</span>
          <span className="att-stat-value">{promotionsInStatsYear}</span>
          <span className="att-stat-sub">Approved · {statsYear}</span>
        </div>
        <div className="att-stat-card">
          <span className="att-stat-label">Awaiting approval</span>
          <span className="att-stat-value">{counts.pending}</span>
          <span className="att-stat-sub">Pending requests (all time)</span>
        </div>
      </div>

      <div className="att-panel">
        <div className="att-panel-head">
          <div>
            <h3>Promotion requests</h3>
            <p>
              {canAct
                ? "Review and decide on pending requests."
                : "HR Administrator requests are approved by System Administrator."}
            </p>
          </div>
          <div className="lv-tabs">
            <button type="button" className={"lv-tab" + (tab === "all" ? " active" : "")} onClick={() => setTab("all")}>
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
            <button
              type="button"
              className={"lv-tab" + (tab === "rejected" ? " active" : "")}
              onClick={() => setTab("rejected")}
            >
              Rejected {counts.rejected}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="hr-empty">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="hr-empty">No promotion requests here.</p>
        ) : (
          <>
            <div className="hr-table-scroll">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Effective date</th>
                    <th>Status</th>
                    <th>Decided by</th>
                    {canAct && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginate(filtered, page, 8).map((p) => (
                    <tr key={p.promotion_id}>
                      <td>
                        <div className="hr-cell-user">
                          <EmployeeAvatar personId={p.person_id} size={28} />
                          <div className="hr-name">{p.full_name}</div>
                        </div>
                      </td>
                      <td>{p.previous_designation_name || "—"}</td>
                      <td>{p.new_designation_name}</td>
                      <td className="hr-mono">{formatDate(p.effective_date)}</td>
                      <td>
                        <span className={"att-pill " + (STATUS_CLASS[p.status] || "absent")}>
                          {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td>{p.approved_by_name || "—"}</td>
                      {canAct && (
                        <td>
                          {p.status === "PENDING" ? (
                            <div className="hr-row-actions">
                              <button
                                type="button"
                                className="lv-action-btn lv-action-approve"
                                title="Approve"
                                onClick={() => openConfirm(p, "approve")}
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button
                                type="button"
                                className="lv-action-btn lv-action-reject"
                                title="Reject"
                                onClick={() => openConfirm(p, "reject")}
                              >
                                <X size={14} /> Reject
                              </button>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalItems={filtered.length} onPageChange={setPage} pageSize={8} />
          </>
        )}
      </div>

      {modalOpen && (
        <div className="hr-modal-backdrop" onClick={() => setModalOpen(false)}>
          <form className="hr-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <button type="button" className="hr-modal-x" onClick={() => setModalOpen(false)} aria-label="Close">
              ✕
            </button>
            <h2>New promotion</h2>
            <p className="hr-hint">Submitted as a pending request for System Administrator to approve.</p>

            <label>Employee</label>
            <select
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              required
            >
              <option value="">Select…</option>
              {employees.map((e) => (
                <option key={e.employee_id} value={e.employee_id}>
                  {e.full_name} {e.employee_code ? `(${e.employee_code})` : ""}
                </option>
              ))}
            </select>
            {selectedEmployee && (
              <p className="hr-hint">Current designation: {selectedEmployee.designation_name || "Not assigned"}</p>
            )}

            <label>New designation</label>
            <select
              value={form.new_designation_id}
              onChange={(e) => setForm({ ...form, new_designation_id: e.target.value })}
              required
            >
              <option value="">Select…</option>
              {designations.map((d) => (
                <option key={d.designation_id} value={d.designation_id}>
                  {d.designation_name}
                </option>
              ))}
            </select>

            <label>Effective date</label>
            <input
              type="date"
              value={form.effective_date}
              onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
              required
            />

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
              {confirmTarget.action === "approve" ? "Approve" : "Reject"} {confirmTarget.promotion.full_name}'s
              promotion?
            </h2>
            <p>
              {confirmTarget.promotion.previous_designation_name || "—"} → {confirmTarget.promotion.new_designation_name}{" "}
              · Effective {formatDate(confirmTarget.promotion.effective_date)}
            </p>

            {actionError && <p className="hr-error">{actionError}</p>}

            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={closeConfirm}>
                Cancel
              </button>
              <button
                type="button"
                className={confirmTarget.action === "reject" ? "hr-btn-sm hr-btn-danger" : "hr-btn-accent"}
                onClick={handleConfirm}
                disabled={confirming}
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

export default Promotions;
