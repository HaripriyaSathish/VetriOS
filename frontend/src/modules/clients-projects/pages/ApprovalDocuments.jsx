import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../../api/client";

const STATUS_STYLES = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

function ApprovalDocuments() {
  const { projectId } = useParams();
  const [documents, setDocuments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [relationshipType, setRelationshipType] = useState("OTHER");
  const [approver, setApprover] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = () => {
    setLoading(true);
    client.get(`/api/projects/${projectId}/documents/`)
      .then(({ data }) => setDocuments(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load documents."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    client.get(`/api/projects/${projectId}/team/`)
      .then(({ data }) => setTeamMembers(data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const uploadDocument = async () => {
    if (!file || !title.trim()) {
      setError("A file and a title are required.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_title", title);
      formData.append("relationship_type", relationshipType);
      if (approver) formData.append("approver_user_id", approver);

      await client.post(`/api/projects/${projectId}/documents/upload/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("Document uploaded.");
      setFile(null); setTitle(""); setRelationshipType("OTHER"); setApprover("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't upload document.");
    } finally {
      setUploading(false);
    }
  };

  const actOnApproval = async (approvalId, status) => {
    try {
      await client.patch(`/api/projects/document-approvals/${approvalId}/`, {
        approval_status: status,
      });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't update approval.");
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/clients/approval-documents" className="text-sm text-blue-600 hover:underline">
        ← Back to Projects
      </Link>

      <div className="flex justify-between items-center mt-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Approval Documents</h1>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
        >
          {showForm ? "Cancel" : "+ Upload Document"}
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Upload Document</h3>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full text-sm mb-3"
          />
          <input
            placeholder="Document title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <select
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          >
            <option value="DESIGN_APPROVAL">Design Approval</option>
            <option value="CONTRACT">Contract</option>
            <option value="UAT_SIGNOFF">UAT Sign-off</option>
            <option value="OTHER">Other</option>
          </select>
          <select
            value={approver}
            onChange={(e) => setApprover(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
          >
            <option value="">No approval needed</option>
            {teamMembers.map((m) => (
              <option key={m.project_team_member_id} value={m.project_team_member_id}>
                Request approval from {m.name}
              </option>
            ))}
          </select>
          <button
            onClick={uploadDocument}
            disabled={uploading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No documents uploaded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((d) => (
            <div key={d.document_project_id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="font-medium text-gray-900">{d.document_title}</p>
                <span className="text-xs text-gray-600">{d.relationship_type}</span>
              </div>
              {d.approvals.length === 0 ? (
                <p className="text-xs text-gray-500">No approval requested</p>
              ) : (
                d.approvals.map((a) => (
                  <div key={a.document_approval_id} className="flex items-center justify-between mt-2 border-t border-gray-100 pt-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[a.approval_status] || STATUS_STYLES.PENDING}`}>
                      {a.approval_status}
                    </span>
                    {a.approval_status === "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => actOnApproval(a.document_approval_id, "APPROVED")}
                          className="text-xs font-semibold text-green-700 hover:text-green-900"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => actOnApproval(a.document_approval_id, "REJECTED")}
                          className="text-xs font-semibold text-red-700 hover:text-red-900"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ApprovalDocuments;