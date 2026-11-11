import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Rocket, Server, CircleCheck, CircleX, UserRound, Clock3, ChevronDown, Search } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

// chk_project_deployment_status.
const STATUS_CHIP = { STARTED: "blue", SUCCESS: "green", FAILED: "red", ROLLED_BACK: "orange", CANCELLED: "gray" };
const STATUS_LABEL = { STARTED: "In Progress", SUCCESS: "Success", FAILED: "Failed", ROLLED_BACK: "Rolled Back", CANCELLED: "Cancelled" };
const NEXT_STATUS_OPTIONS = ["SUCCESS", "FAILED", "ROLLED_BACK", "CANCELLED"];

const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

function DeploymentStatusControl({ deployment, onUpdated }) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  if (deployment.deployment_status !== "STARTED") return null;

  const updateStatus = async (newStatus) => {
    if (!newStatus) return;
    setUpdating(true);
    setError("");
    try {
      const { data } = await client.patch(
        `/api/projects/deployments/${deployment.project_deployment_id}/status/`,
        { deployment_status: newStatus },
      );
      onUpdated(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't update status.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <span className="pm-inline-control">
      <label className="bp-select pm-status-select">
        <select disabled={updating} value="" onChange={(e) => updateStatus(e.target.value)}>
          <option value="">{updating ? "Updating…" : "Mark as…"}</option>
          {NEXT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <ChevronDown size={14} />
      </label>
      {error && <small className="pm-warn">{error}</small>}
    </span>
  );
}

function EnvCard({ label, deployment, tone }) {
  return (
    <div className={`pm-env ${tone}`}>
      <span className={`pm-ico ${tone === "prod" ? "navy" : "orange"}`}><Server size={20} /></span>
      <div>
        <p className="pm-env-label">{label}</p>
        {deployment ? (
          <>
            <b>{deployment.deployment_version || "Unversioned"}</b>
            <small>Live since {when(deployment.deployment_completed_at || deployment.deployment_started_at)}</small>
          </>
        ) : (
          <small>No successful deployment yet</small>
        )}
      </div>
    </div>
  );
}

function Deployments() {
  const { projectId } = useParams();
  const [deployments, setDeployments] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPM, setIsPM] = useState(false);
  const [envFilter, setEnvFilter] = useState("");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [environment, setEnvironment] = useState("staging");
  const [version, setVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchDeployments = () =>
    client.get(`/api/projects/${projectId}/deployments/`)
      .then(({ data }) => setDeployments(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load deployments."))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchDeployments();
    client.get("/api/projects/me/")
      .then(({ data }) => {
        const match = data.find((p) => String(p.project_id) === String(projectId));
        setProject(match || null);
        setIsPM(match?.my_role === "Project Manager");
      })
      .catch(() => setIsPM(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const createDeployment = async () => {
    if (!environment) {
      setFormError("Environment is required.");
      return;
    }
    setCreating(true);
    setFormError("");
    try {
      await client.post(`/api/projects/${projectId}/deployments/`, {
        environment_name: environment,
        deployment_version: version,
        release_notes: releaseNotes,
      });
      setMessage("Deployment logged.");
      setVersion(""); setReleaseNotes("");
      setShowForm(false);
      fetchDeployments();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't log deployment.");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusUpdated = (updated) => {
    setMessage(`Deployment marked ${STATUS_LABEL[updated.deployment_status] || updated.deployment_status}.`);
    setDeployments((prev) => prev.map((d) => (d.project_deployment_id === updated.project_deployment_id ? updated : d)));
  };

  const sorted = [...deployments].sort((a, b) => new Date(b.deployment_started_at || b.created_at) - new Date(a.deployment_started_at || a.created_at));
  const currentProduction = sorted.find((d) => d.environment_name === "production" && d.deployment_status === "SUCCESS");
  const currentStaging = sorted.find((d) => d.environment_name === "staging" && d.deployment_status === "SUCCESS");
  const by = (s) => deployments.filter((d) => d.deployment_status === s).length;
  const envs = [...new Set(deployments.map((d) => d.environment_name))];
  const visible = sorted.filter((d) => {
    if (envFilter && d.environment_name !== envFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || [d.deployment_version, d.release_notes, d.deployed_by_name].some((v) => (v || "").toLowerCase().includes(q));
  });

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        section="Deployments"
        title={project ? `${project.project_name} Deployments` : "Deployments"}
        subtitle={project ? `${project.client_name} · release history` : "Release history for this project."}
        back="/project/deployments"
        backLabel="All projects"
      >
        {isPM && (
          <button type="button" className="bp-btn navy" onClick={() => { setShowForm(true); setFormError(""); }}><Plus size={16} /> Log Deployment</button>
        )}
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">DEPLOYMENTS</p><span className="pm-ico navy"><Rocket size={20} /></span></div>
          <p className="bp-stat-value">{deployments.length}</p>
          <p className="pm-foot"><span>{by("STARTED")} in progress</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">SUCCESSFUL</p><span className="pm-ico green"><CircleCheck size={20} /></span></div>
          <p className="bp-stat-value">{by("SUCCESS")}</p>
          <p className="pm-foot"><span className="pm-ok">{deployments.length ? Math.round((by("SUCCESS") * 100) / deployments.length) : 0}% success rate</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">FAILED / ROLLED BACK</p><span className="pm-ico red"><CircleX size={20} /></span></div>
          <p className={`bp-stat-value ${by("FAILED") ? "pm-warn" : ""}`}>{by("FAILED") + by("ROLLED_BACK")}</p>
          <p className="pm-foot"><span>{by("CANCELLED")} cancelled</span></p>
        </div>
      </div>

      <div className="pm-grid even">
        <EnvCard label="Current Staging" deployment={currentStaging} tone="stage" />
        <EnvCard label="Current Production" deployment={currentProduction} tone="prod" />
      </div>

      <section className="bp-panel">
        <div className="pm-toolbar pm-toolbar-flat">
          <h3 className="pm-panel-title">Release History</h3>
          <div className="pm-toolbar-right">
            <label className="bp-search">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search version, notes…" />
            </label>
            <label className="bp-select">
              <select value={envFilter} onChange={(e) => setEnvFilter(e.target.value)}>
                <option value="">All environments</option>
                {envs.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </div>
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr><th>Version</th><th>Environment</th><th>Release Notes</th><th>Deployed</th><th>Status</th></tr>
            </thead>
            <tbody>
              {loading && <tr className="bp-empty-row"><td colSpan={5}>Loading deployments…</td></tr>}
              {!loading && visible.length === 0 && <tr className="bp-empty-row"><td colSpan={5}>{deployments.length ? "No deployments match these filters." : "No deployments yet."}</td></tr>}
              {visible.map((d, idx) => (
                <tr key={d.project_deployment_id} style={{ "--row": idx }}>
                  <td><b className="bp-strong">{d.deployment_version || "Unversioned"}</b></td>
                  <td><span className={`pm-area ${d.environment_name === "production" ? "prod" : ""}`}><Server size={12} /> {d.environment_name}</span></td>
                  <td className="pm-notes-cell">{d.release_notes || <span className="bp-muted">—</span>}</td>
                  <td>
                    <div className="pm-owner">
                      <div>
                        <b><UserRound size={11} /> {d.deployed_by_name || "—"}</b>
                        <small><Clock3 size={11} /> {when(d.deployment_started_at || d.created_at)}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="pm-status-cell">
                      <span className={`bp-chip ${STATUS_CHIP[d.deployment_status] || "blue"}`}>{STATUS_LABEL[d.deployment_status] || d.deployment_status}</span>
                      {isPM && <DeploymentStatusControl deployment={d} onUpdated={handleStatusUpdated} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isPM && showForm && (
        <div className="bp-modal-backdrop" onClick={() => !creating && setShowForm(false)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Log Deployment</h2>
            <p className="bp-sub">Records a release; mark it Success or Failed once it finishes.</p>
            <div className="bp-form-grid">
              <label className="bp-field"><span>Environment</span>
                <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </label>
              <label className="bp-field"><span>Version</span>
                <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. v1.0.0" />
              </label>
              <label className="bp-field full"><span>Release notes</span>
                <textarea rows={3} value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} />
              </label>
            </div>
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setShowForm(false)} disabled={creating}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={createDeployment} disabled={creating}>{creating ? "Logging…" : "Log Deployment"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Deployments;
