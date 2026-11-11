import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Wallet, Receipt, CalendarDays, ChevronDown, UserRound } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import useClientName from "../components/useClientName";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const METHOD_LABELS = {
  BANK_TRANSFER: "Bank Transfer",
  UPI: "UPI",
  CHEQUE: "Cheque",
  DD: "Demand Draft",
  CARD: "Card",
  CASH: "Cash",
  ONLINE_GATEWAY: "Online Gateway",
};

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function Payments() {
  const { clientId } = useParams();
  const clientName = useClientName(clientId);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [methodFilter, setMethodFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [chequeDdNumber, setChequeDdNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [paymentGateway, setPaymentGateway] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchPayments = () =>
    client.get(`/api/projects/clients/${clientId}/payments/`)
      .then(({ data }) => setPayments(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load payments."))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const resetForm = () => {
    setAmount(""); setPaymentDate(""); setMethod("BANK_TRANSFER");
    setChequeDdNumber(""); setTransactionId(""); setPaymentGateway(""); setNotes("");
  };

  const createPayment = async () => {
    if (!amount || !paymentDate) {
      setFormError("Amount and payment date are required.");
      return;
    }
    if (Number(amount) <= 0) {
      setFormError("Amount must be more than zero.");
      return;
    }
    setCreating(true);
    setFormError("");
    try {
      await client.post(`/api/projects/clients/${clientId}/payments/`, {
        amount,
        payment_date: paymentDate,
        payment_method: method,
        cheque_dd_number: ["CHEQUE", "DD"].includes(method) ? chequeDdNumber : null,
        transaction_id: ["UPI", "BANK_TRANSFER", "ONLINE_GATEWAY", "CARD"].includes(method) ? transactionId : null,
        payment_gateway: ["ONLINE_GATEWAY", "UPI", "BANK_TRANSFER"].includes(method) ? paymentGateway : null,
        notes,
      });
      setMessage("Payment recorded.");
      resetForm();
      setShowForm(false);
      fetchPayments();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't record payment.");
    } finally {
      setCreating(false);
    }
  };

  const sorted = [...payments].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
  const total = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const last = sorted[0];
  const visible = sorted.filter((p) => !methodFilter || p.payment_method === methodFilter);
  const isChequeOrDd = ["CHEQUE", "DD"].includes(method);
  const isDigital = ["UPI", "BANK_TRANSFER", "ONLINE_GATEWAY", "CARD"].includes(method);

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        eyebrow="Client Management"
        section="Payments"
        title={clientName ? `${clientName} Payments` : "Payments"}
        subtitle="Payments received from this client."
        back="/clients/payments"
        backLabel="All clients"
      >
        <button type="button" className="bp-btn navy" onClick={() => { setShowForm(true); setFormError(""); }}><Plus size={16} /> Record Payment</button>
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">TOTAL RECEIVED</p><span className="pm-ico green"><Wallet size={20} /></span></div>
          <p className="bp-stat-value">{inr(total)}</p>
          <p className="pm-foot"><span>{payments.length} {payments.length === 1 ? "payment" : "payments"}</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">LAST PAYMENT</p><span className="pm-ico navy"><CalendarDays size={20} /></span></div>
          <p className="bp-stat-value pm-stat-text">{last ? inr(last.amount) : "—"}</p>
          <p className="pm-foot"><span>{last ? new Date(last.payment_date).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "No payments yet"}</span></p>
        </div>
      </div>

      <section className="bp-panel">
        <div className="pm-toolbar pm-toolbar-flat">
          <h3 className="pm-panel-title">Payment Ledger</h3>
          <label className="bp-select">
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
              <option value="">All methods</option>
              {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Notes</th><th>Recorded By</th></tr></thead>
            <tbody>
              {loading && <tr className="bp-empty-row"><td colSpan={6}>Loading payments…</td></tr>}
              {!loading && visible.length === 0 && <tr className="bp-empty-row"><td colSpan={6}>{payments.length ? "No payments for this method." : "No payments recorded yet."}</td></tr>}
              {visible.map((p, idx) => (
                <tr key={p.client_payment_id} style={{ "--row": idx }}>
                  <td>{new Date(p.payment_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}</td>
                  <td><b className="pm-amount pm-amount-sm">{inr(p.amount)}</b></td>
                  <td><span className="pm-area"><Receipt size={12} /> {METHOD_LABELS[p.payment_method] || p.payment_method}</span></td>
                  <td className="bp-muted">{[p.cheque_dd_number && `Ref ${p.cheque_dd_number}`, p.transaction_id && `Txn ${p.transaction_id}`, p.payment_gateway && `via ${p.payment_gateway}`].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="pm-notes-cell">{p.notes || <span className="bp-muted">—</span>}</td>
                  <td>{p.recorded_by_name ? <span><UserRound size={11} /> {p.recorded_by_name}</span> : <span className="bp-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <div className="bp-modal-backdrop" onClick={() => !creating && setShowForm(false)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Record Payment</h2>
            <p className="bp-sub">A payment received from {clientName || "this client"}.</p>
            <div className="bp-form-grid">
              <label className="bp-field"><span>Amount (₹)</span>
                <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
              <label className="bp-field"><span>Payment date</span>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </label>
              <label className="bp-field full"><span>Method</span>
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  {Object.entries(METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {isChequeOrDd && (
                <label className="bp-field full"><span>{method === "CHEQUE" ? "Cheque number" : "DD number"}</span>
                  <input value={chequeDdNumber} onChange={(e) => setChequeDdNumber(e.target.value)} />
                </label>
              )}
              {isDigital && (
                <>
                  <label className="bp-field"><span>Transaction ID</span>
                    <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
                  </label>
                  <label className="bp-field"><span>Gateway / bank</span>
                    <input value={paymentGateway} onChange={(e) => setPaymentGateway(e.target.value)} />
                  </label>
                </>
              )}
              <label className="bp-field full"><span>Notes</span>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </div>
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setShowForm(false)} disabled={creating}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={createPayment} disabled={creating}>{creating ? "Recording…" : "Record Payment"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Payments;
