import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Check } from "lucide-react";
import client from "../../../api/client";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import Pagination, { paginate } from "../../../components/Pagination";
import "../styles/HRDashboard.css";

const EXIT_TYPE_LABEL = {
  RESIGNATION: "Resignation",
  TERMINATION: "Termination",
  RETIREMENT: "Retirement",
  CONTRACT_END: "Contract end",
  ABSCONDING: "Absconding",
  OTHER: "Other",
};

const STATUS_LABEL = { PENDING: "Pending", IN_PROGRESS: "In progress", COMPLETED: "Completed" };
const STATUS_CLASS = { PENDING: "off", IN_PROGRESS: "warn", COMPLETED: "on" };

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
    setForm(EMPTY_FORM);
    setEmployeeQuery("");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditingExit(record);
    setForm({
      employee_id: record.employee_id,
      exit_type: record.exit_type,
      exit_date: record.exit_date,
      last_working_date: record.last_working_date || "",
      notice_period_days: record.notice_period_days ?? "",
      reason: record.reason || "",
      remarks: record.remarks || "",
    });
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

  return (
    <div className="hr-screen">
      <div className="hr-head">
        <div>
          <h1>Exit records</h1>
          <p>{employeeCount} {employeeCount === 1 ? "employee" : "employees"} tracked for exit</p>
        </div>
        <button type="button" className="hr-btn-accent" onClick={openCreate}>
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

      <div className="att-stats" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <div className="att-stat-card">
          <span className="att-stat-label">Avg. notice</span>
          <span className="att-stat-value">{avgNotice === null ? "—" : `${avgNotice} days`}</span>
          <span className="att-stat-sub">Across exits in {statsYear}</span>
        </div>
        <div className="att-stat-card">
          <span className="att-stat-label">Active exits</span>
          <span className="att-stat-value">{activeExitsThisYear}</span>
          <span className="att-stat-sub">Not yet completed · {statsYear}</span>
        </div>
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
                      <tr key={r.exit_id}>
                        <td>
                          <div className="hr-cell-user">
                            <EmployeeAvatar personId={r.person_id} size={28} />
                            <div className="hr-name">{r.full_name}</div>
                          </div>
                        </td>
                        <td>{EXIT_TYPE_LABEL[r.exit_type] || r.exit_type}</td>
                        <td className="hr-mono">{formatDate(r.last_working_date || r.exit_date)}</td>
                        <td>
                          <span className={"hr-pill " + (STATUS_CLASS[st] || "off")}>{STATUS_LABEL[st] || st}</span>
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
          <form className="hr-modal hr-modal-wide" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <button type="button" className="hr-modal-x" onClick={closeModal} aria-label="Close">
              ✕
            </button>
            <h2>{editingExit ? "Edit exit record" : "New exit record"}</h2>

            <label>Employee</label>
            {editingExit ? (
              <input type="text" value={employeeQuery} disabled />
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

            <label>Exit type</label>
            <select value={form.exit_type} onChange={(e) => setForm({ ...form, exit_type: e.target.value })} required>
              {Object.entries(EXIT_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <div className="hr-form-row">
              <div>
                <label>Exit date</label>
                <input
                  type="date"
                  value={form.exit_date}
                  onChange={(e) => setForm({ ...form, exit_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Last working date (optional)</label>
                <input
                  type="date"
                  value={form.last_working_date}
                  onChange={(e) => setForm({ ...form, last_working_date: e.target.value })}
                />
              </div>
            </div>

            <label>Notice period (days, optional)</label>
            <input
              type="number"
              min="0"
              value={form.notice_period_days}
              onChange={(e) => setForm({ ...form, notice_period_days: e.target.value })}
            />

            <label>Reason (optional)</label>
            <textarea
              className="lv-textarea"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={2}
            />

            <label>Remarks (optional)</label>
            <textarea
              className="lv-textarea"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              rows={2}
            />

            {formError && <p className="hr-error">{formError}</p>}

            <div className="hr-modal-actions">
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
