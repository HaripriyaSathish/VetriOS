import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Upload, FileText, Link2, ExternalLink, ShieldCheck, Hourglass, Search, ChevronDown, FileCheck2 } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const STATUS_CHIP = { ACTIVE: "green", ARCHIVED: "gray" };
const APPROVAL_CHIP = { PENDING: "orange", APPROVED: "green", REJECTED: "red" };

const RELATIONSHIP_TYPES = [
  { value: "REQUIREMENT_DOC", label: "Requirement Document" },
  { value: "SEO_CONTENT", label: "SEO Content" },
  { value: "DESIGN_ASSET", label: "Design Asset" },
  { value: "REPORT", label: "Report" },
  { value: "OTHER", label: "Other" },
];
const typeLabel = (v) => RELATIONSHIP_TYPES.find((r) => r.value === v)?.label || v;

function ProjectDocuments() {
  const { projectId } = useParams();
  const [documents, setDocuments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [uploadMode, setUploadMode] = useState("file"); // "file" | "link"
  const [file, setFile] = useState(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [title, setTitle] = useState("");
  const [relationshipType, setRelationshipType] = useState("OTHER");
  const [approverId, setApproverId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchDocuments = () =>
    client.get(`/api/projects/${projectId}/documents/`)
      .then(({ data }) => setDocuments(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load documents."))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchDocuments();
    client.get("/api/projects/users-lookup/").then(({ data }) => setAllUsers(data)).catch(() => {});
    client.get("/api/projects/me/").then(({ data }) => setProject(data.find((p) => String(p.project_id) === String(projectId)) || null)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const uploadDocument = async () => {
    if (uploadMode === "file" && !file) {
      setFormError("Please choose a file to upload.");
      return;
    }
    if (uploadMode === "link" && !linkUrl.trim()) {
      setFormError("Please enter a link.");
      return;
    }
    setUploading(true);
    setFormError("");
    try {
      const formData = new FormData();
      if (uploadMode === "file") formData.append("file", file);
      else formData.append("external_url", linkUrl);
      formData.append("document_title", title || (uploadMode === "file" ? file.name : linkUrl));
      formData.append("relationship_type", relationshipType);
      if (approverId) formData.append("approver_user_id", approverId);
      await client.post(`/api/projects/${projectId}/documents/upload/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(uploadMode === "file" ? "Document uploaded." : "Link added.");
      setFile(null); setLinkUrl(""); setTitle(""); setRelationshipType("OTHER"); setApproverId("");
      setShowForm(false);
      fetchDocuments();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't upload document.");
    } finally {
      setUploading(false);
    }
  };

  const approvals = documents.flatMap((d) => d.approvals || []);
  const pending = approvals.filter((a) => a.approval_status === "PENDING").length;
  const approved = approvals.filter((a) => a.approval_status === "APPROVED").length;
  const visible = useMemo(() => documents.filter((d) => {
    if (typeFilter && d.relationship_type !== typeFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || (d.document_title || "").toLowerCase().includes(q);
  }), [documents, search, typeFilter]);

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        section="Project Documents"
        title={project ? `${project.project_name} Documents` : "Project Documents"}
        subtitle="Any team member can upload — SEO content, requirement docs, reports, design links, and more."
        back="/project/documents"
        backLabel="All projects"
      >
        <Link to={`/project/${projectId}/approval-documents`} className="bp-btn outline"><FileCheck2 size={16} /> Approval Documents</Link>
        <button type="button" className="bp-btn navy" onClick={() => { setShowForm(true); setFormError(""); }}><Upload size={16} /> Upload Document</button>
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">DOCUMENTS</p><span className="pm-ico navy"><FileText size={20} /></span></div>
          <p className="bp-stat-value">{documents.length}</p>
          <p className="pm-foot"><span>{new Set(documents.map((d) => d.relationship_type)).size} types</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">AWAITING APPROVAL</p><span className="pm-ico orange"><Hourglass size={20} /></span></div>
          <p className="bp-stat-value tr-orange">{pending}</p>
          <p className="pm-foot"><span>Pending approvals</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">APPROVED</p><span className="pm-ico green"><ShieldCheck size={20} /></span></div>
          <p className="bp-stat-value">{approved}</p>
          <p className="pm-foot"><span>{approvals.length} approvals requested</span></p>
        </div>
      </div>

      <section className="bp-panel">
        <div className="pm-toolbar pm-toolbar-flat">
          <h3 className="pm-panel-title">Document Register</h3>
          <div className="pm-toolbar-right">
            <label className="bp-search">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…" />
            </label>
            <label className="bp-select">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All types</option>
                {RELATIONSHIP_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </div>
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead><tr><th>Document</th><th>Type</th><th>Status</th><th>Approvals</th><th style={{ textAlign: "right" }}>Action</th></tr></thead>
            <tbody>
              {loading && <tr className="bp-empty-row"><td colSpan={5}>Loading documents…</td></tr>}
              {!loading && visible.length === 0 && <tr className="bp-empty-row"><td colSpan={5}>{documents.length ? "No documents match these filters." : "No documents uploaded yet."}</td></tr>}
              {visible.map((d, idx) => (
                <tr key={d.document_project_id} style={{ "--row": idx }}>
                  <td>
                    <div className="pm-spec">
                      <span className="pm-spec-ico"><FileText size={16} /></span>
                      <b>{d.document_title}</b>
                    </div>
                  </td>
                  <td><span className="pm-area">{typeLabel(d.relationship_type)}</span></td>
                  <td><span className={`bp-chip ${STATUS_CHIP[d.document_status] || "blue"}`}>{d.document_status}</span></td>
                  <td>
                    {d.approvals?.length ? (
                      <div className="pm-tags">
                        {d.approvals.map((a) => <span key={a.document_approval_id} className={`bp-chip ${APPROVAL_CHIP[a.approval_status] || "orange"}`}>{a.approval_status}</span>)}
                      </div>
                    ) : <span className="bp-muted">Not requested</span>}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {d.current_version_url
                      ? <a className="pm-inspect" href={d.current_version_url} target="_blank" rel="noreferrer">Open <ExternalLink size={13} /></a>
                      : <span className="bp-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <div className="bp-modal-backdrop" onClick={() => !uploading && setShowForm(false)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Document or Link</h2>
            <p className="bp-sub">Upload a file or register a link, and optionally request someone&apos;s approval.</p>
            <div className="bp-tabs pm-mode-tabs">
              <button type="button" className={`bp-tab ${uploadMode === "file" ? "active" : ""}`} onClick={() => setUploadMode("file")}><Upload size={13} /> Upload File</button>
              <button type="button" className={`bp-tab ${uploadMode === "link" ? "active" : ""}`} onClick={() => setUploadMode("link")}><Link2 size={13} /> Add Link</button>
            </div>
            <div className="bp-form-grid">
              {uploadMode === "file" ? (
                <label className="bp-field full"><span>File</span>
                  <input type="file" onChange={(e) => setFile(e.target.files[0])} />
                </label>
              ) : (
                <label className="bp-field full"><span>Link</span>
                  <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://figma.com/… or any link" />
                </label>
              )}
              <label className="bp-field full"><span>Title (optional)</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the file name or link" />
              </label>
              <label className="bp-field"><span>Type</span>
                <select value={relationshipType} onChange={(e) => setRelationshipType(e.target.value)}>
                  {RELATIONSHIP_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
              <label className="bp-field"><span>Approval</span>
                <select value={approverId} onChange={(e) => setApproverId(e.target.value)}>
                  <option value="">No approval needed</option>
                  {allUsers.map((u) => <option key={u.user_id} value={u.user_id}>Request: {u.name}</option>)}
                </select>
              </label>
            </div>
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setShowForm(false)} disabled={uploading}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={uploadDocument} disabled={uploading}>
                {uploading ? "Saving…" : uploadMode === "file" ? "Upload Document" : "Add Link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectDocuments;
