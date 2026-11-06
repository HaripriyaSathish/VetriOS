import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, TrendingUp, ClipboardCheck, Star, MessageSquareQuote, CalendarDays, MessageSquare } from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/InternPages.css";

const PILLARS = [
  { key: "technical_score", label: "Technical" },
  { key: "communication_score", label: "Communication" },
  { key: "teamwork_score", label: "Teamwork" },
  { key: "problem_solving_score", label: "Problem Solving" },
];

function ScoreBar({ label, value, avg, warm }) {
  const pct = value != null ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <div className="in-score">
      <div className="in-score-top">
        <b>{label}</b>
        <b className={warm ? "tr-orange" : ""}>{value != null ? `${value}%` : "—"}</b>
      </div>
      <div className={`tr-progress thin ${warm ? "warm" : ""}`}><span style={{ width: `${pct}%` }} /></div>
      {avg != null && <small>Your average across reviews: {avg}%</small>}
    </div>
  );
}

function MyPerformance() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/api/interns/me/performance/")
      .then(({ data }) => setReviews(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load performance reviews."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="bp-loading">Loading…</p>;
  if (error) return <p className="bp-error">{error}</p>;

  const latest = reviews[0];
  const prev = reviews[1];
  const avgOf = (key) => {
    const vals = reviews.map((r) => r[key]).filter((v) => v != null).map(Number);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  };
  const delta = latest?.overall_score != null && prev?.overall_score != null ? Math.round(latest.overall_score - prev.overall_score) : null;
  const best = latest ? [...PILLARS].filter((p) => latest[p.key] != null).sort((a, b) => latest[b.key] - latest[a.key])[0] : null;
  const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Intern Workspace &gt; <span>My Performance</span></p>
          <h1 className="bp-title">Performance Metrics &amp; Evaluations</h1>
          <p className="bp-sub">Periodic reviews from your project lead, with scores and written feedback.</p>
        </div>
        <div className="bp-actions">
          <Link to="/intern/ask-lead" className="bp-btn navy"><MessageSquare size={16} /> Ask for Feedback</Link>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="bp-panel in-empty-panel">No performance reviews yet.</div>
      ) : (
        <>
          <div className="bp-stats tr-stats">
            <div className="bp-stat" style={{ "--i": 0 }}>
              <div className="bp-stat-top"><p className="bp-stat-label in-label">OVERALL SCORE</p><span className="tb-stat-icon-in orange"><Trophy size={20} /></span></div>
              <p className="bp-stat-value">{latest.overall_score ?? "—"} <small className="in-unit">/ 100</small></p>
              <p className="in-foot">{delta != null ? <span className={delta >= 0 ? "in-green" : "tr-orange"}><TrendingUp size={13} /> {delta >= 0 ? "+" : ""}{delta} vs previous</span> : <span>Latest review</span>}</p>
            </div>
            <div className="bp-stat" style={{ "--i": 1 }}>
              <div className="bp-stat-top"><p className="bp-stat-label in-label">AVERAGE OVERALL</p><span className="tb-stat-icon-in navy"><TrendingUp size={20} /></span></div>
              <p className="bp-stat-value">{avgOf("overall_score") ?? "—"}</p>
              <p className="in-foot"><span>Across all reviews</span></p>
            </div>
            <div className="bp-stat" style={{ "--i": 2 }}>
              <div className="bp-stat-top"><p className="bp-stat-label in-label">STRONGEST AREA</p><span className="tb-stat-icon-in green"><Star size={20} /></span></div>
              <p className="bp-stat-value in-small-val">{best ? best.label : "—"}</p>
              <p className="in-foot"><span>{best ? `${latest[best.key]}% in the latest review` : ""}</span></p>
            </div>
            <div className="bp-stat" style={{ "--i": 3 }}>
              <div className="bp-stat-top"><p className="bp-stat-label in-label">REVIEWS</p><span className="tb-stat-icon-in navy"><ClipboardCheck size={20} /></span></div>
              <p className="bp-stat-value">{reviews.length}</p>
              <p className="in-foot"><span>Latest on {fmt(latest.review_date)}</span></p>
            </div>
          </div>

          <div className="tr-grid">
            <section className="bp-panel tr-card">
              <div className="tr-card-head">
                <div>
                  <h3>Core Competency Breakdown</h3>
                  <p>Scores from your latest review ({fmt(latest.review_date)})</p>
                </div>
                <span className="bp-chip blue">{latest.review_status}</span>
              </div>
              {PILLARS.map((p, i) => (
                <ScoreBar key={p.key} label={p.label} value={latest[p.key]} avg={avgOf(p.key)} warm={i === 2} />
              ))}
              <ScoreBar label="Overall" value={latest.overall_score} avg={avgOf("overall_score")} />
            </section>

            <section className="bp-panel tr-card">
              <div className="tr-card-head">
                <div>
                  <h3><MessageSquareQuote size={18} /> Mentor &amp; Lead Feedback</h3>
                  <p>Written feedback from your reviews</p>
                </div>
              </div>
              {reviews.slice(0, 3).map((r) => (
                <div key={r.performance_id} className="in-feedback">
                  <div className="in-feedback-top">
                    <span className="bp-avatar">{(r.reviewer || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                    <span><b>{r.reviewer || "Project lead"}</b><small>{fmt(r.review_date)}</small></span>
                  </div>
                  {r.feedback && <p className="in-feedback-text">&ldquo;{r.feedback}&rdquo;</p>}
                  {r.strengths && <p className="in-feedback-line"><span className="bp-chip green">Strengths</span> {r.strengths}</p>}
                  {r.improvement_areas && <p className="in-feedback-line"><span className="bp-chip orange">To improve</span> {r.improvement_areas}</p>}
                </div>
              ))}
            </section>
          </div>

          <section className="bp-panel">
            <div className="in-table-head"><h3><CalendarDays size={16} /> Review History</h3></div>
            <div className="bp-table-wrap">
              <table className="bp-table">
                <thead><tr><th>Review Date</th><th>Technical</th><th>Communication</th><th>Teamwork</th><th>Problem Solving</th><th>Overall</th><th>Status</th><th>Reviewer</th></tr></thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.performance_id}>
                      <td className="bp-strong">{fmt(r.review_date)}</td>
                      <td>{r.technical_score ?? "—"}</td>
                      <td>{r.communication_score ?? "—"}</td>
                      <td>{r.teamwork_score ?? "—"}</td>
                      <td>{r.problem_solving_score ?? "—"}</td>
                      <td className="bp-strong">{r.overall_score ?? "—"}</td>
                      <td><span className="bp-chip blue">{r.review_status}</span></td>
                      <td className="bp-muted">{r.reviewer || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default MyPerformance;
