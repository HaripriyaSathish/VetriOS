import { useEffect, useState } from "react";
import { CalendarDays, Check, X, Clock } from "lucide-react";
import client from "../../../api/client";
import { SparkleIcon, HeroExtras, CalendarIllustration } from "../../../components/FigmaIcons";
import LoginIllustration from "../../identity-access/components/LoginIllustration";
import { figmaImage } from "../../../assets/figmaImages";
import "../styles/StudentDashboard.css";
import "../styles/StudentAttendance.css";

// "Last 7 Days" picker on Attendance History (filters by attendance_date).
const RANGES = [
  { key: "7", label: "Last 7 Days", days: 7 },
  { key: "30", label: "Last 30 Days", days: 30 },
  { key: "all", label: "All Days", days: null },
];

const STATUS = {
  PRESENT: { label: "Present", Icon: Check },
  ABSENT: { label: "Absent", Icon: X },
  LATE: { label: "Late", Icon: Clock },
};

const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

const formatTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "-";

// No session column in the DB — derived from when the trainer logged check-in.
function sessionFor(checkIn) {
  if (!checkIn) return "-";
  const hour = new Date(checkIn).getHours();
  if (hour < 12) return "Morning";
  if (hour < 16) return "Afternoon";
  return "Evening";
}

function AttendanceRing({ percent }) {
  const size = 120, stroke = 13, radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(percent ?? 0));
    return () => cancelAnimationFrame(frame);
  }, [percent]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="sa-ring">
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" className="sa-ring-track" />
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" className="sa-ring-value"
        strokeLinecap="round" strokeDasharray={circumference}
        strokeDashoffset={circumference - (shown / 100) * circumference}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="sa-ring-text">
        {percent != null ? `${percent}%` : "—"}
      </text>
    </svg>
  );
}

function StudentAttendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rangeKey, setRangeKey] = useState("7");

  useEffect(() => {
    client.get("/api/student/attendance/")
      .then(({ data }) => setRecords(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load attendance."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="sd-loading">Loading…</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  const statusOf = (r) => (r.attendance_status || "").toUpperCase();
  const total = records.length;
  const present = records.filter((r) => statusOf(r) === "PRESENT").length;
  const absent = records.filter((r) => statusOf(r) === "ABSENT").length;
  const late = records.filter((r) => statusOf(r) === "LATE").length;
  const percent = total ? Math.round((present / total) * 100) : null;

  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[0];
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  if (range.days) cutoff.setDate(cutoff.getDate() - (range.days - 1));
  const history = range.days
    ? records.filter((r) => new Date(`${r.attendance_date}T00:00:00`) >= cutoff)
    : records;

  const heroSrc = figmaImage("hero-student");
  const heroImage = heroSrc ? <img src={heroSrc} alt="" /> : null;

  return (
    <div className="sd-page sa-page">
      <section className="sd-hero">
        <span className="sd-hero-shine" aria-hidden="true" />
        <span className="sd-hero-blob blob-a" aria-hidden="true" />
        <span className="sd-hero-blob blob-b" aria-hidden="true" />
        <div className="sd-hero-text">
          <p className="sd-hero-eyebrow">
            <span className="sd-hero-line" aria-hidden="true" />
            My Attendance
            <SparkleIcon size={18} />
          </p>
          <h1 className="sd-hero-title sa-hero-title">Track Your Learning Journey</h1>
          <p className="sd-hero-sub">Stay consistent and make the most of your learning experience.</p>
        </div>
        <div className="sd-hero-art" aria-hidden="true">
          {heroImage || (
            <>
              <LoginIllustration />
              <HeroExtras />
            </>
          )}
        </div>
      </section>

      <div className="sa-top">
        <div className="sa-overall">
          <p className="sa-card-title">Overall Attendance</p>
          <div className="sa-overall-body">
            <AttendanceRing percent={percent} />
            <ul className="sa-stats">
              <li><span className="sa-dot sa-dot-present"><Check size={12} strokeWidth={3} /></span>Present<b>{present}</b></li>
              <li><span className="sa-dot sa-dot-absent"><X size={12} strokeWidth={3} /></span>Absent<b>{absent}</b></li>
              {late > 0 && (
                <li><span className="sa-dot sa-dot-late"><Clock size={12} strokeWidth={3} /></span>Late<b>{late}</b></li>
              )}
              <li><span className="sa-dot sa-dot-total"><CalendarDays size={12} strokeWidth={2.6} /></span>Total Classes<b>{total}</b></li>
            </ul>
          </div>
        </div>

        <div className="sa-art-panel" aria-hidden="true">
          <span className="sa-art-dots" />
          <CalendarIllustration />
        </div>
      </div>

      <div className="sd-panel">
        <div className="sd-panel-head">
          <p className="sd-panel-title">
            <span className="sd-panel-icon"><CalendarDays size={16} /></span>
            Attendance History
          </p>
          <label className="sd-range">
            <CalendarDays size={14} />
            <select value={rangeKey} onChange={(e) => setRangeKey(e.target.value)} aria-label="Attendance range">
              {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
        </div>

        {history.length === 0 ? (
          <p className="sd-empty">
            {total === 0 ? "No attendance recorded yet." : `No attendance in the ${range.label.toLowerCase()}.`}
          </p>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Session</th>
                  <th>Course</th>
                  <th>Status</th>
                  <th>Check In Time</th>
                  <th>Check Out Time</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r, i) => {
                  const status = STATUS[statusOf(r)] || { label: r.attendance_status, Icon: Check };
                  return (
                    <tr key={`${r.attendance_date}-${i}`} style={{ "--row": i }}>
                      <td className="sa-date">{formatDate(r.attendance_date)}</td>
                      <td>{sessionFor(r.check_in_time)}</td>
                      <td className="sa-course">{r.course_name || "-"}</td>
                      <td>
                        <span className={`sa-pill sa-pill-${statusOf(r).toLowerCase()}`}>
                          <status.Icon size={11} strokeWidth={3} />
                          {status.label}
                        </span>
                      </td>
                      <td>{formatTime(r.check_in_time)}</td>
                      <td>{formatTime(r.check_out_time)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentAttendance;
