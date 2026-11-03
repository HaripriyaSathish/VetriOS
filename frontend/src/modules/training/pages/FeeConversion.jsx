import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileDown, ReceiptText, CircleCheck, CalendarClock, TrendingUp, TrendingDown, CalendarDays, Bell, IndianRupee,
  ShieldCheck, ArrowRight, Wallet,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/FeeConversion.css";

const PERIODS = [
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
  { key: "ytd", label: "YTD" },
];

const rupee = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function dueState(days) {
  if (days < 0) return { label: "Overdue", tone: "red" };
  if (days === 0) return { label: "Due Today", tone: "orange" };
  return { label: "Upcoming", tone: "blue" };
}

function downloadReport(fees) {
  const s = fees.summary;
  const lines = [
    ["Summary", ""],
    ["Total billed", s.billed],
    ["Collected (" + fees.period + ")", s.collected],
    ["Pending dues", s.pending],
    ["Overdue installments", s.overdue_count],
    ["Conversion rate %", s.conversion_rate ?? ""],
    [],
    ["Student", "Course", "Installment", "Amount", "Plan total", "Due date", "Status"],
    ...fees.installments.map((r) => [
      r.name, r.course_name, `${r.installment_number}/${r.installment_count}`, r.amount, r.plan_total, r.due_date,
      dueState(r.days_left).label,
    ]),
  ];
  const csv = lines.map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `finance_report_${fees.period}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function FeeConversion() {
  const [enquiries, setEnquiries] = useState([]);
  const [fees, setFees] = useState(null);
  const [period, setPeriod] = useState("month");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const loadFees = (p) =>
    client.get("/api/training/business/fees/", { params: { period: p } })
      .then(({ data }) => setFees(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load fee tracking."));

  useEffect(() => {
    client.get("/api/admissions/shortlisted/")
      .then(({ data }) => setEnquiries(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load shortlisted enquiries."));
  }, []);

  useEffect(() => { loadFees(period); }, [period]);

  const sendReminder = async (r) => {
    const due = dueState(r.days_left);
    const when = r.days_left < 0 ? `was due on ${r.due_date}` : r.days_left === 0 ? "is due today" : `is due on ${r.due_date}`;
    const message = `Hi ${r.name}, a friendly reminder from Vetri IT Systems: installment ${r.installment_number} of ${rupee(r.amount)} for ${r.course_name} ${when}.`;
    const phone = String(r.whatsapp_number || "").replace(/\D/g, "");
    window.open(`https://wa.me/${phone.length === 10 ? `91${phone}` : phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    setBusy(`r-${r.installment_id}`);
    try {
      await client.post(`/api/admissions/installments/${r.installment_id}/mark-reminder-sent/`);
      setNotice(`Reminder opened in WhatsApp for ${r.name} (${due.label.toLowerCase()}).`);
      await loadFees(period);
    } catch (err) {
      setNotice(err.response?.data?.detail || "Couldn't mark the reminder as sent.");
    } finally {
      setBusy(null);
    }
  };

  const recordPayment = async (r) => {
    if (!window.confirm(`Record ${rupee(r.amount)} as paid today for ${r.name} (installment ${r.installment_number})?`)) return;
    setBusy(`p-${r.installment_id}`);
    try {
      await client.post(`/api/admissions/installments/${r.installment_id}/mark-paid/`);
      setNotice(`Payment recorded for ${r.name}.`);
      await loadFees(period);
    } catch (err) {
      setNotice(err.response?.data?.detail || "Couldn't record the payment.");
    } finally {
      setBusy(null);
    }
  };

  if (!fees && !error) return <p className="bp-loading">Loading fee tracking…</p>;

  const s = fees?.summary;
  const change = s?.collected_change_percent;
  const rows = fees ? (showAll ? fees.installments : fees.installments.slice(0, 6)) : [];

  return (
    <div className="bp-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Finance &amp; Operations / <span>Revenue Engine</span></p>
          <h1 className="bp-title">Fee Tracking &amp; Conversion</h1>
          <p className="bp-sub">Monitor real-time revenue collection, delinquent installments, and cohort conversion velocity.</p>
        </div>
        <div className="bp-actions">
          <div className="bp-tabs">
            {PERIODS.map((p) => (
              <button key={p.key} type="button" className={`bp-tab ${period === p.key ? "active" : ""}`} onClick={() => setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
          <button type="button" className="bp-btn navy" onClick={() => fees && downloadReport(fees)} disabled={!fees}>
            <FileDown size={15} /> Download Finance Report
          </button>
        </div>
      </div>

      {error && <p className="bp-error">{error}</p>}
      {notice && <p className="bp-notice">{notice}</p>}

      {s && (
        <div className="bp-stats fc-stats">
          <div className="bp-stat fc-stat" style={{ "--i": 0 }}>
            <div className="bp-stat-top">
              <p className="bp-stat-label">Total Billed</p>
              <span className="bp-stat-icon"><ReceiptText size={17} /></span>
            </div>
            <p className="bp-stat-value">{rupee(s.billed)}</p>
            <p className="fc-foot"><CalendarDays size={12} /> {s.fee_plans} fee plan{s.fee_plans === 1 ? "" : "s"} on record</p>
          </div>

          <div className="bp-stat fc-stat green" style={{ "--i": 1 }}>
            <div className="bp-stat-top">
              <p className="bp-stat-label">Collected ({PERIODS.find((p) => p.key === period).label})</p>
              <span className="bp-stat-icon green"><CircleCheck size={17} /></span>
            </div>
            <p className="bp-stat-value">{rupee(s.collected)}</p>
            <p className="fc-foot">
              {change != null && (
                <span className={`bp-chip ${change >= 0 ? "green" : "red"}`}>
                  {change >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {change >= 0 ? "+" : ""}{change}%
                </span>
              )}
              vs previous {period === "ytd" ? "year" : period === "quarter" ? "quarter" : "month"}
            </p>
          </div>

          <div className="bp-stat fc-stat red" style={{ "--i": 2 }}>
            <div className="bp-stat-top">
              <p className="bp-stat-label">Pending Dues</p>
              <span className="bp-stat-icon red"><CalendarClock size={17} /></span>
            </div>
            <p className="bp-stat-value fc-red">{rupee(s.pending)}</p>
            <p className="fc-foot">
              {s.overdue_count > 0 && <span className="bp-chip red">{s.overdue_count} overdue</span>}
              {s.open_installments} open installment{s.open_installments === 1 ? "" : "s"}
            </p>
          </div>

          <div className="bp-stat fc-stat orange" style={{ "--i": 3 }}>
            <div className="bp-stat-top">
              <p className="bp-stat-label">Conversion Rate</p>
              <span className="bp-stat-icon orange"><TrendingUp size={17} /></span>
            </div>
            <p className="bp-stat-value">{s.conversion_rate != null ? `${s.conversion_rate}%` : "—"}</p>
            <p className="fc-foot"><span className="fc-dot" /> Enquiry to Enrolled</p>
          </div>
        </div>
      )}

      {fees && (
        <div className="bp-panel">
          <div className="fc-panel-head">
            <div>
              <h3>Pending Fee Reminders</h3>
              <p>Follow up on open installments and send WhatsApp reminders.</p>
            </div>
            <span className="bp-chip blue">{fees.installments.length} Actionable Record{fees.installments.length === 1 ? "" : "s"}</span>
          </div>
          <div className="bp-table-wrap">
            <table className="bp-table">
              <thead>
                <tr>
                  <th>Student Details</th>
                  <th>Total / Due (₹)</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className="bp-empty-row"><td colSpan={5}>No open installments — every fee plan is settled.</td></tr>
                ) : rows.map((r, i) => {
                  const st = dueState(r.days_left);
                  return (
                    <tr key={r.installment_id} style={{ "--row": i }}>
                      <td>
                        <div className="bp-person">
                          <span className={`bp-avatar t${i % 4}`}>{initialsOf(r.name)}</span>
                          <div>
                            <p className="bp-person-name">{r.name}</p>
                            <p className="bp-person-sub">{r.course_name} · Installment {r.installment_number}/{r.installment_count}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="bp-strong" style={{ margin: 0 }}>{rupee(r.plan_total)}</p>
                        <p className="fc-due">Due: {rupee(r.amount)}</p>
                      </td>
                      <td className="bp-strong">
                        {r.days_left === 0 ? "Today" : new Date(`${r.due_date}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td><span className={`bp-chip ${st.tone}`}>● {st.label}</span></td>
                      <td>
                        <div className="fc-actions">
                          <button type="button" className="bp-btn soft small" disabled={busy === `r-${r.installment_id}` || !r.whatsapp_number}
                            onClick={() => sendReminder(r)} title="Opens WhatsApp with a reminder">
                            <Bell size={13} /> {r.reminder_sent ? "Remind Again" : "Send Reminder"}
                          </button>
                          <button type="button" className="bp-btn navy small" disabled={busy === `p-${r.installment_id}`} onClick={() => recordPayment(r)}>
                            <IndianRupee size={13} /> Record Payment
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bp-pager">
            <span className="fc-note"><ShieldCheck size={14} /> Reminders open WhatsApp with a ready message and are logged as sent.</span>
            {fees.installments.length > 6 && (
              <button type="button" className="bp-btn outline small" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show Less" : "View All Pending Accounts"} <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bp-panel">
        <div className="fc-panel-head">
          <div>
            <h3>Awaiting Fee Plan &amp; Conversion</h3>
            <p>Shortlisted enquiries — set their fee plan, then convert them into students.</p>
          </div>
          <span className="bp-chip orange">{enquiries.length} shortlisted</span>
        </div>
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr><th>Name</th><th>Course</th><th>Email</th><th>Fee Plan</th><th>Action</th></tr>
            </thead>
            <tbody>
              {enquiries.length === 0 ? (
                <tr className="bp-empty-row"><td colSpan={5}>Nothing to convert right now.</td></tr>
              ) : enquiries.map((e, i) => (
                <tr key={e.enquiry_id} style={{ "--row": i }}>
                  <td>
                    <div className="bp-person">
                      <span className={`bp-avatar t${i % 4}`}>{initialsOf(e.name)}</span>
                      <p className="bp-person-name">{e.name}</p>
                    </div>
                  </td>
                  <td className="bp-strong">{e.course_name}</td>
                  <td className="bp-muted">{e.personal_email || "—"}</td>
                  <td><span className={`bp-chip ${e.has_fee_plan ? "green" : "gray"}`}>{e.has_fee_plan ? "Set" : "Not set"}</span></td>
                  <td>
                    <Link to={`/training/fee-conversion/${e.enquiry_id}`} className={`bp-btn small ${e.has_fee_plan ? "soft" : "orange"}`}>
                      <Wallet size={13} /> {e.has_fee_plan ? "Manage" : "Set Fee Plan"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default FeeConversion;
