import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Search, SlidersHorizontal } from "lucide-react";
import client from "../../../api/client";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import "../styles/HRDashboard.css";
import "../styles/Attendance.css";

// MISSING_CHECKOUT is never a row's status (checked in => Present) — it's
// only a separate, overlapping stat-card count for HR follow-up.
const STATUS_LABEL = {
  PRESENT: "Present",
  HALF_DAY: "Half day",
  EXCUSED: "Excused",
  WORK_FROM_HOME: "WFH",
  ON_LEAVE: "On leave",
  ABSENT: "Absent",
};

const STATUS_CLASS = {
  PRESENT: "present",
  HALF_DAY: "half",
  EXCUSED: "leave",
  WORK_FROM_HOME: "present",
  ON_LEAVE: "leave",
  ABSENT: "absent",
};

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

function greetingPrefix() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const EMPTY_FILTERS = { department: "", status: "" };

// Attendance screen — today's org-wide daily records plus the logged-in
// user's own check-in/check-out control.
function Attendance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [punching, setPunching] = useState(false);
  const [punchError, setPunchError] = useState("");
  const [now, setNow] = useState(new Date());

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef(null);

  const user = JSON.parse(localStorage.getItem("user") || "null");
  const firstName = user?.full_name ? user.full_name.split(" ")[0] : "";

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get("/api/hr/attendance/today/");
      setData(data);
    } catch (err) {
      setError("Couldn't load attendance data.");
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
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePunch = async () => {
    setPunching(true);
    setPunchError("");
    try {
      if (data?.me?.checked_in) {
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

  const departmentOptions = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.records.map((r) => r.department_name).filter(Boolean))].sort();
  }, [data]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const filteredRecords = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.records.filter((r) => {
      if (q) {
        const matchesSearch = [r.full_name, r.department_name].filter(Boolean).some((v) => v.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }
      if (filters.department && r.department_name !== filters.department) return false;
      if (filters.status && r.status !== filters.status) return false;
      return true;
    });
  }, [data, search, filters]);

  const me = data?.me;
  const bannerMessage = !me?.employee_id
    ? "No employee record is linked to your account"
    : me.checked_out
    ? `You've completed your workday · checked out at ${formatTime(me.check_out_time)}`
    : me.checked_in
    ? `You checked in at ${formatTime(me.check_in_time)}`
    : "Your workday hasn't started yet";

  return (
    <div className="att-screen">
      <div className="att-head">
        <div>
          <span className="att-eyebrow">Time &amp; Attendance</span>
          <h1>Attendance</h1>
          <p>Monitor daily presence and resolve exceptions.</p>
        </div>
        <button
          type="button"
          className="att-btn-accent"
          onClick={handlePunch}
          disabled={punching || !me?.employee_id || me?.checked_out}
        >
          <Clock size={15} />
          {punching ? "Working…" : me?.checked_in ? "Check out" : "Check in"}
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

      <div className="att-stats">
        <div className="att-stat-card">
          <span className="att-stat-label">Present</span>
          <span className="att-stat-value">{data?.stats.present ?? "—"}</span>
          <span className="att-stat-sub">Today</span>
        </div>
        <div className="att-stat-card">
          <span className="att-stat-label">Half day</span>
          <span className="att-stat-value">{data?.stats.half_day ?? "—"}</span>
          <span className="att-stat-sub">Today</span>
        </div>
        <div className="att-stat-card">
          <span className="att-stat-label">Missing checkout</span>
          <span className="att-stat-value">{data?.stats.missing_checkout ?? "—"}</span>
          <span className="att-stat-sub">Today</span>
        </div>
        <div className="att-stat-card">
          <span className="att-stat-label">On leave</span>
          <span className="att-stat-value">{data?.stats.on_leave ?? "—"}</span>
          <span className="att-stat-sub">Today</span>
        </div>
      </div>

      <div className="att-panel">
        <div className="att-panel-head">
          <div>
            <h3>Daily records</h3>
            <p>
              {data
                ? new Date(data.date).toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : ""}{" "}
              · All departments
            </p>
          </div>
          <div className="att-toolbar-right">
            <div className="att-search">
              <Search size={15} />
              <input
                placeholder="Search employees…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="hr-popover-anchor" ref={filtersRef}>
              <button
                type="button"
                className={"hr-btn-sm" + (activeFilterCount ? " hr-btn-sm-active" : "")}
                onClick={() => setFiltersOpen((v) => !v)}
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

                  <label>Department</label>
                  <select
                    value={filters.department}
                    onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                  >
                    <option value="">All</option>
                    {departmentOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

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
          </div>
        </div>

        {loading ? (
          <p className="hr-empty">Loading…</p>
        ) : filteredRecords.length === 0 ? (
          <p className="hr-empty">
            {data?.records.length === 0 ? "No active employees found." : `No employees match "${search}".`}
          </p>
        ) : (
          <div className="hr-table-scroll">
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Check in</th>
                  <th>Check out</th>
                  <th>Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => (
                  <tr key={r.employee_id}>
                    <td>
                      <div className="hr-cell-user">
                        <EmployeeAvatar personId={r.person_id} size={28} />
                        <div className="hr-name">{r.full_name}</div>
                      </div>
                    </td>
                    <td>{r.department_name || "—"}</td>
                    <td className="hr-mono">{formatTime(r.check_in_time)}</td>
                    <td className="hr-mono">{formatTime(r.check_out_time)}</td>
                    <td className="hr-mono">{formatHours(r.hours)}</td>
                    <td>
                      <span className={"att-pill " + (STATUS_CLASS[r.status] || "absent")}>
                        {STATUS_LABEL[r.status] || r.status}
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

export default Attendance;
