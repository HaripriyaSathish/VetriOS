import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings, Users, Briefcase, Check, FileText, ArrowRight, Send,
  X, Plus, Search, Key, FileSearch, Clock, CircleCheck, CircleX, Info, Inbox, Send as SendIcon, Hourglass,
} from "lucide-react";
import { ShieldCheck } from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../styles/RequestAccess.css";
import "../styles/PermissionRequests.css";

const CATEGORIES = [
  { value: "System Administrator", label: "System admin", icon: Settings },
  { value: "HR Administrator", label: "HR admin", icon: Users },
  { value: "Business Team", label: "Business team", icon: Briefcase },
];

const STATUS_CLASS = { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected", REVOKED: "revoked" };

const STATUS_FILTERS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

// Login-credential requests are drafted through HR (Employees / Onboarding)
// and must be actioned from User & Accounts → Login requests, where
// Approve opens the New Account form and only marks the request approved
// once the login is actually created. Approving one here would mark it
// approved without ever creating an account, so callers get told nothing
// went wrong.
const isLoginRequest = (r) => r.permission_requested?.startsWith("Create login credentials for ");

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// "2 hours ago" for recent items, the full date once it's more than a week old.
function timeAgo(value) {
  if (!value) return "—";
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return formatDate(value);
}

// A pending request that's been waiting this many days gets flagged.
const URGENT_AFTER_DAYS = 3;
function waitingDays(r) {
  if (r.status !== "PENDING" || !r.created_at) return 0;
  return Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000);
}

// Common asks, one click to fill the "Permission needed" box.
const TEMPLATES = [
  "Access to the Payroll References page",
  "Access to the Document Library",
  "Access to the Reports page",
  "Extend my current access for another month",
];

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// Everything about "asking an admin for a permission" lives on this one
// page: send a new request (one form, with a live summary beside it), and
// see both what you've asked for and what's been asked of you, with
// Approve/Reject right here — no separate inbox page to hunt for.
// Deciding a request is a decision + notification only, it doesn't grant
// the permission itself — that still happens separately via Roles/User
// Permissions.
function RequestAccess() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("new"); // "new" | "received" | "sent"

  // --- new request form ---
  const [category, setCategory] = useState("");
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [requestType, setRequestType] = useState("GENERAL"); // "GENERAL" | "DOCUMENT"
  const [permissionRequested, setPermissionRequested] = useState("");
  const [docQuery, setDocQuery] = useState("");
  const [docResults, setDocResults] = useState([]);
  const [docSearching, setDocSearching] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  // --- received / sent lists ---
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [confirmTarget, setConfirmTarget] = useState(null); // { req, action }
  const [note, setNote] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [actionError, setActionError] = useState("");

  const requests = tab === "received" ? receivedRequests : sentRequests;
  const receivedPendingCount = receivedRequests.filter((r) => r.status === "PENDING").length;
  const sentPendingCount = sentRequests.filter((r) => r.status === "PENDING").length;
  const counts = {
    PENDING: requests.filter((r) => r.status === "PENDING").length,
    APPROVED: requests.filter((r) => r.status === "APPROVED").length,
    REJECTED: requests.filter((r) => r.status === "REJECTED").length,
  };

  // Both lists load together (not just the active tab's) so the
  // Received/Sent tab buttons can always show a live pending count,
  // same idea as the sidebar's own badge.
  const refreshLists = async () => {
    setListLoading(true);
    setListError("");
    try {
      const [receivedRes, sentRes] = await Promise.all([
        client.get("/api/identity/permission-requests/", { params: { box: "received" } }),
        client.get("/api/identity/permission-requests/", { params: { box: "sent" } }),
      ]);
      setReceivedRequests(receivedRes.data);
      setSentRequests(sentRes.data);
    } catch {
      setListError("Couldn't load requests.");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    refreshLists();
  }, []);

  // Land on what needs attention first: pending items when there are any,
  // otherwise everything.
  useEffect(() => {
    if (tab === "received" || tab === "sent") {
      setListSearch("");
      const pending = tab === "received" ? receivedPendingCount : sentPendingCount;
      setStatusFilter(pending > 0 ? "PENDING" : "ALL");
    }
    // Only re-pick the filter when the tab changes, not on every list refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    const q = listSearch.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      tab === "received" ? r.requester_name : r.target_admin_name,
      r.admin_category,
      r.permission_requested,
      r.reason,
      r.status,
    ].join(" ").toLowerCase();
    return haystack.includes(q);
  });

  const resetForm = () => {
    setCategory("");
    setAdmins([]);
    setAdminId("");
    setRequestType("GENERAL");
    setPermissionRequested("");
    setDocQuery("");
    setDocResults([]);
    setSelectedDoc(null);
    setReason("");
    setFieldError("");
    setSubmitError("");
    setDone(false);
  };

  // Debounced document search for the "specific document" request type.
  useEffect(() => {
    if (requestType !== "DOCUMENT") return;
    const q = docQuery.trim();
    setDocSearching(true);
    const timer = setTimeout(() => {
      client
        .get("/api/documents/library/search-for-access-request/", { params: q ? { search: q } : {} })
        .then(({ data }) => setDocResults(data))
        .catch(() => setDocResults([]))
        .finally(() => setDocSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [docQuery, requestType]);

  const startNewRequest = () => {
    resetForm();
    setTab("new");
  };

  const chooseCategory = async (cat) => {
    setCategory(cat);
    setAdminId("");
    setFieldError("");
    setLoadingAdmins(true);
    try {
      const { data } = await client.get("/api/identity/admins/", { params: { category: cat } });
      setAdmins(data);
    } catch {
      setAdmins([]);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const selectedAdmin = admins.find((a) => String(a.user_id) === String(adminId));
  const requestingText = requestType === "DOCUMENT"
    ? (selectedDoc ? `Access to document: ${selectedDoc.document_title}` : "")
    : permissionRequested.trim();

  const handleSubmit = async () => {
    if (!category) {
      setFieldError("Choose who should review this request.");
      return;
    }
    if (!adminId) {
      setFieldError("Pick an admin to send it to.");
      return;
    }
    if (requestType === "DOCUMENT") {
      if (!selectedDoc || !reason.trim()) {
        setFieldError("Pick a document and fill in the reason before sending.");
        return;
      }
    } else if (!permissionRequested.trim() || !reason.trim()) {
      setFieldError("Fill in the permission and the reason before sending.");
      return;
    }
    setFieldError("");
    setSubmitting(true);
    setSubmitError("");
    try {
      await client.post("/api/identity/permission-requests/", {
        admin_category: category,
        target_admin_id: adminId,
        request_type: requestType,
        ...(requestType === "DOCUMENT"
          ? { document_id: selectedDoc.document_id }
          : { permission_requested: permissionRequested }),
        reason,
      });
      setDone(true);
      refreshLists();
    } catch (err) {
      setSubmitError(err.response?.data?.detail || "Couldn't send that request.");
    } finally {
      setSubmitting(false);
    }
  };

  const openConfirm = (req, action) => {
    setConfirmTarget({ req, action });
    setNote("");
    setActionError("");
  };

  const handleDecide = async () => {
    if (!confirmTarget) return;
    setDeciding(true);
    setActionError("");
    try {
      await client.post(`/api/identity/permission-requests/${confirmTarget.req.permission_request_id}/decide/`, {
        action: confirmTarget.action,
        note,
      });
      setConfirmTarget(null);
      await refreshLists();
    } catch (err) {
      setActionError(err.response?.data?.detail || "Couldn't record that decision.");
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="reqa-screen">
      {/* Header + stat cards from the Business Team Figma (Request Access &
          Privileges); everything below is the Request access redesign. */}
      <div className="bp-head reqa-figma-head">
        <div>
          <p className="reqa-eyebrow"><ShieldCheck size={14} /> Access Control &amp; Provisioning</p>
          <h1 className="bp-title">Request Access &amp; Privileges</h1>
          <p className="bp-sub">Ask an admin for a permission or a document. They'll review it and let you know.</p>
        </div>
        <div className="bp-actions">
          <button type="button" className="bp-btn navy" onClick={startNewRequest}>
            <Plus size={16} /> New Access Request
          </button>
        </div>
      </div>

      <div className="bp-stats reqa-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Granted Requests</p>
            <span className="bp-stat-icon"><Key size={17} /></span>
          </div>
          <p className="bp-stat-value">{sentRequests.filter((r) => r.status === "APPROVED").length} <span className="bp-chip green">Approved</span></p>
          <p className="reqa-stat-sub">Requests you sent that an admin approved</p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Pending Approvals</p>
            <span className="bp-stat-icon orange"><Hourglass size={17} /></span>
          </div>
          <p className="bp-stat-value reqa-orange">{sentPendingCount} <span className="bp-chip orange">In Review</span></p>
          <p className="reqa-stat-sub">Waiting on the admin you asked</p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Waiting on You</p>
            <span className="bp-stat-icon"><ShieldCheck size={17} /></span>
          </div>
          <p className="bp-stat-value">{receivedPendingCount} <span className="bp-chip blue">Received</span></p>
          <p className="reqa-stat-sub">Requests others sent you to decide</p>
        </div>
      </div>

      <div className="reqa-tabs">
        <button type="button" className={"reqa-tab" + (tab === "new" ? " active" : "")} onClick={startNewRequest}>
          <Plus size={15} /> New request
        </button>
        <button type="button" className={"reqa-tab" + (tab === "received" ? " active" : "")} onClick={() => setTab("received")}>
          Received
          {receivedPendingCount > 0 && <span className="reqa-tab-badge">{receivedPendingCount}</span>}
        </button>
        <button type="button" className={"reqa-tab" + (tab === "sent" ? " active" : "")} onClick={() => setTab("sent")}>
          Sent
          {sentPendingCount > 0 && <span className="reqa-tab-badge">{sentPendingCount}</span>}
        </button>
      </div>

      {tab === "new" && (
        done ? (
          <div className="reqa-card reqa-done">
            <div className="reqa-done-icon"><Check size={28} /></div>
            <p className="reqa-done-title">Request sent</p>
            <p className="reqa-done-sub">{selectedAdmin?.full_name} will review it and you'll be notified.</p>
            <span className="reqa-pending-badge">Pending</span>
            <div className="reqa-done-actions">
              <button type="button" className="reqa-send" onClick={() => setTab("sent")}>
                View sent requests <ArrowRight size={15} />
              </button>
              <button type="button" className="reqa-ghost" onClick={startNewRequest}>
                <Plus size={15} /> Send another
              </button>
            </div>
          </div>
        ) : (
          <div className="reqa-grid">
            <div className="reqa-card">
              <div className="reqa-card-head">
                <h2>Request details</h2>
                <p>Four quick steps. Your summary builds on the right as you go.</p>
              </div>

              <span className="reqa-label first"><em>1</em>Who should review it?</span>
              <div className="reqa-opt-row">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={"reqa-opt" + (category === c.value ? " selected-orange" : "")}
                    onClick={() => chooseCategory(c.value)}
                  >
                    <c.icon size={16} /> {c.label}
                  </button>
                ))}
              </div>

              <span className="reqa-label"><em>2</em>Pick an admin</span>
              {!category ? (
                <p className="reqa-muted">Choose a reviewer group first.</p>
              ) : loadingAdmins ? (
                <p className="reqa-muted">Loading…</p>
              ) : admins.length === 0 ? (
                <p className="reqa-muted">No admins found in this group.</p>
              ) : (
                <div className="reqa-opt-row">
                  {admins.map((a) => (
                    <button
                      key={a.user_id}
                      type="button"
                      className={"reqa-opt" + (String(a.user_id) === String(adminId) ? " selected-navy" : "")}
                      onClick={() => { setAdminId(String(a.user_id)); setFieldError(""); }}
                    >
                      <span className="reqa-avatar">{initials(a.full_name)}</span>
                      <span className="reqa-opt-name">{a.full_name}</span>
                    </button>
                  ))}
                </div>
              )}

              <span className="reqa-label"><em>3</em>What do you need?</span>
              <div className="reqa-type-grid">
                {[
                  { value: "GENERAL", icon: Key, title: "General permission", desc: "A page, feature or role" },
                  { value: "DOCUMENT", icon: FileText, title: "A specific document", desc: "One file in the Document Library" },
                ].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={"reqa-type-card" + (requestType === o.value ? " on" : "")}
                    onClick={() => setRequestType(o.value)}
                    aria-pressed={requestType === o.value}
                  >
                    <span className="reqa-type-icon"><o.icon size={20} /></span>
                    <span className="reqa-type-text">
                      <b>{o.title}</b>
                      <small>{o.desc}</small>
                    </span>
                    <span className="reqa-type-check"><Check size={13} /></span>
                  </button>
                ))}
              </div>

              {requestType === "GENERAL" ? (
                <>
                <div className="reqa-templates">
                  <span>Quick picks:</span>
                  {TEMPLATES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={"reqa-template" + (permissionRequested === t ? " on" : "")}
                      onClick={() => setPermissionRequested(t)}
                    >
                      {t.replace(/^Access to (the )?/, "")}
                    </button>
                  ))}
                </div>
                <textarea
                  className="reqa-input"
                  rows={2}
                  value={permissionRequested}
                  onChange={(e) => setPermissionRequested(e.target.value)}
                  placeholder="e.g. Access to the Payroll References page"
                />
                </>
              ) : (
                <>
                  <div className="reqa-doc-search">
                    <FileSearch size={15} />
                    <input
                      value={docQuery}
                      onChange={(e) => { setDocQuery(e.target.value); setSelectedDoc(null); }}
                      placeholder="Search the Document Library…"
                    />
                  </div>
                  <div className="reqa-doc-results">
                    {docSearching ? (
                      <p className="reqa-doc-empty">Searching…</p>
                    ) : docResults.length === 0 ? (
                      <p className="reqa-doc-empty">No documents match.</p>
                    ) : (
                      docResults.map((d) => (
                        <button
                          type="button"
                          key={d.document_id}
                          className={"reqa-doc-row" + (selectedDoc?.document_id === d.document_id ? " selected" : "")}
                          onClick={() => setSelectedDoc(d)}
                        >
                          <FileText size={18} />
                          <div className="reqa-doc-row-text">
                            <div className="reqa-doc-title">{d.document_title}</div>
                            <div className="reqa-doc-meta">
                              {d.confidentiality_level_name || "—"}
                              {d.owner_name ? ` · Owned by ${d.owner_name}` : ""}
                              {d.already_has_access ? " · You already have access" : ""}
                            </div>
                          </div>
                          {selectedDoc?.document_id === d.document_id && <Check size={16} />}
                        </button>
                      ))
                    )}
                  </div>
                  {selectedDoc?.already_has_access && (
                    <p className="reqa-already-has-access">
                      You already have access to this document — submitting this request isn't necessary.
                    </p>
                  )}
                </>
              )}

              <span className="reqa-label"><em>4</em>Reason</span>
              <textarea
                className="reqa-input"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you need this?"
              />

              {fieldError && <p className="reqa-error">{fieldError}</p>}
              {submitError && <p className="reqa-error">{submitError}</p>}

              <div className="reqa-actions">
                <button type="button" className="reqa-send" onClick={handleSubmit} disabled={submitting}>
                  <Send size={15} /> {submitting ? "Sending…" : "Send request"}
                </button>
                <button type="button" className="reqa-link" onClick={() => navigate(-1)} disabled={submitting}>
                  Cancel
                </button>
              </div>
            </div>

            <aside className="reqa-summary">
              <h3>Request summary</h3>
              <small>To</small>
              {selectedAdmin ? (
                <div className="reqa-sum-person">
                  <span className="reqa-avatar light">{initials(selectedAdmin.full_name)}</span>
                  <div>
                    <div className="reqa-sum-name">{selectedAdmin.full_name}</div>
                    <div className="reqa-sum-sub">{category}</div>
                  </div>
                </div>
              ) : (
                <p className="reqa-sum-empty">Not chosen yet</p>
              )}
              <small>Requesting</small>
              <p className={requestingText ? "reqa-sum-text" : "reqa-sum-empty"}>
                {requestingText || "Not filled in yet"}
              </p>
              {reason.trim() && (
                <>
                  <small>Reason</small>
                  <p className="reqa-sum-text reqa-sum-clamp">{reason.trim()}</p>
                </>
              )}
              <div className="reqa-sum-next">
                <h4>What happens next</h4>
                <div className="reqa-next-step"><span className="dot done"><Check size={11} /></span>You send the request</div>
                <div className="reqa-next-step"><span className="dot" />The admin reviews it</div>
                <div className="reqa-next-step"><span className="dot" />You get a notification</div>
              </div>
            </aside>
          </div>
        )
      )}

      {(tab === "received" || tab === "sent") && (
        <>
          {listError && <p className="preq-error">{listError}</p>}

          <div className="preq-stats">
            <div className="preq-stat">
              <span className="preq-stat-icon pending"><Clock size={18} /></span>
              <div><b>{counts.PENDING}</b><span>Pending</span></div>
            </div>
            <div className="preq-stat">
              <span className="preq-stat-icon approved"><CircleCheck size={18} /></span>
              <div><b>{counts.APPROVED}</b><span>Approved</span></div>
            </div>
            <div className="preq-stat">
              <span className="preq-stat-icon rejected"><CircleX size={18} /></span>
              <div><b>{counts.REJECTED}</b><span>Rejected</span></div>
            </div>
          </div>

          <div className="preq-toolbar">
            <div className="preq-search">
              <Search size={15} />
              <input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder={tab === "received" ? "Search by name, permission or reason" : "Search by admin, permission or reason"}
              />
            </div>
            <div className="preq-filters">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={"preq-filter" + (statusFilter === f.value ? " on" : "")}
                  onClick={() => setStatusFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {listLoading ? (
            <p className="preq-empty">Loading…</p>
          ) : requests.length === 0 ? (
            <div className="preq-empty-state">
              <span className="preq-empty-icon">{tab === "received" ? <Inbox size={30} /> : <SendIcon size={30} />}</span>
              <h3>{tab === "received" ? "You're all caught up" : "Send your first request"}</h3>
              <p>
                {tab === "received"
                  ? "Nothing is waiting on you right now. New requests from your team will show up here."
                  : "Need access to a page or document? Ask an admin and track the answer here."}
              </p>
              {tab === "sent" && (
                <button type="button" className="reqa-send" onClick={startNewRequest}>
                  <Plus size={15} /> New request
                </button>
              )}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="preq-empty-state">
              <span className="preq-empty-icon"><Search size={28} /></span>
              <h3>No requests match</h3>
              <p>Try a different search or status filter.</p>
              <button type="button" className="reqa-ghost reqa-ghost-auto" onClick={() => { setListSearch(""); setStatusFilter("ALL"); }}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className="preq-list">
              {filteredRequests.map((r) => {
                const person = tab === "received" ? r.requester_name : r.target_admin_name;
                const login = isLoginRequest(r);
                return (
                  <div className={`preq-card ${STATUS_CLASS[r.status] || ""}`} key={r.permission_request_id}>
                    <span className="preq-avatar">{initials(person)}</span>
                    <div className="preq-body">
                      <div className="preq-title-row">
                        <span className="preq-title">
                          {r.document_deleted ? (
                            <span className="preq-deleted-doc">Document deleted</span>
                          ) : (
                            r.permission_requested
                          )}
                        </span>
                        <span className={`preq-badge ${STATUS_CLASS[r.status]}`}>{r.status}</span>
                        {login && <span className="preq-badge login">Login request</span>}
                        {waitingDays(r) >= URGENT_AFTER_DAYS && (
                          <span className="preq-badge urgent"><Hourglass size={11} /> Waiting {waitingDays(r)} days</span>
                        )}
                      </div>
                      <div className="preq-meta" title={formatDate(r.created_at)}>
                        {tab === "received"
                          ? `${r.requester_name} · ${timeAgo(r.created_at)}`
                          : `To ${r.target_admin_name} (${r.admin_category}) · ${timeAgo(r.created_at)}`}
                      </div>
                      {r.reason && (
                        <div className="preq-strip"><b>Reason:</b> {r.reason}</div>
                      )}
                      {r.decision_note && (
                        <div className="preq-strip note"><b>Decision note:</b> {r.decision_note}</div>
                      )}
                      {tab === "received" && r.status === "PENDING" && login && (
                        <div className="preq-strip info">
                          <Info size={13} /> Approve this in User &amp; Accounts → Login requests.
                        </div>
                      )}
                    </div>
                    {tab === "received" && r.status === "PENDING" && (
                      <div className="preq-row-actions">
                        <button type="button" className="preq-action-btn preq-reject" onClick={() => openConfirm(r, "reject")}>
                          <X size={14} /> Reject
                        </button>
                        <button
                          type="button"
                          className="preq-action-btn preq-approve"
                          onClick={() => openConfirm(r, "approve")}
                          disabled={login}
                        >
                          <Check size={14} /> Approve
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {confirmTarget && (
        <div className="preq-modal-backdrop" onClick={() => setConfirmTarget(null)}>
          <div className="preq-modal" onClick={(e) => e.stopPropagation()}>
            <h2>
              {confirmTarget.action === "approve" ? "Approve" : "Reject"} {confirmTarget.req.requester_name}'s request?
            </h2>
            <p className="preq-modal-summary">{confirmTarget.req.permission_requested}</p>

            <label>Note (optional)</label>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the requester should know?" />

            {actionError && <p className="preq-error">{actionError}</p>}

            <div className="preq-modal-actions">
              <button type="button" onClick={() => setConfirmTarget(null)} disabled={deciding}>Cancel</button>
              <button
                type="button"
                className={confirmTarget.action === "reject" ? "preq-danger" : "preq-primary"}
                onClick={handleDecide}
                disabled={deciding}
              >
                {deciding ? "Working…" : confirmTarget.action === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RequestAccess;
