import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  Columns3,
  Download,
  Eye,
  SquarePen,
  Ban,
  RotateCcw,
  CircleUserRound,
  Camera,
  Plus,
} from "lucide-react";
import client from "../../../api/client";
import Pagination, { paginate } from "../../../components/Pagination";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import "../styles/HRDashboard.css";

const EMPTY_FILTERS = {
  department_id: "",
  designation_id: "",
  employment_type_id: "",
  branch_id: "",
  status: "",
  joined_from: "",
  joined_to: "",
};

// Which optional columns are visible — Email/Phone/Employee code start
// hidden to match the reference design's default compact table.
const DEFAULT_COLUMNS = { email: false, phone: false, employee_code: false };

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  date_of_birth: "",
  gender: "",
  employee_code: "",
  designation_id: "",
  employment_type_id: "",
  department_id: "",
  branch_id: "",
  joining_date: "",
  confirmation_date: "",
};

const EMPTY_DEPT_FORM = { department_name: "", description: "" };
const EMPTY_DESIG_FORM = { designation_code: "", designation_name: "", description: "", level_number: "" };

// Nothing in the UI otherwise shows which employee codes are already
// taken, so guessing the next one (EMP005? EMP006?) isn't really
// possible — suggest it instead: highest EMP<N> in use, plus one, same
// zero-padding width. Pre-filled but still an editable text field, so
// HR can always override it.
function suggestNextEmployeeCode(employees) {
  let maxNum = 0;
  let width = 3;
  for (const emp of employees) {
    const match = /^EMP(\d+)$/i.exec(emp.employee_code || "");
    if (!match) continue;
    const num = parseInt(match[1], 10);
    if (num > maxNum) {
      maxNum = num;
      width = match[1].length;
    }
  }
  return `EMP${String(maxNum + 1).padStart(width, "0")}`;
}

function toCsv(rows) {
  const header = ["Name", "Email", "Code", "Designation", "Department", "Branch", "Employment Type", "Joining Date", "Status"];
  const lines = rows.map((r) =>
    [r.full_name, r.email, r.employee_code, r.designation_name, r.department_name, r.branch_name, r.employment_type_name, r.joining_date, r.status]
      .map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// HR screen — lists every employee record and lets an HR Administrator
// (or System Administrator) add a new one. Creating an employee always
// creates their person record too — there's no "attach to existing
// person" mode here yet, unlike Identity & Access's account creation.
// Departments/Designations are read-only tabs for now — CRUD for those
// is a later stage.
function HRDashboard() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tab, setTab] = useState("employees"); // "employees" | "departments" | "designations"
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const filtersRef = useRef(null);
  const columnsRef = useRef(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Held locally until the employee is saved — a brand-new employee has
  // no employee_id yet to upload against, so the picture always goes up
  // *after* create/update succeeds, using whichever id that returns.
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const [viewEmployee, setViewEmployee] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);

  // Departments tab — search + CRUD, same shape as the Employees tab's
  // create/edit/confirm state, just for department instead.
  const [deptSearch, setDeptSearch] = useState("");
  const [deptPage, setDeptPage] = useState(1);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptForm, setDeptForm] = useState(EMPTY_DEPT_FORM);
  const [deptFormError, setDeptFormError] = useState("");
  const [deptSubmitting, setDeptSubmitting] = useState(false);
  const [deptConfirmTarget, setDeptConfirmTarget] = useState(null);
  const [deptConfirming, setDeptConfirming] = useState(false);

  // Designations tab — same pattern.
  const [desigSearch, setDesigSearch] = useState("");
  const [desigPage, setDesigPage] = useState(1);
  const [desigModalOpen, setDesigModalOpen] = useState(false);
  const [editingDesig, setEditingDesig] = useState(null);
  const [desigForm, setDesigForm] = useState(EMPTY_DESIG_FORM);
  const [desigFormError, setDesigFormError] = useState("");
  const [desigSubmitting, setDesigSubmitting] = useState(false);
  const [desigConfirmTarget, setDesigConfirmTarget] = useState(null);
  const [desigConfirming, setDesigConfirming] = useState(false);

  // Bumped after every successful avatar upload — folded into the
  // Cloudinary URL as ?v= so the browser re-fetches instead of showing
  // its cached copy of the old photo for this person_id.
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [empRes, deptRes, desRes, typeRes, branchRes] = await Promise.all([
        client.get("/api/hr/employees/"),
        client.get("/api/hr/departments/"),
        client.get("/api/hr/designations/"),
        client.get("/api/hr/employment-types/"),
        client.get("/api/hr/branches/"),
      ]);
      setEmployees(empRes.data);
      setDepartments(deptRes.data);
      setDesignations(desRes.data);
      setEmploymentTypes(typeRes.data);
      setBranches(branchRes.data);
    } catch (err) {
      setError("Couldn't load HR data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target)) setFiltersOpen(false);
      if (columnsRef.current && !columnsRef.current.contains(event.target)) setColumnsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openCreate = () => {
    setEditingEmployee(null);
    setForm({ ...EMPTY_FORM, employee_code: suggestNextEmployeeCode(employees) });
    setFormError("");
    setAvatarFile(null);
    setAvatarPreview("");
    setModalOpen(true);
  };

  const openEdit = async (emp) => {
    setEditingEmployee(emp);
    setFormError("");
    setAvatarFile(null);
    setAvatarPreview("");
    setModalOpen(true);
    try {
      const { data } = await client.get(`/api/hr/employees/${emp.employee_id}/`);
      setForm({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        email: data.email || "",
        phone: data.phone || "",
        date_of_birth: data.date_of_birth || "",
        gender: data.gender || "",
        employee_code: data.employee_code || "",
        designation_id: data.designation_id || "",
        employment_type_id: data.employment_type_id || "",
        department_id: data.department_id || "",
        branch_id: data.branch_id || "",
        joining_date: data.joining_date || "",
        confirmation_date: data.confirmation_date || "",
      });
    } catch (err) {
      setFormError("Couldn't load this employee's details.");
    }
  };

  const closeModal = () => setModalOpen(false);

  const uploadAvatar = async (employeeId, file) => {
    const body = new FormData();
    body.append("file", file);
    await client.post(`/api/hr/employees/${employeeId}/avatar/`, body, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setAvatarVersion((v) => v + 1);
  };

  const pickAvatarFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      // Optional select/date fields — an empty string isn't a valid
      // integer/date for the backend, so blanks go through as null
      // (department_id=null means "don't change it"; the date fields
      // just leave that value unset).
      const payload = {
        ...form,
        department_id: form.department_id === "" ? null : Number(form.department_id),
        branch_id: form.branch_id === "" ? null : Number(form.branch_id),
        date_of_birth: form.date_of_birth || null,
        confirmation_date: form.confirmation_date || null,
      };
      let employeeId = editingEmployee?.employee_id;
      if (editingEmployee) {
        await client.patch(`/api/hr/employees/${editingEmployee.employee_id}/`, payload);
      } else {
        const { data } = await client.post("/api/hr/employees/", payload);
        employeeId = data.employee_id;
      }
      if (avatarFile && employeeId) {
        try {
          await uploadAvatar(employeeId, avatarFile);
        } catch (err) {
          setFormError("Employee saved, but the photo upload failed. Try uploading it again from the employee's profile.");
        }
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      const data = err.response?.data;
      const firstError = data && Object.values(data)[0];
      setFormError(Array.isArray(firstError) ? firstError[0] : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const openView = async (emp) => {
    setViewEmployee({ ...emp, loading: true });
    setViewLoading(true);
    setViewError("");
    setAvatarError("");
    try {
      const { data } = await client.get(`/api/hr/employees/${emp.employee_id}/`);
      setViewEmployee(data);
    } catch (err) {
      setViewError("Couldn't load this employee's details.");
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => setViewEmployee(null);

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !viewEmployee) return;
    setAvatarError("");
    setAvatarUploading(true);
    try {
      await uploadAvatar(viewEmployee.employee_id, file);
    } catch (err) {
      setAvatarError("Couldn't upload that photo.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const requestToggleActive = (emp) => setConfirmTarget(emp);
  const cancelToggleActive = () => setConfirmTarget(null);

  const confirmToggleActive = async () => {
    const emp = confirmTarget;
    setConfirming(true);
    try {
      if (emp.status === "ACTIVE") {
        await client.delete(`/api/hr/employees/${emp.employee_id}/`);
      } else {
        await client.patch(`/api/hr/employees/${emp.employee_id}/`, { status: "ACTIVE" });
      }
      setConfirmTarget(null);
      await loadData();
    } catch (err) {
      setError("Couldn't update that employee.");
    } finally {
      setConfirming(false);
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  // --- Departments CRUD ---
  const openCreateDept = () => {
    setEditingDept(null);
    setDeptForm(EMPTY_DEPT_FORM);
    setDeptFormError("");
    setDeptModalOpen(true);
  };

  const openEditDept = (d) => {
    setEditingDept(d);
    setDeptForm({ department_name: d.department_name, description: d.description || "" });
    setDeptFormError("");
    setDeptModalOpen(true);
  };

  const closeDeptModal = () => setDeptModalOpen(false);

  const handleDeptSubmit = async (event) => {
    event.preventDefault();
    setDeptSubmitting(true);
    setDeptFormError("");
    try {
      if (editingDept) {
        await client.patch(`/api/hr/departments/${editingDept.department_id}/`, deptForm);
      } else {
        await client.post("/api/hr/departments/", deptForm);
      }
      setDeptModalOpen(false);
      await loadData();
    } catch (err) {
      const data = err.response?.data;
      const firstError = data && Object.values(data)[0];
      setDeptFormError(Array.isArray(firstError) ? firstError[0] : "Something went wrong.");
    } finally {
      setDeptSubmitting(false);
    }
  };

  const requestToggleDept = (d) => setDeptConfirmTarget(d);
  const cancelToggleDept = () => setDeptConfirmTarget(null);

  const confirmToggleDept = async () => {
    const d = deptConfirmTarget;
    setDeptConfirming(true);
    try {
      if (d.is_active) {
        await client.delete(`/api/hr/departments/${d.department_id}/`);
      } else {
        await client.patch(`/api/hr/departments/${d.department_id}/`, { is_active: true });
      }
      setDeptConfirmTarget(null);
      await loadData();
    } catch (err) {
      setError("Couldn't update that department.");
    } finally {
      setDeptConfirming(false);
    }
  };

  const filteredDepartments = useMemo(() => {
    const q = deptSearch.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) =>
      [d.department_name, d.description].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    );
  }, [departments, deptSearch]);

  // --- Designations CRUD ---
  const openCreateDesig = () => {
    setEditingDesig(null);
    setDesigForm(EMPTY_DESIG_FORM);
    setDesigFormError("");
    setDesigModalOpen(true);
  };

  const openEditDesig = (d) => {
    setEditingDesig(d);
    setDesigForm({
      designation_code: d.designation_code || "",
      designation_name: d.designation_name,
      description: d.description || "",
      level_number: d.level_number ?? "",
    });
    setDesigFormError("");
    setDesigModalOpen(true);
  };

  const closeDesigModal = () => setDesigModalOpen(false);

  const handleDesigSubmit = async (event) => {
    event.preventDefault();
    setDesigSubmitting(true);
    setDesigFormError("");
    try {
      const payload = { ...desigForm, level_number: desigForm.level_number === "" ? null : Number(desigForm.level_number) };
      if (editingDesig) {
        await client.patch(`/api/hr/designations/${editingDesig.designation_id}/`, payload);
      } else {
        await client.post("/api/hr/designations/", payload);
      }
      setDesigModalOpen(false);
      await loadData();
    } catch (err) {
      const data = err.response?.data;
      const firstError = data && Object.values(data)[0];
      setDesigFormError(Array.isArray(firstError) ? firstError[0] : "Something went wrong.");
    } finally {
      setDesigSubmitting(false);
    }
  };

  const requestToggleDesig = (d) => setDesigConfirmTarget(d);
  const cancelToggleDesig = () => setDesigConfirmTarget(null);

  const confirmToggleDesig = async () => {
    const d = desigConfirmTarget;
    setDesigConfirming(true);
    try {
      if (d.is_active) {
        await client.delete(`/api/hr/designations/${d.designation_id}/`);
      } else {
        await client.patch(`/api/hr/designations/${d.designation_id}/`, { is_active: true });
      }
      setDesigConfirmTarget(null);
      await loadData();
    } catch (err) {
      setError("Couldn't update that designation.");
    } finally {
      setDesigConfirming(false);
    }
  };

  const filteredDesignations = useMemo(() => {
    const q = desigSearch.trim().toLowerCase();
    if (!q) return designations;
    return designations.filter((d) =>
      [d.designation_name, d.description, d.designation_code].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    );
  }, [designations, desigSearch]);

  const activeDepartments = useMemo(() => departments.filter((d) => d.is_active), [departments]);
  const activeDesignations = useMemo(() => designations.filter((d) => d.is_active), [designations]);
  const activeBranches = useMemo(() => branches.filter((b) => b.is_active), [branches]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((emp) => {
      if (q) {
        const matchesSearch = [emp.full_name, emp.email, emp.employee_code, emp.designation_name, emp.department_name]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }
      if (filters.department_id && String(emp.department_id ?? "") !== filters.department_id) return false;
      if (filters.designation_id && String(emp.designation_id ?? "") !== filters.designation_id) return false;
      if (filters.employment_type_id && String(emp.employment_type_id ?? "") !== filters.employment_type_id)
        return false;
      if (filters.branch_id && String(emp.branch_id ?? "") !== filters.branch_id) return false;
      if (filters.status && emp.status !== filters.status) return false;
      if (filters.joined_from && (!emp.joining_date || emp.joining_date < filters.joined_from)) return false;
      if (filters.joined_to && (!emp.joining_date || emp.joining_date > filters.joined_to)) return false;
      return true;
    });
  }, [employees, search, filters]);

  const handleExport = () => downloadCsv(toCsv(filteredEmployees), "employees.csv");

  return (
    <div className="hr-screen">
      <div className="hr-head">
        <div>
          <h1>Employees</h1>
          <p>Manage your people, teams, and employment details.</p>
        </div>
        <button className="hr-btn-accent" onClick={openCreate}>
          + New employee
        </button>
      </div>

      <div className="hr-tabs">
        <button
          className={"hr-tab" + (tab === "employees" ? " active" : "")}
          onClick={() => setTab("employees")}
        >
          All employees <span className="hr-tab-count">{employees.length}</span>
        </button>
        <button
          className={"hr-tab" + (tab === "departments" ? " active" : "")}
          onClick={() => setTab("departments")}
        >
          Departments <span className="hr-tab-count">{departments.length}</span>
        </button>
        <button
          className={"hr-tab" + (tab === "designations" ? " active" : "")}
          onClick={() => setTab("designations")}
        >
          Designations <span className="hr-tab-count">{designations.length}</span>
        </button>
      </div>

      {error && <p className="hr-error">{error}</p>}

      {tab === "employees" && (
        <div className="hr-panel">
          <div className="hr-toolbar">
            <div className="hr-search">
              <Search size={15} />
              <input
                placeholder="Search employees…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="hr-popover-anchor" ref={filtersRef}>
              <button
                type="button"
                className={"hr-btn-sm" + (activeFilterCount ? " hr-btn-sm-active" : "")}
                onClick={() => {
                  setFiltersOpen((v) => !v);
                  setColumnsOpen(false);
                }}
              >
                <SlidersHorizontal size={14} /> Filters
                {activeFilterCount > 0 && <span className="hr-tab-count">{activeFilterCount}</span>}
              </button>
              {filtersOpen && (
                <div className="hr-popover">
                  <div className="hr-popover-head">
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <button type="button" className="hr-popover-clear" onClick={clearFilters}>
                        Clear all
                      </button>
                    )}
                  </div>

                  <label>Department</label>
                  <select
                    value={filters.department_id}
                    onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
                  >
                    <option value="">All</option>
                    {departments.map((d) => (
                      <option key={d.department_id} value={d.department_id}>
                        {d.department_name}
                      </option>
                    ))}
                  </select>

                  <label>Designation</label>
                  <select
                    value={filters.designation_id}
                    onChange={(e) => setFilters({ ...filters, designation_id: e.target.value })}
                  >
                    <option value="">All</option>
                    {designations.map((d) => (
                      <option key={d.designation_id} value={d.designation_id}>
                        {d.designation_name}
                      </option>
                    ))}
                  </select>

                  <label>Employment type</label>
                  <select
                    value={filters.employment_type_id}
                    onChange={(e) => setFilters({ ...filters, employment_type_id: e.target.value })}
                  >
                    <option value="">All</option>
                    {employmentTypes.map((t) => (
                      <option key={t.employment_type_id} value={t.employment_type_id}>
                        {t.employment_type_name}
                      </option>
                    ))}
                  </select>

                  <label>Branch</label>
                  <select
                    value={filters.branch_id}
                    onChange={(e) => setFilters({ ...filters, branch_id: e.target.value })}
                  >
                    <option value="">All</option>
                    {branches.map((b) => (
                      <option key={b.branch_id} value={b.branch_id}>
                        {b.branch_name}
                      </option>
                    ))}
                  </select>

                  <label>Status</label>
                  <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                    <option value="">All</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>

                  <label>Joined between</label>
                  <div className="hr-form-row">
                    <input
                      type="date"
                      value={filters.joined_from}
                      onChange={(e) => setFilters({ ...filters, joined_from: e.target.value })}
                    />
                    <input
                      type="date"
                      value={filters.joined_to}
                      onChange={(e) => setFilters({ ...filters, joined_to: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="hr-popover-anchor" ref={columnsRef}>
              <button
                type="button"
                className="hr-btn-sm"
                onClick={() => {
                  setColumnsOpen((v) => !v);
                  setFiltersOpen(false);
                }}
              >
                <Columns3 size={14} /> Columns
              </button>
              {columnsOpen && (
                <div className="hr-popover hr-popover-narrow">
                  <div className="hr-popover-head">
                    <span>Columns</span>
                  </div>
                  {[
                    ["email", "Email"],
                    ["phone", "Phone"],
                    ["employee_code", "Employee code"],
                  ].map(([key, label]) => (
                    <label key={key} className="hr-checkbox-row">
                      <input
                        type="checkbox"
                        checked={columns[key]}
                        onChange={(e) => setColumns({ ...columns, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button type="button" className="hr-btn-sm" onClick={handleExport}>
              <Download size={14} /> Export
            </button>
          </div>

          {loading ? (
            <p className="hr-empty">Loading…</p>
          ) : filteredEmployees.length === 0 ? (
            <p className="hr-empty">
              {employees.length === 0
                ? "No employees yet — add the first one."
                : search
                ? `No employees match "${search}".`
                : "No employees match the current filters."}
            </p>
          ) : (
            <>
              <div className="hr-table-scroll">
                <table className="hr-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      {columns.employee_code && <th>Code</th>}
                      {columns.email && <th>Email</th>}
                      {columns.phone && <th>Phone</th>}
                      <th>Department</th>
                      <th>Branch</th>
                      <th>Employment Type</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginate(filteredEmployees, page, 6).map((emp) => {
                      return (
                        <tr key={emp.employee_id}>
                          <td>
                            <div className="hr-cell-user">
                              <EmployeeAvatar personId={emp.person_id} size={28} version={avatarVersion} />
                              <div>
                                <div className="hr-name">{emp.full_name}</div>
                                <div className="hr-sub">
                                  {emp.designation_name || "—"}
                                  {emp.employment_type_name && /intern/i.test(emp.employment_type_name) && (
                                    <span className="hr-pill warn hr-intern-badge">Intern</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          {columns.employee_code && <td className="hr-mono">{emp.employee_code}</td>}
                          {columns.email && <td>{emp.email || "—"}</td>}
                          {columns.phone && <td>{emp.phone || "—"}</td>}
                          <td>{emp.department_name || "—"}</td>
                          <td>{emp.branch_name || "—"}</td>
                          <td>{emp.employment_type_name || "—"}</td>
                          <td className="hr-mono">{emp.joining_date || "—"}</td>
                          <td>
                            <span className={"hr-pill " + (emp.status === "ACTIVE" ? "on" : "off")}>
                              {emp.status === "ACTIVE" ? "Active" : emp.status}
                            </span>
                          </td>
                          <td>
                            <div className="hr-row-actions">
                              <button
                                type="button"
                                className="hr-icon-btn"
                                title="View"
                                aria-label={`View ${emp.full_name}`}
                                onClick={() => openView(emp)}
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                type="button"
                                className="hr-icon-btn"
                                title="Edit"
                                aria-label={`Edit ${emp.full_name}`}
                                onClick={() => openEdit(emp)}
                              >
                                <SquarePen size={15} />
                              </button>
                              <button
                                type="button"
                                className={"hr-icon-btn" + (emp.status === "ACTIVE" ? " danger" : "")}
                                title={emp.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                                aria-label={
                                  (emp.status === "ACTIVE" ? "Deactivate " : "Reactivate ") + emp.full_name
                                }
                                onClick={() => requestToggleActive(emp)}
                              >
                                {emp.status === "ACTIVE" ? <Ban size={15} /> : <RotateCcw size={15} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalItems={filteredEmployees.length} onPageChange={setPage} pageSize={6} />
            </>
          )}
        </div>
      )}

      {tab === "departments" && (
        <div className="hr-panel">
          <div className="hr-toolbar">
            <div className="hr-search">
              <Search size={15} />
              <input
                placeholder="Search departments…"
                value={deptSearch}
                onChange={(e) => {
                  setDeptSearch(e.target.value);
                  setDeptPage(1);
                }}
              />
            </div>
            <button type="button" className="hr-btn-accent hr-btn-accent-sm" onClick={openCreateDept}>
              <Plus size={14} /> New department
            </button>
          </div>

          {loading ? (
            <p className="hr-empty">Loading…</p>
          ) : filteredDepartments.length === 0 ? (
            <p className="hr-empty">
              {departments.length === 0
                ? "No departments yet — add the first one."
                : `No departments match "${deptSearch}".`}
            </p>
          ) : (
            <>
            <div className="hr-table-scroll">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(filteredDepartments, deptPage, 6).map((d) => (
                    <tr key={d.department_id}>
                      <td className="hr-name">{d.department_name}</td>
                      <td className="hr-sub">{d.description || "—"}</td>
                      <td>
                        <span className={"hr-pill " + (d.is_active ? "on" : "off")}>
                          {d.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="hr-row-actions">
                          <button
                            type="button"
                            className="hr-icon-btn"
                            title="Edit"
                            aria-label={`Edit ${d.department_name}`}
                            onClick={() => openEditDept(d)}
                          >
                            <SquarePen size={15} />
                          </button>
                          <button
                            type="button"
                            className={"hr-icon-btn" + (d.is_active ? " danger" : "")}
                            title={d.is_active ? "Deactivate" : "Reactivate"}
                            aria-label={(d.is_active ? "Deactivate " : "Reactivate ") + d.department_name}
                            onClick={() => requestToggleDept(d)}
                          >
                            {d.is_active ? <Ban size={15} /> : <RotateCcw size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={deptPage} totalItems={filteredDepartments.length} onPageChange={setDeptPage} pageSize={6} />
            </>
          )}
        </div>
      )}

      {tab === "designations" && (
        <div className="hr-panel">
          <div className="hr-toolbar">
            <div className="hr-search">
              <Search size={15} />
              <input
                placeholder="Search designations…"
                value={desigSearch}
                onChange={(e) => {
                  setDesigSearch(e.target.value);
                  setDesigPage(1);
                }}
              />
            </div>
            <button type="button" className="hr-btn-accent hr-btn-accent-sm" onClick={openCreateDesig}>
              <Plus size={14} /> New designation
            </button>
          </div>

          {loading ? (
            <p className="hr-empty">Loading…</p>
          ) : filteredDesignations.length === 0 ? (
            <p className="hr-empty">
              {designations.length === 0
                ? "No designations yet — add the first one."
                : `No designations match "${desigSearch}".`}
            </p>
          ) : (
            <>
            <div className="hr-table-scroll">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Designation</th>
                    <th>Description</th>
                    <th>Level</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(filteredDesignations, desigPage, 6).map((d) => (
                    <tr key={d.designation_id}>
                      <td className="hr-name">{d.designation_name}</td>
                      <td className="hr-sub">{d.description || "—"}</td>
                      <td className="hr-mono">{d.level_number ?? "—"}</td>
                      <td>
                        <span className={"hr-pill " + (d.is_active ? "on" : "off")}>
                          {d.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="hr-row-actions">
                          <button
                            type="button"
                            className="hr-icon-btn"
                            title="Edit"
                            aria-label={`Edit ${d.designation_name}`}
                            onClick={() => openEditDesig(d)}
                          >
                            <SquarePen size={15} />
                          </button>
                          <button
                            type="button"
                            className={"hr-icon-btn" + (d.is_active ? " danger" : "")}
                            title={d.is_active ? "Deactivate" : "Reactivate"}
                            aria-label={(d.is_active ? "Deactivate " : "Reactivate ") + d.designation_name}
                            onClick={() => requestToggleDesig(d)}
                          >
                            {d.is_active ? <Ban size={15} /> : <RotateCcw size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={desigPage} totalItems={filteredDesignations.length} onPageChange={setDesigPage} pageSize={6} />
            </>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="hr-modal-backdrop" onClick={closeModal}>
          <form className="hr-modal hr-modal-wide" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <button type="button" className="hr-modal-x" onClick={closeModal} aria-label="Close">
              ✕
            </button>
            <h2>{editingEmployee ? "Edit employee" : "New employee"}</h2>
            <p className="hr-hint">
              {editingEmployee
                ? "Updates this employee's details."
                : "Creates a new person record along with their employee details."}
            </p>

            <div className="hr-avatar-picker">
              {avatarPreview ? (
                <img className="hr-avatar hr-avatar-photo" style={{ width: 56, height: 56 }} src={avatarPreview} alt="" />
              ) : editingEmployee ? (
                <EmployeeAvatar personId={editingEmployee.person_id} size={56} version={avatarVersion} />
              ) : (
                <div className="hr-avatar hr-avatar-fallback" style={{ width: 56, height: 56 }}>
                  <CircleUserRound size={40} />
                </div>
              )}
              <label className="hr-btn-sm hr-avatar-picker-btn">
                <Camera size={14} />
                {editingEmployee ? "Change photo" : "Add photo"}
                <input type="file" accept="image/*" onChange={pickAvatarFile} hidden />
              </label>
            </div>

            <div className="hr-form-row">
              <div>
                <label>First name</label>
                <input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Last name</label>
                <input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
            </div>

            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <label>Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />

            <div className="hr-form-row">
              <div>
                <label>Date of birth</label>
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                />
              </div>
              <div>
                <label>Gender</label>
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Select…</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <label>Employee code</label>
            <input
              value={form.employee_code}
              onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
              required
            />

            <div className="hr-form-row">
              <div>
                <label>Designation</label>
                <select
                  value={form.designation_id}
                  onChange={(e) => setForm({ ...form, designation_id: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {activeDesignations.map((d) => (
                    <option key={d.designation_id} value={d.designation_id}>
                      {d.designation_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Employment type</label>
                <select
                  value={form.employment_type_id}
                  onChange={(e) => setForm({ ...form, employment_type_id: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {employmentTypes.map((t) => (
                    <option key={t.employment_type_id} value={t.employment_type_id}>
                      {t.employment_type_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label>Department</label>
            <select
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
            >
              <option value="">Unassigned</option>
              {activeDepartments.map((d) => (
                <option key={d.department_id} value={d.department_id}>
                  {d.department_name}
                </option>
              ))}
            </select>

            <label>Branch</label>
            <select
              value={form.branch_id}
              onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
            >
              <option value="">Unassigned (WFH / Intern / Student)</option>
              {activeBranches.map((b) => (
                <option key={b.branch_id} value={b.branch_id}>
                  {b.branch_name}
                </option>
              ))}
            </select>

            <div className="hr-form-row">
              <div>
                <label>Joining date</label>
                <input
                  type="date"
                  value={form.joining_date}
                  onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Confirmation date</label>
                <input
                  type="date"
                  value={form.confirmation_date}
                  onChange={(e) => setForm({ ...form, confirmation_date: e.target.value })}
                />
              </div>
            </div>

            {formError && <p className="hr-error">{formError}</p>}

            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="hr-btn-accent" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {viewEmployee && (
        <div className="hr-modal-backdrop" onClick={closeView}>
          <div className="hr-modal hr-modal-wide" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="hr-modal-x" onClick={closeView} aria-label="Close">
              ✕
            </button>
            <div className="hr-view-photo-row">
              <div className="hr-view-photo-wrap">
                <EmployeeAvatar personId={viewEmployee.person_id} size={64} version={avatarVersion} />
                <label className="hr-avatar-edit" title="Change photo" aria-label="Change photo">
                  <Camera size={13} />
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} hidden />
                </label>
              </div>
              <div>
                <h2>{viewEmployee.full_name}</h2>
                <p className="hr-hint">{viewEmployee.employee_code}</p>
              </div>
            </div>

            {avatarUploading && <p className="hr-hint">Uploading photo…</p>}
            {avatarError && <p className="hr-error">{avatarError}</p>}
            {viewError && <p className="hr-error">{viewError}</p>}

            {viewLoading ? (
              <p className="hr-empty">Loading…</p>
            ) : (
              <div className="hr-view-grid">
                <div>
                  <span className="hr-view-label">Email</span>
                  <span className="hr-view-value">{viewEmployee.email || "—"}</span>
                </div>
                <div>
                  <span className="hr-view-label">Phone</span>
                  <span className="hr-view-value">{viewEmployee.phone || "—"}</span>
                </div>
                <div>
                  <span className="hr-view-label">Date of birth</span>
                  <span className="hr-view-value">{viewEmployee.date_of_birth || "—"}</span>
                </div>
                <div>
                  <span className="hr-view-label">Gender</span>
                  <span className="hr-view-value">{viewEmployee.gender || "—"}</span>
                </div>
                <div>
                  <span className="hr-view-label">Designation</span>
                  <span className="hr-view-value">{viewEmployee.designation_name || "—"}</span>
                </div>
                <div>
                  <span className="hr-view-label">Department</span>
                  <span className="hr-view-value">{viewEmployee.department_name || "—"}</span>
                </div>
                <div>
                  <span className="hr-view-label">Branch</span>
                  <span className="hr-view-value">{viewEmployee.branch_name || "—"}</span>
                </div>
                <div>
                  <span className="hr-view-label">Employment type</span>
                  <span className="hr-view-value">{viewEmployee.employment_type_name || "—"}</span>
                </div>
                <div>
                  <span className="hr-view-label">Joining date</span>
                  <span className="hr-view-value">{viewEmployee.joining_date || "—"}</span>
                </div>
                <div>
                  <span className="hr-view-label">Confirmation date</span>
                  <span className="hr-view-value">{viewEmployee.confirmation_date || "—"}</span>
                </div>
                <div>
                  <span className="hr-view-label">Status</span>
                  <span className={"hr-pill " + (viewEmployee.status === "ACTIVE" ? "on" : "off")}>
                    {viewEmployee.status === "ACTIVE" ? "Active" : viewEmployee.status}
                  </span>
                </div>
              </div>
            )}

            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={closeView}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmTarget && (
        <div className="hr-modal-backdrop" onClick={cancelToggleActive}>
          <div className="hr-modal hr-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>{confirmTarget.status === "ACTIVE" ? "Deactivate employee?" : "Reactivate employee?"}</h2>
            <p>
              {confirmTarget.status === "ACTIVE"
                ? `${confirmTarget.full_name} will be marked inactive.`
                : `${confirmTarget.full_name} will be marked active again.`}
            </p>
            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={cancelToggleActive}>
                Cancel
              </button>
              <button
                type="button"
                className={confirmTarget.status === "ACTIVE" ? "hr-btn-sm hr-btn-danger" : "hr-btn-accent"}
                onClick={confirmToggleActive}
                disabled={confirming}
              >
                {confirming
                  ? "Working…"
                  : confirmTarget.status === "ACTIVE"
                  ? "Deactivate"
                  : "Reactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deptModalOpen && (
        <div className="hr-modal-backdrop" onClick={closeDeptModal}>
          <form className="hr-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleDeptSubmit}>
            <button type="button" className="hr-modal-x" onClick={closeDeptModal} aria-label="Close">
              ✕
            </button>
            <h2>{editingDept ? "Edit department" : "New department"}</h2>

            <label>Department name</label>
            <input
              value={deptForm.department_name}
              onChange={(e) => setDeptForm({ ...deptForm, department_name: e.target.value })}
              required
            />

            <label>Description</label>
            <textarea
              className="hr-textarea"
              value={deptForm.description}
              onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
              rows={3}
            />

            {deptFormError && <p className="hr-error">{deptFormError}</p>}

            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={closeDeptModal}>
                Cancel
              </button>
              <button type="submit" className="hr-btn-accent" disabled={deptSubmitting}>
                {deptSubmitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deptConfirmTarget && (
        <div className="hr-modal-backdrop" onClick={cancelToggleDept}>
          <div className="hr-modal hr-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>{deptConfirmTarget.is_active ? "Deactivate department?" : "Reactivate department?"}</h2>
            <p>
              {deptConfirmTarget.is_active
                ? `${deptConfirmTarget.department_name} will be marked inactive and hidden from the New Employee form.`
                : `${deptConfirmTarget.department_name} will be marked active again.`}
            </p>
            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={cancelToggleDept}>
                Cancel
              </button>
              <button
                type="button"
                className={deptConfirmTarget.is_active ? "hr-btn-sm hr-btn-danger" : "hr-btn-accent"}
                onClick={confirmToggleDept}
                disabled={deptConfirming}
              >
                {deptConfirming ? "Working…" : deptConfirmTarget.is_active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {desigModalOpen && (
        <div className="hr-modal-backdrop" onClick={closeDesigModal}>
          <form className="hr-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleDesigSubmit}>
            <button type="button" className="hr-modal-x" onClick={closeDesigModal} aria-label="Close">
              ✕
            </button>
            <h2>{editingDesig ? "Edit designation" : "New designation"}</h2>

            <div className="hr-form-row">
              <div>
                <label>Designation code</label>
                <input
                  value={desigForm.designation_code}
                  onChange={(e) => setDesigForm({ ...desigForm, designation_code: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Level number</label>
                <input
                  type="number"
                  min="1"
                  value={desigForm.level_number}
                  onChange={(e) => setDesigForm({ ...desigForm, level_number: e.target.value })}
                />
              </div>
            </div>

            <label>Designation name</label>
            <input
              value={desigForm.designation_name}
              onChange={(e) => setDesigForm({ ...desigForm, designation_name: e.target.value })}
              required
            />

            <label>Description</label>
            <textarea
              className="hr-textarea"
              value={desigForm.description}
              onChange={(e) => setDesigForm({ ...desigForm, description: e.target.value })}
              rows={3}
            />

            {desigFormError && <p className="hr-error">{desigFormError}</p>}

            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={closeDesigModal}>
                Cancel
              </button>
              <button type="submit" className="hr-btn-accent" disabled={desigSubmitting}>
                {desigSubmitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {desigConfirmTarget && (
        <div className="hr-modal-backdrop" onClick={cancelToggleDesig}>
          <div className="hr-modal hr-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>{desigConfirmTarget.is_active ? "Deactivate designation?" : "Reactivate designation?"}</h2>
            <p>
              {desigConfirmTarget.is_active
                ? `${desigConfirmTarget.designation_name} will be marked inactive and hidden from the New Employee form.`
                : `${desigConfirmTarget.designation_name} will be marked active again.`}
            </p>
            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={cancelToggleDesig}>
                Cancel
              </button>
              <button
                type="button"
                className={desigConfirmTarget.is_active ? "hr-btn-sm hr-btn-danger" : "hr-btn-accent"}
                onClick={confirmToggleDesig}
                disabled={desigConfirming}
              >
                {desigConfirming ? "Working…" : desigConfirmTarget.is_active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HRDashboard;
