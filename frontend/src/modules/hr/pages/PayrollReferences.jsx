import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, SquarePen, Ban, RotateCcw, ExternalLink, Link2Off, Users, CheckCircle2, Clock, Link2, Lock, CalendarDays, Info } from "lucide-react";
import client from "../../../api/client";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import Pagination, { paginate } from "../../../components/Pagination";
import "../styles/HRDashboard.css";
import "../styles/Employees.css";

const STATUS_LABEL = { ACTIVE: "Active", EXPIRED: "Expired", INACTIVE: "Inactive" };
const STATUS_CLASS = { ACTIVE: "on", EXPIRED: "warn", INACTIVE: "off" };

const PROVIDERS = ["Gusto", "Deel", "ADP"];

const EMPTY_FORM = {
  employee_id: "",
  payroll_provider: "Gusto",
  external_employee_id: "",
  external_reference: "",
  effective_from: "",
  effective_to: "",
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Payroll References — mapping an employee to their record in an
// external payroll provider (Gusto, Deel, ADP). No live integration yet:
// the Destination column is informational only, not a real link.
function PayrollReferences() {
  const [references, setReferences] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRef, setEditingRef] = useState(null); // null = creating
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [origForm, setOrigForm] = useState(null); // loaded values while editing, to show what changed

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);

  // Searchable employee picker for the form — a plain <select> gets
  // unusable once there are a lot of employees.
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const employeePickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (employeePickerRef.current && !employeePickerRef.current.contains(event.target)) {
        setEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredEmployeeOptions = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.full_name, e.employee_code].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    );
  }, [employees, employeeQuery]);

  const selectEmployee = (employee) => {
    setForm({ ...form, employee_id: employee.employee_id });
    setEmployeeQuery(`${employee.full_name}${employee.employee_code ? ` (${employee.employee_code})` : ""}`);
    setEmployeeDropdownOpen(false);
  };

  const loadReferences = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get("/api/hr/payroll-references/");
      setReferences(data);
    } catch (err) {
      setError("Couldn't load payroll references.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferences();
    client
      .get("/api/hr/employees/")
      .then(({ data }) => setEmployees(data))
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditingRef(null);
    setOrigForm(null);
    setForm(EMPTY_FORM);
    setEmployeeQuery("");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (ref) => {
    setEditingRef(ref);
    const loaded = {
      employee_id: ref.employee_id,
      payroll_provider: ref.payroll_provider,
      external_employee_id: ref.external_employee_id,
      external_reference: ref.external_reference || "",
      effective_from: ref.effective_from,
      effective_to: ref.effective_to || "",
    };
    setForm(loaded);
    setOrigForm(loaded);
    setEmployeeQuery(`${ref.full_name}${ref.employee_code ? ` (${ref.employee_code})` : ""}`);
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!editingRef && !form.employee_id) {
      setFormError("Pick an employee from the list.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    const payload = { ...form, effective_to: form.effective_to || null };
    try {
      if (editingRef) {
        await client.patch(`/api/hr/payroll-references/${editingRef.payroll_reference_id}/`, payload);
      } else {
        await client.post("/api/hr/payroll-references/", payload);
      }
      setModalOpen(false);
      await loadReferences();
    } catch (err) {
      const data = err.response?.data;
      const firstError = data && Object.values(data)[0];
      setFormError(Array.isArray(firstError) ? firstError[0] : data?.detail || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const requestToggle = (ref) => setConfirmTarget(ref);
  const closeConfirm = () => setConfirmTarget(null);

  const confirmToggle = async () => {
    const ref = confirmTarget;
    setConfirming(true);
    try {
      if (ref.status === "INACTIVE") {
        await client.patch(`/api/hr/payroll-references/${ref.payroll_reference_id}/`, { status: "ACTIVE" });
      } else {
        await client.delete(`/api/hr/payroll-references/${ref.payroll_reference_id}/`);
      }
      setConfirmTarget(null);
      await loadReferences();
    } catch (err) {
      // surfaced inline via the empty state / reload if it fails silently
    } finally {
      setConfirming(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return references;
    return references.filter((r) =>
      [r.full_name, r.payroll_provider, r.external_employee_id, r.employee_code]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [references, search]);

  const employeeCount = new Set(references.map((r) => r.employee_id)).size;
  const providerCount = new Set(references.map((r) => r.payroll_provider)).size;
  const activeCount = references.filter((r) => r.status === "ACTIVE").length;
  const expiredCount = references.filter((r) => r.status === "EXPIRED").length;
  const inactiveCount = references.filter((r) => r.status === "INACTIVE").length;

  const requiredDone = [
    editingRef ? editingRef.employee_id : form.employee_id,
    form.payroll_provider,
    form.external_employee_id.trim(),
    form.effective_from,
  ].filter(Boolean).length;
  const isChanged = (k) => !!editingRef && !!origForm && String(form[k] ?? "") !== String(origForm[k] ?? "");
  const chg = (k) => (isChanged(k) ? "emp-changed" : "");
  const was = (k) => {
    if (!isChanged(k)) return null;
    const v = origForm[k];
    const shown = v === "" || v == null ? "empty" : k === "effective_from" || k === "effective_to" ? formatDate(v) : v;
    return <span className="emp-form-was">Was {shown}</span>;
  };
  const changeCount = editingRef && origForm ? Object.keys(origForm).filter(isChanged).length : 0;
  const summaryEmployee = editingRef
    ? { name: editingRef.full_name }
    : employees.find((e) => String(e.employee_id) === String(form.employee_id));

  return (
    <div className="hr-screen">
      <div className="hr-head">
        <div>
          <h1>Reference mapping</h1>
          <p>
            {employeeCount} {employeeCount === 1 ? "employee" : "employees"} mapped across {providerCount}{" "}
            {providerCount === 1 ? "provider" : "providers"}
          </p>
        </div>
        <button type="button" className="hr-btn-accent emp-new-btn" onClick={openCreate}>
          <Plus size={15} /> New reference
        </button>
      </div>

      {error && <p className="hr-error">{error}</p>}

      <div className="emp-mini-row org-stats">
        {[
          { label: "Total references", value: references.length, tone: "blue", Icon: Users },
          { label: "Active", value: activeCount, tone: "green", Icon: CheckCircle2 },
          { label: "Expired", value: expiredCount, tone: "amber", Icon: Clock },
          { label: "Inactive", value: inactiveCount, tone: "red", Icon: Ban },
        ].map(({ label, value, tone, Icon }) => (
          <div key={label} className={`emp-mini tone-${tone}`}>
            <span className="emp-mini-icon"><Icon size={15} /></span>
            <span className="emp-mini-text">
              <b>{loading ? "-" : value}</b>
              <span>{label}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="hr-panel">
        <div className="hr-toolbar">
          <div className="hr-search">
            <Search size={15} />
            <input
              placeholder="Search employee, provider, external ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {loading ? (
          <p className="hr-empty">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="hr-empty">
            {references.length === 0 ? "No payroll references yet — add the first one." : `No references match "${search}".`}
          </p>
        ) : (
          <>
            <div className="hr-table-scroll">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Provider</th>
                    <th>External ID</th>
                    <th>Status</th>
                    <th>Destination</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(filtered, page, 8).map((r) => (
                    <tr key={r.payroll_reference_id}>
                      <td>
                        <div className="hr-cell-user">
                          <EmployeeAvatar personId={r.person_id} size={28} />
                          <div className="hr-name">{r.full_name}</div>
                        </div>
                      </td>
                      <td>{r.payroll_provider}</td>
                      <td>
                        <span className="hr-badge">{r.external_employee_id}</span>
                      </td>
                      <td>
                        <span className={"hr-pill " + (STATUS_CLASS[r.status] || "off")}>
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      </td>
                      <td>
                        {r.status === "EXPIRED" || !r.external_reference ? (
                          <span className="pr-destination pr-destination-muted">
                            <Link2Off size={13} /> Link missing
                          </span>
                        ) : (
                          <span
                            className="pr-destination"
                            title="Informational only — no live provider integration yet"
                          >
                            Open in {r.payroll_provider} <ExternalLink size={12} />
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="hr-row-actions">
                          <button
                            type="button"
                            className="hr-icon-btn"
                            title="Edit"
                            aria-label={`Edit ${r.full_name}'s ${r.payroll_provider} reference`}
                            onClick={() => openEdit(r)}
                          >
                            <SquarePen size={15} />
                          </button>
                          <button
                            type="button"
                            className={"hr-icon-btn" + (r.status !== "INACTIVE" ? " danger" : "")}
                            title={r.status === "INACTIVE" ? "Reactivate" : "Deactivate"}
                            aria-label={(r.status === "INACTIVE" ? "Reactivate " : "Deactivate ") + r.full_name}
                            onClick={() => requestToggle(r)}
                          >
                            {r.status === "INACTIVE" ? <RotateCcw size={15} /> : <Ban size={15} />}
                          </button>
                        </div>
                      </td>
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
        <div className="hr-modal-backdrop" onClick={closeModal}>
          <form className="hr-modal org-modal prf-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <button type="button" className="hr-modal-x org-modal-x" onClick={closeModal} aria-label="Close">
              ✕
            </button>
            <div className="org-modal-head">
              <span className="org-modal-ico"><Link2 size={19} /></span>
              <div>
                <h2>{editingRef ? "Edit payroll reference" : "New payroll reference"}</h2>
                <p>
                  {editingRef
                    ? `Updating ${editingRef.full_name} · ${editingRef.payroll_provider}`
                    : "Map an employee to their record in a payroll provider."}
                </p>
              </div>
            </div>
            {!editingRef && (
              <div className="prf-bar" aria-hidden="true">
                <i style={{ width: `${(requiredDone / 4) * 100}%` }} />
              </div>
            )}

            <div className="prf-body">
              <section className="prf-sec">
                <h3><span className="prf-step">1</span>Employee</h3>
                <label>Employee</label>
                {editingRef ? (
                  <div className="prf-locked">
                    <input type="text" value={employeeQuery} disabled />
                    <Lock size={15} />
                  </div>
                ) : (
                  <div className="pr-employee-picker" ref={employeePickerRef}>
                    <input
                      type="text"
                      value={employeeQuery}
                      onChange={(e) => {
                        setEmployeeQuery(e.target.value);
                        setForm({ ...form, employee_id: "" });
                        setEmployeeDropdownOpen(true);
                      }}
                      onFocus={() => setEmployeeDropdownOpen(true)}
                      placeholder="Search employee by name or code…"
                      autoComplete="off"
                      required
                    />
                    {employeeDropdownOpen && (
                      <div className="pr-employee-dropdown">
                        {filteredEmployeeOptions.length === 0 ? (
                          <div className="pr-employee-empty">No employees match.</div>
                        ) : (
                          filteredEmployeeOptions.map((e) => (
                            <button
                              type="button"
                              key={e.employee_id}
                              className="pr-employee-option"
                              onClick={() => selectEmployee(e)}
                            >
                              {e.full_name} {e.employee_code ? `(${e.employee_code})` : ""}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="prf-sec">
                <h3><span className="prf-step">2</span>Provider details</h3>
                <div className="hr-form-row">
                  <div className={chg("payroll_provider")}>
                    <label>Provider</label>
                    <select
                      value={form.payroll_provider}
                      onChange={(e) => setForm({ ...form, payroll_provider: e.target.value })}
                      required
                    >
                      {PROVIDERS.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    {was("payroll_provider")}
                  </div>
                  <div className={chg("external_employee_id")}>
                    <label>External employee ID</label>
                    <input
                      type="text"
                      value={form.external_employee_id}
                      onChange={(e) => setForm({ ...form, external_employee_id: e.target.value })}
                      placeholder="e.g. GST-8834"
                      required
                    />
                    {was("external_employee_id")}
                  </div>
                </div>
                <div className={chg("external_reference")}>
                  <label>External reference (optional)</label>
                  <input
                    type="text"
                    value={form.external_reference}
                    onChange={(e) => setForm({ ...form, external_reference: e.target.value })}
                    placeholder="Link or note from the provider"
                  />
                  {was("external_reference")}
                </div>
              </section>

              <section className="prf-sec">
                <h3><span className="prf-step">3</span>Validity</h3>
                <div className="hr-form-row">
                  <div className={chg("effective_from")}>
                    <label>Effective from</label>
                    <input
                      type="date"
                      value={form.effective_from}
                      onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                      required
                    />
                    {was("effective_from")}
                  </div>
                  <div className={chg("effective_to")}>
                    <label>Effective to (optional)</label>
                    <input
                      type="date"
                      min={form.effective_from || undefined}
                      value={form.effective_to}
                      onChange={(e) => setForm({ ...form, effective_to: e.target.value })}
                    />
                    {was("effective_to")}
                  </div>
                </div>
                <p className="prf-hint"><Info size={14} /> Leave “Effective to” empty to keep it active until you end it.</p>
              </section>

              {summaryEmployee && (
                <div className="prf-summary">
                  <CalendarDays size={18} />
                  <div>
                    <b>
                      {summaryEmployee.full_name || summaryEmployee.name} → {form.payroll_provider}
                      {form.external_employee_id.trim() ? ` · ${form.external_employee_id.trim()}` : ""}
                    </b>
                    <span>
                      {form.effective_from ? `From ${formatDate(form.effective_from)}` : "Pick a start date"} ·{" "}
                      {form.effective_to ? `until ${formatDate(form.effective_to)}` : "open-ended"}
                    </span>
                  </div>
                </div>
              )}

              {formError && <p className="hr-error">{formError}</p>}
            </div>

            <div className="hr-modal-actions org-modal-foot prf-foot">
              {editingRef ? (
                <span className="emp-form-changes">{changeCount === 0 ? "No changes yet" : `${changeCount} ${changeCount === 1 ? "change" : "changes"}`}</span>
              ) : (
                <span className="prf-count">{requiredDone} of 4 required fields done</span>
              )}
              <button type="button" className="hr-btn-sm" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="hr-btn-accent" disabled={submitting}>
                {submitting ? "Saving…" : editingRef ? "Save changes" : "Add reference"}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmTarget && (
        <div className="hr-modal-backdrop" onClick={closeConfirm}>
          <div className="hr-modal hr-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>{confirmTarget.status === "INACTIVE" ? "Reactivate reference?" : "Deactivate reference?"}</h2>
            <p>
              {confirmTarget.status === "INACTIVE"
                ? `${confirmTarget.full_name}'s ${confirmTarget.payroll_provider} reference will be marked active again.`
                : `${confirmTarget.full_name}'s ${confirmTarget.payroll_provider} reference will be marked inactive.`}
            </p>
            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={closeConfirm}>
                Cancel
              </button>
              <button
                type="button"
                className={confirmTarget.status === "INACTIVE" ? "hr-btn-accent" : "hr-btn-sm hr-btn-danger"}
                onClick={confirmToggle}
                disabled={confirming}
              >
                {confirming ? "Working…" : confirmTarget.status === "INACTIVE" ? "Reactivate" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PayrollReferences;
