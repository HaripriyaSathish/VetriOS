import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  CalendarPlus, Layers, BookOpen, Hash, Users, CalendarDays, UserRound, Activity, Rocket, RotateCcw, Plus,
  Lightbulb, BarChart3, Clock3, CircleCheck, Mail, Send, Search,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/BatchForm.css";

const EMPTY_FORM = {
  course: "", trainer: "", batch_code: "", batch_name: "",
  start_date: "", end_date: "", capacity: "", status: "PLANNED",
};

const fmtDate = (d) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function startsIn(d) {
  const days = Math.round((new Date(`${d}T00:00:00`) - new Date(new Date().toDateString())) / 86400000);
  if (days <= 0) return "Starting today";
  return `Starting in ${days} day${days === 1 ? "" : "s"}`;
}

const DEFAULT_WELCOME_SUBJECT = "Welcome to VetriOS Training!";
const DEFAULT_WELCOME_BODY =
  "<p>Hi {{full_name}},</p><p>Welcome aboard! You've been placed in a new batch — we're excited to start your training journey with us.</p><p>Best,<br/>Vetri Technology Solutions</p>";

const DEFAULT_TRAINER_SUBJECT = "New Batch Assigned to You";
const ADD_NEW_COURSE_VALUE = "__ADD_NEW__";

function BatchForm() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState(new Set());

  const [form, setForm] = useState(EMPTY_FORM);
  const [upcoming, setUpcoming] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdBatch, setCreatedBatch] = useState(null); // { batch_id, roster, trainer }

  const [welcomeSubject, setWelcomeSubject] = useState(DEFAULT_WELCOME_SUBJECT);
  const [welcomeBody, setWelcomeBody] = useState(DEFAULT_WELCOME_BODY);
  const [welcomeCc, setWelcomeCc] = useState("");
  const [sendingWelcome, setSendingWelcome] = useState(false);
  const [welcomeResult, setWelcomeResult] = useState(null);

  const [trainerSubject, setTrainerSubject] = useState(DEFAULT_TRAINER_SUBJECT);
  const [trainerBody, setTrainerBody] = useState("");
  const [trainerCc, setTrainerCc] = useState("");
  const [sendingTrainerMail, setSendingTrainerMail] = useState(false);
  const [trainerMailResult, setTrainerMailResult] = useState(null);

  // New-course inline form state
  const [showNewCourseForm, setShowNewCourseForm] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [newCourseDuration, setNewCourseDuration] = useState("");
  const [savingCourse, setSavingCourse] = useState(false);
  const [courseError, setCourseError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [coursesRes, trainersRes, studentsRes] = await Promise.all([
        client.get("/api/training/courses/"),
        client.get("/api/training/trainers/"),
        client.get("/api/admissions/ungrouped-students/"),
      ]);
      setCourses(coursesRes.data);
      setTrainers(trainersRes.data);
      setStudents(studentsRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't load form data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Upcoming batches panel — same read-only data as the Business dashboard.
    client.get("/api/training/business/dashboard/", { params: { period: "all" } })
      .then(({ data }) => setUpcoming(data))
      .catch(() => setUpcoming({ upcoming_batches: [], capacity_total: 0, capacity_filled: 0 }));
  }, []);

  const discard = () => {
    setForm(EMPTY_FORM);
    setSelectedStudents(new Set());
    setError("");
  };

  // Auto-build the trainer notification body from the actual roster the
  // moment the batch is created — still fully editable before sending.
  useEffect(() => {
    if (createdBatch) {
      const rosterRows = createdBatch.roster
        .map(
          (s) =>
            `<tr><td>${s.name}</td><td>${s.personal_email || "—"}</td><td>${s.official_email || "—"}</td></tr>`
        )
        .join("");

      const body =
        `<p>Hi,</p>` +
        `<p>A new batch has been created and assigned to you. Here are the students enrolled:</p>` +
        `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">` +
        `<tr><th>Name</th><th>Personal Email</th><th>Official Email</th></tr>` +
        rosterRows +
        `</table>` +
        `<p>Please check the Training dashboard for full details.</p>` +
        `<p>Best,<br/>Vetri Technology Solutions</p>`;

      setTrainerBody(body);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdBatch]);

  const updateField = (field, value) => setForm({ ...form, [field]: value });

  const toggleStudent = (id) => {
    const next = new Set(selectedStudents);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedStudents(next);
  };

  const handleCourseSelect = (value) => {
    if (value === ADD_NEW_COURSE_VALUE) {
      setShowNewCourseForm(true);
      setCourseError("");
      return;
    }
    updateField("course", value);
  };

  const cancelNewCourse = () => {
    setShowNewCourseForm(false);
    setNewCourseName("");
    setNewCourseDescription("");
    setNewCourseDuration("");
    setCourseError("");
  };

  const saveNewCourse = async () => {
    if (!newCourseName.trim()) {
      setCourseError("Course name is required.");
      return;
    }
    setSavingCourse(true);
    setCourseError("");
    try {
      const { data } = await client.post("/api/training/courses/create/", {
        course_name: newCourseName.trim(),
        description: newCourseDescription.trim(),
        duration_days: newCourseDuration ? parseInt(newCourseDuration, 10) : null,
      });

      // Refresh the course list, then select the newly created one.
      const { data: freshCourses } = await client.get("/api/training/courses/");
      setCourses(freshCourses);
      updateField("course", String(data.course_id));

      cancelNewCourse();
    } catch (err) {
      setCourseError(err.response?.data?.detail || "Couldn't create course.");
    } finally {
      setSavingCourse(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (selectedStudents.size === 0) {
      setError("Select at least one student for this batch.");
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      ...form,
      trainer: form.trainer || null,
      end_date: form.end_date || null,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      enquiry_ids: Array.from(selectedStudents),
    };

    try {
      const { data } = await client.post("/api/admissions/group-into-batch/", payload);
      setCreatedBatch(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't create batch.");
    } finally {
      setSaving(false);
    }
  };

  const sendWelcomeEmails = async () => {
    setSendingWelcome(true);
    setWelcomeResult(null);
    try {
      const { data } = await client.post("/api/admissions/send-welcome-email/", {
        enquiry_ids: createdBatch.roster.map((r) => r.enquiry_id),
        subject: welcomeSubject,
        body: welcomeBody,
        cc: welcomeCc,
      });
      setWelcomeResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't send welcome emails.");
    } finally {
      setSendingWelcome(false);
    }
  };

  const sendTrainerNotification = async () => {
    setSendingTrainerMail(true);
    setTrainerMailResult(null);
    try {
      await client.post("/api/admissions/notify-trainer/", {
        to: createdBatch.trainer.email,
        subject: trainerSubject,
        body: trainerBody,
        cc: trainerCc,
      });
      setTrainerMailResult("sent");
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't notify trainer.");
    } finally {
      setSendingTrainerMail(false);
    }
  };

  if (loading) return <p className="bp-loading">Loading…</p>;

  // --- Post-creation view: batch is made, now show editable email panels ---
  if (createdBatch) {
    return (
      <div className="bp-page">
        <div className="nb-done">
          <span className="nb-done-icon"><CircleCheck size={26} /></span>
          <div>
            <h1 className="bp-title">Batch Created</h1>
            <p className="bp-sub">{createdBatch.roster.length} student(s) enrolled in this batch. Send their welcome emails and notify the trainer below.</p>
          </div>
        </div>

        {error && <p className="bp-error">{error}</p>}

        <div className="nb-card" style={{ "--i": 0 }}>
          <h3><span className="nb-icon"><Mail size={16} /></span> Welcome Email to Students</h3>
          {welcomeResult && (
            <p className="bp-notice">
              Sent to {welcomeResult.sent_count} student(s).
              {welcomeResult.skipped.length > 0 && ` ${welcomeResult.skipped.length} skipped: ${welcomeResult.skipped.map((s) => s.reason).join("; ")}`}
            </p>
          )}
          <div className="nb-stack">
            <label className="bp-field"><span>Subject</span>
              <input value={welcomeSubject} onChange={(e) => setWelcomeSubject(e.target.value)} />
            </label>
            <label className="bp-field"><span>Body (HTML) — use {"{{full_name}}"} for personalization</span>
              <textarea value={welcomeBody} onChange={(e) => setWelcomeBody(e.target.value)} rows={5} />
            </label>
            <label className="bp-field"><span>CC (comma-separated, optional)</span>
              <input value={welcomeCc} onChange={(e) => setWelcomeCc(e.target.value)} />
            </label>
          </div>
          <button type="button" className="bp-btn orange" onClick={sendWelcomeEmails} disabled={sendingWelcome}>
            <Send size={14} /> {sendingWelcome ? "Sending…" : `Send to ${createdBatch.roster.length} student(s)`}
          </button>
        </div>

        {createdBatch.trainer && (
          <div className="nb-card" style={{ "--i": 1 }}>
            <h3><span className="nb-icon"><UserRound size={16} /></span> Notify Trainer</h3>
            <p className="bp-sub">To: {createdBatch.trainer.name} — {createdBatch.trainer.email || "no email on file"}</p>
            {trainerMailResult === "sent" && <p className="bp-notice">Trainer notified.</p>}
            <div className="nb-stack">
              <label className="bp-field"><span>Subject</span>
                <input value={trainerSubject} onChange={(e) => setTrainerSubject(e.target.value)} />
              </label>
              <label className="bp-field"><span>Body (HTML) — pre-filled with the student roster, editable</span>
                <textarea value={trainerBody} onChange={(e) => setTrainerBody(e.target.value)} rows={8} />
              </label>
              <label className="bp-field"><span>CC (comma-separated, optional)</span>
                <input value={trainerCc} onChange={(e) => setTrainerCc(e.target.value)} />
              </label>
            </div>
            <button type="button" className="bp-btn navy" onClick={sendTrainerNotification} disabled={sendingTrainerMail || !createdBatch.trainer.email}>
              <Send size={14} /> {sendingTrainerMail ? "Sending…" : "Notify Trainer"}
            </button>
          </div>
        )}

        <button type="button" className="bp-btn outline nb-back" onClick={() => navigate("/training")}>
          Done — Back to Dashboard
        </button>
      </div>
    );
  }

  const q = studentSearch.trim().toLowerCase();
  const visibleStudents = q
    ? students.filter((s) => [s.name, s.course_name, s.personal_email, s.official_email].some((v) => (v || "").toLowerCase().includes(q)))
    : students;
  const upcomingList = upcoming?.upcoming_batches || [];
  const avgFill = upcoming?.capacity_total ? Math.round((upcoming.capacity_filled / upcoming.capacity_total) * 100) : null;

  // --- Pre-creation view: the actual batch + student-selection form ---
  return (
    <div className="bp-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb"><span className="nb-pill">Cohort Administration</span> • Academic Cycle {new Date().getFullYear()}</p>
          <h1 className="bp-title">Create New Training Batch</h1>
          <p className="bp-sub">Schedule, calibrate seat allocation, and launch upcoming cohort programs for trainees.</p>
        </div>
        <div className="bp-actions">
          <Link to="/training/management" className="bp-btn outline"><Layers size={15} /> View Active Batches</Link>
        </div>
      </div>

      {error && <p className="bp-error">{error}</p>}

      <div className="nb-layout">
        <form onSubmit={handleSubmit} className="nb-main">
          <div className="nb-card" style={{ "--i": 0 }}>
            <div className="nb-card-head">
              <span className="nb-icon"><CalendarPlus size={17} /></span>
              <div>
                <h3>Batch Details Form</h3>
                <p>Complete cohort prerequisites, then pick the converted students to enroll.</p>
              </div>
              <span className="bp-chip blue nb-step">Step 1 of 1</span>
            </div>

            <div className="bp-form-grid">
              <label className="bp-field full">
                <span>Program Track *</span>
                <div className="nb-input"><BookOpen size={15} />
                  <select required={!showNewCourseForm} value={form.course} onChange={(e) => handleCourseSelect(e.target.value)}>
                    <option value="">Select a course</option>
                    <option value={ADD_NEW_COURSE_VALUE}>+ Add New Course</option>
                    {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
                  </select>
                </div>
              </label>

              {showNewCourseForm && (
                <div className="nb-newcourse full">
                  <p className="bp-person-name"><Plus size={13} /> New Course</p>
                  {courseError && <p className="bp-form-error">{courseError}</p>}
                  <div className="bp-form-grid">
                    <label className="bp-field full"><span>Course name</span>
                      <input value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} />
                    </label>
                    <label className="bp-field full"><span>Description (optional)</span>
                      <textarea rows={2} value={newCourseDescription} onChange={(e) => setNewCourseDescription(e.target.value)} />
                    </label>
                    <label className="bp-field"><span>Duration in days (optional)</span>
                      <input type="number" value={newCourseDuration} onChange={(e) => setNewCourseDuration(e.target.value)} />
                    </label>
                  </div>
                  <div className="bp-modal-actions">
                    <button type="button" className="bp-btn outline small" onClick={cancelNewCourse}>Cancel</button>
                    <button type="button" className="bp-btn navy small" onClick={saveNewCourse} disabled={savingCourse}>
                      {savingCourse ? "Saving…" : "Save Course"}
                    </button>
                  </div>
                </div>
              )}

              <label className="bp-field">
                <span>Batch Name *</span>
                <div className="nb-input"><Layers size={15} />
                  <input required value={form.batch_name} onChange={(e) => updateField("batch_name", e.target.value)} placeholder="e.g. Full Stack — Batch 04" />
                </div>
              </label>
              <label className="bp-field">
                <span>Batch Code *</span>
                <div className="nb-input"><Hash size={15} />
                  <input required value={form.batch_code} onChange={(e) => updateField("batch_code", e.target.value)} placeholder="e.g. FSD-2026-B04" />
                </div>
              </label>
              <label className="bp-field">
                <span>Commencement Date *</span>
                <div className="nb-input"><CalendarDays size={15} />
                  <input type="date" required value={form.start_date} onChange={(e) => updateField("start_date", e.target.value)} />
                </div>
              </label>
              <label className="bp-field">
                <span>Target Graduation Date</span>
                <div className="nb-input"><CalendarDays size={15} />
                  <input type="date" value={form.end_date} onChange={(e) => updateField("end_date", e.target.value)} />
                </div>
              </label>
              <label className="bp-field">
                <span>Target Capacity</span>
                <div className="nb-input"><Users size={15} />
                  <input type="number" min="1" value={form.capacity} onChange={(e) => updateField("capacity", e.target.value)} placeholder="Seats" />
                </div>
              </label>
              <label className="bp-field">
                <span>Status</span>
                <div className="nb-input"><Activity size={15} />
                  <select value={form.status} onChange={(e) => updateField("status", e.target.value)}>
                    <option value="PLANNED">Planned</option>
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </label>
              <label className="bp-field full">
                <span>Lead Trainer Assignment</span>
                <div className="nb-input"><UserRound size={15} />
                  <select value={form.trainer} onChange={(e) => updateField("trainer", e.target.value)}>
                    <option value="">Unassigned</option>
                    {trainers.map((t) => <option key={t.trainer_id} value={t.trainer_id}>{t.trainer_name}</option>)}
                  </select>
                </div>
              </label>
            </div>
          </div>

          <div className="nb-card" style={{ "--i": 1 }}>
            <div className="nb-card-head">
              <span className="nb-icon orange"><Users size={17} /></span>
              <div>
                <h3>Trainees</h3>
                <p>Converted students not yet in a batch.</p>
              </div>
              <span className="bp-chip orange nb-step">{selectedStudents.size} selected</span>
            </div>
            <label className="bp-search nb-search">
              <Search size={15} />
              <input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search students..." aria-label="Search students" />
            </label>
            {students.length === 0 ? (
              <p className="nb-empty">No converted students waiting to be grouped.</p>
            ) : (
              <div className="nb-students">
                {visibleStudents.map((s) => {
                  const on = selectedStudents.has(s.enquiry_id);
                  return (
                    <label key={s.enquiry_id} className={`nb-student ${on ? "on" : ""}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleStudent(s.enquiry_id)} />
                      <span className="nb-check"><CircleCheck size={15} /></span>
                      <span className="nb-student-text">
                        <b>{s.name}</b>
                        <small>{s.course_name} · {s.official_email || s.personal_email || "no email"}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="nb-submit">
            <button type="button" className="bp-btn outline" onClick={discard}><RotateCcw size={14} /> Discard Changes</button>
            <button type="submit" className="bp-btn navy" disabled={saving || showNewCourseForm}>
              <Rocket size={15} /> {saving ? "Creating…" : "Create & Publish Batch"}
            </button>
          </div>

          <div className="nb-info">
            <Lightbulb size={17} />
            <div>
              <b>After you publish</b>
              <p>The selected students are enrolled into the new batch, and you can send their welcome emails and notify the trainer straight away.</p>
            </div>
          </div>
        </form>

        <aside className="nb-side">
          <div className="nb-side-head">
            <h3>Upcoming Scheduled Batches</h3>
            <span className="bp-chip blue">{upcomingList.length}</span>
          </div>
          {!upcoming ? <p className="nb-empty">Loading…</p> : upcomingList.length === 0 ? (
            <p className="nb-empty">No batches starting soon.</p>
          ) : upcomingList.map((b, i) => {
            const fill = b.capacity ? Math.round((b.enrolled / b.capacity) * 100) : null;
            return (
              <Link key={b.batch_id} to={`/training/batches/${b.batch_id}`} className="nb-batch" style={{ "--i": i }}>
                <div className="nb-batch-top">
                  <span className="nb-code">{b.batch_code}</span>
                  <span className={`bp-chip ${i === 0 ? "orange" : "blue"}`}><Clock3 size={10} /> {startsIn(b.start_date)}</span>
                </div>
                <p className="nb-batch-name">{b.batch_name}</p>
                <p className="bp-person-sub"><CalendarDays size={11} /> {fmtDate(b.start_date)} · {b.course_name}</p>
                <div className="nb-fill">
                  <span>Seat Capacity Fill</span>
                  <b>{b.enrolled}{b.capacity ? ` / ${b.capacity}` : ""} Filled{fill != null ? ` (${fill}%)` : ""}</b>
                </div>
                <div className="bp-meter"><span className={i % 2 ? "orange" : ""} style={{ width: `${fill ?? 0}%` }} /></div>
                <p className="nb-trainer"><UserRound size={12} /> {b.trainer_name || "Trainer unassigned"}</p>
              </Link>
            );
          })}
          <div className="nb-avg">
            <span><BarChart3 size={14} /> Avg Enrollment Rate</span>
            <b>{avgFill != null ? `${avgFill}% of upcoming seats` : "—"}</b>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default BatchForm;
