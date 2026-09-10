import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../../api/client";
import OrgTree from "../../../components/OrgTree";

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

function ProjectTeam() {
  const { projectId } = useParams();
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPM, setIsPM] = useState(false);

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [projectRole, setProjectRole] = useState("");
  const [reportsTo, setReportsTo] = useState("");
  const [assigning, setAssigning] = useState(false);

  const load = () => {
    setLoading(true);
    client.get(`/api/projects/${projectId}/team/`)
      .then(({ data }) => setMembers(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load team."))
      .finally(() => setLoading(false));
  };

  const loadPmStatus = () => {
    client.get('/api/projects/me/')
      .then(({ data }) => {
        const match = data.find((p) => String(p.project_id) === String(projectId));
        setIsPM(match?.my_role === "Project Manager");
      })
      .catch(() => setIsPM(false));
  };

  useEffect(() => {
    load();
    loadPmStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    client.get('/api/projects/users-lookup/')
      .then(({ data }) => setAllUsers(data))
      .catch(() => {});
  }, []);

  const assign = async () => {
    if (!userId || !projectRole) {
      setError("Please select a person and enter a role.");
      return;
    }
    setAssigning(true);
    setError("");
    try {
      await client.post(`/api/projects/${projectId}/team/`, {
        user_id: userId,
        project_role: projectRole,
        reports_to_team_member_id: reportsTo || null,
      });
      setMessage("Team member assigned.");
      setUserId(""); setProjectRole(""); setReportsTo("");
      setShowAssignForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't assign team member.");
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  const treeData = buildTree(members);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link to="/project/dashboard" className="text-sm text-blue-600 hover:underline">
        ← Back to Projects
      </Link>

      <div className="flex justify-between items-center mt-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Project Team</h1>
        {isPM && (
          <button
            onClick={() => setShowAssignForm((prev) => !prev)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            {showAssignForm ? "Cancel" : "+ Assign Team Member"}
          </button>
        )}
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {isPM && showAssignForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Assign Team Member</h3>

          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          >
            <option value="">Select person…</option>
            {allUsers.map((u) => (
              <option key={u.user_id} value={u.user_id}>{u.name}</option>
            ))}
          </select>

          <input
            placeholder="Role (e.g. Development Lead, UI/UX Designer)"
            value={projectRole}
            onChange={(e) => setProjectRole(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />

          <select
            value={reportsTo}
            onChange={(e) => setReportsTo(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
          >
            <option value="">Reports to… (optional)</option>
            {members.map((m) => (
              <option key={m.project_team_member_id} value={m.project_team_member_id}>
                {m.name} ({m.project_role})
              </option>
            ))}
          </select>

          <button
            onClick={assign}
            disabled={assigning}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {assigning ? "Assigning…" : "Assign"}
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {!treeData ? (
          <p className="text-gray-400 text-center">No team members yet.</p>
        ) : (
          <OrgTree treeData={treeData} />
        )}
      </div>
    </div>
  );
}

export default ProjectTeam;