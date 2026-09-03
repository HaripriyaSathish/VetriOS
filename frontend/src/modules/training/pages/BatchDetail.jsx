import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../../../api/client";
import "../styles/BatchDetail.css";

function BatchDetail() {
  const { batchId } = useParams();
  const navigate = useNavigate();

  const [batch, setBatch] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [statusByEnrollment, setStatusByEnrollment] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [batchRes, rosterRes] = await Promise.all([
        client.get(`/api/training/batches/${batchId}/detail/`),
        client.get(`/api/training/batches/${batchId}/roster/`),
      ]);
      setBatch(batchRes.data);
      setRoster(rosterRes.data);

      // Default every student to PRESENT when the roster first loads
      const defaults = {};
      rosterRes.data.forEach((r) => {
        defaults[r.enrollment_id] = "PRESENT";
      });
      setStatusByEnrollment(defaults);
    } catch (err) {
      setError("Couldn't load this batch.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  const toggleStatus = (enrollmentId) => {
    setStatusByEnrollment((prev) => ({
      ...prev,
      [enrollmentId]: prev[enrollmentId] === "PRESENT" ? "ABSENT" : "PRESENT",
    }));
  };

  const markAll = (status) => {
    const next = {};
    roster.forEach((r) => {
      next[r.enrollment_id] = status;
    });
    setStatusByEnrollment(next);
  };

  const saveAttendance = async () => {
    setSaving(true);
    setSaveMessage("");
    try {
      const records = roster.map((r) => ({
        enrollment_id: r.enrollment_id,
        attendance_status: statusByEnrollment[r.enrollment_id] || "PRESENT",
      }));

      const { data } = await client.post(
        `/api/training/batches/${batchId}/mark-attendance/`,
        { date: attendanceDate, records }
      );

      if (data.errors && data.errors.length > 0) {
        setSaveMessage(`Saved ${data.updated_count}, with ${data.errors.length} error(s).`);
      } else {
        setSaveMessage(`Attendance saved for ${data.updated_count} students on ${attendanceDate}.`);
      }
      loadData(); // refresh attendance % after saving
    } catch (err) {
      setSaveMessage("Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="bd-empty">Loading…</p>;
  if (error) return <p className="bd-error">{error}</p>;
  if (!batch) return null;

  return (
    <div className="bd-screen">
      <button className="bd-back" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="bd-head">
        <div>
          <h1>{batch.batch_name}</h1>
          <p>{batch.course_name} · {batch.batch_code}</p>
        </div>
        <span className={`bd-pill ${batch.status === "ACTIVE" ? "on" : ""}`}>
          {batch.status}
        </span>
      </div>

      <div className="bd-meta-row">
        <div>
          <span className="bd-meta-label">Trainer</span>
          <span className="bd-meta-value">{batch.trainer_name || "Unassigned"}</span>
        </div>
        <div>
          <span className="bd-meta-label">Start Date</span>
          <span className="bd-meta-value">{batch.start_date}</span>
        </div>
        <div>
          <span className="bd-meta-label">Capacity</span>
          <span className="bd-meta-value">
            {batch.students_enrolled} / {batch.capacity ?? "—"}
          </span>
        </div>
      </div>

      <div className="bd-panel">
        <div className="bd-panel-head">
          <h3>Mark Attendance</h3>
          <div className="bd-attendance-controls">
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
            />
            <button className="bd-btn-outline" onClick={() => markAll("PRESENT")}>
              Mark all Present
            </button>
            <button className="bd-btn-outline" onClick={() => markAll("ABSENT")}>
              Mark all Absent
            </button>
            <button className="bd-btn-save" onClick={saveAttendance} disabled={saving}>
              {saving ? "Saving…" : "Save Attendance"}
            </button>
          </div>
        </div>
        {saveMessage && <p className="bd-save-message">{saveMessage}</p>}

        <div className="bd-table-scroll">
          <table className="bd-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Status</th>
                <th>Attendance %</th>
                <th>Today</th>
              </tr>
            </thead>
            <tbody>
              {roster.length === 0 ? (
                <tr>
                  <td colSpan={5} className="bd-empty">No students enrolled yet.</td>
                </tr>
              ) : (
                roster.map((r) => (
                  <tr key={r.enrollment_id}>
                    <td className="bd-name">{r.student_name}</td>
                    <td className="bd-sub">{r.email}</td>
                    <td>
                      <span className={`bd-pill ${r.status === "ACTIVE" ? "on" : "off"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="bd-mono">
                      {r.attendance_percentage !== null ? `${r.attendance_percentage}%` : "—"}
                    </td>
                    <td>
                      <button
                        className={`bd-toggle ${statusByEnrollment[r.enrollment_id] === "PRESENT" ? "present" : "absent"}`}
                        onClick={() => toggleStatus(r.enrollment_id)}
                      >
                        {statusByEnrollment[r.enrollment_id] === "PRESENT" ? "Present" : "Absent"}
                      </button>
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

export default BatchDetail;