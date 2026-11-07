import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Calendar, CheckCircle2, Check, ClipboardList, Clock, PartyPopper, Search, X, XCircle } from "lucide-react";
import client from "../../../api/client";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import Pagination, { paginate } from "../../../components/Pagination";
import "../../student/styles/StudentDashboard.css";
import "../styles/Attendance.css";
import "../styles/PromotionApprovals.css";

const PAGE_SIZE = 8;

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function daysAgo(d) {
  if (!d) return null;
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  return Math.max(0, days);
}

function agoText(days) {
  if (days === null) return "";
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

// System Administrator's decision screen for promotion requests drafted
// by HR. HR's own read-only Promotions page is untouched (see Promotions.jsx).
function PromotionApprovals() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const [target, setTarget] = useState(null); // { promotion, action }
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = async () => {
    setError("");
    try {
      const { data } = await client.get("/api/hr/promotions/");
      setPromotions(data);
    } catch (err) {
      setError("Couldn't load promotion requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const years = useMemo(() => {
    const set = new Set([new Date().getFullYear()]);
    promotions.forEach((p) => set.add(new Date(p.effective_date).getFullYear()));
    return [...set].sort((a, b) => b - a);
  }, [promotions]);

  const pending = useMemo(
    () =>
      promotions
        .filter((p) => p.status === "PENDING")
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [promotions]
  );

  const inYear = (p) => new Date(p.effective_date).getFullYear() === year;
  const approvedCount = promotions.filter((p) => p.status === "APPROVED" && inYear(p)).length;
  const rejectedCount = promotions.filter((p) => p.status === "REJECTED" && inYear(p)).length;

  const history = useMemo(() => {
    const q = search.trim().toLowerCase();
    return promotions
      .filter((p) => p.status !== "PENDING")
      .filter((p) => historyFilter === "ALL" || p.status === historyFilter)
      .filter(
        (p) =>
          !q ||
          (p.full_name || "").toLowerCase().includes(q) ||
          (p.employee_code || "").toLowerCase().includes(q) ||
          (p.new_designation_name || "").toLowerCase().includes(q)
      )
      .sort((a, b) => new Date(b.approval_date || b.created_at) - new Date(a.approval_date || a.created_at));
  }, [promotions, search, historyFilter]);

  useEffect(() => setPage(1), [search, historyFilter]);

  const openDecision = (promotion, action) => {
    setTarget({ promotion, action });
    setNote("");
    setActionError("");
  };

  const confirm = async () => {
    if (!target) return;
    setWorking(true);
    setActionError("");
    try {
      const body = note.trim() ? { remarks: note.trim() } : {};
      await client.post(`/api/hr/promotions/${target.promotion.promotion_id}/${target.action}/`, body);
      setTarget(null);
      await load();
    } catch (err) {
      setActionError(err.response?.data?.detail || `Couldn't ${target.action} that request.`);
    } finally {
      setWorking(false);
    }
  };

  const stats = [
    { label: "Awaiting your decision", value: pending.length, icon: Clock, tone: "amber" },
    { label: `Approved in ${year}`, value: approvedCount, icon: CheckCircle2, tone: "green" },
    { label: `Rejected in ${year}`, value: rejectedCount, icon: XCircle, tone: rejectedCount === 0 ? "grey" : "red" },
    { label: "Total requests", value: promotions.length, icon: ClipboardList, tone: "blue" },
  ];

  return (
    <div className="pa-screen">
      <div className="pa-head">
        <div>
          <h1>Promotion approvals</h1>
          <p>Review and decide on promotion requests submitted by HR.</p>
        </div>
        <label className="pa-year">
          <span>Stats for</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="pa-error">{error}</p>}

      <div className="att2-cards att2-four att2-static">
        {stats.map((s) => (
          <div key={s.label} className={"att2-card tone-" + s.tone}>
            <span className="att2-card-top">
              <span className="att2-card-icon"><s.icon size={16} /></span>
              <b>{s.value}</b>
            </span>
            <span className="att2-card-label">{s.label}</span>
          </div>
        ))}
      </div>

      <section className="pa-section">
        <div className="pa-section-head">
          <h2>Needs your decision</h2>
          {pending.length > 0 && <span className="pa-count">{pending.length}</span>}
        </div>

        {loading ? (
          <p className="pa-empty">Loading…</p>
        ) : pending.length === 0 ? (
          <div className="pa-caught-up">
            <PartyPopper size={26} />
            <strong>You're all caught up</strong>
            <span>No promotion requests are waiting for a decision.</span>
          </div>
        ) : (
          <div className="pa-pending">
            {pending.map((p) => {
              const days = daysAgo(p.created_at);
              return (
                <article key={p.promotion_id} className="pa-card">
                  <div className="pa-card-top">
                    <EmployeeAvatar personId={p.person_id} size={40} />
                    <div className="pa-who">
                      <strong>{p.full_name}</strong>
                      <span>
                        {p.employee_code ? `${p.employee_code} · ` : ""}requested {agoText(days)}
                      </span>
                    </div>
                    <span className="pa-wait">
                      <Clock size={12} /> Waiting {days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`}
                    </span>
                  </div>

                  <div className="pa-flow">
                    <span className="pa-from">{p.previous_designation_name || "—"}</span>
                    <ArrowRight size={16} />
                    <span className="pa-to">{p.new_designation_name}</span>
                  </div>

                  <p className="pa-reason">{p.reason ? p.reason : <em>No reason given.</em>}</p>

                  <div className="pa-meta">
                    <Calendar size={13} /> Effective {formatDate(p.effective_date)}
                  </div>

                  <div className="pa-actions">
                    <button type="button" className="pa-btn pa-btn-reject" onClick={() => openDecision(p, "reject")}>
                      <X size={15} /> Reject
                    </button>
                    <button type="button" className="pa-btn pa-btn-approve" onClick={() => openDecision(p, "approve")}>
                      <Check size={15} /> Approve
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="pa-section">
        <div className="pa-section-head">
          <h2>History</h2>
        </div>
        <div className="pa-panel">
          <div className="pa-toolbar">
            <div className="pa-search">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search employee, code or designation"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="pa-seg">
              {[
                ["ALL", "All"],
                ["APPROVED", "Approved"],
                ["REJECTED", "Rejected"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={historyFilter === key ? "active" : ""}
                  onClick={() => setHistoryFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {history.length === 0 ? (
            <p className="pa-empty">No decisions to show yet.</p>
          ) : (
            <>
              <div className="pa-table-scroll">
                <table className="pa-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Promotion</th>
                      <th>Effective</th>
                      <th>Status</th>
                      <th>Decided by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginate(history, page, PAGE_SIZE).map((p) => (
                      <tr key={p.promotion_id}>
                        <td>
                          <div className="pa-emp">
                            <EmployeeAvatar personId={p.person_id} size={30} />
                            <div>
                              <strong>{p.full_name}</strong>
                              <span>{p.employee_code}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="pa-trans">
                            {p.previous_designation_name || "—"} <ArrowRight size={12} /> <b>{p.new_designation_name}</b>
                          </span>
                          {p.remarks && <span className="pa-remark">“{p.remarks}”</span>}
                        </td>
                        <td>{formatDate(p.effective_date)}</td>
                        <td>
                          <span className={"pa-pill pa-pill-" + p.status.toLowerCase()}>
                            {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td>
                          <div className="pa-by">
                            <span>{p.approved_by_name || "—"}</span>
                            {p.approval_date && <small>{formatDate(p.approval_date)}</small>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalItems={history.length} onPageChange={setPage} pageSize={PAGE_SIZE} />
            </>
          )}
        </div>
      </section>

      {target && (
        <div className="pa-backdrop" onClick={() => !working && setTarget(null)}>
          <div className="pa-modal" onClick={(e) => e.stopPropagation()}>
            <div className={"pa-modal-icon " + target.action}>
              {target.action === "approve" ? <Check size={20} /> : <X size={20} />}
            </div>
            <h3>
              {target.action === "approve" ? "Approve" : "Reject"} {target.promotion.full_name}'s promotion?
            </h3>
            <p className="pa-modal-sub">
              {target.promotion.previous_designation_name || "—"} → <b>{target.promotion.new_designation_name}</b> ·
              Effective {formatDate(target.promotion.effective_date)}
            </p>
            {target.action === "approve" && (
              <p className="pa-modal-hint">Their designation will be updated as soon as you approve.</p>
            )}
            <label htmlFor="pa-note">Note (optional)</label>
            <textarea
              id="pa-note"
              rows={3}
              maxLength={300}
              placeholder={target.action === "approve" ? "Add a comment for HR…" : "Tell HR why it was rejected…"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {actionError && <p className="pa-error">{actionError}</p>}
            <div className="pa-modal-actions">
              <button type="button" className="pa-btn pa-btn-ghost" onClick={() => setTarget(null)} disabled={working}>
                Cancel
              </button>
              <button
                type="button"
                className={"pa-btn " + (target.action === "approve" ? "pa-btn-approve" : "pa-btn-reject-solid")}
                onClick={confirm}
                disabled={working}
              >
                {working ? "Working…" : target.action === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PromotionApprovals;
