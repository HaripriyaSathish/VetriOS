import { useEffect, useMemo, useState } from "react";
import client from "../../../api/client";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import ReportFilterPanel from "../components/ReportFilterPanel";
import Pagination, { paginate } from "../../../components/Pagination";
import { downloadReport } from "../utils/exportFile";
import "../styles/HRDashboard.css";
import "../styles/Attendance.css";

const ATTENDANCE_REPORT_STATUS_OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "HALF_DAY", label: "Half day" },
  { value: "ON_LEAVE", label: "On leave" },
  { value: "ABSENT", label: "Absent" },
  { value: "NO_LOGIN", label: "No login" },
];
const ONBOARDING_REPORT_STATUS_OPTIONS = [
  { value: "Needs action", label: "Needs action" },
  { value: "On track", label: "On track" },
  { value: "Completed", label: "Completed" },
];
const EXIT_REPORT_STATUS_OPTIONS = [
  { value: "Pending", label: "Pending" },
  { value: "In progress", label: "In progress" },
  { value: "Completed", label: "Completed" },
];
const ATT_STATUS_LABEL = {
  PRESENT: "Present",
  HALF_DAY: "Half day",
  ON_LEAVE: "On leave",
  ABSENT: "Absent",
  NO_LOGIN: "No login",
};
const ATT_STATUS_CLASS = {
  PRESENT: "present",
  HALF_DAY: "half",
  ON_LEAVE: "leave",
  ABSENT: "absent",
  NO_LOGIN: "no-login",
};

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function onboardingStatusFor(percent) {
  if (percent >= 100) return { label: "Completed", cls: "on" };
  if (percent > 0) return { label: "On track", cls: "warn" };
  return { label: "Needs action", cls: "off" };
}

const EXIT_TYPE_LABEL_FULL = {
  RESIGNATION: "Resignation",
  TERMINATION: "Termination",
  RETIREMENT: "Retirement",
  CONTRACT_END: "Contract end",
  ABSCONDING: "Absconding",
  OTHER: "Other",
};
const EXIT_STATUS_LABEL = { PENDING: "Pending", IN_PROGRESS: "In progress", COMPLETED: "Completed" };
const EXIT_STATUS_CLASS = { PENDING: "off", IN_PROGRESS: "warn", COMPLETED: "on" };

// Validated categorical order (dataviz skill reference palette) — never
// reordered per-chart, so a given exit type / leave type always reads
// the same color across the whole report.
const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

// Fixed status palette — reserved for state, never reused as a series color.
const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b", muted: "#8a93a6" };

const EXIT_TYPE_LABEL = {
  RESIGNATION: "Resignation",
  TERMINATION: "Termination",
  RETIREMENT: "Retirement",
  CONTRACT_END: "Contract end",
  ABSCONDING: "Absconding",
  OTHER: "Other",
};
const EXIT_TYPE_ORDER = Object.keys(EXIT_TYPE_LABEL);

const TERMINAL_EMPLOYEE_STATUSES = new Set(["RESIGNED", "TERMINATED", "RETIRED", "INACTIVE"]);

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatPct(n) {
  return `${Math.round(n * 10) / 10}%`;
}

// Stroke-based donut: each segment is a full circle stroked partially via
// dasharray/dashoffset, sharing one center, rotated to start at 12
// o'clock. A small surface-color gap separates adjacent segments (the
// "surface gap" spacer) instead of a border.
function Donut({ segments, size = 160, thickness = 22, centerLabel, centerSub }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const gap = segments.length > 1 ? 3 : 0;

  let cumulative = 0;
  const arcs = segments.map((s) => {
    const fraction = total > 0 ? s.value / total : 0;
    const rawLen = fraction * circumference;
    const segLen = Math.max(rawLen - gap, 0);
    const offset = circumference - cumulative;
    cumulative += rawLen;
    return { ...s, segLen, offset };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eaeef4" strokeWidth={thickness} />
        ) : (
          arcs.map((a, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={thickness}
              strokeDasharray={`${a.segLen} ${circumference - a.segLen}`}
              strokeDashoffset={a.offset}
              strokeLinecap="butt"
            />
          ))
        )}
      </g>
      {centerLabel && (
        <text x={cx} y={cy - (centerSub ? 4 : 0)} textAnchor="middle" className="rpt-donut-value">
          {centerLabel}
        </text>
      )}
      {centerSub && (
        <text x={cx} y={cy + 16} textAnchor="middle" className="rpt-donut-sub">
          {centerSub}
        </text>
      )}
    </svg>
  );
}

function Legend({ items }) {
  return (
    <ul className="rpt-legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className="rpt-legend-swatch" style={{ background: it.color }} />
          <span className="rpt-legend-label">{it.label}</span>
          <span className="rpt-legend-value">{it.display}</span>
        </li>
      ))}
    </ul>
  );
}

// Sequential single-hue bar chart (fixed <=24px thick, capped, grows from
// one baseline) — used for the exits-per-month trend.
function BarChart({ data, color = "#2a78d6" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rpt-bars">
      {data.map((d) => (
        <div className="rpt-bar-col" key={d.label}>
          <div className="rpt-bar-track">
            <div
              className="rpt-bar-fill"
              style={{ height: `${(d.value / max) * 100}%`, background: color }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="rpt-bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function YearPicker({ years, value, onChange }) {
  return (
    <div className="hr-stats-head">
      <label>Year</label>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

// HR Reports — Attrition (headcount, exits by type, exits-per-month trend)
// and Attendance & Leave (today's attendance breakdown, leave days by
// type). All computed client-side from data the app already fetches
// elsewhere (employees, exits, today's attendance, leave summary) — no
// new backend aggregation endpoints needed.
function Reports() {
  const [employees, setEmployees] = useState([]);
  const [exits, setExits] = useState([]);
  const [attendanceToday, setAttendanceToday] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentYear = new Date().getFullYear();
  const [attritionYear, setAttritionYear] = useState(currentYear);
  const [leaveYear, setLeaveYear] = useState(currentYear);

  // Attendance overview report
  const [attReportPeriod, setAttReportPeriod] = useState(currentMonthValue());
  const [attReportDepartment, setAttReportDepartment] = useState("");
  const [attReportStatus, setAttReportStatus] = useState("");
  const [attReportRows, setAttReportRows] = useState(null);
  const [attReportPage, setAttReportPage] = useState(1);
  const [attPreviewing, setAttPreviewing] = useState(false);
  const [attExporting, setAttExporting] = useState(false);
  const [attReportError, setAttReportError] = useState("");

  // Onboarding overview report
  const [obReportPeriod, setObReportPeriod] = useState(currentMonthValue());
  const [obReportDepartment, setObReportDepartment] = useState("");
  const [obReportStatus, setObReportStatus] = useState("");
  const [obReportRows, setObReportRows] = useState(null);
  const [obReportPage, setObReportPage] = useState(1);
  const [obExporting, setObExporting] = useState(false);
  const [obReportError, setObReportError] = useState("");

  // Exit overview report
  const [exReportPeriod, setExReportPeriod] = useState(currentMonthValue());
  const [exReportDepartment, setExReportDepartment] = useState("");
  const [exReportStatus, setExReportStatus] = useState("");
  const [exReportRows, setExReportRows] = useState(null);
  const [exReportPage, setExReportPage] = useState(1);
  const [exExporting, setExExporting] = useState(false);
  const [exReportError, setExReportError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      client.get("/api/hr/employees/"),
      client.get("/api/hr/exits/"),
      client.get("/api/hr/attendance/today/"),
      client.get("/api/hr/leave/summary/"),
      client.get("/api/hr/departments/"),
      client.get("/api/hr/onboarding/interns/"),
    ])
      .then(([empRes, exitRes, attRes, leaveRes, deptRes, internRes]) => {
        setEmployees(empRes.data);
        setExits(exitRes.data);
        setAttendanceToday(attRes.data);
        setLeaveRequests(leaveRes.data.requests || []);
        setDepartments(deptRes.data.filter((d) => d.is_active));
        setInterns(internRes.data);
      })
      .catch(() => setError("Couldn't load report data."))
      .finally(() => setLoading(false));
  }, []);

  const previewAttendanceReport = async () => {
    setAttPreviewing(true);
    setAttReportError("");
    setAttReportPage(1);
    try {
      const { data } = await client.get("/api/hr/attendance/report/", {
        params: {
          period: attReportPeriod,
          department_id: attReportDepartment || undefined,
          status: attReportStatus || undefined,
        },
      });
      setAttReportRows(data);
    } catch (err) {
      setAttReportError("Couldn't load the report preview.");
    } finally {
      setAttPreviewing(false);
    }
  };

  const exportAttendanceReport = async () => {
    setAttExporting(true);
    setAttReportError("");
    try {
      await downloadReport(
        "/api/hr/attendance/report/export/",
        {
          period: attReportPeriod,
          department_id: attReportDepartment || undefined,
          status: attReportStatus || undefined,
        },
        `Attendance_Overview_${attReportPeriod}.xlsx`
      );
    } catch (err) {
      setAttReportError("Couldn't export the report.");
    } finally {
      setAttExporting(false);
    }
  };

  const previewOnboardingReport = () => {
    setObReportPage(1);
    const filtered = interns.filter((i) => {
      const st = onboardingStatusFor(i.progress_percent).label;
      if (obReportDepartment && String(i.department_id) !== String(obReportDepartment)) return false;
      if (obReportStatus && st !== obReportStatus) return false;
      if (obReportPeriod && (!i.internship_start_date || i.internship_start_date.slice(0, 7) !== obReportPeriod)) {
        return false;
      }
      return true;
    });
    setObReportRows(filtered);
  };

  const exportOnboardingReport = async () => {
    setObExporting(true);
    setObReportError("");
    try {
      await downloadReport(
        "/api/hr/onboarding/report/export/",
        {
          period: obReportPeriod || undefined,
          department_id: obReportDepartment || undefined,
          status: obReportStatus || undefined,
        },
        `Onboarding_Overview${obReportPeriod ? `_${obReportPeriod}` : ""}.xlsx`
      );
    } catch (err) {
      setObReportError("Couldn't export the report.");
    } finally {
      setObExporting(false);
    }
  };

  const previewExitReport = () => {
    setExReportPage(1);
    const filtered = exits.filter((e) => {
      if (exReportDepartment && String(e.department_id) !== String(exReportDepartment)) return false;
      if (exReportStatus && (EXIT_STATUS_LABEL[e.status] || e.status) !== exReportStatus) return false;
      if (exReportPeriod && (!e.exit_date || e.exit_date.slice(0, 7) !== exReportPeriod)) return false;
      return true;
    });
    setExReportRows(filtered);
  };

  const exportExitReport = async () => {
    setExExporting(true);
    setExReportError("");
    try {
      await downloadReport(
        "/api/hr/exits/report/export/",
        {
          period: exReportPeriod || undefined,
          department_id: exReportDepartment || undefined,
          status: exReportStatus || undefined,
        },
        `Exit_Overview${exReportPeriod ? `_${exReportPeriod}` : ""}.xlsx`
      );
    } catch (err) {
      setExReportError("Couldn't export the report.");
    } finally {
      setExExporting(false);
    }
  };

  const attritionYearOptions = useMemo(() => {
    const years = new Set([currentYear]);
    exits.forEach((e) => years.add(new Date(e.exit_date).getFullYear()));
    return [...years].sort((a, b) => b - a);
  }, [exits, currentYear]);

  const leaveYearOptions = useMemo(() => {
    const years = new Set([currentYear]);
    leaveRequests.forEach((r) => years.add(new Date(r.start_date).getFullYear()));
    return [...years].sort((a, b) => b - a);
  }, [leaveRequests, currentYear]);

  // Attrition
  const activeHeadcount = employees.filter((e) => !TERMINAL_EMPLOYEE_STATUSES.has(e.status)).length;
  const completedExitsInYear = exits.filter(
    (e) => e.status === "COMPLETED" && new Date(e.exit_date).getFullYear() === attritionYear
  );
  const attritionRate =
    activeHeadcount + completedExitsInYear.length > 0
      ? (completedExitsInYear.length / (activeHeadcount + completedExitsInYear.length)) * 100
      : 0;

  const exitTypeSegments = EXIT_TYPE_ORDER.map((type, i) => ({
    label: EXIT_TYPE_LABEL[type],
    value: completedExitsInYear.filter((e) => e.exit_type === type).length,
    color: CATEGORICAL[i],
  })).filter((s) => s.value > 0);

  const exitsByMonth = MONTH_LABELS.map((label, i) => ({
    label,
    value: completedExitsInYear.filter((e) => new Date(e.exit_date).getMonth() === i).length,
  }));

  // Attendance & Leave
  const attendanceSegments = attendanceToday
    ? [
        { label: "Present", value: attendanceToday.stats.present, color: STATUS.good },
        { label: "Half day", value: attendanceToday.stats.half_day, color: STATUS.warning },
        { label: "On leave", value: attendanceToday.stats.on_leave, color: CATEGORICAL[0] },
        { label: "Absent", value: attendanceToday.stats.absent, color: STATUS.critical },
        { label: "No login", value: attendanceToday.stats.no_login, color: STATUS.muted },
      ].filter((s) => s.value > 0)
    : [];
  const attendanceTotal = attendanceSegments.reduce((sum, s) => sum + s.value, 0);

  const leaveApprovedInYear = leaveRequests.filter(
    (r) => r.status === "APPROVED" && new Date(r.start_date).getFullYear() === leaveYear
  );
  const leaveTypeNames = [...new Set(leaveApprovedInYear.map((r) => r.leave_type_name).filter(Boolean))].sort();
  const leaveSegments = leaveTypeNames
    .map((name, i) => ({
      label: name,
      value: leaveApprovedInYear.filter((r) => r.leave_type_name === name).reduce((sum, r) => sum + r.total_days, 0),
      color: CATEGORICAL[i % CATEGORICAL.length],
    }))
    .filter((s) => s.value > 0);
  const leaveTotalDays = leaveSegments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="hr-screen">
      <div className="hr-head">
        <div>
          <h1>Reports</h1>
          <p>Attrition and attendance/leave, at a glance.</p>
        </div>
      </div>

      {error && <p className="hr-error">{error}</p>}
      {loading ? (
        <p className="hr-empty">Loading…</p>
      ) : (
        <>
          {/* Attendance overview */}
          <ReportFilterPanel
            title="Attendance overview"
            period={attReportPeriod}
            onPeriodChange={setAttReportPeriod}
            departments={departments}
            departmentValue={attReportDepartment}
            onDepartmentChange={setAttReportDepartment}
            statusOptions={ATTENDANCE_REPORT_STATUS_OPTIONS}
            statusValue={attReportStatus}
            onStatusChange={setAttReportStatus}
            onPreview={previewAttendanceReport}
            onExport={exportAttendanceReport}
            previewing={attPreviewing}
            exporting={attExporting}
          />
          {attReportError && <p className="hr-error">{attReportError}</p>}
          {attReportRows && (
            <div className="hr-panel rpt-panel">
              <div className="rpt-preview-head">
                <span>{attReportRows.length} {attReportRows.length === 1 ? "record" : "records"}</span>
                <button type="button" className="hr-btn-sm" onClick={() => setAttReportRows(null)}>
                  Close preview
                </button>
              </div>
              {attReportRows.length === 0 ? (
                <p className="hr-empty">No records match these filters.</p>
              ) : (
                <>
                  <div className="hr-table-scroll">
                    <table className="hr-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Date</th>
                          <th>Check in</th>
                          <th>Check out</th>
                          <th>Hours</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginate(attReportRows, attReportPage, 10).map((r, i) => (
                          <tr key={`${r.employee_id}-${r.date}-${i}`}>
                            <td>
                              <div className="hr-cell-user">
                                <EmployeeAvatar personId={r.person_id} size={28} />
                                <div className="hr-name">{r.full_name}</div>
                              </div>
                            </td>
                            <td>{r.department_name || "—"}</td>
                            <td className="hr-mono">{r.date}</td>
                            <td className="hr-mono">{formatTime(r.check_in_time)}</td>
                            <td className="hr-mono">{formatTime(r.check_out_time)}</td>
                            <td className="hr-mono">{formatHours(r.hours)}</td>
                            <td>
                              <span className={"att-pill " + (ATT_STATUS_CLASS[r.status] || "absent")}>
                                {ATT_STATUS_LABEL[r.status] || r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={attReportPage}
                    totalItems={attReportRows.length}
                    onPageChange={setAttReportPage}
                    pageSize={10}
                  />
                </>
              )}
              <div className="rpt-preview-foot">
                <button type="button" className="hr-btn-sm" onClick={() => setAttReportRows(null)}>
                  Close preview
                </button>
              </div>
            </div>
          )}

          {/* Onboarding overview */}
          <ReportFilterPanel
            title="Onboarding overview"
            period={obReportPeriod}
            onPeriodChange={setObReportPeriod}
            departments={departments}
            departmentValue={obReportDepartment}
            onDepartmentChange={setObReportDepartment}
            statusOptions={ONBOARDING_REPORT_STATUS_OPTIONS}
            statusValue={obReportStatus}
            onStatusChange={setObReportStatus}
            onPreview={previewOnboardingReport}
            onExport={exportOnboardingReport}
            exporting={obExporting}
          />
          {obReportError && <p className="hr-error">{obReportError}</p>}
          {obReportRows && (
            <div className="hr-panel rpt-panel">
              <div className="rpt-preview-head">
                <span>{obReportRows.length} {obReportRows.length === 1 ? "intern" : "interns"}</span>
                <button type="button" className="hr-btn-sm" onClick={() => setObReportRows(null)}>
                  Close preview
                </button>
              </div>
              {obReportRows.length === 0 ? (
                <p className="hr-empty">No interns match these filters.</p>
              ) : (
                <>
                  <div className="hr-table-scroll">
                    <table className="hr-table">
                      <thead>
                        <tr>
                          <th>Intern</th>
                          <th>Department</th>
                          <th>Designation</th>
                          <th>Started</th>
                          <th>Progress</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginate(obReportRows, obReportPage, 10).map((i) => {
                          const st = onboardingStatusFor(i.progress_percent);
                          return (
                            <tr key={i.intern_id}>
                              <td className="hr-name">{i.full_name}</td>
                              <td>{i.department_name || "—"}</td>
                              <td>{i.designation_name || "—"}</td>
                              <td className="hr-mono">{formatDate(i.internship_start_date)}</td>
                              <td className="hr-mono">{i.progress_percent}%</td>
                              <td>
                                <span className={"hr-pill " + st.cls}>{st.label}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={obReportPage}
                    totalItems={obReportRows.length}
                    onPageChange={setObReportPage}
                    pageSize={10}
                  />
                </>
              )}
              <div className="rpt-preview-foot">
                <button type="button" className="hr-btn-sm" onClick={() => setObReportRows(null)}>
                  Close preview
                </button>
              </div>
            </div>
          )}

          {/* Exit overview */}
          <ReportFilterPanel
            title="Exit overview"
            period={exReportPeriod}
            onPeriodChange={setExReportPeriod}
            departments={departments}
            departmentValue={exReportDepartment}
            onDepartmentChange={setExReportDepartment}
            statusOptions={EXIT_REPORT_STATUS_OPTIONS}
            statusValue={exReportStatus}
            onStatusChange={setExReportStatus}
            onPreview={previewExitReport}
            onExport={exportExitReport}
            exporting={exExporting}
          />
          {exReportError && <p className="hr-error">{exReportError}</p>}
          {exReportRows && (
            <div className="hr-panel rpt-panel">
              <div className="rpt-preview-head">
                <span>{exReportRows.length} {exReportRows.length === 1 ? "record" : "records"}</span>
                <button type="button" className="hr-btn-sm" onClick={() => setExReportRows(null)}>
                  Close preview
                </button>
              </div>
              {exReportRows.length === 0 ? (
                <p className="hr-empty">No exit records match these filters.</p>
              ) : (
                <>
                  <div className="hr-table-scroll">
                    <table className="hr-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Exit type</th>
                          <th>Exit date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginate(exReportRows, exReportPage, 10).map((r) => (
                          <tr key={r.exit_id}>
                            <td>
                              <div className="hr-cell-user">
                                <EmployeeAvatar personId={r.person_id} size={28} />
                                <div className="hr-name">{r.full_name}</div>
                              </div>
                            </td>
                            <td>{r.department_name || "—"}</td>
                            <td>{EXIT_TYPE_LABEL_FULL[r.exit_type] || r.exit_type}</td>
                            <td className="hr-mono">{formatDate(r.exit_date)}</td>
                            <td>
                              <span className={"hr-pill " + (EXIT_STATUS_CLASS[r.status] || "off")}>
                                {EXIT_STATUS_LABEL[r.status] || r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={exReportPage}
                    totalItems={exReportRows.length}
                    onPageChange={setExReportPage}
                    pageSize={10}
                  />
                </>
              )}
              <div className="rpt-preview-foot">
                <button type="button" className="hr-btn-sm" onClick={() => setExReportRows(null)}>
                  Close preview
                </button>
              </div>
            </div>
          )}

          {/* Attrition */}
          <div className="hr-panel rpt-panel">
            <div className="att-panel-head">
              <div>
                <h3>Attrition</h3>
                <p>Headcount lost this year, by type and by month.</p>
              </div>
              <YearPicker years={attritionYearOptions} value={attritionYear} onChange={setAttritionYear} />
            </div>

            <div className="rpt-panel-body">
            <div className="att-stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="att-stat-card">
                <span className="att-stat-label">Active headcount</span>
                <span className="att-stat-value">{activeHeadcount}</span>
                <span className="att-stat-sub">Right now</span>
              </div>
              <div className="att-stat-card">
                <span className="att-stat-label">Exits</span>
                <span className="att-stat-value">{completedExitsInYear.length}</span>
                <span className="att-stat-sub">Completed · {attritionYear}</span>
              </div>
              <div className="att-stat-card">
                <span className="att-stat-label">Attrition rate</span>
                <span className="att-stat-value">{formatPct(attritionRate)}</span>
                <span className="att-stat-sub">Exits ÷ (active + exits)</span>
              </div>
            </div>

            <div className="rpt-grid">
              <div className="rpt-chart-block">
                <h4>Exits by type</h4>
                {exitTypeSegments.length === 0 ? (
                  <p className="hr-empty">No completed exits in {attritionYear}.</p>
                ) : (
                  <div className="rpt-donut-row">
                    <Donut
                      segments={exitTypeSegments}
                      centerLabel={String(completedExitsInYear.length)}
                      centerSub="exits"
                    />
                    <Legend
                      items={exitTypeSegments.map((s) => ({ ...s, display: s.value }))}
                    />
                  </div>
                )}
              </div>
              <div className="rpt-chart-block">
                <h4>Exits by month · {attritionYear}</h4>
                <BarChart data={exitsByMonth} />
              </div>
            </div>
            </div>
          </div>

          {/* Attendance & Leave */}
          <div className="hr-panel rpt-panel">
            <div className="att-panel-head">
              <div>
                <h3>Attendance &amp; Leave</h3>
                <p>Today's attendance breakdown and leave days used by type.</p>
              </div>
            </div>

            <div className="rpt-panel-body">
            <div className="rpt-grid">
              <div className="rpt-chart-block">
                <h4>Today's attendance</h4>
                {attendanceTotal === 0 ? (
                  <p className="hr-empty">No active employees to show.</p>
                ) : (
                  <div className="rpt-donut-row">
                    <Donut segments={attendanceSegments} centerLabel={String(attendanceTotal)} centerSub="employees" />
                    <Legend
                      items={attendanceSegments.map((s) => ({
                        ...s,
                        display: `${s.value} (${formatPct((s.value / attendanceTotal) * 100)})`,
                      }))}
                    />
                  </div>
                )}
              </div>
              <div className="rpt-chart-block">
                <div className="rpt-chart-head-row">
                  <h4>Leave days used by type</h4>
                  <YearPicker years={leaveYearOptions} value={leaveYear} onChange={setLeaveYear} />
                </div>
                {leaveSegments.length === 0 ? (
                  <p className="hr-empty">No approved leave in {leaveYear}.</p>
                ) : (
                  <div className="rpt-donut-row">
                    <Donut segments={leaveSegments} centerLabel={String(leaveTotalDays)} centerSub="days" />
                    <Legend items={leaveSegments.map((s) => ({ ...s, display: `${s.value} days` }))} />
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Reports;
