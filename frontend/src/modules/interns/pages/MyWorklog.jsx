import { useEffect, useState } from "react";
import { Timer, Flame, CalendarCheck, ListChecks, Plus, Trash2, Send, CalendarDays, Info } from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/InternPages.css";

// "9:30 am" / "18:00" -> minutes since midnight, or null if unparseable.
function toMinutes(t) {
  const m = String(t || "").trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  return h * 60 + min;
}

function hoursOf(log) {
  const a = toMinutes(log.login_time);
  const b = toMinutes(log.logout_time);
  return a != null && b != null && b > a ? Math.round(((b - a) / 60) * 10) / 10 : null;
}

function MyWorklog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [loginTime, setLoginTime] = useState("");
  const [logoutTime, setLogoutTime] = useState("");
  const [entries, setEntries] = useState([{ time: "", note: "" }]);

  const load = () => {
    setLoading(true);
    client.get("/api/interns/me/worklog/")
      .then(({ data }) => setLogs(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your worklogs."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const updateEntry = (idx, field, value) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  };

  const addEntryRow = () => setEntries((prev) => [...prev, { time: "", note: "" }]);
  const removeEntryRow = (idx) => setEntries((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await client.post("/api/interns/me/worklog/", {
        work_date: workDate,
        login_time: loginTime,
        logout_time: logoutTime,
        entries: entries.filter((e) => e.time || e.note),
      });
      setMessage("Worklog saved.");
      setEntries([{ time: "", note: "" }]);
      setLoginTime("");
      setLogoutTime("");
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't save worklog.");
    } finally {
      setSubmitting(false);
    }
  };

  const sorted = [...logs].sort((a, b) => (a.work_date < b.work_date ? 1 : -1));
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLog = sorted.find((l) => l.work_date === todayStr);
  const todayHours = todayLog ? hoursOf(todayLog) : null;
  let streak = 0;
  const cursor = new Date();
  const dates = new Set(sorted.map((l) => l.work_date));
  if (!dates.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekHours = sorted
    .filter((l) => new Date(l.work_date) >= new Date(weekAgo.toISOString().slice(0, 10)))
    .reduce((s, l) => s + (hoursOf(l) || 0), 0);
  const draftHours = hoursOf({ login_time: loginTime, logout_time: logoutTime });

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Intern Workspace &gt; <span>Daily Work Report</span></p>
          <h1 className="bp-title">Daily Work Report &amp; Progress Log</h1>
          <p className="bp-sub">Log your login and logout time and what you worked on today, for your manager to review.</p>
        </div>
      </div>

      {error && <p className="bp-notice in-error">{error}</p>}
      {message && <p className="bp-notice in-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">TODAY&apos;S HOURS</p><span className="tb-stat-icon-in navy"><Timer size={20} /></span></div>
          <p className="bp-stat-value">{todayHours != null ? todayHours : "—"} <small className="in-unit">/ 8.0 hrs</small></p>
          <div className="bp-meter"><span style={{ width: `${Math.min(100, ((todayHours || 0) / 8) * 100)}%` }} /></div>
          <p className="in-foot"><span>{todayLog ? "Logged today" : "Not logged yet today"}</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">WORKLOG STREAK</p><span className="tb-stat-icon-in orange"><Flame size={20} /></span></div>
          <p className="bp-stat-value">{streak} <small className="in-unit">Days</small></p>
          <p className="in-foot"><span>Consecutive days logged</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">REPORTS SUBMITTED</p><span className="tb-stat-icon-in green"><CalendarCheck size={20} /></span></div>
          <p className="bp-stat-value">{logs.length}</p>
          <p className="in-foot"><span>All daily reports so far</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">LAST 7 DAYS</p><span className="tb-stat-icon-in navy"><ListChecks size={20} /></span></div>
          <p className="bp-stat-value">{Math.round(weekHours * 10) / 10} <small className="in-unit">Hours</small></p>
          <p className="in-foot"><span>From your login and logout times</span></p>
        </div>
      </div>

      <div className="tr-grid">
        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <p className="in-mini">ACTIVE SUBMISSION</p>
              <h3>Today&apos;s Work Report</h3>
            </div>
            <span className="bp-chip blue"><CalendarDays size={12} /> {new Date(workDate).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
          <div className="bp-form-grid in-three">
            <label className="bp-field"><span>Date</span>
              <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
            </label>
            <label className="bp-field"><span>Login Time</span>
              <input placeholder="9:30 am" value={loginTime} onChange={(e) => setLoginTime(e.target.value)} />
            </label>
            <label className="bp-field"><span>Logout Time</span>
              <input placeholder="6:00 pm" value={logoutTime} onChange={(e) => setLogoutTime(e.target.value)} />
            </label>
          </div>
          {draftHours != null && <p className="in-hours"><Timer size={14} /> {draftHours} hrs for this day</p>}

          <div className="in-entries-head"><b>Work Entries</b><small>One row per time-block</small></div>
          {entries.map((e, idx) => (
            <div key={idx} className="in-entry">
              <input className="in-entry-time" placeholder="10:00 am" value={e.time} onChange={(ev) => updateEntry(idx, "time", ev.target.value)} />
              <input className="in-entry-note" placeholder="What did you work on?" value={e.note} onChange={(ev) => updateEntry(idx, "note", ev.target.value)} />
              {entries.length > 1 && (
                <button type="button" className="in-entry-remove" onClick={() => removeEntryRow(idx)} aria-label="Remove entry"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
          <div className="in-send-row">
            <button type="button" className="bp-btn soft" onClick={addEntryRow}><Plus size={14} /> Add Entry</button>
            <button type="button" className="bp-btn navy" onClick={submit} disabled={submitting}><Send size={14} /> {submitting ? "Saving…" : "Submit Daily Report"}</button>
          </div>
        </section>

        <div className="tr-col">
          <section className="bp-panel tr-card">
            <div className="tr-card-head">
              <h3>Recent Report History</h3>
              <span className="bp-muted in-small">Last {Math.min(5, sorted.length)} submissions</span>
            </div>
            {loading ? <p className="tr-empty">Loading past logs…</p> : sorted.length === 0 ? <p className="tr-empty">No reports yet.</p> : sorted.slice(0, 5).map((l) => (
              <div key={l.worklog_id} className="in-history">
                <div className="in-history-top">
                  <b><CalendarDays size={13} /> {new Date(l.work_date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</b>
                  <span className="bp-chip green">Submitted</span>
                </div>
                <ul>
                  {l.entries.slice(0, 3).map((e, i) => (
                    <li key={i}>{e.time && <b>{e.time}: </b>}{e.note}</li>
                  ))}
                  {l.entries.length > 3 && <li className="bp-muted">+{l.entries.length - 3} more</li>}
                </ul>
                <p className="in-history-foot"><span>{l.login_time} – {l.logout_time}</span><b>{hoursOf(l) != null ? `${hoursOf(l)} hrs` : ""}</b></p>
              </div>
            ))}
          </section>

          <div className="in-notice">
            <Info size={16} />
            <div>
              <b>Daily Protocol</b>
              <p>Submit your report before you log off each day so your manager sees what you worked on.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MyWorklog;
