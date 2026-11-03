import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap, Briefcase, BookOpen, Building2, FolderKanban, ArrowRight,
} from "lucide-react";
import LoginIllustration from "../modules/identity-access/components/LoginIllustration";
import "../styles/ChooseWorkspace.css";

const WORKSPACE_ICON = {
  student: GraduationCap,
  intern: Briefcase,
  training: BookOpen,
  hr: Building2,
  project: FolderKanban,
};

// Chip gradient + icon motion per workspace (see ChooseWorkspace.css).
// Only Vetri IT brand tones here — navy, orange and blue.
const WORKSPACE_TONE = {
  student: "sky",
  intern: "navy",
  training: "orange",
  hr: "amber",
  project: "royal",
};

const WORKSPACE_SUBTEXT = {
  student: "Attendance, assignments, progress",
  intern: "Tasks, project chat, evaluations",
  training: "Batches, attendance, reports",
  hr: "Employees, attendance, leave",
  project: "Projects, tasks, team management",
};

function ChooseWorkspace() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("available_workspaces") || "[]");
    if (stored.length === 0) {
      navigate("/dashboard");
      return;
    }
    setWorkspaces(stored);

    const user = JSON.parse(localStorage.getItem("user") || "null");
    setUsername(user?.full_name || user?.username || "");
  }, [navigate]);

  const selectWorkspace = (ws) => {
    localStorage.setItem("active_workspace", ws.key);
    navigate(ws.path);
  };

  return (
    <div className="ws-screen">
      <span className="ws-blob blob-a" aria-hidden="true" />
      <span className="ws-blob blob-b" aria-hidden="true" />
      <span className="ws-grid" aria-hidden="true" />

      <div className="ws-card">
        <div className="ws-hero">
          <span className="ws-hero-glow" aria-hidden="true" />
          <LoginIllustration />
        </div>

        <h1 className="ws-title">
          Welcome back{username ? <>, <span>{username}</span></> : ""}
        </h1>
        <p className="ws-subtitle">Choose which workspace you'd like to continue to</p>

        <div className="ws-list">
          {workspaces.map((w, index) => {
            const Icon = WORKSPACE_ICON[w.key] || FolderKanban;
            const tone = WORKSPACE_TONE[w.key] || "navy";
            const subtext = WORKSPACE_SUBTEXT[w.key] || "";

            return (
              <button
                key={w.key}
                type="button"
                className={`ws-option ws-${w.key}`}
                style={{ "--delay": `${0.15 + index * 0.08}s` }}
                onClick={() => selectWorkspace(w)}
              >
                <span className={`ws-icon tone-${tone}`}>
                  <span className="ws-icon-ring" aria-hidden="true" />
                  <Icon size={22} strokeWidth={2.2} />
                </span>
                <span className="ws-text">
                  <span className="ws-label">{w.label}</span>
                  <span className="ws-sub">{subtext}</span>
                </span>
                <span className="ws-arrow">
                  <ArrowRight size={18} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ChooseWorkspace;
