import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, UploadCloud, Loader2 } from "lucide-react";
import client from "../../../api/client";
import "../styles/Documents.css";

// New Template — mirrors the Template Detail (view/edit) page's layout:
// a details form on the left, a design preview on the right. The only
// addition here is the file picker, since a new template needs a design
// to preserve; picking a file analyzes it immediately so the preview and
// detected placeholders show up before you save anything.
function TemplateCreate() {
  const navigate = useNavigate();
  const [types, setTypes] = useState([]);

  const [form, setForm] = useState({ template_code: "", template_name: "", document_type_id: "" });
  const [analyzed, setAnalyzed] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    client.get("/api/documents/library/filters/").then(({ data }) => setTypes(data.types)).catch(() => {});
  }, []);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;

    setAnalyzeError("");
    setAnalyzing(true);
    setAnalyzed(null);
    setPreviewUrl("");
    try {
      const body = new FormData();
      body.append("file", file);
      const { data } = await client.post("/api/documents/templates/analyze-upload/", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAnalyzed(data);
      setForm((prev) => ({
        ...prev,
        template_name: prev.template_name || file.name.replace(/\.[^.]+$/, ""),
      }));

      setPreviewLoading(true);
      setPreviewError("");
      try {
        const { data: blob } = await client.get("/api/documents/templates/preview/", {
          params: { content: data.template_content },
          responseType: "blob",
        });
        setPreviewUrl(URL.createObjectURL(blob));
      } catch {
        setPreviewError("Couldn't render a preview of this design.");
      } finally {
        setPreviewLoading(false);
      }
    } catch (err) {
      setAnalyzeError(err.response?.data?.detail || "Couldn't analyze that file.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!analyzed) {
      setSaveError("Upload a design file first.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const { data } = await client.post("/api/documents/templates/create/", {
        template_code: form.template_code,
        template_name: form.template_name,
        document_type_id: form.document_type_id || null,
        template_format: analyzed.template_format,
        template_content: analyzed.template_content,
        description: JSON.stringify({ placeholders: analyzed.placeholders, hints: analyzed.placeholder_hints }),
      });
      navigate(`/documents/templates/${data.document_template_id}`);
    } catch (err) {
      const data = err.response?.data;
      setSaveError(data ? Object.values(data).flat().join(" ") : "Couldn't save template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="doc-screen">
      <div className="doc-head">
        <div>
          <span className="doc-eyebrow">Document Generator</span>
          <h1>New Template</h1>
          <p>Upload a sample document and give it a name — the design is preserved as-is.</p>
        </div>
        <button type="button" className="doc-btn-sm" onClick={() => navigate("/documents/templates")}>
          <ArrowLeft size={14} />
          Back to Templates
        </button>
      </div>

      <div className="doc-generator-grid">
        <div className="doc-panel">
          <div className="doc-panel-head">
            <h3>Template details</h3>
            <p>Code, name, document type, and the design file.</p>
          </div>
          <div className="doc-panel-body">
            {saveError && <div className="doc-error">{saveError}</div>}
            {analyzeError && <div className="doc-error">{analyzeError}</div>}

            <form className="doc-form" onSubmit={handleSave}>
              <label>Design file (.docx, .pdf, or .txt)</label>
              <div className="doc-upload-row">
                <label className="doc-btn-sm" style={{ cursor: "pointer" }}>
                  {analyzing ? <Loader2 size={14} className="doc-spin" /> : <UploadCloud size={14} />}
                  {analyzing ? "Analyzing…" : "Choose file"}
                  <input
                    type="file"
                    accept=".docx,.pdf,.txt"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                </label>
                <span className="doc-upload-hint">
                  {analyzed ? `Using: ${analyzed.source_filename}` : "No file chosen yet."}
                </span>
              </div>

              <label>Template code</label>
              <input
                value={form.template_code}
                onChange={(e) => setForm({ ...form, template_code: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                placeholder="e.g. RELIEVING_LETTER"
                required
              />

              <label>Name</label>
              <input
                value={form.template_name}
                onChange={(e) => setForm({ ...form, template_name: e.target.value })}
                required
              />

              <label>Document type</label>
              <select
                value={form.document_type_id}
                onChange={(e) => setForm({ ...form, document_type_id: e.target.value })}
              >
                <option value="">No type</option>
                {types.map((t) => <option key={t.document_type_id} value={t.document_type_id}>{t.type_name}</option>)}
              </select>

              <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                <button type="submit" className="doc-btn-accent" disabled={saving || !analyzed}>
                  <Save size={15} />
                  {saving ? "Saving…" : "Create Template"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="doc-panel">
          <div className="doc-panel-head">
            <h3>Design preview</h3>
            <p>What the actual document looks like.</p>
          </div>
          <div className="doc-panel-body">
            {previewLoading ? (
              <p className="doc-empty">Rendering preview…</p>
            ) : previewError ? (
              <div className="doc-error">{previewError}</div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                title="Template design preview"
                style={{ width: "100%", height: 520, border: "1px solid #e3e6ee", borderRadius: 8 }}
              />
            ) : (
              <p className="doc-empty">Choose a file to see its design here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateCreate;
