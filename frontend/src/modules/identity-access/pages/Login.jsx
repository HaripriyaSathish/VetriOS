import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  CircleAlert,
  Eye,
  EyeOff,
  FileText,
  FolderKanban,
  GraduationCap,
  Handshake,
  LoaderCircle,
  Lock,
  Mail,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import client from "../../../api/client";
import LoginIllustration from "../components/LoginIllustration";
import "../styles/Login.css";

// Maps a role name to the workspace it unlocks. System Administrator is
// deliberately NOT in this map — they always get the merged "see
// everything" sidebar directly, no switcher, regardless of what other
// roles they also hold.
//
// "Employee" is deliberately NOT in this map either. It's a generic HR
// role covering many job functions — Dev Leads, testers, interns who've
// been converted to an Employee row, actual trainers, etc. — so it can't
// blanket-map to Training. Whether an employee gets Training Management
// offered is resolved dynamically below, based on whether they actually
// have training duties (a TrainerProfile / assigned batches).
const ROLE_WORKSPACE_MAP = {
  "Student": { key: "student", label: "Student Portal", path: "/student/dashboard" },
  "Intern": { key: "intern", label: "Intern Portal", path: "/intern/my-internship" },
  "Business Team": { key: "training", label: "Training Management", path: "/training" },
  "HR Administrator": { key: "hr", label: "HR Management", path: "/hr" },
  "Project Manager": { key: "project", label: "Project Management", path: "/project/dashboard" },
};

// Module icons orbiting the VetriOS mark on the brand panel — inner ring
// spins one way, outer ring the other. `tone` picks the chip gradient.
const INNER_ORBIT = [
  { Icon: GraduationCap, label: "Training", tone: "orange" },
  { Icon: Briefcase, label: "Internship", tone: "blue" },
  { Icon: Users, label: "HR", tone: "teal" },
  { Icon: FolderKanban, label: "Projects", tone: "violet" },
];
const OUTER_ORBIT = [
  { Icon: Handshake, label: "Clients", tone: "pink" },
  { Icon: FileText, label: "Documents", tone: "sunset" },
  { Icon: Mail, label: "Communication", tone: "blue" },
  { Icon: ShieldCheck, label: "Identity & Access", tone: "orange" },
];

function OrbitRing({ items, className }) {
  return (
    <div className={`login-orbit-ring ${className}`}>
      {items.map(({ Icon, label, tone }, index) => (
        <span
          key={label}
          className="login-orbit-item"
          style={{ "--angle": `${(360 / items.length) * index}deg` }}
        >
          <span className={`login-orbit-chip tone-${tone}`} title={label}>
            <Icon size={20} strokeWidth={2.2} />
          </span>
        </span>
      ))}
    </div>
  );
}

// Sign-in form: POSTs to /api/identity/login/, stores the returned JWT
// pair, then sends the user on to the right landing page for their role.
function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await client.post("/api/identity/login/", {
        username,
        password,
      });

      // Tokens + resolved user (roles, permissions) come back together —
      // store both so other pages can read "who's signed in" without a
      // second request.
      localStorage.setItem("access_token", response.data.access);
      localStorage.setItem("refresh_token", response.data.refresh);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      let roles = response.data.user?.roles || [];

      // System Administrator always gets the merged, full-access
      // dashboard directly — never the workspace chooser, even if they
      // also hold other roles like Project Manager.
      if (roles.includes("System Administrator")) {
        navigate("/dashboard");
        return;
      }

      // Someone promoted from Student to Intern still keeps the
      // underlying Student role active, but should only ever be routed
      // as an Intern — same rule already applied to the topbar/sidebar.
      // Same idea one step further: once converted all the way to
      // Employee, drop both Student and Intern — they're a real
      // employee now, not an intern, even though those roles stay
      // layered (never revoked) in the database.
      if (roles.includes("Employee") && (roles.includes("Intern") || roles.includes("Student"))) {
        roles = roles.filter((r) => r !== "Intern" && r !== "Student");
      } else if (roles.includes("Intern")) {
        roles = roles.filter((r) => r !== "Student");
      }

      // Resolve each remaining role to its workspace, de-duplicating
      // (e.g. Business Team maps to "training" the same as a real
      // trainer would via the dynamic check below).
      const workspaces = [];
      const seenKeys = new Set();
      roles.forEach((role) => {
        const ws = ROLE_WORKSPACE_MAP[role];
        if (ws && !seenKeys.has(ws.key)) {
          seenKeys.add(ws.key);
          workspaces.push(ws);
        }
      });

      // Project team membership isn't an RBAC role, so it never comes
      // through ROLE_WORKSPACE_MAP above. Check it directly — anyone
      // with at least one ProjectTeamMember row gets Project Management
      // as a workspace, whether they're the PM, a functional lead, a
      // regular team member, or an Intern staffed on a client project.
      try {
        const { data: myProjects } = await client.get("/api/projects/me/");
        if (Array.isArray(myProjects) && myProjects.length > 0 && !seenKeys.has("project")) {
          seenKeys.add("project");
          workspaces.push({ key: "project", label: "Project Management", path: "/project/dashboard" });
        }
      } catch {
        // Don't block login over this check — just skip offering the
        // project workspace if it fails.
      }

      // Same idea for training: "Employee" alone doesn't mean trainer,
      // so check for real training duties instead of trusting the role
      // name. Skipped entirely for Business Team, who already got
      // "training" from the static map above.
      if (!seenKeys.has("training")) {
        try {
          const { data: trainerDashboard } = await client.get("/api/training/dashboard/");
          const hasTrainingDuties =
            trainerDashboard &&
            (Array.isArray(trainerDashboard) ? trainerDashboard.length > 0 : true);
          if (hasTrainingDuties) {
            seenKeys.add("training");
            workspaces.push({ key: "training", label: "Training Management", path: "/training" });
          }
        } catch {
          // 404/403/empty here just means this person isn't a trainer —
          // skip offering Training Management.
        }
      }

      if (workspaces.length > 1) {
        // More than one workspace available — let them pick.
        localStorage.setItem("available_workspaces", JSON.stringify(workspaces));
        navigate("/choose-workspace");
      } else if (workspaces.length === 1) {
        localStorage.setItem("active_workspace", workspaces[0].key);
        navigate(workspaces[0].path);
      } else {
        // No mapped role at all — fall back to the generic dashboard.
        navigate("/dashboard");
      }
    } catch (err) {
      const detail = err.response?.data?.non_field_errors?.[0];
      setError(detail || "Invalid username or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-panel">
        <span className="login-blob blob-a" aria-hidden="true" />
        <span className="login-blob blob-b" aria-hidden="true" />
        <span className="login-grid" aria-hidden="true" />

        <div className="login-orbit" aria-hidden="true">
          <span className="login-orbit-track track-inner" />
          <span className="login-orbit-track track-outer" />
          <OrbitRing items={INNER_ORBIT} className="ring-inner" />
          <OrbitRing items={OUTER_ORBIT} className="ring-outer" />
          <div className="login-orbit-core">
            <span className="login-core-pulse" />
            <span className="login-core-pulse delay" />
            <LoginIllustration />
          </div>
        </div>

        <div className="login-panel-content">
          <span className="login-eyebrow">
            <span className="login-eyebrow-dot" />
            Vetri IT Systems · Centralised Hub
          </span>
          <h1>
            One hub for <span>every team.</span>
          </h1>
          <p>
            Training, internships, HR, projects, clients, documents and
            communication — all running on one shared Vetri-AI-OS workspace.
          </p>
        </div>
      </div>

      <div className="login-form-side">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-mobile-brand">
            <span className="login-core-mark small">V</span>
            <span>Vetri-AI-OS</span>
          </div>

          <div className="login-card-header">
            <h2>Welcome back</h2>
            <p>Sign in to your Vetri-AI-OS workspace</p>
          </div>

          <label htmlFor="username">Username</label>
          <div className="login-field">
            <User className="login-field-icon" size={18} />
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <label htmlFor="password">Password</label>
          <div className="login-field">
            <Lock className="login-field-icon" size={18} />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login-eye"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p className="login-error" role="alert">
              <CircleAlert size={16} />
              {error}
            </p>
          )}

          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? (
              <>
                <LoaderCircle className="login-spin" size={18} />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="login-submit-arrow" size={18} />
              </>
            )}
          </button>

          <p className="login-footnote">
            <ShieldCheck size={14} />
            Secure sign-in · Vetri IT Systems
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;