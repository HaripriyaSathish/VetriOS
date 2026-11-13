import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban, BriefcaseBusiness, Check, CircleCheck, CircleOff, Eye, FileText, GraduationCap, Info,
  KeyRound, Pencil, Plus, RotateCcw, Search, Shield, ShieldCheck, ShieldPlus, UserCog, Users, X,
} from "lucide-react";
import client from "../../../api/client";
import { formatLastLogin } from "../accountHelpers";
import { EmployeeAvatar } from "../../hr/components/EmployeeAvatar";
import Pagination, { paginate } from "../../../components/Pagination";
import "../../student/styles/StudentDashboard.css";
import "../../hr/styles/Attendance.css";
import "../styles/RolesPermissions.css";

const EMPTY_FORM = { role_name: "", description: "", is_active: true };
const DESC_MAX = 200;

// Icon tile for a role card, picked from the role's name.
function roleIcon(name = "") {
  const n = name.toLowerCase();
  if (n.includes("admin")) return ShieldCheck;
  if (n.includes("hr") || n.includes("manager")) return Users;
  if (n.includes("trainee") || n.includes("student") || n.includes("intern")) return GraduationCap;
  if (n.includes("project") || n.includes("client") || n.includes("lead")) return BriefcaseBusiness;
  if (n.includes("doc")) return FileText;
  if (n.includes("guest")) return UserCog;
  return Shield;
}

// Roles & Permissions screen — the role table's contents, with full CRUD:
// create, edit, view (its granted permissions), and delete (soft —
// is_active=False, same pattern as User & Accounts).
function RolesPermissions() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [permissionCount, setPermissionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [viewRole, setViewRole] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  // "Users" popup: everyone who currently holds a role (read-only list).
  const [usersRole, setUsersRole] = useState(null);
  const [roleUsers, setRoleUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [usersSearch, setUsersSearch] = useState("");

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [rolesRes, permsRes] = await Promise.all([
        client.get("/api/identity/roles/cards/"),
        client.get("/api/identity/permissions/"),
      ]);
      setRoles(rolesRes.data);
      setPermissionCount(permsRes.data.length);
    } catch (err) {
      setError("Couldn't load roles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingRole(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (role) => {
    setEditingRole(role);
    setForm({ role_name: role.role_name, description: role.description || "", is_active: role.is_active });
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");

    try {
      if (editingRole) {
        await client.patch(`/api/identity/roles/cards/${editingRole.role_id}/`, form);
      } else {
        await client.post("/api/identity/roles/cards/", form);
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      const data = err.response?.data;
      const firstError = data && Object.values(data)[0];
      setFormError(Array.isArray(firstError) ? firstError[0] : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const openView = async (role) => {
    setViewRole({ ...role, permissions: null });
    setViewLoading(true);
    try {
      const { data } = await client.get(`/api/identity/roles/cards/${role.role_id}/`);
      setViewRole(data);
    } catch (err) {
      setViewRole(null);
      setError("Couldn't load that role's detail.");
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => setViewRole(null);

  const openUsers = async (role) => {
    setUsersRole(role);
    setUsersSearch("");
    setUsersError("");
    setUsersLoading(true);
    try {
      const { data } = await client.get("/api/identity/users/");
      setRoleUsers(data.filter((u) => (u.roles || []).includes(role.role_name)));
    } catch {
      setRoleUsers([]);
      setUsersError("Couldn't load this role's users.");
    } finally {
      setUsersLoading(false);
    }
  };
  const closeUsers = () => setUsersRole(null);

  const requestToggleActive = (role) => setConfirmTarget(role);
  const cancelToggleActive = () => setConfirmTarget(null);

  const confirmToggleActive = async () => {
    const role = confirmTarget;
    setConfirming(true);
    try {
      if (role.is_active) {
        await client.delete(`/api/identity/roles/cards/${role.role_id}/`);
      } else {
        await client.patch(`/api/identity/roles/cards/${role.role_id}/`, { is_active: true });
      }
      setConfirmTarget(null);
      await loadData();
    } catch (err) {
      setError("Couldn't update that role.");
    } finally {
      setConfirming(false);
    }
  };

  const activeCount = roles.filter((r) => r.is_active).length;
  const inactiveCount = roles.length - activeCount;

  const filteredRoles = roles.filter((role) => {
    if (statusFilter === "ACTIVE" && !role.is_active) return false;
    if (statusFilter === "INACTIVE" && role.is_active) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      role.role_name.toLowerCase().includes(q) ||
      (role.description || "").toLowerCase().includes(q)
    );
  });

  const stats = [
    { label: "Total roles", value: roles.length, tone: "blue", Icon: ShieldCheck },
    { label: "Active", value: activeCount, tone: "green", Icon: CircleCheck },
    { label: "Inactive", value: inactiveCount, tone: inactiveCount > 0 ? "red" : "grey", Icon: CircleOff },
    { label: "Permissions available", value: permissionCount, tone: "amber", Icon: KeyRound },
  ];

  const chips = [
    ["ALL", "All", roles.length],
    ["ACTIVE", "Active", activeCount],
    ["INACTIVE", "Inactive", inactiveCount],
  ];

  return (
    <div className="rp-screen">
      <div className="rp-head">
        <div>
          <h1>Roles</h1>
          <p>Create roles and see what each one can do</p>
        </div>
        <button className="rp-btn-accent" onClick={openCreate}>
          <Plus size={16} /> New role
        </button>
      </div>

      {error && <p className="rp-error">{error}</p>}

      {loading ? (
        <p className="rp-empty">Loading…</p>
      ) : (
        <>
          <div className="att2-cards att2-four att2-static">
            {stats.map(({ label, value, tone, Icon }) => (
              <div key={label} className={`att2-card tone-${tone}`}>
                <span className="att2-card-top">
                  <span className="att2-card-icon"><Icon size={16} /></span>
                  <b>{value}</b>
                </span>
                <span className="att2-card-label">{label}</span>
              </div>
            ))}
          </div>

          <div className="rp-toolbar">
            <label className="rp-search-wrap">
              <span className="rp-search-icon"><Search size={16} /></span>
              <input
                className="rp-search"
                placeholder="Search roles by name or description"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <button
                  type="button"
                  className="rp-search-clear"
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
            <div className="rp-seg">
              {chips.map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  className={"rp-seg-btn" + (statusFilter === key ? " on" : "")}
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
          {(search.trim() || statusFilter !== "ALL") && (
            <p className="rp-count">
              Showing <b>{filteredRoles.length}</b> of {roles.length} roles
              {search.trim() ? ` for "${search.trim()}"` : ""}
            </p>
          )}

          {filteredRoles.length === 0 ? (
            <div className="rp-empty-card">
              <Shield size={26} />
              <p>No roles match your search.</p>
            </div>
          ) : (
            <div className="rp-grid">
              {paginate(filteredRoles, page).map((role) => {
                const Icon = roleIcon(role.role_name);
                const pct = permissionCount
                  ? Math.min(100, Math.round((role.permission_count / permissionCount) * 100))
                  : 0;
                return (
                  <div key={role.role_id} className={"rp-card" + (role.is_active ? "" : " inactive")}>
                    <div className="rp-card-head">
                      <span className="rp-tile"><Icon size={19} /></span>
                      <span className="rp-card-name">{role.role_name}</span>
                      <span className={"rp-pill " + (role.is_active ? "on" : "off")}>
                        {role.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="rp-card-desc">{role.description || "No description added."}</p>
                    <div className="rp-perm-row">
                      <span>Permissions</span>
                      <span>{role.permission_count} / {permissionCount}</span>
                    </div>
                    <div className="rp-track"><i style={{ width: `${pct}%` }} /></div>
                    <div className="rp-card-foot">
                      <span className="rp-date">
                        Created {role.created_at ? new Date(role.created_at).toLocaleDateString() : "—"}
                      </span>
                      <div className="rp-actions">
                        <button className="rp-action-btn" onClick={() => openView(role)}>
                          <Eye size={14} /> <span>View</span>
                        </button>
                        <button className="rp-action-btn" onClick={() => openUsers(role)}>
                          <Users size={14} /> <span>Users</span>
                        </button>
                        <button className="rp-action-btn" onClick={() => openEdit(role)}>
                          <Pencil size={14} /> <span>Edit</span>
                        </button>
                        <button
                          className={"rp-action-btn " + (role.is_active ? "danger" : "good")}
                          onClick={() => requestToggleActive(role)}
                        >
                          {role.is_active ? <Ban size={14} /> : <RotateCcw size={14} />}
                          <span>{role.is_active ? "Deactivate" : "Reactivate"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Pagination page={page} totalItems={filteredRoles.length} onPageChange={setPage} />
        </>
      )}

      {formOpen && (
        <div className="rp-modal-backdrop" onClick={closeForm}>
          <form className="rp-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <button type="button" className="rp-modal-x" onClick={closeForm} aria-label="Close">
              <X size={14} />
            </button>
            <div className="rp-form-head">
              <span className="rp-form-icon">{editingRole ? <Pencil size={21} /> : <ShieldPlus size={22} />}</span>
              <div>
                <h2>{editingRole ? "Edit role" : "New role"}</h2>
                <p>
                  {editingRole
                    ? "Change the name, description or status"
                    : "Name it and describe it, then pick its permissions later"}
                </p>
              </div>
            </div>

            <label className="rp-label" htmlFor="rp-role-name">
              <span>Role name <em>*</em></span>
            </label>
            <div className="rp-field">
              <Shield size={16} />
              <input
                id="rp-role-name"
                value={form.role_name}
                maxLength={100}
                placeholder="Document Reviewer"
                onChange={(e) => setForm({ ...form, role_name: e.target.value })}
                required
              />
            </div>
            <p className="rp-field-hint">Use a short, clear name people will recognise.</p>

            <label className="rp-label" htmlFor="rp-role-desc">
              <span>Description</span>
              <small>{form.description.length} / {DESC_MAX}</small>
            </label>
            <textarea
              id="rp-role-desc"
              className="rp-textarea"
              rows={3}
              maxLength={DESC_MAX}
              placeholder="What is this role for?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />

            <label className="rp-toggle-row">
              <span>
                <b>Active</b>
                <small>Can be assigned to users right away</small>
              </span>
              <input
                type="checkbox"
                className="rp-switch"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
            </label>

            <div className="rp-note">
              <Info size={15} />
              <span>
                {editingRole
                  ? "To manage this role's permissions, use the Permissions menu."
                  : "After saving, set what this role can do from the Permissions menu."}
              </span>
            </div>

            {formError && <p className="rp-error">{formError}</p>}

            <div className="rp-modal-actions">
              <button type="button" className="rp-btn-sm" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="rp-btn-accent" disabled={submitting}>
                <Check size={16} />
                {submitting ? "Saving…" : editingRole ? "Save changes" : "Create role"}
              </button>
            </div>
          </form>
        </div>
      )}

      {viewRole && (
        <div className="rp-modal-backdrop" onClick={closeView}>
          <div className="rp-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="rp-modal-x" onClick={closeView} aria-label="Close">
              <X size={14} />
            </button>
            <h2>{viewRole.role_name}</h2>
            <p className="rp-view-desc">{viewRole.description}</p>
            <span className={"rp-pill " + (viewRole.is_active ? "on" : "off")}>
              {viewRole.is_active ? "Active" : "Inactive"}
            </span>

            <h3 className="rp-view-subhead">Granted permissions</h3>
            {viewLoading ? (
              <p className="rp-empty">Loading…</p>
            ) : viewRole.permissions?.length ? (
              <div className="rp-view-perms">
                {viewRole.permissions.map((code) => (
                  <span className="rp-perm-pill" key={code}>
                    {code}
                  </span>
                ))}
              </div>
            ) : (
              <p className="rp-empty">No permissions granted.</p>
            )}

            <div className="rp-modal-actions">
              <button type="button" className="rp-btn-sm" onClick={closeView}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {usersRole && (
        <div className="rp-modal-backdrop" onClick={closeUsers}>
          <div className="rp-modal rp-users-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="rp-modal-x" onClick={closeUsers} aria-label="Close">
              <X size={14} />
            </button>
            <h2>{usersRole.role_name} — users</h2>
            <p className="rp-view-desc">
              {usersLoading
                ? "Loading…"
                : `${roleUsers.length} ${roleUsers.length === 1 ? "person holds" : "people hold"} this role`}
            </p>

            <div className="rp-users-search">
              <Search size={15} />
              <input
                placeholder="Search by name or username"
                value={usersSearch}
                onChange={(e) => setUsersSearch(e.target.value)}
              />
            </div>

            {usersError && <p className="rp-empty">{usersError}</p>}
            {!usersLoading && !usersError && roleUsers.length === 0 && (
              <p className="rp-empty">Nobody holds this role yet.</p>
            )}

            <div className="rp-users-list">
              {roleUsers
                .filter((u) => {
                  const q = usersSearch.trim().toLowerCase();
                  return !q || u.full_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
                })
                .map((u) => {
                  const others = (u.roles || []).filter((r) => r !== usersRole.role_name);
                  return (
                    <div className="rp-user-row" key={u.user_id}>
                      <span className="rp-user-avatar"><EmployeeAvatar personId={u.person_id} size={40} /></span>
                      <div className="rp-user-text">
                        <b>{u.full_name}</b>
                        <span>
                          {u.designation ? `${u.designation} · ` : ""}
                          {u.username}
                        </span>
                        <span className="rp-user-chips">
                          {others.length ? others.map((r) => <i key={r}>{r}</i>) : <em>Only this role</em>}
                        </span>
                      </div>
                      <div className="rp-user-side">
                        <span className={"rp-pill " + (u.is_active ? "on" : "off")}>{u.is_active ? "Active" : "Inactive"}</span>
                        <small>{formatLastLogin(u.last_login)}</small>
                        <button
                          type="button"
                          className="rp-action-btn"
                          onClick={() => navigate(`/identity/users/${u.user_id}/edit`)}
                        >
                          <Pencil size={13} /> <span>Edit account</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="rp-modal-actions">
              <button type="button" className="rp-btn-sm" onClick={closeUsers}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmTarget && (
        <div className="rp-modal-backdrop" onClick={cancelToggleActive}>
          <div className="rp-modal rp-confirm" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="rp-modal-x" onClick={cancelToggleActive} aria-label="Close">
              <X size={14} />
            </button>
            <h2>{confirmTarget.is_active ? "Deactivate role?" : "Reactivate role?"}</h2>
            <p>
              {confirmTarget.is_active
                ? `${confirmTarget.role_name} will no longer be assignable to users.`
                : `${confirmTarget.role_name} will be assignable to users again.`}
            </p>
            <div className="rp-modal-actions">
              <button type="button" className="rp-btn-sm" onClick={cancelToggleActive}>
                Cancel
              </button>
              <button
                type="button"
                className={confirmTarget.is_active ? "rp-btn-sm rp-btn-danger" : "rp-btn-accent"}
                onClick={confirmToggleActive}
                disabled={confirming}
              >
                {confirming ? "Working…" : confirmTarget.is_active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RolesPermissions;
