import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { UserPlus, Users, Network, BadgeCheck, Bug, MessageSquare, Search } from "lucide-react";
import client from "../../../api/client";
import OrgTree from "../../../components/OrgTree";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

function buildTree(members) {
  const roots = members.filter((m) => !m.reports_to_team_member_id);
  if (roots.length === 0) return null;

  const toNode = (member) => ({
    project_team_member_id: member.project_team_member_id,
    full_name: member.name,
    designation: member.project_role,
    profile_photo: member.profile_photo || null,
    children: members
      .filter((m) => m.reports_to_team_member_id === member.project_team_member_id)
      .map(toNode),
  });

  const [firstRoot, ...otherRoots] = roots;
  const lead = toNode(firstRoot);

  return {
    lead: { full_name: lead.full_name, profile_photo: lead.profile_photo },
    children: [...lead.children, ...otherRoots.map(toNode)],
  };
}

const initials = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function ProjectTeam() {
  const { projectId } = useParams();
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPM, setIsPM] = useState(false);
  const [search, setSearch] = useState("");

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [projectRole, setProjectRole] = useState("");
  const [reportsTo, setReportsTo] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchTeam = () =>
    client.get(`/api/projects/${projectId}/team/`)
      .then(({ data }) => setMembers(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load team."))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchTeam();
    client.get("/api/projects/me/")
      .then(({ data }) => {
        const match = data.find((p) => String(p.project_id) === String(projectId));
        setProject(match || null);
        setIsPM(match?.my_role === "Project Manager");
      })
      .catch(() => setIsPM(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    client.get("/api/projects/users-lookup/")
      .then(({ data }) => setAllUsers(data))
      .catch(() => {});
  }, []);

  const assign = async () => {
    if (!userId || !projectRole.trim()) {
      setFormError("Please select a person and enter a role.");
      return;
    }
    setAssigning(true);
    setFormError("");
    try {
      await client.post(`/api/projects/${projectId}/team/`, {
        user_id: userId,
        project_role: projectRole.trim(),
        reports_to_team_member_id: reportsTo || null,
      });
      setMessage("Team member assigned.");
      setUserId(""); setProjectRole(""); setReportsTo("");
      setShowAssignForm(false);
      fetchTeam();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't assign team member.");
    } finally {
      setAssigning(false);
    }
  };

  const byId = useMemo(() => Object.fromEntries(members.map((m) => [m.project_team_member_id, m])), [members]);
  const reportCount = (id) => members.filter((m) => m.reports_to_team_member_id === id).length;
  const leads = members.filter((m) => reportCount(m.project_team_member_id) > 0);
  const roles = new Set(members.map((m) => m.project_role));
  const visible = members.filter((m) => {
    const q = search.trim().toLowerCase();
    return !q || [m.name, m.project_role].some((v) => (v || "").toLowerCase().includes(q));
  });
  const treeData = buildTree(members);

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        section="Project Team"
        title={project ? `${project.project_name} Team` : "Project Team"}
        subtitle={project ? `${project.client_name} · ${project.project_code}` : "Reporting structure and roles for this project."}
        back="/project/team"
        backLabel="All projects"
      >
        <Link to="/project/testing-reports" className="bp-btn outline"><Bug size={16} /> Testing Reports</Link>
        <Link to={`/project/${projectId}/ask-lead`} className="bp-btn outline"><MessageSquare size={16} /> Ask Project Lead</Link>
        {isPM && (
          <button type="button" className="bp-btn navy" onClick={() => { setShowAssignForm(true); setFormError(""); }}>
            <UserPlus size={16} /> Assign Team Member
          </button>
        )}
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label pm-label">TEAM MEMBERS</p>
            <span className="pm-ico navy"><Users size={20} /></span>
          </div>
          <p className="bp-stat-value">{members.length}</p>
          <p className="pm-foot"><span>Active on this project</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label pm-label">LEADS</p>
            <span className="pm-ico orange"><BadgeCheck size={20} /></span>
          </div>
          <p className="bp-stat-value">{leads.length}</p>
          <p className="pm-foot"><span>Members with direct reports</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label pm-label">ROLES</p>
            <span className="pm-ico green"><Network size={20} /></span>
          </div>
          <p className="bp-stat-value">{roles.size}</p>
          <p className="pm-foot"><span>Distinct project roles</span></p>
        </div>
      </div>

      <section className="bp-panel tr-card">
        <div className="tr-card-head">
          <div className="pm-card-title">
            <span className="pm-ico small soft"><Network size={17} /></span>
            <div>
              <h3>Reporting Structure</h3>
              <p>Who reports to whom on this project</p>
            </div>
          </div>
        </div>
        {loading ? <p className="pm-empty">Loading team…</p> : !treeData ? <p className="pm-empty">No team members yet.</p> : <OrgTree treeData={treeData} />}
      </section>

      <section className="bp-panel">
        <div className="pm-toolbar pm-toolbar-flat">
          <h3 className="pm-panel-title">Team Directory</h3>
          <label className="bp-search">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or role…" />
          </label>
        </div>
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr><th>Member</th><th>Project Role</th><th>Reports To</th><th>Direct Reports</th></tr>
            </thead>
            <tbody>
              {visible.length === 0 && <tr className="bp-empty-row"><td colSpan={4}>{members.length ? "No members match your search." : "No team members yet."}</td></tr>}
              {visible.map((m, idx) => {
                const manager = byId[m.reports_to_team_member_id];
                return (
                  <tr key={m.project_team_member_id} style={{ "--row": idx }}>
                    <td>
                      <div className="bp-person">
                        <span className={`bp-avatar t${idx % 4}`}>{initials(m.name)}</span>
                        <p className="bp-person-name">{m.name}</p>
                      </div>
                    </td>
                    <td><span className="pm-area">{m.project_role}</span></td>
                    <td>{manager ? <span className="bp-strong">{manager.name}</span> : <span className="bp-muted">Top of tree</span>}</td>
                    <td>{reportCount(m.project_team_member_id)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isPM && showAssignForm && (
        <div className="bp-modal-backdrop" onClick={() => !assigning && setShowAssignForm(false)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Assign Team Member</h2>
            <p className="bp-sub">Adds a person to this project and places them in the reporting tree.</p>
            <div className="bp-form-grid">
              <label className="bp-field full"><span>Person</span>
                <select value={userId} onChange={(e) => setUserId(e.target.value)}>
                  <option value="">Select person…</option>
                  {allUsers.map((u) => (
                    <option key={u.user_id} value={u.user_id}>{u.name}</option>
                  ))}
                </select>
              </label>
              <label className="bp-field full"><span>Project role</span>
                <input value={projectRole} onChange={(e) => setProjectRole(e.target.value)} placeholder="e.g. Development Lead, UI/UX Designer" />
              </label>
              <label className="bp-field full"><span>Reports to (optional)</span>
                <select value={reportsTo} onChange={(e) => setReportsTo(e.target.value)}>
                  <option value="">Nobody — top of the tree</option>
                  {members.map((m) => (
                    <option key={m.project_team_member_id} value={m.project_team_member_id}>{m.name} ({m.project_role})</option>
                  ))}
                </select>
              </label>
            </div>
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setShowAssignForm(false)} disabled={assigning}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={assign} disabled={assigning}>{assigning ? "Assigning…" : "Assign"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectTeam;
