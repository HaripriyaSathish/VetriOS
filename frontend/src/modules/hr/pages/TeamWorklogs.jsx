import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import client from "../../../api/client";
import Pagination, { paginate } from "../../../components/Pagination";
import "../styles/HRDashboard.css";
import "../styles/Attendance.css";

function formatDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Shown only to whoever is currently someone's department lead (per
// department_lead) — the backend scopes this to worklogs actually
// routed to the logged-in user, so there's nothing to additionally
// gate here. Read-only: approving/reviewing isn't part of this yet.
function TeamWorklogs() {
  const [worklogs, setWorklogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingWorklog, setViewingWorklog] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await client.get("/api/hr/worklogs/team/");
        setWorklogs(data.worklogs || []);
      } catch (err) {
        setError("Couldn't load your team's worklogs.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="att-screen">
      <div className="att-head">
        <div>
          <span className="att-eyebrow">My workspace</span>
          <h1>Team worklogs</h1>
          <p>Daily worklogs submitted by everyone who reports to you.</p>
        </div>
      </div>

      {error && <p className="att-error">{error}</p>}

      <div className="att-panel">
        <div className="att-panel-head">
          <div>
            <h3>Submissions</h3>
            <p>Most recent first</p>
          </div>
        </div>

        {loading ? (
          <p className="hr-empty">Loading…</p>
        ) : worklogs.length === 0 ? (
          <p className="hr-empty">No worklogs have been submitted to you yet.</p>
        ) : (
          <>
            <div className="hr-table-scroll">
              <table className="hr-table wl-history-table">
                <colgroup>
                  <col className="wl-col-date" />
                  <col />
                  <col />
                  <col className="wl-col-login" />
                  <col className="wl-col-logout" />
                  <col className="wl-col-entries" />
                  <col className="wl-col-action" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Designation</th>
                    <th>Login</th>
                    <th>Logout</th>
                    <th>Entries</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(worklogs, page, 6).map((w) => (
                    <tr key={w.worklog_id}>
                      <td>{formatDate(w.work_date)}</td>
                      <td>
                        <div className="hr-name">{w.employee_name}</div>
                        <div className="hr-sub">{w.employee_code}</div>
                      </td>
                      <td>{w.employee_designation || "—"}</td>
                      <td>{w.login_time || "—"}</td>
                      <td>{w.logout_time || "—"}</td>
                      <td>{w.entries.length}</td>
                      <td>
                        <button
                          type="button"
                          className="hr-icon-btn"
                          title="View"
                          aria-label={`View worklog for ${w.employee_name} on ${formatDate(w.work_date)}`}
                          onClick={() => setViewingWorklog(w)}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalItems={worklogs.length} onPageChange={setPage} pageSize={6} />
          </>
        )}
      </div>

      {viewingWorklog && (
        <div className="hr-modal-backdrop" onClick={() => setViewingWorklog(null)}>
          <div className="hr-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="hr-modal-x"
              onClick={() => setViewingWorklog(null)}
              aria-label="Close"
            >
              ✕
            </button>
            <h2>
              {viewingWorklog.employee_name} — {formatDate(viewingWorklog.work_date)}
            </h2>
            <p className="hr-hint">
              {viewingWorklog.employee_code}
              {viewingWorklog.employee_designation ? ` · ${viewingWorklog.employee_designation}` : ""}
            </p>

            <div className="hr-table-scroll">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Work</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingWorklog.entries.map((e, i) => (
                    <tr key={i}>
                      <td className="hr-mono">{e.sno ?? i + 1}</td>
                      <td>{e.start_time}</td>
                      <td>{e.end_time}</td>
                      <td>{e.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={() => setViewingWorklog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamWorklogs;
