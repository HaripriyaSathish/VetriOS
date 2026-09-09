import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../../api/client";

function ClientDirectory() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [clientType, setClientType] = useState("");
  const [industry, setIndustry] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    client.get("/api/projects/clients/")
      .then(({ data }) => setClients(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load clients."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createClient = async () => {
    if (!code.trim() || !name.trim()) {
      setError("Client code and name are required.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      await client.post("/api/projects/clients/", {
        client_code: code,
        client_name: name,
        client_type: clientType,
        industry,
        email,
        phone,
      });
      setMessage("Client added.");
      setCode(""); setName(""); setClientType(""); setIndustry(""); setEmail(""); setPhone("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't add client.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-1">
        <h1 className="text-xl font-bold text-gray-900">Client Directory</h1>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
        >
          {showForm ? "Cancel" : "+ New Client"}
        </button>
      </div>
      <p className="text-gray-600 mb-6">Full client list — System Administrator only.</p>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">New Client</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              placeholder="Client code (e.g. ACME01)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Client name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              placeholder="Type (e.g. Enterprise)"
              value={clientType}
              onChange={(e) => setClientType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={createClient}
            disabled={creating}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Adding…" : "Add Client"}
          </button>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No clients yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {clients.map((c) => (
            <Link
              key={c.client_id}
              to={`/clients/directory/${c.client_id}`}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-gray-900">{c.client_name}</p>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  {c.status}
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-1">{c.client_code}</p>
              <p className="text-xs text-gray-600">{c.project_count} project{c.project_count === 1 ? "" : "s"}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ClientDirectory;