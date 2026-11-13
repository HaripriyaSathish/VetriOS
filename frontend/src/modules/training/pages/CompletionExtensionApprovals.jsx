import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download, Award, Clock, BadgeCheck, MessageSquare, Search, Info, ChevronDown, ChevronUp,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/Approvals.css";

const PAGE_SIZE = 8;
const TABS = [
  { key: "all", label: "All Requests" },
  { key: "completion", label: "Certificate Completion" },
  { key: "extension", label: "Internship Extension" },
];

const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function submittedAgo(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const hours = Math.round((Date.parse(new Date().toISOString()) - d.getTime()) / 3600000);
  if (hours < 24) return `${Math.max(1, hours)} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function downloadCsv(rows) {
  const head = ["Type", "Intern", "Intern code", "Batch", "Project", "Request", "Lead note", "Submitted"];
  const lines = rows.map((r) => [
    r.kind, r.name, r.intern_code, r.batch_name, r.project_name, r.label, r.note, r.submitted_at,
  ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `lifecycle_approvals_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// embedded: rendered as a tab inside HR's Intern Management page, which
// supplies the page title — only the action buttons are kept here.
function CompletionExtensionApprovals({ embedded = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(null);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [openKey, setOpenKey] = useState(null);
  const [page, setPage] = useState(1);

  const load = () =>
    client.get("/api/training/business/lifecycle-approvals/")
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load pending approvals."));

  useEffect(() => { load(); }, []);

  const approveCompletion = async (r) => {
    if (!window.confirm(`Approve completion for ${r.name}? This applies the outcome: ${r.label}.`)) return;
    setProcessing(`completion-${r.id}`);
    setError("");
    try {
      const { data: res } = await client.patch(`/api/interns/completions/${r.id}/approve/`);
      setMessage(`Completion approved — outcome: ${res.outcome}.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't approve completion.");
    } finally {
      setProcessing(null);
    }
  };

  const rejectCompletion = async (r) => {
    const reason = window.prompt(`Reason for declining ${r.name}'s request (${r.label}) — sent to the project lead:`);
    if (reason === null) return;
    if (!reason.trim()) { setError("A reason is required to decline a request."); return; }
    setProcessing(`completion-${r.id}`);
    setError("");
    try {
      await client.patch(`/api/interns/completions/${r.id}/reject/`, { reason });
      setMessage(`Request declined for ${r.name}. The project lead can recommend again.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't decline request.");
    } finally {
      setProcessing(null);
    }
  };

  const actOnExtension = async (r, decision) => {
    let reason = "";
    if (decision === "REJECTED") {
      const input = window.prompt(`Reason for declining ${r.name}'s extension (optional):`);
      if (input === null) return;
      reason = input;
    }
    setProcessing(`extension-${r.id}`);
    setError("");
    try {
      await client.patch(`/api/interns/extensions/${r.id}/act/`, { decision, reason });
      setMessage(`Extension ${decision.toLowerCase()} for ${r.name}.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't update extension.");
    } finally {
      setProcessing(null);
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.requests.filter((r) => {
      if (tab !== "all" && r.kind !== tab) return false;
      if (!q) return true;
      return [r.name, r.intern_code, r.batch_name, r.project_name, r.note].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [data, tab, search]);

  if (!data && !error) return <p className="bp-loading">Loading approvals…</p>;
  if (!data) return <p className="bp-error">{error}</p>;

  const st = data.stats;
  const counts = {
    all: data.requests.length,
    completion: st.completions_pending,
    extension: st.extensions_pending,
  };
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className={embedded ? "bp-embed" : "bp-page"}>
      <div className="bp-head">
        <div style={embedded ? { display: "none" } : undefined}>
          <p className="bp-crumb">HR › <span>Internship Lifecycle Approvals</span></p>
          <h1 className="bp-title">Completion &amp; Extension Approvals</h1>
          <p className="bp-sub">Approve internship completions, certificates, intern-to-employee conversions and extension requests raised by project leads.</p>
        </div>
        <div className="bp-actions">
          <button type="button" className="bp-btn outline" onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0}>
            <Download size={15} /> Export Logs
          </button>
        </div>
      </div>

      {error && <p className="bp-error">{error}</p>}
      {message && <p className="bp-notice">{message}</p>}

      <div className="bp-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label ap-caps">Certificate Requests</p>
            <span className="bp-stat-icon"><Award size={17} /></span>
          </div>
          <p className="bp-stat-value">{st.completions_pending} <span className="bp-chip blue">Pending</span></p>
          <p className="bp-person-sub">Completions &amp; conversions awaiting HR sign-off</p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label ap-caps">Extension Requests</p>
            <span className="bp-stat-icon orange"><Clock size={17} /></span>
          </div>
          <p className="bp-stat-value" style={{ color: "var(--vt-orange)" }}>{st.extensions_pending} <span className="bp-chip orange">Pending</span></p>
          <p className="bp-person-sub">Lead-requested internship prolongations</p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label ap-caps">Approved This Month</p>
            <span className="bp-stat-icon green"><BadgeCheck size={17} /></span>
          </div>
          <p className="bp-stat-value">{st.approved_month}</p>
          <p className="bp-person-sub">Completions and extensions signed off</p>
        </div>
      </div>

      <div className="bp-panel">
        <div className="bp-filters">
          <div className="bp-tabs">
            {TABS.map((t) => (
              <button key={t.key} type="button" className={`bp-tab ${tab === t.key ? "active" : ""}`} onClick={() => { setTab(t.key); setPage(1); }}>
                {t.label} <small>({counts[t.key]})</small>
              </button>
            ))}
          </div>
          <label className="bp-search">
            <Search size={15} />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Filter by trainee or lead..." aria-label="Filter requests" />
          </label>
        </div>

        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr>
                <th>Trainee Details</th>
                <th>Request Type</th>
                <th>Project</th>
                <th>Lead Recommendation</th>
                <th>Submitted On</th>
                <th style={{ textAlign: "right" }}>Decision Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr className="bp-empty-row"><td colSpan={6}>{data.requests.length === 0 ? "No completions or extensions waiting for approval." : "No requests match."}</td></tr>
              ) : shown.map((r, i) => {
                const key = `${r.kind}-${r.id}`;
                const busy = processing === key;
                const open = openKey === key;
                return [
                  <tr key={key} style={{ "--row": i }}>
                    <td>
                      <div className="bp-person">
                        <span className={`bp-avatar t${i % 4}`}>{initialsOf(r.name)}</span>
                        <div>
                          <Link to={`/training/students/${r.person_id}`} className="bp-person-name ap-name">{r.name}</Link>
                          <p className="bp-person-sub">#{r.intern_code}{r.batch_name ? ` · ${r.batch_name}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td><span className={`ap-type ${r.kind}`}>{r.kind === "extension" ? "+ " : ""}{r.label}</span></td>
                    <td>
                      <p className="bp-strong" style={{ margin: 0 }}>{r.project_name || "—"}</p>
                      {r.project_status && <p className="bp-person-sub">{r.project_status}</p>}
                    </td>
                    <td>
                      {r.note ? <p className="ap-quote"><MessageSquare size={13} /> “{r.note.length > 70 ? `${r.note.slice(0, 70)}…` : r.note}”</p> : <span className="bp-muted">—</span>}
                    </td>
                    <td className="bp-muted">{submittedAgo(r.submitted_at)}</td>
                    <td>
                      <div className="ap-actions">
                        {r.kind === "completion" ? (
                          <>
                            <button type="button" className="bp-btn navy small" disabled={busy} onClick={() => approveCompletion(r)}>
                              {busy ? "Saving…" : r.label === "Converted To Employee" ? "Approve Conversion" : r.label === "Certificate Issued" ? "Approve Certificate" : "Approve"}
                            </button>
                            <button type="button" className="bp-btn outline small" disabled={busy} onClick={() => rejectCompletion(r)}>
                              Reject
                            </button>
                            <button type="button" className="bp-btn outline small" onClick={() => setOpenKey(open ? null : key)}>
                              Review {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="bp-btn orange small" disabled={busy} onClick={() => actOnExtension(r, "APPROVED")}>
                              {busy ? "Saving…" : "Grant Extension"}
                            </button>
                            <button type="button" className="bp-btn outline small" disabled={busy} onClick={() => actOnExtension(r, "REJECTED")}>
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>,
                  open && (
                    <tr key={`${key}-review`} className="ap-form-row">
                      <td colSpan={6}>
                        <div className="ap-form">
                          <p className="ap-note"><MessageSquare size={13} /> {r.note || "No note from the project lead."}</p>
                          <p className="bp-person-sub" style={{ margin: 0 }}>
                            Outcome on approval: <b>{r.label}</b>. Rejecting removes the request and sends your reason to the project lead, who can recommend again.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>

        <div className="bp-pager">
          <span>Showing <b>{shown.length}</b> of <b>{filtered.length}</b> pending decisions</span>
          <div className="bp-pages">
            <button type="button" className="bp-page-btn" disabled={current === 1} onClick={() => setPage(current - 1)}>‹</button>
            {Array.from({ length: pages }, (_, idx) => idx + 1).map((p) => (
              <button key={p} type="button" className={`bp-page-btn ${p === current ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button type="button" className="bp-page-btn" disabled={current === pages} onClick={() => setPage(current + 1)}>›</button>
          </div>
        </div>
      </div>

      <div className="ap-info">
        <Info size={18} />
        <div>
          <b>What approving does</b>
          <p>Approving a completion applies its outcome and closes the internship — for a conversion it also makes the intern a full-time employee with the Employee role. Granting an extension moves the internship end date to the requested date. The project lead and intern are notified of every decision.</p>
        </div>
      </div>
    </div>
  );
}

export default CompletionExtensionApprovals;
