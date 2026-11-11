import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  FileSpreadsheet, PlusCircle, ListChecks, Lock, Hourglass, Target, Layers, Search, ChevronDown,
  ChevronLeft, ChevronRight, ArrowRight, X, ArrowUp, ArrowDown, Minus, AlertCircle, RefreshCw,
  LayoutTemplate, Server, Palette, Bug, Rocket, FileText, Sparkles, MessageSquare,
} from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const PAGE_SIZE = 6;

const STATUS = {
  OPEN: { label: "Open", chip: "gray" },
  IN_PROGRESS: { label: "In Progress", chip: "blue" },
  COMPLETED: { label: "Completed", chip: "green" },
  ON_HOLD: { label: "On Hold", chip: "orange" },
  REJECTED: { label: "Rejected", chip: "red" },
  CANCELLED: { label: "Cancelled", chip: "red" },
};

const PRIORITY = {
  URGENT: { label: "Urgent", icon: AlertCircle },
  HIGH: { label: "High", icon: ArrowUp },
  MEDIUM: { label: "Medium", icon: Minus },
  LOW: { label: "Low", icon: ArrowDown },
};

const TABS = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
];

const CLOSED = ["COMPLETED", "REJECTED", "CANCELLED"];

function typeIcon(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("front") || t.includes("ui")) return [Palette, "t1"];
  if (t.includes("back") || t.includes("api") || t.includes("devops")) return [Server, ""];
  if (t.includes("test") || t.includes("qa")) return [Bug, "t2"];
  if (t.includes("deploy") || t.includes("release")) return [Rocket, ""];
  if (t.includes("content")) return [FileText, "t1"];
  if (t.includes("feature")) return [Sparkles, "t2"];
  return [LayoutTemplate, ""];
}

const day = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const initials = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const shortCode = (code) => (code || "").split("-").pop();

const EMPTY_FORM = { project: "", title: "", description: "", type: "", priority: "MEDIUM", owner: "", target: "" };

export default function Requirements() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [changeRequests, setChangeRequests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncedAt, setSyncedAt] = useState(null);

  const [tab, setTab] = useState("ALL");
  const qParam = params.get("q") || "";
  const [search, setSearch] = useState(qParam);
  // The top-bar search links here with ?q=…; pick up a new query even
  // when this page is already open (React's "adjust state on prop change").
  const [lastQ, setLastQ] = useState(qParam);
  if (qParam !== lastQ) {
    setLastQ(qParam);
    setSearch(qParam);
  }
  const [projectFilter, setProjectFilter] = useState(projectId || "");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(1);

  const [teams, setTeams] = useState({});
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [inspect, setInspect] = useState(null);
  const [edit, setEdit] = useState(null);
  const [editError, setEditError] = useState("");
  const [editSaved, setEditSaved] = useState(false);

  const fetchData = () =>
    client.get("/api/projects/requirements/")
      .then(({ data }) => {
        setRows(data.requirements);
        setProjects(data.projects);
        setChangeRequests(data.change_requests_open);
        setSyncedAt(new Date());
        setError("");
        return data;
      })
      .catch((err) => {
        setError(err.response?.data?.detail || "Couldn't load requirements.");
        return null;
      })
      .finally(() => setLoading(false));

  const load = () => {
    setLoading(true);
    return fetchData();
  };

  const loadTeam = (pid) => {
    if (!pid || teams[pid]) return;
    client.get(`/api/projects/${pid}/team/`)
      .then(({ data }) => setTeams((prev) => ({ ...prev, [pid]: data })))
      .catch(() => setTeams((prev) => ({ ...prev, [pid]: [] })));
  };

  const manageable = projects.filter((p) => p.can_manage);

  const openNew = (list = manageable) => {
    const first = (projectFilter && list.find((p) => String(p.project_id) === String(projectFilter))) || list[0];
    setForm({ ...EMPTY_FORM, project: first ? String(first.project_id) : "" });
    setFormError("");
    if (first) loadTeam(first.project_id);
  };

  useEffect(() => {
    fetchData().then((data) => {
      // Dashboard's "New Requirement" button links here with ?new=1.
      if (data && params.get("new") === "1") {
        const list = data.projects.filter((p) => p.can_manage);
        if (list.length) openNew(list);
        params.delete("new");
        setParams(params, { replace: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const by = (s) => rows.filter((r) => r.status === s).length;
    return { ALL: rows.length, OPEN: by("OPEN"), IN_PROGRESS: by("IN_PROGRESS"), COMPLETED: by("COMPLETED"), ON_HOLD: by("ON_HOLD") };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== "ALL" && r.status !== tab) return false;
      if (projectFilter && String(r.project) !== String(projectFilter)) return false;
      if (priorityFilter && r.priority !== priorityFilter) return false;
      if (!q) return true;
      return [r.requirement_title, r.requirement_code, r.requirement_description, r.requirement_type, r.assigned_to_name, r.project_name]
        .some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [rows, tab, search, projectFilter, priorityFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const today = new Date().toISOString().slice(0, 10);
  const types = new Set(rows.map((r) => r.requirement_type).filter(Boolean));
  const assigned = rows.filter((r) => r.assigned_to_user).length;
  const completedPct = rows.length ? Math.round((counts.COMPLETED * 100) / rows.length) : 0;
  const pastTarget = rows.filter((r) => r.target_date && r.target_date < today && !CLOSED.includes(r.status)).length;
  const highOpen = rows.filter((r) => ["HIGH", "URGENT"].includes(r.priority) && !CLOSED.includes(r.status)).length;
  const urgentOpen = rows.filter((r) => r.priority === "URGENT" && !CLOSED.includes(r.status)).length;

  const exportCsv = () => {
    const head = ["Code", "Title", "Project", "Client", "Type", "Priority", "Status", "Owner", "Requested by", "Target date", "Completed date", "Description"];
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((r) => [
      r.requirement_code, r.requirement_title, r.project_name, r.client_name, r.requirement_type,
      r.priority, r.status, r.assigned_to_name, r.requested_by_name, r.target_date, r.completed_date, r.requirement_description,
    ].map(cell).join(","));
    const blob = new Blob([[head.map(cell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `requirements-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createRequirement = async () => {
    if (!form.project) return setFormError("Pick a project.");
    if (!form.title.trim()) return setFormError("Requirement title is required.");
    setSaving(true);
    setFormError("");
    try {
      await client.post(`/api/projects/${form.project}/requirements/`, {
        requirement_title: form.title.trim(),
        requirement_description: form.description,
        requirement_type: form.type || null,
        priority: form.priority,
        assigned_to_user_id: form.owner || null,
        target_date: form.target || null,
      });
      setForm(null);
      setTab("ALL");
      setPage(1);
      await load();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't add the requirement.");
    } finally {
      setSaving(false);
    }
  };

  const openInspect = (r) => {
    setInspect(r);
    setEditError("");
    setEditSaved(false);
    setEdit({ status: r.status, priority: r.priority, owner: r.assigned_to_user ? String(r.assigned_to_user) : "", target: r.target_date || "" });
    if (r.can_manage) loadTeam(r.project);
  };

  const saveEdit = async () => {
    setSaving(true);
    setEditError("");
    setEditSaved(false);
    try {
      const { data } = await client.patch(`/api/projects/requirements/${inspect.project_requirement_id}/`, {
        status: edit.status,
        priority: edit.priority,
        assigned_to_user_id: edit.owner || null,
        target_date: edit.target || null,
      });
      setRows((prev) => prev.map((r) => (r.project_requirement_id === data.project_requirement_id ? { ...r, ...data } : r)));
      setInspect((prev) => ({ ...prev, ...data }));
      setEditSaved(true);
    } catch (err) {
      setEditError(err.response?.data?.detail || "Couldn't save the changes.");
    } finally {
      setSaving(false);
    }
  };

  const formTeam = form ? teams[form.project] || [] : [];
  const inspectTeam = inspect ? teams[inspect.project] || [] : [];
  const editDirty = inspect && edit && (
    edit.status !== inspect.status || edit.priority !== inspect.priority
    || edit.owner !== (inspect.assigned_to_user ? String(inspect.assigned_to_user) : "")
    || edit.target !== (inspect.target_date || "")
  );

  return (
    <div className="bp-page tr-page pm-page">
      <div className="pm-head">
        <div>
          <p className="pm-eyebrow">VetriOS Project Workspace <i /> <span>Requirements &amp; Scope Repository</span></p>
          <h1 className="bp-title">Product Specifications &amp; Scope</h1>
        </div>
        <div className="bp-actions">
          <button type="button" className="bp-btn outline" onClick={exportCsv} disabled={!filtered.length}>
            <FileSpreadsheet size={16} /> Export Spec Matrix
          </button>
          {manageable.length > 0 && (
            <button type="button" className="bp-btn navy" onClick={() => openNew()}><PlusCircle size={16} /> New Requirement</button>
          )}
        </div>
      </div>

      {error && <p className="bp-panel bp-error">{error}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label pm-label">TOTAL REQUIREMENTS</p>
            <span className="pm-ico navy"><ListChecks size={20} /></span>
          </div>
          <p className="bp-stat-value">{rows.length} <span className="bp-chip blue">{types.size} {types.size === 1 ? "type" : "types"}</span></p>
          <p className="pm-foot"><span><Layers size={12} /> {projects.length} {projects.length === 1 ? "project" : "projects"}</span><span>{assigned} assigned</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label pm-label">COMPLETED &amp; SCOPE LOCKED</p>
            <span className="pm-ico green"><Lock size={20} /></span>
          </div>
          <p className="bp-stat-value">{counts.COMPLETED} <span className="bp-chip green">{completedPct}%</span></p>
          <p className="pm-foot"><span className="pm-ok">{rows.length - counts.COMPLETED} remaining</span><span>{counts.OPEN} open</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label pm-label">IN PROGRESS</p>
            <span className="pm-ico orange"><Hourglass size={20} /></span>
          </div>
          <p className="bp-stat-value">{counts.IN_PROGRESS} <span className="bp-chip orange">{counts.ON_HOLD} on hold</span></p>
          <p className="pm-foot"><span className={pastTarget ? "pm-warm" : ""}>{pastTarget} past target date</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label pm-label">HIGH PRIORITY &amp; BLOCKERS</p>
            <span className="pm-ico red"><Target size={20} /></span>
          </div>
          <p className="bp-stat-value">{highOpen} <span className="bp-chip red">{urgentOpen} urgent</span></p>
          <p className="pm-foot"><span className={changeRequests ? "pm-warn" : ""}><MessageSquare size={12} /> {changeRequests} open change {changeRequests === 1 ? "request" : "requests"}</span></p>
        </div>
      </div>

      <div className="bp-panel pm-toolbar">
        <div className="bp-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`bp-tab ${tab === t.key ? "active" : ""}`} onClick={() => { setTab(t.key); setPage(1); }}>
              {t.label}<small>({counts[t.key]})</small>
            </button>
          ))}
        </div>
        <div className="pm-toolbar-right">
          <label className="bp-search">
            <Search size={15} />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search specifications…" />
          </label>
          <label className="bp-select">
            <select value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }}>
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="bp-select">
            <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
              <option value="">All Priorities</option>
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
      </div>

      <section className="bp-panel">
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr>
                <th>Specification Details &amp; Scope</th>
                <th>Project</th>
                <th>Priority</th>
                <th>Owner &amp; Target</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && <tr className="bp-empty-row"><td colSpan={6}>Loading requirements…</td></tr>}
              {!loading && visible.length === 0 && (
                <tr className="bp-empty-row"><td colSpan={6}>{rows.length ? "No requirements match these filters." : "No requirements on your projects yet."}</td></tr>
              )}
              {visible.map((r, idx) => {
                const [Icon, tone] = typeIcon(r.requirement_type);
                const pr = PRIORITY[r.priority] || PRIORITY.MEDIUM;
                const st = STATUS[r.status] || STATUS.OPEN;
                const late = r.target_date && r.target_date < today && !CLOSED.includes(r.status);
                return (
                  <tr key={r.project_requirement_id} style={{ "--row": idx }}>
                    <td>
                      <div className="pm-spec">
                        <span className={`pm-spec-ico ${tone}`}><Icon size={16} /></span>
                        <span className="pm-code" title={r.requirement_code}>{shortCode(r.requirement_code)}</span>
                        <div>
                          <b>{r.requirement_title}</b>
                          {r.requirement_type && <small>{r.requirement_type}</small>}
                        </div>
                      </div>
                    </td>
                    <td><span className="pm-area"><Layers size={12} /> {r.project_name}</span></td>
                    <td><span className={`pm-priority ${r.priority}`}><pr.icon size={13} /> {pr.label}</span></td>
                    <td>
                      <div className="pm-owner">
                        <span className={`bp-avatar ${r.assigned_to_name ? "" : "none"}`}>{r.assigned_to_name ? initials(r.assigned_to_name) : "—"}</span>
                        <div>
                          <b>{r.assigned_to_name || "Unassigned"}</b>
                          <small className={late ? "pm-warn" : ""}>{r.target_date ? `Target ${day(r.target_date)}` : "No target date"}</small>
                        </div>
                      </div>
                    </td>
                    <td><span className={`bp-chip ${st.chip}`}>{st.label}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="pm-inspect" onClick={() => openInspect(r)}>Inspect <ArrowRight size={13} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="bp-pager">
          <span className="pm-sync">
            Showing <b>{visible.length}</b> of <b>{filtered.length}</b> specifications
            {syncedAt && <> · <button type="button" className="pm-inspect" onClick={load}><RefreshCw size={12} /> Synced {syncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</button></>}
          </span>
          <div className="bp-pages">
            <button type="button" className="bp-page-btn" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Previous page"><ChevronLeft size={14} /></button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={`bp-page-btn ${n === current ? "active" : ""}`} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button type="button" className="bp-page-btn" disabled={current === pages} onClick={() => setPage(current + 1)} aria-label="Next page"><ChevronRight size={14} /></button>
          </div>
        </div>
      </section>

      {form && (
        <div className="bp-modal-backdrop" onClick={() => !saving && setForm(null)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Requirement</h2>
            <p className="bp-sub">Adds a requirement to one of the projects you manage.</p>
            <div className="bp-form-grid">
              <label className="bp-field full"><span>Project</span>
                <select value={form.project} onChange={(e) => { setForm({ ...form, project: e.target.value, owner: "" }); loadTeam(e.target.value); }}>
                  {manageable.map((p) => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                </select>
              </label>
              <label className="bp-field full"><span>Title</span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Dark mode toggle" />
              </label>
              <label className="bp-field full"><span>Description</span>
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <label className="bp-field"><span>Type</span>
                <input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Frontend, Backend, UI/UX…" />
              </label>
              <label className="bp-field"><span>Priority</span>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
              <label className="bp-field"><span>Owner</span>
                <select value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}>
                  <option value="">Unassigned</option>
                  {formTeam.map((m) => <option key={m.project_team_member_id} value={m.user_id}>{m.name} ({m.project_role})</option>)}
                </select>
              </label>
              <label className="bp-field"><span>Target date</span>
                <input type="date" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
              </label>
            </div>
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={createRequirement} disabled={saving}>{saving ? "Adding…" : "Add Requirement"}</button>
            </div>
          </div>
        </div>
      )}

      {inspect && (
        <div className="pm-drawer-backdrop" onClick={() => !saving && setInspect(null)}>
          <aside className="pm-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="pm-drawer-top">
              <div>
                <span className="pm-code" title={inspect.requirement_code}>{inspect.requirement_code}</span>
                <h2>{inspect.requirement_title}</h2>
              </div>
              <button type="button" className="pm-close" onClick={() => setInspect(null)} aria-label="Close"><X size={16} /></button>
            </div>

            <dl className="pm-facts">
              <div><dt>Project</dt><dd>{inspect.project_name}</dd></div>
              <div><dt>Client</dt><dd>{inspect.client_name}</dd></div>
              <div><dt>Type</dt><dd>{inspect.requirement_type || "—"}</dd></div>
              <div><dt>Requested by</dt><dd>{inspect.requested_by_name || "—"}</dd></div>
              <div><dt>Status</dt><dd>{(STATUS[inspect.status] || STATUS.OPEN).label}</dd></div>
              <div><dt>Priority</dt><dd>{(PRIORITY[inspect.priority] || PRIORITY.MEDIUM).label}</dd></div>
              <div><dt>Owner</dt><dd>{inspect.assigned_to_name || "Unassigned"}</dd></div>
              <div><dt>Target date</dt><dd>{day(inspect.target_date)}</dd></div>
              {inspect.completed_date && <div><dt>Completed</dt><dd>{day(inspect.completed_date)}</dd></div>}
            </dl>

            <h4>Description</h4>
            <p className="pm-desc">{inspect.requirement_description || "No description provided."}</p>

            {inspect.can_manage ? (
              <>
                <h4>Update</h4>
                <div className="bp-form-grid">
                  <label className="bp-field"><span>Status</span>
                    <select value={edit.status} onChange={(e) => { setEdit({ ...edit, status: e.target.value }); setEditSaved(false); }}>
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </label>
                  <label className="bp-field"><span>Priority</span>
                    <select value={edit.priority} onChange={(e) => { setEdit({ ...edit, priority: e.target.value }); setEditSaved(false); }}>
                      {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </label>
                  <label className="bp-field"><span>Owner</span>
                    <select value={edit.owner} onChange={(e) => { setEdit({ ...edit, owner: e.target.value }); setEditSaved(false); }}>
                      <option value="">Unassigned</option>
                      {inspectTeam.map((m) => <option key={m.project_team_member_id} value={m.user_id}>{m.name} ({m.project_role})</option>)}
                    </select>
                  </label>
                  <label className="bp-field"><span>Target date</span>
                    <input type="date" value={edit.target} onChange={(e) => { setEdit({ ...edit, target: e.target.value }); setEditSaved(false); }} />
                  </label>
                </div>
                {editError && <p className="bp-form-error">{editError}</p>}
                {editSaved && <p className="pm-saved">Saved.</p>}
                <div className="bp-modal-actions">
                  <button type="button" className="bp-btn navy" onClick={saveEdit} disabled={saving || !editDirty}>{saving ? "Saving…" : "Save Changes"}</button>
                </div>
              </>
            ) : (
              <p className="bp-muted">Only this project&apos;s Project Manager can change it.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
