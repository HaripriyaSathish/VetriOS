import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../../api/client";

const STATUS_STYLES = {
  STARTED: "bg-blue-100 text-blue-700",
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  ROLLED_BACK: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-gray-200 text-gray-600",
};

const ENV_STYLES = {
  staging: "bg-purple-100 text-purple-700",
  production: "bg-gray-900 text-white",
};

const NEXT_STATUS_OPTIONS = ["SUCCESS", "FAILED", "ROLLED_BACK", "CANCELLED"];

function DeploymentStatusControl({ deployment, onUpdated }) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const isTerminal = deployment.deployment_status !== "STARTED";
  if (isTerminal) return null;

  const updateStatus = async (newStatus) => {
    if (!newStatus) return;
    setUpdating(true);
    setError("");
    try {
      const { data } = await client.patch(
        `/api/projects/deployments/${deployment.project_deployment_id}/status/`,
        { deployment_status: newStatus }
      );
      onUpdated(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't update status.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <select
        disabled={updating}
        value=""
        onChange={(e) => updateStatus(e.target.value)}
        className="text-xs border border-gray-300 rounded-md px-2 py-1"
      >
        <option value="">Mark as…</option>
        {NEXT_STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {updating && <span className="text-xs text-gray-400">Updating…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

function Deployments() {
  const { projectId } = useParams();
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPM, setIsPM] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [environment, setEnvironment] = useState("staging");
  const [version, setVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    client.get(`/api/projects/${projectId}/deployments/`)
      .then(({ data }) => setDeployments(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load deployments."))
      .finally(() => setLoading(false));
  };

  const loadPmStatus = () => {
    client.get('/api/projects/me/')
      .then(({ data }) => {
        const match = data.find((p) => String(p.project_id) === String(projectId));
        setIsPM(match?.my_role === "Project Manager");
      })
      .catch(() => setIsPM(false));
  };

  useEffect(() => {
    load();
    loadPmStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const createDeployment = async () => {
    if (!environment) {
      setError("Environment is required.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      await client.post(`/api/projects/${projectId}/deployments/`, {
        environment_name: environment,
        deployment_version: version,
        release_notes: releaseNotes,
      });
      setMessage("Deployment logged.");
      setVersion(""); setReleaseNotes("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't log deployment.");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusUpdated = (updatedDeployment) => {
    setMessage(`Deployment marked ${updatedDeployment.deployment_status}.`);
    setDeployments((prev) =>
      prev.map((d) =>
        d.project_deployment_id === updatedDeployment.project_deployment_id
          ? updatedDeployment
          : d
      )
    );
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  const sorted = [...deployments].sort((a, b) => {
    const aDate = a.deployment_started_at || a.created_at;
    const bDate = b.deployment_started_at || b.created_at;
    return new Date(bDate) - new Date(aDate);
  });

  const currentProduction = sorted.find((d) => d.environment_name === "production" && d.deployment_status === "SUCCESS");
  const currentStaging = sorted.find((d) => d.environment_name === "staging" && d.deployment_status === "SUCCESS");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/project/deployments" className="text-sm text-blue-600 hover:underline">
        ← Back to Projects
      </Link>

      <div className="flex justify-between items-center mt-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Deployments</h1>
        {isPM && (
          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            {showForm ? "Cancel" : "+ Log Deployment"}
          </button>
        )}
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-purple-700 mb-1">Current Staging</p>
          {currentStaging ? (
            <>
              <p className="font-medium text-gray-900">{currentStaging.deployment_version || "—"}</p>
              <p className="text-xs text-gray-600">
                {new Date(currentStaging.deployment_completed_at || currentStaging.deployment_started_at).toLocaleDateString("en-IN")}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">No successful deployment yet</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-900 mb-1">Current Production</p>
          {currentProduction ? (
            <>
              <p className="font-medium text-gray-900">{currentProduction.deployment_version || "—"}</p>
              <p className="text-xs text-gray-600">
                {new Date(currentProduction.deployment_completed_at || currentProduction.deployment_started_at).toLocaleDateString("en-IN")}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">No successful deployment yet</p>
          )}
        </div>
      </div>

      {isPM && showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">New Deployment</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
            <input
              placeholder="Version (e.g. v1.0.0)"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <textarea
            placeholder="Release notes"
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
          />
          <button
            onClick={createDeployment}
            disabled={creating}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Logging…" : "Log Deployment"}
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No deployments yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((d) => (
            <div key={d.project_deployment_id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ENV_STYLES[d.environment_name] || "bg-gray-100 text-gray-700"}`}>
                    {d.environment_name}
                  </span>
                  <p className="font-medium text-gray-900">{d.deployment_version || "Unversioned"}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[d.deployment_status] || STATUS_STYLES.STARTED}`}>
                  {d.deployment_status}
                </span>
              </div>
              {d.release_notes && <p className="text-sm text-gray-700 mb-2">{d.release_notes}</p>}
              <div className="flex gap-4 text-xs text-gray-600">
                {d.deployed_by_name && <span>Deployed by: {d.deployed_by_name}</span>}
                {d.deployment_started_at && (
                  <span>Started: {new Date(d.deployment_started_at).toLocaleString("en-IN")}</span>
                )}
              </div>
              {isPM && <DeploymentStatusControl deployment={d} onUpdated={handleStatusUpdated} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Deployments;