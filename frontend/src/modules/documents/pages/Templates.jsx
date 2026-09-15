import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, FileText, Power, Eye, Plus, Download } from "lucide-react";
import client from "../../../api/client";
import "../styles/Documents.css";

function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    client
      .get("/api/documents/templates/manage/")
      .then(({ data }) => setTemplates(data))
      .catch(() => setError("Couldn't load templates."))
      .finally(() => setLoading(false));
  }, []);

  const visibleTemplates = templates.filter((t) => {
    const q = search.toLowerCase();
    return t.template_name.toLowerCase().includes(q) || t.template_code.toLowerCase().includes(q);
  });

  const handleDownload = async (event, template) => {
    event.stopPropagation();
    setDownloadingId(template.document_template_id);
    try {
      const { data } = await client.get(
        `/api/documents/templates/${template.document_template_id}/download/`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${template.template_code}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't download that template.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleToggle = async (event, template) => {
    event.stopPropagation();
    setTogglingId(template.document_template_id);
    try {
      const { data } = await client.patch(`/api/documents/templates/${template.document_template_id}/toggle/`);
      setTemplates((prev) =>
        prev.map((t) => (t.document_template_id === data.document_template_id ? data : t))
      );
    } catch {
      setError("Couldn't update that template.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="doc-screen">
      <div className="doc-head">
        <div>
          <span className="doc-eyebrow">Document Generator</span>
          <h1>Template Manager</h1>
          <p>Reusable letterhead designs used by the AI Document Generator.</p>
        </div>
        <div className="doc-toolbar">
          <Link to="/documents/templates/new" className="doc-btn-accent">
            <Plus size={14} />
            New Template
          </Link>
        </div>
      </div>

      {error && <div className="doc-error">{error}</div>}

      <div className="doc-panel">
        <div className="doc-filter-bar">
          <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8a93a6" }} />
            <input
              type="text"
              placeholder="Search by name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", paddingLeft: 30 }}
            />
          </div>
        </div>

        {loading ? (
          <p className="doc-empty">Loading…</p>
        ) : visibleTemplates.length === 0 ? (
          <p className="doc-empty">No templates match your search.</p>
        ) : (
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Format</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleTemplates.map((t) => (
                  <tr
                    key={t.document_template_id}
                    onClick={() => navigate(`/documents/templates/${t.document_template_id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <div className="doc-table-title">
                        <FileText size={15} color="#8a93a6" />
                        {t.template_name}
                      </div>
                    </td>
                    <td>{t.template_code}</td>
                    <td>{t.document_type_name || "—"}</td>
                    <td>{t.template_format}</td>
                    <td>
                      <span className={`doc-badge ${t.is_active ? "approved" : "draft"}`}>
                        {t.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="doc-btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/documents/templates/${t.document_template_id}`);
                          }}
                          title="View"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        <button
                          type="button"
                          className="doc-btn-sm"
                          onClick={(e) => handleToggle(e, t)}
                          disabled={togglingId === t.document_template_id}
                          title={t.is_active ? "Deactivate" : "Activate"}
                        >
                          <Power size={14} />
                          {togglingId === t.document_template_id ? "…" : t.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="doc-btn-sm"
                          onClick={(e) => handleDownload(e, t)}
                          disabled={downloadingId === t.document_template_id}
                          title="Download as DOCX"
                        >
                          <Download size={14} />
                          {downloadingId === t.document_template_id ? "…" : "Download"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Templates;
