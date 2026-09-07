import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import client from "../../../api/client";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [checklistIntern, setChecklistIntern] = useState(null);
  const [checklistDraft, setChecklistDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

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
  }, []);

  const openChecklist = (intern) => {
    setChecklistIntern(intern);
    setChecklistDraft({
      designation_id: intern.designation_id || "",
      stipend_amount: intern.stipend_amount ?? "",
      documents_verified: intern.documents_verified,
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
        designation_id: checklistDraft.designation_id === "" ? null : Number(checklistDraft.designation_id),
        stipend_amount: checklistDraft.stipend_amount === "" ? null : checklistDraft.stipend_amount,
        documents_verified: checklistDraft.documents_verified,
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
            <div className="ob-grid">
              {interns.map((i) => {
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
                    <button type="button" className="ob-checklist-btn" onClick={() => openChecklist(i)}>
                      Open checklist <ArrowUpRight size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
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
          <div className="hr-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="hr-modal-x" onClick={closeChecklist} aria-label="Close">
              ✕
            </button>
            <h2>{checklistIntern.full_name}</h2>
            <p className="hr-hint">{checklistIntern.intern_code}</p>

            <label>Designation</label>
            <select
              value={checklistDraft.designation_id}
              onChange={(e) => setChecklistDraft({ ...checklistDraft, designation_id: e.target.value })}
            >
              <option value="">Not assigned</option>
              {designations.map((d) => (
                <option key={d.designation_id} value={d.designation_id}>
                  {d.designation_name}
                </option>
              ))}
            </select>

            <label>Stipend amount</label>
            <input
              type="number"
              min="0"
              value={checklistDraft.stipend_amount}
              onChange={(e) => setChecklistDraft({ ...checklistDraft, stipend_amount: e.target.value })}
            />

            <div className="ob-checklist-row">
              <input
                type="checkbox"
                id="documents_verified"
                checked={checklistDraft.documents_verified}
                onChange={(e) =>
                  setChecklistDraft({ ...checklistDraft, documents_verified: e.target.checked })
                }
              />
              <label htmlFor="documents_verified">Documents verified</label>
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
              <label htmlFor="offer_letter_acknowledged">Offer letter acknowledged</label>
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
    </div>
  );
}

export default Onboarding;
