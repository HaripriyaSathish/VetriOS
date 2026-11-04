import { useEffect, useState } from "react";
import {
  Search, CloudUpload, History, Eye, Download, Archive, Copy, PenLine, FileWarning,
  LayoutGrid, List, RefreshCw, ChevronDown, FileText, ShieldCheck, Plus, Lock, ShieldAlert,
  ScrollText, GraduationCap, BookOpen, Handshake, FileBadge,
} from "lucide-react";
import { Link } from "react-router-dom";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../styles/DocumentLibrary.css";

const STATUS_LABEL = {
  DRAFT: "Draft", ACTIVE: "Active", UNDER_REVIEW: "Pending Review",
  APPROVED: "Approved", ARCHIVED: "Archived", RETIRED: "Retired", DELETED: "Deleted",
};
const STATUS_TONE = {
  DRAFT: "gray", ACTIVE: "green", UNDER_REVIEW: "orange",
  APPROVED: "green", ARCHIVED: "gray", RETIRED: "red", DELETED: "red",
};
const CONF_TONE = { PUBLIC: "green", INTERNAL: "blue", RESTRICTED: "orange", CONFIDENTIAL: "red", HIGHLY_CONFIDENTIAL: "red" };
const TAG_TONES = ["blue", "orange", "violet", "green"];

// Pick a card icon from the document's type/category name.
function iconFor(doc) {
  const name = `${doc.type_name} ${doc.category_name || ""}`.toLowerCase();
  if (/offer|letter|nda/.test(name)) return ScrollText;
  if (/certif|complet/.test(name)) return FileBadge;
  if (/syllab|curricul|course/.test(name)) return BookOpen;
  if (/agree|contract|legal|client/.test(name)) return Handshake;
  if (/policy|conduct|compliance/.test(name)) return ShieldCheck;
  if (/train|student|intern/.test(name)) return GraduationCap;
  return FileText;
}

function initials(name) {
  return (name || "?").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

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

const EMPTY_UPLOAD = { title: "", document_type_id: "", document_category_id: "", confidentiality_level_id: "", access_level_id: "", file: null };

// Trainers (Training workspace) see the Trainer Figma's "Course Materials"
// variant of this page: same library, list layout first.
function isTrainerView() {
  try {
    const roles = JSON.parse(localStorage.getItem("user") || "null")?.roles || [];
    return localStorage.getItem("active_workspace") === "training" && roles.includes("Employee") &&
      !roles.some((r) => ["Business Team", "System Administrator", "Manager"].includes(r));
  } catch {
    return false;
  }
}

function Library() {
  const [trainer] = useState(isTrainerView);
  const [documents, setDocuments] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ types: [], categories: [], confidentiality_levels: [], access_levels: [], statuses: [], owners: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [view, setView] = useState(() => (isTrainerView() ? "list" : "grid"));

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [confFilter, setConfFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");

  const [selected, setSelected] = useState(new Set());
  const [exporting, setExporting] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState(EMPTY_UPLOAD);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const loadStats = () => client.get("/api/documents/library/stats/").then(({ data }) => setStats(data)).catch(() => {});

  const loadDocuments = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (confFilter) params.confidentiality = confFilter;
      if (statusFilter) params.status = statusFilter;
      if (ownerFilter) params.owner = ownerFilter;
      const { data } = await client.get("/api/documents/library/", { params });
      setDocuments(data);
      setSelected(new Set());
    } catch (err) {
      setError("Couldn't load the document library.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    client.get("/api/documents/library/filters/").then(({ data }) => setFilterOptions(data)).catch(() => {});
    loadStats();
  }, []);

  useEffect(() => {
    const t = setTimeout(loadDocuments, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter, categoryFilter, confFilter, statusFilter, ownerFilter]);

  const allSelected = documents.length > 0 && selected.size === documents.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(documents.map((d) => d.document_id)));
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleView = async (doc) => {
    const viewerTab = window.open("", "_blank");
    try {
      const { data } = await client.get(`/api/documents/library/${doc.document_id}/file/`, {
        params: { inline: 1 }, responseType: "blob",
      });
      if (viewerTab) viewerTab.location.href = URL.createObjectURL(data);
    } catch (err) {
      if (viewerTab) viewerTab.close();
      setError("Couldn't open that file.");
    }
  };

  const handleDownload = async (doc) => {
    try {
      const { data } = await client.get(`/api/documents/library/${doc.document_id}/file/`, { responseType: "blob" });
      triggerBlobDownload(data, doc.title);
    } catch (err) {
      setError("Couldn't download that file.");
    }
  };

  const handleBulkExport = async () => {
    setExporting(true);
    setError("");
    try {
      const { data } = await client.post(
        "/api/documents/library/bulk-export/",
        { document_ids: [...selected] },
        { responseType: "blob" }
      );
      triggerBlobDownload(data, "documents.zip");
    } catch (err) {
      setError("Couldn't export the selected documents.");
    } finally {
      setExporting(false);
    }
  };

  const openUpload = () => {
    setUploadForm(EMPTY_UPLOAD);
    setUploadError("");
    setUploadOpen(true);
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!uploadForm.file) {
      setUploadError("Choose a file to upload.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.append("title", uploadForm.title);
      body.append("document_type_id", uploadForm.document_type_id);
      if (uploadForm.document_category_id) body.append("document_category_id", uploadForm.document_category_id);
      body.append("confidentiality_level_id", uploadForm.confidentiality_level_id);
      body.append("access_level_id", uploadForm.confidentiality_level_id);
      body.append("file", uploadForm.file);
      await client.post("/api/documents/library/upload/", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadOpen(false);
      loadDocuments();
      loadStats();
    } catch (err) {
      const data = err.response?.data;
      setUploadError(
        data ? Object.values(data).flat().join(" ") : "Upload failed."
      );
    } finally {
      setUploading(false);
    }
  };

  const activeRate = stats?.total ? Math.round((stats.active / stats.total) * 100) : 0;
  const categoryTone = (name) => {
    const idx = filterOptions.categories.findIndex((c) => c.category_name === name);
    return TAG_TONES[(idx < 0 ? 0 : idx) % TAG_TONES.length];
  };
  const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="bp-page dl-page">
      <div className="bp-head">
        <div>
          <p className="dl-kicker"><span className="bp-chip blue">{trainer ? "Trainer Workspace" : "Document Control"}</span> / {trainer ? "Document Library" : "Business Operations"}</p>
          <h1 className="bp-title dl-title">{trainer ? "Course Materials & Academic Assets" : "Document Library"}</h1>
          <p className="bp-sub">
            {trainer
              ? "Curated lecture presentations, project briefs, sample rubrics and trainer lesson blueprints."
              : "Centralized repository for corporate agreements, trainee certificates, offer letters, and institutional compliance standards."}
          </p>
        </div>
        <div className="bp-actions">
          <Link to="/audit" className="bp-btn outline"><History size={16} /> Audit Trail</Link>
          <button type="button" className="bp-btn navy" onClick={openUpload}><CloudUpload size={16} /> {trainer ? "Upload New Material" : "Upload Document"}</button>
        </div>
      </div>

      {error && <p className="bp-notice dl-error">{error}</p>}

      {stats && (
        <div className="bp-stats">
          <div className="bp-stat" style={{ "--i": 0 }}>
            <div className="bp-stat-top">
              <p className="bp-stat-label dl-stat-label">TOTAL REPOSITORY</p>
              <span className="bp-stat-icon"><Copy size={17} /></span>
            </div>
            <p className="bp-stat-value">{stats.total} <small className="dl-unit">archived items</small></p>
            <p className="dl-stat-foot"><i className="dl-dot navy" /> {stats.by_category.length} categories in use</p>
          </div>
          <div className="bp-stat" style={{ "--i": 1 }}>
            <div className="bp-stat-top">
              <p className="bp-stat-label dl-stat-label">ACTIVE &amp; EXECUTED</p>
              <span className="bp-stat-icon green"><PenLine size={17} /></span>
            </div>
            <p className="bp-stat-value">{stats.active} <span className="bp-chip green">{activeRate}% rate</span></p>
            <p className="dl-stat-foot"><Lock size={13} /> {stats.confidential} marked confidential</p>
          </div>
          <div className="bp-stat" style={{ "--i": 2 }}>
            <div className="bp-stat-top">
              <p className="bp-stat-label dl-stat-label">PENDING REVIEW</p>
              <span className="bp-stat-icon orange"><FileWarning size={17} /></span>
            </div>
            <p className="bp-stat-value dl-orange">
              {stats.pending_review}
              {stats.pending_review > 0 && <span className="bp-chip orange">Needs follow-up</span>}
            </p>
            <p className="dl-stat-foot">
              <span>Awaiting approval</span>
              <Link to="/documents/approvals" className="dl-foot-link">Open approvals</Link>
            </p>
          </div>
        </div>
      )}

      <div className="bp-panel dl-filters">
        <label className="bp-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by document name…" />
        </label>
        <label className="bp-select">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {filterOptions.categories.map((c) => <option key={c.document_category_id} value={c.document_category_id}>{c.category_name}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
        <label className="bp-select">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {filterOptions.types.map((t) => <option key={t.document_type_id} value={t.document_type_id}>{t.type_name}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
        <label className="bp-select">
          <select value={confFilter} onChange={(e) => setConfFilter(e.target.value)}>
            <option value="">Confidentiality</option>
            {filterOptions.confidentiality_levels.map((c) => <option key={c.confidentiality_level_id} value={c.confidentiality_level_id}>{c.level_name}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
        <label className="bp-select">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Status</option>
            {filterOptions.statuses.map((s) => <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
        <label className="bp-select">
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option value="">Owner</option>
            {filterOptions.owners.map((o) => <option key={o.user_id} value={o.user_id}>{o.name}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
        <div className="dl-view-toggle">
          <button type="button" className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Grid view"><LayoutGrid size={15} /></button>
          <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="List view"><List size={15} /></button>
        </div>
        <button type="button" className="dl-refresh" onClick={() => { loadDocuments(); loadStats(); }} aria-label="Refresh"><RefreshCw size={15} /></button>
      </div>

      {selected.size > 0 && (
        <div className="dl-bulk">
          <span><b>{selected.size}</b> selected</span>
          <button type="button" className="bp-btn soft small" onClick={handleBulkExport} disabled={exporting}>
            <Archive size={14} /> {exporting ? "Exporting…" : "Export as ZIP"}
          </button>
          <button type="button" className="bp-btn outline small" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {loading ? (
        <p className="bp-loading">Loading…</p>
      ) : view === "grid" ? (
        <div className="dl-grid">
          {documents.map((d, i) => {
            const Icon = iconFor(d);
            return (
              <article key={d.document_id} className={`dl-card ${selected.has(d.document_id) ? "selected" : ""}`} style={{ "--i": i % 9 }}>
                <div className="dl-card-top">
                  <span className={`dl-card-icon ${categoryTone(d.category_name)}`}><Icon size={20} /></span>
                  <div className="dl-card-tags">
                    <span className={`dl-tag ${categoryTone(d.category_name)}`}>{d.category_name || d.type_name}</span>
                    <input type="checkbox" checked={selected.has(d.document_id)} onChange={() => toggleOne(d.document_id)} aria-label={`Select ${d.title}`} />
                  </div>
                </div>
                <h3 className="dl-card-title" title={d.title}>{d.title}</h3>
                <p className="dl-card-desc">{d.type_name} · owned by {d.owner_name || "—"}</p>
                <div className="dl-card-chips">
                  <span className={`bp-chip ${CONF_TONE[d.confidentiality_code] || "blue"}`}>{d.confidentiality_name}</span>
                  <span className={`bp-chip ${STATUS_TONE[d.status] || "gray"}`}>{STATUS_LABEL[d.status] || d.status}</span>
                </div>
                <p className="dl-card-meta">Updated {fmtDate(d.updated_at)}</p>
                <div className="dl-card-actions">
                  <button type="button" className="dl-chip-btn" onClick={() => handleView(d)}><Eye size={14} /> Preview</button>
                  <div>
                    <Link to={`/documents/governance?documentId=${d.document_id}`} className="dl-icon-btn" title="Manage access"><ShieldAlert size={15} /></Link>
                    <button type="button" className="dl-icon-btn" title="Download" onClick={() => handleDownload(d)}><Download size={15} /></button>
                  </div>
                </div>
              </article>
            );
          })}
          <button type="button" className="dl-card dl-add" onClick={openUpload} style={{ "--i": documents.length % 9 }}>
            <span className="dl-add-icon"><Plus size={22} /></span>
            <b>Add New Document</b>
            <span>Upload a PDF, agreement or certificate to the library.</span>
          </button>
        </div>
      ) : (
        <div className="bp-panel">
          <div className="bp-table-wrap">
            <table className="bp-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Confidentiality</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr className="bp-empty-row"><td colSpan={9}>No documents match your filters.</td></tr>
                ) : documents.map((d) => (
                  <tr key={d.document_id}>
                    <td><input type="checkbox" checked={selected.has(d.document_id)} onChange={() => toggleOne(d.document_id)} /></td>
                    <td className="bp-strong">{d.title}</td>
                    <td>{d.type_name}</td>
                    <td>{d.category_name || "—"}</td>
                    <td><span className={`bp-chip ${CONF_TONE[d.confidentiality_code] || "blue"}`}>{d.confidentiality_name}</span></td>
                    <td><span className={`bp-chip ${STATUS_TONE[d.status] || "gray"}`}>{STATUS_LABEL[d.status] || d.status}</span></td>
                    <td>
                      <div className="bp-person">
                        <span className="bp-avatar">{initials(d.owner_name)}</span>
                        <p className="bp-person-name">{d.owner_name || "—"}</p>
                      </div>
                    </td>
                    <td>{fmtDate(d.updated_at)}</td>
                    <td>
                      <div className="dl-row-actions">
                        <button type="button" className="dl-icon-btn" title="View" onClick={() => handleView(d)}><Eye size={15} /></button>
                        <button type="button" className="dl-icon-btn" title="Download" onClick={() => handleDownload(d)}><Download size={15} /></button>
                        <Link to={`/documents/governance?documentId=${d.document_id}`} className="dl-icon-btn" title="Manage access"><ShieldAlert size={15} /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="dl-bottom">
        <div className="bp-panel dl-vault">
          <div className="dl-vault-head">
            <span className="dl-card-icon blue"><ShieldCheck size={20} /></span>
            <div>
              <b>Repository by Category</b>
              <p>How the {stats?.total ?? 0} documents you can see are classified.</p>
            </div>
          </div>
          <div className="dl-cat-bar">
            {(stats?.by_category || []).map((c, i) => (
              <span key={c.category_name} className={`seg s${i % 5}`} style={{ flex: c.count }} title={`${c.category_name}: ${c.count}`} />
            ))}
          </div>
          <div className="dl-cat-legend">
            {(stats?.by_category || []).slice(0, 6).map((c, i) => (
              <span key={c.category_name}><i className={`s${i % 5}`} /> {c.category_name} ({c.count})</span>
            ))}
          </div>
        </div>
        <div className="dl-ready">
          <p className="dl-ready-kicker">SECURITY &amp; GOVERNANCE</p>
          <h3>Access-controlled library</h3>
          <p>Every document carries a confidentiality level and access rules. Manage who can open each file from Governance.</p>
          <Link to="/documents/governance" className="dl-ready-btn">Open Governance</Link>
        </div>
      </div>

      {uploadOpen && (
        <div className="bp-modal-backdrop" onClick={() => setUploadOpen(false)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Upload document</h2>
            <p>Add a file to the library with its type and confidentiality.</p>
            <form onSubmit={handleUpload}>
              <div className="bp-form-grid">
                <label className="bp-field full">
                  <span>Title</span>
                  <input value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })} required />
                </label>
                <label className="bp-field">
                  <span>Type</span>
                  <select value={uploadForm.document_type_id} onChange={(e) => setUploadForm({ ...uploadForm, document_type_id: e.target.value })} required>
                    <option value="">Select a type…</option>
                    {filterOptions.types.map((t) => <option key={t.document_type_id} value={t.document_type_id}>{t.type_name}</option>)}
                  </select>
                </label>
                <label className="bp-field">
                  <span>Category (optional)</span>
                  <select value={uploadForm.document_category_id} onChange={(e) => setUploadForm({ ...uploadForm, document_category_id: e.target.value })}>
                    <option value="">No category</option>
                    {filterOptions.categories.map((c) => <option key={c.document_category_id} value={c.document_category_id}>{c.category_name}</option>)}
                  </select>
                </label>
                <label className="bp-field">
                  <span>Confidentiality</span>
                  <select value={uploadForm.confidentiality_level_id} onChange={(e) => setUploadForm({ ...uploadForm, confidentiality_level_id: e.target.value })} required>
                    <option value="">Select a level…</option>
                    {filterOptions.confidentiality_levels.map((c) => <option key={c.confidentiality_level_id} value={c.confidentiality_level_id}>{c.level_name}</option>)}
                  </select>
                </label>
                <label className="bp-field">
                  <span>File</span>
                  <input type="file" onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })} required />
                </label>
              </div>
              {uploadError && <p className="bp-form-error">{uploadError}</p>}
              <div className="bp-modal-actions">
                <button type="button" className="bp-btn outline" onClick={() => setUploadOpen(false)}>Cancel</button>
                <button type="submit" className="bp-btn navy" disabled={uploading}>{uploading ? "Uploading…" : "Upload"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Library;
