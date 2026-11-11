import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Flag, CircleCheck, TriangleAlert, CalendarClock, ChevronDown } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

// chk_milestone_status on project_milestone.
const STATUS = {
  PLANNED: { label: "Planned", chip: "blue" },
  IN_PROGRESS: { label: "In Progress", chip: "orange" },
  COMPLETED: { label: "Completed", chip: "green" },
  ON_HOLD: { label: "On Hold", chip: "gray" },
  CANCELLED: { label: "Cancelled", chip: "red" },
};

const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

function Milestones() {
  const { projectId } = useParams();
  const [milestones, setMilestones] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPM, setIsPM] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [nowMs] = useState(() => Date.now());

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchMilestones = () =>
    client.get(`/api/projects/${projectId}/milestones/`)
      .then(({ data }) => setMilestones(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load milestones."))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchMilestones();
    client.get("/api/projects/me/")
      .then(({ data }) => {
        const match = data.find((p) => String(p.project_id) === String(projectId));
        setProject(match || null);
        setIsPM(match?.my_role === "Project Manager");
      })
      .catch(() => setIsPM(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const createMilestone = async () => {
    if (!name.trim() || !plannedEnd) {
      setFormError("Milestone name and target date are required.");
      return;
    }
    if (plannedStart && plannedStart > plannedEnd) {
      setFormError("The target date can't be before the planned start.");
      return;
    }
    setCreating(true);
    setFormError("");
    try {
      await client.post(`/api/projects/${projectId}/milestones/`, {
        milestone_name: name,
        description,
        planned_start_date: plannedStart || null,
        planned_end_date: plannedEnd,
      });
      setMessage("Milestone added.");
      setName(""); setDescription(""); setPlannedStart(""); setPlannedEnd("");
      setShowForm(false);
      fetchMilestones();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't add milestone.");
    } finally {
      setCreating(false);
    }
  };

  const changeStatus = async (m, status) => {
    setSavingId(m.project_milestone_id);
    setError("");
    try {
      const { data } = await client.patch(`/api/projects/milestones/${m.project_milestone_id}/`, { status });
      setMilestones((prev) => prev.map((x) => (x.project_milestone_id === data.project_milestone_id ? data : x)));
      setMessage(`"${m.milestone_name}" marked ${STATUS[status].label.toLowerCase()}.`);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't update the milestone.");
    } finally {
      setSavingId(null);
    }
  };

  const today = new Date(nowMs).toISOString().slice(0, 10);
  const weekOut = new Date(nowMs + 7 * 86400000).toISOString().slice(0, 10);
  const open = (m) => !["COMPLETED", "CANCELLED"].includes(m.status);
  const stateOf = (m) => {
    if (m.status === "COMPLETED") return "completed";
    if (open(m) && m.planned_end_date && m.planned_end_date < today) return "overdue";
    if (open(m) && m.planned_end_date && m.planned_end_date <= weekOut) return "due_soon";
    return "scheduled";
  };

  const sorted = [...milestones].sort((a, b) => {
    if (!a.planned_end_date) return 1;
    if (!b.planned_end_date) return -1;
    return new Date(a.planned_end_date) - new Date(b.planned_end_date);
  });
  const done = milestones.filter((m) => m.status === "COMPLETED").length;
  const overdue = milestones.filter((m) => stateOf(m) === "overdue").length;
  const next = sorted.find((m) => open(m) && m.planned_end_date && m.planned_end_date >= today);
  const pct = milestones.length ? Math.round((done * 100) / milestones.length) : 0;

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        section="Milestones"
        title={project ? `${project.project_name} Milestones` : "Milestones"}
        subtitle={project ? `${project.client_name} · delivery timeline` : "Delivery timeline for this project."}
        back="/project/milestones"
        backLabel="All projects"
      >
        {isPM && (
          <button type="button" className="bp-btn navy" onClick={() => { setShowForm(true); setFormError(""); }}><Plus size={16} /> Add Milestone</button>
        )}
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">MILESTONES</p><span className="pm-ico navy"><Flag size={20} /></span></div>
          <p className="bp-stat-value">{milestones.length}</p>
          <div className="pm-bar green"><span style={{ width: `${pct}%` }} /></div>
          <p className="pm-foot"><span>{pct}% delivered</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">COMPLETED</p><span className="pm-ico green"><CircleCheck size={20} /></span></div>
          <p className="bp-stat-value">{done}</p>
          <p className="pm-foot"><span>{milestones.length - done} remaining</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">OVERDUE</p><span className="pm-ico red"><TriangleAlert size={20} /></span></div>
          <p className={`bp-stat-value ${overdue ? "pm-warn" : ""}`}>{overdue}</p>
          <p className="pm-foot"><span>Past target, not completed</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">NEXT DUE</p><span className="pm-ico orange"><CalendarClock size={20} /></span></div>
          <p className="bp-stat-value pm-stat-text">{next ? day(next.planned_end_date) : "—"}</p>
          <p className="pm-foot"><span>{next ? next.milestone_name : "Nothing upcoming"}</span></p>
        </div>
      </div>

      <section className="bp-panel tr-card">
        <div className="tr-card-head">
          <div className="pm-card-title">
            <span className="pm-ico small soft"><Flag size={17} /></span>
            <div><h3>Delivery Timeline</h3><p>Sorted by target date</p></div>
          </div>
        </div>

        {loading ? <p className="pm-empty">Loading milestones…</p> : sorted.length === 0 ? <p className="pm-empty">No milestones yet.</p> : (
          <ol className="pm-timeline">
            {sorted.map((m) => {
              const st = STATUS[m.status] || STATUS.PLANNED;
              const state = stateOf(m);
              return (
                <li key={m.project_milestone_id} className={`pm-tl ${state}`}>
                  <span className="pm-tl-dot" />
                  <div className="pm-ms pm-tl-card">
                    <div className="pm-tl-main">
                      <b>{m.milestone_name}</b>
                      {m.description && <p className="pm-item-text">{m.description}</p>}
                      <p className="pm-item-meta">
                        {m.planned_start_date && <span>Start {day(m.planned_start_date)}</span>}
                        <span className={state === "overdue" ? "pm-warn" : ""}>Target {day(m.planned_end_date)}</span>
                        {m.actual_end_date && <span className="pm-ok">Completed {day(m.actual_end_date)}</span>}
                      </p>
                    </div>
                    <div className="pm-tl-side">
                      {state === "overdue" && <span className="bp-chip red">Overdue</span>}
                      {state === "due_soon" && <span className="bp-chip orange">Due soon</span>}
                      {isPM ? (
                        <label className="bp-select pm-status-select">
                          <select value={m.status} disabled={savingId === m.project_milestone_id} onChange={(e) => changeStatus(m, e.target.value)}>
                            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                          <ChevronDown size={14} />
                        </label>
                      ) : (
                        <span className={`bp-chip ${st.chip}`}>{st.label}</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {isPM && showForm && (
        <div className="bp-modal-backdrop" onClick={() => !creating && setShowForm(false)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Milestone</h2>
            <p className="bp-sub">Adds a delivery checkpoint to this project.</p>
            <div className="bp-form-grid">
              <label className="bp-field full"><span>Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Design sign-off" />
              </label>
              <label className="bp-field full"><span>Description</span>
                <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label className="bp-field"><span>Planned start</span>
                <input type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} />
              </label>
              <label className="bp-field"><span>Target date</span>
                <input type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} />
              </label>
            </div>
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setShowForm(false)} disabled={creating}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={createMilestone} disabled={creating}>{creating ? "Adding…" : "Add Milestone"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Milestones;
