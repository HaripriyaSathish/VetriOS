import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../../api/client";

const STATUS_STYLES = {
  PLANNED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  DELAYED: "bg-red-100 text-red-700",
};

function Milestones() {
  const { projectId } = useParams();
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    client.get(`/api/projects/${projectId}/milestones/`)
      .then(({ data }) => setMilestones(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load milestones."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const createMilestone = async () => {
    if (!name.trim() || !plannedEnd) {
      setError("Milestone name and target date are required.");
      return;
    }
    setCreating(true);
    setError("");
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
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't add milestone.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  const sorted = [...milestones].sort((a, b) => {
    if (!a.planned_end_date) return 1;
    if (!b.planned_end_date) return -1;
    return new Date(a.planned_end_date) - new Date(b.planned_end_date);
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/project/milestones" className="text-sm text-blue-600 hover:underline">
        ← Back to Projects
      </Link>

      <div className="flex justify-between items-center mt-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Milestones</h1>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
        >
          {showForm ? "Cancel" : "+ Add Milestone"}
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">New Milestone</h3>
          <input
            placeholder="Milestone name (e.g. Design sign-off)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Planned start</label>
              <input
                type="date"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Target date</label>
              <input
                type="date"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={createMilestone}
            disabled={creating}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Adding…" : "Add Milestone"}
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No milestones yet.
        </div>
      ) : (
        <div className="relative pl-6 border-l-2 border-gray-200 space-y-6">
          {sorted.map((m) => (
            <div key={m.project_milestone_id} className="relative">
              <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-gray-900">{m.milestone_name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[m.status] || STATUS_STYLES.PLANNED}`}>
                    {m.status}
                  </span>
                </div>
                {m.description && <p className="text-sm text-gray-700 mb-2">{m.description}</p>}
                <div className="flex gap-4 text-xs text-gray-600">
                  {m.planned_start_date && (
                    <span>Start: {new Date(m.planned_start_date).toLocaleDateString("en-IN")}</span>
                  )}
                  {m.planned_end_date && (
                    <span>Target: {new Date(m.planned_end_date).toLocaleDateString("en-IN")}</span>
                  )}
                  {m.actual_end_date && (
                    <span className="text-green-700 font-medium">
                      Completed: {new Date(m.actual_end_date).toLocaleDateString("en-IN")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Milestones;