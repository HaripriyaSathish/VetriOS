import { useEffect, useState } from "react";
import client from "../../../api/client";

function MyInternship() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/api/interns/me/")
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your internship details."));
  }, []);

  if (error) return <p className="p-6 text-gray-400">{error}</p>;
  if (!data) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Internship</h1>
      <p className="text-gray-500 mb-6">Your internship details and reporting line.</p>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <p className="text-xs text-gray-400 uppercase">Intern Code</p>
          <p className="text-lg font-semibold text-gray-900">{data.intern_code}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase">Status</p>
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            {data.status}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase">Internship Start Date</p>
          <p className="text-gray-900">{data.internship_start_date || "—"}</p>
        </div>
        {data.internship_end_date && (
          <div>
            <p className="text-xs text-gray-400 uppercase">Internship End Date</p>
            <p className="text-gray-900">{data.internship_end_date}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-400 uppercase">Reporting Manager</p>
          <p className="text-gray-900">{data.reporting_manager || "Not yet assigned"}</p>
        </div>
      </div>
    </div>
  );
}

export default MyInternship;