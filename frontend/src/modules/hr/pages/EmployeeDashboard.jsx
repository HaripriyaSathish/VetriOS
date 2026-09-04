import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
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

// Landing page for anyone who isn't HR Administrator / System
// Administrator (see pages/Dashboard.jsx for the branch) — their own
// check-in/check-out control plus a short personal attendance history.
// Not gated by IsHRorSystemAdministrator on the backend: this is
// self-service, same as the check-in/out endpoints it calls.
function EmployeeDashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [punching, setPunching] = useState(false);
  const [punchError, setPunchError] = useState("");
  const [now, setNow] = useState(new Date());

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
          <h1>Welcome, {user?.full_name}</h1>
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
        </div>

        {loading ? (
          <p className="hr-empty">Loading…</p>
        ) : !data?.employee_id ? (
          <p className="hr-empty">No employee record is linked to your account.</p>
        ) : data.history.length === 0 ? (
          <p className="hr-empty">No attendance recorded yet.</p>
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
                {data.history.map((day) => (
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
  );
}

export default EmployeeDashboard;
