import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, ShieldCheck, CalendarX2, Flame, Search, ChevronDown, LogIn, LogOut, Clock3 } from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/InternPages.css";

const TONE = { PRESENT: "green", ABSENT: "red", LATE: "orange", HALF_DAY: "orange", EXCUSED: "blue", LEAVE: "blue" };
const label = (s) => (s || "—").charAt(0) + (s || "").slice(1).toLowerCase().replace("_", " ");
const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");

function MyAttendance() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [shift, setShift] = useState(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [punching, setPunching] = useState(false);
  const [punchError, setPunchError] = useState("");

  const loadShift = () => client.get("/api/hr/attendance/me/").then(({ data: d }) => setShift(d)).catch(() => setShift(null));

  useEffect(() => {
    client.get("/api/interns/me/attendance/")
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your attendance."));
    loadShift();
  }, []);

  const records = useMemo(() => [...(data?.records || [])].sort((a, b) => (a.date < b.date ? 1 : -1)), [data]);
  const visible = records.filter((r) =>
    (!filter || r.status === filter) &&
    (!search.trim() || `${r.date} ${r.remarks || ""}`.toLowerCase().includes(search.trim().toLowerCase())));

  const handlePunch = async () => {
    setPunching(true);
    setPunchError("");
    try {
      await client.post(shift?.today?.checked_in ? "/api/hr/attendance/check-out/" : "/api/hr/attendance/check-in/");
      await loadShift();
    } catch (err) {
      setPunchError(err.response?.data?.detail || "Something went wrong.");
    } finally {
      setPunching(false);
    }
  };

  if (error) return <p className="bp-error">{error}</p>;
  if (!data) return <p className="bp-loading">Loading…</p>;

  const absent = records.filter((r) => r.status === "ABSENT").length;
  let streak = 0;
  for (const r of records) {
    if (r.status === "PRESENT") streak += 1;
    else break;
  }
  const lastSeven = records.slice(0, 7).reverse();
  const statuses = [...new Set(records.map((r) => r.status))];
  const today = shift?.today;
  const pct = data.attendance_percentage;

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Intern Workspace &gt; Operations &gt; <span>My Attendance</span></p>
          <h1 className="bp-title">Attendance &amp; Shift Log</h1>
          <p className="bp-sub">Your daily attendance as an intern, with your compliance rate and recent rhythm.</p>
        </div>
        {shift?.employee_id && !today?.checked_out && (
          <div className="bp-actions">
            <button type="button" className="bp-btn navy" onClick={handlePunch} disabled={punching}>
              {today?.checked_in ? <LogOut size={16} /> : <LogIn size={16} />} {punching ? "Working…" : today?.checked_in ? "Punch Out" : "Punch In"}
            </button>
          </div>
        )}
      </div>
      {punchError && <p className="bp-notice in-error">{punchError}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label in-label">ATTENDANCE COMPLIANCE</p>
            <span className="tr-stat-icon green"><ShieldCheck size={20} /></span>
          </div>
          <p className={`bp-stat-value ${pct != null && pct < 85 ? "tr-orange" : ""}`}>{pct != null ? `${pct}%` : "—"}</p>
          <p className="in-foot"><span>Target 85% or more</span></p>
          <div className="bp-meter"><span className={pct != null && pct < 85 ? "orange" : ""} style={{ width: `${pct ?? 0}%` }} /></div>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label in-label">PRESENT DAYS</p>
            <span className="tr-stat-icon blue"><CalendarCheck size={20} /></span>
          </div>
          <p className="bp-stat-value">{data.present_days} <small className="in-unit">/ {data.total_days}</small></p>
          <p className="in-foot"><span>Days recorded so far</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label in-label">ABSENCES</p>
            <span className="tr-stat-icon orange"><CalendarX2 size={20} /></span>
          </div>
          <p className="bp-stat-value">{absent}</p>
          <p className="in-foot"><span>Marked absent</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label in-label">{shift?.employee_id ? "TODAY'S SESSION" : "PRESENT STREAK"}</p>
            <span className="tr-stat-icon orange">{shift?.employee_id ? <Clock3 size={20} /> : <Flame size={20} />}</span>
          </div>
          {shift?.employee_id ? (
            <>
              <p className="bp-stat-value in-small-val">{today?.checked_in ? `In at ${timeOf(today.check_in_time)}` : "Not punched in"}</p>
              <p className="in-foot"><span>{today?.checked_out ? `Out at ${timeOf(today.check_out_time)}` : today?.status || ""}</span></p>
            </>
          ) : (
            <>
              <p className="bp-stat-value">{streak} <small className="in-unit">days</small></p>
              <p className="in-foot"><span>Consecutive present days</span></p>
            </>
          )}
        </div>
      </div>

      <section className="bp-panel tr-card">
        <div className="tr-card-head">
          <div>
            <h3>Recent Attendance Rhythm</h3>
            <p>Your last {lastSeven.length} recorded days</p>
          </div>
        </div>
        {lastSeven.length === 0 ? <p className="tr-empty">No records yet.</p> : (
          <div className="in-week">
            {lastSeven.map((r) => {
              const d = new Date(r.date);
              return (
                <div key={r.date} className="in-day">
                  <small>{d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}</small>
                  <b>{d.toLocaleDateString(undefined, { month: "short", day: "2-digit" })}</b>
                  <span className={`in-bar ${TONE[r.status] || "gray"}`} />
                  <span className={`bp-chip ${TONE[r.status] || "gray"}`}>{label(r.status)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bp-panel">
        <div className="in-table-head">
          <h3>Attendance Records</h3>
          <div className="in-table-tools">
            <label className="bp-search">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search date or remark…" />
            </label>
            <label className="bp-select">
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">All statuses</option>
                {statuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </div>
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead><tr><th>Date</th><th>Day</th><th>Status</th><th>Remarks</th></tr></thead>
            <tbody>
              {visible.length === 0 ? (
                <tr className="bp-empty-row"><td colSpan={4}>{records.length ? "No records match." : "No records yet."}</td></tr>
              ) : visible.map((r) => (
                <tr key={r.date}>
                  <td className="bp-strong">{new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="bp-muted">{new Date(r.date).toLocaleDateString(undefined, { weekday: "long" })}</td>
                  <td><span className={`bp-chip ${TONE[r.status] || "gray"}`}>{label(r.status)}</span></td>
                  <td className="bp-muted">{r.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default MyAttendance;
