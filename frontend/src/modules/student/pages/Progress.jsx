import { useEffect, useState } from "react";
import { BookOpen, ClipboardCheck, Timer, Check, CircleDot, Circle, ChevronRight } from "lucide-react";
import client from "../../../api/client";
import ScoreRing from "../components/ScoreRing";
import "../styles/StudentDashboard.css";
import "../styles/StudentPages.css";
import "../styles/Progress.css";

function formatDuration(minutes) {
  if (!minutes) return "0h 0m";
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function ModuleState({ percent }) {
  if (percent >= 100) return <span className="pg-state done"><Check size={13} strokeWidth={3} /></span>;
  if (percent > 0) return <span className="pg-state doing"><CircleDot size={13} strokeWidth={2.6} /></span>;
  return <span className="pg-state todo"><Circle size={12} strokeWidth={2.6} /></span>;
}

function Progress() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/api/student/progress/")
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your progress."));
  }, []);

  if (error) return <p className="sd-loading">{error}</p>;
  if (!data) return <p className="sd-loading">Loading…</p>;

  const facts = [
    {
      Icon: BookOpen, label: "Completed Lessons", hint: "Recorded and live sessions",
      value: data.lessons_completed, total: data.lessons_total,
    },
    {
      Icon: ClipboardCheck, label: "Completed Assessments", hint: "Quizzes & practical exams",
      value: data.assessments_completed, total: data.assessments_total,
    },
    {
      Icon: Timer, label: "Total Time Spent", hint: "Learning duration logged",
      value: formatDuration(data.time_spent_minutes),
    },
  ];

  return (
    <div className="sd-page pg-page">
      <div className="sp-head">
        <div>
          <h1 className="sp-title">My Progress</h1>
          <p className="sp-sub">Track your learning journey and achievements.</p>
        </div>
        <span className="sp-chip">{data.course_name}</span>
      </div>

      <div className="pg-top">
        <div className="sp-card pg-ring-card" style={{ "--delay": "0.08s" }}>
          <ScoreRing percent={data.course_progress_percent} size={140} stroke={22} color="#0a3591" track="#e3e9f4" />
          <p className="pg-ring-label">Course Progress</p>
        </div>

        <div className="sp-card pg-facts" style={{ "--delay": "0.14s" }}>
          {facts.map(({ Icon, label, hint, value, total }, i) => (
            <div key={label} className="pg-fact" style={{ "--i": i }}>
              <span className="pg-fact-icon"><Icon size={15} /></span>
              <div className="pg-fact-text">
                <p className="pg-fact-label">{label}</p>
                <p className="pg-fact-hint">{hint}</p>
              </div>
              <p className="pg-fact-value">
                {value}
                {total != null && <span> / {total}</span>}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="sp-card" style={{ "--delay": "0.2s" }}>
        <p className="sp-card-title">Course Modules</p>
        {data.modules.length === 0 ? (
          <p className="sd-empty">No modules have been set up for this course yet.</p>
        ) : (
          <div className="pg-modules">
            {data.modules.map((m, i) => (
              <div key={m.module_id} className="pg-module" style={{ "--i": i }}>
                <ModuleState percent={m.progress_percent} />
                <p className="pg-module-name" title={m.module_name}>{m.module_name}</p>
                <div className="sp-bar pg-module-bar">
                  <span style={{ width: `${m.progress_percent}%`, "--i": i }} />
                </div>
                <p className="pg-module-pct">{m.progress_percent}%</p>
                <span className="pg-module-tasks" title="Tasks submitted in this module">
                  {m.tasks_submitted}/{m.tasks_total}
                </span>
                <ChevronRight size={15} className="pg-chevron" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Progress;
