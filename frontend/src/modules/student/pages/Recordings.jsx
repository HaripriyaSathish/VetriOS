import { useEffect, useState } from "react";
import client from "../../../api/client";

function Recordings() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get("/api/student/recordings/").then(({ data }) => setRecordings(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Class Recordings</h1>
      {recordings.length === 0 ? (
        <p className="text-gray-400">No recordings shared with you yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {recordings.map((r) => (
            <div key={r.recording_id} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="font-semibold text-gray-900">{r.title}</p>
                <p className="text-xs text-gray-500 mt-1">{r.date}</p>
                {r.notes && <p className="text-sm text-gray-600 mt-2">{r.notes}</p>}
                {r.watched && <p className="text-xs text-green-600 font-semibold mt-2">✓ Watched {new Date(r.watched_at).toLocaleDateString()}</p>}
              </div>
              <a href={r.tracked_link} target="_blank" rel="noreferrer" className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-semibold">
                Watch Recording
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Recordings;