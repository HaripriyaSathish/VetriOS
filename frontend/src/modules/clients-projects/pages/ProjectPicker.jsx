import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, FolderKanban, Search, UserRound } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const STATUS_CHIP = { Active: "green", Planned: "blue", "On Hold": "orange", Completed: "green", Cancelled: "red", Archived: "gray" };

function ProjectPicker({ title, subtitle, basePath, getPath }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    client.get("/api/projects/me/")
      .then(({ data }) => setProjects(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your projects."))
      .finally(() => setLoading(false));
  }, []);

  // getPath(projectId) lets a page override the URL shape when the
  // route puts the id before the feature name (e.g. /project/6/team)
  // instead of after it (e.g. /project/requirements/6).
  const linkFor = (projectId) => (getPath ? getPath(projectId) : `${basePath}/${projectId}`);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => [p.project_name, p.project_code, p.client_name, p.my_role].some((v) => (v || "").toLowerCase().includes(q)));
  }, [projects, search]);

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader section={title} title={title} subtitle={subtitle} />

      {error && <p className="bp-panel bp-error">{error}</p>}

      <div className="bp-panel pm-toolbar">
        <span className="bp-chip blue"><FolderKanban size={12} /> {projects.length} {projects.length === 1 ? "project" : "projects"}</span>
        <label className="bp-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects, clients…" />
        </label>
      </div>

      {loading ? (
        <p className="bp-loading">Loading your projects…</p>
      ) : visible.length === 0 ? (
        <p className="bp-panel pm-empty-panel">{projects.length ? "No projects match your search." : "You aren't on any projects yet."}</p>
      ) : (
        <div className="pm-pick-grid">
          {visible.map((p, idx) => (
            <Link key={p.project_id} to={linkFor(p.project_id)} className="pm-pick" style={{ "--i": idx }}>
              <div className="pm-pick-top">
                <span className="pm-ico small navy"><FolderKanban size={17} /></span>
                <span className={`bp-chip ${STATUS_CHIP[p.status] || "blue"}`}>{p.status}</span>
              </div>
              <b className="pm-pick-name">{p.project_name}</b>
              <small className="pm-pick-code">{p.project_code}</small>
              <div className="pm-pick-meta">
                <span><Briefcase size={12} /> {p.client_name}</span>
                <span><UserRound size={12} /> {p.my_role}</span>
              </div>
              <span className="pm-pick-open">Open <ArrowRight size={13} /></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectPicker;
