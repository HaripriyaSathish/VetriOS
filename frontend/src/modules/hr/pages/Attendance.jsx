import { useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, UserCheck, ShieldCheck, AlertTriangle, CalendarOff, UserX, KeyRound, LogIn, LogOut, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList, CartesianGrid } from "recharts";
import client from "../../../api/client";
import Pagination, { paginate } from "../../../components/Pagination";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import "../styles/HRDashboard.css";
import "../styles/Attendance.css";

// MISSING_CHECKOUT is never a row's status (checked in => Present) — it's
// only a separate, overlapping stat-card count for HR follow-up.
const STATUS_LABEL = {
  PRESENT: "Present",
  HALF_DAY: "Half day",
  PERMISSION: "On permission",
  EXCUSED: "Excused",
  WORK_FROM_HOME: "WFH",
  ON_LEAVE: "On leave",
  ABSENT: "Absent",
  HOLIDAY: "Holiday",
  NO_LOGIN: "No login",
};

const STATUS_CLASS = {
  PRESENT: "present",
  HALF_DAY: "half",
  PERMISSION: "leave",
  EXCUSED: "leave",
  WORK_FROM_HOME: "present",
  ON_LEAVE: "leave",
  ABSENT: "absent",
  HOLIDAY: "leave",
  NO_LOGIN: "no-login",
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

const EMPTY_FILTERS = { department: "", status: "" };

// Stat cards double as quick filters. MISSING isn't a status — it means
// checked in but not out yet.
const CARDS = [
  { key: "PRESENT", stat: "present", label: "Present", tone: "green", Icon: UserCheck },
  { key: "PERMISSION", stat: "permission", label: "Permission", tone: "blue", Icon: ShieldCheck },
  { key: "MISSING", stat: "missing_checkout", label: "Missing checkout", tone: "amber", Icon: AlertTriangle },
  { key: "ON_LEAVE", stat: "on_leave", label: "On leave", tone: "violet", Icon: CalendarOff },
  { key: "ABSENT", stat: "absent", label: "Absent", tone: "red", Icon: UserX },
  { key: "NO_LOGIN", stat: "no_login", label: "No login", tone: "grey", Icon: KeyRound },
];

const SEGMENTS = [
  { key: "ALL", label: "All" },
  { key: "PRESENT", label: "Present" },
  { key: "ABSENT", label: "Absent" },
  { key: "ON_LEAVE", label: "On leave" },
];

const matchesQuick = (r, q) => {
  if (q === "ALL") return true;
  if (q === "MISSING") return !!r.check_in_time && !r.check_out_time;
  if (q === "PRESENT") return r.status === "PRESENT" || r.status === "WORK_FROM_HOME";
  if (q === "ON_LEAVE") return r.status === "ON_LEAVE" || r.status === "EXCUSED";
  return r.status === q;
};

const STANDARD_HOURS = 8;
const PAGE_SIZE = 10;

const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shiftIso = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIso(d);
};

// Brand colours: blue for people who are in, orange for what needs attention.
const BLUE = "#1d4f91";
const ORANGE = "#e8791f";
const CHART_BARS = [
  { stat: "present", label: "Present", color: BLUE },
  { stat: "permission", label: "Permission", color: BLUE },
  { stat: "on_leave", label: "On leave", color: BLUE },
  { stat: "missing_checkout", label: "Missing checkout", color: ORANGE },
  { stat: "absent", label: "Absent", color: ORANGE },
  { stat: "no_login", label: "No login", color: ORANGE },
];

// Attendance screen — today's org-wide daily records. Personal check-in/
// check-out lives on the separate "My Attendance" page (/my/attendance),
// not duplicated here.
function Attendance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState("ALL");
  const [page, setPage] = useState(1);
  const todayIso = toIso(new Date());
  const [day, setDay] = useState(todayIso); // the date being viewed
  const dateInputRef = useRef(null);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get("/api/hr/attendance/today/", { params: day === todayIso ? {} : { date: day } });
      setData(data);
    } catch (err) {
      setError("Couldn't load attendance data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target)) setFiltersOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      return matchesQuick(r, quick);
    });
  }, [data, search, filters, quick]);

  const safePage = Math.min(page, Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE)));

  const pickQuick = (k) => {
    setQuick((cur) => (cur === k ? "ALL" : k));
    setPage(1);
  };

  // Day summary: where the whole team stands right now.
  const summary = useMemo(() => {
    const recs = data?.records || [];
    const total = recs.length;
    const count = (fn) => recs.filter(fn).length;
    const parts = [
      { label: "Present", tone: "green", n: count((r) => r.status === "PRESENT" || r.status === "WORK_FROM_HOME") },
      { label: "Permission", tone: "blue", n: count((r) => r.status === "PERMISSION") },
      { label: "On leave", tone: "violet", n: count((r) => r.status === "ON_LEAVE" || r.status === "EXCUSED") },
      { label: "Absent", tone: "red", n: count((r) => r.status === "ABSENT") },
      { label: "No login", tone: "grey", n: count((r) => r.status === "NO_LOGIN") },
    ];
    const checkedIn = count((r) => !!r.check_in_time);
    return { total, parts, checkedIn, pct: total ? Math.round((checkedIn / total) * 100) : 0 };
  }, [data]);

  return (
    <div className="att-screen att-v2">
      <div className="att-head">
        <div>
          <h1>Employee's Attendance</h1>
          <p>Monitor daily presence and resolve exceptions.</p>
        </div>
        <div className="att2-date">
          <button type="button" className="att2-date-btn" aria-label="Previous day" onClick={() => setDay(shiftIso(day, -1))}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="att2-date-main" onClick={() => dateInputRef.current?.showPicker?.()}>
            <CalendarDays size={16} />
            {new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </button>
          <input
            ref={dateInputRef}
            type="date"
            className="att2-date-input"
            value={day}
            max={todayIso}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            tabIndex={-1}
            aria-hidden="true"
          />
          <button type="button" className="att2-date-btn" aria-label="Next day" disabled={day >= todayIso} onClick={() => setDay(shiftIso(day, 1))}>
            <ChevronRight size={16} />
          </button>
          {day !== todayIso && (
            <button type="button" className="att2-date-today" onClick={() => setDay(todayIso)}>Today</button>
          )}
        </div>
      </div>

      {error && <p className="att-error">{error}</p>}

      {data?.day_note && (
        <p className={`att-daynote${data.day_note.type === "WFH" ? " wfh" : ""}`}>
          <CalendarOff size={16} />
          <b>{data.day_note.name}</b>
          {data.day_note.type === "WFH"
            ? " — work from home day. Check-in is still required."
            : " — holiday. Nobody is marked absent today."}
        </p>
      )}

      <div className="att2-cards">
        {CARDS.map(({ key, stat, label, tone, Icon }) => (
          <button
            key={key}
            type="button"
            className={`att2-card tone-${tone}${quick === key ? " selected" : ""}`}
            onClick={() => pickQuick(key)}
          >
            <span className="att2-card-top">
              <span className="att2-card-icon"><Icon size={16} /></span>
              <b>{data ? (data.stats[stat] ?? 0) : "—"}</b>
            </span>
            <span className="att2-card-label">{label}</span>
          </button>
        ))}
      </div>

      {data && summary.total > 0 && (
        <div className="att2-summary">
          <div className="att2-summary-row">
            <span>{day === todayIso ? "Today's attendance" : "Attendance for the day"}</span>
            <span>{summary.checkedIn} of {summary.total} checked in · {summary.pct}%</span>
          </div>
          <div className="att2-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CHART_BARS.map((c) => ({ ...c, value: data.stats[c.stat] ?? 0 }))} margin={{ top: 22, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e6ecf4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 13, fill: "#51607a" }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#8a95a5" }} />
                <Tooltip cursor={{ fill: "rgba(29, 79, 145, 0.06)" }} formatter={(v) => [v, "Employees"]} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56}>
                  {CHART_BARS.map((c) => <Cell key={c.stat} fill={c.color} />)}
                  <LabelList dataKey="value" position="top" style={{ fontSize: 14, fontWeight: 700, fill: "#1b2a41" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="att2-legend">
            <span style={{ "--c": BLUE }}>In and accounted for</span>
            <span style={{ "--c": ORANGE }}>Needs attention</span>
          </div>
        </div>
      )}

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
            <div className="att2-seg">
              {SEGMENTS.map((sg) => (
                <button key={sg.key} type="button" className={quick === sg.key ? "active" : ""} onClick={() => { setQuick(sg.key); setPage(1); }}>
                  {sg.label}
                </button>
              ))}
            </div>
            <div className="att-search">
              <Search size={15} />
              <input
                placeholder="Search employees…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
                    onChange={(e) => { setFilters({ ...filters, department: e.target.value }); setPage(1); }}
                  >
                    <option value="">All</option>
                    {departmentOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

                  <label>Status</label>
                  <select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}>
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
            {data?.records.length === 0 ? "No active employees found." : "No employees match this search or filter."}
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
                {paginate(filteredRecords, safePage, PAGE_SIZE).map((r) => {
                  const hasIn = !!r.check_in_time;
                  const missing = hasIn && !r.check_out_time;
                  const pct = r.hours != null ? Math.min(100, Math.round((r.hours / STANDARD_HOURS) * 100)) : 0;
                  return (
                    <tr key={r.employee_id}>
                      <td>
                        <div className="hr-cell-user">
                          <EmployeeAvatar personId={r.person_id} size={34} />
                          <div>
                            <div className="hr-name">{r.full_name}</div>
                            {r.role_names?.length > 0 && <div className="hr-sub">{r.role_names.join(", ")}</div>}
                          </div>
                        </div>
                      </td>
                      <td>{r.department_name || "—"}</td>
                      <td>
                        {hasIn ? <span className="att2-time in"><LogIn size={14} />{formatTime(r.check_in_time)}</span> : <span className="att2-none">—</span>}
                      </td>
                      <td>
                        {r.check_out_time ? (
                          <span className="att2-time out"><LogOut size={14} />{formatTime(r.check_out_time)}</span>
                        ) : missing ? (
                          <span className="att2-none">Not yet</span>
                        ) : (
                          <span className="att2-none">—</span>
                        )}
                      </td>
                      <td>
                        {r.hours != null ? (
                          <span className="att2-hours">
                            <span className="att2-hbar"><i style={{ width: pct + "%" }} /></span>
                            {formatHours(r.hours)}
                          </span>
                        ) : (
                          <span className="att2-none">—</span>
                        )}
                      </td>
                      <td>
                        <span className={"att-pill " + (STATUS_CLASS[r.status] || "absent")}>
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={safePage} totalItems={filteredRecords.length} onPageChange={setPage} pageSize={PAGE_SIZE} />
      </div>
    </div>
  );
}

export default Attendance;
