import { useEffect, useState } from "react";
import client from "../../../api/client";
import Pagination, { paginate } from "../../../components/Pagination";
import "../styles/UserAccounts.css";

const EMPTY_FORM = {
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  is_active: true,
  person_id: "",
};

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

  const [editRoleIds, setEditRoleIds] = useState(new Set());
  const [roleToggleBusyId, setRoleToggleBusyId] = useState(null);
  const [createRoleIds, setCreateRoleIds] = useState(new Set());

  const [personMode, setPersonMode] = useState("new"); // "new" | "existing"
  const [unlinkedPersons, setUnlinkedPersons] = useState([]);
  const [unlinkedLoading, setUnlinkedLoading] = useState(false);
  const [personSearch, setPersonSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [permUser, setPermUser] = useState(null);
  const [permRows, setPermRows] = useState([]); // [{permission_id, code, name, viaRole, override}]
  const [permLoading, setPermLoading] = useState(false);
  const [permError, setPermError] = useState("");
  const [permPendingId, setPermPendingId] = useState(null);

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
  }, []);

  const openCreate = async () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setPersonMode("new");
    setUnlinkedPersons([]);
    setPersonSearch("");
    setShowPassword(false);
    setCreateRoleIds(new Set());
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
    });
    setFormError("");
    setEditRoleIds(new Set());
    setShowPassword(false);
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

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");

    const payload = { ...form };
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
      if (editingUser) {
        await client.patch(`/api/identity/users/${editingUser.user_id}/`, payload);
      } else {
        const { data: created } = await client.post("/api/identity/users/", payload);
        // Roles are assigned as separate calls, same endpoint the Edit
        // modal's checkboxes use — a brand-new account can start with
        // more than one role, same as any existing one can hold.
        for (const roleId of createRoleIds) {
          await client.put(`/api/identity/users/${created.user_id}/roles/${roleId}/`);
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
    const next = row.override === null ? "ALLOW" : row.override === "ALLOW" ? "DENY" : null;
    setPermPendingId(row.permission_id);
    setPermRows((prev) =>
      prev.map((r) => (r.permission_id === row.permission_id ? { ...r, override: next } : r))
    );
    try {
      if (next === null) {
        await client.delete(`/api/identity/users/${permUser.user_id}/permissions/${row.permission_id}/`);
      } else {
        await client.put(`/api/identity/users/${permUser.user_id}/permissions/${row.permission_id}/`, {
          effect: next,
        });
      }
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

  return (
    <div className="ua-screen">
      <div className="ua-head">
        <div>
          <h1>User accounts</h1>
          <p>{users.length} accounts · user_account, person</p>
        </div>
        <button className="ua-btn-accent" onClick={openCreate}>
          + New account
        </button>
      </div>

      {error && <p className="ua-error">{error}</p>}

      <div className="ua-panel">
        <div className="ua-panel-head">
          <h3>All accounts</h3>
        </div>

        {loading ? (
          <p className="ua-empty">Loading…</p>
        ) : (
          <>
          <div className="ua-table-scroll">
            <table className="ua-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginate(users, page).map((user) => (
                  <tr key={user.user_id}>
                    <td>
                      <div className="ua-cell-user">
                        <div className="ua-avatar">{initials(user.full_name)}</div>
                        <div>
                          <div className="ua-name">{user.full_name}</div>
                          <div className="ua-sub">{user.username}</div>
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
                        {user.is_active ? "● Active" : "○ Inactive"}
                      </span>
                    </td>
                    <td className="ua-mono">{user.last_login ? new Date(user.last_login).toLocaleString() : "—"}</td>
                    <td className="ua-actions">
                      <button className="ua-btn-sm" onClick={() => openEdit(user)}>
                        Edit
                      </button>
                      <button className="ua-btn-sm" onClick={() => openPermissions(user)}>
                        Permissions
                      </button>
                      <button className="ua-btn-sm ua-btn-danger" onClick={() => requestToggleActive(user)}>
                        {user.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalItems={users.length} onPageChange={setPage} />
          </>
        )}
      </div>

      {modalOpen && (
        <div className="ua-modal-backdrop" onClick={closeModal}>
          <form className="ua-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <h2>{editingUser ? "Edit account" : "New account"}</h2>

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

            <label>Username</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />

            <label>{editingUser ? "Reset password (optional)" : "Password"}</label>
            <div className="ua-password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editingUser}
              />
              <button
                type="button"
                className="ua-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>

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

            <label>Roles</label>
            <div className="ua-role-checks">
              {roles.map((role) => {
                const checked = editingUser
                  ? editRoleIds.has(role.role_id)
                  : createRoleIds.has(role.role_id);
                const busy = editingUser && roleToggleBusyId === role.role_id;
                return (
                  <label className="ua-role-check" key={role.role_id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={() =>
                        editingUser ? toggleEditRole(role.role_id) : toggleCreateRole(role.role_id)
                      }
                    />
                    {role.role_name}
                    {busy && " …"}
                  </label>
                );
              })}
            </div>
            <p className="ua-perm-hint">
              A user can hold more than one role{editingUser ? " — changes apply immediately." : "."}
            </p>

            <label className="ua-checkbox">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Active
            </label>

            {formError && <p className="ua-error">{formError}</p>}

            <div className="ua-modal-actions">
              <button type="button" className="ua-btn-sm" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="ua-btn-accent" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmTarget && (
        <div className="ua-modal-backdrop" onClick={cancelToggleActive}>
          <div className="ua-modal ua-confirm" onClick={(e) => e.stopPropagation()}>
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
            <h2>
              {permUser.full_name}'s permissions
              {!permLoading && (
                <span className="ua-perm-total-count">
                  {" "}
                  ({permEffectiveCount}/{permRows.length})
                </span>
              )}
            </h2>
            <p className="ua-perm-hint">
              {permUser.full_name} already has the permissions marked "via role", granted through
              their assigned role(s). Use this screen only to override a specific permission for
              this user — click once to Allow, click again to Deny, click again to reset.
            </p>

            {permError && <p className="ua-error">{permError}</p>}

            {permLoading ? (
              <p className="ua-empty">Loading…</p>
            ) : (
              <div className="ua-perm-groups">
                {permGroups.map(([name, rows]) => (
                  <div className="ua-perm-group" key={name}>
                    <div className="ua-perm-group-name">
                      {name} ({rows.filter(isEffective).length}/{rows.length})
                    </div>
                    {rows.map((row) => {
                      const effective = isEffective(row);
                      const busy = permPendingId === row.permission_id;
                      return (
                        <button
                          key={row.permission_id}
                          className={
                            "ua-perm-row" +
                            (row.override === "ALLOW" ? " allow" : row.override === "DENY" ? " deny" : "") +
                            (effective ? " effective" : "")
                          }
                          onClick={() => cyclePermission(row)}
                          disabled={busy}
                        >
                          <span className="ua-perm-code">{row.code}</span>
                          <span className="ua-perm-state">
                            {busy
                              ? "…"
                              : row.override
                              ? row.override === "ALLOW"
                                ? "Allow"
                                : "Deny"
                              : row.viaRole
                              ? "via role"
                              : "—"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
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
