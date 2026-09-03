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
} from "lucide-react";
import client from "../../../api/client";
import Pagination, { paginate } from "../../../components/Pagination";
import "../styles/HRDashboard.css";

const EMPTY_FILTERS = {
  department_id: "",
  designation_id: "",
  employment_type_id: "",
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
  joining_date: "",
  confirmation_date: "",
};

// No column/table stores this URL anywhere — it's fully deterministic
// from person_id, built the same way on every render. A photo upload
// just overwrites this same Cloudinary public_id; if nothing was ever
// uploaded, the image 404s and the <img onError> swap to a default
// silhouette icon (no DB flag needed to know "has a photo or not").
const CLOUDINARY_CLOUD_NAME = "cikqryjt";

function avatarUrl(personId, version) {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,c_fill,g_face,w_96,h_96/person_avatars/person_${personId}?v=${version}`;
}

// Renders the real photo when one loads; falls back to a generic
// silhouette icon (no name-based colors) the moment it 404s, matching
// the "default profile picture" look for anyone without an upload yet.
function EmployeeAvatar({ personId, size = 32, version }) {
  const [failed, setFailed] = useState(false);

  if (!personId || failed) {
    return (
      <div className="hr-avatar hr-avatar-fallback" style={{ width: size, height: size }}>
        <CircleUserRound size={Math.round(size * 0.72)} />
      </div>
    );
  }

  return (
    <img
      className="hr-avatar hr-avatar-photo"
      style={{ width: size, height: size }}
      src={avatarUrl(personId, version)}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}

function toCsv(rows) {
  const header = ["Name", "Email", "Code", "Designation", "Department", "Employment Type", "Joining Date", "Status"];
  const lines = rows.map((r) =>
    [r.full_name, r.email, r.employee_code, r.designation_name, r.department_name, r.employment_type_name, r.joining_date, r.status]
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
      const [empRes, deptRes, desRes, typeRes] = await Promise.all([
        client.get("/api/hr/employees/"),
        client.get("/api/hr/departments/"),
        client.get("/api/hr/designations/"),
        client.get("/api/hr/employment-types/"),
      ]);
      setEmployees(empRes.data);
      setDepartments(deptRes.data);
      setDesignations(desRes.data);
      setEmploymentTypes(typeRes.data);
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
    setForm(EMPTY_FORM);
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
                      <th>Employment Type</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginate(filteredEmployees, page).map((emp) => {
                      return (
                        <tr key={emp.employee_id}>
                          <td>
                            <div className="hr-cell-user">
                              <EmployeeAvatar personId={emp.person_id} size={28} version={avatarVersion} />
                              <div>
                                <div className="hr-name">{emp.full_name}</div>
                                <div className="hr-sub">{emp.designation_name || "—"}</div>
                              </div>
                            </div>
                          </td>
                          {columns.employee_code && <td className="hr-mono">{emp.employee_code}</td>}
                          {columns.email && <td>{emp.email || "—"}</td>}
                          {columns.phone && <td>{emp.phone || "—"}</td>}
                          <td>{emp.department_name || "—"}</td>
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
              <Pagination page={page} totalItems={filteredEmployees.length} onPageChange={setPage} />
            </>
          )}
        </div>
      )}

      {tab === "departments" && (
        <div className="hr-panel">
          {loading ? (
            <p className="hr-empty">Loading…</p>
          ) : departments.length === 0 ? (
            <p className="hr-empty">No departments found.</p>
          ) : (
            <div className="hr-table-scroll">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Description</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.department_id}>
                      <td className="hr-name">{d.department_name}</td>
                      <td className="hr-sub">{d.description || "—"}</td>
                      <td>
                        <span className={"hr-pill " + (d.is_active ? "on" : "off")}>
                          {d.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "designations" && (
        <div className="hr-panel">
          {loading ? (
            <p className="hr-empty">Loading…</p>
          ) : designations.length === 0 ? (
            <p className="hr-empty">No designations found.</p>
          ) : (
            <div className="hr-table-scroll">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Designation</th>
                    <th>Description</th>
                    <th>Level</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {designations.map((d) => (
                    <tr key={d.designation_id}>
                      <td className="hr-name">{d.designation_name}</td>
                      <td className="hr-sub">{d.description || "—"}</td>
                      <td className="hr-mono">{d.level_number ?? "—"}</td>
                      <td>
                        <span className={"hr-pill " + (d.is_active ? "on" : "off")}>
                          {d.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="hr-modal-backdrop" onClick={closeModal}>
          <form className="hr-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
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
                  {designations.map((d) => (
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
              {departments.map((d) => (
                <option key={d.department_id} value={d.department_id}>
                  {d.department_name}
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
          <div className="hr-modal" onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}

export default HRDashboard;
