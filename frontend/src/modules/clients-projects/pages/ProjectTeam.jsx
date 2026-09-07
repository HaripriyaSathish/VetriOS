import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../../api/client";

function TeamNode({ member, allMembers, depth }) {
  const children = allMembers.filter((m) => m.reports_to_team_member_id === member.project_team_member_id);
  return (
    <div style={{ marginLeft: depth * 24 }} className="mb-2">
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 inline-block">
        <span className="font-medium text-gray-900">{member.name}</span>
        <span className="text-xs text-gray-500 ml-2">— {member.project_role}</span>
      </div>
      {children.map((c) => (
        <TeamNode key={c.project_team_member_id} member={c} allMembers={allMembers} depth={depth + 1} />
      ))}
    </div>
  );
}

function ProjectTeam() {
  const { projectId } = useParams();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  useEffect(() => { load(); }, [projectId]);

  const assign = async () => {
    if (!userId || !projectRole) {
      setError("User ID and role are required.");
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

  const roots = members.filter((m) => !m.reports_to_team_member_id);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/project/dashboard" className="text-sm text-blue-600 hover:underline">
        ← Back to Projects
      </Link>

      <div className="flex justify-between items-center mt-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Project Team</h1>
        <button
          onClick={() => setShowAssignForm((prev) => !prev)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
        >
          {showAssignForm ? "Cancel" : "+ Assign Team Member"}
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {showAssignForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Assign Team Member</h3>
          <input placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3" />
          <input placeholder="Role (e.g. Development Lead, UI/UX Designer)" value={projectRole}
            onChange={(e) => setProjectRole(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3" />
          <select value={reportsTo} onChange={(e) => setReportsTo(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4">
            <option value="">Reports to… (optional)</option>
            {members.map((m) => (
              <option key={m.project_team_member_id} value={m.project_team_member_id}>
                {m.name} ({m.project_role})
              </option>
            ))}
          </select>
          <button onClick={assign} disabled={assigning}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
            {assigning ? "Assigning…" : "Assign"}
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {roots.length === 0 ? (
          <p className="text-gray-400 text-center">No team members yet.</p>
        ) : (
          roots.map((r) => (
            <TeamNode key={r.project_team_member_id} member={r} allMembers={members} depth={0} />
          ))
        )}
      </div>
    </div>
  );
}

export default ProjectTeam;