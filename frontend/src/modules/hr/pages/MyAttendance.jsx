import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Clock, Search, CalendarCheck, Timer, Plane } from "lucide-react";
import client from "../../../api/client";
import "../styles/HRDashboard.css";
import "../styles/Attendance.css";
import "../../documents/styles/DocumentLibrary.css";
import "../styles/EmployeePages.css";

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

const STATUS_FILTERS = [
  ["", "All"],
  ["PRESENT", "Present"],
  ["HALF_DAY", "Half day"],
  ["ON_LEAVE", "Leave"],
  ["ABSENT", "Absent"],
];

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
// history table with search and a status filter. Not HR-gated:
// self-service only.
function MyAttendance() {
  const { user } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [punching, setPunching] = useState(false);
  const [punchError, setPunchError] = useState("");
  const [now, setNow] = useState(new Date());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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

  const filteredHistory = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.history.filter((day) => {
      if (q && !formatDate(day.date).toLowerCase().includes(q) && !(STATUS_LABEL[day.status] || "").toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter && day.status !== statusFilter) return false;
      return true;
    });
  }, [data, search, statusFilter]);

  const today = data?.today;
  const bannerMessage = !data?.employee_id
    ? "No employee record is linked to your account"
    : today?.checked_out
    ? `You've completed your workday · checked out at ${formatTime(today.check_out_time)}`
    : today?.checked_in
    ? `You checked in at ${formatTime(today.check_in_time)}`
    : "Your workday hasn't started yet";

  const hist = data?.history || [];
  const present = hist.filter((d) => d.status === "PRESENT").length;
  const half = hist.filter((d) => d.status === "HALF_DAY").length;
  const leave = hist.filter((d) => d.status === "ON_LEAVE").length;
  const absent = hist.filter((d) => d.status === "ABSENT").length;
  const counted = present + half + absent;
  const rate = counted ? Math.round(((present + half * 0.5) / counted) * 1000) / 10 : null;
  const hrs = hist.map((d) => Number(d.hours)).filter((h) => h > 0);
  const avgHrs = hrs.length ? Math.round((hrs.reduce((s, h) => s + h, 0) / hrs.length) * 10) / 10 : null;

  return (
    <div className="att-screen emp2 dl2">
      <div className="dl2-ban">
        <div className="dl2-ban-top">
          <div>
            <h1>My attendance</h1>
            <p>Check in when you start, check out when you're done.</p>
          </div>
          <div className="dl2-ban-actions">
            <button
              type="button"
              className="dl2-new"
              onClick={handlePunch}
              disabled={punching || !data?.employee_id || today?.checked_out}
            >
              <Clock size={15} />
              {punching ? "Working…" : today?.checked_in ? "Check out" : "Check in"}
            </button>
          </div>
        </div>
      </div>

      <div className="dl2-body">
        {punchError && <p className="att-error">{punchError}</p>}
        {error && <p className="att-error">{error}</p>}

        {data?.employee_id && (
          <div className="att2-cards att2-four">
            <div className="att2-card tone-green">
              <span className="att2-card-top"><span className="att2-card-icon"><CalendarCheck size={16} /></span><b>{rate != null ? `${rate}%` : "—"}</b></span>
              <span className="att2-card-label"><span>Attendance rate</span><em>{present} present</em></span>
            </div>
            <div className="att2-card tone-blue">
              <span className="att2-card-top"><span className="att2-card-icon"><Timer size={16} /></span><b>{avgHrs != null ? avgHrs : "—"}</b></span>
              <span className="att2-card-label"><span>Average hours a day</span></span>
            </div>
            <div className="att2-card tone-amber">
              <span className="att2-card-top">
                <span className="att2-card-icon"><Clock size={16} /></span>
                <b className="txt">{today?.checked_out ? "Checked out" : today?.checked_in ? "On duty" : "Not in"}</b>
              </span>
              <span className="att2-card-label">
                <span>Today</span>
                <em>{today?.check_in_time ? `in ${formatTime(today.check_in_time)}` : ""}</em>
              </span>
            </div>
            <div className="att2-card tone-violet">
              <span className="att2-card-top"><span className="att2-card-icon"><Plane size={16} /></span><b>{leave}</b></span>
              <span className="att2-card-label"><span>Days on leave</span></span>
            </div>
          </div>
        )}

        <div className="emp2-strip">
          <span>
            <b>
              {greetingPrefix()}
              {firstName ? `, ${firstName}` : ""}
            </b>{" "}
            · {bannerMessage}
          </span>
          <time>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
        </div>

        <div className="emp2-panel">
          <div className="emp2-panel-head">
            <div>
              <h3>Last 14 days</h3>
            </div>
            <div className="emp2-tools">
              <label className="dl2-search">
                <Search size={15} />
                <input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <div className="dl2-seg">
                {STATUS_FILTERS.map(([value, label]) => (
                  <button key={value || "all"} type="button" className={statusFilter === value ? "on" : ""} onClick={() => setStatusFilter(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <p className="hr-empty">Loading…</p>
          ) : !data?.employee_id ? (
            <p className="hr-empty">No employee record is linked to your account.</p>
          ) : filteredHistory.length === 0 ? (
            <p className="hr-empty">
              {data.history.length === 0 ? "No attendance recorded yet." : "No records match your search or filter."}
            </p>
          ) : (
            <div className="hr-table-scroll">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Check in</th>
                    <th>Check out</th>
                    <th>Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((day) => (
                    <tr key={day.date}>
                      <td className="hr-mono">{formatDate(day.date)}</td>
                      <td className="hr-mono">{formatTime(day.check_in_time)}</td>
                      <td className="hr-mono">{formatTime(day.check_out_time)}</td>
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
    </div>
  );
}

export default MyAttendance;
