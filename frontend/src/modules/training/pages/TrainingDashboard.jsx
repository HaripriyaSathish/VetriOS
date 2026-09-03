import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../../../api/client";
import "../styles/TrainingDashboard.css";

function TrainingDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get("/api/training/dashboard/");
      setData(data);
    } catch (err) {
      setError("Couldn't load your training dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <p className="td-empty">Loading…</p>;
  if (error) return <p className="td-error">{error}</p>;

  return (
    <div className="td-screen">
      <div className="td-head">
        <div>
          <h1>Welcome, {data.trainer_name}</h1>
          <p>Specialization: {data.specialization}</p>
        </div>
      </div>

      <div className="td-panel">
        <div className="td-panel-head">
          <h3>Your Batches</h3>
        </div>
        <div className="td-table-scroll">
          <table className="td-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Course</th>
                <th>Start Date</th>
                <th>Status</th>
                <th>Students Enrolled</th>
              </tr>
            </thead>
            <tbody>
              {data.batches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="td-empty">
                    No batches assigned yet.
                  </td>
                </tr>
              ) : (
                data.batches.map((b) => (
                  <tr
                    key={b.batch_id}
                    className="td-row-clickable"
                    onClick={() => navigate(`/training/batches/${b.batch_id}`)}
                  >
                    <td className="td-name">{b.batch_name}</td>
                    <td className="td-sub">{b.course_name}</td>
                    <td className="td-mono">{b.start_date}</td>
                    <td>
                      <span className="td-pill on">{b.status}</span>
                    </td>
                    <td className="td-mono">{b.students_enrolled}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TrainingDashboard;