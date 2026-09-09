import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../../api/client";

function ProjectPicker({ title, subtitle, basePath, getPath }) {
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

  // getPath(projectId) lets a page override the URL shape when the
  // route puts the id before the feature name (e.g. /project/6/team)
  // instead of after it (e.g. /project/requirements/6).
  const linkFor = (projectId) => (getPath ? getPath(projectId) : `${basePath}/${projectId}`);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">{title}</h1>
      <p className="text-gray-600 mb-6">{subtitle}</p>

      {projects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No projects yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map((p) => (
            <Link
              key={p.project_id}
              to={linkFor(p.project_id)}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-gray-900">{p.project_name}</p>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  {p.status}
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-1">Client: {p.client_name}</p>
              <p className="text-xs text-gray-600">Your role: {p.my_role}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectPicker;