import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, X, Check, Paperclip } from "lucide-react";
import client from "../../../api/client";
import RichTextEditor from "../components/RichTextEditor";
import "../styles/Email.css";

const DEFAULT_BODY = `<p>Dear <strong>{{employee_name}}</strong>,</p>
<p>We're pleased to inform you that your role has been revised from <strong>{{old_designation}}</strong> to <strong>{{new_designation}}</strong>, effective <strong>{{effective_date}}</strong>.</p>
<p>Please find your Role Revision Letter attached to this email. Congratulations!</p>
<p>Best,<br>VetriOS Team</p>`;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Dedicated bulk-send page for the "Role Revision" card on the Bulk
// page — pick from already-APPROVED promotions (HR's Promotions
// screen), write CC/BCC/subject. Each employee gets their OWN role
// revision letter: auto-attached when one's already been generated,
// otherwise a manual per-employee upload fills the gap. Content uses
// {{employee_name}}, {{old_designation}}, {{new_designation}} and
// {{effective_date}}, each resolved per recipient.
function RoleRevision() {
  const navigate = useNavigate();

  const [promotions, setPromotions] = useState([]);
  const [emailTypeId, setEmailTypeId] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  const [ccEmails, setCcEmails] = useState("");
  const [bccEmails, setBccEmails] = useState("");
  const [subject, setSubject] = useState("Your Role Revision at VetriOS");
  const [manualAttachments, setManualAttachments] = useState({}); // promotion_id -> File
  const [body, setBody] = useState(DEFAULT_BODY);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    client.get("/api/email/promotions/").then(({ data }) => setPromotions(data)).catch(() => {});
    client.get("/api/email/types/").then(({ data }) => {
      const revision = data.find((t) => t.email_type_code === "ROLE_REVISION");
      if (revision) setEmailTypeId(revision.email_type_id);
    }).catch(() => {});
  }, []);

  const visiblePromotions = promotions.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase())
  );
  const selectedPromotions = selectedIds
    .map((id) => promotions.find((p) => String(p.promotion_id) === String(id)))
    .filter(Boolean);
  const allSelected = visiblePromotions.length > 0 && visiblePromotions.every((p) => selectedIds.includes(p.promotion_id));

  const togglePromotion = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      const visibleIds = new Set(visiblePromotions.map((p) => p.promotion_id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visiblePromotions.map((p) => p.promotion_id)])));
    }
  };

  const removeSelected = (id) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const setManualAttachment = (promotionId, file) => {
    setManualAttachments((prev) => {
      const next = { ...prev };
      if (file) next[promotionId] = file;
      else delete next[promotionId];
      return next;
    });
  };

  const showRest = selectedIds.length > 0;
  const missingLetterPromotions = selectedPromotions.filter(
    (p) => !p.revision_letter_document_id && !manualAttachments[p.promotion_id]
  );

  const handlePreview = () => {
    const first = selectedPromotions[0];
    if (!first) return;
    const resolved = body
      .replace(/\{\{\s*employee_name\s*\}\}/g, first.full_name)
      .replace(/\{\{\s*old_designation\s*\}\}/g, first.previous_designation_name || "—")
      .replace(/\{\{\s*new_designation\s*\}\}/g, first.new_designation_name)
      .replace(/\{\{\s*effective_date\s*\}\}/g, formatDate(first.effective_date));
    const previewTab = window.open("", "_blank");
    if (!previewTab) return;
    const attachNote = first.revision_letter_document_id
      ? "<p><em>[Role revision letter will be attached automatically]</em></p>"
      : manualAttachments[first.promotion_id]
      ? `<p><em>[Attached manually: ${manualAttachments[first.promotion_id].name}]</em></p>`
      : "<p><em>[No role revision letter on file for this employee — nothing will be attached]</em></p>";
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
    if (selectedPromotions.length === 0 || !subject.trim() || !body.trim()) {
      setError("Pick at least one promotion, plus subject and content, are required.");
      return;
    }
    setError("");
    setResult(null);
    setSending(true);
    try {
      const recipients = await Promise.all(
        selectedPromotions.map(async (p) => {
          const manualFile = manualAttachments[p.promotion_id];
          const attachment = p.revision_letter_document_id
            ? { attachment_document_id: p.revision_letter_document_id }
            : manualFile
            ? {
                attachment_filename: manualFile.name,
                attachment_mime_type: manualFile.type || "application/octet-stream",
                attachment_content_base64: await fileToBase64(manualFile),
              }
            : {};
          return {
            promotion_id: p.promotion_id,
            full_name: p.full_name,
            email: p.email,
            values: {
              old_designation: p.previous_designation_name || "—",
              new_designation: p.new_designation_name,
              effective_date: formatDate(p.effective_date),
            },
            ...attachment,
          };
        })
      );
      const { data } = await client.post("/api/email/batches/bulk-send/", {
        batch_name: `Role Revision — ${new Date().toLocaleDateString("en-GB")}`,
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
          <h1>Role Revision</h1>
          <p>Notify employees of an approved role/designation change.</p>
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
        <h3 className="mail-step-title">1. Choose approved promotions</h3>

        {visiblePromotions.length > 0 && (
          <label className="mail-select-all-row">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            Select all ({visiblePromotions.length})
          </label>
        )}

        {selectedPromotions.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {selectedPromotions.map((p) => (
              <span className="mail-recipient-chip" key={p.promotion_id}>
                <Check size={12} />
                {p.full_name}
                <X size={12} onClick={() => removeSelected(p.promotion_id)} style={{ cursor: "pointer" }} />
              </span>
            ))}
          </div>
        )}

        <div className="mail-step-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee by name…"
          />
        </div>
        <div className="mail-step-checklist">
          {promotions.length === 0 ? (
            <p className="mail-empty">No approved promotions found.</p>
          ) : visiblePromotions.length === 0 ? (
            <p className="mail-empty">No promotions match.</p>
          ) : (
            visiblePromotions.map((p) => (
              <label key={p.promotion_id} className="mail-step-check-row">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.promotion_id)}
                  onChange={() => togglePromotion(p.promotion_id)}
                />
                {p.full_name}
                {p.already_sent && <span className="mail-badge sent">Already sent</span>}
                <span className="mail-step-check-meta" style={{ marginLeft: "auto" }}>
                  {p.previous_designation_name || "—"} → {p.new_designation_name} · {formatDate(p.effective_date)}
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      {showRest && (
        <div className="mail-step-panel">
          <h3 className="mail-step-title">2. CC &amp; BCC</h3>
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
          <h3 className="mail-step-title">3. Subject</h3>
          <div className="mail-form">
            <label>Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Your Role Revision at VetriOS" />
          </div>
        </div>
      )}

      {showRest && (
        <div className="mail-step-panel">
          <h3 className="mail-step-title">4. Attach role revision letter</h3>
          <p style={{ fontSize: 12, color: "#8a93a6", marginTop: -8, marginBottom: 12 }}>
            Each employee's own generated role revision letter is attached automatically. For anyone missing one, upload their letter here before sending.
          </p>
          <div className="mail-step-checklist">
            {selectedPromotions.map((p) => {
              const manualFile = manualAttachments[p.promotion_id];
              return (
                <div key={p.promotion_id} className="mail-step-check-row">
                  <span>{p.full_name}</span>
                  {p.revision_letter_document_id ? (
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
                        onClick={() => setManualAttachment(p.promotion_id, null)}
                        style={{ cursor: "pointer" }}
                      />
                    </span>
                  ) : (
                    <label
                      className="mail-badge draft"
                      style={{ marginLeft: "auto", cursor: "pointer" }}
                    >
                      No letter — attach manually
                      <input
                        type="file"
                        style={{ display: "none" }}
                        onChange={(e) => setManualAttachment(p.promotion_id, e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          {missingLetterPromotions.length > 0 && (
            <p style={{ fontSize: 12, color: "#b45309", marginTop: 8 }}>
              {missingLetterPromotions.length} of {selectedPromotions.length} selected employees still have no letter attached.
            </p>
          )}
        </div>
      )}

      {showRest && (
        <div className="mail-step-panel">
          <h3 className="mail-step-title">5. Content</h3>
          <p style={{ fontSize: 12, color: "#8a93a6", marginTop: -8, marginBottom: 12 }}>
            {"{{employee_name}}"}, {"{{old_designation}}"}, {"{{new_designation}}"} and {"{{effective_date}}"} resolve per employee when sent.
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
            {sending ? "Sending…" : `Send (${selectedPromotions.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

export default RoleRevision;
