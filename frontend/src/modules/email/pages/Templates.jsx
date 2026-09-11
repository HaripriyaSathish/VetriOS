import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import client from "../../../api/client";
import "../styles/Email.css";

function Templates() {
  const [templates, setTemplates] = useState([]);
  const [types, setTypes] = useState([]);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [emailTypeId, setEmailTypeId] = useState("");
  const [templateCode, setTemplateCode] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTemplates = () => {
    client.get("/api/email/templates/").then(({ data }) => setTemplates(data)).catch(() => setError("Couldn't load templates."));
  };

  useEffect(() => {
    loadTemplates();
    client.get("/api/email/types/").then(({ data }) => setTypes(data)).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!emailTypeId || !templateCode || !templateName || !subjectTemplate || !bodyTemplate) {
      setError("All fields are required.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await client.post("/api/email/templates/create/", {
        email_type: emailTypeId,
        template_code: templateCode,
        template_name: templateName,
        subject_template: subjectTemplate,
        body_template: bodyTemplate,
        template_format: "TEXT",
      });
      setTemplateCode(""); setTemplateName(""); setSubjectTemplate(""); setBodyTemplate(""); setEmailTypeId("");
      setShowForm(false);
      loadTemplates();
    } catch (err) {
      setError(err.response?.data?.template_code?.[0] || err.response?.data?.detail || "Couldn't create template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mail-screen">
      <div className="mail-head">
        <div>
          <span className="mail-eyebrow">Email</span>
          <h1>Templates</h1>
          <p>Reusable subject + body pairs, one per email type.</p>
        </div>
        <button type="button" className="mail-btn-accent" onClick={() => setShowForm((v) => !v)}>
          <Plus size={15} />
          {showForm ? "Cancel" : "New template"}
        </button>
      </div>

      {error && <div className="mail-error">{error}</div>}

      {showForm && (
        <div className="mail-panel">
          <div className="mail-panel-head">
            <h3>New template</h3>
            <p>Use {"{{placeholder}}"} tags in the subject/body — they resolve when composing.</p>
          </div>
          <div className="mail-panel-body">
            <form className="mail-form" onSubmit={handleCreate}>
              <label>Email type</label>
              <select value={emailTypeId} onChange={(e) => setEmailTypeId(e.target.value)} required>
                <option value="">Select a type…</option>
                {types.map((t) => (
                  <option key={t.email_type_id} value={t.email_type_id}>{t.email_type_name}</option>
                ))}
              </select>

              <label>Template code</label>
              <input value={templateCode} onChange={(e) => setTemplateCode(e.target.value)} placeholder="e.g. INTERVIEW_INVITE" required />

              <label>Template name</label>
              <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Interview Invitation" required />

              <label>Subject template</label>
              <input value={subjectTemplate} onChange={(e) => setSubjectTemplate(e.target.value)} placeholder="e.g. Interview scheduled for {{candidate_name}}" required />

              <label>Body template</label>
              <textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} placeholder="Dear {{candidate_name}}, …" required />

              <div style={{ marginTop: 16 }}>
                <button type="submit" className="mail-btn-accent" disabled={saving}>
                  {saving ? "Saving…" : "Save template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mail-panel">
        <div className="mail-panel-body" style={{ padding: 0 }}>
          {templates.length === 0 ? (
            <p className="mail-empty">No templates yet.</p>
          ) : (
            <div className="mail-table-wrap">
              <table className="mail-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Code</th>
                    <th>Format</th>
                    <th>Version</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.email_template_id}>
                      <td>{t.template_name}</td>
                      <td>{t.email_type_name}</td>
                      <td>{t.template_code}</td>
                      <td>{t.template_format}</td>
                      <td>{t.version_number}</td>
                      <td>{t.is_active ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Templates;
