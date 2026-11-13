import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, UserPlus, Users, UserX, ListChecks } from "lucide-react";
import client from "../../../api/client";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import ReportFilterPanel from "../components/ReportFilterPanel";
import Pagination, { paginate } from "../../../components/Pagination";
import { downloadReport } from "../utils/exportFile";
import "../styles/HRDashboard.css";
import "../styles/Attendance.css";
import "../styles/Employees.css";

const ATTENDANCE_REPORT_STATUS_OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "ON_LEAVE", label: "On leave" },
  { value: "ABSENT", label: "Absent" },
  { value: "NO_LOGIN", label: "No login" },
];
const ONBOARDING_REPORT_STATUS_OPTIONS = [
  { value: "Needs action", label: "Needs action" },
  { value: "On track", label: "On track" },
  { value: "Completed", label: "Completed" },
];
const EMPLOYEE_ONBOARDING_STATUS_OPTIONS = [
  { value: "Login pending", label: "Login pending" },
  { value: "Login created", label: "Login created" },
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

// Validated categorical order (dataviz skill reference palette) — never
// reordered per-chart, so a given leave type always reads
// the same color across the whole report.
const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

// Fixed status palette — reserved for state, never reused as a series color.
const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b", muted: "#8a93a6" };

const TERMINAL_EMPLOYEE_STATUSES = new Set(["RESIGNED", "TERMINATED", "RETIRED", "INACTIVE"]);

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

// HR Reports — attendance reports (overview, monthly absentees, summary),
// employee and intern onboarding reports, and the Attendance & Leave charts
// (today's attendance breakdown, leave days by type).
function Reports() {
  const [employees, setEmployees] = useState([]);
  const [attendanceToday, setAttendanceToday] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentYear = new Date().getFullYear();
  const [report, setReport] = useState("attendance"); // attendance | absentees | summary | employee-onboarding | onboarding (interns)
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

  // Monthly absentees (a whole year) and Attendance summary (one month)
  const thisYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => thisYear - i);
  const [absYear, setAbsYear] = useState(String(thisYear));
  const [absDepartment, setAbsDepartment] = useState("");
  const [absData, setAbsData] = useState(null);
  const [absPage, setAbsPage] = useState(1);
  const [absPreviewing, setAbsPreviewing] = useState(false);
  const [absExporting, setAbsExporting] = useState(false);
  const [absError, setAbsError] = useState("");
  const [sumPeriod, setSumPeriod] = useState(currentMonthValue());
  const [sumDepartment, setSumDepartment] = useState("");
  const [sumRows, setSumRows] = useState(null);
  const [sumPage, setSumPage] = useState(1);
  const [sumPreviewing, setSumPreviewing] = useState(false);
  const [sumExporting, setSumExporting] = useState(false);
  const [sumError, setSumError] = useState("");

  // Onboarding overview report
  const [obReportPeriod, setObReportPeriod] = useState(currentMonthValue());
  const [obReportDepartment, setObReportDepartment] = useState("");
  const [obReportStatus, setObReportStatus] = useState("");
  const [obReportRows, setObReportRows] = useState(null);
  const [obReportPage, setObReportPage] = useState(1);
  const [obExporting, setObExporting] = useState(false);
  const [obReportError, setObReportError] = useState("");

  // Employee onboarding report (new joiners)
  const [eobPeriod, setEobPeriod] = useState(currentMonthValue());
  const [eobDepartment, setEobDepartment] = useState("");
  const [eobStatus, setEobStatus] = useState("");
  const [eobRows, setEobRows] = useState(null);
  const [eobPage, setEobPage] = useState(1);
  const [eobExporting, setEobExporting] = useState(false);
  const [eobError, setEobError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      client.get("/api/hr/employees/"),
      client.get("/api/hr/attendance/today/"),
      client.get("/api/hr/leave/summary/"),
      client.get("/api/hr/departments/"),
      client.get("/api/hr/onboarding/interns/"),
    ])
      .then(([empRes, attRes, leaveRes, deptRes, internRes]) => {
        setEmployees(empRes.data);
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

  const previewAbsentees = async () => {
    setAbsPreviewing(true);
    setAbsError("");
    setAbsPage(1);
    try {
      const { data } = await client.get("/api/hr/attendance/report/absentees/", {
        params: { year: absYear, department_id: absDepartment || undefined },
      });
      setAbsData(data);
    } catch {
      setAbsError("Couldn't load the absentees report.");
    } finally {
      setAbsPreviewing(false);
    }
  };

  const exportAbsentees = async () => {
    setAbsExporting(true);
    setAbsError("");
    try {
      await downloadReport(
        "/api/hr/attendance/report/absentees/export/",
        { year: absYear, department_id: absDepartment || undefined },
        `Monthly_Absentees_${absYear}.xlsx`
      );
    } catch {
      setAbsError("Couldn't export the report.");
    } finally {
      setAbsExporting(false);
    }
  };

  const previewSummary = async () => {
    setSumPreviewing(true);
    setSumError("");
    setSumPage(1);
    try {
      const { data } = await client.get("/api/hr/attendance/report/summary/", {
        params: { period: sumPeriod, department_id: sumDepartment || undefined },
      });
      setSumRows(data.rows);
    } catch {
      setSumError("Couldn't load the attendance summary.");
    } finally {
      setSumPreviewing(false);
    }
  };

  const exportSummary = async () => {
    setSumExporting(true);
    setSumError("");
    try {
      await downloadReport(
        "/api/hr/attendance/report/summary/export/",
        { period: sumPeriod, department_id: sumDepartment || undefined },
        `Attendance_Summary_${sumPeriod}.xlsx`
      );
    } catch {
      setSumError("Couldn't export the report.");
    } finally {
      setSumExporting(false);
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

  const previewEmployeeOnboarding = () => {
    setEobPage(1);
    setEobRows(
      employees.filter((e) => {
        if (/intern/i.test(e.employment_type_name || "")) return false;
        if (TERMINAL_EMPLOYEE_STATUSES.has(e.status)) return false;
        if (eobDepartment && String(e.department_id) !== String(eobDepartment)) return false;
        if (eobStatus && (e.has_login ? "Login created" : "Login pending") !== eobStatus) return false;
        if (eobPeriod && (!e.joining_date || e.joining_date.slice(0, 7) !== eobPeriod)) return false;
        return true;
      })
    );
  };

  const exportEmployeeOnboarding = async () => {
    setEobExporting(true);
    setEobError("");
    try {
      await downloadReport(
        "/api/hr/onboarding/employees/report/export/",
        {
          period: eobPeriod || undefined,
          department_id: eobDepartment || undefined,
          status: eobStatus || undefined,
        },
        `Employee_Onboarding${eobPeriod ? `_${eobPeriod}` : ""}.xlsx`
      );
    } catch {
      setEobError("Couldn't export the report.");
    } finally {
      setEobExporting(false);
    }
  };

  const leaveYearOptions = useMemo(() => {
    const years = new Set([currentYear]);
    leaveRequests.forEach((r) => years.add(new Date(r.start_date).getFullYear()));
    return [...years].sort((a, b) => b - a);
  }, [leaveRequests, currentYear]);

  // Attendance & Leave
  const attendanceSegments = attendanceToday
    ? [
        { label: "Present", value: attendanceToday.stats.present, color: STATUS.good },
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
    <div className="hr-screen rpt2">
      <div className="hr-head">
        <div>
          <h1>Reports</h1>
          <p>Attendance, absentees, onboarding and leave at a glance.</p>
        </div>
      </div>

      {error && <p className="hr-error">{error}</p>}
      {loading ? (
        <p className="hr-empty">Loading…</p>
      ) : (
        <>
          <div className="rpt2-switch" role="tablist" aria-label="Report type">
            {[
              { key: "attendance", label: "Attendance", Icon: CalendarCheck },
              { key: "absentees", label: "Monthly absentees", Icon: UserX },
              { key: "summary", label: "Attendance summary", Icon: ListChecks },
              { key: "employee-onboarding", label: "Employee onboarding", Icon: UserPlus },
              { key: "onboarding", label: "Intern onboarding", Icon: Users },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={report === key}
                className={report === key ? "active" : ""}
                onClick={() => setReport(key)}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {report === "attendance" && (
          <>
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

          </>
          )}

          {report === "absentees" && (
          <>
          <ReportFilterPanel
            title="Monthly absentees"
            subtitle="Absent working days for every month of a year. Sundays are holidays and never counted."
            year={absYear}
            onYearChange={setAbsYear}
            yearOptions={yearOptions}
            departments={departments}
            departmentValue={absDepartment}
            onDepartmentChange={setAbsDepartment}
            onPreview={previewAbsentees}
            onExport={exportAbsentees}
            previewing={absPreviewing}
            exporting={absExporting}
          />
          {absError && <p className="hr-error">{absError}</p>}
          {absData && (
            <div className="hr-panel rpt-panel">
              <div className="rpt-preview-head">
                <span>{absData.rows.length} {absData.rows.length === 1 ? "employee" : "employees"} · {absData.year}</span>
                <button type="button" className="hr-btn-sm" onClick={() => setAbsData(null)}>Close preview</button>
              </div>
              {absData.rows.length === 0 ? (
                <p className="hr-empty">No employees match these filters.</p>
              ) : (
                <>
                  <div className="hr-table-scroll">
                    <table className="hr-table rpt-absent-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m) => (
                            <th key={m} className="rpt-num">{m}</th>
                          ))}
                          <th className="rpt-num">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginate(absData.rows, absPage, 10).map((r) => (
                          <tr key={r.employee_id}>
                            <td>
                              <div className="hr-cell-user">
                                <EmployeeAvatar personId={r.person_id} size={28} />
                                <div>
                                  <div className="hr-name">{r.full_name}</div>
                                  <div className="hr-sub">{r.department_name || "—"}</div>
                                </div>
                              </div>
                            </td>
                            {r.months.map((n, i) => (
                              <td key={i} className="rpt-num">
                                {n ? (
                                  <span className="rpt-abs-cell" title={r.dates[i].join(", ")}>{n}</span>
                                ) : (
                                  <span className="rpt-zero">·</span>
                                )}
                              </td>
                            ))}
                            <td className="rpt-num"><b>{r.total}</b></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={absPage} totalItems={absData.rows.length} onPageChange={setAbsPage} pageSize={10} />
                </>
              )}
            </div>
          )}
          </>
          )}

          {report === "summary" && (
          <>
          <ReportFilterPanel
            title="Attendance summary"
            subtitle="Present, absent and on-leave days with hours worked, per employee for one month. Sundays are holidays."
            period={sumPeriod}
            onPeriodChange={setSumPeriod}
            departments={departments}
            departmentValue={sumDepartment}
            onDepartmentChange={setSumDepartment}
            onPreview={previewSummary}
            onExport={exportSummary}
            previewing={sumPreviewing}
            exporting={sumExporting}
          />
          {sumError && <p className="hr-error">{sumError}</p>}
          {sumRows && (
            <div className="hr-panel rpt-panel">
              <div className="rpt-preview-head">
                <span>{sumRows.length} {sumRows.length === 1 ? "employee" : "employees"} · {sumPeriod}</span>
                <button type="button" className="hr-btn-sm" onClick={() => setSumRows(null)}>Close preview</button>
              </div>
              {sumRows.length === 0 ? (
                <p className="hr-empty">No employees match these filters.</p>
              ) : (
                <>
                  <div className="hr-table-scroll">
                    <table className="hr-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Department</th>
                          <th className="rpt-num">Working days</th>
                          <th className="rpt-num">Present</th>
                          <th className="rpt-num">Absent</th>
                          <th className="rpt-num">On leave</th>
                          <th className="rpt-num">Total hours</th>
                          <th className="rpt-num">Avg / day</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginate(sumRows, sumPage, 10).map((r) => (
                          <tr key={r.employee_id}>
                            <td>
                              <div className="hr-cell-user">
                                <EmployeeAvatar personId={r.person_id} size={28} />
                                <div className="hr-name">{r.full_name}</div>
                              </div>
                            </td>
                            <td>{r.department_name || "—"}</td>
                            <td className="rpt-num hr-mono">{r.working_days}</td>
                            <td className="rpt-num"><span className="att-pill present">{r.present}</span></td>
                            <td className="rpt-num"><span className={"att-pill " + (r.absent ? "absent" : "no-login")}>{r.absent}</span></td>
                            <td className="rpt-num"><span className={"att-pill " + (r.on_leave ? "leave" : "no-login")}>{r.on_leave}</span></td>
                            <td className="rpt-num hr-mono">{r.total_hours}</td>
                            <td className="rpt-num hr-mono">{r.avg_hours ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={sumPage} totalItems={sumRows.length} onPageChange={setSumPage} pageSize={10} />
                </>
              )}
            </div>
          )}
          </>
          )}

          {report === "onboarding" && (
          <>
          <ReportFilterPanel
            title="Intern onboarding"
            subtitle="Interns and how far each one is through the onboarding checklist."
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

          </>
          )}

          {report === "employee-onboarding" && (
          <>
          <ReportFilterPanel
            title="Employee onboarding"
            subtitle="New joiners of a month: department, designation, and whether their login has been created."
            period={eobPeriod}
            onPeriodChange={setEobPeriod}
            departments={departments}
            departmentValue={eobDepartment}
            onDepartmentChange={setEobDepartment}
            statusOptions={EMPLOYEE_ONBOARDING_STATUS_OPTIONS}
            statusValue={eobStatus}
            onStatusChange={setEobStatus}
            onPreview={previewEmployeeOnboarding}
            onExport={exportEmployeeOnboarding}
            exporting={eobExporting}
          />
          {eobError && <p className="hr-error">{eobError}</p>}
          {eobRows && (
            <div className="hr-panel rpt-panel">
              <div className="rpt-preview-head">
                <span>{eobRows.length} {eobRows.length === 1 ? "employee" : "employees"}</span>
                <button type="button" className="hr-btn-sm" onClick={() => setEobRows(null)}>Close preview</button>
              </div>
              {eobRows.length === 0 ? (
                <p className="hr-empty">No new joiners match these filters.</p>
              ) : (
                <>
                  <div className="hr-table-scroll">
                    <table className="hr-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Designation</th>
                          <th>Type</th>
                          <th>Joined</th>
                          <th>Login</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginate(eobRows, eobPage, 10).map((e) => (
                          <tr key={e.employee_id}>
                            <td>
                              <div className="hr-cell-user">
                                <EmployeeAvatar personId={e.person_id} size={28} />
                                <div>
                                  <div className="hr-name">{e.full_name}</div>
                                  <div className="hr-sub">{e.employee_code || "—"}</div>
                                </div>
                              </div>
                            </td>
                            <td>{e.department_name || "—"}</td>
                            <td>{e.designation_name || "—"}</td>
                            <td>{e.employment_type_name || "—"}</td>
                            <td className="hr-mono">{formatDate(e.joining_date)}</td>
                            <td>
                              <span className={"hr-pill " + (e.has_login ? "on" : "warn")}>
                                {e.has_login ? "Login created" : "Login pending"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={eobPage} totalItems={eobRows.length} onPageChange={setEobPage} pageSize={10} />
                </>
              )}
            </div>
          )}
          </>
          )}

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
