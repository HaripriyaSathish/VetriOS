import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, Save, Check } from "lucide-react";
import client from "../../../api/client";
import "../styles/Documents.css";

function formatTime(t) {
  if (!t) return "—";
  return new Date(t).toLocaleString(undefined, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// Vetri Tool (AI Generator) — pick a template + employee, review the
// auto-filled facts pulled straight from HR data, add optional
// instructions, and let Groq draft the document. Nothing is saved as a
// real Document until the user explicitly reviews and saves the draft.
function AIGenerator() {
  const [templates, setTemplates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [history, setHistory] = useState([]);

  const [templateId, setTemplateId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [stipend, setStipend] = useState("");
  const [instructions, setInstructions] = useState("");

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [draft, setDraft] = useState("");
  const [generationId, setGenerationId] = useState(null);

  const loadHistory = () => {
    client.get("/api/documents/generations/").then(({ data }) => setHistory(data)).catch(() => {});
  };

  useEffect(() => {
    client.get("/api/documents/templates/").then(({ data }) => setTemplates(data)).catch(() => {});
    client.get("/api/hr/employees/").then(({ data }) => setEmployees(data)).catch(() => {});
    loadHistory();
  }, []);

  const selectedTemplate = templates.find((t) => String(t.document_template_id) === String(templateId));
  const selectedEmployee = employees.find((e) => String(e.employee_id) === String(employeeId));
  const needsStipend = selectedTemplate?.placeholders?.includes("stipend");

  const handleGenerate = async (event) => {
    event.preventDefault();
    setError("");
    setSaved(false);
    setGenerating(true);
    try {
      const { data } = await client.post("/api/documents/generate/", {
        template_id: Number(templateId),
        employee_id: Number(employeeId),
        stipend,
        instructions,
      });
      setDraft(data.draft_text);
      setGenerationId(data.generation_id);
      loadHistory();
    } catch (err) {
      setError(err.response?.data?.detail || "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      await client.post(`/api/documents/generate/${generationId}/save/`, {
        final_text: draft,
        employee_id: Number(employeeId),
      });
      setSaved(true);
      loadHistory();
    } catch (err) {
      setError(err.response?.data?.detail || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="doc-screen">
      <div className="doc-head">
        <div>
          <span className="doc-eyebrow">Document Generator</span>
          <h1>Vetri Tool (AI Generator)</h1>
          <p>Generate HR documents from a template, auto-filled with real employee data.</p>
        </div>
      </div>

      {error && <div className="doc-error">{error}</div>}

      <div className="doc-generator-grid">
        <div className="doc-panel">
          <div className="doc-panel-head">
            <h3>Generate a document</h3>
            <p>Pick a template and an employee — the facts below fill in automatically.</p>
          </div>
          <div className="doc-panel-body">
            <form className="doc-form" onSubmit={handleGenerate}>
              <label>Template</label>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
                <option value="">Select a template…</option>
                {templates.map((t) => (
                  <option key={t.document_template_id} value={t.document_template_id}>
                    {t.template_name}
                  </option>
                ))}
              </select>

              <label>Employee</label>
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
                <option value="">Select an employee…</option>
                {employees.map((e) => (
                  <option key={e.employee_id} value={e.employee_id}>
                    {e.full_name} — {e.designation_name || "No designation"}
                  </option>
                ))}
              </select>

              {selectedEmployee && (
                <div className="doc-prefill-note">
                  <Check size={13} />
                  Auto-filled from HR: {selectedEmployee.designation_name || "—"},{" "}
                  {selectedEmployee.department_name || "—"}
                </div>
              )}

              {needsStipend && (
                <>
                  <label>Stipend</label>
                  <input
                    value={stipend}
                    onChange={(e) => setStipend(e.target.value)}
                    placeholder="e.g. ₹25,000 / month"
                  />
                </>
              )}

              <label>Additional instructions (optional)</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Anything else the draft should reflect…"
              />

              <div style={{ marginTop: 16 }}>
                <button type="submit" className="doc-btn-accent" disabled={generating}>
                  <Sparkles size={15} />
                  {generating ? "Generating…" : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="doc-panel">
          <div className="doc-panel-head">
            <h3>Draft preview</h3>
            <p>Review before saving — this becomes the official document.</p>
          </div>
          {draft ? (
            <>
              <textarea
                className="doc-preview"
                style={{ width: "100%", border: "none", boxSizing: "border-box" }}
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setSaved(false); }}
              />
              <div className="doc-preview-actions">
                <button type="button" className="doc-btn-sm" onClick={handleGenerate} disabled={generating}>
                  <RefreshCw size={13} />
                  Regenerate
                </button>
                <button type="button" className="doc-btn-accent" onClick={handleSave} disabled={saving || saved}>
                  <Save size={15} />
                  {saved ? "Saved" : saving ? "Saving…" : "Save as Document"}
                </button>
              </div>
            </>
          ) : (
            <p className="doc-empty">Generate a draft to see it here.</p>
          )}
        </div>
      </div>

      <div className="doc-panel" style={{ marginTop: 20 }}>
        <div className="doc-panel-head">
          <h3>Recent generations</h3>
        </div>
        <div className="doc-panel-body">
          {history.length === 0 ? (
            <p className="doc-empty">No generations yet.</p>
          ) : (
            history.map((h) => (
              <div className="doc-history-item" key={h.ai_document_generation_id}>
                <span
                  className={`doc-history-dot ${
                    h.generation_status === "COMPLETED" ? "done" :
                    h.generation_status === "FAILED" ? "fail" : "pending"
                  }`}
                />
                <span className="doc-history-text">
                  {h.template_name} {h.generated_document_id ? "— saved" : "— draft only"}
                </span>
                <span className="doc-history-time">{formatTime(h.requested_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default AIGenerator;
