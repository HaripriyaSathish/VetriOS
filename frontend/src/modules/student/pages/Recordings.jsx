import { useEffect, useState } from "react";
import { Play, Check, CalendarDays } from "lucide-react";
import client from "../../../api/client";
import "../styles/StudentDashboard.css";
import "../styles/StudentPages.css";
import "../styles/Recordings.css";

const fmtDate = (d) =>
  new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

function Recordings() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get("/api/student/recordings/").then(({ data }) => setRecordings(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="sd-loading">Loading…</p>;

  const courseName = recordings[0]?.course_name;

  return (
    <div className="sd-page rec-page">
      <div className="sp-head">
        <div>
          <h1 className="sp-title">Session Recordings</h1>
          <p className="sp-sub">Rewatch your live sessions anytime.</p>
        </div>
        {courseName && <span className="sp-chip">{courseName}</span>}
      </div>

      {recordings.length === 0 ? (
        <p className="sp-empty">No recordings shared with you yet.</p>
      ) : (
        <div className="sp-list">
          {recordings.map((r, i) => (
            <div key={r.recording_id} className="sp-row rec-row" style={{ "--i": i }}>
              <div className="sp-row-main">
                <a
                  href={r.tracked_link} target="_blank" rel="noreferrer"
                  className={`rec-thumb rec-thumb-${i % 5}`} aria-label={`Watch ${r.title}`}
                >
                  <span className="rec-play"><Play size={16} fill="currentColor" /></span>
                </a>
                <div className="sp-row-body">
                  <p className="sp-row-title">
                    {r.title}
                    {r.watched && (
                      <span className="sp-pill sp-pill-green"><Check size={11} strokeWidth={3} /> Watched</span>
                    )}
                  </p>
                  {r.course_name && <p className="sp-row-sub muted">{r.course_name}</p>}
                  <div className="sp-meta">
                    <span><CalendarDays size={13} /> {fmtDate(r.date)}</span>
                    {r.watched && r.watched_at && <span>Watched {fmtDate(r.watched_at)}</span>}
                  </div>
                  {r.notes && <p className="rec-notes">{r.notes}</p>}
                </div>
                <div className="sp-row-side inline">
                  <a href={r.tracked_link} target="_blank" rel="noreferrer" className="sp-btn sp-btn-navy">
                    Watch
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Recordings;
