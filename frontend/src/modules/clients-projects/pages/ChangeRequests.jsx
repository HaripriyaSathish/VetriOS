import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../../api/client";

const STATUS_STYLES = {
  PENDING: "bg-gray-100 text-gray-700",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  IMPLEMENTED: "bg-purple-100 text-purple-700",
};

const IMPACT_STYLES = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

function ChangeRequests() {
  const { projectId } = useParams();
  const [changeRequests, setChangeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    client.get(`/api/projects/change-requests/?project_id=${projectId}`)
      .then(({ data }) => setChangeRequests(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load change requests."))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/project/change-requests" className="text-sm text-blue-600 hover:underline">
        ← Back to Projects
      </Link>

      <h1 className="text-xl font-bold text-gray-900 mt-3 mb-2">Change Requests</h1>
      <p className="text-sm text-gray-600 mb-6">
        Only change requests linked to a specific requirement on this project appear here.
        Others are visible from Client Requests.
      </p>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {changeRequests.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No change requests linked to this project yet.
        </div>
      ) : (
        <div className="space-y-3">
          {changeRequests.map((cr) => (
            <div key={cr.change_request_id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="font-medium text-gray-900">{cr.title}</p>
                <div className="flex gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${IMPACT_STYLES[cr.impact_level] || IMPACT_STYLES.medium}`}>
                    {cr.impact_level} impact
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[cr.status] || STATUS_STYLES.PENDING}`}>
                    {cr.status}
                  </span>
                </div>
              </div>
              {cr.description && <p className="text-sm text-gray-700 mb-2">{cr.description}</p>}
              {cr.reason && <p className="text-xs text-gray-600 mb-2">Reason: {cr.reason}</p>}
              <div className="flex gap-4 text-xs text-gray-600">
                {cr.cost_impact && <span>Cost impact: ₹{cr.cost_impact}</span>}
                {cr.time_impact_days && <span>Time impact: {cr.time_impact_days} days</span>}
                {cr.requested_date && <span>Requested: {new Date(cr.requested_date).toLocaleDateString("en-IN")}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ChangeRequests;