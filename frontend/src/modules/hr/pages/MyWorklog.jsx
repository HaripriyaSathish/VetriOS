import { useEffect, useState } from "react";
import { Plus, SquarePen, Minus, Check, X, Eye } from "lucide-react";
import client from "../../../api/client";
import "../styles/HRDashboard.css";
import "../styles/Attendance.css";

const EMPTY_DRAFT = { start_time: "", end_time: "", description: "" };

function formatDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function isDraftFilled(draft) {
  return !!(draft.start_time.trim() && draft.end_time.trim() && draft.description.trim());
}

// Local "today" as YYYY-MM-DD, matching work_date's format from the API —
// used to tell which History row (if any) is still same-day editable.
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Employee-facing daily Worklog page — fill in today's time-blocks and
// submit; the backend routes it to your department's lead (or the
// Founder, if you *are* the lead) and emails it there. Not HR-gated:
// self-service only, same pattern as MyAttendance/MyLeave.
//
// Start/End are plain free-text fields — no time picker, no format
// enforced — you type it exactly how it should read (e.g. "9:30 am"),
// same as the paper worklog report this mirrors.
//
// Rows are added one at a time: the last row is always the live "draft"
// (its Actions cell shows "+Add"); once added it becomes a plain saved
// row with Edit/Remove instead. Only one worklog is allowed per day —
// the inline form on the page handles the first submission; after
// that, changes only happen through the Edit popup opened from
// History's Actions column (today's row only — every earlier date is
// locked).
function MyWorklog() {
  const [history, setHistory] = useState([]);
  const [employeeId, setEmployeeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [editingIndex, setEditingIndex] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const [formError, setFormError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewingWorklog, setViewingWorklog] = useState(null);

  const todaysHistoryRow = history.find((h) => h.work_date === todayStr());
  const alreadySubmittedToday = !!todaysHistoryRow && !editModalOpen;

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get("/api/hr/worklogs/me/");
      setEmployeeId(data.employee_id);
      setHistory(data.history || []);
    } catch (err) {
      setError("Couldn't load your worklog history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addDraftRow = () => {
    if (!isDraftFilled(draft)) return;
    setEntries((prev) => [...prev, { ...draft }]);
    setDraft({ ...EMPTY_DRAFT });
    setFormError("");
  };

  const startEdit = (i) => {
    setEditingIndex(i);
    setEditDraft({ ...entries[i] });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditDraft(null);
  };

  const saveEdit = () => {
    if (!isDraftFilled(editDraft)) return;
    setEntries((prev) => prev.map((e, i) => (i === editingIndex ? { ...editDraft } : e)));
    setEditingIndex(null);
    setEditDraft(null);
  };

  const deleteEntry = (i) => {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
    if (editingIndex === i) {
      setEditingIndex(null);
      setEditDraft(null);
    }
  };

  // Neither the in-progress "draft" row nor an in-progress edit have been
  // committed into `entries` yet — clicking Submit without first clicking
  // +/Save on whatever you were typing would silently drop that row.
  // Fold both in here (and reflect the fold-in back into state) so what
  // you see on screen when the confirm dialog opens is exactly what gets
  // sent.
  const openConfirm = () => {
    let finalEntries = [...entries];
    if (editingIndex !== null && isDraftFilled(editDraft)) {
      finalEntries[editingIndex] = { ...editDraft };
    }
    if (isDraftFilled(draft)) {
      finalEntries.push({ ...draft });
    }

    if (finalEntries.length === 0) {
      setFormError("Add at least one row before submitting.");
      return;
    }

    setEntries(finalEntries);
    setEditingIndex(null);
    setEditDraft(null);
    setDraft({ ...EMPTY_DRAFT });
    setFormError("");
    setConfirmOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        entries: entries.map((e) => ({
          start_time: e.start_time,
          end_time: e.end_time,
          description: e.description,
        })),
      };
      const { data } = await client.post("/api/hr/worklogs/me/", payload);
      setSubmitted(data);
      setEntries([]);
      setDraft({ ...EMPTY_DRAFT });
      setConfirmOpen(false);
      setEditModalOpen(false);
      await loadData();
    } catch (err) {
      const errData = err.response?.data;
      const firstError = errData && Object.values(errData)[0];
      setFormError(
        Array.isArray(firstError) ? firstError[0] : errData?.detail || "Something went wrong."
      );
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Loads today's already-submitted row into the edit popup. Only
  // reachable for today's row — History disables Edit for every
  // earlier date, so this never opens on a locked day.
  const openEditModal = (h) => {
    setEntries(h.entries.map((e) => ({ start_time: e.start_time, end_time: e.end_time, description: e.description })));
    setDraft({ ...EMPTY_DRAFT });
    setEditingIndex(null);
    setEditDraft(null);
    setFormError("");
    setSubmitted(null);
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEntries([]);
    setDraft({ ...EMPTY_DRAFT });
    setEditingIndex(null);
    setEditDraft(null);
    setFormError("");
  };

  const openView = (h) => setViewingWorklog(h);
  const closeView = () => setViewingWorklog(null);

  // Shared by the inline "Today's worklog" form (first submission) and
  // the Edit popup (same-day changes afterward) — identical add/edit/
  // remove interaction either way.
  const renderEntriesTable = () => (
    <div className="hr-table-scroll">
      <table className="hr-table wl-entry-table">
        <colgroup>
          <col className="wl-col-sno" />
          <col className="wl-col-time" />
          <col className="wl-col-time" />
          <col />
          <col className="wl-col-action" />
        </colgroup>
        <thead>
          <tr>
            <th>S.No</th>
            <th>Start</th>
            <th>End</th>
            <th>Work</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) =>
            editingIndex === i ? (
              <tr key={i}>
                <td className="hr-mono">{i + 1}</td>
                <td>
                  <input
                    className="wl-text-input"
                    value={editDraft.start_time}
                    onChange={(e) => setEditDraft({ ...editDraft, start_time: e.target.value })}
                    placeholder="9:30 am"
                  />
                </td>
                <td>
                  <input
                    className="wl-text-input"
                    value={editDraft.end_time}
                    onChange={(e) => setEditDraft({ ...editDraft, end_time: e.target.value })}
                    placeholder="11:30 am"
                  />
                </td>
                <td>
                  <input
                    className="wl-text-input"
                    value={editDraft.description}
                    onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                    placeholder="What did you work on?"
                  />
                </td>
                <td>
                  <div className="hr-row-actions">
                    <button
                      type="button"
                      className="hr-icon-btn"
                      title="Save"
                      aria-label={`Save row ${i + 1}`}
                      onClick={saveEdit}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      className="hr-icon-btn"
                      title="Cancel"
                      aria-label={`Cancel editing row ${i + 1}`}
                      onClick={cancelEdit}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={i}>
                <td className="hr-mono">{i + 1}</td>
                <td>{entry.start_time}</td>
                <td>{entry.end_time}</td>
                <td>{entry.description}</td>
                <td>
                  <div className="hr-row-actions">
                    <button
                      type="button"
                      className="hr-icon-btn"
                      title="Edit"
                      aria-label={`Edit row ${i + 1}`}
                      onClick={() => startEdit(i)}
                    >
                      <SquarePen size={14} />
                    </button>
                    <button
                      type="button"
                      className="hr-icon-btn danger"
                      title="Remove"
                      aria-label={`Remove row ${i + 1}`}
                      onClick={() => deleteEntry(i)}
                    >
                      <Minus size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}

          <tr>
            <td className="hr-mono">{entries.length + 1}</td>
            <td>
              <input
                className="wl-text-input"
                value={draft.start_time}
                onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
                placeholder="9:30 am"
              />
            </td>
            <td>
              <input
                className="wl-text-input"
                value={draft.end_time}
                onChange={(e) => setDraft({ ...draft, end_time: e.target.value })}
                placeholder="11:30 am"
              />
            </td>
            <td>
              <input
                className="wl-text-input"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="What did you work on?"
              />
            </td>
            <td>
              <button
                type="button"
                className="hr-icon-btn"
                title="Add row"
                aria-label="Add row"
                disabled={!isDraftFilled(draft)}
                onClick={addDraftRow}
              >
                <Plus size={14} />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="att-screen">
      <div className="att-head">
        <div>
          <span className="att-eyebrow">My workspace</span>
          <h1>Worklog</h1>
          <p>Submit your daily worklog — it's sent straight to your reporting lead.</p>
        </div>
      </div>

      {error && <p className="att-error">{error}</p>}
      {!loading && !employeeId && (
        <p className="att-error">No employee record is linked to your account — a worklog can't be submitted.</p>
      )}

      <div className="att-panel">
        <div className="att-panel-head">
          <div>
            <h3>Today's worklog</h3>
            <p>Add each time-block you worked, in order — e.g. "9:30 am".</p>
          </div>
        </div>

        {alreadySubmittedToday ? (
          <div className="wl-form-footer">
            <p className="hr-hint">
              Already submitted for today — click Edit on today's row in History below to make changes.
            </p>
          </div>
        ) : (
          <>
            {renderEntriesTable()}

            <div className="wl-form-footer">
              <div className="hr-modal-actions" style={{ justifyContent: "flex-end", margin: 0 }}>
                <button type="button" className="att-btn-accent" onClick={openConfirm} disabled={!employeeId}>
                  Submit worklog
                </button>
              </div>

              {formError && <p className="hr-error">{formError}</p>}
              {submitted && (
                <p className="hr-hint">
                  Submitted — reported to {submitted.reported_to_name || "no one (no lead assigned yet)"}.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="att-panel">
        <div className="att-panel-head">
          <div>
            <h3>History</h3>
            <p>Your last 30 days of submitted worklogs</p>
          </div>
        </div>

        {loading ? (
          <p className="hr-empty">Loading…</p>
        ) : history.length === 0 ? (
          <p className="hr-empty">You haven't submitted a worklog yet.</p>
        ) : (
          <div className="hr-table-scroll">
            <table className="hr-table wl-history-table">
              <colgroup>
                <col className="wl-col-date" />
                <col className="wl-col-login" />
                <col className="wl-col-logout" />
                <col className="wl-col-entries" />
                <col />
                <col className="wl-col-action" />
              </colgroup>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Login</th>
                  <th>Logout</th>
                  <th>Entries</th>
                  <th>Reported to</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const isToday = h.work_date === todayStr();
                  return (
                    <tr key={h.worklog_id}>
                      <td>{formatDate(h.work_date)}</td>
                      <td>{h.login_time || "—"}</td>
                      <td>{h.logout_time || "—"}</td>
                      <td>{h.entries.length}</td>
                      <td>{h.reported_to_name || "—"}</td>
                      <td>
                        <div className="hr-row-actions">
                          <button
                            type="button"
                            className="hr-icon-btn"
                            title="View"
                            aria-label={`View worklog for ${formatDate(h.work_date)}`}
                            onClick={() => openView(h)}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="hr-icon-btn"
                            title={isToday ? "Edit" : "Only today's worklog can be edited"}
                            aria-label={`Edit worklog for ${formatDate(h.work_date)}`}
                            disabled={!isToday}
                            onClick={() => openEditModal(h)}
                          >
                            <SquarePen size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmOpen && (
        <div className="hr-modal-backdrop" onClick={() => !submitting && setConfirmOpen(false)}>
          <div className="hr-modal hr-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>Submit today's worklog?</h2>
            <p>
              Only one worklog is allowed per day — if you already submitted today, this will overwrite
              it and re-send the email to your reporting lead.
            </p>
            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={() => setConfirmOpen(false)} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="hr-btn-accent" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModalOpen && !confirmOpen && (
        <div className="hr-modal-backdrop" onClick={closeEditModal}>
          <div className="hr-modal hr-modal-wide" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="hr-modal-x" onClick={closeEditModal} aria-label="Close">
              ✕
            </button>
            <h2>Edit today's worklog</h2>
            <p className="hr-hint">
              You can edit today's worklog any time before midnight. Once the date changes past 12:00 AM,
              this entry locks and can no longer be edited.
            </p>

            {renderEntriesTable()}

            {formError && <p className="hr-error">{formError}</p>}

            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={closeEditModal}>
                Cancel
              </button>
              <button type="button" className="hr-btn-accent" onClick={openConfirm}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingWorklog && (
        <div className="hr-modal-backdrop" onClick={closeView}>
          <div className="hr-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="hr-modal-x" onClick={closeView} aria-label="Close">
              ✕
            </button>
            <h2>Worklog — {formatDate(viewingWorklog.work_date)}</h2>
            <p className="hr-hint">Reported to {viewingWorklog.reported_to_name || "no one (no lead assigned yet)"}.</p>

            <div className="hr-table-scroll">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Work</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingWorklog.entries.map((e, i) => (
                    <tr key={i}>
                      <td className="hr-mono">{e.sno ?? i + 1}</td>
                      <td>{e.start_time}</td>
                      <td>{e.end_time}</td>
                      <td>{e.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={closeView}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyWorklog;
