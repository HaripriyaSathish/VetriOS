import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, CheckCircle2, History, Inbox, Info, ListChecks, MailOpen, ShieldCheck, UserRound, X, XCircle } from "lucide-react";
import client from "../../../api/client";
import Breadcrumbs from "../../../components/Breadcrumbs";
import "../../student/styles/StudentDashboard.css";
import "../../hr/styles/Attendance.css";
import "../styles/UserAccounts.css";

const PREFIX = "Create login credentials for ";

const fmtWhen = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

// "Create login credentials for Meena K (EMP-12)" -> "Meena K (EMP-12)"
const personOf = (request) => (request.permission_requested || "").replace(PREFIX, "");

const STATUS_LABEL = { APPROVED: "Approved", REJECTED: "Rejected", REVOKED: "Revoked" };

// System Administrator inbox for HR's "Create login credentials" requests.
// Pending tab: Approve opens the New account page pre-filled to that
// person (creating the account completes the approval); Reject marks the
// request rejected. History tab: everything already decided.
function LoginRequests() {
  const navigate = useNavigate();
  const [all, setAll] = useState([]);
  const [tab, setTab] = useState("pending"); // "pending" | "history"
  const [historyFilter, setHistoryFilter] = useState("ALL"); // "ALL" | "APPROVED" | "REJECTED"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rejectingId, setRejectingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/api/identity/permission-requests/", { params: { box: "received" } });
      setAll(data.filter((r) => r.permission_requested?.startsWith(PREFIX)));
    } catch {
      setError("Couldn't load the login requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pending = useMemo(() => all.filter((r) => r.status === "PENDING"), [all]);
  const history = useMemo(
    () =>
      all
        .filter((r) => r.status !== "PENDING")
        .sort((a, b) => new Date(b.decided_at || b.created_at) - new Date(a.decided_at || a.created_at)),
    [all]
  );
  const approvedCount = history.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = history.filter((r) => r.status === "REJECTED").length;
  const shown =
    tab === "pending" ? pending : history.filter((r) => historyFilter === "ALL" || r.status === historyFilter);

  // Stat cards double as shortcuts: they open the right tab / filter.
  const openPending = () => setTab("pending");
  const openHistory = (filter) => {
    setTab("history");
    setHistoryFilter(filter);
  };
  const stats = [
    { label: "Waiting", value: pending.length, tone: "amber", Icon: Inbox, on: tab === "pending", onClick: openPending },
    {
      label: "Approved", value: approvedCount, tone: "green", Icon: CheckCircle2,
      on: tab === "history" && historyFilter === "APPROVED", onClick: () => openHistory("APPROVED"),
    },
    {
      label: "Rejected", value: rejectedCount, tone: "red", Icon: XCircle,
      on: tab === "history" && historyFilter === "REJECTED", onClick: () => openHistory("REJECTED"),
    },
    {
      label: "All requests", value: all.length, tone: "blue", Icon: ListChecks,
      on: tab === "history" && historyFilter === "ALL", onClick: () => openHistory("ALL"),
    },
  ];

  const reject = async (request) => {
    setError("");
    setRejectingId(request.permission_request_id);
    try {
      await client.post(`/api/identity/permission-requests/${request.permission_request_id}/decide/`, {
        action: "reject",
        note: "",
      });
      await load();
    } catch {
      setError("Couldn't reject that request.");
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div className="ua-screen lr-page">
      <div className="ua-head">
        <div>
          <Breadcrumbs
            items={[
              { label: "System Administrator", to: "/dashboard", icon: ShieldCheck },
              { label: "Login requests" },
            ]}
          />
          <h1>Login requests</h1>
          <p>HR asks for logins to be created for onboarded employees</p>
        </div>
        {!loading && <span className="lr-count">{pending.length} waiting</span>}
      </div>

      <div className="lr-body">
        <div className="att2-cards att2-four att2-static">
          {stats.map(({ label, value, tone, Icon, on, onClick }) => (
            <div
              key={label}
              className={`att2-card tone-${tone} att2-click` + (on ? " selected" : "")}
              role="button"
              tabIndex={0}
              onClick={onClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }}
            >
              <span className="att2-card-top">
                <span className="att2-card-icon"><Icon size={16} /></span>
                <b>{loading ? "—" : value}</b>
              </span>
              <span className="att2-card-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="lr-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "pending"}
            className={tab === "pending" ? "on" : ""}
            onClick={() => setTab("pending")}
          >
            <MailOpen size={16} /> Pending <em>{pending.length}</em>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "history"}
            className={tab === "history" ? "on" : ""}
            onClick={() => openHistory("ALL")}
          >
            <History size={16} /> History <em>{history.length}</em>
          </button>
        </div>

        {tab === "pending" && (
          <div className="lr-note">
            <Info size={18} />
            <span>
              Approving opens the New account page pre-filled to that person. Creating the account completes the
              approval. The credentials are shared with the employee directly, never stored here.
            </span>
          </div>
        )}

        {error && <p className="ua-error">{error}</p>}

        {loading ? (
          <p className="lr-empty">Loading…</p>
        ) : shown.length === 0 ? (
          <div className="lr-empty-card">
            <MailOpen size={30} />
            <b>{tab === "pending" ? "No pending login requests" : historyFilter === "ALL" ? "No decided requests yet" : `No ${historyFilter.toLowerCase()} requests`}</b>
            <span>
              {tab === "pending" ? "New requests from HR will show up here." : "Approved and rejected requests will be listed here."}
            </span>
          </div>
        ) : (
          shown.map((r) => (
            <div className={"lr-card" + (tab === "history" ? " done " + r.status.toLowerCase() : "")} key={r.permission_request_id}>
              <span className="lr-avatar"><UserRound size={22} /></span>
              <div className="lr-mid">
                <b>{PREFIX}{personOf(r)}</b>
                <span>Requested by {r.requester_name}</span>
                <div className="lr-meta">
                  {r.reason && <i className="lr-tag">Reason: {r.reason}</i>}
                  <i className="lr-tag grey">Sent {fmtWhen(r.created_at)}</i>
                  {tab === "history" && r.decided_at && <i className="lr-tag grey">Decided {fmtWhen(r.decided_at)}</i>}
                </div>
                {tab === "history" && r.decision_note && <span className="lr-note-line">“{r.decision_note}”</span>}
              </div>
              {tab === "pending" ? (
                <div className="lr-actions">
                  <button
                    type="button"
                    className="ua-btn-accent"
                    onClick={() => navigate("/identity/users/new", { state: { request: r } })}
                  >
                    <Check size={16} /> Approve
                  </button>
                  <button
                    type="button"
                    className="lr-reject"
                    disabled={rejectingId === r.permission_request_id}
                    onClick={() => reject(r)}
                  >
                    <X size={16} /> {rejectingId === r.permission_request_id ? "…" : "Reject"}
                  </button>
                </div>
              ) : (
                <span className={"lr-status " + r.status.toLowerCase()}>{STATUS_LABEL[r.status] || r.status}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default LoginRequests;
