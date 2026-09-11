import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, X, Check, Paperclip } from "lucide-react";
import client from "../../../api/client";
import RichTextEditor from "../components/RichTextEditor";
import "../styles/Email.css";

const DEFAULT_BODY = `<p>Dear <strong>{{intern_name}}</strong>,</p>
<p>Welcome aboard! We're excited to have you start your internship with us. Please find your Integrated Internship Offer Letter attached to this email.</p>
<p>Best,<br>VetriOS Team</p>`;

// Dedicated bulk-send page for the "Internship Onboarding" card on the
// Bulk page — pick a batch, pick who it's for (checkbox + select all,
// selections shown as pills, already-onboarded interns flagged but not
// blocked), write CC/BCC/subject. Each intern gets their OWN offer
// letter: their generated Document Generator letter is attached
// automatically when one exists; when it doesn't, a manual per-intern
// upload fills the gap so nothing goes out with the wrong (or no)
// letter unnoticed. {{intern_name}} in the content resolves per intern.

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function InternshipOnboarding() {
  const navigate = useNavigate();

  const [interns, setInterns] = useState([]);
  const [emailTypeId, setEmailTypeId] = useState(null);

  const [selectedBatch, setSelectedBatch] = useState("");
  const [internSearch, setInternSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  const [ccEmails, setCcEmails] = useState("");
  const [bccEmails, setBccEmails] = useState("");
  const [subject, setSubject] = useState("Welcome to VetriOS — Your Internship Offer Letter");
  const [manualAttachments, setManualAttachments] = useState({}); // intern_id -> File
  const [body, setBody] = useState(DEFAULT_BODY);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    client.get("/api/email/interns/").then(({ data }) => setInterns(data)).catch(() => {});
    client.get("/api/email/types/").then(({ data }) => {
      const onboarding = data.find((t) => t.email_type_code === "ONBOARDING");
      if (onboarding) setEmailTypeId(onboarding.email_type_id);
    }).catch(() => {});
  }, []);

  const batches = [];
  const seenBatches = new Set();
  for (const i of interns) {
    if (i.batch_name && !seenBatches.has(i.batch_id)) {
      seenBatches.add(i.batch_id);
      batches.push({ batch_id: i.batch_id, batch_name: i.batch_name, course_name: i.course_name });
    }
  }

  const internsInBatch = selectedBatch ? interns.filter((i) => String(i.batch_id) === String(selectedBatch)) : [];
  const visibleInterns = internsInBatch.filter((i) =>
    i.full_name.toLowerCase().includes(internSearch.toLowerCase())
  );
  const selectedInterns = selectedIds
    .map((id) => interns.find((i) => String(i.intern_id) === String(id)))
    .filter(Boolean);
  const allSelected = internsInBatch.length > 0 && internsInBatch.every((i) => selectedIds.includes(i.intern_id));

  const handleBatchChange = (event) => {
    setSelectedBatch(event.target.value);
    setSelectedIds([]);
    setInternSearch("");
  };

  const toggleIntern = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      const inBatchIds = new Set(internsInBatch.map((i) => i.intern_id));
      setSelectedIds((prev) => prev.filter((id) => !inBatchIds.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...internsInBatch.map((i) => i.intern_id)])));
    }
  };

  const removeSelected = (id) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const setManualAttachment = (internId, file) => {
    setManualAttachments((prev) => {
      const next = { ...prev };
      if (file) next[internId] = file;
      else delete next[internId];
      return next;
    });
  };

  const showRest = selectedIds.length > 0;
  const missingLetterInterns = selectedInterns.filter(
    (i) => !i.offer_letter_document_id && !manualAttachments[i.intern_id]
  );

  const handlePreview = () => {
    const first = selectedInterns[0];
    if (!first) return;
    const resolved = body.replace(/\{\{\s*intern_name\s*\}\}/g, first.full_name);
    const previewTab = window.open("", "_blank");
    if (!previewTab) return;
    const attachNote = first.offer_letter_document_id
      ? "<p><em>[Offer letter will be attached automatically]</em></p>"
      : manualAttachments[first.intern_id]
      ? `<p><em>[Attached manually: ${manualAttachments[first.intern_id].name}]</em></p>`
      : "<p><em>[No offer letter on file for this intern — nothing will be attached]</em></p>";
    previewTab.document.write(`<!doctype html><html><head><title>${first.full_name} — Preview</title>
      <style>
        body { font-family: 'Manrope', Arial, sans-serif; color: #262b36; max-width: 640px; margin: 40px auto; padding: 0 24px; line-height: 1.8; font-size: 14px; }
        strong { color: #235777; }
      </style></head><body><p><strong>Subject:</strong> ${subject}</p><hr>${resolved}${attachNote}</body></html>`);
    previewTab.document.close();
  };

  const handleCancel = () => {
    navigate("/email/batches");
  };

  const handleSend = async () => {
    if (selectedInterns.length === 0 || !subject.trim() || !body.trim()) {
      setError("Pick at least one intern, plus subject and content, are required.");
      return;
    }
    setError("");
    setResult(null);
    setSending(true);
    try {
      const batchLabel = batches.find((b) => String(b.batch_id) === String(selectedBatch));
      const recipients = await Promise.all(
        selectedInterns.map(async (i) => {
          const manualFile = manualAttachments[i.intern_id];
          const attachment = i.offer_letter_document_id
            ? { attachment_document_id: i.offer_letter_document_id }
            : manualFile
            ? {
                attachment_filename: manualFile.name,
                attachment_mime_type: manualFile.type || "application/octet-stream",
                attachment_content_base64: await fileToBase64(manualFile),
              }
            : {};
          return { intern_id: i.intern_id, full_name: i.full_name, email: i.email, ...attachment };
        })
      );
      const { data } = await client.post("/api/email/batches/bulk-send/", {
        batch_name: `Internship Onboarding — ${batchLabel?.batch_name || "Batch"}`,
        email_type_id: emailTypeId,
        subject,
        body,
        cc_emails: ccEmails,
        bcc_emails: bccEmails,
        recipients,
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
          <h1>Internship Onboarding</h1>
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
          <h3 className="mail-step-title">2. Interns</h3>

          {internsInBatch.length > 0 && (
            <label className="mail-select-all-row">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
              Select all ({internsInBatch.length})
            </label>
          )}

          {selectedInterns.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {selectedInterns.map((i) => (
                <span className="mail-recipient-chip" key={i.intern_id}>
                  <Check size={12} />
                  {i.full_name}
                  <X size={12} onClick={() => removeSelected(i.intern_id)} style={{ cursor: "pointer" }} />
                </span>
              ))}
            </div>
          )}

          <div className="mail-step-search">
            <Search size={14} />
            <input
              value={internSearch}
              onChange={(e) => setInternSearch(e.target.value)}
              placeholder="Search intern by name…"
            />
          </div>
          <div className="mail-step-checklist">
            {visibleInterns.length === 0 ? (
              <p className="mail-empty">No interns match in this batch.</p>
            ) : (
              visibleInterns.map((i) => (
                <label key={i.intern_id} className="mail-step-check-row">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(i.intern_id)}
                    onChange={() => toggleIntern(i.intern_id)}
                  />
                  {i.full_name}
                  {i.already_sent && <span className="mail-badge sent">Already sent</span>}
                  {!i.offer_letter_document_id && <span className="mail-badge draft">No offer letter</span>}
                  <span className="mail-step-check-meta" style={{ marginLeft: "auto" }}>{i.email}</span>
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
          </div>
        </div>
      )}

      {showRest && (
        <div className="mail-step-panel">
          <h3 className="mail-step-title">5. Attach internship offer letter</h3>
          <p style={{ fontSize: 12, color: "#8a93a6", marginTop: -8, marginBottom: 12 }}>
            Each intern's own generated offer letter is attached automatically. For anyone missing one, upload their letter here before sending.
          </p>
          <div className="mail-step-checklist">
            {selectedInterns.map((i) => {
              const manualFile = manualAttachments[i.intern_id];
              return (
                <div key={i.intern_id} className="mail-step-check-row">
                  <span>{i.full_name}</span>
                  {i.offer_letter_document_id ? (
                    <span className="mail-badge sent" style={{ marginLeft: "auto" }}>
                      <Paperclip size={11} /> Auto-attached
                    </span>
                  ) : manualFile ? (
                    <span
                      className="mail-badge draft"
                      style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Paperclip size={11} /> {manualFile.name}
                      <X
                        size={11}
                        onClick={() => setManualAttachment(i.intern_id, null)}
                        style={{ cursor: "pointer" }}
                      />
                    </span>
                  ) : (
                    <label
                      className="mail-badge draft"
                      style={{ marginLeft: "auto", cursor: "pointer" }}
                    >
                      No offer letter — attach manually
                      <input
                        type="file"
                        style={{ display: "none" }}
                        onChange={(e) => setManualAttachment(i.intern_id, e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          {missingLetterInterns.length > 0 && (
            <p style={{ fontSize: 12, color: "#b45309", marginTop: 8 }}>
              {missingLetterInterns.length} of {selectedInterns.length} selected interns still have no offer letter attached.
            </p>
          )}
        </div>
      )}

      {showRest && (
        <div className="mail-step-panel">
          <h3 className="mail-step-title">6. Content</h3>
          <p style={{ fontSize: 12, color: "#8a93a6", marginTop: -8, marginBottom: 12 }}>
            {"{{intern_name}}"} resolves to each selected intern's real name when sent.
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
            {sending ? "Sending…" : `Send (${selectedInterns.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

export default InternshipOnboarding;
