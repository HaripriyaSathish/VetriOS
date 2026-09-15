import { useEffect, useState } from "react";
import { ArrowUpRight, IdCard, KeyRound } from "lucide-react";
import client from "../../../api/client";
import Pagination, { paginate } from "../../../components/Pagination";
import "../styles/HRDashboard.css";
import "../styles/Attendance.css";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function initialsOf(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// 0/50/100 only — two checklist items right now (documents verified,
// offer letter acknowledged). The welcome email is on hold, so it
// doesn't factor into progress or status yet.
function statusFor(percent) {
  if (percent >= 100) return { label: "Completed", cls: "on" };
  if (percent > 0) return { label: "On track", cls: "warn" };
  return { label: "Needs action", cls: "off" };
}

// HR's Onboarding menu — two tabs: Interns (every ACTIVE intern from
// Haripriya's module_04_interns, read-only here) and External Applicants
// (not built yet). Checklist has two items — documents verified, offer
// letter acknowledged — sending the welcome email is on hold for now.
function Onboarding() {
  const [tab, setTab] = useState("interns"); // "interns" | "external"
  const [interns, setInterns] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [checklistIntern, setChecklistIntern] = useState(null);
  const [checklistDraft, setChecklistDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // "Assign designation and department" — its own action now, no longer
  // one row inside the general checklist. Saving here is what flips
  // designation_stipend_assigned to true.
  const [assignIntern, setAssignIntern] = useState(null);
  const [assignDraft, setAssignDraft] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  // "Request login to System Administrator" — same picker pattern as
  // the HR Employees page (which admin, exactly one), reusing the same
  // shared PermissionRequest API. login_credentials_provided flips to
  // true the moment the request is actually sent (that's HR's part of
  // the job done — same convention as documents_shared/welcome_email_sent
  // being "I did my action" checkboxes, not "the other side finished").
  const [loginRequestIntern, setLoginRequestIntern] = useState(null);
  const [loginRequestAdmins, setLoginRequestAdmins] = useState([]);
  const [loginRequestAdminsLoading, setLoginRequestAdminsLoading] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [loginRequestSubmitting, setLoginRequestSubmitting] = useState(false);
  const [loginRequestError, setLoginRequestError] = useState("");

  const loadInterns = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get("/api/hr/onboarding/interns/");
      setInterns(data);
    } catch (err) {
      setError("Couldn't load interns.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInterns();
    client
      .get("/api/hr/designations/")
      .then(({ data }) => setDesignations(data.filter((d) => d.is_active)))
      .catch(() => {});
    client
      .get("/api/hr/departments/")
      .then(({ data }) => setDepartments(data.filter((d) => d.is_active)))
      .catch(() => {});
  }, []);

  // A designation with no department_ids at all is cross-department (shown
  // everywhere, e.g. Team Lead/Project Lead) — one that DOES have
  // department_ids only shows once that specific department is picked.
  // No department picked yet -> only the cross-department ones show.
  const visibleDesignations = (departmentId) =>
    designations.filter((d) => {
      if (!d.department_ids || d.department_ids.length === 0) return true;
      return departmentId !== "" && d.department_ids.some((id) => String(id) === String(departmentId));
    });

  const openChecklist = (intern) => {
    setChecklistIntern(intern);
    setChecklistDraft({
      documents_shared: intern.documents_shared,
      signed_documents_received: intern.signed_documents_received,
      documents_verified: intern.documents_verified,
      welcome_email_sent: intern.welcome_email_sent,
      offer_letter_acknowledged: intern.offer_letter_acknowledged,
    });
    setSaveError("");
  };

  const closeChecklist = () => {
    setChecklistIntern(null);
    setChecklistDraft(null);
  };

  const saveChecklist = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        documents_shared: checklistDraft.documents_shared,
        signed_documents_received: checklistDraft.signed_documents_received,
        documents_verified: checklistDraft.documents_verified,
        welcome_email_sent: checklistDraft.welcome_email_sent,
        offer_letter_acknowledged: checklistDraft.offer_letter_acknowledged,
      };
      await client.patch(`/api/hr/onboarding/interns/${checklistIntern.intern_id}/`, payload);
      closeChecklist();
      await loadInterns();
    } catch (err) {
      const data = err.response?.data;
      const firstError = data && Object.values(data)[0];
      setSaveError(Array.isArray(firstError) ? firstError[0] : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const openAssign = (intern) => {
    setAssignIntern(intern);
    setAssignDraft({
      designation_id: intern.designation_id || "",
      department_id: intern.department_id || "",
      stipend_amount: intern.stipend_amount ?? "",
    });
    setAssignError("");
  };

  const closeAssign = () => {
    setAssignIntern(null);
    setAssignDraft(null);
  };

  const saveAssign = async () => {
    setAssigning(true);
    setAssignError("");
    try {
      await client.patch(`/api/hr/onboarding/interns/${assignIntern.intern_id}/`, {
        designation_id: assignDraft.designation_id === "" ? null : Number(assignDraft.designation_id),
        department_id: assignDraft.department_id === "" ? null : Number(assignDraft.department_id),
        stipend_amount: assignDraft.stipend_amount === "" ? null : assignDraft.stipend_amount,
        designation_stipend_assigned: true,
      });
      closeAssign();
      await loadInterns();
    } catch (err) {
      const data = err.response?.data;
      const firstError = data && Object.values(data)[0];
      setAssignError(Array.isArray(firstError) ? firstError[0] : "Something went wrong.");
    } finally {
      setAssigning(false);
    }
  };

  const openLoginRequest = async (intern) => {
    setLoginRequestIntern(intern);
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

  const closeLoginRequest = () => {
    setLoginRequestIntern(null);
    setLoginRequestAdmins([]);
    setSelectedAdminId("");
    setLoginRequestError("");
  };

  const sendLoginRequest = async () => {
    if (!selectedAdminId) {
      setLoginRequestError("Pick who this should go to.");
      return;
    }
    const intern = loginRequestIntern;
    setLoginRequestSubmitting(true);
    setLoginRequestError("");
    try {
      await client.post("/api/identity/permission-requests/", {
        admin_category: "System Administrator",
        target_admin_id: selectedAdminId,
        request_type: "GENERAL",
        permission_requested: `Create login credentials for ${intern.full_name} (${intern.intern_code})`,
        reason: `${intern.full_name} is an active intern (${intern.designation_name || "no designation yet"}) but doesn't have a login yet.`,
      });
      await client.patch(`/api/hr/onboarding/interns/${intern.intern_id}/`, {
        login_credentials_provided: true,
      });
      closeLoginRequest();
      await loadInterns();
    } catch (err) {
      setLoginRequestError(err.response?.data?.detail || "Couldn't send that request.");
    } finally {
      setLoginRequestSubmitting(false);
    }
  };

  return (
    <div className="att-screen">
      <div className="att-head">
        <div>
          <span className="att-eyebrow">HR</span>
          <h1>Onboarding</h1>
          <p>Every newly active intern lands here until onboarding is complete.</p>
        </div>
      </div>

      <div className="hr-tabs">
        <button
          className={"hr-tab" + (tab === "interns" ? " active" : "")}
          onClick={() => setTab("interns")}
        >
          Interns <span className="hr-tab-count">{interns.length}</span>
        </button>
        <button
          className={"hr-tab" + (tab === "external" ? " active" : "")}
          onClick={() => setTab("external")}
        >
          External Applicants
        </button>
      </div>

      {error && <p className="hr-error">{error}</p>}

      {tab === "interns" && (
        <>
          {loading ? (
            <p className="hr-empty">Loading…</p>
          ) : interns.length === 0 ? (
            <p className="hr-empty">No interns are waiting to be onboarded right now.</p>
          ) : (
            <>
            <div className="ob-grid">
              {paginate(interns, page, 6).map((i) => {
                const st = statusFor(i.progress_percent);
                return (
                  <div className="ob-card" key={i.intern_id}>
                    <div className="ob-card-head">
                      <div className="ob-avatar">{initialsOf(i.full_name)}</div>
                      <span className={"hr-pill " + st.cls}>{st.label}</span>
                    </div>
                    <div className="ob-card-body">
                      <h3>{i.full_name}</h3>
                      <p>{i.designation_name || i.intern_code}</p>
                    </div>
                    <div>
                      <div className="ob-progress-row">
                        <span>Started {formatDate(i.internship_start_date)}</span>
                        <strong>{i.progress_percent}%</strong>
                      </div>
                      <div className="ob-progress-track">
                        <div className="ob-progress-fill" style={{ width: `${i.progress_percent}%` }} />
                      </div>
                    </div>
                    <div className="ob-action-row">
                      <button type="button" className="ob-checklist-btn" onClick={() => openChecklist(i)}>
                        Checklist <ArrowUpRight size={14} />
                      </button>
                      <button type="button" className="ob-checklist-btn" onClick={() => openAssign(i)}>
                        <IdCard size={14} /> Assign
                      </button>
                      <button
                        type="button"
                        className={"ob-checklist-btn" + (i.login_credentials_provided ? " done" : "")}
                        disabled={!i.designation_stipend_assigned}
                        title={
                          !i.designation_stipend_assigned
                            ? "Assign a designation and department first"
                            : "Request login credentials"
                        }
                        onClick={() => openLoginRequest(i)}
                      >
                        <KeyRound size={14} /> Request login
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination page={page} totalItems={interns.length} onPageChange={setPage} pageSize={6} />
            </>
          )}
        </>
      )}

      {tab === "external" && (
        <div className="hr-panel">
          <p className="hr-empty">Not built yet.</p>
        </div>
      )}

      {checklistIntern && (
        <div className="hr-modal-backdrop" onClick={closeChecklist}>
          <div className="hr-modal hr-modal-wide" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="hr-modal-x" onClick={closeChecklist} aria-label="Close">
              ✕
            </button>
            <h2>{checklistIntern.full_name} - Onboarding checklist</h2>
            <p className="hr-hint">Intern ID: {checklistIntern.intern_code}</p>
            <p className="hr-hint">
              This is a manual checklist — tick each step yourself once it's actually done outside the app.
            </p>

            <div className="ob-checklist-row">
              <input
                type="checkbox"
                id="documents_shared"
                checked={checklistDraft.documents_shared}
                onChange={(e) =>
                  setChecklistDraft({ ...checklistDraft, documents_shared: e.target.checked })
                }
              />
              <label htmlFor="documents_shared">
                Step 1 · Documents shared
                <span className="ob-step-hint">Terms &amp; Conditions and Employment Agreement</span>
              </label>
            </div>
            <div className="ob-checklist-row">
              <input
                type="checkbox"
                id="signed_documents_received"
                checked={checklistDraft.signed_documents_received}
                onChange={(e) =>
                  setChecklistDraft({ ...checklistDraft, signed_documents_received: e.target.checked })
                }
              />
              <label htmlFor="signed_documents_received">
                Step 2 · Signed documents received
                <span className="ob-step-hint">Signed printout plus certificates, Aadhar, etc.</span>
              </label>
            </div>
            <div className="ob-checklist-row">
              <input
                type="checkbox"
                id="documents_verified"
                checked={checklistDraft.documents_verified}
                onChange={(e) =>
                  setChecklistDraft({ ...checklistDraft, documents_verified: e.target.checked })
                }
              />
              <label htmlFor="documents_verified">Step 3 · Document verification</label>
            </div>

            <div className="ob-checklist-row">
              <input
                type="checkbox"
                id="welcome_email_sent"
                checked={checklistDraft.welcome_email_sent}
                onChange={(e) =>
                  setChecklistDraft({ ...checklistDraft, welcome_email_sent: e.target.checked })
                }
              />
              <label htmlFor="welcome_email_sent">Step 4 · Offer letter sent</label>
            </div>
            <div className="ob-checklist-row">
              <input
                type="checkbox"
                id="offer_letter_acknowledged"
                checked={checklistDraft.offer_letter_acknowledged}
                onChange={(e) =>
                  setChecklistDraft({ ...checklistDraft, offer_letter_acknowledged: e.target.checked })
                }
              />
              <label htmlFor="offer_letter_acknowledged">Step 5 · Signed acknowledgement received</label>
            </div>

            {saveError && <p className="hr-error">{saveError}</p>}

            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={closeChecklist}>
                Cancel
              </button>
              <button type="button" className="hr-btn-accent" onClick={saveChecklist} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {assignIntern && (
        <div className="hr-modal-backdrop" onClick={closeAssign}>
          <div className="hr-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="hr-modal-x" onClick={closeAssign} aria-label="Close">
              ✕
            </button>
            <h2>{assignIntern.full_name} - Assign designation &amp; department</h2>
            <p className="hr-hint">Intern ID: {assignIntern.intern_code}</p>

            <div className="ob-assign-fields">
              <div>
                <label>Department</label>
                <select
                  value={assignDraft.department_id}
                  onChange={(e) => {
                    const department_id = e.target.value;
                    const stillValid = visibleDesignations(department_id).some(
                      (d) => String(d.designation_id) === String(assignDraft.designation_id)
                    );
                    setAssignDraft({
                      ...assignDraft,
                      department_id,
                      designation_id: stillValid ? assignDraft.designation_id : "",
                    });
                  }}
                >
                  <option value="">Not assigned</option>
                  {departments.map((d) => (
                    <option key={d.department_id} value={d.department_id}>
                      {d.department_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Designation</label>
                <select
                  value={assignDraft.designation_id}
                  onChange={(e) => setAssignDraft({ ...assignDraft, designation_id: e.target.value })}
                >
                  <option value="">Not assigned</option>
                  {visibleDesignations(assignDraft.department_id).map((d) => (
                    <option key={d.designation_id} value={d.designation_id}>
                      {d.designation_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Stipend amount</label>
                <input
                  type="number"
                  min="0"
                  value={assignDraft.stipend_amount}
                  onChange={(e) => setAssignDraft({ ...assignDraft, stipend_amount: e.target.value })}
                />
              </div>
            </div>

            {assignError && <p className="hr-error">{assignError}</p>}

            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={closeAssign}>
                Cancel
              </button>
              <button type="button" className="hr-btn-accent" onClick={saveAssign} disabled={assigning}>
                {assigning ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loginRequestIntern && (
        <div className="hr-modal-backdrop" onClick={closeLoginRequest}>
          <div className="hr-modal hr-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>Request login credentials</h2>
            <p>
              Send to which System Administrator, for <strong>{loginRequestIntern.full_name}</strong>?
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
                      name="onboarding-login-request-admin"
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
              <button type="button" className="hr-btn-sm" onClick={closeLoginRequest}>
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

export default Onboarding;
