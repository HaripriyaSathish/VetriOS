import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, FileCheck, Download } from "lucide-react";
import client from "../../../api/client";
import "../styles/Documents.css";

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Reached by clicking a template's polaroid card — view its rendered
// design and edit its details. Every template is a real Word (DOCX)
// document — there's no plain-text/markdown template format — so the
// design itself isn't editable here, only name/code/type.
function TemplateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [template, setTemplate] = useState(null);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({ template_code: "", template_name: "", document_type_id: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [previewUrl, setPreviewUrl] = useState("");
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    client.get("/api/documents/library/filters/").then(({ data }) => setTypes(data.types)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    client
      .get(`/api/documents/templates/${id}/`)
      .then(({ data }) => {
        setTemplate(data);
        setForm({
          template_code: data.template_code,
          template_name: data.template_name,
          document_type_id: data.document_type_id || "",
        });
        setPreviewLoading(true);
        client
          .get("/api/documents/templates/preview/", {
            params: { content: data.template_content },
            responseType: "blob",
          })
          .then(({ data: blob }) => {
            setPreviewUrl(URL.createObjectURL(blob));
            setPreviewBlob(blob);
          })
          .catch(() => setPreviewError("Couldn't render a preview of this design."))
          .finally(() => setPreviewLoading(false));
      })
      .catch(() => setError("Couldn't load this template."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const { data } = await client.put(`/api/documents/templates/${id}/`, {
        template_code: form.template_code,
        template_name: form.template_name,
        document_type_id: form.document_type_id || null,
      });
      setTemplate(data);
      setSaved(true);
    } catch (err) {
      const data = err.response?.data;
      setSaveError(data ? Object.values(data).flat().join(" ") : "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!previewBlob) return;
    triggerBlobDownload(previewBlob, `${template.template_name || "template"}.pdf`);
  };

  if (loading) return <div className="doc-screen"><p className="doc-empty">Loading…</p></div>;
  if (error || !template) return <div className="doc-screen"><div className="doc-error">{error || "Not found."}</div></div>;

  return (
    <div className="doc-screen">
      <div className="doc-head">
        <div>
          <span className="doc-eyebrow">Document Generator</span>
          <h1>{template.template_name}</h1>
          <p>View and edit this template.</p>
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
            <p>Code, name, and document type.</p>
          </div>
          <div className="doc-panel-body">
            <p className="doc-prefill-note" style={{ background: "#e6ecfb", color: "#2f4aa8" }}>
              <FileCheck size={13} />
              Design-preserving template — the design itself isn't editable here, only these details.
            </p>
            {saveError && <div className="doc-error">{saveError}</div>}

            <form className="doc-form" onSubmit={handleSave}>
              <label>Template code</label>
              <input
                value={form.template_code}
                onChange={(e) => setForm({ ...form, template_code: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
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
                <button type="submit" className="doc-btn-accent" disabled={saving}>
                  <Save size={15} />
                  {saved ? "Saved" : saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="doc-panel">
          <div className="doc-panel-head" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div>
              <h3>Design preview</h3>
              <p>What the actual document looks like.</p>
            </div>
            {previewBlob && (
              <button type="button" className="doc-btn-sm" onClick={handleDownloadPdf}>
                <Download size={14} />
                Download as PDF
              </button>
            )}
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
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateDetail;
