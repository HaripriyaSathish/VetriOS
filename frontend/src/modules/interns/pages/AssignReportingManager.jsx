import { useEffect, useState } from "react";
import client from "../../../api/client";

function AssignReportingManager() {
  const [interns, setInterns] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selection, setSelection] = useState({});
  const [saving, setSaving] = useState(null);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([
      client.get("/api/interns/all-interns-manager-assignment/"),
      client.get("/api/projects/users-lookup/"),
    ])
      .then(([internsRes, usersRes]) => {
        setInterns(internsRes.data || []);
        setUsers(usersRes.data || []);
      })
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load interns."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const assign = async (internId) => {
    const managerId = selection[internId];
    if (!managerId) {
      setError("Select a manager first.");
      return;
    }
    setSaving(internId);
    setError("");
    setMessage("");
    try {
      await client.post(`/api/interns/${internId}/assign-manager/`, { manager_user_id: managerId });
      setMessage("Reporting manager assigned.");
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't assign manager.");
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Assign Reporting Manager</h1>
      <p className="text-gray-500 mb-6">
        Set or fix which employee an intern reports to. This drives who can submit their
        testing reports and performance reviews.
      </p>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {interns.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No interns found.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {interns.map((i) => (
            <div
              key={i.intern_id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3"
            >
              <div>
                <p className="font-semibold text-gray-900">{i.name}</p>
                <p className="text-xs text-gray-500">
                  {i.intern_code} · Current manager: {i.current_manager || "None set"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selection[i.intern_id] || ""}
                  onChange={(e) => setSelection((prev) => ({ ...prev, [i.intern_id]: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[180px]"
                >
                  <option value="">Select manager…</option>
                  {users.map((u) => (
                    <option key={u.user_id} value={u.user_id}>{u.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => assign(i.intern_id)}
                  disabled={saving === i.intern_id}
                  className="bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60"
                >
                  {saving === i.intern_id ? "Saving…" : "Assign"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AssignReportingManager;