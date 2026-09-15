import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, Download, FolderArchive, UploadCloud, Loader2, RefreshCw, Search } from "lucide-react";
import JSZip from "jszip";
import client from "../../../api/client";
import RichTextEditor from "../components/RichTextEditor";
import SearchSelect from "../components/SearchSelect";
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

// recipientname_onboarding_offer_letter.pdf — no spaces/punctuation in
// the name portion, everything lowercased.
function offerLetterFilename(fullName) {
  const slug = (fullName || "recipient").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${slug}_onboarding_offer_letter.pdf`;
}

// This letter has its own separate letterhead design — not shared with
// Course Integrated. Nothing exists under this code until the first
// upload via Step 3's "+ Add new template" claims it (see
// handleTemplateFileChange), after which it auto-loads here every time.
const DEFAULT_TEMPLATE_CODE = "VIS_INTERN_ONBOARDING_OFFER";

// Dedicated page for the "Intern Onboarding Offer Letter" card on the AI
// Document Generator — sent to interns who completed their course, cleared
// the 5-round interview, and were selected as paid interns. Same batch-
// then-student flow as Course Integrated, but only ACTIVE interns are
// eligible: choose a batch, pick who it's for, fill in the offer details,
// pick the design template, write the letter content, then
// preview/cancel/generate.
function InternOnboardingOfferLetter() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [template, setTemplate] = useState(null);
  const [templateError, setTemplateError] = useState("");
  const [templateOptions, setTemplateOptions] = useState([]);
  const [interns, setInterns] = useState([]);

  const [selectedBatch, setSelectedBatch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [internIds, setInternIds] = useState([]);

  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("Remote");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [stipend, setStipend] = useState("");
  const [letterContent, setLetterContent] = useState(
    "<p style=\"font-size:12px;color:#5a6376;\">Corporate ID: U62099TN2024PTC172387 &nbsp;&nbsp; TAN No: MRIV03584A</p>" +
      "<p>To : <strong>{{recipient_name}}</strong></p>" +
      "<p>We are pleased to inform you that you have been appointed as a <strong>{{role}}</strong> " +
      "for our Vetri IT Systems Private Limited.</p>" +
      "<p>Congratulations and Welcome to our VIS Team!</p>" +
      "<p>Role: <strong>{{role}}</strong><br>Department: <strong>{{department}}</strong><br>Location: <strong>{{location}}</strong><br>" +
      "Effective From: <strong>{{effective_date}}</strong><br>Stipend: <strong>{{stipend}}</strong></p>" +
      "<p>Congratulations on your successful internship selection.</p>" +
      "<p>Wishing you dedication, learning, and professional development.</p>" +
      "<p>Welcome On Board!!!</p>"
  );

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [customTemplateName, setCustomTemplateName] = useState("");

  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    client.get("/api/documents/interns/").then(({ data }) => setInterns(data)).catch(() => {});
  }, []);


  // No auto-selected default — the admin picks one explicitly every time.
  useEffect(() => {
    client
      .get("/api/documents/templates/")
      .then(({ data }) => setTemplateOptions(data))
      .catch(() => {});
  }, []);

  const handleTemplateSelect = (templateId) => {
    const found = templateOptions.find((t) => String(t.document_template_id) === String(templateId));
    if (found) {
      setTemplate(found);
      setCustomTemplateName("");
      setTemplateError("");
    } else {
      setTemplate(null);
    }
  };

  // Only ACTIVE interns are eligible for onboarding, but the batch picker
  // still narrows which of them to look through first — same batch-then-
  // student flow as Course Integrated, just scoped to ACTIVE interns.
  const activeInterns = interns.filter((i) => i.status === "ACTIVE");

  const batchLabel = (b) => `${b.batch_name} — ${b.course_name}`;

  const batches = [];
  const seenBatches = new Set();
  for (const i of activeInterns) {
    if (i.batch_name && !seenBatches.has(i.batch_name)) {
      seenBatches.add(i.batch_name);
      batches.push({ batch_name: i.batch_name, course_name: i.course_name });
    }
  }

  const handleBatchSelect = (batchName) => {
    setSelectedBatch(batchName);
    setInternIds([]);
    setStudentSearch("");
  };

  const internsInBatch = selectedBatch ? activeInterns.filter((i) => i.batch_name === selectedBatch) : [];
  const visibleInterns = internsInBatch.filter((i) =>
    i.full_name.toLowerCase().includes(studentSearch.toLowerCase())
  );
  const selectedInterns = internIds
    .map((id) => interns.find((i) => String(i.intern_id) === String(id)))
    .filter(Boolean);

  const toggleIntern = (id) => {
    setInternIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleTemplateUploadClick = () => fileInputRef.current?.click();

  const handleTemplateFileChange = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;

    setUploadError("");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const { data: analyzed } = await client.post("/api/documents/templates/analyze-upload/", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const knownFields = [
        "recipient_name", "date", "effective_date", "role", "stipend", "content",
        "company_name", "company_email", "contact_email", "hr_email", "company_website",
        "corporate_id", "tan_no", "tan_number",
        "department", "location",
      ];
      const extraPlaceholders = (analyzed.placeholders || []).filter((p) => !knownFields.includes(p));
      if (extraPlaceholders.length > 0) {
        setUploadError(
          `That file needs values this form doesn't collect (${extraPlaceholders.join(", ")}) — ` +
          "generation would fail with a missing-values error. Not switching the template."
        );
        return;
      }

      // The first upload claims the fixed default code, so it auto-loads
      // here on every future visit (see the effect above). A later
      // re-upload falls back to a fresh timestamped code, since that one's
      // already taken.
      const alreadyHasDefault = templateOptions.some((t) => t.template_code === DEFAULT_TEMPLATE_CODE);
      const code = alreadyHasDefault ? `ONBOARD-OFFER-${Date.now()}` : DEFAULT_TEMPLATE_CODE;
      const { data: created } = await client.post("/api/documents/templates/create/", {
        template_code: code,
        template_name: `Intern Onboarding Offer Letter — ${file.name}`,
        template_content: analyzed.template_content,
        template_format: analyzed.template_format,
      });

      setTemplateOptions((prev) => [...prev, created]);
      setTemplate(created);
      setCustomTemplateName(file.name);
      setTemplateError("");
    } catch (err) {
      setUploadError(err.response?.data?.detail || "Couldn't use that file as a design template.");
    } finally {
      setUploading(false);
    }
  };

  // Shared by the initial batch generate and a per-row Regenerate — always
  // reads whatever is currently in the form (role/department/etc.), so
  // editing a field and regenerating picks up the change.
  const generateForIntern = async (intern) => {
    const fallbackDate = intern.internship_start_date
      ? new Date(intern.internship_start_date).toLocaleDateString("en-GB").replace(/\//g, ".")
      : "";
    try {
      const { data } = await client.post("/api/documents/generate/intern-offer/", {
        template_id: template.document_template_id,
        intern_id: intern.intern_id,
        field_values: {
          role,
          department,
          location,
          effective_date: effectiveDate || fallbackDate,
          stipend,
          letter_content: templateNeedsContentStep ? letterContent : "",
        },
      });
      return { intern, ok: true, document_id: data.document_id };
    } catch (err) {
      return { intern, ok: false, message: err.response?.data?.detail || "Generation failed." };
    }
  };

  const handleGenerate = async () => {
    if (!template || internIds.length === 0) {
      setError("Pick at least one intern first.");
      return;
    }
    setError("");
    setGenerating(true);
    setResults([]);
    const nextResults = [];
    for (const intern of selectedInterns) {
      nextResults.push(await generateForIntern(intern));
    }
    setResults(nextResults);
    setGenerating(false);
  };

  const handleRegenerate = async (intern) => {
    setError("");
    setRegeneratingId(intern.intern_id);
    const result = await generateForIntern(intern);
    setResults((prev) => prev.map((r) => (r.intern.intern_id === intern.intern_id ? result : r)));
    setRegeneratingId(null);
  };

  const handleView = async (documentId) => {
    const viewerTab = window.open("", "_blank");
    try {
      const { data } = await client.get(`/api/documents/library/${documentId}/file/`, {
        params: { inline: 1 }, responseType: "blob",
      });
      if (viewerTab) viewerTab.location.href = URL.createObjectURL(data);
    } catch {
      if (viewerTab) viewerTab.close();
      setError("Couldn't open that file.");
    }
  };

  const handleDownload = async (documentId, fullName) => {
    try {
      const { data } = await client.get(`/api/documents/library/${documentId}/file/`, { responseType: "blob" });
      triggerBlobDownload(data, offerLetterFilename(fullName));
    } catch {
      setError("Couldn't download that file.");
    }
  };

  // Bundles every successfully generated letter into one ZIP, each
  // entry named the same way as the individual download.
  const handleDownloadZip = async () => {
    const okResults = results.filter((r) => r.ok);
    if (okResults.length === 0) return;
    setZipping(true);
    setError("");
    try {
      const zip = new JSZip();
      for (const r of okResults) {
        const { data } = await client.get(`/api/documents/library/${r.document_id}/file/`, { responseType: "blob" });
        zip.file(offerLetterFilename(r.intern.full_name), data);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      triggerBlobDownload(blob, "onboarding_offer_letters.zip");
    } catch {
      setError("Couldn't build the ZIP.");
    } finally {
      setZipping(false);
    }
  };

  // Renders the ACTUAL letterhead design with the first selected intern's
  // real data merged in — same merge pipeline as Generate, nothing saved.
  const handlePreview = async () => {
    const intern = selectedInterns[0];
    if (!intern || !template) return;
    const fallbackDate = intern.internship_start_date
      ? new Date(intern.internship_start_date).toLocaleDateString("en-GB").replace(/\//g, ".")
      : "";
    const previewTab = window.open("", "_blank");
    setPreviewing(true);
    setError("");
    try {
      const { data } = await client.post(
        "/api/documents/generate/intern-offer/preview/",
        {
          template_id: template.document_template_id,
          intern_id: intern.intern_id,
          field_values: {
            role,
            department,
            location,
            effective_date: effectiveDate || fallbackDate,
            stipend,
            letter_content: templateNeedsContentStep ? letterContent : "",
          },
        },
        { responseType: "blob" }
      );
      if (previewTab) previewTab.location.href = URL.createObjectURL(data);
    } catch {
      if (previewTab) previewTab.close();
      setError("Couldn't render the preview — check that Role/Department/Location/Effective/Stipend are filled in.");
    } finally {
      setPreviewing(false);
    }
  };

  // See CourseInternshipOfferLetter.jsx for why this matters: a template
  // with its own baked-in body (no "{{content}}" marker) doesn't want
  // this page's Content step text appended after it too.
  const templateNeedsContentStep = !template || (template.placeholders || []).includes("content");

  const showStep2 = Boolean(selectedBatch);
  const showStep3plus = internIds.length > 0;

  return (
    <div className="doc-screen">
      <div className="doc-head">
        <div>
          <span className="doc-eyebrow">Document Generator</span>
          <h1>Intern Onboarding Offer Letter</h1>
          <p>Pick who's being onboarded as a paid intern, and generate.</p>
        </div>
        <button type="button" className="doc-btn-sm" onClick={() => navigate("/documents/ai-generator")}>
          <ArrowLeft size={14} />
          Back
        </button>
      </div>

      {templateError && <div className="doc-error">{templateError}</div>}
      {error && <div className="doc-error">{error}</div>}

      <div className="doc-step-panel">
        <h3 className="doc-step-title">1. Choose a batch</h3>
        <div className="doc-form">
          <SearchSelect
            options={batches.map((b) => ({ value: b.batch_name, label: batchLabel(b) }))}
            value={selectedBatch}
            onChange={handleBatchSelect}
            placeholder="Select a batch…"
          />
        </div>
      </div>

      {showStep2 && (
        <div className="doc-step-panel">
          <h3 className="doc-step-title">2. Generate for</h3>
          <div className="doc-step-search">
            <Search size={14} />
            <input
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search active interns by name…"
            />
          </div>
          <div className="doc-step-checklist">
            {visibleInterns.length === 0 ? (
              <p className="doc-empty">No active interns match in this batch.</p>
            ) : (
              visibleInterns.map((i) => (
                <label key={i.intern_id} className="doc-step-check-row">
                  <input
                    type="checkbox"
                    checked={internIds.includes(i.intern_id)}
                    onChange={() => toggleIntern(i.intern_id)}
                  />
                  {i.full_name}
                  <span className="doc-step-check-meta" style={{ marginLeft: "auto" }}>{i.intern_code}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      {showStep3plus && (
        <div className="doc-step-panel">
          <h3 className="doc-step-title">3. Offer details</h3>
          <div className="doc-form">
            <label>Role</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Junior Developer" required />

            <label>Department</label>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Development" required />

            <label>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Remote" required />

            <label>Effective from</label>
            <input
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              placeholder="e.g. 24.06.2026 — leave blank to use each intern's own start date"
            />

            <label>Stipend</label>
            <input value={stipend} onChange={(e) => setStipend(e.target.value)} placeholder="e.g. INR 2000" required />
          </div>
        </div>
      )}

      {showStep3plus && (
        <div className="doc-step-panel">
          <h3 className="doc-step-title">4. Template</h3>

          <div className="doc-form">
            <SearchSelect
              options={templateOptions.map((t) => ({ value: t.document_template_id, label: t.template_name, code: t.template_code }))}
              value={template?.document_template_id || ""}
              onChange={handleTemplateSelect}
              placeholder="Search or select a template…"
            />
          </div>

          <div className="doc-upload-row" style={{ marginTop: 10 }}>
            <button type="button" className="doc-btn-sm" onClick={handleTemplateUploadClick} disabled={uploading}>
              {uploading ? <Loader2 size={14} className="doc-spin" /> : <UploadCloud size={14} />}
              {uploading ? "Uploading…" : "+ Add new template"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf,.txt"
              onChange={handleTemplateFileChange}
              style={{ display: "none" }}
            />
            <span className="doc-upload-hint">
              {customTemplateName
                ? `Using: ${customTemplateName}`
                : template
                ? `Using: ${template.template_name}`
                : "No template selected yet."}
            </span>
          </div>
          {uploadError && <div className="doc-error">{uploadError}</div>}
        </div>
      )}

      {showStep3plus && templateNeedsContentStep && (
        <div className="doc-step-panel">
          <h3 className="doc-step-title">5. Content</h3>
          <RichTextEditor content={letterContent} onChange={setLetterContent} />
        </div>
      )}
      {showStep3plus && !templateNeedsContentStep && (
        <p className="doc-upload-hint" style={{ marginTop: -6 }}>
          This template's letter body is already fully written into its design — nothing to fill in here.
        </p>
      )}

      {showStep3plus && (
        <div className="doc-step-actions">
          <button
            type="button"
            className="doc-btn-sm"
            onClick={handlePreview}
            disabled={previewing || selectedInterns.length === 0 || !template}
          >
            {previewing ? "Rendering…" : "Preview"}
          </button>
          <button type="button" className="doc-btn-sm" onClick={() => navigate("/documents/ai-generator")}>
            Cancel
          </button>
          <button type="button" className="doc-btn-accent" onClick={handleGenerate} disabled={generating || !template}>
            {generating ? "Generating…" : `Generate (${internIds.length})`}
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div className="doc-panel" style={{ marginTop: 20 }}>
          <div className="doc-panel-body">
            {results.filter((r) => r.ok).length > 1 && (
              <div className="doc-bulk-result-row" style={{ borderTop: "none", paddingTop: 0 }}>
                <span style={{ flex: 1, fontWeight: 700, color: "#3a4152" }}>
                  {results.filter((r) => r.ok).length} letters generated
                </span>
                <button type="button" className="doc-btn-accent" onClick={handleDownloadZip} disabled={zipping}>
                  {zipping ? <Loader2 size={14} className="doc-spin" /> : <FolderArchive size={14} />}
                  {zipping ? "Zipping…" : "Download all as ZIP"}
                </button>
              </div>
            )}
            {results.map((r) => {
              const isRegenerating = regeneratingId === r.intern.intern_id;
              return (
                <div key={r.intern.intern_id} className="doc-bulk-result-row">
                  <span style={{ flex: 1 }}>{r.intern.full_name}</span>
                  {r.ok && (
                    <>
                      <button type="button" className="doc-btn-sm" onClick={() => handleView(r.document_id)}>
                        <Eye size={14} /> View
                      </button>
                      <button
                        type="button"
                        className="doc-btn-accent"
                        onClick={() => handleDownload(r.document_id, r.intern.full_name)}
                      >
                        <Download size={14} /> Download
                      </button>
                    </>
                  )}
                  {!r.ok && <span className="doc-error" style={{ margin: 0 }}>{r.message}</span>}
                  <button
                    type="button"
                    className="doc-btn-sm"
                    title="Changed a field? Regenerate this one."
                    onClick={() => handleRegenerate(r.intern)}
                    disabled={isRegenerating}
                  >
                    <RefreshCw size={14} className={isRegenerating ? "doc-spin" : ""} />
                    {isRegenerating ? "Regenerating…" : "Regenerate"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default InternOnboardingOfferLetter;
