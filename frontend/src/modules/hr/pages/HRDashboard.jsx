import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  KeyRound,
  CheckCircle2,
  UserCheck,
  CalendarOff,
  UserPlus,
  Award,
  X,
  ArrowUpDown,
  Building2,
  BadgeCheck,
  FileText,
} from "lucide-react";
import client from "../../../api/client";
import Pagination, { paginate } from "../../../components/Pagination";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import "../../student/styles/StudentDashboard.css";
import "../styles/HRDashboard.css";
import "../styles/Employees.css";

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
const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const tenureText = (d) => {
  if (!d) return "";
  const start = new Date(`${d}T00:00:00`);
  if (Number.isNaN(start.getTime())) return "";
  const now = new Date();
  const days = Math.floor((now - start) / 86400000);
  if (days < 0) return "Not started";
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"}`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} yr ${m} mo` : `${y} ${y === 1 ? "year" : "years"}`;
};

const matchesStatus = (row, f) =>
  f === "ACTIVE" ? row.is_active : f === "INACTIVE" ? !row.is_active : f === "NODESC" ? !(row.description || "").trim() : true;

const initialsOf = (name) => {
  const w = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return "?";
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0]).toUpperCase();
};

const chipTone = (name) => {
  let h = 0;
  for (const c of String(name || "")) h = (h * 31 + c.charCodeAt(0)) % 5;
  return "c" + h;
};

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

const isIntern = (e) => /intern/i.test(e.employment_type_name || "");

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
// view picks which list this page shows — Employees, Departments and
// Designations each have their own sidebar entry and route.
function HRDashboard({ view = "employees" }) {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // "organization" is one page with a Departments / Designations switch.
  const orgMode = view === "organization";
  const [orgTab, setOrgTab] = useState(() =>
    new URLSearchParams(window.location.search).get("tab") === "designations" ? "designations" : "departments"
  );
  const tab = orgMode ? orgTab : view; // "employees" | "departments" | "designations"
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

  // "Request login credentials" — clicking the key icon asks which
  // System Administrator to send it to (not a broadcast to all of
  // them), then creates one PermissionRequest addressed to just that
  // person. Handled entirely via the shared permission-requests API —
  // no changes to Request Access itself, that page just happens to also
  // list these as a side effect of sharing the same table.
  const [loginRequestTarget, setLoginRequestTarget] = useState(null); // the employee row
  const [loginRequestAdmins, setLoginRequestAdmins] = useState([]);
  const [loginRequestAdminsLoading, setLoginRequestAdminsLoading] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [loginRequestSubmitting, setLoginRequestSubmitting] = useState(false);
  const [loginRequestError, setLoginRequestError] = useState("");
  const [loginRequestSentIds, setLoginRequestSentIds] = useState(new Set());

  const openLoginRequestPicker = async (emp) => {
    setLoginRequestTarget(emp);
    setSelectedAdminId("");
    setLoginRequestError("");
    setLoginRequestAdminsLoading(true);
    try {
      const { data } = await client.get("/api/identity/admins/", {
        params: { category: "System Administrator" },
      });
      setLoginRequestAdmins(data);
      if (data.length === 1) setSelectedAdminId(String(data[0].user_id));
    } catch {
      setLoginRequestError("Couldn't load the list of System Administrators.");
    } finally {
      setLoginRequestAdminsLoading(false);
    }
  };

  const closeLoginRequestPicker = () => {
    setLoginRequestTarget(null);
    setLoginRequestAdmins([]);
    setSelectedAdminId("");
    setLoginRequestError("");
  };

  const sendLoginRequest = async () => {
    if (!selectedAdminId) {
      setLoginRequestError("Pick who this should go to.");
      return;
    }
    const emp = loginRequestTarget;
    setLoginRequestSubmitting(true);
    setLoginRequestError("");
    try {
      await client.post("/api/identity/permission-requests/", {
        admin_category: "System Administrator",
        target_admin_id: selectedAdminId,
        request_type: "GENERAL",
        permission_requested: `Create login credentials for ${emp.full_name} (${emp.employee_code || "no code"})`,
        reason: `${emp.full_name} is onboarded (${emp.designation_name || "no designation"}) but doesn't have a login yet.`,
      });
      setLoginRequestSentIds((prev) => new Set(prev).add(emp.employee_id));
      closeLoginRequestPicker();
    } catch (err) {
      setLoginRequestError(err.response?.data?.detail || "Couldn't send that request.");
    } finally {
      setLoginRequestSubmitting(false);
    }
  };

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
  const [deptFilter, setDeptFilter] = useState("ALL"); // ALL | ACTIVE | INACTIVE | NODESC
  const [desigFilter, setDesigFilter] = useState("ALL");

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
      const loaded = {
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
      };
      setForm(loaded);
      setOrigForm(loaded);
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

  const requestLoginCredentials = (emp) => openLoginRequestPicker(emp);

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
    return departments.filter(
      (d) =>
        matchesStatus(d, deptFilter) &&
        (!q || [d.department_name, d.description].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
    );
  }, [departments, deptSearch, deptFilter]);

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
    return designations.filter(
      (d) =>
        matchesStatus(d, desigFilter) &&
        (!q || [d.designation_name, d.description, d.designation_code].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
    );
  }, [designations, desigSearch, desigFilter]);

  const activeDepartments = useMemo(() => departments.filter((d) => d.is_active), [departments]);
  const activeDesignations = useMemo(() => designations.filter((d) => d.is_active), [designations]);
  const activeBranches = useMemo(() => branches.filter((b) => b.is_active), [branches]);

  const [typeFilter, setTypeFilter] = useState("ALL"); // ALL | FULL | INTERN
  const [sortBy, setSortBy] = useState("name_asc");
  const [selectedId, setSelectedId] = useState(null);
  const [noLoginOnly, setNoLoginOnly] = useState(false);
  const [joinedOnly, setJoinedOnly] = useState(false);
  const [origForm, setOrigForm] = useState(null); // loaded values while editing, to show what changed
  const navigate = useNavigate();
  // Today's figures (present, on leave, pending promotions) come from the HR dashboard API.
  const [todayStats, setTodayStats] = useState(null);
  useEffect(() => {
    client.get("/api/hr/dashboard/")
      .then(({ data }) => setTodayStats({
        present: data.kpis.present_today,
        onLeave: data.kpis.on_leave_today,
        promotions: data.pending_promotions.length,
        activeTotal: data.kpis.total_active_employees,
      }))
      .catch(() => setTodayStats(null));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters, typeFilter, sortBy, noLoginOnly, joinedOnly]);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = employees.filter((emp) => {
      if (noLoginOnly && emp.has_login) return false;
      if (joinedOnly && !(emp.joining_date || "").startsWith(thisMonth)) return false;
      if (typeFilter === "INTERN" && !isIntern(emp)) return false;
      if (typeFilter === "FULL" && !/full/i.test(emp.employment_type_name || "")) return false;
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
    const byName = (a, b) => (a.full_name || "").localeCompare(b.full_name || "");
    const sorters = {
      name_asc: byName,
      name_desc: (a, b) => byName(b, a),
      joined_new: (a, b) => (b.joining_date || "").localeCompare(a.joining_date || "") || byName(a, b),
      joined_old: (a, b) => (a.joining_date || "").localeCompare(b.joining_date || "") || byName(a, b),
      department: (a, b) => (a.department_name || "zzz").localeCompare(b.department_name || "zzz") || byName(a, b),
    };
    return [...list].sort(sorters[sortBy] || byName);
  }, [employees, search, filters, typeFilter, sortBy, noLoginOnly, joinedOnly, thisMonth]);

  const empCounts = useMemo(
    () => ({
      total: employees.length,
      active: employees.filter((e) => e.status === "ACTIVE").length,
      interns: employees.filter(isIntern).length,
      inactive: employees.filter((e) => e.status !== "ACTIVE").length,
      noLogin: employees.filter((e) => !e.has_login).length,
      joined: employees.filter((e) => (e.joining_date || "").startsWith(thisMonth)).length,
    }),
    [employees, thisMonth]
  );
  const activeCard = joinedOnly
    ? "JOINED"
    : noLoginOnly
    ? "NOLOGIN"
    : filters.status === "ACTIVE"
    ? "ACTIVE"
    : filters.status === "INACTIVE"
    ? "INACTIVE"
    : typeFilter === "INTERN"
    ? "INTERN"
    : "ALL";
  const pickCard = (key) => {
    setPage(1);
    setNoLoginOnly(key === "NOLOGIN");
    setJoinedOnly(key === "JOINED");
    if (key === "JOINED") { setFilters({ ...filters, status: "" }); setTypeFilter("ALL"); }
    if (key === "NOLOGIN") { setFilters({ ...filters, status: "" }); setTypeFilter("ALL"); }
    if (key === "ALL") { setFilters({ ...filters, status: "" }); setTypeFilter("ALL"); }
    if (key === "ACTIVE") { setFilters({ ...filters, status: "ACTIVE" }); setTypeFilter("ALL"); }
    if (key === "INACTIVE") { setFilters({ ...filters, status: "INACTIVE" }); setTypeFilter("ALL"); }
    if (key === "INTERN") { setFilters({ ...filters, status: "" }); setTypeFilter("INTERN"); }
  };
  const selectedEmp = employees.find((e) => e.employee_id === selectedId) || null;


  const formRequired = [form.first_name, form.employee_code, form.employment_type_id, form.designation_id, form.joining_date];
  const formDone = formRequired.filter((v) => String(v || "").trim() !== "").length;
  const formDesignation = designations.find((d) => String(d.designation_id) === String(form.designation_id))?.designation_name;
  const formType = employmentTypes.find((t) => String(t.employment_type_id) === String(form.employment_type_id))?.employment_type_name;
  const formDept = departments.find((d) => String(d.department_id) === String(form.department_id))?.department_name;

  const isChanged = (k) => !!editingEmployee && !!origForm && String(form[k] ?? "") !== String(origForm[k] ?? "");
  const chg = (k) => (isChanged(k) ? "emp-changed" : "");
  const wasLabel = (k) => {
    const v = origForm ? origForm[k] : "";
    if (v === "" || v == null) return "empty";
    if (k === "designation_id") return designations.find((d) => String(d.designation_id) === String(v))?.designation_name || v;
    if (k === "employment_type_id") return employmentTypes.find((t) => String(t.employment_type_id) === String(v))?.employment_type_name || v;
    if (k === "department_id") return departments.find((d) => String(d.department_id) === String(v))?.department_name || v;
    if (k === "branch_id") return branches.find((b) => String(b.branch_id) === String(v))?.branch_name || v;
    return v;
  };
  const was = (k) => (isChanged(k) ? <span className="emp-form-was">Was {wasLabel(k)}</span> : null);
  const changeCount = editingEmployee && origForm ? Object.keys(origForm).filter(isChanged).length : 0;
  const viewHasLogin = viewEmployee ? !!employees.find((e) => e.employee_id === viewEmployee.employee_id)?.has_login : false;

  const isDesig = tab === "designations";
  const orgRows = isDesig ? designations : departments;
  const orgFilter = isDesig ? desigFilter : deptFilter;
  const pickOrgFilter = (f) => {
    if (isDesig) {
      setDesigFilter(orgFilter === f ? "ALL" : f);
      setDesigPage(1);
    } else {
      setDeptFilter(orgFilter === f ? "ALL" : f);
      setDeptPage(1);
    }
  };
  const orgCards = [
    { key: "ALL", label: isDesig ? "Designations" : "Departments", value: orgRows.length, tone: "blue", Icon: isDesig ? BadgeCheck : Building2 },
    { key: "ACTIVE", label: "Active", value: orgRows.filter((r) => r.is_active).length, tone: "green", Icon: CheckCircle2 },
    { key: "INACTIVE", label: "Inactive", value: orgRows.filter((r) => !r.is_active).length, tone: "amber", Icon: Ban },
    { key: "NODESC", label: "No description", value: orgRows.filter((r) => !(r.description || "").trim()).length, tone: "violet", Icon: FileText },
  ];

  const handleExport = () => downloadCsv(toCsv(filteredEmployees), "employees.csv");

  return (
    <div className={"hr-screen" + (orgMode ? " org-page" : "")}>
      <div className="hr-head">
        <div>
          <h1>{orgMode ? "Organization" : tab === "departments" ? "Departments" : tab === "designations" ? "Designations" : "Employees"}</h1>
          <p>
            {orgMode
              ? "Manage departments and designations in one place."
              : tab === "departments"
              ? "Manage the departments your people belong to."
              : tab === "designations"
              ? "Manage job titles and designations."
              : "Manage your people, teams, and employment details."}
          </p>
        </div>
        {tab === "employees" && (
          <button type="button" className="hr-btn-accent emp-new-btn" onClick={openCreate}>
            <Plus size={16} /> New employee
          </button>
        )}
      </div>

      {error && <p className="hr-error">{error}</p>}

      {tab === "employees" && (
        <div className="emp-mini-row org-stats">
          <button type="button" className="emp-mini tone-green" onClick={() => navigate("/hr/attendance")}>
            <span className="emp-mini-icon"><UserCheck size={15} /></span>
            <span className="emp-mini-text">
              <b>{todayStats ? todayStats.present : "-"}{todayStats ? <i> / {todayStats.activeTotal}</i> : null}</b>
              <span>Present today</span>
            </span>
          </button>
          <button type="button" className="emp-mini tone-amber" onClick={() => navigate("/hr/attendance")}>
            <span className="emp-mini-icon"><CalendarOff size={15} /></span>
            <span className="emp-mini-text">
              <b>{todayStats ? todayStats.onLeave : "-"}</b>
              <span>On leave today</span>
            </span>
          </button>
          <button
            type="button"
            className={`emp-mini tone-blue${activeCard === "JOINED" ? " selected" : ""}`}
            onClick={() => pickCard(activeCard === "JOINED" ? "ALL" : "JOINED")}
          >
            <span className="emp-mini-icon"><UserPlus size={15} /></span>
            <span className="emp-mini-text">
              <b>{empCounts.joined}</b>
              <span>Joined this month</span>
            </span>
          </button>
          <button type="button" className="emp-mini tone-violet" onClick={() => navigate("/hr/promotions")}>
            <span className="emp-mini-icon"><Award size={15} /></span>
            <span className="emp-mini-text">
              <b>{todayStats ? todayStats.promotions : "-"}</b>
              <span>Pending promotions</span>
            </span>
          </button>
        </div>
      )}

      {tab === "employees" && (
        <div className={"emp-layout" + (selectedEmp ? " has-side" : "")}>
        <div className="hr-panel emp-main">
          <div className="hr-toolbar">
            <div className="hr-search">
              <Search size={15} />
              <input
                placeholder="Search name, code, department"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="emp-seg" role="group" aria-label="Employment type">
              {[["ALL", "All types"], ["FULL", "Full time"], ["INTERN", "Intern"]].map(([key, label]) => (
                <button key={key} type="button" className={typeFilter === key ? "active" : ""} onClick={() => setTypeFilter(key)}>
                  {label}
                </button>
              ))}
            </div>
            <label className="emp-sort">
              <ArrowUpDown size={14} />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort by">
                <option value="name_asc">Name A to Z</option>
                <option value="name_desc">Name Z to A</option>
                <option value="joined_new">Newest joined</option>
                <option value="joined_old">Oldest joined</option>
                <option value="department">Department</option>
              </select>
            </label>
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
            <div className="emp-skeleton" aria-label="Loading employees">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="emp-skel-row" />)}
            </div>
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
                      <th>Type</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginate(filteredEmployees, page, 6).map((emp) => {
                      return (
                        <tr
                          key={emp.employee_id}
                          className={"emp-row" + (selectedId === emp.employee_id ? " selected" : "")}
                          onClick={() => setSelectedId(emp.employee_id)}
                        >
                          <td>
                            <div className="hr-cell-user">
                              <EmployeeAvatar personId={emp.person_id} size={28} version={avatarVersion} />
                              <div>
                                <div className="hr-name">
                                  {emp.full_name}
                                  {!emp.has_login && <span className="emp-tag">No login</span>}
                                </div>
                                <div className="hr-sub">
                                  {emp.employee_code ? `${emp.employee_code} · ` : ""}
                                  {emp.designation_name || "—"}
                                </div>
                              </div>
                            </div>
                          </td>
                          {columns.employee_code && <td className="hr-mono">{emp.employee_code}</td>}
                          {columns.email && <td>{emp.email || "—"}</td>}
                          {columns.phone && <td>{emp.phone || "—"}</td>}
                          <td>
                            {emp.department_name ? (
                              <span className="emp-dept">{emp.department_name}</span>
                            ) : (
                              <span className="emp-dept warn">Not set</span>
                            )}
                          </td>
                          <td>
                            {isIntern(emp) ? (
                              <span className="hr-pill warn">Intern</span>
                            ) : (
                              emp.employment_type_name || "—"
                            )}
                          </td>
                          <td className="hr-mono">{emp.joining_date || "—"}</td>
                          <td>
                            <span className={"hr-pill " + (emp.status === "ACTIVE" ? "on" : "off")}>
                              {emp.status === "ACTIVE" ? "Active" : emp.status}
                            </span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
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
                              {!emp.has_login && (
                                <button
                                  type="button"
                                  className={
                                    "hr-icon-btn" +
                                    (loginRequestSentIds.has(emp.employee_id) ? " sent" : " attention")
                                  }
                                  title={
                                    loginRequestSentIds.has(emp.employee_id)
                                      ? "Request sent"
                                      : "Request login credentials"
                                  }
                                  aria-label={`Request login credentials for ${emp.full_name}`}
                                  onClick={() => requestLoginCredentials(emp)}
                                >
                                  {loginRequestSentIds.has(emp.employee_id) ? (
                                    <CheckCircle2 size={15} />
                                  ) : (
                                    <KeyRound size={15} />
                                  )}
                                </button>
                              )}
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
              <div className="emp-result">
                Showing {Math.min(filteredEmployees.length, (page - 1) * 6 + 1)}–{Math.min(filteredEmployees.length, page * 6)} of {filteredEmployees.length}
                {filteredEmployees.length !== employees.length ? ` (${employees.length} total)` : ""}
              </div>
              <Pagination page={page} totalItems={filteredEmployees.length} onPageChange={setPage} pageSize={6} />
            </>
          )}
        </div>

        {selectedEmp && (
          <aside className="emp-side" aria-label="Employee profile">
            <button type="button" className="emp-side-x" onClick={() => setSelectedId(null)} aria-label="Close profile">
              <X size={15} />
            </button>
            <div className="emp-side-head">
              <EmployeeAvatar personId={selectedEmp.person_id} size={56} version={avatarVersion} />
              <strong>{selectedEmp.full_name}</strong>
              <span>{selectedEmp.employee_code ? `${selectedEmp.employee_code} · ` : ""}{selectedEmp.designation_name || "No designation"}</span>
              <span className={"hr-pill " + (selectedEmp.status === "ACTIVE" ? "on" : "off")}>
                {selectedEmp.status === "ACTIVE" ? "Active" : selectedEmp.status}
              </span>
            </div>
            <dl className="emp-side-list">
              <dt>Department</dt><dd>{selectedEmp.department_name || "Not set"}</dd>
              <dt>Type</dt><dd>{selectedEmp.employment_type_name || "—"}</dd>
              <dt>Branch</dt><dd>{selectedEmp.branch_name || "—"}</dd>
              <dt>Joined</dt><dd>{selectedEmp.joining_date || "—"}</dd>
              <dt>Email</dt><dd>{selectedEmp.email || "—"}</dd>
              <dt>Phone</dt><dd>{selectedEmp.phone || "—"}</dd>
              <dt>Login</dt><dd>{selectedEmp.has_login ? "Has a login" : "No login yet"}</dd>
            </dl>
            <div className="emp-side-actions">
              <button type="button" className="hr-btn-sm" onClick={() => openView(selectedEmp)}>
                <Eye size={14} /> View
              </button>
              <button type="button" className="hr-btn-accent hr-btn-accent-sm" onClick={() => openEdit(selectedEmp)}>
                <SquarePen size={14} /> Edit
              </button>
            </div>
          </aside>
        )}
        </div>
      )}

      {orgMode && (
        <>
          <div className="hr-tabs">
            <button type="button" className={"hr-tab" + (!isDesig ? " active" : "")} onClick={() => setOrgTab("departments")}>
              <Building2 size={15} /> Departments <span className="hr-tab-count">{departments.length}</span>
            </button>
            <button type="button" className={"hr-tab" + (isDesig ? " active" : "")} onClick={() => setOrgTab("designations")}>
              <BadgeCheck size={15} /> Designations <span className="hr-tab-count">{designations.length}</span>
            </button>
          </div>
          <div className="emp-mini-row org-stats">
            {orgCards.map(({ key, label, value, tone, Icon }) => (
              <button
                key={key}
                type="button"
                className={`emp-mini tone-${tone}${orgFilter === key && key !== "ALL" ? " selected" : ""}`}
                onClick={() => (key === "ALL" ? (isDesig ? setDesigFilter("ALL") : setDeptFilter("ALL")) : pickOrgFilter(key))}
              >
                <span className="emp-mini-icon"><Icon size={15} /></span>
                <span className="emp-mini-text">
                  <b>{loading ? "-" : value}</b>
                  <span>{label}</span>
                </span>
              </button>
            ))}
          </div>
        </>
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
                : "No departments match your search or filter."}
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
                      <td className="hr-name">
                        <span className="org-name"><span className={"org-chip " + chipTone(d.department_name)}>{initialsOf(d.department_name)}</span>{d.department_name}</span>
                      </td>
                      <td className="hr-sub">{d.description || <span className="org-nodesc">No description</span>}</td>
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
                : "No designations match your search or filter."}
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
                      <td className="hr-name">
                        <span className="org-name"><span className={"org-chip " + chipTone(d.designation_name)}>{initialsOf(d.designation_name)}</span>{d.designation_name}</span>
                      </td>
                      <td className="hr-sub">{d.description || <span className="org-nodesc">No description</span>}</td>
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
          <form className="hr-modal hr-modal-wide emp-form" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <button type="button" className="hr-modal-x" onClick={closeModal} aria-label="Close">
              ✕
            </button>
            <h2>{editingEmployee ? "Edit employee" : "New employee"}</h2>
            <p className="hr-hint">
              {editingEmployee
                ? `Updating ${editingEmployee.full_name || "this employee"}${editingEmployee.employee_code ? ` · ${editingEmployee.employee_code}` : ""}`
                : "Add a person to Vetri IT Systems. Fields marked * are required."}
            </p>
            <div className="emp-form-bar"><i style={{ width: `${(formDone / formRequired.length) * 100}%` }} /></div>

            <div className="emp-form-grid">
              <div className="emp-form-main">
                <section className="emp-form-sec">
                  <h3><span className="emp-step">1</span>Personal details</h3>
                  <div className="hr-form-row">
                    <div className={chg("first_name")}>
                      <label>First name <u>*</u></label>
                      <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                      {was("first_name")}
                    </div>
                    <div className={chg("last_name")}>
                      <label>Last name</label>
                      <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                      {was("last_name")}
                    </div>
                  </div>
                  <div className="hr-form-row">
                    <div className={chg("email")}>
                      <label>Email</label>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                      {was("email")}
                    </div>
                    <div className={chg("phone")}>
                      <label>Phone</label>
                      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                      {was("phone")}
                    </div>
                  </div>
                  <div className="hr-form-row">
                    <div className={chg("date_of_birth")}>
                      <label>Date of birth</label>
                      <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
                      {was("date_of_birth")}
                    </div>
                    <div className={chg("gender")}>
                      <label>Gender</label>
                      <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                        <option value="">Select…</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      {was("gender")}
                    </div>
                  </div>
                </section>

                <section className="emp-form-sec">
                  <h3><span className="emp-step">2</span>Job details</h3>
                  <div className="hr-form-row">
                    <div className={chg("employee_code")}>
                      <label>Employee code <u>*</u></label>
                      <input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} required />
                      {!editingEmployee && <span className="emp-form-note">Suggested next code. You can edit it.</span>}
                      {was("employee_code")}
                    </div>
                    <div className={chg("employment_type_id")}>
                      <label>Employment type <u>*</u></label>
                      <select value={form.employment_type_id} onChange={(e) => setForm({ ...form, employment_type_id: e.target.value })} required>
                        <option value="">Select…</option>
                        {employmentTypes.map((t) => (
                          <option key={t.employment_type_id} value={t.employment_type_id}>{t.employment_type_name}</option>
                        ))}
                      </select>
                      {was("employment_type_id")}
                    </div>
                  </div>
                  <div className="hr-form-row">
                    <div className={chg("department_id")}>
                      <label>Department</label>
                      <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                        <option value="">Unassigned</option>
                        {activeDepartments.map((d) => (
                          <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                        ))}
                      </select>
                      {was("department_id")}
                    </div>
                    <div className={chg("designation_id")}>
                      <label>Designation <u>*</u></label>
                      <select value={form.designation_id} onChange={(e) => setForm({ ...form, designation_id: e.target.value })} required>
                        <option value="">Select…</option>
                        {activeDesignations.map((d) => (
                          <option key={d.designation_id} value={d.designation_id}>{d.designation_name}</option>
                        ))}
                      </select>
                      {was("designation_id")}
                    </div>
                  </div>
                  <div className={chg("branch_id")}>
                    <label>Branch</label>
                    <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                      <option value="">Unassigned (WFH / Intern / Student)</option>
                      {activeBranches.map((b) => (
                        <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                      ))}
                    </select>
                    {was("branch_id")}
                  </div>
                </section>

                <section className="emp-form-sec">
                  <h3><span className="emp-step">3</span>Dates</h3>
                  <div className="hr-form-row">
                    <div className={chg("joining_date")}>
                      <label>Joining date <u>*</u></label>
                      <input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} required />
                      {was("joining_date")}
                    </div>
                    <div className={chg("confirmation_date")}>
                      <label>Confirmation date</label>
                      <input type="date" value={form.confirmation_date} onChange={(e) => setForm({ ...form, confirmation_date: e.target.value })} />
                      {was("confirmation_date")}
                    </div>
                  </div>
                </section>
              </div>

              <aside className="emp-form-side">
                <div className="emp-form-photo">
                  {avatarPreview ? (
                    <img className="hr-avatar hr-avatar-photo" style={{ width: 64, height: 64 }} src={avatarPreview} alt="" />
                  ) : editingEmployee ? (
                    <EmployeeAvatar personId={editingEmployee.person_id} size={64} version={avatarVersion} />
                  ) : (
                    <div className="hr-avatar hr-avatar-fallback" style={{ width: 64, height: 64 }}>
                      <CircleUserRound size={44} />
                    </div>
                  )}
                </div>
                <label className="hr-btn-sm hr-avatar-picker-btn">
                  <Camera size={14} />
                  {avatarPreview || editingEmployee ? "Change photo" : "Add photo"}
                  <input type="file" accept="image/*" onChange={pickAvatarFile} hidden />
                </label>
                <strong>{`${form.first_name} ${form.last_name}`.trim() || "New employee"}</strong>
                <span className="emp-form-sub">{formDesignation || "Designation not set"}</span>
                <div className="emp-form-tags">
                  {formType && <span className="emp-tag-blue">{formType}</span>}
                  {formDept && <span className="emp-tag-green">{formDept}</span>}
                </div>
                <dl>
                  <dt>Code</dt><dd>{form.employee_code || "-"}</dd>
                  <dt>Joins</dt><dd>{form.joining_date || "Not set"}</dd>
                </dl>
              </aside>
            </div>

            {formError && <p className="hr-error">{formError}</p>}

            <div className="hr-modal-actions emp-form-foot">
              {editingEmployee ? (
                <span className="emp-form-changes">{changeCount === 0 ? "No changes yet" : `${changeCount} ${changeCount === 1 ? "change" : "changes"}`}</span>
              ) : (
                <span className="emp-form-count">{formDone} of {formRequired.length} required fields done</span>
              )}
              <button type="button" className="hr-btn-sm" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="hr-btn-accent" disabled={submitting}>
                {submitting ? "Saving…" : editingEmployee ? "Save changes" : "Create employee"}
              </button>
            </div>
          </form>
        </div>
      )}

      {viewEmployee && (
        <div className="hr-modal-backdrop" onClick={closeView}>
          <div className="hr-modal hr-modal-wide emp-view" onClick={(e) => e.stopPropagation()}>
            <div className="emp-view-band">
              <button type="button" className="emp-view-x" onClick={closeView} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="emp-view-id">
              <div className="emp-view-photo">
                <EmployeeAvatar personId={viewEmployee.person_id} size={72} version={avatarVersion} />
                <label className="emp-view-cam" title="Change photo" aria-label="Change photo">
                  <Camera size={12} />
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} hidden />
                </label>
              </div>
              <div className="emp-view-name">
                <h2>{viewEmployee.full_name}</h2>
                <p>{[viewEmployee.designation_name, viewEmployee.employee_code].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="emp-view-tags">
                <span className={"emp-vtag " + (viewEmployee.status === "ACTIVE" ? "green" : "grey")}>
                  {viewEmployee.status === "ACTIVE" ? "Active" : viewEmployee.status}
                </span>
                {viewEmployee.employment_type_name && <span className="emp-vtag blue">{viewEmployee.employment_type_name}</span>}
                <span className={"emp-vtag " + (viewHasLogin ? "amber" : "grey")}>{viewHasLogin ? "Has login" : "No login yet"}</span>
              </div>
            </div>

            {avatarUploading && <p className="hr-hint">Uploading photo…</p>}
            {avatarError && <p className="hr-error">{avatarError}</p>}
            {viewError && <p className="hr-error">{viewError}</p>}

            {viewLoading ? (
              <p className="hr-empty">Loading…</p>
            ) : (
              <>
                <div className="emp-view-facts">
                  <div><small>Joined</small><b>{fmtDate(viewEmployee.joining_date) || "Not set"}</b></div>
                  <div><small>Tenure</small><b>{tenureText(viewEmployee.joining_date) || "Not set"}</b></div>
                  <div><small>Department</small><b>{viewEmployee.department_name || "Not set"}</b></div>
                </div>

                <section className="emp-view-sec">
                  <h3><span className="emp-step">1</span>Personal details</h3>
                  <div className="emp-view-grid">
                    <div><small>Email</small><span>{viewEmployee.email || <em>Not set</em>}</span></div>
                    <div><small>Phone</small><span>{viewEmployee.phone || <em>Not set</em>}</span></div>
                    <div><small>Date of birth</small><span>{fmtDate(viewEmployee.date_of_birth) || <em>Not set</em>}</span></div>
                    <div><small>Gender</small><span>{viewEmployee.gender || <em>Not set</em>}</span></div>
                  </div>
                </section>

                <section className="emp-view-sec">
                  <h3><span className="emp-step">2</span>Job details</h3>
                  <div className="emp-view-grid">
                    <div><small>Designation</small><span>{viewEmployee.designation_name || <em>Not set</em>}</span></div>
                    <div><small>Employment type</small><span>{viewEmployee.employment_type_name || <em>Not set</em>}</span></div>
                    <div><small>Branch</small><span>{viewEmployee.branch_name || <em>Unassigned</em>}</span></div>
                    <div><small>Employee code</small><span>{viewEmployee.employee_code || <em>Not set</em>}</span></div>
                  </div>
                </section>

                <section className="emp-view-sec">
                  <h3><span className="emp-step">3</span>Dates</h3>
                  <div className="emp-view-grid">
                    <div><small>Joining date</small><span>{fmtDate(viewEmployee.joining_date) || <em>Not set</em>}</span></div>
                    <div><small>Confirmation date</small><span>{fmtDate(viewEmployee.confirmation_date) || <em>Not set</em>}</span></div>
                  </div>
                </section>
              </>
            )}

            <div className="hr-modal-actions emp-view-foot">
              <button
                type="button"
                className={"hr-btn-sm " + (viewEmployee.status === "ACTIVE" ? "emp-btn-danger" : "")}
                onClick={() => { const e = viewEmployee; closeView(); requestToggleActive(e); }}
              >
                {viewEmployee.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
              </button>
              <span className="emp-view-spacer" />
              <button type="button" className="hr-btn-sm" onClick={closeView}>
                Close
              </button>
              <button type="button" className="hr-btn-accent" onClick={() => { const e = viewEmployee; closeView(); openEdit(e); }}>
                <SquarePen size={14} /> Edit employee
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
          <form className="hr-modal org-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleDeptSubmit}>
            <button type="button" className="hr-modal-x org-modal-x" onClick={closeDeptModal} aria-label="Close">
              ✕
            </button>
            <div className="org-modal-head">
              <span className="org-modal-ico"><Building2 size={19} /></span>
              <div>
                <h2>{editingDept ? "Edit department" : "New department"}</h2>
                <p>{editingDept ? `Updating ${editingDept.department_name}` : "Add a team your people can belong to."}</p>
              </div>
            </div>

            <div className="org-modal-body">
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
                placeholder="What does this team do?"
                rows={3}
              />

              {deptFormError && <p className="hr-error">{deptFormError}</p>}
            </div>

            <div className="hr-modal-actions org-modal-foot">
              <button type="button" className="hr-btn-sm" onClick={closeDeptModal}>
                Cancel
              </button>
              <button type="submit" className="hr-btn-accent" disabled={deptSubmitting}>
                {deptSubmitting ? "Saving…" : editingDept ? "Save changes" : "Create department"}
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
          <form className="hr-modal org-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleDesigSubmit}>
            <button type="button" className="hr-modal-x org-modal-x" onClick={closeDesigModal} aria-label="Close">
              ✕
            </button>
            <div className="org-modal-head">
              <span className="org-modal-ico"><BadgeCheck size={19} /></span>
              <div>
                <h2>{editingDesig ? "Edit designation" : "New designation"}</h2>
                <p>{editingDesig ? `Updating ${editingDesig.designation_name}` : "Add a job title with its level."}</p>
              </div>
            </div>

            <div className="org-modal-body">
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
                placeholder="What does this role do?"
                rows={3}
              />

              {desigFormError && <p className="hr-error">{desigFormError}</p>}
            </div>

            <div className="hr-modal-actions org-modal-foot">
              <button type="button" className="hr-btn-sm" onClick={closeDesigModal}>
                Cancel
              </button>
              <button type="submit" className="hr-btn-accent" disabled={desigSubmitting}>
                {desigSubmitting ? "Saving…" : editingDesig ? "Save changes" : "Create designation"}
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

      {loginRequestTarget && (
        <div className="hr-modal-backdrop" onClick={closeLoginRequestPicker}>
          <div className="hr-modal hr-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>Request login credentials</h2>
            <p>
              Send to which System Administrator, for <strong>{loginRequestTarget.full_name}</strong>?
            </p>

            {loginRequestAdminsLoading ? (
              <p className="hr-empty">Loading…</p>
            ) : loginRequestAdmins.length === 0 ? (
              <p className="hr-empty">No active System Administrator found.</p>
            ) : (
              <div className="hr-admin-picker">
                {loginRequestAdmins.map((admin) => (
                  <label
                    key={admin.user_id}
                    className={
                      "hr-admin-picker-row" +
                      (String(selectedAdminId) === String(admin.user_id) ? " selected" : "")
                    }
                  >
                    <input
                      type="radio"
                      name="login-request-admin"
                      value={admin.user_id}
                      checked={String(selectedAdminId) === String(admin.user_id)}
                      onChange={(e) => setSelectedAdminId(e.target.value)}
                    />
                    <span>{admin.full_name}</span>
                  </label>
                ))}
              </div>
            )}

            {loginRequestError && <p className="hr-error">{loginRequestError}</p>}

            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={closeLoginRequestPicker}>
                Cancel
              </button>
              <button
                type="button"
                className="hr-btn-accent"
                onClick={sendLoginRequest}
                disabled={loginRequestSubmitting || !selectedAdminId}
              >
                {loginRequestSubmitting ? "Sending…" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HRDashboard;
