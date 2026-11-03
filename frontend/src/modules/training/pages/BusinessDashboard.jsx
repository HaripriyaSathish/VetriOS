import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Zap, TrendingUp, MessageSquareText, GraduationCap, TriangleAlert, IndianRupee, ArrowRight,
  ChevronDown, Bell, Plus, ShieldCheck, Check,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessDashboard.css";

const rupee = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function dueText(days) {
  if (days < 0) return { text: `Overdue by ${-days} day${days === -1 ? "" : "s"}`, late: true };
  if (days === 0) return { text: "Due today", late: false };
  return { text: `Due in ${days} day${days === 1 ? "" : "s"}`, late: false };
}

const ENQUIRY_TAG = {
  new: { label: "New", tone: "blue" },
  shortlisted: { label: "Follow-up", tone: "orange" },
  fee: { label: "Fee pending", tone: "red" },
  converted: { label: "Converted", tone: "green" },
};

const APPROVAL_TAG = {
  internship: { label: "Internship", tone: "blue" },
  completion: { label: "Completion", tone: "green" },
  extension: { label: "Extension", tone: "orange" },
};

const AVATAR_TONES = ["blue", "orange", "pink", "green"];

function BusinessDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("month");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(null);
  const [managers, setManagers] = useState([]);

  const load = (p = period) =>
    client.get("/api/training/business/dashboard/", { params: { period: p } })
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load the dashboard."));

  useEffect(() => { load(period); }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manager options for the inline "Assign manager" picker — same lookup
  // the Assign Reporting Manager page uses; only fetched when needed.
  useEffect(() => {
    if (data?.unassigned_interns?.length && managers.length === 0) {
      client.get("/api/projects/users-lookup/").then(({ data }) => setManagers(data || [])).catch(() => {});
    }
  }, [data, managers.length]);

  const run = async (key, action, successText) => {
    setBusy(key);
    setNotice("");
    try {
      await action();
      setNotice(successText);
      await load();
    } catch (err) {
      setNotice(err.response?.data?.detail || "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const approve = (a) => {
    if (a.kind === "internship") {
      // Approving needs a reporting manager + start date — done on its page.
      navigate("/training/internship-approvals");
      return;
    }
    if (a.kind === "completion") {
      if (!window.confirm(`Approve completion for ${a.name}? This applies the outcome (${a.detail}).`)) return;
      run(`a-${a.kind}-${a.id}`, () => client.patch(`/api/interns/completions/${a.id}/approve/`), "Completion approved.");
      return;
    }
    run(`a-${a.kind}-${a.id}`, () => client.patch(`/api/interns/extensions/${a.id}/act/`, { decision: "APPROVED" }), "Extension approved.");
  };

  const reject = (a) => {
    if (a.kind === "internship") {
      const note = window.prompt("Reason for rejection (optional):", "");
      if (note === null) return;
      run(`r-${a.kind}-${a.id}`, () => client.post(`/api/interns/${a.id}/reject/`, { review_note: note }), "Recommendation rejected.");
      return;
    }
    run(`r-${a.kind}-${a.id}`, () => client.patch(`/api/interns/extensions/${a.id}/act/`, { decision: "REJECTED" }), "Extension rejected.");
  };

  const sendReminder = (f) => {
    const due = dueText(f.days_left);
    const message = `Hi ${f.name}, a friendly reminder from Vetri IT Systems: installment ${f.installment_number} of ${rupee(f.amount)} for ${f.course_name} is ${due.text.toLowerCase()}.`;
    const phone = String(f.whatsapp_number || "").replace(/\D/g, "");
    window.open(`https://wa.me/${phone.length === 10 ? `91${phone}` : phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    run(`f-${f.installment_id}`, () => client.post(`/api/admissions/installments/${f.installment_id}/mark-reminder-sent/`), `Reminder opened for ${f.name}.`);
  };

  const assignManager = (internId, managerId) => {
    if (!managerId) return;
    run(`i-${internId}`, () => client.post(`/api/interns/${internId}/assign-manager/`, { manager_user_id: managerId }), "Reporting manager assigned.");
  };

  if (error) return <p className="bd-error">{error}</p>;
  if (!data) return <p className="bd-loading">Loading dashboard…</p>;

  const s = data.summary;
  const f = data.funnel;
  const fees = data.fees;
  const feeTotal = Number(fees.collected) + Number(fees.pending);
  const collectedPct = pct(Number(fees.collected), feeTotal);
  const overduePct = pct(Number(fees.overdue), feeTotal);
  const pendingPct = Math.max(0, Math.round((100 - collectedPct - overduePct) * 10) / 10);

  const steps = [
    { label: "Step 1: Enquiries", value: f.enquiries, chip: "100% baseline", tone: "navy" },
    { label: "Step 2: Follow-ups Completed", value: f.followed_up, chip: `${pct(f.followed_up, f.enquiries)}% of total`, tone: "navy" },
    { label: "Step 3: Fee Initialized / Paid", value: f.fee_initialized, chip: `${pct(f.fee_initialized, f.enquiries)}% of total`, tone: "blue" },
    { label: "Step 4: Fully Enrolled", value: f.enrolled, chip: `${pct(f.enrolled, f.enquiries)}% final`, tone: "orange" },
  ];

  return (
    <div className="bd-page">
      {/* ---------- Hero ---------- */}
      <section className="bd-hero">
        <span className="bd-hero-orb orb-a" aria-hidden="true" />
        <span className="bd-hero-orb orb-b" aria-hidden="true" />
        <div className="bd-hero-text">
          <span className="bd-live"><Zap size={12} /> Live operations pulse</span>
          <h1>
            {greeting()}, {data.first_name}! {s.new_enquiries} new enquir{s.new_enquiries === 1 ? "y" : "ies"} and{" "}
            {s.pending_approvals} approval{s.pending_approvals === 1 ? "" : "s"} need your attention today.
          </h1>
          <p>Turn enquiries into enrolled students and keep every talent pipeline moving forward without bottlenecks.</p>
        </div>
        <div className="bd-hero-chips">
          <div className="bd-glass">
            <span className="bd-glass-dot" />
            <div>
              <p>Active Batches</p>
              <b>{s.active_batches} Cohort{s.active_batches === 1 ? "" : "s"}</b>
            </div>
          </div>
          <div className="bd-glass">
            <TrendingUp size={18} className="bd-glass-icon" />
            <div>
              <p>Conversion Rate</p>
              <b>{s.conversion_rate != null ? `${s.conversion_rate}%` : "—"}</b>
            </div>
          </div>
        </div>
      </section>

      {notice && <p className="bd-notice">{notice}</p>}

      {/* ---------- KPI cards ---------- */}
      <div className="bd-kpis">
        <Link to="/training/enquiries" className="bd-kpi" style={{ "--i": 0 }}>
          <div className="bd-kpi-top">
            <div>
              <p className="bd-kpi-label">New enquiries</p>
              <p className="bd-kpi-value">{s.new_enquiries}</p>
            </div>
            <span className="bd-kpi-icon blue"><MessageSquareText size={18} /></span>
          </div>
          <div className="bd-kpi-foot">
            <span>Awaiting first contact</span>
            <span className="bd-arrow blue"><ArrowRight size={14} /></span>
          </div>
        </Link>

        <Link to="/training/students" className="bd-kpi" style={{ "--i": 1 }}>
          <div className="bd-kpi-top">
            <div>
              <p className="bd-kpi-label">Enrolled students</p>
              <p className="bd-kpi-value">
                {s.enrolled_students}
                {s.enrolled_this_month > 0 && <span className="bd-chip green">+{s.enrolled_this_month} this mo</span>}
              </p>
            </div>
            <span className="bd-kpi-icon green"><GraduationCap size={18} /></span>
          </div>
          <div className="bd-kpi-foot">
            <span>Active across {s.active_cohorts} cohort{s.active_cohorts === 1 ? "" : "s"}</span>
            <span className="bd-arrow blue"><ArrowRight size={14} /></span>
          </div>
        </Link>

        <Link to="/training/internship-approvals" className="bd-kpi warn" style={{ "--i": 2 }}>
          <div className="bd-kpi-top">
            <div>
              <p className="bd-kpi-label">Pending approvals {s.pending_approvals > 0 && <span className="bd-pulse" />}</p>
              <p className="bd-kpi-value">{s.pending_approvals}</p>
            </div>
            <span className="bd-kpi-icon orange"><TriangleAlert size={18} /></span>
          </div>
          <div className="bd-kpi-foot">
            <span>Needs manager sign-off</span>
            <span className="bd-arrow orange"><ArrowRight size={14} /></span>
          </div>
        </Link>

        <Link to="/training/fee-conversion" className="bd-kpi danger" style={{ "--i": 3 }}>
          <div className="bd-kpi-top">
            <div>
              <p className="bd-kpi-label">Fees due</p>
              <p className="bd-kpi-value">
                {s.fees_due_count} <small>milestone{s.fees_due_count === 1 ? "" : "s"}</small>
              </p>
            </div>
            <span className="bd-kpi-icon red"><IndianRupee size={18} /></span>
          </div>
          <div className="bd-kpi-foot">
            <span>{rupee(s.fees_due_amount)} pending</span>
            <span className="bd-arrow red"><ArrowRight size={14} /></span>
          </div>
        </Link>
      </div>

      {/* ---------- Funnel + approvals ---------- */}
      <div className="bd-row bd-row-wide">
        <div className="bd-card" style={{ "--i": 4 }}>
          <div className="bd-card-head">
            <div>
              <h3>Enquiry to enrollment funnel</h3>
              <p>Monthly lead transition velocity and conversion dropoffs</p>
            </div>
            <label className="bd-select">
              <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Funnel period">
                <option value="month">This month</option>
                <option value="all">All time</option>
              </select>
              <ChevronDown size={14} />
            </label>
          </div>

          <div className="bd-funnel">
            {steps.map((st, i) => (
              <div key={st.label} className="bd-step" style={{ "--i": i }}>
                <div className="bd-step-head">
                  <span className={`bd-dot ${st.tone}`} />
                  <span className="bd-step-label">{st.label}</span>
                  <b className={st.tone === "orange" ? "bd-orange" : ""}>{st.value}</b>
                  <span className={`bd-chip ${st.tone === "orange" ? "orange" : "blue"}`}>{st.chip}</span>
                </div>
                <div className="bd-bar">
                  <span className={st.tone} style={{ width: `${f.enquiries ? (st.value / f.enquiries) * 100 : 0}%`, "--i": i }} />
                </div>
              </div>
            ))}
            {f.enquiries === 0 && (
              <p className="bd-empty">No enquiries {f.period === "month" ? "this month yet — switch to All time" : "yet"}.</p>
            )}
          </div>

          <div className="bd-rates">
            <div><p>Inquiry → Connect</p><b>{pct(f.followed_up, f.enquiries)}%</b></div>
            <div><p>Connect → Payment</p><b>{pct(f.fee_initialized, f.followed_up)}%</b></div>
            <div><p>Payment → Onboarding</p><b className="bd-orange">{pct(f.enrolled, f.fee_initialized)}%</b></div>
          </div>
        </div>

        <div className="bd-card" style={{ "--i": 5 }}>
          <div className="bd-card-head">
            <h3>
              Approvals waiting
              {data.approvals_total > 0 && <span className="bd-chip orange">{data.approvals_total} Pending</span>}
            </h3>
            <Link to="/training/internship-approvals" className="bd-link">View all</Link>
          </div>
          {data.approvals.length === 0 ? (
            <div className="bd-allclear">
              <span><Check size={20} strokeWidth={3} /></span>
              <p>All caught up — no approvals waiting.</p>
            </div>
          ) : (
            <div className="bd-approvals">
              {data.approvals.map((a, i) => {
                const tag = APPROVAL_TAG[a.kind];
                const key = `${a.kind}-${a.id}`;
                return (
                  <div key={key} className="bd-approval" style={{ "--i": i }}>
                    <div className="bd-approval-text">
                      <p className="bd-approval-name">
                        {a.name}
                        <span className={`bd-tag ${tag.tone}`}>{tag.label}</span>
                      </p>
                      <p className="bd-approval-detail">{a.detail}</p>
                    </div>
                    <div className="bd-approval-actions">
                      {a.kind === "completion" ? (
                        <Link to="/training/completion-extension-approvals" className="bd-btn ghost">Review</Link>
                      ) : (
                        <button type="button" className="bd-btn ghost" disabled={busy === `r-${key}`} onClick={() => reject(a)}>
                          Reject
                        </button>
                      )}
                      <button type="button" className="bd-btn navy" disabled={busy === `a-${key}`} onClick={() => approve(a)}>
                        Approve
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {data.approvals_total > data.approvals.length && (
            <p className="bd-card-foot">
              {data.approvals_total - data.approvals.length} more request{data.approvals_total - data.approvals.length === 1 ? "" : "s"} in verification queue
            </p>
          )}
        </div>
      </div>

      {/* ---------- Enquiries + fees ---------- */}
      <div className="bd-row">
        <div className="bd-card" style={{ "--i": 6 }}>
          <div className="bd-card-head">
            <h3>
              Recent enquiries
              <span className="bd-chip blue">{data.new_today} New Today</span>
            </h3>
            <Link to="/training/enquiries" className="bd-link">View all leads</Link>
          </div>
          {data.recent_enquiries.length === 0 ? (
            <p className="bd-empty">No enquiries yet.</p>
          ) : (
            <div className="bd-list">
              {data.recent_enquiries.map((e, i) => {
                const tagKey = e.status === "shortlisted" && e.has_fee_plan ? "fee" : e.status;
                const tag = ENQUIRY_TAG[tagKey] || { label: e.status, tone: "blue" };
                return (
                  <div key={e.enquiry_id} className="bd-list-row" style={{ "--i": i }}>
                    <span className={`bd-avatar ${AVATAR_TONES[i % AVATAR_TONES.length]}`}>{initialsOf(e.name)}</span>
                    <div className="bd-list-text">
                      <p className="bd-list-name">
                        {e.name}
                        <span className={`bd-tag ${tag.tone}`}>{tagKey === "converted" && <Check size={10} strokeWidth={3} />} {tag.label}</span>
                      </p>
                      <p className="bd-list-sub">{e.course_name} • {e.source === "other" ? "Other source" : e.source}</p>
                    </div>
                    {e.status === "converted" ? (
                      e.person_id
                        ? <Link to={`/training/students/${e.person_id}`} className="bd-btn soft">Profile</Link>
                        : <span className="bd-btn soft">Enrolled</span>
                    ) : e.status === "shortlisted" ? (
                      <Link to={`/training/fee-conversion/${e.enquiry_id}`} className="bd-btn navy">Convert</Link>
                    ) : (
                      <Link to="/training/enquiries" className="bd-btn navy">Review</Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bd-card" style={{ "--i": 7 }}>
          <div className="bd-card-head">
            <h3>Fee tracking</h3>
            <p className="bd-fee-totals">
              <span className="bd-green">{rupee(fees.collected)} Collected</span> · <span className="bd-red">{rupee(fees.pending)} Pending</span>
            </p>
          </div>
          <div className="bd-feebar" role="img" aria-label={`${collectedPct}% collected, ${overduePct}% overdue`}>
            <span className="green" style={{ width: `${collectedPct}%` }} />
            <span className="red" style={{ width: `${overduePct}%` }} />
            <span className="amber" style={{ width: `${pendingPct}%` }} />
          </div>
          <div className="bd-fee-legend">
            <span><i className="green" /> {collectedPct}% Collected</span>
            <span className="bd-red"><i className="red" /> {overduePct}% Overdue · {pendingPct}% Upcoming</span>
          </div>
          {fees.rows.length === 0 ? (
            <p className="bd-empty">No pending installments.</p>
          ) : (
            <div className="bd-list">
              {fees.rows.map((r, i) => {
                const due = dueText(r.days_left);
                return (
                  <div key={r.installment_id} className={`bd-fee-row ${due.late ? "late" : ""}`} style={{ "--i": i }}>
                    <div className="bd-list-text">
                      <p className="bd-list-name">
                        {r.name} <span className="bd-amount">{rupee(r.amount)}</span>
                      </p>
                      <p className={`bd-list-sub ${due.late ? "bd-red" : ""}`}>{r.course_name} · {due.text}</p>
                    </div>
                    <button
                      type="button"
                      className={`bd-btn ${due.late ? "danger" : "outline"}`}
                      disabled={busy === `f-${r.installment_id}` || !r.whatsapp_number}
                      onClick={() => sendReminder(r)}
                      title={r.reminder_sent ? "A reminder was already sent — sends again" : "Opens WhatsApp with a reminder"}
                    >
                      <Bell size={13} /> {r.reminder_sent ? "Remind again" : "Send reminder"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Interns, batches, audit ---------- */}
      <div className="bd-row bd-row-3">
        <div className="bd-card" style={{ "--i": 8 }}>
          <div className="bd-card-head">
            <h3>
              Unassigned interns
              {data.unassigned_total > 0 && <span className="bd-chip red">{data.unassigned_total} Unassigned</span>}
            </h3>
          </div>
          {data.unassigned_interns.length === 0 ? (
            <div className="bd-allclear">
              <span><Check size={20} strokeWidth={3} /></span>
              <p>Every intern has a reporting manager.</p>
            </div>
          ) : (
            <div className="bd-list">
              {data.unassigned_interns.map((it, i) => (
                <div key={it.intern_id} className="bd-intern" style={{ "--i": i }}>
                  <div className="bd-intern-head">
                    <p className="bd-list-name">{it.name}</p>
                    <span className="bd-list-sub">{it.intern_code}</span>
                  </div>
                  <label className="bd-select full">
                    <select
                      defaultValue=""
                      disabled={busy === `i-${it.intern_id}`}
                      onChange={(e) => assignManager(it.intern_id, e.target.value)}
                      aria-label={`Assign manager for ${it.name}`}
                    >
                      <option value="">Assign manager…</option>
                      {managers.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
                    </select>
                    <ChevronDown size={14} />
                  </label>
                </div>
              ))}
            </div>
          )}
          <div className="bd-card-foot split">
            <span>{data.unassigned_total} awaiting a manager</span>
            <Link to="/training/assign-reporting-manager" className="bd-link">Manage all</Link>
          </div>
        </div>

        <div className="bd-card" style={{ "--i": 9 }}>
          <div className="bd-card-head">
            <h3>Upcoming batches</h3>
            <Link to="/training/batches/new" className="bd-btn navy small"><Plus size={13} /> New batch</Link>
          </div>
          {data.upcoming_batches.length === 0 ? (
            <p className="bd-empty">No batches starting soon. <Link to="/training/management" className="bd-link">See all batches</Link></p>
          ) : (
            <div className="bd-list">
              {data.upcoming_batches.map((b, i) => {
                const fill = b.capacity ? Math.round((b.enrolled / b.capacity) * 100) : null;
                const tone = ["navy", "orange", "blue"][i % 3];
                return (
                  <Link key={b.batch_id} to={`/training/batches/${b.batch_id}`} className="bd-batch" style={{ "--i": i }}>
                    <div className="bd-batch-head">
                      <p className="bd-list-name">{b.batch_name}</p>
                      <span className="bd-list-sub">
                        {new Date(`${b.start_date}T00:00:00`).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div className="bd-batch-meta">
                      <span>Enrollment progress</span>
                      <b className={tone === "orange" ? "bd-orange" : ""}>
                        {b.enrolled}{b.capacity ? `/${b.capacity}` : ""} filled{fill != null ? ` (${fill}%)` : ""}
                      </b>
                    </div>
                    <div className="bd-bar thin">
                      <span className={tone} style={{ width: `${fill ?? 0}%`, "--i": i }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          <div className="bd-card-foot split">
            <span>Total capacity: {data.capacity_total} seats</span>
            <span className="bd-green">{pct(data.capacity_filled, data.capacity_total)}% Occupied</span>
          </div>
        </div>

        <div className="bd-card" style={{ "--i": 10 }}>
          <div className="bd-card-head">
            <h3>Recent audit activity</h3>
            <Link to="/audit" className="bd-link">View Audit Logs</Link>
          </div>
          {data.audit.length === 0 ? (
            <p className="bd-empty">No activity logged yet.</p>
          ) : (
            <div className="bd-list">
              {data.audit.map((a, i) => (
                <div key={a.audit_id} className="bd-audit" style={{ "--i": i }}>
                  <span className={`bd-avatar small ${AVATAR_TONES[i % AVATAR_TONES.length]}`}>{initialsOf(a.user)}</span>
                  <div className="bd-list-text">
                    <p className="bd-list-name">{a.user}</p>
                    <p className="bd-list-sub">{a.remarks || `${a.action.toLowerCase()} · ${a.entity_type}`}</p>
                  </div>
                  <span className="bd-when">{timeAgo(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="bd-card-foot split">
            <span>Every change is recorded</span>
            <ShieldCheck size={15} className="bd-green" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default BusinessDashboard;
