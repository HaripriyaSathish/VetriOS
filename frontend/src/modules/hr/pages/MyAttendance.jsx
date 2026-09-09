import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Clock, Search, SlidersHorizontal, Columns3 } from "lucide-react";
import client from "../../../api/client";
import "../styles/HRDashboard.css";
import "../styles/Attendance.css";

const STATUS_LABEL = {
  PRESENT: "Present",
  HALF_DAY: "Half day",
  ON_LEAVE: "On leave",
  ABSENT: "Absent",
};

const STATUS_CLASS = {
  PRESENT: "present",
  HALF_DAY: "half",
  ON_LEAVE: "leave",
  ABSENT: "absent",
};

const EMPTY_FILTERS = { status: "" };
const DEFAULT_COLUMNS = { check_in: true, check_out: true };

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatHours(hours) {
  if (hours == null) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function greetingPrefix() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Employee-facing Attendance page — self check-in/out plus a personal
// history table with search/filter/columns, same toolbar pattern as the
// HR Attendance/Employees screens. Not HR-gated: self-service only.
function MyAttendance() {
  const { user } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [punching, setPunching] = useState(false);
  const [punchError, setPunchError] = useState("");
  const [now, setNow] = useState(new Date());
  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef(null);

  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef(null);

  const firstName = user?.full_name ? user.full_name.split(" ")[0] : "";

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get("/api/hr/attendance/me/");
      setData(data);
    } catch (err) {
      setError("Couldn't load your attendance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target)) setFiltersOpen(false);
      if (columnsRef.current && !columnsRef.current.contains(event.target)) setColumnsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePunch = async () => {
    setPunching(true);
    setPunchError("");
    try {
      if (data?.today?.checked_in) {
        await client.post("/api/hr/attendance/check-out/");
      } else {
        await client.post("/api/hr/attendance/check-in/");
      }
      await loadData();
    } catch (err) {
      setPunchError(err.response?.data?.detail || "Something went wrong.");
    } finally {
      setPunching(false);
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const filteredHistory = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.history.filter((day) => {
      if (q && !formatDate(day.date).toLowerCase().includes(q) && !(STATUS_LABEL[day.status] || "").toLowerCase().includes(q)) {
        return false;
      }
      if (filters.status && day.status !== filters.status) return false;
      return true;
    });
  }, [data, search, filters]);

  const today = data?.today;
  const bannerMessage = !data?.employee_id
    ? "No employee record is linked to your account"
    : today?.checked_out
    ? `You've completed your workday · checked out at ${formatTime(today.check_out_time)}`
    : today?.checked_in
    ? `You checked in at ${formatTime(today.check_in_time)}`
    : "Your workday hasn't started yet";

  return (
    <div className="att-screen">
      <div className="att-head">
        <div>
          <span className="att-eyebrow">My workspace</span>
          <h1>My Attendance</h1>
          <p>Check in when you start, check out when you're done.</p>
        </div>
        <button
          type="button"
          className="att-btn-accent"
          onClick={handlePunch}
          disabled={punching || !data?.employee_id || today?.checked_out}
        >
          <Clock size={15} />
          {punching ? "Working…" : today?.checked_in ? "Check out" : "Check in"}
        </button>
      </div>

      {punchError && <p className="att-error">{punchError}</p>}
      {error && <p className="att-error">{error}</p>}

      <div className="att-banner">
        <div className="att-banner-left">
          <Clock size={16} />
          <span>
            <strong>
              {greetingPrefix()}
              {firstName ? `, ${firstName}` : ""}
            </strong>{" "}
            · {bannerMessage}
          </span>
        </div>
        <span className="att-banner-time">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="att-panel">
        <div className="att-panel-head">
          <div>
            <h3>My attendance</h3>
            <p>Last 14 days</p>
          </div>
          <div className="att-toolbar-right">
            <div className="att-search">
              <Search size={15} />
              <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="hr-popover-anchor" ref={filtersRef}>
              <button
                type="button"
                className={"hr-btn-sm" + (activeFilterCount ? " hr-btn-sm-active" : "")}
                onClick={() => {
                  setFiltersOpen((v) => !v);
                  setColumnsOpen(false);
                }}
              >
                <SlidersHorizontal size={14} /> Filters
                {activeFilterCount > 0 && <span className="hr-tab-count">{activeFilterCount}</span>}
              </button>
              {filtersOpen && (
                <div className="hr-popover hr-popover-right">
                  <div className="hr-popover-head">
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <button type="button" className="hr-popover-clear" onClick={clearFilters}>
                        Clear all
                      </button>
                    )}
                  </div>
                  <label>Status</label>
                  <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                    <option value="">All</option>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="hr-popover-anchor" ref={columnsRef}>
              <button
                type="button"
                className="hr-btn-sm"
                onClick={() => {
                  setColumnsOpen((v) => !v);
                  setFiltersOpen(false);
                }}
              >
                <Columns3 size={14} /> Columns
              </button>
              {columnsOpen && (
                <div className="hr-popover hr-popover-right hr-popover-narrow">
                  <div className="hr-popover-head">
                    <span>Columns</span>
                  </div>
                  {[
                    ["check_in", "Check in"],
                    ["check_out", "Check out"],
                  ].map(([key, label]) => (
                    <label key={key} className="hr-checkbox-row">
                      <input
                        type="checkbox"
                        checked={columns[key]}
                        onChange={(e) => setColumns({ ...columns, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="hr-empty">Loading…</p>
        ) : !data?.employee_id ? (
          <p className="hr-empty">No employee record is linked to your account.</p>
        ) : filteredHistory.length === 0 ? (
          <p className="hr-empty">
            {data.history.length === 0 ? "No attendance recorded yet." : "No records match your search/filters."}
          </p>
        ) : (
          <div className="hr-table-scroll">
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {columns.check_in && <th>Check in</th>}
                  {columns.check_out && <th>Check out</th>}
                  <th>Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((day) => (
                  <tr key={day.date}>
                    <td className="hr-mono">{formatDate(day.date)}</td>
                    {columns.check_in && <td className="hr-mono">{formatTime(day.check_in_time)}</td>}
                    {columns.check_out && <td className="hr-mono">{formatTime(day.check_out_time)}</td>}
                    <td className="hr-mono">{formatHours(day.hours)}</td>
                    <td>
                      <span className={"att-pill " + (STATUS_CLASS[day.status] || "absent")}>
                        {STATUS_LABEL[day.status] || day.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default MyAttendance;
