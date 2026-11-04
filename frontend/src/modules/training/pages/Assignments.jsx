import { useEffect, useState } from "react";
import client from "../../../api/client";
import {
  Download, CirclePlus, FileClock, Trophy, Timer, ShieldCheck, ChevronDown, CircleCheck, Link2, ArrowRight,
  Gauge, Flag, CalendarDays, Medal, Sparkles,
} from "lucide-react";
import "../styles/BusinessPages.css";
import "../styles/TrainerDashboard.css";
import "../styles/TrainingBatches.css";
import "../styles/Assignments.css";

const CATEGORIES = [
  { value: "task", label: "Daily Task", color: "bg-green-600" },
  { value: "mini_project", label: "Mini Project", color: "bg-amber-600" },
  { value: "main_project", label: "Main Project", color: "bg-purple-600" },
  { value: "seminar", label: "Seminar", color: "bg-cyan-600" },
];

function getUser() {
  return JSON.parse(localStorage.getItem("user") || "null");
}

function Assignments() {
  const user = getUser();
  const canEdit = (user?.roles || []).includes("Employee");

  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [activeCategory, setActiveCategory] = useState("task");

  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("beginner");
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showManual, setShowManual] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualDueDate, setManualDueDate] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editScore, setEditScore] = useState("");
  const [editFeedback, setEditFeedback] = useState("");
  const [editSubmissionDate, setEditSubmissionDate] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    client.get("/api/training/dashboard/").then(({ data }) => {
      const b = data.batches || [];
      setBatches(b);
      if (b.length > 0) setSelectedBatchId(b[0].batch_id);
    });
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      loadTasks();
      loadSubmissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId, activeCategory]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const { data } = await client.get(`/api/training/batches/${selectedBatchId}/tasks/`, {
        params: { category: activeCategory },
      });
      setTasks(data);
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async () => {
    try {
      const { data } = await client.get(`/api/training/batches/${selectedBatchId}/student-tasks/`);
      setSubmissions(data.filter((s) => s.category === activeCategory));
    } catch {
      setSubmissions([]);
    }
  };

  const activeConfig = CATEGORIES.find((c) => c.value === activeCategory);

  const handleGenerate = async () => {
    setError(""); setSuccess(""); setGeneratedContent("");
    if (!topic) {
      setError("Enter a topic first.");
      return;
    }
    setGenerating(true);
    try {
      const { data } = await client.post("/api/training/tasks/generate-content/", {
        topic, level, category: activeCategory,
      });
      setGeneratedContent(data.generated_content);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to generate content.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveGenerated = async () => {
    if (!dueDate) {
      setError("Set a due date before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await client.post("/api/training/tasks/create/", {
        batch_id: selectedBatchId, category: activeCategory,
        title: topic, description: generatedContent, due_date: dueDate,
      });
      setSuccess(`Saved and assigned to ${data.assigned_count} student(s).`);
      setGeneratedContent(""); setTopic(""); setDueDate("");
      loadTasks();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleManualSave = async () => {
    if (!manualTitle.trim() || !manualDescription.trim() || !manualDueDate) {
      setError("Title, description, and due date are all required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await client.post("/api/training/tasks/create/", {
        batch_id: selectedBatchId, category: activeCategory,
        title: manualTitle, description: manualDescription, due_date: manualDueDate,
      });
      setSuccess(`Saved and assigned to ${data.assigned_count} student(s).`);
      setManualTitle(""); setManualDescription(""); setManualDueDate("");
      loadTasks();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s) => {
    setEditingId(s.student_task_id);
    setEditScore(s.score ?? "");
    setEditFeedback(s.feedback || "");
    setEditSubmissionDate(s.submission_date ? s.submission_date.slice(0, 10) : "");
  };

  const saveEdit = async (id) => {
    setEditSaving(true);
    try {
      await client.patch(`/api/training/student-tasks/${id}/`, {
        score: editScore === "" ? null : editScore,
        feedback: editFeedback,
        submission_date: editSubmissionDate || null,
      });
      setEditingId(null);
      loadSubmissions();
    } catch (err) {
      setError("Failed to save changes.");
    } finally {
      setEditSaving(false);
    }
  };

  const toggleVerified = async (id, currentValue) => {
    try {
      await client.patch(`/api/training/student-tasks/${id}/`, { verified: !currentValue });
      loadSubmissions();
    } catch (err) {
      setError("Failed to update verification.");
    }
  };

  const [creatorOpen, setCreatorOpen] = useState(false);
  const pending = submissions.filter((s) => s.submission_date && (s.score === null || s.score === undefined));
  const graded = submissions.filter((s) => s.score !== null && s.score !== undefined);
  const submitted = submissions.filter((s) => s.submission_date);
  const avgScore = graded.length ? Math.round((graded.reduce((sum, s) => sum + Number(s.score), 0) / graded.length) * 10) / 10 : null;
  const onTime = submitted.filter((s) => s.on_time).length;
  const onTimeRate = submitted.length ? Math.round((onTime / submitted.length) * 1000) / 10 : null;
  const verified = submitted.filter((s) => s.verified).length;
  const verifiedRate = submitted.length ? Math.round((verified / submitted.length) * 1000) / 10 : null;
  const gradedPct = submitted.length ? Math.round((graded.length / submitted.length) * 100) : 0;
  const ordered = [...submissions].sort((a, b) => {
    const rank = (s) => (s.submission_date && s.score == null ? 0 : s.submission_date ? 1 : 2);
    return rank(a) - rank(b);
  });
  const leaders = Object.values(graded.reduce((acc, s) => {
    const k = s.student_name;
    acc[k] = acc[k] || { name: k, total: 0, n: 0 };
    acc[k].total += Number(s.score);
    acc[k].n += 1;
    return acc;
  }, {})).map((x) => ({ ...x, avg: Math.round(x.total / x.n) })).sort((a, b) => b.avg - a.avg).slice(0, 3);
  const today = new Date().toISOString().slice(0, 10);

  const exportGrades = () => {
    const head = ["Student", "Task", "Category", "Submitted", "On time", "Score", "Verified", "Feedback"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [head.join(",")].concat(submissions.map((s) => [
      s.student_name, s.task_title, activeConfig.label, s.submission_date ? s.submission_date.slice(0, 10) : "",
      s.on_time === null ? "" : s.on_time ? "Yes" : "No", s.score ?? "", s.verified ? "Yes" : "No", s.feedback || "",
    ].map(esc).join(",")));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `grade-sheet-${activeCategory}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Trainer Workspace / <span>Assignments &amp; Evaluations</span></p>
          <h1 className="bp-title">Assignments, Labs &amp; Capstone Reviews</h1>
          <p className="bp-sub">Create tasks and projects, grade trainee submissions and publish feedback per batch.</p>
        </div>
        <div className="bp-actions">
          <button type="button" className="bp-btn outline" onClick={exportGrades} disabled={!submissions.length}><Download size={16} /> Export Grade Sheet (CSV)</button>
          {canEdit && (
            <button type="button" className="bp-btn navy" onClick={() => setCreatorOpen(true)}><CirclePlus size={16} /> Create New {activeConfig.label}</button>
          )}
        </div>
      </div>

      {error && <p className="bp-notice as-error">{error}</p>}
      {success && <p className="bp-notice as-success">{success}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label as-label">PENDING GRADING</p>
            <span className="tb-stat-icon navy"><FileClock size={20} /></span>
          </div>
          <p className="bp-stat-value">{pending.length} <small className="as-unit">Submissions</small></p>
          <p className="as-foot"><span>{submitted.length} submitted in total</span>{pending.length > 0 && <span className="bp-chip orange">Needs Review</span>}</p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label as-label">AVERAGE COHORT SCORE</p>
            <span className="tb-stat-icon green"><Trophy size={20} /></span>
          </div>
          <p className="bp-stat-value">{avgScore != null ? `${avgScore}%` : "—"}</p>
          <p className="as-foot"><span>Across {graded.length} graded</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label as-label">ON-TIME SUBMISSION RATE</p>
            <span className="tb-stat-icon blue"><Timer size={20} /></span>
          </div>
          <p className="bp-stat-value">{onTimeRate != null ? `${onTimeRate}%` : "—"}</p>
          <p className="as-foot"><span>{onTime} of {submitted.length} before due date</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label as-label">VERIFIED SUBMISSIONS</p>
            <span className="tb-stat-icon navy"><ShieldCheck size={20} /></span>
          </div>
          <p className="bp-stat-value">{verifiedRate != null ? `${verifiedRate}%` : "—"}</p>
          <p className="as-foot"><span>{verified} checked by you</span></p>
        </div>
      </div>

      <div className="tr-grid">
        <div className="tr-col">
          <div className="bp-panel as-toolbar">
            <div className="bp-tabs">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`bp-tab ${activeCategory === c.value ? "active" : ""}`}
                  onClick={() => { setActiveCategory(c.value); setGeneratedContent(""); setTopic(""); setError(""); setSuccess(""); }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <label className="bp-select">
              <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
                {batches.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>
                    {b.batch_name}{b.trainer_name ? ` — ${b.trainer_name}` : " — Unassigned"}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
          </div>

          {ordered.length === 0 ? (
            <p className="bp-panel tb-empty">No submissions yet for this category.</p>
          ) : ordered.map((s) => {
            const isPending = s.submission_date && s.score == null;
            const editing = editingId === s.student_task_id;
            return (
              <article key={s.student_task_id} className={`as-card ${isPending ? "pending" : s.submission_date ? "" : "idle"}`}>
                <div className="as-card-top">
                  <span className="as-tags">
                    <span className="bp-chip blue">{activeConfig.label}</span>
                    {isPending ? <span className="as-flag warm">Awaiting grade</span> : s.submission_date ? <span className="as-flag">Graded</span> : <span className="as-flag muted">Not submitted</span>}
                  </span>
                  {s.on_time !== null && (
                    <span className={`bp-chip ${s.on_time ? "green" : "red"}`}>{s.on_time ? "On Time" : "Late"}</span>
                  )}
                </div>
                <h3>{s.task_title}</h3>
                <p className="as-who"><b>{s.student_name}</b> · {s.submission_date ? `Submitted ${s.submission_date.slice(0, 10)}` : "No submission yet"}</p>
                <div className="as-checks">
                  <span><CircleCheck size={14} /> Score: <b>{s.score ?? "—"}</b></span>
                  <span className="as-note">{s.feedback ? `Feedback: ${s.feedback}` : s.student_note ? `Note: ${s.student_note}` : "No feedback yet"}</span>
                </div>
                {s.links && (
                  <div className="as-links">
                    {s.links.split("\n").filter(Boolean).map((l, i) => (
                      <a key={i} href={l.trim()} target="_blank" rel="noreferrer"><Link2 size={13} /> {l.trim()}</a>
                    ))}
                  </div>
                )}
                <div className="as-card-foot">
                  <label className="as-verify">
                    <input
                      type="checkbox"
                      checked={!!s.verified}
                      disabled={!s.submission_date}
                      onChange={() => toggleVerified(s.student_task_id, s.verified)}
                    />
                    {s.verified ? "Verified" : "Not verified yet"}
                  </label>
                  {canEdit && (
                    <button type="button" className={`bp-btn small ${isPending ? "navy" : "outline"}`} onClick={() => (editing ? setEditingId(null) : startEdit(s))}>
                      {editing ? "Close" : isPending ? <>Grade &amp; Feedback <ArrowRight size={13} /></> : "Edit Grade"}
                    </button>
                  )}
                </div>
                {editing && (
                  <div className="as-grade">
                    <label className="bp-field"><span>Submission Date</span>
                      <input type="date" value={editSubmissionDate} onChange={(e) => setEditSubmissionDate(e.target.value)} />
                    </label>
                    <label className="bp-field"><span>Score</span>
                      <input type="number" min="0" max="100" value={editScore} onChange={(e) => setEditScore(e.target.value)} />
                    </label>
                    <label className="bp-field as-grow"><span>Feedback</span>
                      <input value={editFeedback} onChange={(e) => setEditFeedback(e.target.value)} />
                    </label>
                    <button type="button" className="bp-btn navy" onClick={() => saveEdit(s.student_task_id)} disabled={editSaving}>{editSaving ? "Saving…" : "Save"}</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="tr-col">
          <section className="bp-panel tr-card">
            <div className="tr-card-head">
              <h3><Gauge size={18} /> Grading Velocity</h3>
              <span className="bp-chip green">{gradedPct}% Graded</span>
            </div>
            <div className="as-velocity">
              <div className="as-ring" style={{ "--p": `${gradedPct}%` }}><b>{pending.length}</b></div>
              <div>
                <b>Pending review</b>
                <p>{graded.length} graded of {submitted.length} submitted</p>
              </div>
            </div>
            <div className="tr-progress thin"><span style={{ width: `${gradedPct}%` }} /></div>
          </section>

          <section className="bp-panel tr-card">
            <div className="tr-card-head">
              <h3><Flag size={18} className="tr-orange" /> Saved {activeConfig.label}s</h3>
              <span className="bp-chip blue">{tasks.length}</span>
            </div>
            {loading ? <p className="tr-empty">Loading…</p> : tasks.length === 0 ? (
              <p className="tr-empty">No {activeConfig.label.toLowerCase()}s saved yet.</p>
            ) : tasks.map((t, i) => {
              const open = expandedId === t.task_id;
              return (
                <div key={t.task_id} className="as-milestone">
                  <button type="button" onClick={() => setExpandedId(open ? null : t.task_id)}>
                    <span className="as-m-no">M{i + 1}</span>
                    <span className="as-m-text"><b>{t.title}</b><small><CalendarDays size={12} /> Due {t.due_date}</small></span>
                    <span className={`bp-chip ${t.due_date < today ? "gray" : "green"}`}>{t.due_date < today ? "Closed" : "Open"}</span>
                  </button>
                  {open && <div className="as-m-body">{t.description}</div>}
                </div>
              );
            })}
          </section>

          <section className="bp-panel tr-card">
            <div className="tr-card-head"><h3><Medal size={18} /> Top Performing Trainees</h3></div>
            {leaders.length === 0 ? <p className="tr-empty">No graded submissions yet.</p> : leaders.map((l, i) => (
              <div key={l.name} className="as-leader">
                <span className={`bp-avatar t${i % 4}`}>{l.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                <span className="as-leader-name"><b>{l.name}</b><small>{l.n} graded</small></span>
                <b className="as-leader-score">{l.avg}%</b>
              </div>
            ))}
          </section>
        </div>
      </div>

      {creatorOpen && canEdit && (
        <div className="bp-modal-backdrop" onClick={() => setCreatorOpen(false)}>
          <div className="bp-modal as-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create {activeConfig.label}</h2>
            <p>Generate it with AI or type it yourself — it's assigned to every student in the batch.</p>

            <div className="as-section">
              <h4><Sparkles size={15} /> Generate with AI</h4>
              <div className="bp-form-grid">
                <label className="bp-field"><span>Topic</span>
                  <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. REST APIs" />
                </label>
                <label className="bp-field"><span>Level</span>
                  <select value={level} onChange={(e) => setLevel(e.target.value)}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </label>
              </div>
              <div className="bp-modal-actions">
                <button type="button" className="bp-btn soft" onClick={handleGenerate} disabled={generating}>{generating ? "Generating…" : "Generate"}</button>
              </div>
              {generatedContent && (
                <>
                  <div className="as-generated">{generatedContent}</div>
                  <div className="as-inline">
                    <label className="bp-field"><span>Due Date</span>
                      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </label>
                    <button type="button" className="bp-btn navy" onClick={handleSaveGenerated} disabled={saving}>{saving ? "Saving…" : `Save as ${activeConfig.label}`}</button>
                  </div>
                </>
              )}
            </div>

            <div className="as-section">
              <button type="button" className="as-toggle" onClick={() => setShowManual(!showManual)}>
                {showManual ? "Hide manual entry" : `Or type a ${activeConfig.label} manually`}
              </button>
              {showManual && (
                <div className="bp-form-grid">
                  <label className="bp-field full"><span>Title</span>
                    <input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} />
                  </label>
                  <label className="bp-field full"><span>Description</span>
                    <textarea rows={4} value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} />
                  </label>
                  <label className="bp-field"><span>Due Date</span>
                    <input type="date" value={manualDueDate} onChange={(e) => setManualDueDate(e.target.value)} />
                  </label>
                  <div className="as-inline-end">
                    <button type="button" className="bp-btn navy" onClick={handleManualSave} disabled={saving}>{saving ? "Saving…" : `Save as ${activeConfig.label}`}</button>
                  </div>
                </div>
              )}
            </div>
            {error && <p className="bp-form-error">{error}</p>}
            {success && <p className="as-ok">{success}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setCreatorOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Assignments;
