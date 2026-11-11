import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, GitBranch, Layers, ExternalLink, Star, Code2 } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

function TechStack() {
  const { projectId } = useParams();
  const [repositories, setRepositories] = useState([]);
  const [technologies, setTechnologies] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [modal, setModal] = useState(null); // "repo" | "tech"
  const [repoName, setRepoName] = useState("");
  const [repoProvider, setRepoProvider] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [techName, setTechName] = useState("");
  const [techCategory, setTechCategory] = useState("");
  const [techVersion, setTechVersion] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchStack = () =>
    client.get(`/api/projects/${projectId}/tech-stack/`)
      .then(({ data }) => {
        setRepositories(data.repositories);
        setTechnologies(data.technologies);
      })
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load tech stack."))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchStack();
    client.get("/api/projects/me/").then(({ data }) => setProject(data.find((p) => String(p.project_id) === String(projectId)) || null)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const openModal = (kind) => { setModal(kind); setFormError(""); };

  const save = async () => {
    const isRepo = modal === "repo";
    if (isRepo ? !repoName.trim() : !techName.trim()) {
      setFormError(isRepo ? "Repository name is required." : "Technology name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await client.post(`/api/projects/${projectId}/tech-stack/`, isRepo
        ? { kind: "repository", repository_name: repoName, repository_provider: repoProvider, repository_url: repoUrl }
        : { kind: "technology", technology_name: techName, technology_category: techCategory, version_reference: techVersion });
      setMessage(isRepo ? "Repository added." : "Technology added.");
      if (isRepo) { setRepoName(""); setRepoProvider(""); setRepoUrl(""); } else { setTechName(""); setTechCategory(""); setTechVersion(""); }
      setModal(null);
      fetchStack();
    } catch (err) {
      setFormError(err.response?.data?.detail || (isRepo ? "Couldn't add repository." : "Couldn't add technology."));
    } finally {
      setSaving(false);
    }
  };

  const byCategory = technologies.reduce((acc, t) => {
    const k = t.technology_category || "Other";
    (acc[k] = acc[k] || []).push(t);
    return acc;
  }, {});

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        section="Repository & Tech Stack"
        title={project ? `${project.project_name} Tech Stack` : "Repository & Tech Stack"}
        subtitle="Shared reference for the team: where the code lives and what it's built with."
        back="/project/tech-stack"
        backLabel="All projects"
      >
        <button type="button" className="bp-btn outline" onClick={() => openModal("tech")}><Plus size={16} /> Add Technology</button>
        <button type="button" className="bp-btn navy" onClick={() => openModal("repo")}><Plus size={16} /> Add Repository</button>
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">REPOSITORIES</p><span className="pm-ico navy"><GitBranch size={20} /></span></div>
          <p className="bp-stat-value">{repositories.length}</p>
          <p className="pm-foot"><span>{repositories.filter((r) => r.is_primary).length} primary</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">TECHNOLOGIES</p><span className="pm-ico orange"><Code2 size={20} /></span></div>
          <p className="bp-stat-value">{technologies.length}</p>
          <p className="pm-foot"><span>{Object.keys(byCategory).length} categories</span></p>
        </div>
      </div>

      <div className="pm-grid even">
        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div className="pm-card-title">
              <span className="pm-ico small soft"><GitBranch size={17} /></span>
              <div><h3>Repositories</h3><p>Source code for this project</p></div>
            </div>
          </div>
          {loading ? <p className="pm-empty">Loading…</p> : repositories.length === 0 ? <p className="pm-empty">No repositories added yet.</p> : (
            <div className="pm-engagements">
              {repositories.map((r) => (
                <div key={r.project_repository_id} className="pm-eng">
                  <div>
                    <b>{r.repository_name} {r.is_primary && <span className="bp-chip orange"><Star size={10} /> Primary</span>}</b>
                    <small>{[r.repository_provider, r.default_branch && `branch ${r.default_branch}`, r.repository_type].filter(Boolean).join(" · ") || "No provider details"}</small>
                  </div>
                  {r.repository_url && <a className="bp-btn outline small" href={r.repository_url} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Open</a>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div className="pm-card-title">
              <span className="pm-ico small soft"><Layers size={17} /></span>
              <div><h3>Technologies</h3><p>Grouped by category</p></div>
            </div>
          </div>
          {loading ? <p className="pm-empty">Loading…</p> : technologies.length === 0 ? <p className="pm-empty">No technologies added yet.</p> : (
            <div className="pm-tech-groups">
              {Object.entries(byCategory).map(([cat, list]) => (
                <div key={cat}>
                  <p className="pm-section-label">{cat}</p>
                  <div className="pm-tags">
                    {list.map((t) => (
                      <span key={t.project_technology_id} className={`pm-tag ${t.is_primary ? "primary" : ""}`}>
                        {t.technology_name}{t.version_reference && <small> · {t.version_reference}</small>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {modal && (
        <div className="bp-modal-backdrop" onClick={() => !saving && setModal(null)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal === "repo" ? "Add Repository" : "Add Technology"}</h2>
            <p className="bp-sub">Visible to everyone on this project.</p>
            {modal === "repo" ? (
              <div className="bp-form-grid">
                <label className="bp-field full"><span>Repository name</span>
                  <input value={repoName} onChange={(e) => setRepoName(e.target.value)} />
                </label>
                <label className="bp-field"><span>Provider</span>
                  <input value={repoProvider} onChange={(e) => setRepoProvider(e.target.value)} placeholder="e.g. GitHub" />
                </label>
                <label className="bp-field"><span>Repository URL</span>
                  <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://…" />
                </label>
              </div>
            ) : (
              <div className="bp-form-grid">
                <label className="bp-field full"><span>Technology</span>
                  <input value={techName} onChange={(e) => setTechName(e.target.value)} placeholder="e.g. React" />
                </label>
                <label className="bp-field"><span>Category</span>
                  <input value={techCategory} onChange={(e) => setTechCategory(e.target.value)} placeholder="e.g. Frontend" />
                </label>
                <label className="bp-field"><span>Version</span>
                  <input value={techVersion} onChange={(e) => setTechVersion(e.target.value)} />
                </label>
              </div>
            )}
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setModal(null)} disabled={saving}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={save} disabled={saving}>{saving ? "Adding…" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TechStack;
