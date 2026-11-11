import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { GitPullRequestArrow, Hourglass, CircleCheck, CircleX, Clock3, Search, Link2 } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

// chk_change_request_status / chk_change_request_priority.
const STATUS = {
  SUBMITTED: { label: "Submitted", chip: "gray" },
  UNDER_REVIEW: { label: "Under Review", chip: "blue" },
  APPROVED: { label: "Approved", chip: "green" },
  IN_PROGRESS: { label: "In Progress", chip: "orange" },
  COMPLETED: { label: "Completed", chip: "green" },
  REJECTED: { label: "Rejected", chip: "red" },
  CANCELLED: { label: "Cancelled", chip: "red" },
};
const PRIORITY_CHIP = { LOW: "gray", MEDIUM: "blue", HIGH: "orange", URGENT: "red" };
const OPEN = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "IN_PROGRESS"];

const TABS = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CLOSED", label: "Rejected / Cancelled" },
];

const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

function ChangeRequests() {
  const { projectId } = useParams();
  const [changeRequests, setChangeRequests] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      client.get(`/api/projects/change-requests/?project_id=${projectId}`)
        .then(({ data }) => setChangeRequests(data))
        .catch((err) => setError(err.response?.data?.detail || "Couldn't load change requests.")),
      client.get(`/api/projects/${projectId}/requirements/`).then(({ data }) => setRequirements(data)).catch(() => {}),
      client.get("/api/projects/me/").then(({ data }) => setProject(data.find((p) => String(p.project_id) === String(projectId)) || null)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [projectId]);

  const reqTitle = useMemo(() => Object.fromEntries(requirements.map((r) => [r.project_requirement_id, r.requirement_title])), [requirements]);
  const bucket = (s) => (OPEN.includes(s) ? "OPEN" : s === "COMPLETED" ? "COMPLETED" : "CLOSED");
  const counts = useMemo(() => {
    const c = { ALL: changeRequests.length, OPEN: 0, COMPLETED: 0, CLOSED: 0 };
    changeRequests.forEach((cr) => { c[bucket(cr.status)] += 1; });
    return c;
  }, [changeRequests]);
  const effort = changeRequests.filter((cr) => OPEN.includes(cr.status)).reduce((a, cr) => a + Number(cr.estimated_effort_hours || 0), 0);

  const visible = changeRequests.filter((cr) => {
    if (tab !== "ALL" && bucket(cr.status) !== tab) return false;
    const q = search.trim().toLowerCase();
    return !q || [cr.title, cr.change_request_code, cr.description, cr.reason, reqTitle[cr.project_requirement]].some((v) => (v || "").toLowerCase().includes(q));
  });

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        section="Change Requests"
        title={project ? `${project.project_name} Change Requests` : "Change Requests"}
        subtitle="Only change requests linked to a requirement on this project appear here. Others are visible from Client Requests."
        back="/project/change-requests"
        backLabel="All projects"
      >
        <Link to={`/project/requirements/${projectId}`} className="bp-btn outline"><Link2 size={16} /> Project Requirements</Link>
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">CHANGE REQUESTS</p><span className="pm-ico navy"><GitPullRequestArrow size={20} /></span></div>
          <p className="bp-stat-value">{counts.ALL}</p>
          <p className="pm-foot"><span>Linked to this project</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">OPEN</p><span className="pm-ico orange"><Hourglass size={20} /></span></div>
          <p className="bp-stat-value tr-orange">{counts.OPEN}</p>
          <p className="pm-foot"><span>{effort ? `${effort} h estimated effort` : "No effort estimated"}</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">COMPLETED</p><span className="pm-ico green"><CircleCheck size={20} /></span></div>
          <p className="bp-stat-value">{counts.COMPLETED}</p>
          <p className="pm-foot"><span>Delivered changes</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">REJECTED / CANCELLED</p><span className="pm-ico red"><CircleX size={20} /></span></div>
          <p className="bp-stat-value">{counts.CLOSED}</p>
          <p className="pm-foot"><span>Closed without delivery</span></p>
        </div>
      </div>

      <div className="bp-panel pm-toolbar">
        <div className="bp-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`bp-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}<small>({counts[t.key]})</small>
            </button>
          ))}
        </div>
        <label className="bp-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search change requests…" />
        </label>
      </div>

      {loading ? (
        <p className="bp-loading">Loading change requests…</p>
      ) : visible.length === 0 ? (
        <p className="bp-panel pm-empty-panel">{changeRequests.length ? "No change requests match these filters." : "No change requests linked to this project yet."}</p>
      ) : (
        <div className="pm-list">
          {visible.map((cr, idx) => {
            const st = STATUS[cr.status] || STATUS.SUBMITTED;
            return (
              <article key={cr.change_request_id} className="bp-panel pm-item" style={{ "--i": idx }}>
                <div className="pm-item-top">
                  <div>
                    <span className="pm-code">{cr.change_request_code}</span>
                    <h3 className="pm-item-title">{cr.title}</h3>
                  </div>
                  <span className="pm-tl-side">
                    <span className={`bp-chip ${PRIORITY_CHIP[cr.priority] || "blue"}`}>{cr.priority}</span>
                    <span className={`bp-chip ${st.chip}`}>{st.label}</span>
                  </span>
                </div>
                {cr.description && <p className="pm-item-text">{cr.description}</p>}
                {cr.reason && <p className="pm-item-text"><b>Reason:</b> {cr.reason}</p>}
                {cr.impact_description && <p className="pm-item-text"><b>Impact:</b> {cr.impact_description}</p>}
                <p className="pm-item-meta">
                  {cr.project_requirement && <span><Link2 size={12} /> {reqTitle[cr.project_requirement] || `Requirement #${cr.project_requirement}`}</span>}
                  {cr.estimated_effort_hours != null && <span><Hourglass size={12} /> {cr.estimated_effort_hours} h effort</span>}
                  <span><Clock3 size={12} /> Requested {day(cr.requested_date)}</span>
                  {cr.approval_date && <span>Approved {day(cr.approval_date)}</span>}
                  {cr.completed_date && <span className="pm-ok">Completed {day(cr.completed_date)}</span>}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ChangeRequests;
