import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../../api/client";
import "../styles/TrainingDashboard.css";

function TrainingManagement() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get("/api/training/management/overview/");
      setData(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't load Training Management.");
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
          <h1>Training Management</h1>
          <p>
            {data.total_batches} batches · {data.total_trainers} trainers ·{" "}
            {data.total_students} students
          </p>
        </div>
        {data.is_business_team && (
          <div style={{ display: "flex", gap: 10 }}>
            <Link to="/training/enquiries" className="td-pill on" style={{ textDecoration: "none" }}>
              + Enquiries
            </Link>
          </div>
        )}
        {data.can_create && (
          <Link to="/training/batches/new" className="td-pill on" style={{ textDecoration: "none" }}>
            + New Batch
          </Link>
        )}
      </div>

      <div className="td-panel">
        <div className="td-panel-head">
          <h3>All Batches</h3>
        </div>
        <div className="td-table-scroll">
          <table className="td-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Course</th>
                <th>Trainer</th>
                <th>Start Date</th>
                <th>Status</th>
                <th>Students</th>
                {data.can_edit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {data.batches.length === 0 ? (
                <tr>
                  <td colSpan={data.can_edit ? 7 : 6} className="td-empty">
                    No batches yet.
                  </td>
                </tr>
              ) : (
                data.batches.map((b) => (
                  <tr key={b.batch_id}>
                    <td className="td-name">
                      <Link to={`/training/batches/${b.batch_id}`}>{b.batch_name}</Link>
                    </td>
                    <td className="td-sub">{b.course_name}</td>
                    <td className="td-sub">{b.trainer_name || "Unassigned"}</td>
                    <td className="td-mono">{b.start_date}</td>
                    <td>
                      <span className="td-pill on">{b.status}</span>
                    </td>
                    <td className="td-mono">{b.students_enrolled}</td>
                    {data.can_edit && (
                      <td>
                        <Link to={`/training/batches/${b.batch_id}/edit`}>Edit</Link>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="td-panel">
        <div className="td-panel-head">
          <h3>All Trainers</h3>
        </div>
        <div className="td-table-scroll">
          <table className="td-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Specialization</th>
                <th>Batches</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.trainers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="td-empty">
                    No trainers yet.
                  </td>
                </tr>
              ) : (
                data.trainers.map((t) => (
                  <tr key={t.trainer_id}>
                    <td className="td-name">{t.trainer_name}</td>
                    <td className="td-sub">{t.email}</td>
                    <td className="td-sub">{t.specialization}</td>
                    <td className="td-mono">{t.batch_count}</td>
                    <td>
                      <span className={"td-pill " + (t.is_active ? "on" : "off")}>
                        {t.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
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

export default TrainingManagement;