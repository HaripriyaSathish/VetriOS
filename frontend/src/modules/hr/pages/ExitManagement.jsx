import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Check, LogOut, ListChecks, Hourglass, CheckCircle2, CalendarClock, CalendarDays, Lock } from "lucide-react";
import client from "../../../api/client";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import Pagination, { paginate } from "../../../components/Pagination";
import "../styles/HRDashboard.css";
import "../styles/Attendance.css";
import "../styles/Employees.css";

const EXIT_TYPE_LABEL = {
  RESIGNATION: "Resignation",
  TERMINATION: "Termination",
  RETIREMENT: "Retirement",
  CONTRACT_END: "Contract end",
  ABSCONDING: "Absconding",
  OTHER: "Other",
};

const STATUS_LABEL = { PENDING: "Pending", IN_PROGRESS: "In progress", COMPLETED: "Completed" };
const STATUS_CLASS = { PENDING: "half", IN_PROGRESS: "leave", COMPLETED: "present" };

const EMPTY_FORM = {
  employee_id: "",
  exit_type: "RESIGNATION",
  exit_date: "",
  last_working_date: "",
  notice_period_days: "",
  reason: "",
  remarks: "",
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Exit management — one record per employee. HR drafts it (status derives
// to Pending); only System Administrator can approve (same split as
// Promotions), then HR ticks the exit interview off once it's done
// (status becomes Completed). No reject/delete — the DB has nowhere to
// store either, a mistaken record is just corrected via edit.
function ExitManagement() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isSystemAdministrator = (user?.roles || []).includes("System Administrator");

  const [exits, setExits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingExit, setEditingExit] = useState(null); // null = creating
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [origForm, setOrigForm] = useState(null); // loaded values while editing, to show what changed

  const [approving, setApproving] = useState(null); // exit_id currently being approved
  const [actionError, setActionError] = useState("");

  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const employeePickerRef = useRef(null);

  const loadExits = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get("/api/hr/exits/");
      setExits(data);
    } catch (err) {
      setError("Couldn't load exit records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExits();
    client
      .get("/api/hr/employees/")
      .then(({ data }) => setEmployees(data))
      .catch(() => {});
  }, []);

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

  const openCreate = () => {
    setEditingExit(null);
    setOrigForm(null);
    setForm(EMPTY_FORM);
    setEmployeeQuery("");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditingExit(record);
    const loaded = {
      employee_id: record.employee_id,
      exit_type: record.exit_type,
      exit_date: record.exit_date,
      last_working_date: record.last_working_date || "",
      notice_period_days: record.notice_period_days ?? "",
      reason: record.reason || "",
      remarks: record.remarks || "",
    };
    setForm(loaded);
    setOrigForm(loaded);
    setEmployeeQuery(`${record.full_name}${record.employee_code ? ` (${record.employee_code})` : ""}`);
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!editingExit && !form.employee_id) {
      setFormError("Pick an employee from the list.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    const payload = {
      ...form,
      last_working_date: form.last_working_date || null,
      notice_period_days: form.notice_period_days === "" ? null : Number(form.notice_period_days),
    };
    try {
      if (editingExit) {
        delete payload.employee_id;
        await client.patch(`/api/hr/exits/${editingExit.exit_id}/`, payload);
      } else {
        await client.post("/api/hr/exits/", payload);
      }
      setModalOpen(false);
      await loadExits();
    } catch (err) {
      const data = err.response?.data;
      const firstError = data && Object.values(data)[0];
      setFormError(Array.isArray(firstError) ? firstError[0] : data?.detail || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleInterview = async (record) => {
    setActionError("");
    try {
      await client.patch(`/api/hr/exits/${record.exit_id}/`, {
        exit_interview_completed: !record.exit_interview_completed,
      });
      await loadExits();
    } catch (err) {
      setActionError("Couldn't update the exit interview status.");
    }
  };

  const approve = async (record) => {
    setApproving(record.exit_id);
    setActionError("");
    try {
      await client.post(`/api/hr/exits/${record.exit_id}/approve/`);
      await loadExits();
    } catch (err) {
      setActionError(err.response?.data?.detail || "Couldn't approve that record.");
    } finally {
      setApproving(null);
    }
  };

  const employeeCount = exits.length;

  const currentYear = new Date().getFullYear();
  const [statsYear, setStatsYear] = useState(currentYear);
  const statsYearOptions = useMemo(() => {
    const years = new Set([currentYear]);
    exits.forEach((r) => years.add(new Date(r.exit_date).getFullYear()));
    return [...years].sort((a, b) => b - a);
  }, [exits, currentYear]);

  const exitsInStatsYear = exits.filter((r) => new Date(r.exit_date).getFullYear() === statsYear);
  const activeExitsThisYear = exitsInStatsYear.filter((r) => r.status !== "COMPLETED").length;
  const noticeDaysList = exitsInStatsYear
    .map((r) => r.notice_period_days)
    .filter((d) => d !== null && d !== undefined);
  const avgNotice = noticeDaysList.length
    ? Math.round(noticeDaysList.reduce((sum, d) => sum + d, 0) / noticeDaysList.length)
    : null;

  const completedInYear = exitsInStatsYear.filter((r) => r.status === "COMPLETED").length;
  const statCards = [
    { label: `Exit records · ${statsYear}`, value: exitsInStatsYear.length, tone: "blue", Icon: ListChecks },
    { label: "Active exits", value: activeExitsThisYear, tone: "amber", Icon: Hourglass },
    { label: "Completed", value: completedInYear, tone: "green", Icon: CheckCircle2 },
    { label: "Avg. notice", value: avgNotice === null ? "—" : `${avgNotice} days`, tone: "violet", Icon: CalendarClock },
  ];

  const requiredDone = [editingExit ? editingExit.employee_id : form.employee_id, form.exit_type, form.exit_date].filter(Boolean).length;
  const isChanged = (k) => !!editingExit && !!origForm && String(form[k] ?? "") !== String(origForm[k] ?? "");
  const chg = (k) => (isChanged(k) ? "emp-changed" : "");
  const was = (k) => {
    if (!isChanged(k)) return null;
    const v = origForm[k];
    const shown =
      v === "" || v == null ? "empty" : k === "exit_type" ? EXIT_TYPE_LABEL[v] || v : k === "exit_date" || k === "last_working_date" ? formatDate(v) : v;
    return <span className="emp-form-was">Was {shown}</span>;
  };
  const changeCount = editingExit && origForm ? Object.keys(origForm).filter(isChanged).length : 0;

  return (
    <div className="hr-screen ex2">
      <div className="hr-head">
        <div>
          <h1>Exit records</h1>
          <p>{employeeCount} {employeeCount === 1 ? "employee" : "employees"} tracked for exit</p>
        </div>
        <button type="button" className="hr-btn-accent emp-new-btn" onClick={openCreate}>
          <Plus size={15} /> New exit record
        </button>
      </div>

      {error && <p className="hr-error">{error}</p>}
      {actionError && <p className="hr-error">{actionError}</p>}

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

      <div className="hr-panel">
        {loading ? (
          <p className="hr-empty">Loading…</p>
        ) : exits.length === 0 ? (
          <p className="hr-empty">No exit records yet.</p>
        ) : (
          <>
            <div className="hr-table-scroll">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Exit type</th>
                    <th>Last day</th>
                    <th>Status</th>
                    <th>Exit interview</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(exits, page, 8).map((r) => {
                    const st = r.status;
                    return (
                      <tr key={r.exit_id} className={st === "PENDING" ? "ex2-pending" : ""}>
                        <td>
                          <div className="hr-cell-user">
                            <EmployeeAvatar personId={r.person_id} size={34} />
                            <div>
                              <div className="hr-name">{r.full_name}</div>
                              {r.employee_code && <div className="hr-sub">{r.employee_code}</div>}
                            </div>
                          </div>
                        </td>
                        <td>{EXIT_TYPE_LABEL[r.exit_type] || r.exit_type}</td>
                        <td>
                          <span className="ex2-date"><CalendarDays size={14} />{formatDate(r.last_working_date || r.exit_date)}</span>
                        </td>
                        <td>
                          <span className={"att-pill " + (STATUS_CLASS[st] || "absent")}>{STATUS_LABEL[st] || st}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={"hr-btn-sm" + (r.exit_interview_completed ? " hr-btn-sm-active" : "")}
                            onClick={() => toggleInterview(r)}
                            disabled={!r.approved_by_name}
                            title={!r.approved_by_name ? "Approve the exit first" : ""}
                          >
                            {r.exit_interview_completed ? "Completed" : "Not done"}
                          </button>
                        </td>
                        <td>
                          <div className="hr-row-actions">
                            <button type="button" className="hr-btn-sm" onClick={() => openEdit(r)}>
                              Edit
                            </button>
                            {isSystemAdministrator && !r.approved_by_name && (
                              <button
                                type="button"
                                className="lv-action-btn lv-action-approve"
                                onClick={() => approve(r)}
                                disabled={approving === r.exit_id}
                              >
                                <Check size={14} /> {approving === r.exit_id ? "Working…" : "Approve"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalItems={exits.length} onPageChange={setPage} pageSize={8} />
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
              <span className="org-modal-ico"><LogOut size={19} /></span>
              <div>
                <h2>{editingExit ? "Edit exit record" : "New exit record"}</h2>
                <p>
                  {editingExit
                    ? `Updating ${editingExit.full_name}${editingExit.employee_code ? ` · ${editingExit.employee_code}` : ""}`
                    : "Track an employee's departure and notice period."}
                </p>
              </div>
            </div>
            {!editingExit && (
              <div className="prf-bar" aria-hidden="true">
                <i style={{ width: `${(requiredDone / 3) * 100}%` }} />
              </div>
            )}

            <div className="prf-body">
              <section className="prf-sec">
                <h3><span className="prf-step">1</span>Employee</h3>
                <label>Employee</label>
                {editingExit ? (
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
                <h3><span className="prf-step">2</span>Exit details</h3>
                <div className="hr-form-row">
                  <div className={chg("exit_type")}>
                    <label>Exit type</label>
                    <select value={form.exit_type} onChange={(e) => setForm({ ...form, exit_type: e.target.value })} required>
                      {Object.entries(EXIT_TYPE_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {was("exit_type")}
                  </div>
                  <div className={chg("notice_period_days")}>
                    <label>Notice period (days, optional)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.notice_period_days}
                      onChange={(e) => setForm({ ...form, notice_period_days: e.target.value })}
                    />
                    {was("notice_period_days")}
                  </div>
                </div>
                <div className="hr-form-row">
                  <div className={chg("exit_date")}>
                    <label>Exit date</label>
                    <input
                      type="date"
                      value={form.exit_date}
                      onChange={(e) => setForm({ ...form, exit_date: e.target.value })}
                      required
                    />
                    {was("exit_date")}
                  </div>
                  <div className={chg("last_working_date")}>
                    <label>Last working date (optional)</label>
                    <input
                      type="date"
                      value={form.last_working_date}
                      onChange={(e) => setForm({ ...form, last_working_date: e.target.value })}
                    />
                    {was("last_working_date")}
                  </div>
                </div>
              </section>

              <section className="prf-sec">
                <h3><span className="prf-step">3</span>Notes</h3>
                <div className="hr-form-row">
                  <div className={chg("reason")}>
                    <label>Reason (optional)</label>
                    <textarea
                      className="lv-textarea"
                      value={form.reason}
                      onChange={(e) => setForm({ ...form, reason: e.target.value })}
                      placeholder="Why is the employee leaving?"
                      rows={3}
                    />
                    {was("reason")}
                  </div>
                  <div className={chg("remarks")}>
                    <label>Remarks (optional)</label>
                    <textarea
                      className="lv-textarea"
                      value={form.remarks}
                      onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                      placeholder="Anything HR should know"
                      rows={3}
                    />
                    {was("remarks")}
                  </div>
                </div>
              </section>

              {formError && <p className="hr-error">{formError}</p>}
            </div>

            <div className="hr-modal-actions org-modal-foot prf-foot">
              {editingExit ? (
                <span className="emp-form-changes">{changeCount === 0 ? "No changes yet" : `${changeCount} ${changeCount === 1 ? "change" : "changes"}`}</span>
              ) : (
                <span className="prf-count">{requiredDone} of 3 required fields done</span>
              )}
              <button type="button" className="hr-btn-sm" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="hr-btn-accent" disabled={submitting}>
                {submitting ? "Saving…" : editingExit ? "Save changes" : "Add record"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default ExitManagement;
