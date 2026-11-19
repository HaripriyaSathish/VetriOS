import { useEffect, useMemo, useState } from "react";
import { Plus, Check, X, TrendingUp, Hourglass, CircleX, ListChecks, ArrowRight, CalendarDays, Lock } from "lucide-react";
import client from "../../../api/client";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import Pagination, { paginate } from "../../../components/Pagination";
import "../styles/HRDashboard.css";
import "../styles/Employees.css";
import "../styles/Leave.css";
import "../styles/Promotions.css";

const STATUS_CLASS = {
  PENDING: "half",
  APPROVED: "present",
  REJECTED: "absent",
};

// Two kinds of request share the same table. The kind is derived, not stored:
// a request is a role revision when the person was on an intern designation.
const KINDS = {
  PROMOTION: {
    tab: "Employee promotions",
    draft: "Draft promotion",
    noun: "promotion",
    title: "Promotions",
    subtitle: "Move an employee to a senior or higher designation.",
    empty: "No employee promotions here.",
  },
  ROLE_REVISION: {
    tab: "Role revisions",
    draft: "Draft role revision",
    noun: "role revision",
    title: "Role revisions",
    subtitle: "Move an intern to the full-time role, for example Junior Developer Intern to Junior Developer.",
    empty: "No role revisions here.",
  },
};

const EMPTY_FORM = { employee_id: "", new_designation_id: "", effective_date: "", reason: "" };

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function plusYearISO() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

const isInternDesignation = (d) => {
  const code = (d?.designation_code || "").toUpperCase();
  return code === "INTERN" || code.endsWith("_INTERN");
};

// JUNIOR_DEVELOPER_INTERN -> the active JUNIOR_DEVELOPER designation.
const revisionTarget = (d, designations) => {
  const code = (d?.designation_code || "").toUpperCase();
  if (!code.endsWith("_INTERN")) return null;
  const target = code.slice(0, -"_INTERN".length);
  return designations.find((x) => x.is_active && (x.designation_code || "").toUpperCase() === target) || null;
};

// Promotions screen — HR Administrator drafts a request (always starts
// PENDING); only System Administrator can approve/reject it — approving
// immediately updates the employee's real designation.
//
// Two tabs: Employee promotions (existing employees moving up a level) and
// Role revisions (interns moving to the full-time role). Every dropdown only
// offers valid choices, and the same rules are enforced again on the server.
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
  title = "Promotions",
  subtitle = "Employee promotions and intern role revisions.",
}) {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isSystemAdministrator = (user?.roles || []).includes("System Administrator");
  const canAct = isSystemAdministrator && showActions;

  const [promotions, setPromotions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [designations, setDesignations] = useState([]); // all, incl. inactive (current roles may be old)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kind, setKind] = useState("PROMOTION"); // "PROMOTION" | "ROLE_REVISION"
  const [tab, setTab] = useState("all"); // "all" | "pending" | "approved" | "rejected"
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
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
      .then(({ data }) => setDesignations(data))
      .catch(() => {});
  }, []);

  const designationById = useMemo(() => {
    const map = new Map();
    designations.forEach((d) => map.set(String(d.designation_id), d));
    return map;
  }, [designations]);

  const hasPending = useMemo(() => {
    const ids = new Set();
    promotions.forEach((p) => p.status === "PENDING" && ids.add(String(p.employee_id)));
    return ids;
  }, [promotions]);

  // Who can be picked in the form for the current kind.
  const eligibleEmployees = useMemo(
    () =>
      employees.filter((e) => {
        if (e.status !== "ACTIVE" || !e.designation_id) return false;
        const current = designationById.get(String(e.designation_id));
        if (!current) return false;
        if (kind === "ROLE_REVISION") return isInternDesignation(current) && !!revisionTarget(current, designations);
        return !isInternDesignation(current) && current.level_number != null;
      }),
    [employees, designationById, designations, kind]
  );

  const selectedEmployee = employees.find((e) => String(e.employee_id) === String(form.employee_id));
  const currentDesignation = selectedEmployee ? designationById.get(String(selectedEmployee.designation_id)) : null;

  // Designations the chosen employee can move to.
  const targetOptions = useMemo(() => {
    if (!currentDesignation) return [];
    if (kind === "ROLE_REVISION") {
      const t = revisionTarget(currentDesignation, designations);
      return t ? [t] : [];
    }
    return designations
      .filter((d) => d.is_active && !isInternDesignation(d) && d.level_number != null && d.level_number > currentDesignation.level_number)
      .sort((a, b) => a.level_number - b.level_number || a.designation_name.localeCompare(b.designation_name));
  }, [currentDesignation, designations, kind]);

  const newDesignationName = designationById.get(String(form.new_designation_id))?.designation_name;

  const openNewPromotion = () => {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormError("");
    setModalOpen(true);
  };

  const changeEmployee = (employeeId) => {
    const emp = employees.find((e) => String(e.employee_id) === String(employeeId));
    const current = emp ? designationById.get(String(emp.designation_id)) : null;
    // A role revision has exactly one valid target, so it fills itself in.
    const auto = kind === "ROLE_REVISION" && current ? revisionTarget(current, designations) : null;
    setForm({ ...form, employee_id: employeeId, new_designation_id: auto ? String(auto.designation_id) : "" });
    setFieldErrors({ ...fieldErrors, employee_id: undefined, new_designation_id: undefined });
  };

  const validate = () => {
    const errs = {};
    if (!form.employee_id) errs.employee_id = kind === "ROLE_REVISION" ? "Select an intern." : "Select an employee.";
    else if (hasPending.has(String(form.employee_id))) errs.employee_id = "This employee already has a pending request.";
    if (!form.new_designation_id) errs.new_designation_id = kind === "ROLE_REVISION" ? "No matching role found." : "Select the new designation.";
    if (!form.effective_date) errs.effective_date = "Pick an effective date.";
    else if (selectedEmployee?.joining_date && form.effective_date < selectedEmployee.joining_date)
      errs.effective_date = `Date can't be before the joining date (${formatDate(selectedEmployee.joining_date)}).`;
    else if (form.effective_date > plusYearISO()) errs.effective_date = "Date can't be more than a year ahead.";
    return errs;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errs = validate();
    setFieldErrors(errs);
    setFormError("");
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      await client.post("/api/hr/promotions/", { ...form, kind });
      setModalOpen(false);
      await loadPromotions();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object" && !data.detail) {
        const mapped = {};
        Object.entries(data).forEach(([k, v]) => {
          mapped[k] = Array.isArray(v) ? v[0] : String(v);
        });
        setFieldErrors(mapped);
        if (!Object.keys(mapped).some((k) => ["employee_id", "new_designation_id", "effective_date"].includes(k)))
          setFormError(Object.values(mapped)[0] || "Something went wrong.");
      } else {
        setFormError(data?.detail || "Something went wrong.");
      }
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

  const ofKind = useMemo(() => promotions.filter((p) => (p.kind || "PROMOTION") === kind), [promotions, kind]);
  const kindCounts = useMemo(
    () => ({
      PROMOTION: promotions.filter((p) => (p.kind || "PROMOTION") === "PROMOTION").length,
      ROLE_REVISION: promotions.filter((p) => p.kind === "ROLE_REVISION").length,
    }),
    [promotions]
  );

  const counts = useMemo(
    () => ({
      all: ofKind.length,
      pending: ofKind.filter((p) => p.status === "PENDING").length,
      approved: ofKind.filter((p) => p.status === "APPROVED").length,
      rejected: ofKind.filter((p) => p.status === "REJECTED").length,
    }),
    [ofKind]
  );

  const filtered = useMemo(() => {
    if (tab === "pending") return ofKind.filter((p) => p.status === "PENDING");
    if (tab === "approved") return ofKind.filter((p) => p.status === "APPROVED");
    if (tab === "rejected") return ofKind.filter((p) => p.status === "REJECTED");
    return ofKind;
  }, [ofKind, tab]);

  useEffect(() => setPage(1), [tab, kind]);

  const currentYear = new Date().getFullYear();
  const [statsYear, setStatsYear] = useState(currentYear);
  const statsYearOptions = useMemo(() => {
    const years = new Set([currentYear]);
    ofKind.forEach((p) => years.add(new Date(p.effective_date).getFullYear()));
    return [...years].sort((a, b) => b - a);
  }, [ofKind, currentYear]);

  const inStatsYear = (p, status) => p.status === status && new Date(p.effective_date).getFullYear() === statsYear;
  const k = KINDS[kind];
  const statCards = [
    { label: `Approved · ${statsYear}`, value: ofKind.filter((p) => inStatsYear(p, "APPROVED")).length, tone: "green", Icon: TrendingUp },
    { label: "Awaiting approval", value: counts.pending, tone: "amber", Icon: Hourglass },
    { label: `Rejected · ${statsYear}`, value: ofKind.filter((p) => inStatsYear(p, "REJECTED")).length, tone: "red", Icon: CircleX },
    { label: "Total requests", value: counts.all, tone: "blue", Icon: ListChecks },
  ];

  return (
    <div className="att-screen lv-v2">
      <div className="att-head">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {showDraftButton && (
          <button type="button" className="att-btn-accent" onClick={openNewPromotion}>
            <Plus size={15} /> {k.draft}
          </button>
        )}
      </div>

      <div className="pr3-kinds" role="tablist">
        {Object.entries(KINDS).map(([key, v]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={kind === key}
            className={"pr3-kind" + (kind === key ? " active" : "")}
            onClick={() => {
              setKind(key);
              setTab("all");
            }}
          >
            {v.tab} <span>{kindCounts[key]}</span>
          </button>
        ))}
      </div>
      <p className="pr3-kind-help">{k.subtitle}</p>

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

      <div className="emp-mini-row org-stats">
        {statCards.map(({ label, value, tone, Icon }) => (
          <div key={label} className={`emp-mini tone-${tone}`}>
            <span className="emp-mini-icon"><Icon size={15} /></span>
            <span className="emp-mini-text">
              <b>{loading ? "-" : value}</b>
              <span>{label}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="att-panel">
        <div className="att-panel-head">
          <div>
            <h3>{kind === "ROLE_REVISION" ? "Role revision requests" : "Promotion requests"}</h3>
            <p>
              {canAct
                ? "Review and decide on pending requests."
                : "HR Administrator requests are approved by System Administrator."}
            </p>
          </div>
          <div className="lv-tabs">
            {[
              ["all", "All"],
              ["pending", "Pending"],
              ["approved", "Approved"],
              ["rejected", "Rejected"],
            ].map(([key, label]) => (
              <button key={key} type="button" className={"lv-tab" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>
                {label} {counts[key]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="hr-empty">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="hr-empty">{k.empty}</p>
        ) : (
          <>
            <div className="hr-table-scroll">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>{kind === "ROLE_REVISION" ? "Role revision" : "Promotion"}</th>
                    <th>Effective date</th>
                    <th>Status</th>
                    <th>Decided by</th>
                    {canAct && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginate(filtered, page, 8).map((p) => (
                    <tr key={p.promotion_id} className={p.status === "PENDING" ? "lv-pending" : ""}>
                      <td>
                        <div className="hr-cell-user">
                          <EmployeeAvatar personId={p.person_id} size={28} />
                          <div className="hr-name">{p.full_name}</div>
                        </div>
                      </td>
                      <td>
                        <span className="pr2-move">
                          <span>{p.previous_designation_name || "—"}</span>
                          <ArrowRight size={14} />
                          <b>{p.new_designation_name}</b>
                        </span>
                      </td>
                      <td>
                        <span className="lv2-dates"><CalendarDays size={14} />{formatDate(p.effective_date)}</span>
                      </td>
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
          <form className="hr-modal org-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} noValidate>
            <button type="button" className="hr-modal-x org-modal-x" onClick={() => setModalOpen(false)} aria-label="Close">
              ✕
            </button>
            <div className="org-modal-head">
              <span className="org-modal-ico"><TrendingUp size={19} /></span>
              <div>
                <h2>{k.draft}</h2>
                <p>Sent as a pending request for System Administrator to approve.</p>
              </div>
            </div>

            <div className="org-modal-body">
              <label>{kind === "ROLE_REVISION" ? "Intern" : "Employee"}</label>
              <select
                className={fieldErrors.employee_id ? "pr3-invalid" : ""}
                value={form.employee_id}
                onChange={(e) => changeEmployee(e.target.value)}
              >
                <option value="">
                  {eligibleEmployees.length === 0
                    ? kind === "ROLE_REVISION"
                      ? "No interns to revise"
                      : "No eligible employees"
                    : "Select…"}
                </option>
                {eligibleEmployees.map((e) => (
                  <option key={e.employee_id} value={e.employee_id} disabled={hasPending.has(String(e.employee_id))}>
                    {e.full_name} {e.employee_code ? `(${e.employee_code})` : ""} · {e.designation_name}
                    {hasPending.has(String(e.employee_id)) ? " — request pending" : ""}
                  </option>
                ))}
              </select>
              {fieldErrors.employee_id ? (
                <p className="pr3-err">{fieldErrors.employee_id}</p>
              ) : (
                <p className="pr3-hint">
                  {kind === "ROLE_REVISION"
                    ? "Only active people on an intern designation."
                    : "Only active employees. Interns go through Role revision."}
                </p>
              )}

              <label>{kind === "ROLE_REVISION" ? "New role" : "New designation"}</label>
              {kind === "ROLE_REVISION" ? (
                <div className={"pr3-locked" + (fieldErrors.new_designation_id ? " pr3-invalid" : "")}>
                  <Lock size={13} />
                  {newDesignationName || (selectedEmployee ? "No matching role found" : "Pick an intern first")}
                </div>
              ) : (
                <select
                  className={fieldErrors.new_designation_id ? "pr3-invalid" : ""}
                  value={form.new_designation_id}
                  disabled={!selectedEmployee}
                  onChange={(e) => {
                    setForm({ ...form, new_designation_id: e.target.value });
                    setFieldErrors({ ...fieldErrors, new_designation_id: undefined });
                  }}
                >
                  <option value="">
                    {!selectedEmployee ? "Select an employee first" : targetOptions.length ? "Select…" : "No higher designation available"}
                  </option>
                  {targetOptions.map((d) => (
                    <option key={d.designation_id} value={d.designation_id}>
                      {d.designation_name}
                    </option>
                  ))}
                </select>
              )}
              {fieldErrors.new_designation_id ? (
                <p className="pr3-err">{fieldErrors.new_designation_id}</p>
              ) : (
                <p className="pr3-hint">
                  {kind === "ROLE_REVISION"
                    ? "Set automatically from the intern role."
                    : "Only designations above the employee's current level."}
                </p>
              )}

              {selectedEmployee && (
                <div className="pr2-preview">
                  <span>{selectedEmployee.designation_name || "Not assigned"}</span>
                  <ArrowRight size={15} />
                  <b>{newDesignationName || "Select a designation"}</b>
                </div>
              )}

              <label>Effective date</label>
              <input
                type="date"
                className={fieldErrors.effective_date ? "pr3-invalid" : ""}
                value={form.effective_date}
                min={selectedEmployee?.joining_date || undefined}
                max={plusYearISO()}
                onChange={(e) => {
                  setForm({ ...form, effective_date: e.target.value });
                  setFieldErrors({ ...fieldErrors, effective_date: undefined });
                }}
              />
              {fieldErrors.effective_date && <p className="pr3-err">{fieldErrors.effective_date}</p>}

              <label>Reason (optional)</label>
              <textarea
                className="lv-textarea"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder={kind === "ROLE_REVISION" ? "Why is this role being revised?" : "Why is this promotion happening?"}
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
              {confirmTarget.action === "approve" ? "Approve" : "Reject"} {confirmTarget.promotion.full_name}'s{" "}
              {confirmTarget.promotion.kind === "ROLE_REVISION" ? "role revision" : "promotion"}?
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
