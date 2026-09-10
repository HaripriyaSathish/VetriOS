import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../../../api/client";

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

  const createProject = async () => {
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

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Create Project</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <label className="text-xs text-gray-600 block mb-1">Client</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
        >
          <option value="">Select client…</option>
          {clients.map((c) => (
            <option key={c.client_id} value={c.client_id}>{c.client_name}</option>
          ))}
        </select>

        <label className="text-xs text-gray-600 block mb-1">Project Manager</label>
        <select
          value={pmUserId}
          onChange={(e) => setPmUserId(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
        >
          <option value="">Select project manager…</option>
          {users.map((u) => (
            <option key={u.user_id} value={u.user_id}>{u.name}</option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Project code</label>
            <input
              placeholder="e.g. PRJ-HYUNDAI-01"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Project name</label>
            <input
              placeholder="e.g. Hyundai Website Redesign"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label className="text-xs text-gray-600 block mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
        />

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Planned end date</label>
            <input
              type="date"
              value={plannedEndDate}
              onChange={(e) => setPlannedEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>

        <button
          onClick={createProject}
          disabled={creating}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create Project"}
        </button>
      </div>
    </div>
  );
}

export default CreateProject;