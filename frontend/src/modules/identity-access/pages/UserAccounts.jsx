import { useEffect, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, Ban, Copy, KeyRound, Lock,
  MoreHorizontal, Pencil, RotateCcw, Search, ShieldCheck, UserCheck, UserPlus, UserX,
  Users, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import client from "../../../api/client";
import Breadcrumbs from "../../../components/Breadcrumbs";
import { formatLastLogin } from "../accountHelpers";
import { EmployeeAvatar } from "../../hr/components/EmployeeAvatar";
import Pagination, { paginate } from "../../../components/Pagination";
import "../../student/styles/StudentDashboard.css";
import "../../hr/styles/Attendance.css";
import "../styles/UserAccounts.css";

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

// "Today, 10:05 AM" / "Yesterday, ..." / "15 Sep 2026" for the Last login column.
// Most powerful roles first, so a long list can be cut to two + "+N"
// without hiding the one that matters (e.g. System Administrator).
const ROLE_ORDER = ["System Administrator", "HR Administrator", "Business Team", "Project Manager", "Employee", "Intern", "Student", "Viewer"];
const sortRoles = (roles) =>
  [...roles].sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(a);
    const ib = ROLE_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

const signedInToday = (value) =>
  Boolean(value) && new Date(value).toDateString() === new Date().toDateString();

function groupOf(code) {
  return code.split("_")[0];
}

// User & Accounts screen — lists every user_account row and lets a
// System Administrator create, edit, or deactivate one. Matches the
// Identity & Access mockup's user list/detail screens, wired to the
// real CRUD API instead of static sample data.
function UserAccounts() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [rowMenu, setRowMenu] = useState(null); // { user, top, right }

  // Number of pending "Create login credentials for ..." requests, for the
  // "Login requests waiting" card. The requests themselves live on their
  // own page (System Administrator > Login requests).
  const [loginRequests, setLoginRequests] = useState([]);

  const loadLoginRequests = async () => {
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
      // Non-fatal — the card just shows 0.
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
      const { data } = await client.get("/api/identity/users/");
      setUsers(data);
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
      onClick: () => navigate("/identity/login-requests"),
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
          <Breadcrumbs
            items={[
              { label: "System Administrator", to: "/dashboard", icon: ShieldCheck },
              { label: "User & Accounts" },
            ]}
          />
          <h1>User &amp; Accounts</h1>
          <p>Create accounts, assign roles and manage who can sign in</p>
        </div>
        <div className="ua-head-actions">
          <button className="ua-btn-accent" onClick={() => navigate("/identity/users/new")}>
            <UserPlus size={16} /> Create login
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
                {paginate(sortedUsers, page).map((user) => (
                  <tr key={user.user_id} className={user.is_active ? "" : "inactive"}>
                    <td>
                      <div className="ua-cell-user">
                        <span className="ua-avatar-wrap">
                          <span className={"ua-avatar" + (user.is_active ? "" : " off")}>
                            <EmployeeAvatar personId={user.person_id} size={36} />
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
                    <td className="ua-roles-cell">
                      {user.roles.length ? (
                        <>
                          {sortRoles(user.roles).slice(0, 2).map((role) => (
                            <span
                              className={"ua-role-pill" + (role === "System Administrator" ? " admin" : "")}
                              key={role}
                            >
                              {role}
                            </span>
                          ))}
                          {user.roles.length > 2 && (
                            <span className="ua-role-pill more" title={sortRoles(user.roles).join(", ")}>
                              +{user.roles.length - 2}
                            </span>
                          )}
                        </>
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
                        <button className="ua-action-btn" title="Edit" onClick={() => navigate(`/identity/users/${user.user_id}/edit`)}>
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
              navigate(`/identity/users/${user.user_id}/edit`);
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
              <div className="ua-perm-avatar"><EmployeeAvatar personId={permUser.person_id} size={52} /></div>
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
    </div>
  );
}

export default UserAccounts;
