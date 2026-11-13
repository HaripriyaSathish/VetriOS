import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  RotateCcwClock, Search, ChevronDown, Download, CircleCheck, Clock3, TrendingUp, X, FunnelX, MessageSquareText,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/Approvals.css";

const PAGE_SIZE = 8;
const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function tierOf(score) {
  if (score == null) return null;
  if (score >= 90) return { label: "Tier 1", tone: "blue" };
  if (score >= 80) return { label: "Tier 2", tone: "blue" };
  return { label: "Borderline", tone: "orange" };
}

function mockLabel(mock) {
  if (!mock) return { label: "Not scheduled", tone: "gray", Icon: Clock3 };
  const s = (mock.result_status || "").toUpperCase();
  if (s === "PASS" || s === "PASSED") return { label: `Passed${mock.score != null ? ` (${Number(mock.score)})` : ""}`, tone: "green", Icon: CircleCheck };
  if (s === "FAIL" || s === "FAILED") return { label: "Not cleared", tone: "red", Icon: X };
  return { label: "Pending sign-off", tone: "gray", Icon: Clock3 };
}

function downloadCsv(rows) {
  const head = ["Student", "Code", "Email", "Course", "Batch", "Avg score", "Attendance %", "Mock interview", "Recommended by", "Waiting (hrs)"];
  const lines = rows.map((r) => [
    r.student_name, r.student_code, r.email, r.course_name, r.batch_name, r.average_score, r.attendance_percent,
    r.mock_interview?.result_status || "", r.recommended_by, r.waiting_hours,
  ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `internship_approvals_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function downloadHistoryCsv(rows) {
  const head = ["Student", "Code", "Course", "Batch", "Decision", "Intern code", "Recommended by", "Recommended on", "Decided by", "Decided on", "Trainer note", "Review note"];
  const lines = rows.map((d) => [
    d.student_name, d.student_code, d.course_name, d.batch_name, d.status, d.intern_code, d.recommended_by,
    d.recommended_at, d.reviewed_by, d.reviewed_at, d.recommendation_note, d.review_note,
  ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `internship_decisions_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function InternshipApprovals() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(null);
  const [startDates, setStartDates] = useState({});
  const [openId, setOpenId] = useState(null);
  // "pending" = requests waiting for a decision; "history" = every
  // approved / rejected recommendation (newest first).
  const [view, setView] = useState("pending");
  const [decision, setDecision] = useState("");
  const [search, setSearch] = useState("");
  const [track, setTrack] = useState("");
  const [tier, setTier] = useState("");
  const [page, setPage] = useState(1);

  const load = () =>
    client.get("/api/training/business/internship-approvals/")
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load pending recommendations."));

  useEffect(() => { load(); }, []);

  // The reporting manager is assigned by HR after approval (HR is notified).
  const approve = async (recommendationId) => {
    setProcessing(recommendationId);
    setError("");
    try {
      const startDate = startDates[recommendationId] || new Date().toISOString().slice(0, 10);
      const { data: res } = await client.post(`/api/interns/${recommendationId}/approve/`, {
        internship_start_date: startDate,
      });
      setMessage(`Approved — intern code ${res.intern_code} created. HR has been asked to assign a reporting manager.`);
      setOpenId(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't approve.");
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (recommendationId) => {
    const reviewNote = window.prompt("Reason for rejection (optional):", "");
    if (reviewNote === null) return;
    setProcessing(recommendationId);
    setError("");
    try {
      await client.post(`/api/interns/${recommendationId}/reject/`, { review_note: reviewNote });
      setMessage("Recommendation rejected.");
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't reject.");
    } finally {
      setProcessing(null);
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.pending.filter((r) => {
      if (track && r.course_name !== track) return false;
      if (tier && (tierOf(r.average_score)?.label || "Unscored") !== tier) return false;
      if (!q) return true;
      return [r.student_name, r.student_code, r.email, r.batch_name].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [data, search, track, tier]);

  const history = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.decisions.filter((d) => {
      if (track && d.course_name !== track) return false;
      if (decision && d.status !== decision) return false;
      if (!q) return true;
      return [d.student_name, d.student_code, d.batch_name, d.intern_code, d.recommended_by, d.reviewed_by]
        .some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [data, search, track, decision]);

  const switchView = (next) => {
    setView(next);
    setPage(1);
    setOpenId(null);
  };

  if (!data && !error) return <p className="bp-loading">Loading approvals…</p>;
  if (!data) return <p className="bp-error">{error}</p>;

  const st = data.stats;
  const isHistory = view === "history";
  const tracks = [...new Set([...data.pending, ...data.decisions].map((r) => r.course_name).filter(Boolean))];
  const rows = isHistory ? history : filtered;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const shownHistory = history.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const approvedTotal = data.decisions.filter((d) => d.status === "APPROVED").length;

  return (
    <div className="bp-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Business Operations / <span>Approvals</span></p>
          <h1 className="bp-title">Internship Approvals</h1>
          <p className="bp-sub">Review and authorize students eligible to transition into live industry internships. Verify benchmark assessments and mock ratings before deployment.</p>
        </div>
        <div className="bp-actions">
          <button type="button" className={`bp-btn ${isHistory ? "navy" : "outline"}`} onClick={() => switchView(isHistory ? "pending" : "history")}>
            <RotateCcwClock size={15} /> Decision Log
          </button>
        </div>
      </div>

      {error && <p className="bp-error">{error}</p>}
      {message && <p className="bp-notice">{message}</p>}

      <div className="bp-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Pending Reviews</p>
            {st.urgent > 0 && <span className="bp-chip orange">● {st.urgent} waiting &gt; 2 days</span>}
          </div>
          <p className="bp-stat-value">{st.pending} <small className="ap-small">students awaiting sign-off</small></p>
          <div className="bp-meter"><span className="orange" style={{ width: `${st.pending ? Math.max(8, (st.urgent / st.pending) * 100) : 0}%` }} /></div>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Approved (MTD)</p>
            <span className={`bp-chip ${st.approved_change >= 0 ? "green" : "red"}`}>
              <TrendingUp size={11} /> {st.approved_change >= 0 ? "+" : ""}{st.approved_change} vs last mo
            </span>
          </div>
          <p className="bp-stat-value">{st.approved_month} <small className="ap-small">transferred to internships</small></p>
          <div className="bp-meter"><span style={{ width: st.approved_month ? "85%" : "0%" }} /></div>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Avg Review Time</p>
            <span className="bp-chip blue">Target &lt; 24h</span>
          </div>
          <p className="bp-stat-value">
            {st.avg_review_hours ?? "—"} <small className="ap-small">hrs</small>
          </p>
          <div className="bp-stat-foot">
            <div className="bp-meter" style={{ flex: 1 }}>
              <span className="ap-green" style={{ width: `${st.avg_review_hours == null ? 0 : Math.max(8, 100 - (st.avg_review_hours / 48) * 100)}%` }} />
            </div>
            <span>{st.avg_review_hours == null ? "No reviews yet" : st.avg_review_hours <= 24 ? "Well inside limits" : "Above target"}</span>
          </div>
        </div>
      </div>

      <div className="bp-panel">
        <div className="bp-filters">
          <div className="bp-tabs" role="tablist" aria-label="Internship approvals view">
            <button type="button" role="tab" aria-selected={!isHistory} className={`bp-tab ${!isHistory ? "active" : ""}`} onClick={() => switchView("pending")}>
              Pending <small>({data.pending.length})</small>
            </button>
            <button type="button" role="tab" aria-selected={isHistory} className={`bp-tab ${isHistory ? "active" : ""}`} onClick={() => switchView("history")}>
              History <small>({data.decisions.length})</small>
            </button>
          </div>
          <label className="bp-search">
            <Search size={15} />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by student name, ID or batch..." aria-label="Search students" />
          </label>
          <label className="bp-select">
            <select value={track} onChange={(e) => { setTrack(e.target.value); setPage(1); }} aria-label="Track">
              <option value="">All Tracks</option>
              {tracks.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          {isHistory ? (
          <label className="bp-select">
            <select value={decision} onChange={(e) => { setDecision(e.target.value); setPage(1); }} aria-label="Decision">
              <option value="">Decision: All</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <ChevronDown size={14} />
          </label>
          ) : (
          <label className="bp-select">
            <select value={tier} onChange={(e) => { setTier(e.target.value); setPage(1); }} aria-label="Score">
              <option value="">Score: All</option>
              <option value="Tier 1">Tier 1 (90%+)</option>
              <option value="Tier 2">Tier 2 (80–89%)</option>
              <option value="Borderline">Borderline (&lt;80%)</option>
              <option value="Unscored">Not scored yet</option>
            </select>
            <ChevronDown size={14} />
          </label>
          )}
          <button type="button" className="bp-btn outline small" title="Clear filters" aria-label="Clear filters"
            onClick={() => { setSearch(""); setTrack(""); setTier(""); setDecision(""); setPage(1); }}>
            <FunnelX size={15} />
          </button>
          <button type="button" className="bp-btn outline small" onClick={() => (isHistory ? downloadHistoryCsv(history) : downloadCsv(filtered))} disabled={rows.length === 0}>
            <Download size={14} /> Export CSV
          </button>
        </div>

        {isHistory ? (
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr>
                <th>Student Details</th>
                <th>Training Track &amp; Batch</th>
                <th>Decision</th>
                <th>Recommended By</th>
                <th>Decided By</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {shownHistory.length === 0 ? (
                <tr className="bp-empty-row">
                  <td colSpan={6}>{data.decisions.length === 0 ? "No decisions recorded yet — approved and rejected recommendations will appear here." : "No decisions match these filters."}</td>
                </tr>
              ) : shownHistory.map((d, i) => (
                <tr key={d.recommendation_id} style={{ "--row": i }}>
                  <td>
                    <div className="bp-person">
                      <span className={`bp-avatar t${i % 4}`}>{initialsOf(d.student_name)}</span>
                      <div>
                        <Link to={`/training/students/${d.person_id}`} className="bp-person-name ap-name">{d.student_name}</Link>
                        <p className="bp-person-sub">#{d.student_code}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="bp-strong" style={{ margin: 0 }}>{d.course_name || "—"}</p>
                    <p className="bp-person-sub">{d.batch_name || ""}</p>
                  </td>
                  <td>
                    <span className={`bp-chip ${d.status === "APPROVED" ? "green" : "red"}`}>
                      {d.status === "APPROVED" ? <CircleCheck size={11} /> : <X size={11} />} {d.status === "APPROVED" ? "Approved" : "Rejected"}
                    </span>
                    {d.intern_code && <p className="bp-person-sub">Intern #{d.intern_code}</p>}
                  </td>
                  <td>
                    <p className="bp-strong" style={{ margin: 0 }}>{d.recommended_by || "—"}</p>
                    <p className="bp-person-sub">{fmtDate(d.recommended_at)}</p>
                  </td>
                  <td>
                    <p className="bp-strong" style={{ margin: 0 }}>{d.reviewed_by || "—"}</p>
                    <p className="bp-person-sub">{fmtDate(d.reviewed_at)}</p>
                  </td>
                  <td className="bp-muted">
                    {d.review_note || d.recommendation_note
                      ? <span title={d.recommendation_note ? `Trainer: ${d.recommendation_note}` : undefined}>{d.review_note || `Trainer: ${d.recommendation_note}`}</span>
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        ) : (
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr>
                <th>Student Details</th>
                <th>Training Track &amp; Batch</th>
                <th>Assessment</th>
                <th>Attendance</th>
                <th>Mock Interview</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr className="bp-empty-row">
                  <td colSpan={6}>{data.pending.length === 0 ? "No pending recommendations right now." : "No students match these filters."}</td>
                </tr>
              ) : shown.map((r, i) => {
                const t = tierOf(r.average_score);
                const mock = mockLabel(r.mock_interview);
                const open = openId === r.recommendation_id;
                return [
                  <tr key={r.recommendation_id} style={{ "--row": i }}>
                    <td>
                      <div className="bp-person">
                        <span className={`bp-avatar t${i % 4}`}>{initialsOf(r.student_name)}</span>
                        <div>
                          <Link to={`/training/students/${r.person_id}`} className="bp-person-name ap-name">{r.student_name}</Link>
                          <p className="bp-person-sub">#{r.student_code}{r.email ? ` • ${r.email}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="bp-strong" style={{ margin: 0 }}>{r.course_name || "—"}</p>
                      <p className="bp-person-sub">{r.batch_name || ""}</p>
                    </td>
                    <td>
                      {r.average_score == null ? <span className="bp-muted">Not scored</span> : (
                        <span className="ap-score">
                          <b className={t.tone === "orange" ? "ap-orange" : ""}>{r.average_score}%</b>
                          <span className={`bp-chip ${t.tone}`}>{t.label}</span>
                        </span>
                      )}
                    </td>
                    <td>
                      {r.attendance_percent == null ? <span className="bp-muted">—</span> : (
                        <div className="ap-att">
                          <div className="ap-att-top"><b>{r.attendance_percent}%</b><span>{r.attendance_present}/{r.attendance_total}</span></div>
                          <div className="bp-meter"><span className={r.attendance_percent < 85 ? "orange" : "ap-green"} style={{ width: `${r.attendance_percent}%` }} /></div>
                        </div>
                      )}
                    </td>
                    <td><span className={`bp-chip ${mock.tone} ap-mock`}><mock.Icon size={12} /> {mock.label}</span></td>
                    <td>
                      <div className="ap-actions">
                        <button type="button" className="bp-btn small ap-reject" disabled={processing === r.recommendation_id} onClick={() => reject(r.recommendation_id)}>
                          Reject
                        </button>
                        <button type="button" className="bp-btn navy small" disabled={processing === r.recommendation_id}
                          onClick={() => (open ? approve(r.recommendation_id) : setOpenId(r.recommendation_id))}>
                          <CircleCheck size={13} /> {processing === r.recommendation_id ? "Approving…" : open ? "Confirm" : "Approve"}
                        </button>
                      </div>
                    </td>
                  </tr>,
                  open && (
                    <tr key={`${r.recommendation_id}-form`} className="ap-form-row">
                      <td colSpan={6}>
                        <div className="ap-form">
                          {r.recommendation_note && (
                            <p className="ap-note"><MessageSquareText size={13} /> {r.recommended_by || "Trainer"}: “{r.recommendation_note}”</p>
                          )}
                          <label className="bp-field">
                            <span>Internship start date</span>
                            <input type="date" value={startDates[r.recommendation_id] || ""}
                              onChange={(e) => setStartDates((prev) => ({ ...prev, [r.recommendation_id]: e.target.value }))} />
                          </label>
                          <p className="bp-person-sub" style={{ margin: 0 }}>HR assigns the reporting manager after approval.</p>
                          <button type="button" className="bp-btn navy" disabled={processing === r.recommendation_id}
                            onClick={() => approve(r.recommendation_id)}>
                            <CircleCheck size={14} /> Approve internship
                          </button>
                          <button type="button" className="bp-btn outline" onClick={() => setOpenId(null)}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
        )}

        <div className="bp-pager">
          <span>
            {isHistory
              ? <>Showing <b>{shownHistory.length}</b> of <b>{history.length}</b> decisions · {approvedTotal} approved, {data.decisions.length - approvedTotal} rejected</>
              : <>Showing <b>{shown.length}</b> of <b>{filtered.length}</b> pending requests</>}
          </span>
          <div className="bp-pages">
            <button type="button" className="bp-page-btn" disabled={current === 1} onClick={() => setPage(current - 1)}>‹ Previous</button>
            {Array.from({ length: pages }, (_, idx) => idx + 1).map((p) => (
              <button key={p} type="button" className={`bp-page-btn ${p === current ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button type="button" className="bp-page-btn" disabled={current === pages} onClick={() => setPage(current + 1)}>Next ›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InternshipApprovals;
