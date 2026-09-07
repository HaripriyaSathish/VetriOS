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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Project Management</h1>
      <p className="text-gray-500 mb-6">Projects you're managing or staffed on.</p>

      {projects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No projects yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map((p) => (
            <Link
              key={p.project_id}
              to={`/project/${p.project_id}/team`}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-gray-900">{p.project_name}</p>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  {p.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-1">Client: {p.client_name}</p>
              <p className="text-xs text-gray-500">Your role: {p.my_role}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectDashboard;