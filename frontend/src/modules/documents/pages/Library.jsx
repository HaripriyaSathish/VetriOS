import { useEffect, useState } from "react";
import {
  Search, CloudUpload, History, Eye, Download, Archive,
  LayoutGrid, List, RefreshCw, ChevronDown, FileText, ShieldCheck, Plus, Lock, ShieldAlert,
  ScrollText, GraduationCap, BookOpen, Handshake, FileBadge, SlidersHorizontal, Hourglass, CircleCheck, Files,
} from "lucide-react";
import { Link } from "react-router-dom";
import client from "../../../api/client";
import Pagination, { paginate } from "../../../components/Pagination";
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
  const [view, setView] = useState("list");
  const [page, setPage] = useState(1);
  const [moreOpen, setMoreOpen] = useState(false);

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
      setPage(1);
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
  const isLocked = (d) => ["RESTRICTED", "CONFIDENTIAL", "HIGHLY_CONFIDENTIAL"].includes(d.confidentiality_code);

  return (
    <div className="bp-page dl-page dl2">
      <div className="dl2-ban">
        <div className="dl2-ban-top">
          <div>
            <h1>{trainer ? "Course materials" : "Document library"}</h1>
            <p>
              {trainer
                ? "Lecture presentations, project briefs, sample rubrics and lesson blueprints."
                : `${stats?.total ?? 0} documents across offer letters, certificates and agreements.`}
            </p>
          </div>
          <div className="dl2-ban-actions">
            <Link to="/audit" className="dl2-ghost"><History size={15} /> Audit trail</Link>
            <button type="button" className="dl2-new" onClick={openUpload}><CloudUpload size={15} /> {trainer ? "Upload material" : "Upload document"}</button>
          </div>
        </div>
      </div>

      <div className="dl2-body">
        {error && <p className="bp-notice dl-error">{error}</p>}

        {stats && (
          <div className="dl2-cards">
            <button type="button" className={`dl2-card tone-blue${!statusFilter ? " selected" : ""}`} onClick={() => setStatusFilter("")}>
              <span className="dl2-card-top"><span className="dl2-card-icon"><Files size={17} /></span><b>{stats.total}</b></span>
              <span className="dl2-card-label"><span>All documents</span><em>{stats.by_category.length} categories</em></span>
            </button>
            <button type="button" className={`dl2-card tone-green${statusFilter === "ACTIVE" ? " selected" : ""}`} onClick={() => setStatusFilter(statusFilter === "ACTIVE" ? "" : "ACTIVE")}>
              <span className="dl2-card-top"><span className="dl2-card-icon"><CircleCheck size={17} /></span><b>{stats.active}</b></span>
              <span className="dl2-card-label"><span>Active and executed</span><em>{activeRate}%</em></span>
            </button>
            <button type="button" className={`dl2-card tone-amber${statusFilter === "UNDER_REVIEW" ? " selected" : ""}`} onClick={() => setStatusFilter(statusFilter === "UNDER_REVIEW" ? "" : "UNDER_REVIEW")}>
              <span className="dl2-card-top"><span className="dl2-card-icon"><Hourglass size={17} /></span><b>{stats.pending_review}</b></span>
              <span className="dl2-card-label"><span>Pending review</span><em>{stats.pending_review > 0 ? "Needs follow-up" : "All clear"}</em></span>
            </button>
          </div>
        )}

        <div className="dl2-panel">
          <div className="dl2-bar">
            <label className="dl2-search">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, owner or code" />
            </label>
            <div className="dl2-seg">
              <button type="button" className={!categoryFilter ? "on" : ""} onClick={() => setCategoryFilter("")}>All</button>
              {filterOptions.categories.slice(0, 3).map((c) => (
                <button
                  key={c.document_category_id}
                  type="button"
                  className={String(categoryFilter) === String(c.document_category_id) ? "on" : ""}
                  onClick={() => setCategoryFilter(c.document_category_id)}
                >
                  {c.category_name}
                </button>
              ))}
            </div>
            <button type="button" className={`dl2-filter-btn${moreOpen ? " on" : ""}`} onClick={() => setMoreOpen((v) => !v)}>
              <SlidersHorizontal size={14} /> Filters
            </button>
            <div className="dl-view-toggle">
              <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="List view"><List size={15} /></button>
              <button type="button" className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Grid view"><LayoutGrid size={15} /></button>
            </div>
            <button type="button" className="dl-refresh" onClick={() => { loadDocuments(); loadStats(); }} aria-label="Refresh"><RefreshCw size={15} /></button>
          </div>
          {moreOpen && (
            <div className="dl2-more">
              <label className="bp-select">
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="">All categories</option>
                  {filterOptions.categories.map((c) => <option key={c.document_category_id} value={c.document_category_id}>{c.category_name}</option>)}
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="bp-select">
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="">All types</option>
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
                  {filterOptions.statuses.map((st) => <option key={st} value={st}>{STATUS_LABEL[st] || st}</option>)}
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
            </div>
          )}
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
        <div className="dl2-panel dl2-table">
          <div className="bp-table-wrap">
            <table className="bp-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" /></th>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Owner</th>
                  <th>Updated</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr className="bp-empty-row"><td colSpan={7}>No documents match your filters.</td></tr>
                ) : paginate(documents, page).map((d) => {
                  const Icon = iconFor(d);
                  return (
                    <tr key={d.document_id} className={d.status === "UNDER_REVIEW" ? "dl2-pending" : ""}>
                      <td><input type="checkbox" checked={selected.has(d.document_id)} onChange={() => toggleOne(d.document_id)} aria-label={`Select ${d.title}`} /></td>
                      <td>
                        <div className="dl2-title">
                          <span className={`dl2-ficon ${categoryTone(d.category_name)}`}><Icon size={17} /></span>
                          <div>
                            <b title={d.title}><span>{d.title}</span>{isLocked(d) &&<Lock size={12} className="dl2-lock" title={d.confidentiality_name} />}</b>
                            <small>{d.type_name}</small>
                          </div>
                        </div>
                      </td>
                      <td>{d.category_name ? <span className={`dl-tag ${categoryTone(d.category_name)}`}>{d.category_name}</span> : "—"}</td>
                      <td>
                        <div className="bp-person">
                          <span className="bp-avatar">{initials(d.owner_name)}</span>
                          <p className="bp-person-name">{d.owner_name || "—"}</p>
                        </div>
                      </td>
                      <td>{fmtDate(d.updated_at)}</td>
                      <td><span className={`dl2-pill ${STATUS_TONE[d.status] || "gray"}`}>{STATUS_LABEL[d.status] || d.status}</span></td>
                      <td>
                        <div className="dl-row-actions">
                          <button type="button" className="dl-icon-btn" title="View" onClick={() => handleView(d)}><Eye size={15} /></button>
                          <button type="button" className="dl-icon-btn" title="Download" onClick={() => handleDownload(d)}><Download size={15} /></button>
                          <Link to={`/documents/governance?documentId=${d.document_id}`} className="dl-icon-btn" title="Manage access"><ShieldAlert size={15} /></Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalItems={documents.length} onPageChange={setPage} />
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
