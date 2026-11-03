import { useEffect, useState } from "react";
import { ClipboardList, Clock3, Check, CalendarDays, Tag, ChevronRight, Paperclip, FileText, Layers } from "lucide-react";
import client from "../../../api/client";
import StudentHero from "../components/StudentHero";
import "../styles/StudentDashboard.css";
import "../styles/StudentPages.css";
import "../styles/Assignments.css";

const STATUS_TABS = [
  { key: "all", label: "All Assignments", Icon: ClipboardList },
  { key: "pending", label: "Pending", Icon: Clock3 },
  { key: "submitted", label: "Submitted", Icon: Check },
];

const CATEGORIES = [
  { key: "", label: "All Categories" },
  { key: "task", label: "Daily Task" },
  { key: "mini_project", label: "Mini Project" },
  { key: "main_project", label: "Main Project" },
  { key: "seminar", label: "Seminar" },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.filter((c) => c.key).map((c) => [c.key, c.label]));

const fmtDate = (d) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—";

function SubmitForm({ task, onSubmitted }) {
  const [note, setNote] = useState("");
  const [links, setLinks] = useState("");
  const [cc, setCc] = useState("");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (files.length === 0 && !links.trim() && !note.trim()) {
      setError("Provide at least a file, a link, or a note.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("student_task_id", task.student_task_id);
      formData.append("student_note", note);
      formData.append("links", links);
      formData.append("cc_email", cc);
      files.forEach((f) => formData.append("attachments", f));

      await client.post("/api/student/assignments/submit/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputId = `task-file-input-${task.student_task_id}`;

  return (
    <div className="sp-detail asg-form">
      {error && <p className="asg-error">{error}</p>}

      <label className="asg-field">
        <span>Note</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </label>

      <label className="asg-field">
        <span>Links (Drive / GitHub — one per line)</span>
        <textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={2} />
      </label>

      <label className="asg-field">
        <span>CC email (optional)</span>
        <input value={cc} onChange={(e) => setCc(e.target.value)} />
      </label>

      <div className="asg-field">
        <span>Attach files (screenshots/documents, up to 3, 5MB each)</span>
        <label htmlFor={inputId} className="asg-drop">
          <Paperclip size={22} />
          <b>Click to browse files</b>
          <small>or drag and drop here</small>
          <input
            id={inputId}
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files).slice(0, 3))}
            hidden
          />
        </label>

        {files.length > 0 && (
          <div className="asg-files">
            {files.map((f, i) => (
              <div key={i} className="asg-file">
                <span>{f.name}</span>
                <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={submit} disabled={submitting} className="sp-btn sp-btn-orange asg-submit">
        {submitting ? "Submitting…" : "Submit to Trainer"}
      </button>
    </div>
  );
}

function SubmissionDetail({ a }) {
  return (
    <div className="sp-detail">
      <p className="asg-submitted-on">
        Submitted {fmtDate(a.submission_date)}
        {a.on_time === false && <span className="sp-pill sp-pill-orange">Late</span>}
        {a.on_time && <span className="sp-pill sp-pill-green">On time</span>}
      </p>
      {a.score != null && <p className="asg-score"><b>{a.score}</b> / 100</p>}
      {a.feedback && <p><strong>Feedback:</strong> {a.feedback}</p>}
      {a.student_note && <p><strong>Your note:</strong> {a.student_note}</p>}
      {a.links && (
        <div className="asg-links">
          {a.links.split("\n").filter(Boolean).map((l, i) => (
            <a key={i} href={l.trim()} target="_blank" rel="noreferrer">{l.trim()}</a>
          ))}
        </div>
      )}
      {a.attachments.length > 0 && (
        <div className="asg-links">
          {a.attachments.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer"><Paperclip size={12} /> Attachment {i + 1}</a>
          ))}
        </div>
      )}
    </div>
  );
}

function Assignments() {
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("all");
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = () => {
    setLoading(true);
    client.get("/api/student/assignments/", { params: category ? { category } : {} })
      .then(({ data }) => setAssignments(data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [category]);

  const shown = assignments.filter((a) =>
    status === "pending" ? !a.submitted : status === "submitted" ? a.submitted : true,
  );

  return (
    <div className="sd-page asg-page">
      <StudentHero
        eyebrow="Assignments"
        title="Complete Your Assignments"
        subtitle="Submit your work on time and stay on track with your learning goals."
      />

      <div className="asg-toolbar">
        <div className="sp-tabs">
          {STATUS_TABS.map(({ key, label, Icon }) => (
            <button key={key} type="button" className={`sp-tab ${status === key ? "active" : ""}`} onClick={() => setStatus(key)}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <label className="sd-range asg-category">
          <Tag size={14} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="sd-loading">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="sp-empty">Nothing here yet.</p>
      ) : (
        <div className="sp-list">
          {shown.map((a, i) => {
            const open = openId === a.student_task_id;
            return (
              <div key={a.student_task_id} className="sp-row" style={{ "--i": i }}>
                <div className="sp-row-main">
                  <span className={`sp-row-icon sp-soft-${i % 4}`}><FileText size={20} /></span>
                  <div className="sp-row-body">
                    <p className="sp-row-title">{a.title}</p>
                    {a.module_name && (
                      <p className="sp-row-sub">Module {a.module_no} - {a.module_name}</p>
                    )}
                    <div className="sp-meta">
                      <span><CalendarDays size={13} /> Due: {fmtDate(a.due_date)}</span>
                      {a.category && <span><Layers size={13} /> {CATEGORY_LABEL[a.category] || a.category}</span>}
                    </div>
                  </div>
                  <div className="sp-row-side">
                    {a.submitted
                      ? <span className="sp-pill sp-pill-green">Submitted</span>
                      : <span className="sp-pill sp-pill-red">Pending</span>}
                    <button
                      type="button"
                      className="sp-btn sp-btn-blue"
                      onClick={() => setOpenId(open ? null : a.student_task_id)}
                    >
                      {open ? "Close" : a.submitted ? "View Result" : "Start / View"}
                      <ChevronRight size={14} className={open ? "asg-chev open" : "asg-chev"} />
                    </button>
                  </div>
                </div>

                {open && (
                  <>
                    {a.description && <p className="asg-desc">{a.description}</p>}
                    {a.submitted
                      ? <SubmissionDetail a={a} />
                      : <SubmitForm task={a} onSubmitted={() => { setOpenId(null); load(); }} />}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Assignments;
