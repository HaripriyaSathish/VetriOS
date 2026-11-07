import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, FileText, Power, Eye, Plus, Download, Trash2, LayoutTemplate, CircleCheck, CircleOff } from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../styles/Documents.css";
import "../styles/DocumentLibrary.css";

const canHardDelete = (JSON.parse(localStorage.getItem("user") || "null")?.roles || []).some(
  (r) => r === "System Administrator" || r === "HR Administrator"
);

function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [togglingId, setTogglingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    client
      .get("/api/documents/templates/manage/")
      .then(({ data }) => setTemplates(data))
      .catch(() => setError("Couldn't load templates."))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = templates.filter((t) => t.is_active).length;
  const inactiveCount = templates.length - activeCount;

  const visibleTemplates = templates.filter((t) => {
    const q = search.toLowerCase();
    if (statusFilter === "active" && !t.is_active) return false;
    if (statusFilter === "inactive" && t.is_active) return false;
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

  const handleHardDelete = async (event, template) => {
    event.stopPropagation();
    if (!window.confirm(`Permanently delete "${template.template_name}" (${template.template_code})? This cannot be undone.`)) {
      return;
    }
    setDeletingId(template.document_template_id);
    try {
      await client.delete(`/api/documents/templates/${template.document_template_id}/hard-delete/`);
      setTemplates((prev) => prev.filter((t) => t.document_template_id !== template.document_template_id));
    } catch {
      setError("Couldn't delete that template.");
    } finally {
      setDeletingId(null);
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

  const cards = [
    { key: "all", label: "All templates", value: templates.length, tone: "blue", Icon: LayoutTemplate },
    { key: "active", label: "Active", value: activeCount, tone: "green", Icon: CircleCheck },
    { key: "inactive", label: "Inactive", value: inactiveCount, tone: "grey", Icon: CircleOff },
  ];

  return (
    <div className="bp-page dl-page dl2 tpl2">
      <div className="dl2-ban">
        <div className="dl2-ban-top">
          <div>
            <h1>Template manager</h1>
            <p>Reusable letterhead designs used by the document generator.</p>
          </div>
          <div className="dl2-ban-actions">
            <Link to="/documents/templates/new" className="dl2-new">
              <Plus size={15} /> New template
            </Link>
          </div>
        </div>
      </div>

      <div className="dl2-body">
        {error && <div className="doc-error">{error}</div>}

        <div className="dl2-cards">
          {cards.map(({ key, label, value, tone, Icon }) => (
            <button
              key={key}
              type="button"
              className={`dl2-card tone-${tone}${statusFilter === key ? " selected" : ""}`}
              onClick={() => setStatusFilter(key)}
            >
              <span className="dl2-card-top">
                <span className="dl2-card-icon"><Icon size={17} /></span>
                <b>{loading ? "-" : value}</b>
              </span>
              <span className="dl2-card-label"><span>{label}</span></span>
            </button>
          ))}
        </div>

        <div className="dl2-panel dl2-table">
          <div className="dl2-bar">
            <label className="dl2-search">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search by name or code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="dl2-seg">
              {[["all", "All"], ["active", "Active"], ["inactive", "Inactive"]].map(([key, label]) => (
                <button key={key} type="button" className={statusFilter === key ? "on" : ""} onClick={() => setStatusFilter(key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="doc-empty">Loading…</p>
          ) : visibleTemplates.length === 0 ? (
            <p className="doc-empty">No templates match your search.</p>
          ) : (
            <div className="bp-table-wrap">
              <table className="bp-table">
                <thead>
                  <tr>
                    <th>Template</th>
                    <th>Type</th>
                    <th>Format</th>
                    <th>Status</th>
                    <th>Actions</th>
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
                        <div className="dl2-title">
                          <span className="dl2-ficon"><FileText size={17} /></span>
                          <div>
                            <b title={t.template_name}><span>{t.template_name}</span></b>
                            <small>{t.template_code}</small>
                          </div>
                        </div>
                      </td>
                      <td>{t.document_type_name ? <span className="dl-tag orange">{t.document_type_name}</span> : "—"}</td>
                      <td><span className="tpl2-fmt">{t.template_format}</span></td>
                      <td>
                        <span className={`dl2-pill ${t.is_active ? "green" : "gray"}`}>{t.is_active ? "Active" : "Inactive"}</span>
                      </td>
                      <td>
                        <div className="tpl2-actions">
                          <button
                            type="button"
                            className="view"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/documents/templates/${t.document_template_id}`);
                            }}
                            title="View"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="power"
                            onClick={(e) => handleToggle(e, t)}
                            disabled={togglingId === t.document_template_id}
                            title={t.is_active ? "Deactivate" : "Activate"}
                          >
                            <Power size={15} />
                          </button>
                          <button
                            type="button"
                            className="dl"
                            onClick={(e) => handleDownload(e, t)}
                            disabled={downloadingId === t.document_template_id}
                            title="Download as DOCX"
                          >
                            <Download size={15} />
                          </button>
                          {canHardDelete && (
                            <button
                              type="button"
                              className="del"
                              onClick={(e) => handleHardDelete(e, t)}
                              disabled={deletingId === t.document_template_id}
                              title="Delete permanently"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
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
    </div>
  );
}

export default Templates;
