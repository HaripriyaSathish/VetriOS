import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Camera, Check, Eye, EyeOff, LogIn, LogOut, Pencil, ShieldCheck, UserCheck } from "lucide-react";
import client from "../../../api/client";
import Breadcrumbs from "../../../components/Breadcrumbs";
import {
  PASSWORD_HINT,
  PASSWORD_PATTERN,
  fmtClock,
  formatLastLogin,
  workDuration,
} from "../accountHelpers";
import { EmployeeAvatar } from "../../hr/components/EmployeeAvatar";
import "../../student/styles/StudentDashboard.css";
import "../../hr/styles/Attendance.css";
import "../../documents/styles/DocumentLibrary.css";
import "../styles/UserAccounts.css";

// Dedicated "Edit account" page (System Administrator). Replaces the old
// popup. Role changes apply immediately (same as the popup did); the
// other fields are saved with "Save changes".
function EditAccount() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(null);
  const [roles, setRoles] = useState([]);
  const [roleIds, setRoleIds] = useState(new Set());
  const [roleBusyId, setRoleBusyId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState("idle");
  const [usernameStatusMsg, setUsernameStatusMsg] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  useEffect(() => {
    Promise.all([
      client.get(`/api/identity/users/${id}/`),
      client.get("/api/identity/roles/"),
      client.get("/api/identity/user-roles/"),
    ])
      .then(([u, r, ur]) => {
        const loaded = u.data;
        const [first, ...rest] = (loaded.full_name || "").split(" ");
        setUser(loaded);
        setRoles(r.data);
        setRoleIds(new Set(ur.data.filter((x) => x.user_id === loaded.user_id).map((x) => x.role_id)));
        setForm({
          username: loaded.username,
          password: "",
          first_name: first || "",
          last_name: rest.join(" "),
          email: loaded.email || "",
          phone: "",
          is_active: loaded.is_active,
          work_login_time: loaded.work_login_time || "",
          work_logout_time: loaded.work_logout_time || "",
        });
      })
      .catch(() => setLoadError("Couldn't load this account."));
  }, [id]);

  // Live "is this username free?" check (ignores the account's own name).
  useEffect(() => {
    if (!form || !user) return undefined;
    const username = form.username.trim();
    if (!username || username === user.username) {
      setUsernameStatus("idle");
      setUsernameStatusMsg("");
      return undefined;
    }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const { data } = await client.get("/api/identity/users/check-username/", {
          params: { username, exclude: user.user_id },
        });
        if (data.available) {
          setUsernameStatus("available");
          setUsernameStatusMsg("Username available");
        } else {
          setUsernameStatus(/^3-30 characters/.test(data.reason) ? "invalid" : "taken");
          setUsernameStatusMsg(data.reason);
        }
      } catch {
        setUsernameStatus("idle");
        setUsernameStatusMsg("");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [form?.username, user]); // eslint-disable-line react-hooks/exhaustive-deps


  const pickPhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async (userId) => {
    if (!photoFile) return;
    const body = new FormData();
    body.append("file", photoFile);
    try {
      await client.post(`/api/identity/users/${userId}/avatar/`, body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch {
      window.alert("Account saved, but the profile photo couldn't be uploaded. Try again from Edit account.");
    }
  };

  const toggleRole = async (roleId) => {
    const has = roleIds.has(roleId);
    setRoleBusyId(roleId);
    setRoleIds((prev) => {
      const next = new Set(prev);
      if (has) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
    try {
      if (has) await client.delete(`/api/identity/users/${user.user_id}/roles/${roleId}/`);
      else await client.put(`/api/identity/users/${user.user_id}/roles/${roleId}/`);
    } catch {
      setFormError("Couldn't update that role.");
      setRoleIds((prev) => {
        const next = new Set(prev);
        if (has) next.add(roleId);
        else next.delete(roleId);
        return next;
      });
    } finally {
      setRoleBusyId(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (form.password && !PASSWORD_PATTERN.test(form.password)) {
      setFormError(PASSWORD_HINT);
      return;
    }
    setSubmitting(true);
    const { work_login_time, work_logout_time, ...payload } = form;
    if (!payload.password) delete payload.password;
    if (!payload.phone) delete payload.phone; // the form doesn't pre-fill it — don't blank it out

    try {
      const { data: saved } = await client.patch(`/api/identity/users/${user.user_id}/`, payload);
      const timesChanged =
        (work_login_time || "") !== (user.work_login_time || "") ||
        (work_logout_time || "") !== (user.work_logout_time || "");
      if (timesChanged) {
        await client.put(`/api/identity/users/${user.user_id}/work-schedule/`, {
          login_time: work_login_time || "",
          logout_time: work_logout_time || "",
        });
      }
      await uploadPhoto(user.user_id);

      if (payload.password) {
        if (saved.email_sent) {
          window.alert(`Login credentials sent to ${saved.email_reason}.`);
        } else if (saved.email_reason === "no_email_on_file") {
          window.alert("Account saved, but no email is on file for this person — share the credentials directly.");
        } else if (saved.email_reason === "send_failed") {
          window.alert("Account saved, but the credentials email failed to send — share the credentials directly.");
        }
      }
      navigate("/identity/users");
    } catch (err) {
      const data = err.response?.data;
      const firstError = data && Object.values(data)[0];
      setFormError(
        Array.isArray(firstError) ? firstError[0] : typeof firstError === "string" ? firstError : "Something went wrong."
      );
      setSubmitting(false);
    }
  };

  const crumbs = [
    { label: "System Administrator", to: "/dashboard", icon: ShieldCheck },
    { label: "User & Accounts", to: "/identity/users" },
    { label: "Edit account" },
  ];

  if (loadError || !form || !user) {
    return (
      <div className="na-page dl2">
        <div className="dl2-ban">
          <Breadcrumbs items={crumbs} />
          <div className="dl2-ban-top"><div><h1>Edit account</h1><p>{loadError || "Loading…"}</p></div></div>
        </div>
      </div>
    );
  }

  const displayName = `${form.first_name} ${form.last_name}`.trim() || user.full_name;
  const selectedRoles = roles.filter((r) => roleIds.has(r.role_id));
  const duration = workDuration(form.work_login_time, form.work_logout_time);

  return (
    <div className="na-page dl2">
      <div className="dl2-ban">
        <Breadcrumbs items={crumbs} />
        <div className="dl2-ban-top">
          <div>
            <h1>Edit account</h1>
            <p>Update sign-in, roles and work timings for {user.full_name}</p>
          </div>
        </div>
      </div>

      <div className="dl2-body na-layout">
        <form className="ua-modal na-form" onSubmit={handleSubmit}>
          <section className="na-card">
            <h3><span className="na-n">1</span>Person</h3>
            <div className="ua-form-row">
              <div>
                <label>First name</label>
                <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
              </div>
              <div>
                <label>Last name</label>
                <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <label>Phone</label>
            <input
              value={form.phone}
              placeholder="Leave blank to keep the current number"
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </section>

          <section className="na-card">
            <h3><span className="na-n">2</span>Sign-in</h3>
            <label>Username</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            {usernameStatus !== "idle" && (
              <p className={"ua-username-status ua-username-status-" + usernameStatus}>
                {usernameStatus === "available" && <Check size={13} />}
                {usernameStatus === "checking" ? "Checking availability…" : usernameStatusMsg}
              </p>
            )}

            <label>Reset password (optional)</label>
            <div className="ua-password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
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

          <section className="na-card">
            <h3><span className="na-n">3</span>Roles</h3>
            <div className="ua2-chips">
              {roles.map((role) => {
                const checked = roleIds.has(role.role_id);
                return (
                  <button
                    type="button"
                    key={role.role_id}
                    className={"ua2-chip" + (checked ? " on" : "") + (role.role_name === "System Administrator" ? " admin" : "")}
                    disabled={roleBusyId === role.role_id}
                    aria-pressed={checked}
                    onClick={() => toggleRole(role.role_id)}
                  >
                    {checked && <Check size={14} />}
                    {role.role_name}
                    {roleBusyId === role.role_id && " …"}
                  </button>
                );
              })}
            </div>
            <p className="ua-perm-hint">A user can hold more than one role — role changes apply immediately.</p>
          </section>

          <section className="na-card">
            <h3><span className="na-n">4</span>Work timings<span className="na-opt">Optional</span></h3>
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
              {duration && <span className="ua2-dur">{duration}</span>}
            </div>
            <p className="ua-perm-hint">
              The time this person is expected to check in and out. Leave both empty to clear.
            </p>
          </section>

          <label className="ua-toggle-row na-active">
            <span>
              <b>Active</b>
              <small>Can sign in</small>
            </span>
            <input
              type="checkbox"
              className="ua-switch"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
          </label>

          {formError && <p className="ua-error">{formError}</p>}

          <div className="na-actions">
            <button type="button" className="ua-btn-sm" onClick={() => navigate("/identity/users")}>
              Cancel
            </button>
            <button
              type="submit"
              className="ua-btn-accent"
              disabled={submitting || usernameStatus === "taken" || usernameStatus === "invalid"}
            >
              <Check size={18} />
              {submitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        <aside className="na-summary">
          <div className="na-sum-head">
            <div className="na-photo">
              {photoPreview ? (
                <img className="na-photo-img" src={photoPreview} alt="" />
              ) : (
                <EmployeeAvatar personId={user.person_id} size={84} version={0} />
              )}
              <label className="na-photo-btn">
                <Camera size={14} /> {photoPreview || user.person_id ? "Change photo" : "Add photo"}
                <input type="file" accept="image/*" hidden onChange={pickPhoto} />
              </label>
            </div>
            <b>{displayName}</b>
            <small>{user.designation || "No designation"} · {user.username}</small>
          </div>
          <div className="na-sum-body">
            <div className="na-sum-row">
              <span className="na-sum-lab"><ShieldCheck size={15} /> Roles</span>
              <div className="na-sum-roles">
                {selectedRoles.length ? selectedRoles.map((r) => <i key={r.role_id}>{r.role_name}</i>) : <em>None</em>}
              </div>
            </div>
            <div className="na-sum-row inline">
              <span className="na-sum-lab"><LogIn size={15} /> Check in</span>
              <b>{fmtClock(form.work_login_time) || "Not set"}</b>
            </div>
            <div className="na-sum-row inline">
              <span className="na-sum-lab"><LogOut size={15} /> Check out</span>
              <b>{fmtClock(form.work_logout_time) || "Not set"}</b>
            </div>
            <div className="na-sum-row inline">
              <span className="na-sum-lab"><Pencil size={15} /> Last login</span>
              <b>{formatLastLogin(user.last_login)}</b>
            </div>
            <div className="na-sum-row inline">
              <span className="na-sum-lab"><UserCheck size={15} /> Status</span>
              <span className={"na-sum-pill " + (form.is_active ? "on" : "off")}>{form.is_active ? "Active" : "Inactive"}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default EditAccount;
