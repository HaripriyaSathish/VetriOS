import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../../api/client";

const STATUS_STYLES = {
  ACTIVE: "bg-green-100 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-600",
};

const APPROVAL_STYLES = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const RELATIONSHIP_TYPES = [
  { value: "REQUIREMENT_DOC", label: "Requirement Document" },
  { value: "SEO_CONTENT", label: "SEO Content" },
  { value: "DESIGN_ASSET", label: "Design Asset" },
  { value: "REPORT", label: "Report" },
  { value: "OTHER", label: "Other" },
];

function ProjectDocuments() {
  const { projectId } = useParams();
  const [documents, setDocuments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [uploadMode, setUploadMode] = useState("file"); // "file" | "link"
  const [file, setFile] = useState(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [title, setTitle] = useState("");
  const [relationshipType, setRelationshipType] = useState("OTHER");
  const [approverId, setApproverId] = useState("");
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
    client.get('/api/projects/users-lookup/')
      .then(({ data }) => setAllUsers(data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const uploadDocument = async () => {
    if (uploadMode === "file" && !file) {
      setError("Please choose a file to upload.");
      return;
    }
    if (uploadMode === "link" && !linkUrl.trim()) {
      setError("Please enter a link.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      if (uploadMode === "file") {
        formData.append("file", file);
      } else {
        formData.append("external_url", linkUrl);
      }
      formData.append("document_title", title || (uploadMode === "file" ? file.name : linkUrl));
      formData.append("relationship_type", relationshipType);
      if (approverId) formData.append("approver_user_id", approverId);

      await client.post(`/api/projects/${projectId}/documents/upload/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(uploadMode === "file" ? "Document uploaded." : "Link added.");
      setFile(null); setLinkUrl(""); setTitle(""); setRelationshipType("OTHER"); setApproverId("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't upload document.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/project/dashboard" className="text-sm text-blue-600 hover:underline">
        ← Back to Projects
      </Link>

      <div className="flex justify-between items-center mt-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Project Documents</h1>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
        >
          {showForm ? "Cancel" : "+ Upload Document"}
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Any team member can upload — SEO content, requirement docs, reports, design links, and more.
      </p>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Add Document or Link</h3>

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setUploadMode("file")}
              className={`text-xs px-3 py-1.5 rounded-md font-semibold ${uploadMode === "file" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setUploadMode("link")}
              className={`text-xs px-3 py-1.5 rounded-md font-semibold ${uploadMode === "link" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              Add Link
            </button>
          </div>

          {uploadMode === "file" ? (
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
            />
          ) : (
            <input
              type="url"
              placeholder="https://figma.com/... or any link"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
            />
          )}

          <input
            placeholder="Title (optional — defaults to filename or link)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />

          <div className="grid grid-cols-2 gap-3 mb-4">
            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {RELATIONSHIP_TYPES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            <select
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">No approval needed</option>
              {allUsers.map((u) => (
                <option key={u.user_id} value={u.user_id}>Request approval: {u.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={uploadDocument}
            disabled={uploading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {uploading ? "Saving…" : uploadMode === "file" ? "Upload Document" : "Add Link"}
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
                <div>
                  <p className="font-medium text-gray-900">{d.document_title}</p>
                  {d.current_version_url && (
                    <a
                      href={d.current_version_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Open →
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    {RELATIONSHIP_TYPES.find((r) => r.value === d.relationship_type)?.label || d.relationship_type}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[d.document_status] || STATUS_STYLES.ACTIVE}`}>
                    {d.document_status}
                  </span>
                </div>
              </div>

              {d.approvals && d.approvals.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {d.approvals.map((a) => (
                    <span
                      key={a.document_approval_id}
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${APPROVAL_STYLES[a.approval_status] || APPROVAL_STYLES.PENDING}`}
                    >
                      Approval: {a.approval_status}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectDocuments;