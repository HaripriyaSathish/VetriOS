import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, X, Paperclip } from "lucide-react";
import client from "../../../api/client";
import RichTextEditor from "../components/RichTextEditor";
import "../styles/Email.css";
import "../../documents/styles/DocumentLibrary.css";
import "../styles/EmailPremium.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Compose() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [recipients, setRecipients] = useState([]); // [{ email, label }]
  const [recipientQuery, setRecipientQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [ccEmails, setCcEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentMessage, setSentMessage] = useState("");

  useEffect(() => {
    client.get("/api/email/recipients/").then(({ data }) => setUsers(data)).catch(() => {});
  }, []);

  const addRecipient = (email, label) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || recipients.some((r) => r.email.toLowerCase() === normalized)) return;
    setRecipients((prev) => [...prev, { email: email.trim(), label: label || email.trim() }]);
    setRecipientQuery("");
  };

  const removeRecipient = (email) => {
    setRecipients((prev) => prev.filter((r) => r.email !== email));
  };

  const suggestions = recipientQuery.trim()
    ? users
        .filter((u) => !recipients.some((r) => r.email.toLowerCase() === (u.email || "").toLowerCase()))
        .filter(
          (u) =>
            u.email &&
            (u.full_name.toLowerCase().includes(recipientQuery.toLowerCase()) ||
              u.email.toLowerCase().includes(recipientQuery.toLowerCase()))
        )
        .slice(0, 8)
    : [];

  const handleRecipientKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      const value = recipientQuery.replace(/,$/, "").trim();
      if (value) {
        e.preventDefault();
        if (!EMAIL_RE.test(value)) {
          setError(`"${value}" doesn't look like a valid email address.`);
          return;
        }
        setError("");
        addRecipient(value);
      }
    } else if (e.key === "Backspace" && !recipientQuery && recipients.length > 0) {
      removeRecipient(recipients[recipients.length - 1].email);
    }
  };

  const resetForm = () => {
    setRecipients([]);
    setRecipientQuery("");
    setCcEmails("");
    setSubject("");
    setBody("");
    setAttachmentFile(null);
  };

  const handleCancel = () => {
    resetForm();
    navigate("/email");
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (recipients.length === 0 || !subject.trim() || !body.trim()) {
      setError("At least one recipient, plus subject and body, are required.");
      return;
    }
    if (recipients.length > 1 && !window.confirm(`Send this email to ${recipients.length} recipients? This can't be undone.`)) {
      return;
    }
    setError("");
    setSentMessage("");
    setSending(true);
    try {
      const recipientEmail = recipients.map((r) => r.email).join(", ");
      const { data } = await client.post("/api/email/emails/compose/", {
        recipient_email: recipientEmail,
        cc_emails: ccEmails,
        subject,
        body,
      });
      const attachment = attachmentFile
        ? {
            attachment_filename: attachmentFile.name,
            attachment_mime_type: attachmentFile.type || "application/octet-stream",
            attachment_content_base64: await fileToBase64(attachmentFile),
          }
        : {};
      await client.post(`/api/email/emails/${data.ai_email_id}/send/`, attachment);
      setSentMessage(`Sent to ${recipientEmail}.`);
      resetForm();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't send that email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mail-screen dl2 em2 em2-compose">
      <div className="dl2-ban">
        <div className="dl2-ban-top">
          <div>
            <h1>Compose</h1>
            <p>Write an email and send it.</p>
          </div>
        </div>
      </div>

      <div className="dl2-body">
      {error && <div className="mail-error">{error}</div>}
      {sentMessage && <p className="em2-sent">{sentMessage}</p>}

      <div className="mail-panel em2-card">
        <div className="mail-panel-body">
          <form className="mail-form" onSubmit={handleSend}>
            <label>To</label>
            <div className="mail-recipient-box" onClick={() => inputRef.current?.focus()}>
              {recipients.map((r) => (
                <span className="mail-recipient-chip" key={r.email}>
                  {r.label}
                  <X size={12} onClick={() => removeRecipient(r.email)} style={{ cursor: "pointer" }} />
                </span>
              ))}
              <input
                ref={inputRef}
                type="text"
                value={recipientQuery}
                onChange={(e) => { setRecipientQuery(e.target.value); setShowSuggestions(true); }}
                onKeyDown={handleRecipientKeyDown}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder={recipients.length === 0 ? "Type an email or search a name…" : "Add another…"}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="mail-recipient-suggestions">
                  {suggestions.map((u) => (
                    <div
                      key={u.user_id}
                      className="mail-recipient-suggestion"
                      onMouseDown={() => addRecipient(u.email, `${u.full_name} <${u.email}>`)}
                    >
                      <span className="name">{u.full_name}</span>
                      <span className="email">{u.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="em2-row">
              <div>
                <label>Cc</label>
                <input value={ccEmails} onChange={(e) => setCcEmails(e.target.value)} placeholder="cc1@example.com, cc2@example.com" />
              </div>
              <div>
                <label>Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Your interview is confirmed" required />
              </div>
            </div>

            <label>Message</label>
            <RichTextEditor content={body} onChange={setBody} />

            <button type="button" className="em2-attach" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={15} />
              <span>{attachmentFile ? attachmentFile.name : "Attach a file (optional)"}</span>
              {attachmentFile && (
                <X
                  size={14}
                  onClick={(e) => { e.stopPropagation(); setAttachmentFile(null); }}
                  aria-label="Remove file"
                />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
            />

            <div className="em2-actions">
              <button type="submit" className="em2-send" disabled={sending}>
                <Send size={14} />
                {sending ? "Sending…" : "Send"}
              </button>
              <button type="button" className="em2-cancel" onClick={handleCancel} disabled={sending}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </div>
  );
}

export default Compose;
