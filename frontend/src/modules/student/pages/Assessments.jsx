import { useEffect, useState } from "react";
import {
  Target, ClipboardList, LayoutGrid, Clock3, CircleCheck, BarChart3, Code2, FileText, Lightbulb,
  CalendarDays, Layers, Check, ArrowRight, Trophy, Video,
} from "lucide-react";
import client from "../../../api/client";
import StudentHero from "../components/StudentHero";
import ScoreRing from "../components/ScoreRing";
import "../styles/StudentDashboard.css";
import "../styles/StudentAttendance.css";
import "../styles/StudentPages.css";
import "../styles/Assessments.css";

const TABS = [
  { key: "all", label: "All Assessments", Icon: LayoutGrid },
  { key: "pending", label: "Pending", Icon: Clock3 },
  { key: "completed", label: "Completed", Icon: CircleCheck },
  { key: "results", label: "Results", Icon: BarChart3 },
];

const TYPE_ICON = { QUIZ: Code2, ASSIGNMENT: FileText, PRACTICAL: Lightbulb, PROJECT: Layers };

const titleCase = (s) => (s || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDate = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : null);
const num = (v) => (v == null ? null : Number(v));

// Passed when result_status says so, else compare with the passing score.
function passed(a) {
  const status = (a.result?.result_status || "").toUpperCase();
  if (["PASS", "PASSED"].includes(status)) return true;
  if (["FAIL", "FAILED"].includes(status)) return false;
  if (a.passing_score != null && a.result?.score != null) return num(a.result.score) >= num(a.passing_score);
  return null;
}

function percentOf(a) {
  if (!a.result) return null;
  if (a.result.percentage != null) return Math.round(num(a.result.percentage));
  if (a.result.score != null && num(a.max_score)) return Math.round((num(a.result.score) / num(a.max_score)) * 100);
  return null;
}

function statusOf(a) {
  if (a.result) return "completed";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (a.due_date && new Date(`${a.due_date}T00:00:00`) < today) return "overdue";
  return "pending";
}

function Pill({ label, tone }) {
  return <span className={`sp-pill sp-pill-${tone}`}>{label}</span>;
}

function CategoryTable({ block }) {
  return (
    <div className="as-cat">
      <div className="as-cat-head">
        <p>{block.label}</p>
        <span>{block.submitted} / {block.total} submitted</span>
      </div>
      {block.rows.length === 0 ? (
        <p className="sd-empty">None assigned yet.</p>
      ) : (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr><th>Title</th><th>Due Date</th><th>Status</th><th>Score</th></tr>
            </thead>
            <tbody>
              {block.rows.map((r, i) => (
                <tr key={r.id} style={{ "--row": i }}>
                  <td className="sa-course">{r.title}</td>
                  <td>{fmtDate(r.due_date) || "—"}</td>
                  <td>
                    {!r.submitted ? <Pill label="Not submitted" tone="red" /> : r.on_time ? <Pill label="On time" tone="green" /> : <Pill label="Late" tone="orange" />}
                  </td>
                  <td className="sa-course">{r.score != null ? `${r.score} / 100` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AssessmentRow({ a, index, open, onToggle }) {
  const status = statusOf(a);
  const Icon = TYPE_ICON[(a.type || "").toUpperCase()] || ClipboardList;
  const pct = percentOf(a);
  const pass = passed(a);
  return (
    <div className="sp-row" style={{ "--i": index }}>
      <div className="sp-row-main">
        <span className={`sp-row-icon sp-tone-${index % 5}`}><Icon size={22} /></span>
        <div className="sp-row-body">
          <p className="sp-row-title">
            {a.name}
            <span className="sp-tag">{titleCase(a.type)}</span>
          </p>
          <p className="sp-row-sub muted">{a.course_name}</p>
          <div className="sp-meta">
            <span><Layers size={13} /> Module {a.module_no} · {a.module_name}</span>
            {a.due_date && <span><CalendarDays size={13} /> Due: {fmtDate(a.due_date)}</span>}
            <span><Target size={13} /> Max score {num(a.max_score)}</span>
          </div>
        </div>
        <div className="sp-row-side inline">
          {status === "completed" && <Pill label={<><Check size={11} strokeWidth={3} /> Completed</>} tone="green" />}
          {status === "pending" && <Pill label="Pending" tone="orange" />}
          {status === "overdue" && <Pill label="Time Out" tone="red" />}
          {status === "completed" && (
            <button type="button" className="sp-btn sp-btn-blue" onClick={onToggle}>
              {open ? "Hide Results" : "View Results"}
            </button>
          )}
        </div>
      </div>

      {open && a.result && (
        <div className="sp-detail as-result">
          <div className="as-result-score">
            <b>{num(a.result.score)}</b> / {num(a.max_score)}
            {pct != null && <span> · {pct}%</span>}
            {pass != null && <Pill label={pass ? "Passed" : "Needs Improvement"} tone={pass ? "green" : "orange"} />}
          </div>
          {a.result.assessed_at && <p className="as-muted">Assessed on {fmtDate(a.result.assessed_at)} · Attempt {a.result.attempt_no}</p>}
          {a.result.feedback && <p><strong>Feedback:</strong> {a.result.feedback}</p>}
          {a.description && <p className="as-muted">{a.description}</p>}
        </div>
      )}
    </div>
  );
}

function Assessments() {
  const [data, setData] = useState(null);
  const [list, setList] = useState([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    client.get("/api/student/eligibility/")
      .then(({ data }) => setData(data))
      .catch(() => setError("Not enrolled in a batch yet."));
    client.get("/api/student/assessments/").then(({ data }) => setList(data)).catch(() => {});
  }, []);

  if (error) return <p className="sd-loading">{error}</p>;
  if (!data) return <p className="sd-loading">Loading…</p>;

  const mock = data.mock_interview;
  const completed = list.filter((a) => statusOf(a) === "completed");
  const pending = list.filter((a) => statusOf(a) !== "completed");
  const scores = completed.map(percentOf).filter((p) => p != null);
  const overall = scores.length ? Math.round(scores.reduce((s, p) => s + p, 0) / scores.length) : null;
  const recent = [...completed]
    .sort((x, y) => String(y.result.assessed_at || "").localeCompare(String(x.result.assessed_at || "")))
    .slice(0, 2);

  const shown = tab === "pending" ? pending : tab === "completed" || tab === "results" ? completed : list;

  return (
    <div className="sd-page as-page">
      <StudentHero
        eyebrow="Assessments"
        title={<>Test Your Knowledge,<br />Track Your Progress</>}
        subtitle="Complete assessments, improve your skills and achieve your goals."
      />

      <div className="as-top">
        <div className="sp-card" style={{ "--delay": "0.1s" }}>
          <p className="sp-card-title"><span className="sd-panel-icon"><Target size={15} /></span>Your Progress</p>
          <div className="as-progress">
            <ScoreRing percent={overall} caption="Overall Score" />
            <ul className="sp-stats">
              <li><span className="sp-dot" style={{ background: "#16a34a" }}><Check size={12} strokeWidth={3} /></span>Completed<b>{completed.length}</b></li>
              <li><span className="sp-dot" style={{ background: "#f5a524" }}><Clock3 size={12} strokeWidth={3} /></span>Pending<b>{pending.length}</b></li>
              <li><span className="sp-dot" style={{ background: "#2689ef" }}><LayoutGrid size={11} strokeWidth={3} /></span>Total Assessments<b>{list.length}</b></li>
            </ul>
          </div>
        </div>

        <div className="sp-card" style={{ "--delay": "0.16s" }}>
          <p className="sp-card-title">
            <span className="sd-panel-icon"><ClipboardList size={15} /></span>Recent Results
            {completed.length > 0 && (
              <button type="button" className="sp-link" onClick={() => setTab("results")}>View All <ArrowRight size={13} /></button>
            )}
          </p>
          {recent.length === 0 ? (
            <p className="sd-empty">No results yet — they'll appear here once your trainer grades an assessment.</p>
          ) : (
            <div className="as-recent">
              {recent.map((a, i) => {
                const Icon = TYPE_ICON[(a.type || "").toUpperCase()] || ClipboardList;
                const pass = passed(a);
                return (
                  <div key={a.assessment_id} className="as-recent-row">
                    <span className={`sp-row-icon small sp-tone-${i % 5}`}><Icon size={16} /></span>
                    <div className="sp-row-body">
                      <p className="as-recent-name">{a.name}</p>
                      <p className="as-recent-score">{num(a.result.score)}/{num(a.max_score)}</p>
                      {a.result.assessed_at && <p className="as-muted">{fmtDate(a.result.assessed_at)}</p>}
                    </div>
                    {pass != null && <Pill label={pass ? <><Check size={11} strokeWidth={3} /> Passed</> : "Needs Improvement"} tone={pass ? "green" : "orange"} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="sp-tabs">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} type="button" className={`sp-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="as-section">
        <p className="sp-card-title"><span className="sd-panel-icon"><ClipboardList size={15} /></span>
          {tab === "results" ? "Your Results" : "Available Assessments"}
        </p>
        <p className="sp-card-sub">Take your tests and track your performance</p>
        {shown.length === 0 ? (
          <p className="sp-empty">
            {list.length === 0 ? "No assessments have been set for your course yet." : "Nothing in this list right now."}
          </p>
        ) : (
          <div className="sp-list">
            {shown.map((a, i) => (
              <AssessmentRow
                key={a.assessment_id} a={a} index={i}
                open={tab === "results" || openId === a.assessment_id}
                onToggle={() => setOpenId(openId === a.assessment_id ? null : a.assessment_id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="as-keep">
        <div>
          <p className="as-keep-title"><Trophy size={18} /> Keep Going!</p>
          <p>Every test brings you closer to your goals.</p>
        </div>
        <span className="as-keep-trophy" aria-hidden="true"><Trophy size={44} /></span>
      </div>

      {/* Existing eligibility + mock interview info, kept from the old page */}
      <div className="sp-card" style={{ "--delay": "0.2s" }}>
        <p className="sp-card-title">
          <span className="sd-panel-icon"><Target size={15} /></span>{data.batch_label}
          <span style={{ marginLeft: "auto" }}>
            <Pill label={data.batch_status === "COMPLETED" ? "Course Completed" : "Ongoing"} tone={data.batch_status === "COMPLETED" ? "gray" : "blue"} />
          </span>
        </p>
        <div className="as-elig">
          <div className="as-elig-tile">
            <p className="as-elig-label">Attendance</p>
            <p className={`as-elig-value ${data.attendance_percentage >= 85 ? "good" : "bad"}`}>{data.attendance_percentage}%</p>
            <p className="as-muted">{data.present_days} / {data.total_days} days present</p>
          </div>
          <div className="as-elig-tile">
            <p className="as-elig-label">Tasks</p>
            <p className="as-elig-value">{data.assignments_submitted} / {data.total_assignments}</p>
            <p className={data.all_on_time ? "as-good" : "as-bad"}>{data.all_on_time ? "All submitted on time" : "Some missing or late"}</p>
          </div>
          <div className={`as-elig-tile ${data.eligible ? "ok" : "no"}`}>
            <p className="as-elig-value small">{data.eligible ? "Mock Interview Eligible" : "Not Yet Eligible"}</p>
            <p className="as-muted">Needs 85%+ attendance & all on-time</p>
          </div>
        </div>
      </div>

      <div className="sp-card" style={{ "--delay": "0.24s" }}>
        <p className="sp-card-title"><span className="sd-panel-icon"><Layers size={15} /></span>Assignment Breakdown</p>
        {data.category_breakdown.map((block) => <CategoryTable key={block.category} block={block} />)}
      </div>

      <div className="sp-card" style={{ "--delay": "0.28s" }}>
        <p className="sp-card-title"><span className="sd-panel-icon"><Video size={15} /></span>Mock Interview</p>
        {!mock.invited ? (
          <p className="sd-empty">You haven't been invited to a mock interview yet. Reach the eligibility criteria above and your trainer will send an invite.</p>
        ) : (
          <div className="as-mock">
            <div>
              <p className="as-mock-date">{mock.scheduled_date ? fmtDate(mock.scheduled_date) : "Not scheduled yet"}</p>
              <Pill
                label={mock.result_status === "PENDING" ? "Awaiting session" : mock.result_status}
                tone={mock.result_status === "PENDING" ? "orange" : mock.result_status === "PASS" ? "green" : "red"}
              />
              {mock.meeting_link && (
                <a href={mock.meeting_link} target="_blank" rel="noreferrer" className="sp-btn sp-btn-orange as-mock-join">
                  Join Meeting <ArrowRight size={14} />
                </a>
              )}
              {mock.feedback && <p className="as-mock-feedback">{mock.feedback}</p>}
            </div>
            {mock.score != null && <span className="as-mock-score">{mock.score}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default Assessments;
