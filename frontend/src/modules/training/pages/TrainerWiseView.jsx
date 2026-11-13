import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BookOpen, Users, CalendarCheck, ClipboardList, NotebookPen, MessageSquare, Search, CircleCheck, Clock3,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/TrainerDashboard.css";
import "../styles/TrainingBatches.css";

// Trainer-wise Training Management (Business Team / System Admin, view only):
// everything one trainer is running — their batches, trainees, attendance,
// topics taught and pending reviews. Same data as the trainer's own
// dashboard, minus their private messages with students.
const STATUS_CHIP = { ACTIVE: "green", ONGOING: "green", PLANNED: "blue", COMPLETED: "gray", CANCELLED: "red" };
const initials = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const fmt = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const pct = (v) => (v == null ? "—" : `${Math.round(v)}%`);

function TrainerWiseView() {
  const { trainerId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState("active");

  useEffect(() => {
    client.get("/api/training/trainer/overview/", { params: { trainer_id: trainerId } })
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load this trainer."));
  }, [trainerId]);

  const batches = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return (show === "active" ? data.batches : data.all_batches).filter((b) =>
      !q || [b.batch_name, b.batch_code, b.course_name, b.latest_topic].some((v) => (v || "").toLowerCase().includes(q)));
  }, [data, search, show]);

  if (!data && !error) return <p className="bp-loading">Loading trainer…</p>;
  if (!data) return <p className="bp-error">{error}</p>;

  const st = data.stats;
  const trend = st.attendance_rate != null && st.attendance_rate_prev != null ? Math.round(st.attendance_rate - st.attendance_rate_prev) : null;
  const cards = [
    { label: "Active Batches", value: st.active_batches, sub: `${data.all_batches.length} in total`, Icon: BookOpen },
    { label: "Active Trainees", value: st.active_trainees, sub: "enrolled in active batches", Icon: Users },
    { label: "Attendance (30 days)", value: pct(st.attendance_rate), sub: trend == null ? "no earlier data" : `${trend >= 0 ? "+" : ""}${trend}% vs previous 30 days`, Icon: CalendarCheck },
    { label: "Pending Reviews", value: st.pending_reviews, sub: "submissions not yet scored", Icon: ClipboardList },
    { label: "Topics Today", value: st.topics_today, sub: `${st.batches_taught_today} batch(es) taught today`, Icon: NotebookPen },
    { label: "Unread Student Messages", value: st.unread_messages, sub: "waiting for the trainer", Icon: MessageSquare },
  ];

  return (
    <div className="bp-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb"><Link to="/training/management?tab=trainers">Training Management</Link> › <span>Trainer</span></p>
          <div className="bp-person" style={{ gap: 14 }}>
            <span className="bp-avatar t1" style={{ width: 48, height: 48, fontSize: 17 }}>{initials(data.full_name)}</span>
            <div>
              <h1 className="bp-title" style={{ margin: 0 }}>{data.full_name}</h1>
              <p className="bp-sub" style={{ margin: 0 }}>
                {data.specialization || "Trainer"}{data.email ? ` · ${data.email}` : ""} · view only
              </p>
            </div>
          </div>
        </div>
        <div className="bp-actions">
          <Link to="/training/management?tab=trainers" className="bp-btn outline">All trainers</Link>
        </div>
      </div>

      <div className="bp-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {cards.map((c, i) => (
          <div key={c.label} className="bp-stat" style={{ "--i": i }}>
            <div className="bp-stat-top">
              <p className="bp-stat-label">{c.label}</p>
              <span className="bp-stat-icon"><c.Icon size={16} /></span>
            </div>
            <p className="bp-stat-value">{c.value}</p>
            <p className="bp-person-sub">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="bp-panel">
        <div className="bp-filters">
          <div className="bp-tabs" role="tablist" aria-label="Batches">
            <button type="button" role="tab" aria-selected={show === "active"} className={`bp-tab ${show === "active" ? "active" : ""}`} onClick={() => setShow("active")}>
              Active <small>({data.batches.length})</small>
            </button>
            <button type="button" role="tab" aria-selected={show === "all"} className={`bp-tab ${show === "all" ? "active" : ""}`} onClick={() => setShow("all")}>
              All batches <small>({data.all_batches.length})</small>
            </button>
          </div>
          <label className="bp-search">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search batch, course or topic…" aria-label="Search batches" />
          </label>
        </div>

        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Status</th>
                <th>Dates</th>
                <th>Trainees</th>
                <th>Progress</th>
                <th>Attendance</th>
                <th>Topics</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr className="bp-empty-row"><td colSpan={7}>{data.all_batches.length ? "No batches match." : "This trainer has no batches yet."}</td></tr>
              ) : batches.map((b, i) => (
                <tr key={b.batch_id} style={{ "--row": i }}>
                  <td>
                    <Link to={`/training/batches/${b.batch_id}`} className="bp-person-name tm-link">{b.batch_name}</Link>
                    <p className="bp-person-sub">{b.batch_code} · {b.course_name}</p>
                  </td>
                  <td><span className={`bp-chip ${STATUS_CHIP[(b.status || "").toUpperCase()] || "blue"}`}>{b.status}</span></td>
                  <td className="bp-muted">{fmt(b.start_date)}<br />{b.end_date ? `to ${fmt(b.end_date)}` : ""}</td>
                  <td className="bp-strong">{b.students_enrolled}{b.capacity ? <span className="bp-muted"> / {b.capacity}</span> : null}</td>
                  <td style={{ minWidth: 110 }}>
                    {b.progress == null ? <span className="bp-muted">—</span> : (
                      <>
                        <b>{b.progress}%</b>
                        <div className="bp-meter"><span style={{ width: `${b.progress}%` }} /></div>
                      </>
                    )}
                  </td>
                  <td>
                    <b>{pct(b.attendance_rate)}</b>
                    <p className="bp-person-sub">
                      {b.attendance_marked_today
                        ? <span className="bp-chip green"><CircleCheck size={11} /> Marked today</span>
                        : <span className="bp-chip gray"><Clock3 size={11} /> Not marked today</span>}
                    </p>
                  </td>
                  <td>
                    <b>{b.topics_logged}</b> logged
                    {(b.today_topic || b.latest_topic) && <p className="bp-person-sub">{b.today_topic ? `Today: ${b.today_topic}` : `Last: ${b.latest_topic}`}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TrainerWiseView;
