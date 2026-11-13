import { useEffect, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, Ban, Check, Copy, Eye, EyeOff, KeyRound, Lock, MailOpen,
  MoreHorizontal, Pencil, RotateCcw, Search, UserCheck, UserPlus, UserX,
  Users, X,
} from "lucide-react";
import client from "../../../api/client";
import Pagination, { paginate } from "../../../components/Pagination";
import "../../student/styles/StudentDashboard.css";
import "../../hr/styles/Attendance.css";
import "../styles/UserAccounts.css";

// Exactly 8 characters: at least one capital letter, one digit, one
// special (non-alphanumeric) character.
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8}$/;
const PASSWORD_HINT =
  "Exactly 8 characters, with at least one capital letter, one number, and one special character.";

// "Role: ... / Designation: ..." summary shown alongside a name in the
// Edit and Permissions popups — role is the RBAC grant, designation is
// HR's job title, and the two can share a name (e.g. both called
// "Manager") without being the same thing.
function IdentityLine({ user }) {
  return (
    <span className="ua-modal-identity-sub">
      <span className="ua-modal-identity-field">
        <IconUser />
        <strong>Role:</strong> {(user.roles || []).join(", ") || "No role assigned"}
      </span>
      {user.designation && (
        <span className="ua-modal-identity-field">
          <IconBriefcase />
          <strong>Designation:</strong> {user.designation}
        </span>
      )}
    </span>
  );
}

// Small line-style icons, inline so the popup doesn't need an icon
// library dependency for a handful of glyphs.
function svgProps(extra) {
  return { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...extra };
}

function IconShield() {
  return (
    <svg {...svgProps({ width: 20, height: 20 })}>
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg {...svgProps({ width: 14, height: 14 })}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg {...svgProps({ width: 14, height: 14 })}>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg {...svgProps({ width: 18, height: 18 })}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="8" x2="12" y2="8.01" />
    </svg>
  );
}

function IconChevron({ collapsed }) {
  return (
    <svg {...svgProps({ width: 16, height: 16 })} style={{ transform: collapsed ? "rotate(180deg)" : "none" }}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg {...svgProps({ width: 13, height: 13 })}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg {...svgProps({ width: 18, height: 18, stroke: "none" })}>
      <circle cx="12" cy="12" r="10" fill="#1f6837" />
      <polyline points="7 12.5 10.5 16 17 9" fill="none" stroke="#fff" strokeWidth={2.4} />
    </svg>
  );
}

function IconRestrictedCircle() {
  return (
    <svg {...svgProps({ width: 18, height: 18, stroke: "none" })}>
      <circle cx="12" cy="12" r="10" fill="#c13b34" />
      <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
      <line x1="15.5" y1="8.5" x2="8.5" y2="15.5" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg {...svgProps({ width: 16, height: 16 })}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg {...svgProps({ width: 16, height: 16 })}>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg {...svgProps({ width: 16, height: 16 })}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3 3-5 7-5s7 2 7 5" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M16 12c2.8.4 5 2.2 5 5" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg {...svgProps({ width: 16, height: 16 })}>
      <line x1="5" y1="20" x2="5" y2="12" />
      <line x1="12" y1="20" x2="12" y2="7" />
      <line x1="19" y1="20" x2="19" y2="15" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg {...svgProps({ width: 16, height: 16 })}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.7a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.3a7 7 0 0 0-2 1.2l-2.4-.7-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.7a7 7 0 0 0 2 1.2L10 21h4l.5-2.3a7 7 0 0 0 2-1.2l2.4.7 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
    </svg>
  );
}

function IconCap() {
  return (
    <svg {...svgProps({ width: 16, height: 16 })}>
      <path d="M2 9l10-5 10 5-10 5-10-5z" />
      <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
    </svg>
  );
}

const GROUP_ICONS = {
  AUDIT: IconClipboardIcon,
  DOCUMENT: IconDocument,
  EMPLOYEE: IconPeople,
  PROJECT: IconFolder,
  REPORT: IconChart,
  SYSTEM: IconGear,
  TRAINING: IconCap,
  USER: IconUser,
};

function IconClipboardIcon() {
  return (
    <svg {...svgProps({ width: 16, height: 16 })}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="16" y2="15" />
    </svg>
  );
}

function groupIcon(name) {
  const Icon = GROUP_ICONS[name] || IconFolder;
  return <Icon />;
}

const EMPTY_FORM = {
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  is_active: true,
  person_id: "",
  work_login_time: "",
  work_logout_time: "",
};

// "09:30" -> "9:30 AM"; length of the working day between two HH:MM times.
const fmtClock = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const workDuration = (a, b) => {
  if (!a || !b || b <= a) return "";
  const [h1, m1] = a.split(":").map(Number);
  const [h2, m2] = b.split(":").map(Number);
  const mins = h2 * 60 + m2 - (h1 * 60 + m1);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h} hrs`;
};
const initialsOf = (name) =>
  (name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

// "Today, 10:05 AM" / "Yesterday, ..." / "15 Sep 2026" for the Last login column.
function formatLastLogin(value) {
  if (!value) return "Never signed in";
  const d = new Date(value);
  const dayStart = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dayStart(new Date()) - dayStart(d)) / 86400000);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

const signedInToday = (value) =>
  Boolean(value) && new Date(value).toDateString() === new Date().toDateString();

function groupOf(code) {
  return code.split("_")[0];
}

function initials(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// User & Accounts screen — lists every user_account row and lets a
// System Administrator create, edit, or deactivate one. Matches the
// Identity & Access mockup's user list/detail screens, wired to the
// real CRUD API instead of static sample data.
function UserAccounts() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [rowMenu, setRowMenu] = useState(null); // { user, top, right }

  const [editRoleIds, setEditRoleIds] = useState(new Set());
  const [roleToggleBusyId, setRoleToggleBusyId] = useState(null);
  const [createRoleIds, setCreateRoleIds] = useState(new Set());

  const [personMode, setPersonMode] = useState("new"); // "new" | "existing"
  const [unlinkedPersons, setUnlinkedPersons] = useState([]);
  const [unlinkedLoading, setUnlinkedLoading] = useState(false);
  const [personSearch, setPersonSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // "idle" | "checking" | "available" | "taken" | "invalid" — driven by a
  // debounced call to the check-username endpoint as the field is typed.
  const [usernameStatus, setUsernameStatus] = useState("idle");
  const [usernameStatusMsg, setUsernameStatusMsg] = useState("");

  // "Login requests" — pending "Create login credentials for ..." requests
  // addressed to this admin (from HR's Employees page), surfaced right
  // here instead of making the admin go to Request Access for this one
  // specific kind of request. Read-only list for now — Approve/Reject
  // comes in a later step.
  const [loginRequests, setLoginRequests] = useState([]);
  const [loginRequestsLoading, setLoginRequestsLoading] = useState(false);
  const [loginRequestsPanelOpen, setLoginRequestsPanelOpen] = useState(false);

  const loadLoginRequests = async () => {
    setLoginRequestsLoading(true);
    try {
      const { data } = await client.get("/api/identity/permission-requests/", {
        params: { box: "received" },
      });
      setLoginRequests(
        data.filter(
          (r) => r.status === "PENDING" && r.permission_requested?.startsWith("Create login credentials for ")
        )
      );
    } catch {
      // Non-fatal — button just shows a 0 count if this fails.
    } finally {
      setLoginRequestsLoading(false);
    }
  };

  // Which login request Approve is currently mid-flow for — set when the
  // New Account form is opened from the Login requests panel, so that
  // once the account is actually created, that specific request (and
  // this employee's other pending copies, one per System Administrator)
  // gets marked Approved. Null for the normal "+ New account" flow.
  const [pendingApprovalRequest, setPendingApprovalRequest] = useState(null);
  const [loginRequestActionError, setLoginRequestActionError] = useState("");
  const [rejectingRequestId, setRejectingRequestId] = useState(null);

  // Approve — rather than just flip status, this opens the real "New
  // account" form pre-filled to the requested person, so creating the
  // account and approving the request happen as one action. The person
  // is matched by full name against /persons/unlinked/ (the request's
  // permission_requested text only carries free text, no structured
  // person_id link) — if no confident match is found, the admin still
  // gets the form, just without a pre-selection, and can pick manually.
  const handleApproveLoginRequest = async (request) => {
    setLoginRequestActionError("");
    setLoginRequestsPanelOpen(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setPersonMode("existing");
    setPersonSearch("");
    setShowPassword(false);
    setCreateRoleIds(new Set());
    setUsernameStatus("idle");
    setUsernameStatusMsg("");
    setPendingApprovalRequest(request);
    setModalOpen(true);
    setUnlinkedLoading(true);
    try {
      const { data } = await client.get("/api/identity/persons/unlinked/");
      setUnlinkedPersons(data);
      const match = /^Create login credentials for (.+) \([^)]*\)$/.exec(request.permission_requested);
      const name = match ? match[1] : "";
      const found = data.find((p) => p.full_name === name);
      if (found) {
        setForm((f) => ({ ...f, person_id: String(found.person_id) }));
        setPersonSearch(found.full_name);
      }
    } catch {
      // Non-fatal — admin can still search/select the person manually.
    } finally {
      setUnlinkedLoading(false);
    }
  };

  // Every System Administrator got their own copy of this request (see
  // HRDashboard's requestLoginCredentials) — once one admin actually
  // creates the account, the other copies need resolving too, so a
  // second admin doesn't try to create a duplicate account for the same
  // person. Matched the same way (identical permission_requested text),
  // since that's the only link back to "which employee" that exists.
  const resolveDuplicateLoginRequests = async (approvedRequest) => {
    try {
      const { data: received } = await client.get("/api/identity/permission-requests/", {
        params: { box: "received" },
      });
      const duplicates = received.filter(
        (r) =>
          r.permission_request_id !== approvedRequest.permission_request_id &&
          r.status === "PENDING" &&
          r.permission_requested === approvedRequest.permission_requested
      );
      await Promise.all(
        duplicates.map((r) =>
          client.post(`/api/identity/permission-requests/${r.permission_request_id}/decide/`, {
            action: "approve",
            note: "Auto-resolved — handled by another admin.",
          })
        )
      );
    } catch {
      // Non-fatal — worst case a duplicate copy just stays visible to
      // whichever admin didn't handle it, harmless if actioned again.
    }
  };

  const handleRejectLoginRequest = async (request) => {
    setLoginRequestActionError("");
    setRejectingRequestId(request.permission_request_id);
    try {
      await client.post(`/api/identity/permission-requests/${request.permission_request_id}/decide/`, {
        action: "reject",
        note: "",
      });
      await loadLoginRequests();
    } catch {
      setLoginRequestActionError("Couldn't reject that request.");
    } finally {
      setRejectingRequestId(null);
    }
  };

  const [permUser, setPermUser] = useState(null);
  const [permRows, setPermRows] = useState([]); // [{permission_id, code, name, viaRole, override}]
  const [permLoading, setPermLoading] = useState(false);
  const [permError, setPermError] = useState("");
  const [permPendingId, setPermPendingId] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  const toggleGroupCollapse = (name) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, rolesRes] = await Promise.all([
        client.get("/api/identity/users/"),
        client.get("/api/identity/roles/"),
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    } catch (err) {
      setError("Couldn't load user accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadLoginRequests();
  }, []);

  // Close the row "..." menu on any outside click, scroll or resize.
  useEffect(() => {
    if (!rowMenu) return undefined;
    const close = () => setRowMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [rowMenu]);

  // Debounced live "is this username free" check as it's typed — same
  // rule the actual save enforces, just checked ahead of time. Skips the
  // call entirely while editing and the field still matches the user's
  // current username (nothing would change, no point checking).
  useEffect(() => {
    if (!modalOpen) return;
    const username = form.username.trim();
    if (!username || (editingUser && username === editingUser.username)) {
      setUsernameStatus("idle");
      setUsernameStatusMsg("");
      return;
    }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const params = { username };
        if (editingUser) params.exclude = editingUser.user_id;
        const { data } = await client.get("/api/identity/users/check-username/", { params });
        if (data.available) {
          setUsernameStatus("available");
          setUsernameStatusMsg("Username available");
        } else {
          setUsernameStatus(/^3-30 characters/.test(data.reason) ? "invalid" : "taken");
          setUsernameStatusMsg(data.reason);
        }
      } catch (err) {
        setUsernameStatus("idle");
        setUsernameStatusMsg("");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.username, modalOpen, editingUser]);

  const openCreate = async () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setPersonMode("new");
    setUnlinkedPersons([]);
    setPersonSearch("");
    setShowPassword(false);
    setCreateRoleIds(new Set());
    setUsernameStatus("idle");
    setUsernameStatusMsg("");
    setPendingApprovalRequest(null);
    setModalOpen(true);
    setUnlinkedLoading(true);
    try {
      const { data } = await client.get("/api/identity/persons/unlinked/");
      setUnlinkedPersons(data);
    } catch (err) {
      // Non-fatal — "link existing person" mode just won't have anyone
      // to pick from; "new person" mode still works fine.
    } finally {
      setUnlinkedLoading(false);
    }
  };

  const openEdit = async (user) => {
    const [first, ...rest] = (user.full_name || "").split(" ");
    setEditingUser(user);
    setForm({
      username: user.username,
      password: "",
      first_name: first || "",
      last_name: rest.join(" "),
      email: user.email || "",
      phone: "",
      is_active: user.is_active,
      work_login_time: user.work_login_time || "",
      work_logout_time: user.work_logout_time || "",
    });
    setFormError("");
    setEditRoleIds(new Set());
    setShowPassword(false);
    setUsernameStatus("idle");
    setUsernameStatusMsg("");
    setModalOpen(true);
    try {
      const { data } = await client.get("/api/identity/user-roles/");
      setEditRoleIds(
        new Set(data.filter((ur) => ur.user_id === user.user_id).map((ur) => ur.role_id))
      );
    } catch (err) {
      setFormError("Couldn't load this user's current roles.");
    }
  };

  const toggleEditRole = async (roleId) => {
    if (!editingUser) return;
    const has = editRoleIds.has(roleId);
    setRoleToggleBusyId(roleId);
    setEditRoleIds((prev) => {
      const next = new Set(prev);
      has ? next.delete(roleId) : next.add(roleId);
      return next;
    });
    try {
      if (has) {
        await client.delete(`/api/identity/users/${editingUser.user_id}/roles/${roleId}/`);
      } else {
        await client.put(`/api/identity/users/${editingUser.user_id}/roles/${roleId}/`);
      }
      await loadData();
    } catch (err) {
      setFormError("Couldn't update that role.");
      setEditRoleIds((prev) => {
        const next = new Set(prev);
        has ? next.add(roleId) : next.delete(roleId);
        return next;
      });
    } finally {
      setRoleToggleBusyId(null);
    }
  };

  const toggleCreateRole = (roleId) => {
    setCreateRoleIds((prev) => {
      const next = new Set(prev);
      next.has(roleId) ? next.delete(roleId) : next.add(roleId);
      return next;
    });
  };

  const closeModal = () => {
    setModalOpen(false);
    setPendingApprovalRequest(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (form.password && !PASSWORD_PATTERN.test(form.password)) {
      setFormError(PASSWORD_HINT);
      return;
    }

    // A brand-new account with no role at all can't do anything once
    // created — same requirement whether it's a plain "+ New account"
    // or one opened from the Login requests panel's Approve.
    if (!editingUser && createRoleIds.size === 0) {
      setFormError("Assign at least one role before creating this account.");
      return;
    }

    setSubmitting(true);

    const { work_login_time, work_logout_time, ...payload } = form;
    if (!payload.password) delete payload.password;
    if (!editingUser && personMode === "existing") {
      delete payload.first_name;
      delete payload.last_name;
      delete payload.email;
      delete payload.phone;
    } else {
      delete payload.person_id;
    }
    if (!payload.person_id) delete payload.person_id;

    try {
      let saved;
      if (editingUser) {
        ({ data: saved } = await client.patch(`/api/identity/users/${editingUser.user_id}/`, payload));
      } else {
        const { data: created } = await client.post("/api/identity/users/", payload);
        saved = created;
        // Roles are assigned as separate calls, same endpoint the Edit
        // modal's checkboxes use — a brand-new account can start with
        // more than one role, same as any existing one can hold.
        for (const roleId of createRoleIds) {
          await client.put(`/api/identity/users/${created.user_id}/roles/${roleId}/`);
        }
      }

      // Assigned check-in / check-out time: saved on its own, after the
      // account exists (System Administrator only, settings file).
      const timesChanged = editingUser
        ? (work_login_time || "") !== (editingUser.work_login_time || "") ||
          (work_logout_time || "") !== (editingUser.work_logout_time || "")
        : !!(work_login_time || work_logout_time);
      if (timesChanged) {
        await client.put(`/api/identity/users/${saved.user_id}/work-schedule/`, {
          login_time: work_login_time || "",
          logout_time: work_logout_time || "",
        });
      }

      // The backend only attempts this send when a password was actually
      // set (always on create, only if "Reset password" was filled on
      // edit) — email_sent/email_reason are absent otherwise.
      if (payload.password) {
        if (saved.email_sent) {
          window.alert(`Login credentials sent to ${saved.email_reason}.`);
        } else if (saved.email_reason === "no_email_on_file") {
          window.alert("Account saved, but no email is on file for this person — share the credentials directly.");
        } else if (saved.email_reason === "send_failed") {
          window.alert("Account saved, but the credentials email failed to send — share the credentials directly.");
        }
      }
      // The account itself is the real "reply" here — the admin will
      // hand the credentials to the employee directly (call/in person),
      // never stored in this decision note. Only completes the loop for
      // the exact request this form was opened from — a plain
      // "+ New account" create leaves pendingApprovalRequest null.
      if (!editingUser && pendingApprovalRequest) {
        try {
          await client.post(
            `/api/identity/permission-requests/${pendingApprovalRequest.permission_request_id}/decide/`,
            { action: "approve", note: "Login created — credentials emailed to the employee." }
          );
          await resolveDuplicateLoginRequests(pendingApprovalRequest);
        } catch {
          // Account creation still succeeded — worst case the request
          // stays PENDING and needs manually approving from the panel.
        }
        setPendingApprovalRequest(null);
        await loadLoginRequests();
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      const data = err.response?.data;
      const firstError = data && Object.values(data)[0];
      setFormError(Array.isArray(firstError) ? firstError[0] : typeof firstError === "string" ? firstError : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const requestToggleActive = (user) => setConfirmTarget(user);
  const cancelToggleActive = () => setConfirmTarget(null);

  const confirmToggleActive = async () => {
    const user = confirmTarget;
    setConfirming(true);
    try {
      if (user.is_active) {
        await client.delete(`/api/identity/users/${user.user_id}/`);
      } else {
        await client.patch(`/api/identity/users/${user.user_id}/`, { is_active: true });
      }
      setConfirmTarget(null);
      await loadData();
    } catch (err) {
      setError("Couldn't update that account.");
    } finally {
      setConfirming(false);
    }
  };

  const openPermissions = async (user) => {
    setPermUser(user);
    setPermLoading(true);
    setPermError("");
    try {
      const [permsRes, userRolesRes, rolePermsRes, overridesRes] = await Promise.all([
        client.get("/api/identity/permissions/"),
        client.get("/api/identity/user-roles/"),
        client.get("/api/identity/role-permissions/"),
        client.get("/api/identity/user-permissions/"),
      ]);
      const roleIds = new Set(
        userRolesRes.data.filter((ur) => ur.user_id === user.user_id).map((ur) => ur.role_id)
      );
      const viaRoleSet = new Set(
        rolePermsRes.data.filter((rp) => roleIds.has(rp.role_id)).map((rp) => rp.permission_id)
      );
      const overrideMap = new Map(
        overridesRes.data
          .filter((o) => o.user_id === user.user_id)
          .map((o) => [o.permission_id, o.effect])
      );
      setPermRows(
        permsRes.data.map((p) => ({
          permission_id: p.permission_id,
          code: p.permission_code,
          name: p.permission_name,
          viaRole: viaRoleSet.has(p.permission_id),
          override: overrideMap.get(p.permission_id) || null,
        }))
      );
    } catch (err) {
      setPermError("Couldn't load permissions for this user.");
    } finally {
      setPermLoading(false);
    }
  };

  const closePermissions = () => {
    setPermUser(null);
    setPermRows([]);
  };

  const cyclePermission = async (row) => {
    // Straight toggle, not a 3-way cycle: whatever the row currently
    // shows (Allowed/Restricted), clicking it flips to the other one —
    // always via an explicit override, so a role-granted "Allowed" row
    // actually turns into "Restricted" on click instead of silently
    // staying Allowed (ALLOW layered on an already-true role grant).
    const next = isEffective(row) ? "DENY" : "ALLOW";
    setPermPendingId(row.permission_id);
    setPermRows((prev) =>
      prev.map((r) => (r.permission_id === row.permission_id ? { ...r, override: next } : r))
    );
    try {
      await client.put(`/api/identity/users/${permUser.user_id}/permissions/${row.permission_id}/`, {
        effect: next,
      });
    } catch (err) {
      setPermError("Couldn't update that permission.");
      setPermRows((prev) =>
        prev.map((r) => (r.permission_id === row.permission_id ? { ...r, override: row.override } : r))
      );
    } finally {
      setPermPendingId(null);
    }
  };

  const isEffective = (row) => (row.viaRole || row.override === "ALLOW") && row.override !== "DENY";

  const permGroups = (() => {
    const byGroup = new Map();
    permRows.forEach((row) => {
      const name = groupOf(row.code);
      if (!byGroup.has(name)) byGroup.set(name, []);
      byGroup.get(name).push(row);
    });
    return [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b));
  })();

  const permEffectiveCount = permRows.filter(isEffective).length;

  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.length - activeCount;
  const roleNames = [...new Set(users.flatMap((u) => u.roles || []))].sort();

  const filteredUsers = users.filter((user) => {
    if (statusFilter === "ACTIVE" && !user.is_active) return false;
    if (statusFilter === "INACTIVE" && user.is_active) return false;
    if (roleFilter !== "ALL" && !(user.roles || []).includes(roleFilter)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      user.full_name.toLowerCase().includes(q) ||
      user.username.toLowerCase().includes(q) ||
      (user.email || "").toLowerCase().includes(q) ||
      (user.roles || []).some((r) => r.toLowerCase().includes(q)) ||
      (user.designation || "").toLowerCase().includes(q)
    );
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "login") {
      const av = a.last_login ? new Date(a.last_login).getTime() : 0;
      const bv = b.last_login ? new Date(b.last_login).getTime() : 0;
      return (av - bv) * dir || a.full_name.localeCompare(b.full_name);
    }
    // Newer accounts get higher ids, and the list API sends no created date.
    if (sort.key === "created") return (a.user_id - b.user_id) * dir;
    // asc = Active first, desc = Inactive first
    if (sort.key === "status") {
      return ((b.is_active ? 1 : 0) - (a.is_active ? 1 : 0)) * dir || a.full_name.localeCompare(b.full_name);
    }
    if (sort.key === "role") {
      const ar = [...(a.roles || [])].sort()[0] || "￿";
      const br = [...(b.roles || [])].sort()[0] || "￿";
      return ar.localeCompare(br) * dir || a.full_name.localeCompare(b.full_name);
    }
    return a.full_name.localeCompare(b.full_name) * dir;
  });

  const SORT_OPTIONS = [
    ["name:asc", "Name (A to Z)"],
    ["name:desc", "Name (Z to A)"],
    ["login:desc", "Recently signed in"],
    ["login:asc", "Not signed in the longest"],
    ["created:desc", "Newest accounts"],
    ["created:asc", "Oldest accounts"],
    ["status:asc", "Active first"],
    ["status:desc", "Inactive first"],
    ["role:asc", "Role (A to Z)"],
  ];

  const toggleSort = (key) => {
    setSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "login" ? "desc" : "asc" }
    );
    setPage(1);
  };

  const sortIcon = (key) => {
    if (sort.key !== key) return <ArrowUpDown size={12} />;
    return sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  const openRowMenu = (event, user) => {
    event.stopPropagation();
    if (rowMenu?.user.user_id === user.user_id) {
      setRowMenu(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setRowMenu({ user, top: rect.bottom + 6, right: window.innerWidth - rect.right });
  };

  const copyUsername = async (user) => {
    try {
      await navigator.clipboard.writeText(user.username);
    } catch {
      // Clipboard can be blocked — nothing to recover, the menu just closes.
    }
    setRowMenu(null);
  };

  const stats = [
    { label: "Total accounts", value: users.length, tone: "blue", Icon: Users },
    { label: "Active", value: activeCount, tone: "green", Icon: UserCheck },
    { label: "Inactive", value: inactiveCount, tone: inactiveCount > 0 ? "red" : "grey", Icon: UserX },
    {
      label: "Login requests waiting",
      value: loginRequests.length,
      tone: "amber",
      Icon: KeyRound,
      onClick: () => setLoginRequestsPanelOpen(true),
    },
  ];

  const statusChips = [
    ["ALL", "All", users.length],
    ["ACTIVE", "Active", activeCount],
    ["INACTIVE", "Inactive", inactiveCount],
  ];

  const filtersOn = Boolean(search.trim()) || statusFilter !== "ALL" || roleFilter !== "ALL";

  return (
    <div className="ua-screen">
      <div className="ua-head">
        <div>
          <h1>User &amp; Accounts</h1>
          <p>Create accounts, assign roles and manage who can sign in</p>
        </div>
        <div className="ua-head-actions">
          <button className="ua-btn-outline" onClick={() => setLoginRequestsPanelOpen(true)}>
            <MailOpen size={15} /> Login requests
            {loginRequests.length > 0 && <em className="ua-badge">{loginRequests.length}</em>}
          </button>
          <button className="ua-btn-accent" onClick={openCreate}>
            <UserPlus size={16} /> New account
          </button>
        </div>
      </div>

      {error && <p className="ua-error">{error}</p>}

      <div className="att2-cards att2-four att2-static">
        {stats.map(({ label, value, tone, Icon, onClick }) => (
          <div
            key={label}
            className={`att2-card tone-${tone}` + (onClick ? " att2-click" : "")}
            {...(onClick
              ? {
                  role: "button",
                  tabIndex: 0,
                  onClick,
                  onKeyDown: (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onClick();
                    }
                  },
                }
              : {})}
          >
            <span className="att2-card-top">
              <span className="att2-card-icon"><Icon size={16} /></span>
              <b>{value}</b>
            </span>
            <span className="att2-card-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="ua-toolbar">
        <label className="ua-search-wrap">
          <span className="ua-search-icon"><Search size={16} /></span>
          <input
            className="ua-search"
            placeholder="Search name, username, email or role"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              type="button"
              className="ua-search-clear"
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
            >
              <X size={12} />
            </button>
          )}
        </label>
        <select
          className="ua-role-filter"
          value={roleFilter}
          aria-label="Filter by role"
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All roles</option>
          {roleNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <label className="ua-sort">
          <ArrowUpDown size={14} />
          <span>Sort by</span>
          <select
            className="ua-role-filter"
            value={`${sort.key}:${sort.dir}`}
            aria-label="Sort accounts"
            onChange={(e) => {
              const [key, dir] = e.target.value.split(":");
              setSort({ key, dir });
              setPage(1);
            }}
          >
            {SORT_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <div className="ua-seg">
          {statusChips.map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              className={"ua-seg-btn" + (statusFilter === key ? " on" : "")}
              onClick={() => {
                setStatusFilter(key);
                setPage(1);
              }}
            >
              {label} <b>{count}</b>
            </button>
          ))}
        </div>
      </div>
      {filtersOn && !loading && (
        <p className="ua-count">
          Showing <b>{sortedUsers.length}</b> of {users.length} accounts
        </p>
      )}

      <div className="ua-panel">
        {loading ? (
          <p className="ua-empty">Loading…</p>
        ) : sortedUsers.length === 0 ? (
          <p className="ua-empty">No accounts match your search or filters.</p>
        ) : (
          <>
          <div className="ua-table-scroll">
            <table className="ua-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className={"ua-th-sort" + (sort.key === "name" ? " on" : "")} onClick={() => toggleSort("name")}>
                      User {sortIcon("name")}
                    </button>
                  </th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>
                    <button type="button" className={"ua-th-sort" + (sort.key === "login" ? " on" : "")} onClick={() => toggleSort("login")}>
                      Last login {sortIcon("login")}
                    </button>
                  </th>
                  <th className="ua-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginate(sortedUsers, page).map((user, i) => (
                  <tr key={user.user_id} className={user.is_active ? "" : "inactive"}>
                    <td>
                      <div className="ua-cell-user">
                        <span className="ua-avatar-wrap">
                          <span className={"ua-avatar" + (i % 2 ? " alt" : "") + (user.is_active ? "" : " off")}>
                            {initials(user.full_name)}
                          </span>
                          {signedInToday(user.last_login) && <span className="ua-online" title="Signed in today" />}
                        </span>
                        <div className="ua-cell-text">
                          <div className="ua-name">{user.full_name}</div>
                          <div className="ua-sub">
                            {user.designation ? `${user.designation} · ` : ""}
                            {user.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {user.roles.length ? (
                        user.roles.map((role) => (
                          <span
                            className={"ua-role-pill" + (role === "System Administrator" ? " admin" : "")}
                            key={role}
                          >
                            {role}
                          </span>
                        ))
                      ) : (
                        <span className="ua-sub">No role assigned</span>
                      )}
                    </td>
                    <td>
                      <span className={"ua-pill " + (user.is_active ? "on" : "off")}>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="ua-login">{formatLastLogin(user.last_login)}</div>
                      {signedInToday(user.last_login) && <div className="ua-sub">Active today</div>}
                    </td>
                    <td>
                      <div className="ua-actions">
                        <button className="ua-action-btn" title="Edit" onClick={() => openEdit(user)}>
                          <Pencil size={13} /> <span className="ua-btn-label">Edit</span>
                        </button>
                        <button className="ua-action-btn primary" title="Permissions" onClick={() => openPermissions(user)}>
                          <KeyRound size={13} /> <span className="ua-btn-label">Permissions</span>
                        </button>
                        <button
                          className={"ua-more-btn" + (rowMenu?.user.user_id === user.user_id ? " open" : "")}
                          aria-label={`More actions for ${user.full_name}`}
                          onClick={(e) => openRowMenu(e, user)}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalItems={sortedUsers.length} onPageChange={setPage} />
          </>
        )}
      </div>

      {rowMenu && (
        <div
          className="ua-row-menu"
          style={{ top: rowMenu.top, right: rowMenu.right }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={() => copyUsername(rowMenu.user)}>
            <Copy size={14} /> Copy username
          </button>
          <button
            type="button"
            onClick={() => {
              const user = rowMenu.user;
              setRowMenu(null);
              openEdit(user);
            }}
          >
            <Lock size={14} /> Reset password
          </button>
          <button
            type="button"
            className={rowMenu.user.is_active ? "danger" : "good"}
            onClick={() => {
              const user = rowMenu.user;
              setRowMenu(null);
              requestToggleActive(user);
            }}
          >
            {rowMenu.user.is_active ? <Ban size={14} /> : <RotateCcw size={14} />}
            {rowMenu.user.is_active ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="ua-modal-backdrop" onClick={closeModal}>
          <form className="ua-modal ua2-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <button type="button" className="ua-modal-x" onClick={closeModal} aria-label="Close">
              <X size={14} />
            </button>
            <div className="ua-form-head ua2-head">
              <span className="ua-form-icon">
                {editingUser ? <Pencil size={21} /> : <UserPlus size={22} />}
              </span>
              <div>
                <h2>{editingUser ? "Edit account" : "New account"}</h2>
                <p>
                  {editingUser
                    ? "Update sign-in, roles and work timings"
                    : "Create a login for someone in your organisation"}
                </p>
              </div>
            </div>

            <div className="ua2-body">
              <div className="ua2-main">
                <section className="ua2-sec">
                  <h3><span className="ua2-n">1</span>Person<span className="ua2-ln" /></h3>
                {!editingUser && (
                  <div className="ua-person-mode">
                    <button
                      type="button"
                      className={"ua-mode-btn" + (personMode === "new" ? " active" : "")}
                      onClick={() => setPersonMode("new")}
                    >
                      New person
                    </button>
                    <button
                      type="button"
                      className={"ua-mode-btn" + (personMode === "existing" ? " active" : "")}
                      onClick={() => {
                        setPersonMode("existing");
                        setPersonSearch("");
                      }}
                    >
                      Existing person — no login yet
                    </button>
                  </div>
                )}

                {!editingUser && personMode === "existing" && (
                  <>
                    <div className="ua-person-label-row">
                      <label>Person</label>
                      {(personSearch || form.person_id) && (
                        <button
                          type="button"
                          className="ua-person-clear"
                          onClick={() => {
                            setPersonSearch("");
                            setForm((f) => ({ ...f, person_id: "" }));
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input
                      className="ua-person-search"
                      placeholder="Search by name or email…"
                      value={personSearch}
                      onChange={(e) => setPersonSearch(e.target.value)}
                    />
                    <select
                      className="ua-person-select"
                      value={form.person_id}
                      onChange={(e) => setForm({ ...form, person_id: e.target.value })}
                      onDoubleClick={(e) => {
                        const person = unlinkedPersons.find(
                          (p) => String(p.person_id) === e.currentTarget.value
                        );
                        if (person) setPersonSearch(person.full_name);
                      }}
                      required
                      size={Math.min(6, Math.max(3, unlinkedPersons.length || 1))}
                    >
                      {unlinkedLoading && <option value="">Loading…</option>}
                      {!unlinkedLoading &&
                        unlinkedPersons
                          .filter((p) => {
                            const q = personSearch.trim().toLowerCase();
                            if (!q) return true;
                            return (
                              p.full_name.toLowerCase().includes(q) ||
                              (p.email || "").toLowerCase().includes(q)
                            );
                          })
                          .map((p) => (
                            <option key={p.person_id} value={p.person_id}>
                              {p.full_name} {p.email ? `(${p.email})` : ""}
                            </option>
                          ))}
                    </select>
                    {!unlinkedLoading && unlinkedPersons.length === 0 && (
                      <p className="ua-perm-hint">
                        No person without a login was found — everyone in the system already has one.
                      </p>
                    )}
                  </>
                )}

                {(editingUser || personMode === "new") && (
                  <>
                    <div className="ua-form-row">
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
                  </>
                )}

                </section>

                <section className="ua2-sec">
                  <h3><span className="ua2-n">2</span>Sign-in<span className="ua2-ln" /></h3>
                <label>Username</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
                {usernameStatus !== "idle" && (
                  <p className={"ua-username-status ua-username-status-" + usernameStatus}>
                    {usernameStatus === "available" && <IconCheck />}
                    {usernameStatus === "checking" ? "Checking availability…" : usernameStatusMsg}
                  </p>
                )}

                <label>{editingUser ? "Reset password (optional)" : "Password"}</label>
                <div className="ua-password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required={!editingUser}
                    pattern={form.password ? PASSWORD_PATTERN.source : undefined}
                    title={PASSWORD_HINT}
                    maxLength={8}
                  />
                  <button
                    type="button"
                    className="ua-password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="ua-perm-hint">{PASSWORD_HINT}</p>

                </section>

                <section className="ua2-sec">
                  <h3><span className="ua2-n">3</span>Roles<span className="ua2-ln" /></h3>
                  <div className="ua2-chips">
                    {roles.map((role) => {
                      const checked = editingUser ? editRoleIds.has(role.role_id) : createRoleIds.has(role.role_id);
                      const busy = editingUser && roleToggleBusyId === role.role_id;
                      return (
                        <button
                          type="button"
                          key={role.role_id}
                          className={"ua2-chip" + (checked ? " on" : "") + (role.role_name === "System Administrator" ? " admin" : "")}
                          disabled={busy}
                          aria-pressed={checked}
                          onClick={() => (editingUser ? toggleEditRole(role.role_id) : toggleCreateRole(role.role_id))}
                        >
                          {checked && <Check size={12} />}
                          {role.role_name}
                          {busy && " …"}
                        </button>
                      );
                    })}
                  </div>
                  <p className="ua-perm-hint">
                    A user can hold more than one role{editingUser ? " — role changes apply immediately." : "."}
                  </p>
                </section>

                <section className="ua2-sec">
                  <h3><span className="ua2-n">4</span>Work timings<span className="ua2-ln" /></h3>
                  <div className="ua2-times">
                    <div>
                      <label>Check-in time</label>
                      <input
                        type="time"
                        value={form.work_login_time}
                        onChange={(e) => setForm({ ...form, work_login_time: e.target.value })}
                      />
                    </div>
                    <div>
                      <label>Check-out time</label>
                      <input
                        type="time"
                        value={form.work_logout_time}
                        onChange={(e) => setForm({ ...form, work_logout_time: e.target.value })}
                      />
                    </div>
                    {workDuration(form.work_login_time, form.work_logout_time) && (
                      <span className="ua2-dur">{workDuration(form.work_login_time, form.work_logout_time)}</span>
                    )}
                  </div>
                  <p className="ua-perm-hint">
                    The time this person is expected to check in and out. Leave both empty to clear.
                  </p>
                </section>

                <label className="ua-toggle-row">
                  <span>
                    <b>Active</b>
                    <small>Can sign in right away</small>
                  </span>
                  <input
                    type="checkbox"
                    className="ua-switch"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                </label>
              </div>

              <aside className="ua2-side">
                {(() => {
                  const sideName = editingUser
                    ? editingUser.full_name
                    : `${form.first_name} ${form.last_name}`.trim() || "New account";
                  const roleCount = editingUser ? editRoleIds.size : createRoleIds.size;
                  return (
                    <>
                      <span className="ua2-avatar">{initialsOf(sideName === "New account" ? "" : sideName)}</span>
                      <b>{sideName}</b>
                      <small>{editingUser ? editingUser.designation || "No designation" : "New login"}</small>
                      <div className="ua2-kv">
                        <div><span>Roles</span><span>{roleCount}</span></div>
                        <div><span>Check in</span><span>{fmtClock(form.work_login_time) || "Not set"}</span></div>
                        <div><span>Check out</span><span>{fmtClock(form.work_logout_time) || "Not set"}</span></div>
                        {editingUser && (
                          <div><span>Last login</span><span>{formatLastLogin(editingUser.last_login)}</span></div>
                        )}
                        <div><span>Status</span><span>{form.is_active ? "Active" : "Inactive"}</span></div>
                      </div>
                    </>
                  );
                })()}
              </aside>
            </div>

            {formError && <p className="ua-error ua2-error">{formError}</p>}

            <div className="ua-modal-actions ua2-foot">
              <button type="button" className="ua-btn-sm" onClick={closeModal}>
                Cancel
              </button>
              <button
                type="submit"
                className="ua-btn-accent"
                disabled={submitting || usernameStatus === "taken" || usernameStatus === "invalid"}
              >
                <Check size={16} />
                {submitting ? "Saving…" : editingUser ? "Save changes" : "Create account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmTarget && (
        <div className="ua-modal-backdrop" onClick={cancelToggleActive}>
          <div className="ua-modal ua-confirm" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ua-modal-x" onClick={cancelToggleActive} aria-label="Close">
              <X size={14} />
            </button>
            <h2>{confirmTarget.is_active ? "Deactivate account?" : "Reactivate account?"}</h2>
            <p>
              {confirmTarget.is_active
                ? `${confirmTarget.full_name} won't be able to sign in until reactivated.`
                : `${confirmTarget.full_name} will be able to sign in again.`}
            </p>
            <div className="ua-modal-actions">
              <button type="button" className="ua-btn-sm" onClick={cancelToggleActive}>
                Cancel
              </button>
              <button
                type="button"
                className={confirmTarget.is_active ? "ua-btn-sm ua-btn-danger" : "ua-btn-accent"}
                onClick={confirmToggleActive}
                disabled={confirming}
              >
                {confirming ? "Working…" : confirmTarget.is_active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {permUser && (
        <div className="ua-modal-backdrop" onClick={closePermissions}>
          <div className="ua-modal ua-perm-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ua-modal-x" onClick={closePermissions} aria-label="Close">
              <X size={14} />
            </button>
            <div className="ua-perm-modal-head">
              <span className="ua-perm-modal-icon">
                <IconShield />
              </span>
              <h2>
                Permissions
                {!permLoading && (
                  <span className="ua-perm-total-count">
                    {" "}
                    ({permEffectiveCount}/{permRows.length})
                  </span>
                )}
              </h2>
            </div>

            <div className="ua-perm-identity">
              <div className="ua-perm-avatar">{initials(permUser.full_name)}</div>
              <div>
                <div className="ua-modal-identity-name">{permUser.full_name}</div>
                <IdentityLine user={permUser} />
              </div>
            </div>

            <div className="ua-perm-info-box">
              <IconInfo />
              <p>
                Green = Allowed, red = Restricted. Click a row to switch it between the two for
                this user.
              </p>
            </div>

            {permError && <p className="ua-error">{permError}</p>}

            {permLoading ? (
              <p className="ua-empty">Loading…</p>
            ) : (
              <div className="ua-perm-groups">
                {permGroups.map(([name, rows]) => {
                  const collapsed = collapsedGroups.has(name);
                  return (
                    <div className="ua-perm-group-card" key={name}>
                      <button
                        type="button"
                        className="ua-perm-group-header"
                        onClick={() => toggleGroupCollapse(name)}
                      >
                        <span className="ua-perm-group-icon">{groupIcon(name)}</span>
                        <span className="ua-perm-group-title">{name}</span>
                        <span className="ua-perm-group-badge">
                          {rows.filter(isEffective).length}/{rows.length}
                        </span>
                        <span className="ua-perm-group-chevron">
                          <IconChevron collapsed={collapsed} />
                        </span>
                      </button>
                      {!collapsed &&
                        rows.map((row) => {
                          const effective = isEffective(row);
                          const busy = permPendingId === row.permission_id;
                          const overridden = row.override === "ALLOW" || row.override === "DENY";
                          return (
                            <button
                              key={row.permission_id}
                              className={
                                "ua-perm-row" +
                                (effective ? " effective" : " restricted") +
                                (overridden ? " overridden" : "")
                              }
                              onClick={() => cyclePermission(row)}
                              disabled={busy}
                              title={
                                overridden
                                  ? `Individually ${row.override === "ALLOW" ? "allowed" : "restricted"} for this user`
                                  : row.viaRole
                                  ? "Allowed through this user's role"
                                  : "Not granted by any role"
                              }
                            >
                              <span className="ua-perm-row-icon">
                                {busy ? null : effective ? <IconCheckCircle /> : <IconRestrictedCircle />}
                              </span>
                              <span className="ua-perm-code">{row.code}</span>
                              <span className="ua-perm-state">
                                {busy ? "…" : effective ? "✓ Allowed" : "✕ Restricted"}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="ua-modal-actions">
              <button type="button" className="ua-btn-sm" onClick={closePermissions}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {loginRequestsPanelOpen && (
        <div className="ua-modal-backdrop" onClick={() => setLoginRequestsPanelOpen(false)}>
          <div className="ua-modal ua-modal-wide" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ua-modal-x"
              onClick={() => setLoginRequestsPanelOpen(false)}
              aria-label="Close"
            >
              <X size={14} />
            </button>
            <h2>Login requests</h2>
            <p className="ua-hint">
              Requests from HR asking for login credentials to be created for an onboarded employee.
              Approving opens the New account form pre-filled to that person — creating the account
              completes the approval. The actual credentials are shared with the employee directly,
              never stored here.
            </p>

            {loginRequestActionError && <p className="ua-error">{loginRequestActionError}</p>}

            {loginRequestsLoading ? (
              <p className="ua-empty">Loading…</p>
            ) : loginRequests.length === 0 ? (
              <p className="ua-empty">No pending login requests.</p>
            ) : (
              <div className="ua-table-scroll">
                <table className="ua-table">
                  <thead>
                    <tr>
                      <th>Requested by</th>
                      <th>Requesting</th>
                      <th>Reason</th>
                      <th>Sent</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginRequests.map((r) => (
                      <tr key={r.permission_request_id}>
                        <td>{r.requester_name}</td>
                        <td>{r.permission_requested}</td>
                        <td>{r.reason}</td>
                        <td className="ua-mono">
                          {new Date(r.created_at).toLocaleString(undefined, {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              className="ua-btn-accent"
                              style={{ padding: "6px 12px", fontSize: 12.5 }}
                              onClick={() => handleApproveLoginRequest(r)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="ua-btn-sm ua-btn-danger"
                              style={{ padding: "6px 12px", fontSize: 12.5 }}
                              disabled={rejectingRequestId === r.permission_request_id}
                              onClick={() => handleRejectLoginRequest(r)}
                            >
                              {rejectingRequestId === r.permission_request_id ? "…" : "Reject"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="ua-modal-actions">
              <button type="button" className="ua-btn-sm" onClick={() => setLoginRequestsPanelOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserAccounts;
