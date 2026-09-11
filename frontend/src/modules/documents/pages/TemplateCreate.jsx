import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Sparkles, Check, FileCheck, FileUp, Wand2 } from "lucide-react";
import client from "../../../api/client";
import "../styles/Documents.css";

const EMPTY_DETAILS = { template_code: "", template_name: "", document_type_id: "" };

// Full-page template creation, in three clear steps:
//   1. Choose a starting point — upload a sample letter, or describe one to AI.
//   2. Provide it — the file picker or the description box for whichever was chosen.
//   3. Review the detected placeholders + design preview, name it, save.
function TemplateCreate() {
  const navigate = useNavigate();
  const [types, setTypes] = useState([]);
  const [mode, setMode] = useState(null); // null | "upload" | "ai"

  const [file, setFile] = useState(null);
  const [description, setDescription] = useState("");
  const [working, setWorking] = useState(false);
  const [workError, setWorkError] = useState("");

  const [analyzed, setAnalyzed] = useState(null); // { template_format, template_content, placeholders, placeholder_hints, source_filename }
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    client.get("/api/documents/library/filters/").then(({ data }) => setTypes(data.types)).catch(() => {});
  }, []);

  const step = analyzed ? 3 : mode ? 2 : 1;

  const loadPreview = async (storageName) => {
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const { data } = await client.get("/api/documents/templates/preview/", {
        params: { content: storageName },
        responseType: "blob",
      });
      setPreviewUrl(URL.createObjectURL(data));
    } catch (err) {
      setPreviewError("Couldn't render a preview of the design.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const afterAnalyzed = (data) => {
    setAnalyzed(data);
    setDetails({
      template_code: "",
      template_name: data.source_filename ? data.source_filename.replace(/\.[^.]+$/, "") : "",
      document_type_id: "",
    });
    loadPreview(data.template_content);
  };

  const handleUploadAnalyze = async (event) => {
    event.preventDefault();
    if (!file) {
      setWorkError("Choose a file first.");
      return;
    }
    setWorking(true);
    setWorkError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const { data } = await client.post("/api/documents/templates/analyze-upload/", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      afterAnalyzed(data);
    } catch (err) {
      setWorkError(err.response?.data?.detail || "Couldn't analyze that file.");
    } finally {
      setWorking(false);
    }
  };

  const handleAiGenerate = async (event) => {
    event.preventDefault();
    if (!description.trim()) {
      setWorkError("Describe the letter you want first.");
      return;
    }
    setWorking(true);
    setWorkError("");
    try {
      const { data } = await client.post("/api/documents/templates/generate-design/", { description });
      afterAnalyzed(data);
    } catch (err) {
      setWorkError(err.response?.data?.detail || "Couldn't generate that design.");
    } finally {
      setWorking(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!details.template_code || !details.template_name) {
      setSaveError("Template code and name are required.");
      return;
    }
    setSavingTemplate(true);
    setSaveError("");
    try {
      await client.post("/api/documents/templates/create/", {
        template_code: details.template_code.toUpperCase().replace(/\s+/g, "_"),
        template_name: details.template_name,
        document_type_id: details.document_type_id || null,
        template_format: "DOCX",
        template_content: analyzed.template_content,
        description: JSON.stringify({ placeholders: analyzed.placeholders, hints: analyzed.placeholder_hints }),
      });
      navigate("/documents/templates");
    } catch (err) {
      const data = err.response?.data;
      setSaveError(data ? Object.values(data).flat().join(" ") : "Couldn't save template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const chooseMode = (m) => {
    setMode(m);
    setWorkError("");
  };

  const backToChoice = () => {
    setMode(null);
    setWorkError("");
    setFile(null);
    setDescription("");
  };

  const startOver = () => {
    setMode(null);
    setAnalyzed(null);
    setPreviewUrl("");
    setPreviewError("");
    setFile(null);
    setDescription("");
  };

  return (
    <div className="doc-screen">
      <div className="doc-head">
        <div>
          <span className="doc-eyebrow">Document Generator</span>
          <h1>New Template</h1>
          <p>Create a reusable template in three steps — start from a sample letter, or describe one to AI.</p>
        </div>
        <button type="button" className="doc-btn-sm" onClick={() => navigate("/documents/templates")}>
          <ArrowLeft size={14} />
          Back to Templates
        </button>
      </div>

      <div className="doc-stepper">
        <div className={"doc-stepper-step" + (step > 1 ? " done" : " active")}>
          <span className="doc-stepper-num">{step > 1 ? <Check size={13} /> : "1"}</span>
          <span className="doc-stepper-label">Choose a method</span>
        </div>
        <div className={"doc-stepper-step" + (step === 2 ? " active" : step > 2 ? " done" : "")}>
          <span className="doc-stepper-num">{step > 2 ? <Check size={13} /> : "2"}</span>
          <span className="doc-stepper-label">Provide it</span>
        </div>
        <div className={"doc-stepper-step" + (step === 3 ? " active" : "")}>
          <span className="doc-stepper-num">3</span>
          <span className="doc-stepper-label">Review & save</span>
        </div>
      </div>

      {step === 1 && (
        <div className="doc-card-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="doc-card" onClick={() => chooseMode("upload")}>
            <div className="doc-icon-tile blue" style={{ marginBottom: 14 }}>
              <FileUp size={20} />
            </div>
            <p className="doc-card-title">Upload a Sample Document</p>
            <p className="doc-card-sub">
              Have an existing letter (.docx or .pdf)? Upload it and we'll extract the exact design —
              fonts, letterhead, and layout kept intact.
            </p>
          </div>
          <div className="doc-card" onClick={() => chooseMode("ai")}>
            <div className="doc-icon-tile purple" style={{ marginBottom: 14 }}>
              <Wand2 size={20} />
            </div>
            <p className="doc-card-title">Generate with AI</p>
            <p className="doc-card-sub">
              No file on hand? Describe the letter you need and AI will draft both the wording and a
              matching letterhead design from scratch.
            </p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="doc-panel">
          <div className="doc-panel-head" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className={"doc-icon-tile " + (mode === "upload" ? "blue" : "purple")}>
              {mode === "upload" ? <Upload size={18} /> : <Sparkles size={18} />}
            </div>
            <div>
              <h3>{mode === "upload" ? "Upload a sample document" : "Describe the letter to AI"}</h3>
              <p>{mode === "upload" ? "We'll analyze it and pull out the reusable placeholders." : "AI will draft the content and design together."}</p>
            </div>
          </div>
          <div className="doc-panel-body">
            {workError && <div className="doc-error">{workError}</div>}

            {mode === "upload" ? (
              <form className="doc-form" onSubmit={handleUploadAnalyze}>
                <label>Sample letter (.txt, .docx, or .pdf)</label>
                <input
                  type="file"
                  accept=".txt,.docx,.pdf"
                  onChange={(e) => setFile(e.target.files[0])}
                  required
                />
                <p style={{ fontSize: 12, color: "#8a93a6", marginTop: 8 }}>
                  .docx uploads keep the exact original design (fonts, letterhead, bold, layout).
                  .txt/.pdf are converted to a plain Word document.
                </p>
                <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                  <button type="submit" className="doc-btn-accent" disabled={working}>
                    <Sparkles size={14} />
                    {working ? "Analyzing…" : "Analyze"}
                  </button>
                  <button type="button" className="doc-btn-sm" onClick={backToChoice}>
                    <ArrowLeft size={13} />
                    Choose a different method
                  </button>
                </div>
              </form>
            ) : (
              <form className="doc-form" onSubmit={handleAiGenerate}>
                <label>Describe the letter you want</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. A formal internship offer letter, with a company letterhead title, addressed to the intern with role, stipend, and start date."
                  style={{ minHeight: 120 }}
                  required
                />
                <p style={{ fontSize: 12, color: "#8a93a6", marginTop: 8 }}>
                  AI drafts the letter content and a letterhead design from scratch — no sample file needed.
                </p>
                <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                  <button type="submit" className="doc-btn-accent" disabled={working}>
                    <Sparkles size={14} />
                    {working ? "Generating…" : "Generate Design"}
                  </button>
                  <button type="button" className="doc-btn-sm" onClick={backToChoice}>
                    <ArrowLeft size={13} />
                    Choose a different method
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="doc-generator-grid">
          <div className="doc-panel">
            <div className="doc-panel-head" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="doc-icon-tile green">
                <Check size={18} />
              </div>
              <div>
                <h3>Template details</h3>
                <p>Review the detected placeholders and name this template.</p>
              </div>
            </div>
            <div className="doc-panel-body">
              <p className="doc-prefill-note">
                <Check size={13} />
                Found {analyzed.placeholders.length} placeholder{analyzed.placeholders.length === 1 ? "" : "s"}:{" "}
                {analyzed.placeholders.map((p) => `{{${p}}}`).join(", ") || "none"}
              </p>
              <p className="doc-prefill-note" style={{ background: "#e6ecfb", color: "#2f4aa8" }}>
                <FileCheck size={13} />
                {mode === "ai"
                  ? "AI-generated design — see the preview alongside."
                  : analyzed.source_filename?.toLowerCase().endsWith(".docx")
                  ? "Design preserved — original fonts, letterhead, and formatting kept intact."
                  : "Converted to a Word document — no design to preserve from a text/PDF source."}
              </p>

              {saveError && <div className="doc-error">{saveError}</div>}

              <form className="doc-form" onSubmit={(e) => { e.preventDefault(); handleSaveTemplate(); }}>
                <label>Template code</label>
                <input
                  value={details.template_code}
                  onChange={(e) => setDetails({ ...details, template_code: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                  placeholder="e.g. RELIEVING_LETTER"
                  required
                />

                <label>Name</label>
                <input
                  value={details.template_name}
                  onChange={(e) => setDetails({ ...details, template_name: e.target.value })}
                  required
                />

                <label>Document type</label>
                <select
                  value={details.document_type_id}
                  onChange={(e) => setDetails({ ...details, document_type_id: e.target.value })}
                >
                  <option value="">No type</option>
                  {types.map((t) => <option key={t.document_type_id} value={t.document_type_id}>{t.type_name}</option>)}
                </select>

                <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                  <button type="submit" className="doc-btn-accent" disabled={savingTemplate}>
                    {savingTemplate ? "Saving…" : "Save Template"}
                  </button>
                  <button type="button" className="doc-btn-sm" onClick={startOver}>
                    Start over
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
                <p className="doc-empty">No preview yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateCreate;
