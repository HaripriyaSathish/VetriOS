import { useEffect, useMemo, useState } from "react";
import { Search, Eye } from "lucide-react";
import client from "../../../api/client";
import Pagination, { paginate } from "../../../components/Pagination";
import "../styles/HRDashboard.css";
import "../styles/Attendance.css";

function formatDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// HR-wide Worklogs tab — every employee's submissions over the last 30
// days, same "org-wide list, requester's own included too" convention
// as the Attendance/Leave tabs. Read-only: approving/reviewing isn't
// part of this yet.
function Worklogs() {
  const [worklogs, setWorklogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [viewingWorklog, setViewingWorklog] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await client.get("/api/hr/worklogs/");
        setWorklogs(data);
      } catch (err) {
        setError("Couldn't load worklogs.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return worklogs;
    return worklogs.filter((w) =>
      [w.employee_name, w.employee_code, w.department_name, w.reported_to_name]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [worklogs, search]);

  return (
    <div className="att-screen">
      <div className="att-head">
        <div>
          <span className="att-eyebrow">HR</span>
          <h1>Worklogs</h1>
          <p>Daily worklogs submitted across the company, last 30 days.</p>
        </div>
      </div>

      {error && <p className="att-error">{error}</p>}

      <div className="att-panel">
        <div className="hr-toolbar">
          <div className="hr-search">
            <Search size={15} />
            <input
              placeholder="Search employee, department, reported to…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {loading ? (
          <p className="hr-empty">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="hr-empty">
            {worklogs.length === 0 ? "No worklogs have been submitted yet." : `No worklogs match "${search}".`}
          </p>
        ) : (
          <>
            <div className="hr-table-scroll">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Reported to</th>
                    <th>Login</th>
                    <th>Logout</th>
                    <th>Entries</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(filtered, page, 6).map((w) => (
                    <tr key={w.worklog_id}>
                      <td>{formatDate(w.work_date)}</td>
                      <td>
                        <div className="hr-name">{w.employee_name}</div>
                        <div className="hr-sub">{w.employee_code}</div>
                      </td>
                      <td>{w.department_name || "—"}</td>
                      <td>{w.reported_to_name || "—"}</td>
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
            <Pagination page={page} totalItems={filtered.length} onPageChange={setPage} pageSize={6} />
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
              {viewingWorklog.department_name ? ` · ${viewingWorklog.department_name}` : ""}
              {viewingWorklog.reported_to_name ? ` · Reported to ${viewingWorklog.reported_to_name}` : ""}
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

export default Worklogs;
