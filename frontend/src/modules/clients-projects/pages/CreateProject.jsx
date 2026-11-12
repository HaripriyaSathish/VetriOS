import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CalendarDays, FolderPlus, Flag, UserRound, FileText } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

function CreateProject() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const [clientId, setClientId] = useState("");
  const [pmUserId, setPmUserId] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  useEffect(() => {
    Promise.all([
      client.get("/api/projects/clients/"),
      client.get("/api/projects/users-lookup/"),
    ])
      .then(([clientsRes, usersRes]) => {
        setClients(clientsRes.data);
        setUsers(usersRes.data);
      })
      .catch(() => setError("Couldn't load clients or users."))
      .finally(() => setLoading(false));
  }, []);

  const createProject = async (event) => {
    event.preventDefault();
    if (!clientId || !pmUserId || !projectCode.trim() || !projectName.trim() || !startDate) {
      setError("Client, Project Manager, code, name, and start date are all required.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const { data } = await client.post("/api/projects/create/", {
        client_id: clientId,
        project_manager_user_id: pmUserId,
        project_code: projectCode,
        project_name: projectName,
        description,
        start_date: startDate,
        planned_end_date: plannedEndDate || null,
        priority,
      });
      navigate(`/project/${data.project_id}/team`);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't create project.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="bp-loading">Loading…</p>;

  const selectedClient = clients.find((c) => String(c.client_id) === String(clientId));
  const selectedPm = users.find((u) => String(u.user_id) === String(pmUserId));

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        eyebrow="Project Workspace"
        section="New Project"
        title="Create Project"
        subtitle="Set up a project for a client and assign its Project Manager. You'll build the team next."
        back="/project/dashboard"
        backLabel="Project Dashboard"
      />

      <div className="pm-grid">
        <form className="bp-panel tr-card" onSubmit={createProject}>
          <div className="tr-card-head">
            <div>
              <h3><FolderPlus size={18} /> Project details</h3>
              <p>Fields marked * are required.</p>
            </div>
          </div>

          <div className="bp-form-grid">
            <label className="bp-field">
              <span>Client *</span>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.client_id} value={c.client_id}>{c.client_name}</option>
                ))}
              </select>
            </label>
            <label className="bp-field">
              <span>Project Manager *</span>
              <select value={pmUserId} onChange={(e) => setPmUserId(e.target.value)}>
                <option value="">Select project manager…</option>
                {users.map((u) => (
                  <option key={u.user_id} value={u.user_id}>{u.name}</option>
                ))}
              </select>
            </label>
            <label className="bp-field">
              <span>Project code *</span>
              <input placeholder="e.g. PRJ-HYUNDAI-01" value={projectCode} onChange={(e) => setProjectCode(e.target.value)} />
            </label>
            <label className="bp-field">
              <span>Project name *</span>
              <input placeholder="e.g. Hyundai Website Redesign" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            </label>
            <label className="bp-field full">
              <span>Description</span>
              <textarea rows={4} placeholder="Scope, goals and key deliverables…" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className="bp-field">
              <span>Start date *</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="bp-field">
              <span>Planned end date</span>
              <input type="date" value={plannedEndDate} min={startDate || undefined} onChange={(e) => setPlannedEndDate(e.target.value)} />
            </label>
          </div>

          <div className="bp-field">
            <span>Priority</span>
            <div className="bp-tabs pm-fit">
              {PRIORITIES.map((p) => (
                <button key={p.value} type="button" className={`bp-tab ${priority === p.value ? "active" : ""}`} onClick={() => setPriority(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="bp-form-error">{error}</p>}

          <div className="bp-actions">
            <button type="submit" className="bp-btn orange" disabled={creating}>
              <FolderPlus size={16} /> {creating ? "Creating…" : "Create Project"}
            </button>
            <button type="button" className="bp-btn outline" onClick={() => navigate(-1)}>Cancel</button>
          </div>
        </form>

        <aside className="bp-panel tr-card pm-fit">
          <div className="tr-card-head">
            <div>
              <h3><FileText size={18} /> Summary</h3>
              <p>What will be created</p>
            </div>
          </div>
          <dl className="pm-facts">
            <div><dt>Client</dt><dd><Building2 size={13} style={{ verticalAlign: "-2px" }} /> {selectedClient?.client_name || "—"}</dd></div>
            <div><dt>Manager</dt><dd><UserRound size={13} style={{ verticalAlign: "-2px" }} /> {selectedPm?.name || "—"}</dd></div>
            <div><dt>Code</dt><dd>{projectCode || "—"}</dd></div>
            <div><dt>Priority</dt><dd><span className={`pm-priority ${priority}`}><Flag size={13} /> {PRIORITIES.find((p) => p.value === priority)?.label}</span></dd></div>
            <div><dt>Start</dt><dd><CalendarDays size={13} style={{ verticalAlign: "-2px" }} /> {startDate || "—"}</dd></div>
            <div><dt>Planned end</dt><dd><CalendarDays size={13} style={{ verticalAlign: "-2px" }} /> {plannedEndDate || "—"}</dd></div>
          </dl>
          <p className="pm-small bp-muted">After creating, you'll land on the project's Team page to add members.</p>
        </aside>
      </div>
    </div>
  );
}

export default CreateProject;
