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
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-200 text-gray-600",
};

function ClientRequests() {
  const { clientId } = useParams();
  const [requests, setRequests] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [targetDate, setTargetDate] = useState("");
  const [creating, setCreating] = useState(false);

  // Conversion state
  const [convertingId, setConvertingId] = useState(null);
  const [convertError, setConvertError] = useState("");
  const [projectPickerFor, setProjectPickerFor] = useState(null); // request_id currently choosing a project
  const [selectedProjectId, setSelectedProjectId] = useState("");

  // TODO: replace with your actual auth/user context
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const load = () => {
    setLoading(true);
    Promise.all([
      client.get(`/api/projects/clients/${clientId}/requests/`),
      client.get(`/api/projects/clients/${clientId}/`),
    ])
      .then(([reqRes, clientRes]) => {
        setRequests(reqRes.data);
        setProjects(clientRes.data.projects || []);
      })
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load requests."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const createRequest = async () => {
    if (!title.trim()) {
      setError("Request title is required.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      await client.post(`/api/projects/clients/${clientId}/requests/`, {
        request_title: title,
        request_description: description,
        request_type: requestType,
        priority,
        target_date: targetDate || null,
      });
      setMessage("Request logged.");
      setTitle(""); setDescription(""); setRequestType(""); setPriority("MEDIUM"); setTargetDate("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't log request.");
    } finally {
      setCreating(false);
    }
  };

  const startConvert = (requestId) => {
    setConvertError("");
    if (projects.length === 1) {
      convertToRequirement(requestId, projects[0].project_id);
    } else if (projects.length > 1) {
      setProjectPickerFor(requestId);
      setSelectedProjectId("");
    } else {
      setConvertError("This client has no projects to convert this request into.");
    }
  };

  const convertToRequirement = async (requestId, projectId) => {
    setConvertingId(requestId);
    setConvertError("");
    try {
      await client.post(`/api/projects/client-requests/${requestId}/convert/`, {
        project_id: projectId,
      });
      setMessage("Converted to requirement.");
      setProjectPickerFor(null);
      load();
    } catch (err) {
      setConvertError(err.response?.data?.detail || "Couldn't convert request.");
    } finally {
      setConvertingId(null);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  const sorted = [...requests].sort((a, b) => new Date(b.requested_date) - new Date(a.requested_date));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/clients/requests" className="text-sm text-blue-600 hover:underline">
        ← Back to Clients
      </Link>

      <div className="flex justify-between items-center mt-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Client Requests</h1>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
        >
          {showForm ? "Cancel" : "+ New Request"}
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        These feed into Requirements and Change Requests once assigned to a project.
      </p>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}
      {convertError && <p className="text-red-600 mb-4">{convertError}</p>}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">New Request</h3>
          <input
            placeholder="Request title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <div className="grid grid-cols-3 gap-3 mb-4">
            <input
              placeholder="Type (e.g. Feature, Bug, Query)"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
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
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={createRequest}
            disabled={creating}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Logging…" : "Log Request"}
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No requests logged yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((r) => {
            const isAssignee = r.assigned_to_user === currentUser.user_id;

            return (
              <div key={r.client_request_id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-gray-900">{r.request_title}</p>
                  <div className="flex gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_STYLES[r.priority] || PRIORITY_STYLES.MEDIUM}`}>
                      {r.priority}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[r.status] || STATUS_STYLES.OPEN}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
                {r.request_description && <p className="text-sm text-gray-700 mb-2">{r.request_description}</p>}
                <div className="flex gap-4 text-xs text-gray-600 mb-3">
                  {r.request_type && <span>Type: {r.request_type}</span>}
                  {r.assigned_to_name && <span>Assigned: {r.assigned_to_name}</span>}
                  {r.requested_date && <span>Logged: {new Date(r.requested_date).toLocaleDateString("en-IN")}</span>}
                  {r.target_date && <span>Target: {new Date(r.target_date).toLocaleDateString("en-IN")}</span>}
                </div>

                {r.converted_to_requirement ? (
                  <span className="text-xs text-green-700 font-semibold">
                    ✓ Converted to Requirement
                  </span>
                ) : isAssignee ? (
                  projectPickerFor === r.client_request_id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1.5 text-xs"
                      >
                        <option value="">Select project…</option>
                        {projects.map((p) => (
                          <option key={p.project_id} value={p.project_id}>
                            {p.project_name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => selectedProjectId && convertToRequirement(r.client_request_id, selectedProjectId)}
                        disabled={!selectedProjectId || convertingId === r.client_request_id}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md font-semibold disabled:opacity-60"
                      >
                        {convertingId === r.client_request_id ? "Converting…" : "Confirm"}
                      </button>
                      <button
                        onClick={() => setProjectPickerFor(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startConvert(r.client_request_id)}
                      disabled={convertingId === r.client_request_id}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md font-semibold disabled:opacity-60"
                    >
                      {convertingId === r.client_request_id ? "Converting…" : "Convert to Requirement"}
                    </button>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ClientRequests;