import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Megaphone, SquarePen, Inbox, Send, FileText, Hourglass, BadgeCheck, CircleX, Layers,
  Search, Copy, Clock3, CheckCircle2, AlertTriangle, MailOpen, RotateCw,
} from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../styles/EmailMailbox.css";
import "../../documents/styles/DocumentLibrary.css";
import "../styles/EmailPremium.css";

// Mailbox folders map onto AiEmail.generation_status; "campaigns" lists
// EmailBatch rows instead of individual emails.
const FOLDERS = [
  { key: "all", label: "All mail", Icon: Inbox, match: () => true },
  { key: "SENT", label: "Sent", Icon: Send, match: (e) => e.generation_status === "SENT" },
  { key: "DRAFT", label: "Drafts", Icon: FileText, match: (e) => e.generation_status === "DRAFT" },
  { key: "PENDING_APPROVAL", label: "Pending", Icon: Hourglass, match: (e) => e.generation_status === "PENDING_APPROVAL", tone: "orange" },
  { key: "APPROVED", label: "Approved", Icon: BadgeCheck, match: (e) => e.generation_status === "APPROVED" },
  { key: "FAILED", label: "Failed", Icon: CircleX, match: (e) => ["FAILED", "REJECTED"].includes(e.generation_status) },
];

const STATUS_META = {
  SENT: { label: "Sent", tone: "green" },
  DRAFT: { label: "Draft", tone: "gray" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "orange" },
  APPROVED: { label: "Approved", tone: "blue" },
  REJECTED: { label: "Rejected", tone: "red" },
  FAILED: { label: "Failed", tone: "red" },
};

const BATCH_META = {
  DRAFT: { label: "Draft", tone: "gray" },
  SCHEDULED: { label: "Scheduled", tone: "orange" },
  PROCESSING: { label: "Processing", tone: "blue" },
  COMPLETED: { label: "Completed", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
};

const TAG_DOTS = ["#002673", "#e7510c", "#1baf7a", "#d92d20", "#2689ef"];

const listOf = (data) => (Array.isArray(data) ? data : data?.results || []);
const initialsOf = (name) =>
  (name || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function whenOf(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Bodies are stored as rich-text HTML; show them as plain paragraphs
// (DOMParser never executes scripts, and only textContent is used).
function bodyText(html) {
  if (!html) return "";
  const withBreaks = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6])>/gi, "\n");
  const text = new DOMParser().parseFromString(withBreaks, "text/html").body.textContent || "";
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export default function EmailDashboard() {
  const [emails, setEmails] = useState([]);
  const [batches, setBatches] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [folder, setFolder] = useState("all");
  const [scope, setScope] = useState("all");
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [sending, setSending] = useState(false);
  const [syncedAt, setSyncedAt] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      client.get("/api/email/emails/"),
      client.get("/api/email/batches/"),
      client.get("/api/email/dashboard/"),
    ]).then(([e, b, s]) => {
      if (e.status === "fulfilled") setEmails(listOf(e.value.data));
      if (b.status === "fulfilled") setBatches(listOf(b.value.data));
      if (s.status === "fulfilled") setStats(s.value.data);
      setError(e.status === "rejected" ? "Couldn't load the mailbox." : "");
      setSyncedAt(new Date());
      setLoading(false);
    });
  }, [reloadKey]);

  const batchById = useMemo(() => Object.fromEntries(batches.map((b) => [b.email_batch_id, b])), [batches]);
  const tags = useMemo(() => [...new Set(batches.map((b) => b.email_type_name).filter(Boolean))], [batches]);

  const folderCounts = useMemo(
    () => Object.fromEntries(FOLDERS.map((f) => [f.key, emails.filter(f.match).length])),
    [emails],
  );

  const isCampaigns = folder === "campaigns";
  const q = search.trim().toLowerCase();

  const visibleEmails = useMemo(() => {
    const f = FOLDERS.find((x) => x.key === folder) || FOLDERS[0];
    return emails.filter((e) => {
      if (!f.match(e)) return false;
      if (scope === "direct" && e.email_batch) return false;
      if (scope === "campaign" && !e.email_batch) return false;
      if (tag && batchById[e.email_batch]?.email_type_name !== tag) return false;
      return !q || [e.subject, e.recipient_email, e.created_by_name].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [emails, folder, scope, tag, q, batchById]);

  const visibleBatches = useMemo(
    () => batches.filter((b) =>
      (!tag || b.email_type_name === tag) &&
      (!q || [b.batch_name, b.email_type_name].some((v) => (v || "").toLowerCase().includes(q)))),
    [batches, tag, q],
  );

  const selected = emails.find((e) => e.ai_email_id === selectedId) || (!isCampaigns ? visibleEmails[0] : null);
  const selectedBatch = selected?.email_batch ? batchById[selected.email_batch] : null;

  const sentTotal = stats ? stats.sent + stats.failed : 0;
  const health = sentTotal ? Math.round((stats.sent / sentTotal) * 100) : null;
  const syncedLabel = syncedAt ? syncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  const sendNow = async (email) => {
    setSending(true);
    setNotice("");
    try {
      await client.post(`/api/email/emails/${email.ai_email_id}/send/`);
      setNotice(`Sent "${email.subject}" to ${email.recipient_email}.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setNotice(err.response?.data?.detail || "Send failed.");
    } finally {
      setSending(false);
    }
  };

  const copyBody = (email) => {
    navigator.clipboard?.writeText(bodyText(email.generated_body)).then(() => setNotice("Email body copied."));
  };

  return (
    <div className="bp-page mbx-page dl2 em2">
      <div className="dl2-ban">
        <div className="dl2-ban-top">
          <div>
            <h1>Mailbox</h1>
            <p className="em2-sync">
              Everything you have sent, drafted or queued · synced {syncedLabel}
              <button type="button" className="em2-refresh" onClick={() => setReloadKey((k) => k + 1)} aria-label="Refresh">
                <RotateCw size={13} />
              </button>
            </p>
          </div>
          <div className="dl2-ban-actions">
            <Link to="/email/batches" className="dl2-ghost"><Megaphone size={15} /> Bulk email</Link>
            <Link to="/email/compose" className="dl2-new"><SquarePen size={15} /> Compose</Link>
          </div>
        </div>
      </div>

      <div className="dl2-body">
      {error && <p className="bp-notice mbx-error">{error}</p>}
      {notice && <p className="bp-notice">{notice}</p>}

      <div className="mbx-grid">
        {/* ---------- Folders ---------- */}
        <aside className="bp-panel mbx-folders">
          <p className="mbx-group-label">Mailboxes</p>
          {FOLDERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`mbx-folder ${folder === f.key ? "active" : ""}`}
              onClick={() => { setFolder(f.key); setSelectedId(null); }}
            >
              <f.Icon size={16} /> <span>{f.label}</span>
              <b className={f.tone && folderCounts[f.key] ? "warn" : ""}>{folderCounts[f.key]}</b>
            </button>
          ))}
          <button
            type="button"
            className={`mbx-folder ${isCampaigns ? "active" : ""}`}
            onClick={() => { setFolder("campaigns"); setSelectedId(null); }}
          >
            <Layers size={16} /> <span>Campaigns</span> <b>{batches.length}</b>
          </button>

          {tags.length > 0 && (
            <>
              <p className="mbx-group-label">Batch Tags</p>
              {tags.map((t, i) => (
                <button
                  key={t}
                  type="button"
                  className={`mbx-tag ${tag === t ? "active" : ""}`}
                  onClick={() => setTag(tag === t ? "" : t)}
                >
                  <i style={{ background: TAG_DOTS[i % TAG_DOTS.length] }} /> #{t.replace(/\s+/g, "-")}
                </button>
              ))}
            </>
          )}

          {stats && (
            <div className="mbx-health">
              <div className="mbx-health-top">
                <b>Delivery health</b>
                <span>{stats.sent} / {sentTotal || 0}</span>
              </div>
              <div className="bp-meter"><span style={{ width: `${health ?? 0}%` }} /></div>
              <p>{stats.active_batches} active batches · {stats.failed} failed</p>
            </div>
          )}
        </aside>

        {/* ---------- Message list ---------- */}
        <section className="bp-panel mbx-list">
          <label className="bp-search">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search emails, recipients, campaigns…" />
          </label>
          {!isCampaigns && (
            <div className="mbx-scopes">
              {[
                { key: "all", label: "All", n: emails.filter((e) => (FOLDERS.find((f) => f.key === folder) || FOLDERS[0]).match(e)).length },
                { key: "direct", label: "Direct" },
                { key: "campaign", label: "Campaigns" },
              ].map((s) => (
                <button key={s.key} type="button" className={`mbx-scope ${scope === s.key ? "active" : ""}`} onClick={() => setScope(s.key)}>
                  {s.label}{s.n != null && <small>({s.n})</small>}
                </button>
              ))}
            </div>
          )}

          <div className="mbx-items">
            {loading ? (
              <p className="mbx-empty">Loading…</p>
            ) : isCampaigns ? (
              visibleBatches.length === 0 ? <p className="mbx-empty">No campaigns yet.</p> : visibleBatches.map((b) => {
                const meta = BATCH_META[b.status] || { label: b.status, tone: "gray" };
                const rate = b.total_emails ? Math.round((b.successful_emails / b.total_emails) * 100) : 0;
                return (
                  <div key={b.email_batch_id} className="mbx-item">
                    <div className="mbx-item-top">
                      <span className="mbx-from"><Megaphone size={14} className="mbx-camp-icon" /> {b.email_type_name || "Campaign"}</span>
                      <time>{whenOf(b.completed_at || b.started_at || b.created_at)}</time>
                    </div>
                    <p className="mbx-subject">{b.batch_name}</p>
                    <p className="mbx-snippet">
                      {b.successful_emails}/{b.total_emails} delivered{b.failed_emails ? ` · ${b.failed_emails} failed` : ""}
                      {b.created_by_name ? ` · by ${b.created_by_name}` : ""}
                    </p>
                    <div className="mbx-chips">
                      <span className="bp-chip green">{rate}% Delivered</span>
                      <span className={`bp-chip ${meta.tone}`}>{meta.label}</span>
                    </div>
                  </div>
                );
              })
            ) : visibleEmails.length === 0 ? (
              <p className="mbx-empty">No emails in this folder.</p>
            ) : visibleEmails.map((e) => {
              const meta = STATUS_META[e.generation_status] || { label: e.generation_status, tone: "gray" };
              const batch = e.email_batch ? batchById[e.email_batch] : null;
              return (
                <button
                  key={e.ai_email_id}
                  type="button"
                  className={`mbx-item mbx-tone-${meta.tone} ${selected?.ai_email_id === e.ai_email_id ? "active" : ""}`}
                  onClick={() => setSelectedId(e.ai_email_id)}
                >
                  <div className="mbx-item-top">
                    <span className="mbx-from">
                      <i className={`mbx-dot ${meta.tone}`} /> {e.recipient_email.split(",")[0]}
                    </span>
                    <time>{whenOf(e.generated_at || e.created_at)}</time>
                  </div>
                  <p className="mbx-subject">{e.subject || "(no subject)"}</p>
                  <p className="mbx-snippet">{bodyText(e.generated_body).slice(0, 110)}</p>
                  <div className="mbx-chips">
                    {batch && <span className="bp-chip blue">#{batch.batch_name}</span>}
                    <span className={`bp-chip ${meta.tone}`}>{meta.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ---------- Reading pane ---------- */}
        <section className="bp-panel mbx-read">
          {!selected ? (
            <div className="mbx-read-empty">
              <MailOpen size={34} />
              <p>{isCampaigns ? "Campaign delivery is summarised in the list." : "Select an email to read it."}</p>
            </div>
          ) : (
            <>
              <div className="mbx-toolbar">
                <div />
                <div>
                  <button type="button" className="mbx-icon-btn" title="Copy body" onClick={() => copyBody(selected)}><Copy size={16} /></button>
                </div>
              </div>

              <div className="mbx-chips">
                {selectedBatch && <span className="bp-chip blue">#{selectedBatch.batch_name}</span>}
                {(() => {
                  const meta = STATUS_META[selected.generation_status] || { label: selected.generation_status, tone: "gray" };
                  return <span className={`bp-chip ${meta.tone}`}>{meta.label}</span>;
                })()}
                {selected.approval_status && <span className="bp-chip gray">Approval: {selected.approval_status.toLowerCase()}</span>}
              </div>
              <h2 className="mbx-read-subject">{selected.subject || "(no subject)"}</h2>

              <div className="mbx-sender">
                <span className="bp-avatar">{initialsOf(selected.created_by_name || selected.recipient_email)}</span>
                <div className="mbx-sender-text">
                  <p><b>{selected.created_by_name || "VetriOS"}</b></p>
                  <p>To: {selected.recipient_email}</p>
                  {selected.cc_emails && <p>Cc: {selected.cc_emails}</p>}
                </div>
                <time>
                  {selected.generated_at || selected.created_at
                    ? new Date(selected.generated_at || selected.created_at).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                    : ""}
                </time>
              </div>

              <div className="mbx-body">{bodyText(selected.generated_body) || "No body."}</div>

              <div className="mbx-meta">
                <p className="mbx-meta-title"><CheckCircle2 size={15} /> Delivery details</p>
                <ul>
                  <li><Clock3 size={14} /> Drafted {selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}</li>
                  <li>
                    {selected.generation_status === "SENT" ? <CheckCircle2 size={14} className="ok" /> : <AlertTriangle size={14} className="warn" />}
                    {selected.generation_status === "SENT" ? "Delivered via SMTP" : `Not sent yet — ${(STATUS_META[selected.generation_status]?.label || selected.generation_status).toLowerCase()}`}
                  </li>
                  {selected.generation_provider && <li><SquarePen size={14} /> Drafted with {selected.generation_provider}{selected.generation_model ? ` · ${selected.generation_model}` : ""}</li>}
                </ul>
              </div>

              {["DRAFT", "APPROVED"].includes(selected.generation_status) && (
                <div className="mbx-send">
                  <p>
                    <b>{selected.generation_status === "DRAFT" ? "Draft ready" : "Approved"}</b>
                    <span>Send it to {selected.recipient_email} now.</span>
                  </p>
                  <button type="button" className="bp-btn navy" disabled={sending} onClick={() => sendNow(selected)}>
                    <Send size={15} /> {sending ? "Sending…" : "Send Now"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
      </div>
    </div>
  );
}
