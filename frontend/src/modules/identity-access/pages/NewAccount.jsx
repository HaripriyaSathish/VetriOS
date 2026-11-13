import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Camera, Check, CheckCircle2, Circle, Eye, EyeOff, LogIn, LogOut, ShieldCheck, UserPlus } from "lucide-react";
import client from "../../../api/client";
import Breadcrumbs from "../../../components/Breadcrumbs";
import { PASSWORD_HINT, PASSWORD_PATTERN, fmtClock, workDuration } from "../accountHelpers";
import { EmployeeAvatar } from "../../hr/components/EmployeeAvatar";
import "../../student/styles/StudentDashboard.css";
import "../../hr/styles/Attendance.css";
import "../../documents/styles/DocumentLibrary.css";
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
  work_login_time: "",
  work_logout_time: "",
};

// Dedicated "New account" page (System Administrator). Replaces the old
// popup. When opened from the Login requests panel's Approve button, the
// request arrives in location.state — creating the account then also
// approves that request (and its duplicate copies), same as before.
function NewAccount() {
  const navigate = useNavigate();
  const location = useLocation();
  const approvalRequest = location.state?.request || null;

  const [form, setForm] = useState(EMPTY_FORM);
  const [roles, setRoles] = useState([]);
  const [roleIds, setRoleIds] = useState(new Set());
  const [personMode, setPersonMode] = useState(approvalRequest ? "existing" : "new"); // "new" | "existing"
  const [unlinkedPersons, setUnlinkedPersons] = useState([]);
  const [unlinkedLoading, setUnlinkedLoading] = useState(true);
  const [personSearch, setPersonSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState("idle");
  const [usernameStatusMsg, setUsernameStatusMsg] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  // Roles + people without a login yet.
  useEffect(() => {
    client.get("/api/identity/roles/").then(({ data }) => setRoles(data)).catch(() => setRoles([]));
    client
      .get("/api/identity/persons/unlinked/")
      .then(({ data }) => {
        setUnlinkedPersons(data);
        // Approve flow: pre-select the person named in the request.
        if (approvalRequest) {
          const match = /^Create login credentials for (.+) \([^)]*\)$/.exec(approvalRequest.permission_requested);
          const found = data.find((p) => p.full_name === (match ? match[1] : ""));
          if (found) {
            setForm((f) => ({ ...f, person_id: String(found.person_id) }));
            setPersonSearch(found.full_name);
          }
        }
      })
      .catch(() => {
        // Non-fatal — "existing person" just has nobody to pick from.
      })
      .finally(() => setUnlinkedLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live "is this username free?" check, debounced.
  useEffect(() => {
    const username = form.username.trim();
    if (!username) {
      setUsernameStatus("idle");
      setUsernameStatusMsg("");
      return undefined;
    }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const { data } = await client.get("/api/identity/users/check-username/", { params: { username } });
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
  }, [form.username]);


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

  const toggleRole = (roleId) =>
    setRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });

  const filteredPersons = useMemo(() => {
    const q = personSearch.trim().toLowerCase();
    return unlinkedPersons.filter(
      (p) => !q || p.full_name.toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q)
    );
  }, [unlinkedPersons, personSearch]);

  // The other System Administrators got their own copy of an approved
  // login request — resolve those so nobody creates a duplicate account.
  const resolveDuplicateLoginRequests = async (approved) => {
    try {
      const { data: received } = await client.get("/api/identity/permission-requests/", { params: { box: "received" } });
      const duplicates = received.filter(
        (r) =>
          r.permission_request_id !== approved.permission_request_id &&
          r.status === "PENDING" &&
          r.permission_requested === approved.permission_requested
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
      // Non-fatal.
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (form.password && !PASSWORD_PATTERN.test(form.password)) {
      setFormError(PASSWORD_HINT);
      return;
    }
    if (roleIds.size === 0) {
      setFormError("Assign at least one role before creating this account.");
      return;
    }

    setSubmitting(true);
    const { work_login_time, work_logout_time, ...payload } = form;
    if (!payload.password) delete payload.password;
    if (personMode === "existing") {
      delete payload.first_name;
      delete payload.last_name;
      delete payload.email;
      delete payload.phone;
    } else {
      delete payload.person_id;
    }
    if (!payload.person_id) delete payload.person_id;

    try {
      const { data: created } = await client.post("/api/identity/users/", payload);
      for (const roleId of roleIds) {
        await client.put(`/api/identity/users/${created.user_id}/roles/${roleId}/`);
      }
      if (work_login_time || work_logout_time) {
        await client.put(`/api/identity/users/${created.user_id}/work-schedule/`, {
          login_time: work_login_time || "",
          logout_time: work_logout_time || "",
        });
      }

      await uploadPhoto(created.user_id);

      if (payload.password) {
        if (created.email_sent) {
          window.alert(`Login credentials sent to ${created.email_reason}.`);
        } else if (created.email_reason === "no_email_on_file") {
          window.alert("Account saved, but no email is on file for this person — share the credentials directly.");
        } else if (created.email_reason === "send_failed") {
          window.alert("Account saved, but the credentials email failed to send — share the credentials directly.");
        }
      }
      if (approvalRequest) {
        try {
          await client.post(`/api/identity/permission-requests/${approvalRequest.permission_request_id}/decide/`, {
            action: "approve",
            note: "Login created — credentials emailed to the employee.",
          });
          await resolveDuplicateLoginRequests(approvalRequest);
        } catch {
          // The account exists — worst case the request stays PENDING.
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

  const pickedPerson = unlinkedPersons.find((p) => String(p.person_id) === String(form.person_id));
  const typedName = `${form.first_name} ${form.last_name}`.trim();
  const displayName = (personMode === "existing" ? pickedPerson?.full_name : typedName) || "New account";
  const duration = workDuration(form.work_login_time, form.work_logout_time);
  const selectedRoles = roles.filter((r) => roleIds.has(r.role_id));
  // an existing person may already have a photo; a brand-new person has none yet
  const photoPersonId = personMode === "existing" && form.person_id ? form.person_id : null;

  // "Ready to create" checklist: three required steps + optional timings.
  const checks = [
    { label: "Person", done: personMode === "existing" ? !!form.person_id : !!form.first_name.trim() },
    {
      label: "Sign-in",
      done: !!form.username.trim() && usernameStatus === "available" && PASSWORD_PATTERN.test(form.password),
    },
    { label: "Roles", done: roleIds.size > 0 },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const timingsSet = !!(form.work_login_time && form.work_logout_time);

  return (
    <div className="na-page dl2">
      <div className="dl2-ban">
        <Breadcrumbs
          items={[
            { label: "System Administrator", to: "/dashboard", icon: ShieldCheck },
            { label: "User & Accounts", to: "/identity/users" },
            { label: "New account" },
          ]}
        />
        <div className="dl2-ban-top">
          <div>
            <h1>New account</h1>
            <p>Create a login for someone in your organisation</p>
          </div>
        </div>
      </div>

      <div className="dl2-body na-layout">
        <form className="ua-modal na-form" onSubmit={handleSubmit}>
          <section className="na-card">
            <h3><span className="na-n">1</span>Person</h3>
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

            {personMode === "existing" && (
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
                    const person = unlinkedPersons.find((p) => String(p.person_id) === e.currentTarget.value);
                    if (person) setPersonSearch(person.full_name);
                  }}
                  required
                  size={Math.min(6, Math.max(3, unlinkedPersons.length || 1))}
                >
                  {unlinkedLoading && <option value="">Loading…</option>}
                  {!unlinkedLoading &&
                    filteredPersons.map((p) => (
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

            {personMode === "new" && (
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
                    <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                  </div>
                </div>
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </>
            )}
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

            <label>Password</label>
            <div className="ua-password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
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
                    aria-pressed={checked}
                    onClick={() => toggleRole(role.role_id)}
                  >
                    {checked && <Check size={14} />}
                    {role.role_name}
                  </button>
                );
              })}
            </div>
            <p className="ua-perm-hint">A user can hold more than one role.</p>
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
              The time this person is expected to check in and out. Leave both empty to skip.
            </p>
          </section>

          <label className="ua-toggle-row na-active">
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
              {submitting ? "Saving…" : "Create account"}
            </button>
          </div>
        </form>

        <aside className="na-summary">
          <div className="na-sum-head">
            <div className="na-photo">
              {photoPreview ? (
                <img className="na-photo-img" src={photoPreview} alt="" />
              ) : (
                <EmployeeAvatar personId={photoPersonId} size={84} version={0} />
              )}
              <label className="na-photo-btn">
                <Camera size={14} /> {photoPreview || photoPersonId ? "Change photo" : "Add photo"}
                <input type="file" accept="image/*" hidden onChange={pickPhoto} />
              </label>
            </div>
            <b>{displayName}</b>
            <small>{personMode === "existing" ? "Existing person" : "New person"} · new login</small>
          </div>

          <div className="na-sum-body">
            <div className="na-sum-row">
              <span className="na-sum-lab"><ShieldCheck size={15} /> Roles</span>
              <div className="na-sum-roles">
                {selectedRoles.length ? (
                  selectedRoles.map((r) => <i key={r.role_id}>{r.role_name}</i>)
                ) : (
                  <em>None yet</em>
                )}
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
              <span className="na-sum-lab"><UserPlus size={15} /> Status</span>
              <span className={"na-sum-pill " + (form.is_active ? "on" : "off")}>{form.is_active ? "Active" : "Inactive"}</span>
            </div>
          </div>

          <div className="na-sum-check">
            <div className="na-sum-progress">
              <span>Ready to create</span>
              <b>{doneCount} of {checks.length}</b>
            </div>
            <div className="na-bar"><i style={{ width: `${(doneCount / checks.length) * 100}%` }} /></div>
            <ul>
              {checks.map((c) => (
                <li key={c.label} className={c.done ? "done" : ""}>
                  {c.done ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                  {c.label}
                </li>
              ))}
              <li className={timingsSet ? "done" : "optional"}>
                {timingsSet ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                Work timings <small>(optional)</small>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default NewAccount;
