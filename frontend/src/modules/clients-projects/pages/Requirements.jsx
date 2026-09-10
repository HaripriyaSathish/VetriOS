import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../../api/client";

const PRIORITY_STYLES = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-red-100 text-red-700",
};

const STATUS_STYLES = {
  OPEN: "bg-gray-100 text-gray-700",
  IN_DEVELOPMENT: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
};

function Requirements() {
  const { projectId } = useParams();
  const [requirements, setRequirements] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [isPM, setIsPM] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [reqTitle, setReqTitle] = useState("");
  const [reqDescription, setReqDescription] = useState("");
  const [reqType, setReqType] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [assignedTo, setAssignedTo] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    client.get(`/api/projects/${projectId}/requirements/`)
      .then(({ data }) => setRequirements(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load requirements."))
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
    client.get(`/api/projects/${projectId}/team/`)
      .then(({ data }) => setTeamMembers(data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const createRequirement = async () => {
    if (!reqTitle.trim()) {
      setError("Requirement title is required.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      await client.post(`/api/projects/${projectId}/requirements/`, {
        requirement_title: reqTitle,
        requirement_description: reqDescription,
        requirement_type: reqType,
        priority,
        assigned_to_user_id: assignedTo || null,
      });
      setMessage("Requirement added.");
      setReqTitle(""); setReqDescription(""); setReqType(""); setPriority("MEDIUM"); setAssignedTo("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't add requirement.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  const visible = filterUser
    ? requirements.filter((r) => String(r.assigned_to_user) === filterUser)
    : requirements;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/project/requirements" className="text-sm text-blue-600 hover:underline">
        ← Back to Projects
      </Link>

      <div className="flex justify-between items-center mt-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Requirements</h1>
        {isPM && (
          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            {showForm ? "Cancel" : "+ Add Requirement"}
          </button>
        )}
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {teamMembers.length > 0 && (
        <div className="mb-4">
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All team members</option>
            {teamMembers.map((m) => (
              <option key={m.project_team_member_id} value={m.user_id}>
                Assigned to: {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {isPM && showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">New Requirement</h3>
          <input
            placeholder="Requirement title"
            value={reqTitle}
            onChange={(e) => setReqTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <textarea
            placeholder="Description"
            value={reqDescription}
            onChange={(e) => setReqDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              placeholder="Type (e.g. UI/UX, Backend)"
              value={reqType}
              onChange={(e) => setReqType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
          >
            <option value="">Assign to team lead…</option>
            {teamMembers.map((m) => (
              <option key={m.project_team_member_id} value={m.user_id}>
                {m.name} ({m.project_role})
              </option>
            ))}
          </select>
          <button
            onClick={createRequirement}
            disabled={creating}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Adding…" : "Add Requirement"}
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No requirements yet.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <div key={r.project_requirement_id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="font-medium text-gray-900">{r.requirement_title}</p>
                <div className="flex gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_STYLES[r.priority] || PRIORITY_STYLES.MEDIUM}`}>
                    {r.priority}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[r.status] || STATUS_STYLES.OPEN}`}>
                    {r.status}
                  </span>
                </div>
              </div>
              {r.requirement_description && (
                <p className="text-sm text-gray-700 mb-2">{r.requirement_description}</p>
              )}
              <div className="flex gap-4 text-xs text-gray-600">
                {r.requirement_type && <span>Type: {r.requirement_type}</span>}
                {r.assigned_to_name && <span>Assigned to: {r.assigned_to_name}</span>}
                {r.requested_by_name && <span>Requested by: {r.requested_by_name}</span>}
                {r.target_date && <span>Target: {new Date(r.target_date).toLocaleDateString("en-IN")}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Requirements;