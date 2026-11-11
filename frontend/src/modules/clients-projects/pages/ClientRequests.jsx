import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, ClipboardList, Hourglass, CircleCheck, ArrowRightLeft, CalendarDays, UserRound, Search, ChevronDown } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

// client_request check constraints.
const PRIORITIES = [
  { key: "LOW", label: "Low", chip: "gray" },
  { key: "MEDIUM", label: "Medium", chip: "blue" },
  { key: "HIGH", label: "High", chip: "orange" },
  { key: "URGENT", label: "Urgent", chip: "red" },
];
const PRIORITY_CHIP = Object.fromEntries(PRIORITIES.map((p) => [p.key, p.chip]));
const STATUS_CHIP = { OPEN: "gray", IN_PROGRESS: "blue", RESOLVED: "green", CLOSED: "gray", CANCELLED: "red", ON_HOLD: "orange" };
const OPEN = ["OPEN", "IN_PROGRESS", "ON_HOLD"];

const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

function ClientRequests() {
  const { clientId } = useParams();
  const [requests, setRequests] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clientName, setClientName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [targetDate, setTargetDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const [convertingId, setConvertingId] = useState(null);
  const [convertError, setConvertError] = useState("");
  const [projectPickerFor, setProjectPickerFor] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const fetchData = () =>
    Promise.all([
      client.get(`/api/projects/clients/${clientId}/requests/`),
      client.get(`/api/projects/clients/${clientId}/`),
    ])
      .then(([reqRes, clientRes]) => {
        setRequests(reqRes.data);
        setProjects(clientRes.data.projects || []);
        setClientName(clientRes.data.client_name || null);
      })
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load requests."))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const createRequest = async () => {
    if (!title.trim()) {
      setFormError("Request title is required.");
      return;
    }
    setCreating(true);
    setFormError("");
    try {
      await client.post(`/api/projects/clients/${clientId}/requests/`, {
        request_title: title,
        request_description: description,
        request_type: requestType,
        priority,
        target_date: targetDate || null,
      });
      setMessage("Request logged.");
      setTitle(""); setDescription(""); setRequestType(""); setPriority("MEDIUM"); setTargetDate("");
      setShowForm(false);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't log request.");
    } finally {
      setCreating(false);
    }
  };

  const convertToRequirement = async (requestId, projectId) => {
    setConvertingId(requestId);
    setConvertError("");
    try {
      await client.post(`/api/projects/client-requests/${requestId}/convert/`, { project_id: projectId });
      setMessage("Converted to requirement.");
      setProjectPickerFor(null);
      fetchData();
    } catch (err) {
      setConvertError(err.response?.data?.detail || "Couldn't convert request.");
    } finally {
      setConvertingId(null);
    }
  };

  const startConvert = (requestId) => {
    setConvertError("");
    if (projects.length === 1) convertToRequirement(requestId, projects[0].project_id);
    else if (projects.length > 1) { setProjectPickerFor(requestId); setSelectedProjectId(""); }
    else setConvertError("This client has no projects to convert this request into.");
  };

  const sorted = useMemo(() => [...requests].sort((a, b) => new Date(b.requested_date) - new Date(a.requested_date)), [requests]);
  const openCount = requests.filter((r) => OPEN.includes(r.status)).length;
  const converted = requests.filter((r) => r.converted_to_requirement).length;
  const visible = sorted.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || [r.request_title, r.request_description, r.request_type, r.assigned_to_name].some((v) => (v || "").toLowerCase().includes(q));
  });

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        eyebrow="Client Management"
        section="Client Requests"
        title={clientName ? `${clientName} Requests` : "Client Requests"}
        subtitle="These feed into Requirements and Change Requests once assigned to a project."
        back="/clients/requests"
        backLabel="All clients"
      >
        <button type="button" className="bp-btn navy" onClick={() => { setShowForm(true); setFormError(""); }}><Plus size={16} /> New Request</button>
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}
      {convertError && <p className="bp-panel bp-error">{convertError}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">REQUESTS</p><span className="pm-ico navy"><ClipboardList size={20} /></span></div>
          <p className="bp-stat-value">{requests.length}</p>
          <p className="pm-foot"><span>Logged for this client</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">OPEN</p><span className="pm-ico orange"><Hourglass size={20} /></span></div>
          <p className="bp-stat-value tr-orange">{openCount}</p>
          <p className="pm-foot"><span>Open, in progress or on hold</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">CONVERTED</p><span className="pm-ico green"><CircleCheck size={20} /></span></div>
          <p className="bp-stat-value">{converted}</p>
          <p className="pm-foot"><span>Turned into requirements</span></p>
        </div>
      </div>

      <div className="bp-panel pm-toolbar">
        <label className="bp-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests…" />
        </label>
        <label className="bp-select">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {Object.keys(STATUS_CHIP).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
      </div>

      {loading ? (
        <p className="bp-loading">Loading requests…</p>
      ) : visible.length === 0 ? (
        <p className="bp-panel pm-empty-panel">{requests.length ? "No requests match these filters." : "No requests logged yet."}</p>
      ) : (
        <div className="pm-list">
          {visible.map((r, idx) => {
            const isAssignee = r.assigned_to_user === currentUser.user_id;
            return (
              <article key={r.client_request_id} className="bp-panel pm-item" style={{ "--i": idx }}>
                <div className="pm-item-top">
                  <div>
                    <h3 className="pm-item-title">{r.request_title}</h3>
                    <p className="pm-item-meta">
                      {r.request_type && <span>{r.request_type}</span>}
                      {r.assigned_to_name && <span><UserRound size={12} /> {r.assigned_to_name}</span>}
                      <span><CalendarDays size={12} /> Logged {day(r.requested_date)}</span>
                      {r.target_date && <span>Target {day(r.target_date)}</span>}
                    </p>
                  </div>
                  <span className="pm-tl-side">
                    <span className={`bp-chip ${PRIORITY_CHIP[r.priority] || "blue"}`}>{r.priority}</span>
                    <span className={`bp-chip ${STATUS_CHIP[r.status] || "gray"}`}>{(r.status || "").replace("_", " ")}</span>
                  </span>
                </div>
                {r.request_description && <p className="pm-item-text">{r.request_description}</p>}
                <div className="pm-item-foot">
                  {r.converted_to_requirement ? (
                    <span className="pm-ok"><CircleCheck size={12} /> Converted to requirement</span>
                  ) : isAssignee ? (
                    projectPickerFor === r.client_request_id ? (
                      <span className="pm-row-actions">
                        <label className="bp-select pm-status-select">
                          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                            <option value="">Select project…</option>
                            {projects.map((p) => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                          </select>
                          <ChevronDown size={14} />
                        </label>
                        <button type="button" className="bp-btn navy small" onClick={() => selectedProjectId && convertToRequirement(r.client_request_id, selectedProjectId)} disabled={!selectedProjectId || convertingId === r.client_request_id}>
                          {convertingId === r.client_request_id ? "Converting…" : "Confirm"}
                        </button>
                        <button type="button" className="bp-btn outline small" onClick={() => setProjectPickerFor(null)}>Cancel</button>
                      </span>
                    ) : (
                      <button type="button" className="bp-btn navy small" onClick={() => startConvert(r.client_request_id)} disabled={convertingId === r.client_request_id}>
                        <ArrowRightLeft size={12} /> {convertingId === r.client_request_id ? "Converting…" : "Convert to Requirement"}
                      </button>
                    )
                  ) : (
                    <span>Only the assignee can convert this request.</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="bp-modal-backdrop" onClick={() => !creating && setShowForm(false)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Request</h2>
            <p className="bp-sub">Log something {clientName || "this client"} asked for.</p>
            <div className="bp-form-grid">
              <label className="bp-field full"><span>Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="bp-field full"><span>Description</span>
                <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label className="bp-field"><span>Type</span>
                <input value={requestType} onChange={(e) => setRequestType(e.target.value)} placeholder="Feature, Bug, Query" />
              </label>
              <label className="bp-field"><span>Priority</span>
                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </label>
              <label className="bp-field"><span>Target date</span>
                <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </label>
            </div>
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setShowForm(false)} disabled={creating}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={createRequest} disabled={creating}>{creating ? "Logging…" : "Log Request"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientRequests;
