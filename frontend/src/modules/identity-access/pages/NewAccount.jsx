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
  is_active: true,
  person_id: "",
  work_login_time: "",
  work_logout_time: "",
};

// Dedicated "Create login" page (System Administrator). Replaces the old
// popup. When opened from the Login requests panel's Approve button, the
// request arrives in location.state — creating the account then also
// approves that request (and its duplicate copies), same as before.
function NewAccount() {
  const navigate = useNavigate();
  const location = useLocation();
  const approvalRequest = location.state?.request || null;

  const [form, setForm] = useState(EMPTY_FORM);
  const [roles, setRoles] = useState([]);
  // Selected roles, by name, so Employee can be pre-selected before the role list has loaded.
  const [roleNames, setRoleNames] = useState(new Set());
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
            choosePerson(found);
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

  const toggleRole = (roleName) =>
    setRoleNames((prev) => {
      const next = new Set(prev);
      if (next.has(roleName)) next.delete(roleName);
      else next.add(roleName);
      return next;
    });

  // Picking a person pre-selects the Employee role for employees only
  // (students and interns don't get it). It can still be changed below.
  function choosePerson(person) {
    setForm((f) => ({ ...f, person_id: person ? String(person.person_id) : "" }));
    setRoleNames((prev) => {
      const next = new Set(prev);
      if (person?.is_employee) next.add("Employee");
      else next.delete("Employee");
      return next;
    });
  }

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
    if (roleNames.size === 0) {
      setFormError("Assign at least one role before creating this account.");
      return;
    }

    setSubmitting(true);
    const { work_login_time, work_logout_time, ...payload } = form;
    if (!payload.password) delete payload.password;

    try {
      const { data: created } = await client.post("/api/identity/users/", payload);
      for (const role of roles.filter((r) => roleNames.has(r.role_name))) {
        await client.put(`/api/identity/users/${created.user_id}/roles/${role.role_id}/`);
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
  const displayName = pickedPerson?.full_name || "Create login";
  const duration = workDuration(form.work_login_time, form.work_logout_time);
  const selectedRoles = roles.filter((r) => roleNames.has(r.role_name));
  // the person may already have a photo
  const photoPersonId = form.person_id || null;

  // "Ready to create" checklist: three required steps + optional timings.
  const checks = [
    { label: "Person", done: !!form.person_id },
    {
      label: "Sign-in",
      done: !!form.username.trim() && usernameStatus === "available" && PASSWORD_PATTERN.test(form.password),
    },
    { label: "Roles", done: roleNames.size > 0 },
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
            { label: "Create login" },
          ]}
        />
        <div className="dl2-ban-top">
          <div>
            <h1>Create login</h1>
            <p>Give someone who is already in the system a login</p>
          </div>
        </div>
      </div>

      <div className="dl2-body na-layout">
        <form className="ua-modal na-form" onSubmit={handleSubmit}>
          <section className="na-card">
            <h3><span className="na-n">1</span>Person</h3>
            <p className="ua-perm-hint">
              Choose a person who is already in the system. Add new employees in HR Admin &rarr; Employees first;
              they then appear here to be given a login.
            </p>
            <>
                <div className="ua-person-label-row">
                  <label>Person</label>
                  {(personSearch || form.person_id) && (
                    <button
                      type="button"
                      className="ua-person-clear"
                      onClick={() => {
                        setPersonSearch("");
                        choosePerson(null);
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
                  onChange={(e) => choosePerson(unlinkedPersons.find((p) => String(p.person_id) === e.target.value))}
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
                    Nobody is waiting for a login — everyone in the system already has one. Add the person in HR Admin &rarr; Employees first.
                  </p>
                )}
            </>
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
                const checked = roleNames.has(role.role_name);
                return (
                  <button
                    type="button"
                    key={role.role_id}
                    className={"ua2-chip" + (checked ? " on" : "") + (role.role_name === "System Administrator" ? " admin" : "")}
                    aria-pressed={checked}
                    onClick={() => toggleRole(role.role_name)}
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
              {submitting ? "Saving…" : "Create login"}
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
            <small>{pickedPerson ? "New login" : "Pick a person"}</small>
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
