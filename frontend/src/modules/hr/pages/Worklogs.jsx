import { useEffect, useMemo, useState } from "react";
import { Search, Eye, ClipboardList, CalendarCheck, Users, ListChecks, Clock } from "lucide-react";
import client from "../../../api/client";
import Pagination, { paginate } from "../../../components/Pagination";
import "../styles/HRDashboard.css";
import "../styles/Attendance.css";
import "../styles/Employees.css";

function formatDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const weekday = (d) => new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" });

// "09:02" or "09:02:00" -> "9:02 AM"; free text like "6:10 PM" is shown as typed.
const shortTime = (t) => {
  const m = /^(\d{1,2}):(\d{2})(:\d{2})?$/.exec(String(t || "").trim());
  if (!m) return t || "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
};

const initialsOf = (name) => {
  const w = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return "?";
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0]).toUpperCase();
};

const toneOf = (name) => {
  let h = 0;
  for (const c of String(name || "")) h = (h * 31 + c.charCodeAt(0)) % 5;
  return "t" + h;
};

const RANGES = [
  { key: "ALL", label: "All" },
  { key: "TODAY", label: "Today" },
  { key: "WEEK", label: "This week" },
];

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
  const [range, setRange] = useState("ALL"); // ALL | TODAY | WEEK
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

  useEffect(() => {
    if (!viewingWorklog) return undefined;
    const onKey = (e) => e.key === "Escape" && setViewingWorklog(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewingWorklog]);

  const todayIso = toIso(new Date());
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartIso = toIso(weekStart);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return worklogs.filter((w) => {
      const day = String(w.work_date || "").slice(0, 10);
      if (range === "TODAY" && day !== todayIso) return false;
      if (range === "WEEK" && (day < weekStartIso || day > todayIso)) return false;
      if (!q) return true;
      return [w.employee_name, w.employee_code, w.department_name, w.reported_to_name]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [worklogs, search, range, todayIso, weekStartIso]);

  const stats = useMemo(
    () => ({
      total: worklogs.length,
      today: worklogs.filter((w) => String(w.work_date || "").slice(0, 10) === todayIso).length,
      people: new Set(worklogs.map((w) => w.employee_code || w.employee_name)).size,
      entries: worklogs.reduce((n, w) => n + (w.entries?.length || 0), 0),
    }),
    [worklogs, todayIso]
  );

  const cards = [
    { label: "Worklogs · 30 days", value: stats.total, tone: "blue", Icon: ClipboardList },
    { label: "Submitted today", value: stats.today, tone: "green", Icon: CalendarCheck },
    { label: "Employees reporting", value: stats.people, tone: "amber", Icon: Users },
    { label: "Total entries", value: stats.entries, tone: "violet", Icon: ListChecks },
  ];

  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 6)));

  return (
    <div className="att-screen att-v2 wl2">
      <div className="att-head">
        <div>
          <h1>Worklogs</h1>
          <p>Daily worklogs submitted across the company, last 30 days.</p>
        </div>
      </div>

      {error && <p className="att-error">{error}</p>}

      <div className="emp-mini-row org-stats wl2-cards">
        {cards.map(({ label, value, tone, Icon }) => (
          <div key={label} className={`emp-mini tone-${tone}`}>
            <span className="emp-mini-icon"><Icon size={15} /></span>
            <span className="emp-mini-text">
              <b>{loading ? "-" : value}</b>
              <span>{label}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="att-panel">
        <div className="hr-toolbar wl2-toolbar">
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
          <div className="att2-seg">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={range === r.key ? "active" : ""}
                onClick={() => {
                  setRange(r.key);
                  setPage(1);
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="hr-empty">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="hr-empty">
            {worklogs.length === 0 ? "No worklogs have been submitted yet." : "No worklogs match this search or filter."}
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
                    <th>Working hours</th>
                    <th>Entries</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(filtered, safePage, 6).map((w) => (
                    <tr key={w.worklog_id}>
                      <td>
                        <div className="hr-name">{formatDate(w.work_date)}</div>
                        <div className="hr-sub">{weekday(w.work_date)}</div>
                      </td>
                      <td>
                        <div className="wl2-person">
                          <span className={"wl2-av " + toneOf(w.employee_name)}>{initialsOf(w.employee_name)}</span>
                          <div>
                            <div className="hr-name">{w.employee_name}</div>
                            <div className="hr-sub">{w.employee_code}</div>
                          </div>
                        </div>
                      </td>
                      <td>{w.department_name || "—"}</td>
                      <td>{w.reported_to_name || "—"}</td>
                      <td>
                        {w.login_time || w.logout_time ? (
                          <span className="wl2-hours">
                            <Clock size={14} />
                            {shortTime(w.login_time) || "—"} – {shortTime(w.logout_time) || "—"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span className="wl2-count">{w.entries.length}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="wl2-view"
                          aria-label={`View worklog for ${w.employee_name} on ${formatDate(w.work_date)}`}
                          onClick={() => setViewingWorklog(w)}
                        >
                          <Eye size={14} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={safePage} totalItems={filtered.length} onPageChange={setPage} pageSize={6} />
          </>
        )}
      </div>

      {viewingWorklog && (
        <div className="hr-modal-backdrop" onClick={() => setViewingWorklog(null)}>
          <div className="hr-modal org-modal wl2-modal" role="dialog" aria-label="Worklog details" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="hr-modal-x org-modal-x"
              onClick={() => setViewingWorklog(null)}
              aria-label="Close"
            >
              ✕
            </button>
            <div className="org-modal-head">
              <span className="org-modal-ico"><ClipboardList size={19} /></span>
              <div>
                <h2>
                  {viewingWorklog.employee_name} — {formatDate(viewingWorklog.work_date)}
                </h2>
                <p>{viewingWorklog.employee_code}</p>
              </div>
            </div>

            <div className="wl2-facts">
              <div>
                <small>Department</small>
                <b>{viewingWorklog.department_name || "—"}</b>
              </div>
              <div>
                <small>Reported to</small>
                <b>{viewingWorklog.reported_to_name || "—"}</b>
              </div>
              <div>
                <small>Working hours</small>
                <b>
                  {viewingWorklog.login_time || viewingWorklog.logout_time
                    ? `${shortTime(viewingWorklog.login_time) || "—"} – ${shortTime(viewingWorklog.logout_time) || "—"}`
                    : "—"}
                </b>
              </div>
            </div>

            <div className="wl2-entries">
              {viewingWorklog.entries.length === 0 ? (
                <p className="hr-empty">No entries in this worklog.</p>
              ) : (
                viewingWorklog.entries.map((e, i) => (
                  <div className="wl2-entry" key={i}>
                    <span className="wl2-no">{e.sno ?? i + 1}</span>
                    <span className="wl2-range">
                      {shortTime(e.start_time)} – {shortTime(e.end_time)}
                    </span>
                    <span className="wl2-desc">{e.description}</span>
                  </div>
                ))
              )}
            </div>

            <div className="hr-modal-actions org-modal-foot">
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
