import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, ChevronDown, Download, CircleCheck, X, Clock3, FunnelX } from "lucide-react";
import client from "../../../api/client";
import CompletionExtensionApprovals from "../../training/pages/CompletionExtensionApprovals";
import AssignReportingManager from "./AssignReportingManager";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/Approvals.css";

// HR "Intern Management": one page for everything HR owns in the intern
// lifecycle — completion / certificate / employee-conversion / extension
// approvals, reporting-manager assignment, and the history of all of it.
// The first two tabs reuse the existing pages (same UI) in embedded mode.
const TABS = [
  { key: "approvals", label: "Completion & Extension Approvals" },
  { key: "managers", label: "Reporting Managers" },
  { key: "history", label: "History" },
];

const KIND = {
  completion: { label: "Completion", tone: "blue" },
  conversion: { label: "Employee Conversion", tone: "green" },
  extension: { label: "Extension", tone: "orange" },
  manager: { label: "Reporting Manager", tone: "gray" },
};

const PAGE_SIZE = 10;
const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const fmtDate = (d) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function statusChip(status) {
  if (status === "APPROVED") return { tone: "green", Icon: CircleCheck, label: "Approved" };
  if (status === "REJECTED") return { tone: "red", Icon: X, label: "Rejected" };
  if (status === "CURRENT") return { tone: "blue", Icon: CircleCheck, label: "Current" };
  return { tone: "gray", Icon: Clock3, label: "Ended" };
}

function downloadCsv(rows) {
  const head = ["Date", "Type", "Intern", "Intern code", "Event", "Status", "Decided by", "Details"];
  const lines = rows.map((e) => [
    e.date, KIND[e.kind]?.label, e.name, e.intern_code, e.label, e.status, e.decided_by, e.detail,
  ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `intern_history_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function InternHistory() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    client.get("/api/interns/hr/history/")
      .then(({ data }) => setEvents(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load history."));
  }, []);

  const filtered = useMemo(() => {
    if (!events) return [];
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (kind && e.kind !== kind) return false;
      if (!q) return true;
      return [e.name, e.intern_code, e.label, e.decided_by, e.detail].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [events, search, kind]);

  if (!events && !error) return <p className="bp-loading">Loading history…</p>;
  if (!events) return <p className="bp-error">{error}</p>;

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="bp-panel">
      <div className="bp-filters">
        <label className="bp-search">
          <Search size={15} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by intern, code or person..." aria-label="Search history" />
        </label>
        <label className="bp-select">
          <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} aria-label="Type">
            <option value="">All types</option>
            {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
        <button type="button" className="bp-btn outline small" title="Clear filters" aria-label="Clear filters"
          onClick={() => { setSearch(""); setKind(""); setPage(1); }}>
          <FunnelX size={15} />
        </button>
        <button type="button" className="bp-btn outline small" onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="bp-table-wrap">
        <table className="bp-table">
          <thead>
            <tr>
              <th>Intern</th>
              <th>Type</th>
              <th>Event</th>
              <th>Status</th>
              <th>Decided By</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr className="bp-empty-row"><td colSpan={6}>{events.length === 0 ? "No history yet — decisions and manager changes will appear here." : "Nothing matches these filters."}</td></tr>
            ) : shown.map((e, i) => {
              const k = KIND[e.kind] || { label: e.kind, tone: "gray" };
              const st = statusChip(e.status);
              return (
                <tr key={e.key} style={{ "--row": i }}>
                  <td>
                    <div className="bp-person">
                      <span className={`bp-avatar t${i % 4}`}>{initialsOf(e.name)}</span>
                      <div>
                        <Link to={`/training/students/${e.person_id}`} className="bp-person-name ap-name">{e.name}</Link>
                        <p className="bp-person-sub">#{e.intern_code}</p>
                      </div>
                    </div>
                  </td>
                  <td><span className={`bp-chip ${k.tone}`}>{k.label}</span></td>
                  <td>
                    <p className="bp-strong" style={{ margin: 0 }}>{e.label}</p>
                    {e.detail && <p className="bp-person-sub">{e.detail}</p>}
                  </td>
                  <td><span className={`bp-chip ${st.tone}`}><st.Icon size={11} /> {st.label}</span></td>
                  <td className="bp-strong">{e.decided_by || <span className="bp-muted">—</span>}</td>
                  <td className="bp-muted">{fmtDate(e.date)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bp-pager">
        <span>Showing <b>{shown.length}</b> of <b>{filtered.length}</b> events</span>
        <div className="bp-pages">
          <button type="button" className="bp-page-btn" disabled={current === 1} onClick={() => setPage(current - 1)}>‹</button>
          {Array.from({ length: pages }, (_, idx) => idx + 1).map((p) => (
            <button key={p} type="button" className={`bp-page-btn ${p === current ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button type="button" className="bp-page-btn" disabled={current === pages} onClick={() => setPage(current + 1)}>›</button>
        </div>
      </div>
    </div>
  );
}

function HRInternManagement() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "approvals";

  return (
    <div className="bp-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">HR Admin › <span>Intern Management</span></p>
          <h1 className="bp-title">Intern Management</h1>
          <p className="bp-sub">Approve internship completions, employee conversions and extensions, assign reporting managers, and review the full history.</p>
        </div>
      </div>

      <div className="bp-tabs" role="tablist" aria-label="Intern management sections">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
            className={`bp-tab ${tab === t.key ? "active" : ""}`} onClick={() => setParams({ tab: t.key })}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "approvals" && <CompletionExtensionApprovals embedded />}
      {tab === "managers" && <AssignReportingManager embedded />}
      {tab === "history" && <InternHistory />}
    </div>
  );
}

export default HRInternManagement;
