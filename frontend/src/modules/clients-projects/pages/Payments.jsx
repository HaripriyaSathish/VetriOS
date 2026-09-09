import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../../api/client";

const METHOD_LABELS = {
  BANK_TRANSFER: "Bank Transfer",
  UPI: "UPI",
  CHEQUE: "Cheque",
  DD: "Demand Draft",
  CARD: "Card",
  CASH: "Cash",
  ONLINE_GATEWAY: "Online Gateway",
};

function Payments() {
  const { clientId } = useParams();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [chequeDdNumber, setChequeDdNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [paymentGateway, setPaymentGateway] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    client.get(`/api/projects/clients/${clientId}/payments/`)
      .then(({ data }) => setPayments(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load payments."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const resetForm = () => {
    setAmount(""); setPaymentDate(""); setMethod("BANK_TRANSFER");
    setChequeDdNumber(""); setTransactionId(""); setPaymentGateway(""); setNotes("");
  };

  const createPayment = async () => {
    if (!amount || !paymentDate) {
      setError("Amount and payment date are required.");
      return;
    }
    setCreating(true);
    setError("");
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
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't record payment.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  const sorted = [...payments].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
  const total = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const isChequeOrDd = ["CHEQUE", "DD"].includes(method);
  const isDigital = ["UPI", "BANK_TRANSFER", "ONLINE_GATEWAY", "CARD"].includes(method);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/clients/payments" className="text-sm text-blue-600 hover:underline">
        ← Back to Clients
      </Link>

      <div className="flex justify-between items-center mt-3 mb-1">
        <h1 className="text-xl font-bold text-gray-900">Payments</h1>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
        >
          {showForm ? "Cancel" : "+ Record Payment"}
        </button>
      </div>
      <p className="text-gray-600 mb-6">Total received: ₹{total.toLocaleString("en-IN")}</p>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">New Payment</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="number"
              placeholder="Amount (₹)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          >
            {Object.entries(METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {isChequeOrDd && (
            <input
              placeholder={method === "CHEQUE" ? "Cheque number" : "DD number"}
              value={chequeDdNumber}
              onChange={(e) => setChequeDdNumber(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
            />
          )}

          {isDigital && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                placeholder="Transaction ID"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <input
                placeholder="Gateway / bank name"
                value={paymentGateway}
                onChange={(e) => setPaymentGateway(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          )}

          <textarea
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
          />

          <button
            onClick={createPayment}
            disabled={creating}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Recording…" : "Record Payment"}
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No payments recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((p) => (
            <div key={p.client_payment_id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-gray-900">₹{parseFloat(p.amount).toLocaleString("en-IN")}</p>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  {METHOD_LABELS[p.payment_method] || p.payment_method}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-2">
                <span>{new Date(p.payment_date).toLocaleDateString("en-IN")}</span>
                {p.cheque_dd_number && <span>Ref: {p.cheque_dd_number}</span>}
                {p.transaction_id && <span>Txn: {p.transaction_id}</span>}
                {p.payment_gateway && <span>Via: {p.payment_gateway}</span>}
              </div>
              {p.notes && <p className="text-sm text-gray-700 mb-2">{p.notes}</p>}
              {p.recorded_by_name && (
                <p className="text-xs text-gray-500">Recorded by {p.recorded_by_name}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Payments;