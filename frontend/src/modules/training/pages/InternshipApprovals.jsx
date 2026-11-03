import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  RotateCcwClock, Search, ChevronDown, Download, CircleCheck, Clock3, TrendingUp, X, Check, FunnelX, MessageSquareText,
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

function InternshipApprovals() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(null);
  const [startDates, setStartDates] = useState({});
  const [managerIds, setManagerIds] = useState({});
  const [users, setUsers] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [search, setSearch] = useState("");
  const [track, setTrack] = useState("");
  const [tier, setTier] = useState("");
  const [page, setPage] = useState(1);

  const load = () =>
    client.get("/api/training/business/internship-approvals/")
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load pending recommendations."));

  useEffect(() => {
    load();
    client.get("/api/projects/users-lookup/").then(({ data }) => setUsers(data)).catch(() => {});
  }, []);

  const approve = async (recommendationId) => {
    const managerId = managerIds[recommendationId];
    if (!managerId) {
      setError("Please select a reporting manager before approving.");
      setOpenId(recommendationId);
      return;
    }
    setProcessing(recommendationId);
    setError("");
    try {
      const startDate = startDates[recommendationId] || new Date().toISOString().slice(0, 10);
      const { data: res } = await client.post(`/api/interns/${recommendationId}/approve/`, {
        internship_start_date: startDate,
        manager_user_id: managerId,
      });
      setMessage(`Approved — intern code ${res.intern_code} created.`);
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

  if (!data && !error) return <p className="bp-loading">Loading approvals…</p>;
  if (!data) return <p className="bp-error">{error}</p>;

  const st = data.stats;
  const tracks = [...new Set(data.pending.map((r) => r.course_name).filter(Boolean))];
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="bp-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Business Operations / <span>Approvals</span></p>
          <h1 className="bp-title">Internship Approvals</h1>
          <p className="bp-sub">Review and authorize students eligible to transition into live industry internships. Verify benchmark assessments and mock ratings before deployment.</p>
        </div>
        <div className="bp-actions">
          <button type="button" className={`bp-btn ${showLog ? "navy" : "outline"}`} onClick={() => setShowLog((v) => !v)}>
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

      {showLog && (
        <div className="bp-panel">
          <div className="ap-panel-head">
            <h3>Decision Log</h3>
            <span className="bp-chip gray">Last {data.decisions.length}</span>
          </div>
          {data.decisions.length === 0 ? <p className="ap-empty">No decisions recorded yet.</p> : (
            <div className="ap-log">
              {data.decisions.map((d, i) => (
                <div key={d.recommendation_id} className="ap-log-row" style={{ "--row": i }}>
                  <span className={`ap-log-dot ${d.status === "APPROVED" ? "green" : "red"}`}>
                    {d.status === "APPROVED" ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                  </span>
                  <div className="ap-log-text">
                    <p className="bp-person-name">{d.student_name}</p>
                    <p className="bp-person-sub">
                      {d.status === "APPROVED" ? "Approved" : "Rejected"} by {d.reviewed_by || "—"}
                      {d.review_note ? ` · “${d.review_note}”` : ""}
                    </p>
                  </div>
                  <span className="bp-muted ap-when">{new Date(d.reviewed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bp-panel">
        <div className="bp-filters">
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
          <button type="button" className="bp-btn outline small" title="Clear filters" aria-label="Clear filters"
            onClick={() => { setSearch(""); setTrack(""); setTier(""); setPage(1); }}>
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
                          onClick={() => (open && managerIds[r.recommendation_id] ? approve(r.recommendation_id) : setOpenId(open ? null : r.recommendation_id))}>
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
                          <label className="bp-field">
                            <span>Reporting manager</span>
                            <select value={managerIds[r.recommendation_id] || ""}
                              onChange={(e) => setManagerIds((prev) => ({ ...prev, [r.recommendation_id]: e.target.value }))}>
                              <option value="">Select manager…</option>
                              {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
                            </select>
                          </label>
                          <button type="button" className="bp-btn navy" disabled={processing === r.recommendation_id || !managerIds[r.recommendation_id]}
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

        <div className="bp-pager">
          <span>Showing <b>{shown.length}</b> of <b>{filtered.length}</b> pending requests</span>
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
