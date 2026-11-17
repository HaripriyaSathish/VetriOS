import { useEffect, useState } from "react";
import { Info, ListChecks, FolderKanban, Rocket, Presentation, Send, Users } from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/TrainerDashboard.css";
import "../styles/BatchBulkEmail.css";

// Training → Email → Bulk. The trainer picks a category and a batch; every
// active student gets the email AND a notification in the student panel.
const CATEGORY_META = {
  information: { icon: Info, tone: "blue", hint: "General updates, schedule changes, reminders." },
  daily_task: { icon: ListChecks, tone: "orange", hint: "Today's practice work for the batch." },
  mini_project: { icon: FolderKanban, tone: "green", hint: "Short project brief with scope and deadline." },
  main_project: { icon: Rocket, tone: "navy", hint: "Capstone / main project details." },
  seminar: { icon: Presentation, tone: "purple", hint: "Seminar topic, date, time and venue." },
};

const HISTORY_CHIP = { daily_task: "orange", mini_project: "green", main_project: "blue", seminar: "gray" };
const CHIP_TONE = { COMPLETED: "green", PARTIAL: "orange", FAILED: "red", PROCESSING: "blue" };

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function BatchBulkEmail() {
  const [categories, setCategories] = useState([]);
  const [batches, setBatches] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [category, setCategory] = useState("information");
  const [batchId, setBatchId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const load = () =>
    client.get("/api/training/bulk-email/")
      .then(({ data }) => {
        setCategories(data.categories || []);
        setBatches(data.batches || []);
        setHistory(data.history || []);
        setBatchId((prev) => prev || (data.batches?.[0]?.batch_id ?? ""));
      })
      .catch(() => setLoadError("Couldn't load your batches."))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const selectedBatch = batches.find((b) => String(b.batch_id) === String(batchId));
  const categoryLabel = categories.find((c) => c.value === category)?.label || "";

  const send = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!batchId || !subject.trim() || !body.trim()) {
      setError("Pick a batch and fill in the subject and message.");
      return;
    }
    if (!window.confirm(`Send this ${categoryLabel} to ${selectedBatch?.student_count ?? 0} students of ${selectedBatch?.batch_name}?`)) return;
    setSending(true);
    try {
      const { data } = await client.post("/api/training/bulk-email/", { batch_id: batchId, category, subject, body });
      setResult(data);
      setSubject("");
      setBody("");
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="bp-loading">Loading…</p>;

  return (
    <div className="bp-page tr-page bbe-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Trainer Workspace &gt; Email &gt; <span>Bulk</span></p>
          <h1 className="bp-title">Bulk Email to Batch</h1>
          <p className="bp-sub">Send information, daily tasks, projects or seminar details to every student in a batch. Students also see it in their panel.</p>
        </div>
      </div>

      {loadError && <p className="bp-error">{loadError}</p>}

      <form className="bp-panel tr-card bbe-compose" onSubmit={send}>
        <div className="tr-card-head"><h3>What are you sending?</h3></div>
        <div className="bbe-cats" role="radiogroup" aria-label="Category">
          {categories.map((c) => {
            const meta = CATEGORY_META[c.value] || CATEGORY_META.information;
            const Icon = meta.icon;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={category === c.value}
                className={`bbe-cat tone-${meta.tone}` + (category === c.value ? " active" : "")}
                onClick={() => setCategory(c.value)}
              >
                <span className="bbe-cat-icon"><Icon size={18} /></span>
                <b>{c.label}</b>
                <small>{meta.hint}</small>
              </button>
            );
          })}
        </div>

        <div className="bp-form-grid">
          <label className="bp-field full">
            <span>Batch</span>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              {batches.length === 0 && <option value="">No batches assigned to you</option>}
              {batches.map((b) => (
                <option key={b.batch_id} value={b.batch_id}>
                  {b.batch_name} ({b.batch_code}) · {b.student_count} active students
                </option>
              ))}
            </select>
          </label>
          <label className="bp-field full">
            <span>Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={`e.g. ${categoryLabel || "Information"} – ${new Date().toLocaleDateString("en-GB")}`}
              maxLength={150}
            />
          </label>
          <label className="bp-field full">
            <span>Message</span>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the details here. Use {{student_name}} to greet each student by name."
            />
          </label>
        </div>

        {error && <p className="bp-form-error">{error}</p>}
        {result && (
          <p className="bp-notice bbe-result">
            Sent to {result.sent} of {result.students} students · {result.notified} notified in the student panel
            {result.no_email > 0 && ` · ${result.no_email} have no email address`}
            {result.failed - result.no_email > 0 && ` · ${result.failed - result.no_email} failed`}
          </p>
        )}

        <div className="bbe-foot">
          <span className="bp-muted"><Users size={14} /> {selectedBatch ? `${selectedBatch.student_count} students will receive this` : "Pick a batch"}</span>
          <button type="submit" className="bp-btn orange" disabled={sending || !batches.length}>
            <Send size={16} /> {sending ? "Sending…" : `Send ${categoryLabel}`}
          </button>
        </div>
      </form>

      <section className="bp-panel tr-card">
        <div className="tr-card-head"><h3>Sent history</h3></div>
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Subject</th>
                <th>Batch</th>
                <th>Sent</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr className="bp-empty-row"><td colSpan={6}>Nothing sent yet.</td></tr>
              ) : history.map((h, i) => (
                <tr key={h.email_batch_id} style={{ "--row": i }}>
                  <td><span className={`bp-chip ${HISTORY_CHIP[h.category] || "blue"}`}>{h.category_label}</span></td>
                  <td className="bp-strong">{h.subject}</td>
                  <td>{h.training_batch}</td>
                  <td>{h.sent}/{h.total}</td>
                  <td><span className={`bp-chip ${CHIP_TONE[h.status] || "gray"}`}>{h.status}</span></td>
                  <td>{formatDateTime(h.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default BatchBulkEmail;
