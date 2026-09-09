import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../../api/client";

function ClientPicker({ title, subtitle, getPath }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/api/projects/clients/")
      .then(({ data }) => setClients(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load clients."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">{title}</h1>
      <p className="text-gray-600 mb-6">{subtitle}</p>

      {clients.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No clients yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {clients.map((c) => (
            <Link
              key={c.client_id}
              to={getPath(c.client_id)}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-gray-900">{c.client_name}</p>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  {c.status}
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-1">{c.client_code}</p>
              {c.industry && <p className="text-xs text-gray-600">{c.industry}</p>}
              <p className="text-xs text-gray-600 mt-1">{c.project_count} project{c.project_count === 1 ? "" : "s"}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ClientPicker;