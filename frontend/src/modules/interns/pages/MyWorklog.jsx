import { useEffect, useState } from "react";
import client from "../../../api/client";

function MyWorklog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [loginTime, setLoginTime] = useState("");
  const [logoutTime, setLogoutTime] = useState("");
  const [entries, setEntries] = useState([{ time: "", note: "" }]);

  const load = () => {
    setLoading(true);
    client.get("/api/interns/me/worklog/")
      .then(({ data }) => setLogs(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your worklogs."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const updateEntry = (idx, field, value) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  };

  const addEntryRow = () => setEntries((prev) => [...prev, { time: "", note: "" }]);
  const removeEntryRow = (idx) => setEntries((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await client.post("/api/interns/me/worklog/", {
        work_date: workDate,
        login_time: loginTime,
        logout_time: logoutTime,
        entries: entries.filter((e) => e.time || e.note),
      });
      setMessage("Worklog saved.");
      setEntries([{ time: "", note: "" }]);
      setLoginTime("");
      setLogoutTime("");
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't save worklog.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Daily Work Report</h1>
      <p className="text-gray-500 mb-6">Log your login/logout time and what you worked on today.</p>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Date</label>
            <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Login Time</label>
            <input placeholder="9:30 am" value={loginTime} onChange={(e) => setLoginTime(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-32" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Logout Time</label>
            <input placeholder="6:00 pm" value={logoutTime} onChange={(e) => setLogoutTime(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-32" />
          </div>
        </div>

        <label className="block text-xs font-semibold text-gray-500 mb-2">Work Entries</label>
        <div className="space-y-2 mb-3">
          {entries.map((e, idx) => (
            <div key={idx} className="flex gap-2">
              <input placeholder="10:00 am" value={e.time} onChange={(ev) => updateEntry(idx, "time", ev.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm w-28" />
              <input placeholder="What did you work on?" value={e.note} onChange={(ev) => updateEntry(idx, "note", ev.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1" />
              {entries.length > 1 && (
                <button onClick={() => removeEntryRow(idx)} className="text-red-600 text-xs px-2">Remove</button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addEntryRow} className="text-blue-600 text-sm font-semibold mb-4">+ Add Entry</button>

        <div>
          <button onClick={submit} disabled={submitting}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
            {submitting ? "Saving…" : "Save Worklog"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading past logs…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((l) => (
            <div key={l.worklog_id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold text-gray-900">{l.work_date}</span>
                <span className="text-gray-500">{l.login_time} – {l.logout_time}</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                {l.entries.map((e, i) => (
                  <li key={i}>• {e.time && <span className="font-medium">{e.time}:</span>} {e.note}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyWorklog;