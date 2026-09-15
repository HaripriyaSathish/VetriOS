import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../../api/client";

function MyProject() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/api/interns/me/project/")
      .then(({ data }) => setProjects(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your project."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Project</h1>
      <p className="text-gray-500 mb-6">The project(s) you're currently staffed on.</p>

      {projects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          You're not assigned to any project yet.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {projects.map((p) => (
            <div key={p.project_id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-gray-900">{p.project_name}</p>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  {p.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-1">Client: {p.client_name}</p>
              <p className="text-xs text-gray-500 mb-3">Your role: {p.my_role}</p>

              <Link
                to={`/project/${p.project_id}/ask-lead`}
                className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-xs font-semibold"
              >
                💬 Ask Project Lead
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyProject;