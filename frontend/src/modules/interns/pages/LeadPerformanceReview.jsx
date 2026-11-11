import { useEffect, useMemo, useState } from "react";
import { GraduationCap, ClipboardCheck, Star, CalendarDays, Search } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../../clients-projects/components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../../clients-projects/styles/PmPages.css";

const SCORE_FIELDS = [
  { key: "technical_score", label: "Technical" },
  { key: "communication_score", label: "Communication" },
  { key: "teamwork_score", label: "Teamwork" },
  { key: "problem_solving_score", label: "Problem Solving" },
  { key: "overall_score", label: "Overall" },
];

const initials = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

function LeadPerformanceReview() {
  const [interns, setInterns] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [selectedIntern, setSelectedIntern] = useState(null);
  const [scores, setScores] = useState({});
  const [strengths, setStrengths] = useState("");
  const [improvementAreas, setImprovementAreas] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchReviews = () =>
    client.get("/api/interns/lead/performance/").then(({ data }) => setReviews(data || [])).catch(() => {});

  useEffect(() => {
    Promise.all([
      client.get("/api/interns/lead/interns/")
        .then(({ data }) => setInterns(data || []))
        .catch((err) => setError(err.response?.data?.detail || "Couldn't load your interns.")),
      fetchReviews(),
    ]).finally(() => setLoading(false));
  }, []);

  const openReviewForm = (intern) => {
    setSelectedIntern(intern);
    setScores({});
    setStrengths("");
    setImprovementAreas("");
    setFeedback("");
    setFormError("");
    setMessage("");
  };

  const submitReview = async () => {
    if (!selectedIntern) return;
    const bad = SCORE_FIELDS.find((f) => scores[f.key] !== undefined && scores[f.key] !== "" && (Number(scores[f.key]) < 0 || Number(scores[f.key]) > 100));
    if (bad) {
      setFormError(`${bad.label} must be between 0 and 100.`);
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      await client.post(`/api/interns/lead/interns/${selectedIntern.intern_id}/performance/`, {
        ...scores,
        strengths,
        improvement_areas: improvementAreas,
        feedback,
        review_status: "COMPLETED",
      });
      setMessage(`Review submitted for ${selectedIntern.name}.`);
      setSelectedIntern(null);
      fetchReviews();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't submit the review.");
    } finally {
      setSubmitting(false);
    }
  };

  // The performance endpoint returns intern_name, not intern_id.
  const reviewsByName = useMemo(() => {
    const map = {};
    reviews.forEach((r) => { (map[r.intern_name] = map[r.intern_name] || []).push(r); });
    Object.values(map).forEach((list) => list.sort((a, b) => new Date(b.review_date) - new Date(a.review_date)));
    return map;
  }, [reviews]);

  const scored = reviews.filter((r) => r.overall_score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, r) => a + Number(r.overall_score), 0) / scored.length) : null;
  const unreviewed = interns.filter((i) => !reviewsByName[i.name]).length;
  const visible = interns.filter((i) => !search.trim() || [i.name, i.intern_code].some((v) => (v || "").toLowerCase().includes(search.trim().toLowerCase())));

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader section="Intern Reviews" title="Intern Performance Review" subtitle="Submit a periodic review for an intern reporting to you." />

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">MY INTERNS</p><span className="pm-ico navy"><GraduationCap size={20} /></span></div>
          <p className="bp-stat-value">{interns.length}</p>
          <p className="pm-foot"><span className={unreviewed ? "pm-warm" : ""}>{unreviewed} not reviewed yet</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">REVIEWS SUBMITTED</p><span className="pm-ico orange"><ClipboardCheck size={20} /></span></div>
          <p className="bp-stat-value">{reviews.length}</p>
          <p className="pm-foot"><span>Across all your interns</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">AVERAGE SCORE</p><span className="pm-ico green"><Star size={20} /></span></div>
          <p className="bp-stat-value">{avg != null ? `${avg}%` : "—"}</p>
          <p className="pm-foot"><span>Overall score</span></p>
        </div>
      </div>

      <div className="bp-panel pm-toolbar">
        <span className="bp-chip blue"><GraduationCap size={12} /> {interns.length} {interns.length === 1 ? "intern" : "interns"}</span>
        <label className="bp-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search interns…" />
        </label>
      </div>

      {loading ? (
        <p className="bp-loading">Loading your interns…</p>
      ) : visible.length === 0 ? (
        <p className="bp-panel pm-empty-panel">{interns.length ? "No interns match your search." : "No interns reporting to you yet."}</p>
      ) : (
        <div className="pm-list">
          {visible.map((i, idx) => {
            const history = reviewsByName[i.name] || [];
            const latest = history[0];
            return (
              <article key={i.intern_id} className="bp-panel pm-item" style={{ "--i": idx }}>
                <div className="pm-item-top">
                  <div className="bp-person">
                    <span className={`bp-avatar t${idx % 4}`}>{initials(i.name)}</span>
                    <div>
                      <p className="bp-person-name">{i.name}</p>
                      <p className="bp-person-sub">{i.intern_code} · {i.status}{i.internship_end_date ? ` · Ends ${day(i.internship_end_date)}` : ""}</p>
                    </div>
                  </div>
                  <div className="pm-tl-side">
                    <div className="pm-score">
                      <b className={!latest || latest.overall_score == null ? "none" : Number(latest.overall_score) < 60 ? "warm" : ""}>
                        {latest?.overall_score != null ? `${Math.round(latest.overall_score)}% Score` : "Not reviewed"}
                      </b>
                      {latest ? `Last review ${day(latest.review_date)}` : ""}
                    </div>
                    <button type="button" className="bp-btn navy small" onClick={() => openReviewForm(i)}><ClipboardCheck size={13} /> Evaluate</button>
                  </div>
                </div>
                {history.length > 0 && (
                  <div className="pm-tags">
                    {history.map((r) => (
                      <span key={r.performance_id} className="pm-tag"><CalendarDays size={11} /> {day(r.review_date)}{r.overall_score != null && <small> · {Math.round(r.overall_score)}%</small>}</span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {selectedIntern && (
        <div className="bp-modal-backdrop" onClick={() => !submitting && setSelectedIntern(null)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Performance Review</h2>
            <p className="bp-sub">{selectedIntern.name} · scores out of 100</p>
            <div className="bp-form-grid">
              {SCORE_FIELDS.map((f) => (
                <label key={f.key} className="bp-field"><span>{f.label}</span>
                  <input type="number" min="0" max="100" value={scores[f.key] || ""} onChange={(e) => setScores((prev) => ({ ...prev, [f.key]: e.target.value }))} />
                </label>
              ))}
              <label className="bp-field full"><span>Strengths</span>
                <textarea rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)} />
              </label>
              <label className="bp-field full"><span>Areas to improve</span>
                <textarea rows={2} value={improvementAreas} onChange={(e) => setImprovementAreas(e.target.value)} />
              </label>
              <label className="bp-field full"><span>General feedback</span>
                <textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              </label>
            </div>
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setSelectedIntern(null)} disabled={submitting}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={submitReview} disabled={submitting}>{submitting ? "Submitting…" : "Submit Review"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeadPerformanceReview;
