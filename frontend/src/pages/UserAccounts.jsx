import { useEffect, useState } from "react";
import client from "../api/client";
import Pagination, { paginate } from "../components/Pagination";
import "./UserAccounts.css";

const EMPTY_FORM = {
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role_id: "",
  is_active: true,
};

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

  const openCreate = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (user) => {
    const [first, ...rest] = (user.full_name || "").split(" ");
    setEditingUser(user);
    setForm({
      username: user.username,
      password: "",
      first_name: first || "",
      last_name: rest.join(" "),
      email: user.email || "",
      phone: "",
      role_id: "",
      is_active: user.is_active,
    });
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");

    const payload = { ...form };
    if (!payload.password) delete payload.password;
    if (!payload.role_id) delete payload.role_id;

    try {
      if (editingUser) {
        await client.patch(`/api/identity/users/${editingUser.user_id}/`, payload);
      } else {
        await client.post("/api/identity/users/", payload);
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
                  <th></th>
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

            <label>Username</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />

            <label>{editingUser ? "Reset password (optional)" : "Password"}</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editingUser}
            />

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

            <label>Role</label>
            <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
              <option value="">Leave unchanged / none</option>
              {roles.map((role) => (
                <option key={role.role_id} value={role.role_id}>
                  {role.role_name}
                </option>
              ))}
            </select>

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
    </div>
  );
}

export default UserAccounts;
