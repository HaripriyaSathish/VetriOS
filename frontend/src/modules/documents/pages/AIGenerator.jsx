import { useRef, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import {
  Paperclip, Sparkles, FileSignature, X, XCircle, SlidersHorizontal, ChevronDown, Printer, Copy,
  Download, ShieldCheck, Lock, ArrowRight, FileText, BadgeCheck,
} from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../styles/GenerateDocuments.css";

const MAX_LEN = 500;

// A type with a `route` skips the general-purpose prompt entirely and
// opens its own dedicated page instead (real data auto-loaded there,
// not typed into the free-text box). Both of these are System
// Administrator/HR Administrator only (see App.jsx's route guards and
// IsSystemAdminOrHR on the backend) — Employee and Intern shouldn't
// even see them, let alone reach the pages.
const DOCUMENT_TYPES = [
  {
    label: "Course Integrated Internship Offer Letter",
    description: "students who are selected as interns — pick a header/footer template, write the content, generate",
    icon: FileSignature,
    route: "/documents/ai-generator/course-integrated-internship-offer",
    adminOrHrOnly: true,
  },
  {
    label: "Intern Onboarding Offer Letter",
    description: "students who completed their course and interview — pick a header/footer template, write the content, generate",
    icon: FileSignature,
    route: "/documents/ai-generator/intern-onboarding-offer",
    adminOrHrOnly: true,
  },
];

const GENERAL = "general";

// AI Document Generator — a single free-text prompt, no template or
// employee picked first. Groq drafts straight from the description.
// The paperclip attaches a reference file (.txt/.pdf/.docx) whose text
// gets folded into the prompt as context.
function AIGenerator() {
  const { user } = useOutletContext();
  const roles = user?.roles || [];
  const isSystemAdminOrHR = roles.includes("System Administrator") || roles.includes("HR Administrator");
  const visibleDocumentTypes = DOCUMENT_TYPES.filter((type) => !type.adminOrHrOnly || isSystemAdminOrHR);
  const signatory = user?.full_name || user?.name || user?.username || "";

  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [description, setDescription] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draftText, setDraftText] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);
  const abortControllerRef = useRef(null);

  const chooseType = (value) => {
    const type = visibleDocumentTypes.find((t) => t.route === value);
    if (type) navigate(type.route);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) setAttachedFile(file);
    event.target.value = "";
  };

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError("Describe the document you want first.");
      return;
    }
    setError("");
    setNotice("");
    setGenerating(true);
    setDraftText("");
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const body = new FormData();
      body.append("description", description);
      if (attachedFile) body.append("file", attachedFile);
      const { data } = await client.post("/api/documents/generate/quick/", body, {
        headers: { "Content-Type": "multipart/form-data" },
        signal: controller.signal,
      });
      setDraftText(data.draft_text);
      setGeneratedAt(new Date());
    } catch (err) {
      if (err.code !== "ERR_CANCELED") {
        setError(err.response?.data?.detail || "Generation failed.");
      }
    } finally {
      abortControllerRef.current = null;
      setGenerating(false);
    }
  };

  const handleCancel = () => {
    if (generating) {
      abortControllerRef.current?.abort();
      return;
    }
    setDescription("");
    setAttachedFile(null);
    setDraftText("");
    setError("");
  };

  const copyDraft = () => {
    navigator.clipboard?.writeText(draftText).then(() => setNotice("Draft copied to clipboard."));
  };

  const downloadDraft = () => {
    const url = URL.createObjectURL(new Blob([draftText], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `vetrios-document-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const issued = (generatedAt || new Date()).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="bp-page gen-page">
      <div className="bp-head">
        <div>
          <p className="gen-kicker"><span className="bp-chip blue">Credential Engine</span> · AI Drafting</p>
          <h1 className="bp-title gen-title">Generate Documents</h1>
          <p className="bp-sub">Draft offer letters, internship agreements, bonafide letters and completion certificates on demand.</p>
        </div>
      </div>

      {error && <p className="bp-notice gen-error">{error}</p>}
      {notice && <p className="bp-notice">{notice}</p>}

      <div className="gen-grid">
        <div className="gen-left">
          <section className="bp-panel gen-config">
            <div className="gen-config-head">
              <h2><SlidersHorizontal size={18} /> Configuration</h2>
              <span className="bp-chip blue">{draftText ? "Step 2 of 2" : "Step 1 of 2"}</span>
            </div>

            <label className="bp-field">
              <span>Select Document Type</span>
              <span className="gen-select">
                <select value={GENERAL} onChange={(e) => chooseType(e.target.value)}>
                  <option value={GENERAL}>General document (AI prompt)</option>
                  {visibleDocumentTypes.map((type) => (
                    <option key={type.route} value={type.route}>{type.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </span>
            </label>

            {visibleDocumentTypes.length > 0 && (
              <div className="gen-types">
                {visibleDocumentTypes.map((type) => (
                  <button key={type.label} type="button" className="gen-type" onClick={() => navigate(type.route)}>
                    <type.icon size={16} />
                    <span>
                      <b>{type.label}</b>
                      <small>{type.description}</small>
                    </span>
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
            )}

            <label className="bp-field">
              <span>Describe the document</span>
              <textarea
                className="gen-prompt"
                value={description}
                maxLength={MAX_LEN}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. A bonafide letter for Sneha Patil, enrolled in Full Stack Web – Batch 02, effective 1 June…"
              />
            </label>

            <div className="gen-attach">
              <button type="button" className="gen-attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach a reference file (.txt, .pdf, .docx)">
                <Paperclip size={16} />
                <span>
                  <b>{attachedFile ? attachedFile.name : "Reference file"}</b>
                  <small>{attachedFile ? "Text is used as context" : "Optional .txt, .pdf or .docx"}</small>
                </span>
              </button>
              {attachedFile && (
                <button type="button" className="gen-x" onClick={() => setAttachedFile(null)} aria-label="Remove file"><X size={14} /></button>
              )}
              <span className="gen-count">{description.length}/{MAX_LEN}</span>
              <input ref={fileInputRef} type="file" accept=".txt,.pdf,.docx" onChange={handleFileChange} hidden />
            </div>

            <button type="button" className="bp-btn navy gen-primary" onClick={handleGenerate} disabled={generating}>
              <Sparkles size={16} /> {generating ? "Generating…" : "Generate & Preview"}
            </button>
            <button
              type="button"
              className="bp-btn soft gen-secondary"
              onClick={handleCancel}
              disabled={!generating && !description && !attachedFile && !draftText}
            >
              <XCircle size={15} /> {generating ? "Stop" : "Clear"}
            </button>
          </section>

          {generatedAt && (
            <div className="bp-panel gen-prev">
              <span className="gen-prev-icon"><FileText size={16} /></span>
              <div>
                <b>Latest Generation</b>
                <p>{generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{signatory ? ` by ${signatory}` : ""}</p>
              </div>
            </div>
          )}
        </div>

        <section className="gen-right">
          <div className="bp-panel gen-preview-bar">
            <div className="gen-preview-status">
              <span className="bp-chip blue">LIVE PREVIEW</span>
              <span>A4 Standard Format</span>
              {draftText && <span className="gen-sync"><i /> Ready</span>}
            </div>
            <div className="gen-preview-actions">
              <button type="button" className="bp-btn outline small" onClick={() => window.print()} disabled={!draftText}><Printer size={14} /> Print</button>
              <button type="button" className="bp-btn outline small" onClick={copyDraft} disabled={!draftText}><Copy size={14} /> Copy</button>
              <button type="button" className="bp-btn navy small" onClick={downloadDraft} disabled={!draftText}><Download size={14} /> Download</button>
            </div>
          </div>

          <div className="gen-stage">
            <article className="gen-paper">
              <header className="gen-letterhead">
                <div className="gen-brand">
                  <span className="gen-brand-mark"><ShieldCheck size={20} /></span>
                  <div>
                    <b>VetriOS Enterprise</b>
                    <small>TALENT ACCELERATION &amp; CREDENTIAL BUREAU</small>
                  </div>
                </div>
                <div className="gen-ref">
                  <b>Issued</b>
                  <span>{issued}</span>
                </div>
              </header>

              {generating ? (
                <div className="gen-skeleton">
                  {[90, 70, 100, 85, 95, 60].map((w, i) => <span key={i} style={{ width: `${w}%` }} />)}
                </div>
              ) : draftText ? (
                <div className="gen-draft">{draftText}</div>
              ) : (
                <div className="gen-placeholder">
                  <Sparkles size={28} />
                  <p>Describe the document on the left and press <b>Generate &amp; Preview</b>. The draft appears here on letterhead.</p>
                </div>
              )}

              {draftText && (
                <footer className="gen-sign">
                  <div className="gen-verify">
                    <BadgeCheck size={18} />
                    <span><b>AI DRAFT</b><small>Review before issuing</small></span>
                  </div>
                  {signatory && (
                    <div className="gen-signatory">
                      <i>{signatory}</i>
                      <b>{signatory}</b>
                      <small>VetriOS Enterprise Platform</small>
                    </div>
                  )}
                </footer>
              )}
              <p className="gen-paper-foot">Official institutional communication generated under VetriOS.</p>
            </article>
          </div>
        </section>
      </div>

      <div className="bp-panel gen-strip">
        <span className="gen-prev-icon"><Lock size={16} /></span>
        <div>
          <b>Library &amp; Governance</b>
          <p>Issued documents are stored in the Document Library with confidentiality and access controls.</p>
        </div>
        <Link to="/documents" className="gen-strip-link">Go to Document Library <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}

export default AIGenerator;
