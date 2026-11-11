import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Upload, FileCheck2, Hourglass, BadgeCheck, Handshake, ExternalLink, Check, X } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const APPROVAL_CHIP = { PENDING: "orange", APPROVED: "green", REJECTED: "red" };
const TYPES = [
  { value: "DESIGN_APPROVAL", label: "Design Approval" },
  { value: "CONTRACT", label: "Contract" },
  { value: "UAT_SIGNOFF", label: "UAT Sign-off" },
  { value: "OTHER", label: "Other" },
];
const typeLabel = (v) => TYPES.find((t) => t.value === v)?.label || (v || "").replace(/_/g, " ");

function ApprovalDocuments() {
  const { projectId } = useParams();
  const [documents, setDocuments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(null);
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [relationshipType, setRelationshipType] = useState("OTHER");
  const [approver, setApprover] = useState("");
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchDocuments = () =>
    client.get(`/api/projects/${projectId}/documents/`)
      .then(({ data }) => setDocuments(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load documents."))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchDocuments();
    client.get(`/api/projects/${projectId}/team/`).then(({ data }) => setTeamMembers(data)).catch(() => {});
    client.get("/api/projects/me/").then(({ data }) => setProject(data.find((p) => String(p.project_id) === String(projectId)) || null)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const uploadDocument = async () => {
    if (!file || !title.trim()) {
      setFormError("A file and a title are required.");
      return;
    }
    setUploading(true);
    setFormError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_title", title);
      formData.append("relationship_type", relationshipType);
      // The upload API expects the approver's user_id (DocumentApproval.approver_user).
      if (approver) formData.append("approver_user_id", approver);
      await client.post(`/api/projects/${projectId}/documents/upload/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("Document uploaded.");
      setFile(null); setTitle(""); setRelationshipType("OTHER"); setApprover("");
      setShowForm(false);
      fetchDocuments();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't upload document.");
    } finally {
      setUploading(false);
    }
  };

  const actOnApproval = async (approvalId, status) => {
    setBusy(`a${approvalId}`);
    setError("");
    try {
      await client.patch(`/api/projects/document-approvals/${approvalId}/`, { approval_status: status });
      setMessage(status === "APPROVED" ? "Approved." : "Rejected.");
      fetchDocuments();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't update approval.");
    } finally {
      setBusy(null);
    }
  };

  const markClientApproved = async (documentId) => {
    setBusy(`c${documentId}`);
    setError("");
    try {
      await client.post(`/api/projects/documents/${documentId}/client-approve/`);
      setMessage("Marked as approved by client.");
      fetchDocuments();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't mark as approved by client.");
    } finally {
      setBusy(null);
    }
  };

  const approvals = documents.flatMap((d) => d.approvals || []);
  const pendingInternal = approvals.filter((a) => a.approval_status === "PENDING").length;
  const clientSigned = documents.filter((d) => d.client_approved).length;

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        eyebrow="Client Management"
        section="Approval Documents"
        title={project ? `${project.project_name} Approvals` : "Approval Documents"}
        subtitle="Internal sign-off from the team, then client sign-off once you've shown it to them."
        back="/clients/approval-documents"
        backLabel="All projects"
      >
        <button type="button" className="bp-btn navy" onClick={() => { setShowForm(true); setFormError(""); }}><Upload size={16} /> Upload Document</button>
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">DOCUMENTS</p><span className="pm-ico navy"><FileCheck2 size={20} /></span></div>
          <p className="bp-stat-value">{documents.length}</p>
          <p className="pm-foot"><span>On this project</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">INTERNAL PENDING</p><span className="pm-ico orange"><Hourglass size={20} /></span></div>
          <p className="bp-stat-value tr-orange">{pendingInternal}</p>
          <p className="pm-foot"><span>{approvals.length} approvals requested</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">CLIENT SIGNED</p><span className="pm-ico green"><Handshake size={20} /></span></div>
          <p className="bp-stat-value">{clientSigned}</p>
          <p className="pm-foot"><span>{documents.length - clientSigned} awaiting client</span></p>
        </div>
      </div>

      {loading ? (
        <p className="bp-loading">Loading documents…</p>
      ) : documents.length === 0 ? (
        <p className="bp-panel pm-empty-panel">No documents uploaded yet.</p>
      ) : (
        <div className="pm-list">
          {documents.map((d, idx) => (
            <article key={d.document_project_id} className="bp-panel pm-item" style={{ "--i": idx }}>
              <div className="pm-item-top">
                <div className="pm-spec">
                  <span className="pm-spec-ico"><FileCheck2 size={16} /></span>
                  <div><b>{d.document_title}</b><small>{typeLabel(d.relationship_type)}</small></div>
                </div>
                {d.current_version_url && <a className="bp-btn outline small" href={d.current_version_url} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Open</a>}
              </div>

              <div className="pm-approvals">
                <p className="pm-section-label">Internal approval</p>
                {(d.approvals || []).length === 0 ? (
                  <p className="bp-muted pm-small">No approval requested</p>
                ) : d.approvals.map((a) => (
                  <div key={a.document_approval_id} className="pm-approval-row">
                    <span className={`bp-chip ${APPROVAL_CHIP[a.approval_status] || "orange"}`}>{a.approval_status}</span>
                    {a.comments && <small className="bp-muted">{a.comments}</small>}
                    {a.approval_status === "PENDING" && a.approver_user === currentUser?.user_id && (
                      <span className="pm-row-actions">
                        <button type="button" className="bp-btn outline small" disabled={busy === `a${a.document_approval_id}`} onClick={() => actOnApproval(a.document_approval_id, "REJECTED")}><X size={12} /> Reject</button>
                        <button type="button" className="bp-btn navy small" disabled={busy === `a${a.document_approval_id}`} onClick={() => actOnApproval(a.document_approval_id, "APPROVED")}><Check size={12} /> Approve</button>
                      </span>
                    )}
                    {a.approval_status === "PENDING" && a.approver_user !== currentUser?.user_id && <small className="bp-muted">Waiting for the approver</small>}
                  </div>
                ))}
              </div>

              <div className="pm-item-foot">
                {d.client_approved ? (
                  <span className="pm-ok"><BadgeCheck size={13} /> Approved by client — marked by {d.client_approved_by || "—"} on {new Date(d.client_approved_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
                ) : (
                  <>
                    <span>Not yet approved by the client</span>
                    <button type="button" className="bp-btn navy small" disabled={busy === `c${d.document}`} onClick={() => markClientApproved(d.document)}><Handshake size={12} /> Mark as Approved by Client</button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <div className="bp-modal-backdrop" onClick={() => !uploading && setShowForm(false)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Upload Document</h2>
            <p className="bp-sub">Upload something that needs sign-off and pick who approves it internally.</p>
            <div className="bp-form-grid">
              <label className="bp-field full"><span>File</span>
                <input type="file" onChange={(e) => setFile(e.target.files[0])} />
              </label>
              <label className="bp-field full"><span>Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="bp-field"><span>Type</span>
                <select value={relationshipType} onChange={(e) => setRelationshipType(e.target.value)}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="bp-field"><span>Internal approver</span>
                <select value={approver} onChange={(e) => setApprover(e.target.value)}>
                  <option value="">No approval needed</option>
                  {teamMembers.map((m) => <option key={m.project_team_member_id} value={m.user_id}>{m.name}</option>)}
                </select>
              </label>
            </div>
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setShowForm(false)} disabled={uploading}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={uploadDocument} disabled={uploading}>{uploading ? "Uploading…" : "Upload"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalDocuments;
