import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../../api/client";

function MyClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/api/projects/my-clients/")
      .then(({ data }) => setClients(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your clients."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">My Clients</h1>
      <p className="text-gray-600 mb-6">Clients tied to projects you manage.</p>

      {clients.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No clients on your projects yet.
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => (
            <div key={c.client_id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-start mb-3">
                <Link
                  to={`/clients/${c.client_id}`}
                  className="font-semibold text-gray-900 hover:text-blue-700"
                >
                  {c.client_name} →
                </Link>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  {c.status}
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-700 mb-2">
                {c.projects.length} project{c.projects.length === 1 ? "" : "s"}
              </p>
              <div className="flex flex-wrap gap-2">
                {c.projects.map((p) => (
                  <Link
                    key={p.project_id}
                    to={`/project/${p.project_id}/team`}
                    className="text-xs bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-gray-700 hover:border-blue-400 hover:text-blue-700"
                  >
                    {p.project_name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyClients;