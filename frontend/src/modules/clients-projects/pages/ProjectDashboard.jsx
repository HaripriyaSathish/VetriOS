import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../../api/client";

function ProjectDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/api/projects/me/")
      .then(({ data }) => setProjects(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your projects."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  const ecosystemCount = projects.filter((p) => p.client_type === "Ecosystem").length;
  const clientCount = projects.length - ecosystemCount;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Project Management</h1>
      <p className="text-gray-500 mb-4">Projects you're managing or staffed on.</p>

      {projects.length > 0 && (
        <div className="flex gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-3">
            <p className="text-xs text-gray-500">Client Projects</p>
            <p className="text-2xl font-bold text-gray-900">{clientCount}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-3">
            <p className="text-xs text-gray-500">Ecosystem Projects</p>
            <p className="text-2xl font-bold text-gray-900">{ecosystemCount}</p>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No projects yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map((p) => (
            <div
              key={p.project_id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-gray-900">{p.project_name}</p>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  {p.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-1">
                Client: {p.client_name}
                {p.client_type === "Ecosystem" && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-semibold">
                    ECOSYSTEM
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500 mb-4">Your role: {p.my_role}</p>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <Link
                  to={`/project/${p.project_id}/team`}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Team →
                </Link>
                <span className="text-gray-300">·</span>
                <Link
                  to={`/project/${p.project_id}/kanban`}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Kanban Board →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectDashboard;