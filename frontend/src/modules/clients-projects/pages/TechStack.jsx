import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../../api/client";

function TechStack() {
  const { projectId } = useParams();
  const [repositories, setRepositories] = useState([]);
  const [technologies, setTechnologies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showRepoForm, setShowRepoForm] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [repoProvider, setRepoProvider] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [savingRepo, setSavingRepo] = useState(false);

  const [showTechForm, setShowTechForm] = useState(false);
  const [techName, setTechName] = useState("");
  const [techCategory, setTechCategory] = useState("");
  const [techVersion, setTechVersion] = useState("");
  const [savingTech, setSavingTech] = useState(false);

  const load = () => {
    setLoading(true);
    client.get(`/api/projects/${projectId}/tech-stack/`)
      .then(({ data }) => {
        setRepositories(data.repositories);
        setTechnologies(data.technologies);
      })
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load tech stack."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const addRepo = async () => {
    if (!repoName.trim()) {
      setError("Repository name is required.");
      return;
    }
    setSavingRepo(true);
    setError("");
    try {
      await client.post(`/api/projects/${projectId}/tech-stack/`, {
        kind: "repository",
        repository_name: repoName,
        repository_provider: repoProvider,
        repository_url: repoUrl,
      });
      setMessage("Repository added.");
      setRepoName(""); setRepoProvider(""); setRepoUrl("");
      setShowRepoForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't add repository.");
    } finally {
      setSavingRepo(false);
    }
  };

  const addTech = async () => {
    if (!techName.trim()) {
      setError("Technology name is required.");
      return;
    }
    setSavingTech(true);
    setError("");
    try {
      await client.post(`/api/projects/${projectId}/tech-stack/`, {
        kind: "technology",
        technology_name: techName,
        technology_category: techCategory,
        version_reference: techVersion,
      });
      setMessage("Technology added.");
      setTechName(""); setTechCategory(""); setTechVersion("");
      setShowTechForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't add technology.");
    } finally {
      setSavingTech(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/project/tech-stack" className="text-sm text-blue-600 hover:underline">
        ← Back to Projects
      </Link>

      <h1 className="text-xl font-bold text-gray-900 mt-3 mb-6">Repository & Tech Stack</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {/* Repositories */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-gray-900">Repositories</h2>
        <button
          onClick={() => setShowRepoForm((prev) => !prev)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
        >
          {showRepoForm ? "Cancel" : "+ Add Repository"}
        </button>
      </div>

      {showRepoForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <input
            placeholder="Repository name"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              placeholder="Provider (e.g. GitHub)"
              value={repoProvider}
              onChange={(e) => setRepoProvider(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Repository URL"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={addRepo}
            disabled={savingRepo}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {savingRepo ? "Adding…" : "Add Repository"}
          </button>
        </div>
      )}

      {repositories.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 mb-8">
          No repositories added yet.
        </div>
      ) : (
        <div className="space-y-2 mb-8">
          {repositories.map((r) => (
            <div key={r.project_repository_id} className="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-900 text-sm">{r.repository_name}</p>
                <p className="text-xs text-gray-600">{r.repository_provider} · {r.default_branch}</p>
              </div>
              {r.repository_url && (
                <a href={r.repository_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                  Open →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Technologies */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-gray-900">Technologies</h2>
        <button
          onClick={() => setShowTechForm((prev) => !prev)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
        >
          {showTechForm ? "Cancel" : "+ Add Technology"}
        </button>
      </div>

      {showTechForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <input
              placeholder="Technology (e.g. React)"
              value={techName}
              onChange={(e) => setTechName(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Category (e.g. Frontend)"
              value={techCategory}
              onChange={(e) => setTechCategory(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Version"
              value={techVersion}
              onChange={(e) => setTechVersion(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={addTech}
            disabled={savingTech}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {savingTech ? "Adding…" : "Add Technology"}
          </button>
        </div>
      )}

      {technologies.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400">
          No technologies added yet.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {technologies.map((t) => (
            <span
              key={t.project_technology_id}
              className="bg-white border border-gray-200 rounded-full px-3 py-1.5 text-sm text-gray-800"
            >
              {t.technology_name}
              {t.version_reference && <span className="text-gray-500"> · {t.version_reference}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default TechStack;