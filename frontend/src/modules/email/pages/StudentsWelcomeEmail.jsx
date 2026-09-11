import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, X, Check } from "lucide-react";
import client from "../../../api/client";
import RichTextEditor from "../components/RichTextEditor";
import "../styles/Email.css";

const DEFAULT_BODY = `<p>Dear <strong>{{student_name}}</strong>,</p>
<p>Welcome to VetriOS! We're excited to have you join this batch and look forward to supporting you through your training.</p>
<p>Join your class here: <strong>{{meeting_link}}</strong></p>
<p>Best,<br>VetriOS Team</p>`;

// Dedicated bulk-send page for the "Students Welcome Email" card on the
// Bulk page — pick a batch, pick who to send to (checkbox + select all,
// selections shown as pills), write CC/BCC/subject/content, then
// preview/cancel/send. {{student_name}} in the content resolves per
// student when sending.
function StudentsWelcomeEmail() {
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [emailTypeId, setEmailTypeId] = useState(null);

  const [selectedBatch, setSelectedBatch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  const [ccEmails, setCcEmails] = useState("");
  const [bccEmails, setBccEmails] = useState("");
  const [subject, setSubject] = useState("Welcome to VetriOS!");
  const [meetingLink, setMeetingLink] = useState("");
  const [body, setBody] = useState(DEFAULT_BODY);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    client.get("/api/email/students/").then(({ data }) => setStudents(data)).catch(() => {});
    client.get("/api/email/types/").then(({ data }) => {
      const welcome = data.find((t) => t.email_type_code === "WELCOME");
      if (welcome) setEmailTypeId(welcome.email_type_id);
    }).catch(() => {});
  }, []);

  const batches = [];
  const seenBatches = new Set();
  for (const s of students) {
    if (s.batch_name && !seenBatches.has(s.batch_id)) {
      seenBatches.add(s.batch_id);
      batches.push({ batch_id: s.batch_id, batch_name: s.batch_name, course_name: s.course_name });
    }
  }

  const studentsInBatch = selectedBatch ? students.filter((s) => String(s.batch_id) === String(selectedBatch)) : [];
  const visibleStudents = studentsInBatch.filter((s) =>
    s.full_name.toLowerCase().includes(studentSearch.toLowerCase())
  );
  const selectedStudents = selectedIds
    .map((id) => students.find((s) => String(s.student_id) === String(id)))
    .filter(Boolean);
  const allSelected = studentsInBatch.length > 0 && studentsInBatch.every((s) => selectedIds.includes(s.student_id));

  const handleBatchChange = (event) => {
    setSelectedBatch(event.target.value);
    setSelectedIds([]);
    setStudentSearch("");
  };

  const toggleStudent = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      const inBatchIds = new Set(studentsInBatch.map((s) => s.student_id));
      setSelectedIds((prev) => prev.filter((id) => !inBatchIds.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...studentsInBatch.map((s) => s.student_id)])));
    }
  };

  const removeSelected = (id) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const showRest = selectedIds.length > 0;

  const handlePreview = () => {
    const first = selectedStudents[0];
    if (!first) return;
    const resolved = body
      .replace(/\{\{\s*student_name\s*\}\}/g, first.full_name)
      .replace(/\{\{\s*meeting_link\s*\}\}/g, meetingLink || "—");
    const previewTab = window.open("", "_blank");
    if (!previewTab) return;
    previewTab.document.write(`<!doctype html><html><head><title>${first.full_name} — Preview</title>
      <style>
        body { font-family: 'Manrope', Arial, sans-serif; color: #262b36; max-width: 640px; margin: 40px auto; padding: 0 24px; line-height: 1.8; font-size: 14px; }
        strong { color: #235777; }
      </style></head><body><p><strong>Subject:</strong> ${subject}</p><hr>${resolved}</body></html>`);
    previewTab.document.close();
  };

  const handleCancel = () => {
    navigate("/email/batches");
  };

  const handleSend = async () => {
    if (selectedStudents.length === 0 || !subject.trim() || !body.trim()) {
      setError("Pick at least one student, plus subject and content, are required.");
      return;
    }
    setError("");
    setResult(null);
    setSending(true);
    try {
      const batchLabel = batches.find((b) => String(b.batch_id) === String(selectedBatch));
      const { data } = await client.post("/api/email/batches/bulk-send/", {
        batch_name: `Students Welcome Email — ${batchLabel?.batch_name || "Batch"}`,
        email_type_id: emailTypeId,
        subject,
        body,
        meeting_link: meetingLink,
        cc_emails: ccEmails,
        bcc_emails: bccEmails,
        recipients: selectedStudents.map((s) => ({
          student_id: s.student_id,
          full_name: s.full_name,
          email: s.email,
        })),
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't send the batch.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mail-screen">
      <div className="mail-head">
        <div>
          <span className="mail-eyebrow">Email</span>
          <h1>Students Welcome Email</h1>
          <p>Choose a batch, pick who it's for, and send.</p>
        </div>
        <button type="button" className="mail-btn-sm" onClick={() => navigate("/email/batches")}>
          <ArrowLeft size={14} />
          Back
        </button>
      </div>

      {error && <div className="mail-error">{error}</div>}

      {result && (
        <div className="mail-panel">
          <div className="mail-panel-body">
            <p style={{ fontWeight: 700, marginBottom: 4 }}>
              Batch {result.status.toLowerCase()} — {result.successful} sent, {result.failed} failed.
            </p>
            <p style={{ fontSize: 12.5, color: "#8a93a6" }}>
              Sent via the console email backend in this environment.
            </p>
          </div>
        </div>
      )}

      <div className="mail-step-panel">
        <h3 className="mail-step-title">1. Choose a batch</h3>
        <div className="mail-form">
          <select value={selectedBatch} onChange={handleBatchChange}>
            <option value="">Select a batch…</option>
            {batches.map((b) => (
              <option key={b.batch_id} value={b.batch_id}>
                {b.batch_name} — {b.course_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedBatch && (
        <div className="mail-step-panel">
          <h3 className="mail-step-title">2. Students</h3>

          {studentsInBatch.length > 0 && (
            <label className="mail-select-all-row">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
              Select all ({studentsInBatch.length})
            </label>
          )}

          {selectedStudents.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {selectedStudents.map((s) => (
                <span className="mail-recipient-chip" key={s.student_id}>
                  <Check size={12} />
                  {s.full_name}
                  <X size={12} onClick={() => removeSelected(s.student_id)} style={{ cursor: "pointer" }} />
                </span>
              ))}
            </div>
          )}

          <div className="mail-step-search">
            <Search size={14} />
            <input
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search student by name…"
            />
          </div>
          <div className="mail-step-checklist">
            {visibleStudents.length === 0 ? (
              <p className="mail-empty">No students match in this batch.</p>
            ) : (
              visibleStudents.map((s) => (
                <label key={s.student_id} className="mail-step-check-row">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(s.student_id)}
                    onChange={() => toggleStudent(s.student_id)}
                  />
                  {s.full_name}
                  {s.already_sent && <span className="mail-badge sent">Already sent</span>}
                  <span className="mail-step-check-meta" style={{ marginLeft: "auto" }}>{s.email}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      {showRest && (
        <div className="mail-step-panel">
          <h3 className="mail-step-title">3. CC &amp; BCC</h3>
          <div className="mail-form">
            <label>CC (optional)</label>
            <input value={ccEmails} onChange={(e) => setCcEmails(e.target.value)} placeholder="cc1@example.com, cc2@example.com" />

            <label>BCC (optional)</label>
            <input value={bccEmails} onChange={(e) => setBccEmails(e.target.value)} placeholder="bcc1@example.com" />
          </div>
        </div>
      )}

      {showRest && (
        <div className="mail-step-panel">
          <h3 className="mail-step-title">4. Subject</h3>
          <div className="mail-form">
            <label>Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Welcome to VetriOS!" />

            <label>Microsoft Teams link (to attend class)</label>
            <input
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://teams.microsoft.com/l/meetup-join/…"
            />
          </div>
        </div>
      )}

      {showRest && (
        <div className="mail-step-panel">
          <h3 className="mail-step-title">5. Content</h3>
          <p style={{ fontSize: 12, color: "#8a93a6", marginTop: -8, marginBottom: 12 }}>
            {"{{student_name}}"} resolves to each selected student's real name, {"{{meeting_link}}"} to the Teams link above, when sent.
          </p>
          <RichTextEditor content={body} onChange={setBody} />
        </div>
      )}

      {showRest && (
        <div className="mail-step-actions">
          <button type="button" className="mail-btn-sm" onClick={handlePreview}>
            Preview
          </button>
          <button type="button" className="mail-btn-sm" onClick={handleCancel} disabled={sending}>
            Cancel
          </button>
          <button type="button" className="mail-btn-accent" onClick={handleSend} disabled={sending}>
            {sending ? "Sending…" : `Send (${selectedStudents.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

export default StudentsWelcomeEmail;
