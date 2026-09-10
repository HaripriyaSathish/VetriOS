import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldCheck,
  KeyRound,
  Users,
  Lock,
  ChevronDown,
  Briefcase,
  CalendarCheck,
  Palmtree,
  ClipboardList,
  GraduationCap,
  Layers,
  FileText,
  BarChart3,
  Mic,
  Video,
  UserMinus,
  MessageCircle,
  UserCheck,
  TrendingUp,
  Link2,
  LogOut,
  FolderKanban,
  PieChart,
  Library,
  Sparkles,
  LayoutTemplate,
  CheckSquare,
  Scale,
} from "lucide-react";
import { NAV_ITEMS, hasAccess } from "../config/nav";
import client from "../api/client"; // TODO: confirm this matches your real api client path
import "../components-styles/Sidebar.css";

const SYSADMIN_PATHS = ["/dashboard", "/identity/users", "/identity/roles", "/identity/permissions"];
const HR_PATHS = ["/hr"];
const BUSINESS_TEAM_PATHS = [
  "/training/students", "/training/internship-approvals", "/training/enquiries",
  "/training/fee-conversion", "/training/batches/new", "/training/welcome-emails",
  "/training/completion-extension-approvals",
];
const DOCUMENTS_PATHS = ["/documents"];
const PROJECT_MGMT_PATHS = [
  "/project/dashboard", "/project/team", "/project/requirements", "/project/kanban",
  "/project/milestones", "/project/deployments", "/project/tech-stack", "/project/change-requests",
  "/project/recommend-internship-action",
];
const CLIENT_MGMT_PATHS = [
  "/clients/directory", "/clients/meetings", "/clients/requests",
  "/clients/payments", "/clients/approval-documents", "/clients/my-clients",
];

function Sidebar() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const location = useLocation();
  const [trainingOpen, setTrainingOpen] = useState(true);

  const identityRequirement = { type: "role", value: "System Administrator" };
  const businessTeamRequirement = { type: "role", value: ["Business Team", "System Administrator"] };
  const trainerRequirement = { type: "role", value: "Employee" };
  const studentRequirement = { type: "role", value: "Student" };
  const internRequirement = { type: "role", value: "Intern" };
  const trainingItem = NAV_ITEMS.find((item) => item.id === "training");
  const hrItem = NAV_ITEMS.find((item) => item.id === "hr");

  const isSystemAdministrator = hasAccess(identityRequirement, user);
  const isIntern = hasAccess(internRequirement, user);

  const activeWorkspace = localStorage.getItem("active_workspace");
  const inWorkspace = (key) => isSystemAdministrator || activeWorkspace === key;

  const isOnSysAdminPage = SYSADMIN_PATHS.some((path) => location.pathname.startsWith(path));
  const [sysAdminOpen, setSysAdminOpen] = useState(isOnSysAdminPage);

  const canSeeHR = hrItem && hasAccess(hrItem.requirement, user);
  const isOnHRPage = HR_PATHS.some((path) => location.pathname.startsWith(path));
  const [hrOpen, setHrOpen] = useState(isOnHRPage);

  const isOnBusinessTeamPage = BUSINESS_TEAM_PATHS.some((path) => location.pathname.startsWith(path));
  const [businessTeamOpen, setBusinessTeamOpen] = useState(isOnBusinessTeamPage);

  const documentsItem = NAV_ITEMS.find((item) => item.id === "documents");
  const canSeeDocuments = documentsItem && hasAccess(documentsItem.requirement, user);
  const isOnDocumentsPage = DOCUMENTS_PATHS.some((path) => location.pathname.startsWith(path));
  const [documentsOpen, setDocumentsOpen] = useState(isOnDocumentsPage);

  const isOnProjectMgmtPage = PROJECT_MGMT_PATHS.some((path) => location.pathname.startsWith(path));
  const [projectMgmtOpen, setProjectMgmtOpen] = useState(isOnProjectMgmtPage);

  const isOnClientMgmtPage = CLIENT_MGMT_PATHS.some((path) => location.pathname.startsWith(path));
  const [clientMgmtOpen, setClientMgmtOpen] = useState(isOnClientMgmtPage);

  // ---- Project membership + PM detection (drives both sidebar groups) ----
  const [myProjects, setMyProjects] = useState([]);
  const [myProjectsChecked, setMyProjectsChecked] = useState(false);

  useEffect(() => {
    if (!user) return;
    client.get('/api/projects/me/')
      .then(({ data }) => setMyProjects(data))
      .catch(() => setMyProjects([]))
      .finally(() => setMyProjectsChecked(true));
  }, []);

  const isProjectTeamMember = myProjectsChecked && myProjects.length > 0;
  // True project-manager status is per-project (my_role === "Project Manager"),
  // not a system role — this is what gates Client Management specifically.
  const isActualProjectManager = myProjects.some((p) => p.my_role === "Project Manager");

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-mark">V</span>
        <span className="sidebar-brand-name">VetriOS</span>
      </div>

      {!isSystemAdministrator && (
        <NavLink
          to="/dashboard"
          className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
        >
          <span className="nav-icon">
            <LayoutDashboard size={16} />
          </span>
          Dashboard
        </NavLink>
      )}

      {inWorkspace("training") && !isSystemAdministrator && !canSeeHR && !isIntern && !!user?.employee_code && (
        <>
          <NavLink
            to="/my/attendance"
            className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
          >
            <span className="nav-icon">
              <CalendarCheck size={16} />
            </span>
            Attendance
          </NavLink>

          <NavLink
            to="/my/leave"
            className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
          >
            <span className="nav-icon">
              <Palmtree size={16} />
            </span>
            Apply Leave
          </NavLink>
        </>
      )}

      {inWorkspace("training") && !isSystemAdministrator && !isIntern && !!user?.employee_code && (
        <NavLink
          to="/my/worklog"
          className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
        >
          <span className="nav-icon">
            <ClipboardList size={16} />
          </span>
          My Worklogs
        </NavLink>
      )}

      {!!user?.is_department_lead && (
        <NavLink
          to="/my/team-worklogs"
          className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
        >
          <span className="nav-icon">
            <Users size={16} />
          </span>
          Team Worklogs
        </NavLink>
      )}

      {isSystemAdministrator && (
        <>
          <button
            type="button"
            className={"nav-item nav-group-toggle" + (sysAdminOpen ? " open" : "")}
            onClick={() => setSysAdminOpen((prev) => !prev)}
          >
            <span className="nav-icon">
              <ShieldCheck size={16} />
            </span>
            System Administrator
            <span className="nav-chevron">
              <ChevronDown size={14} />
            </span>
          </button>

          {sysAdminOpen && (
            <div className="nav-subgroup">
              <NavLink
                to="/dashboard"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <LayoutDashboard size={14} />
                </span>
                Dashboard
              </NavLink>

              <NavLink
                to="/identity/roles"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <KeyRound size={14} />
                </span>
                Roles
              </NavLink>

              <NavLink
                to="/identity/users"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <Users size={14} />
                </span>
                User & Accounts
              </NavLink>

              <NavLink
                to="/identity/permissions"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <Lock size={14} />
                </span>
                Permissions
              </NavLink>
            </div>
          )}
        </>
      )}

      {inWorkspace("hr") && canSeeHR && (
        <>
          <button
            type="button"
            className={"nav-item nav-group-toggle" + (hrOpen ? " open" : "")}
            onClick={() => setHrOpen((prev) => !prev)}
          >
            <span className="nav-icon">
              <Briefcase size={16} />
            </span>
            HR
            <span className="nav-chevron">
              <ChevronDown size={14} />
            </span>
          </button>

          {hrOpen && (
            <div className="nav-subgroup">
              <NavLink
                to="/hr"
                end
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <LayoutDashboard size={14} />
                </span>
                HR Dashboard
              </NavLink>

              <NavLink
                to="/hr/employees"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <Users size={14} />
                </span>
                Employees
              </NavLink>

              <NavLink
                to="/hr/attendance"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <CalendarCheck size={14} />
                </span>
                Attendance
              </NavLink>

              <NavLink
                to="/hr/leave"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <Palmtree size={14} />
                </span>
                Leave
              </NavLink>

              <NavLink
                to="/hr/worklogs"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <ClipboardList size={14} />
                </span>
                Worklogs
              </NavLink>

              <NavLink
                to="/hr/onboarding"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <UserCheck size={14} />
                </span>
                Onboarding
              </NavLink>

              <NavLink
                to="/hr/promotions"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <TrendingUp size={14} />
                </span>
                Promotions
              </NavLink>

              <NavLink
                to="/hr/payroll-references"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <Link2 size={14} />
                </span>
                Payroll References
              </NavLink>

              <NavLink
                to="/hr/exit-management"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <LogOut size={14} />
                </span>
                Exit Management
              </NavLink>

              <NavLink
                to="/hr/reports"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <PieChart size={14} />
                </span>
                Employee Reports
              </NavLink>
            </div>
          )}
        </>
      )}

      {canSeeDocuments && (
        <>
          <button
            type="button"
            className={"nav-item nav-group-toggle" + (documentsOpen ? " open" : "")}
            onClick={() => setDocumentsOpen((prev) => !prev)}
          >
            <span className="nav-icon">
              <FileText size={16} />
            </span>
            Document Generator
            <span className="nav-chevron">
              <ChevronDown size={14} />
            </span>
          </button>

          {documentsOpen && (
            <div className="nav-subgroup">
              <NavLink
                to="/documents"
                end
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <Library size={14} />
                </span>
                Library
              </NavLink>

              <NavLink
                to="/documents/ai-generator"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <Sparkles size={14} />
                </span>
                Vetri Tool (AI Generator)
              </NavLink>

              <NavLink
                to="/documents/templates"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <LayoutTemplate size={14} />
                </span>
                Templates
              </NavLink>

              <NavLink
                to="/documents/approvals"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <CheckSquare size={14} />
                </span>
                Approvals
              </NavLink>

              <NavLink
                to="/documents/governance"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <Scale size={14} />
                </span>
                Governance
              </NavLink>
            </div>
          )}
        </>
      )}

      {inWorkspace("training") && trainingItem && hasAccess(trainingItem.requirement, user) && (
        <>
          <button
            type="button"
            className={"nav-item nav-group-toggle" + (trainingOpen ? " open" : "")}
            onClick={() => setTrainingOpen((prev) => !prev)}
          >
            <span className="nav-icon">
              <GraduationCap size={16} />
            </span>
            Training
            <span className="nav-chevron">
              <ChevronDown size={14} />
            </span>
          </button>

          {trainingOpen && (
            <div className="nav-subgroup">
              <NavLink
                to="/training"
                end
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <Layers size={14} />
                </span>
                Batches
              </NavLink>

              {hasAccess(trainerRequirement, user) && (
                <NavLink
                  to="/training/attendance"
                  className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
                >
                  <span className="nav-icon">
                    <CalendarCheck size={14} />
                  </span>
                  Attendance
                </NavLink>
              )}

              <NavLink
                to="/training/assignments"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <ClipboardList size={14} />
                </span>
                Assignments
              </NavLink>

              <NavLink
                to="/training/reports"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <BarChart3 size={14} />
                </span>
                Reports
              </NavLink>

              <NavLink
                to="/training/mock-interviews"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <Mic size={14} />
                </span>
                Mock Interview
              </NavLink>

              <NavLink
                to="/training/absentees-recordings"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <Video size={14} />
                </span>
                Absentees & Recordings
              </NavLink>

              <NavLink
                to="/training/dropout-tracking"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <UserMinus size={14} />
                </span>
                Dropout Tracking
              </NavLink>

              <NavLink
                to="/training/messages"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <MessageCircle size={14} />
                </span>
                Messages
              </NavLink>
            </div>
          )}
        </>
      )}

      {inWorkspace("training") && hasAccess(businessTeamRequirement, user) && (
        <>
          <button
            type="button"
            className={"nav-item nav-group-toggle" + (businessTeamOpen ? " open" : "")}
            onClick={() => setBusinessTeamOpen((prev) => !prev)}
          >
            <span className="nav-icon">
              <Briefcase size={16} />
            </span>
            Business Team
            <span className="nav-chevron">
              <ChevronDown size={14} />
            </span>
          </button>

          {businessTeamOpen && (
            <div className="nav-subgroup">
              <NavLink to="/training/students" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><FileText size={14} /></span>
                All Students
              </NavLink>
              <NavLink to="/training/internship-approvals" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><UserCheck size={14} /></span>
                Internship Approvals
              </NavLink>
              <NavLink to="/training/completion-extension-approvals" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
  <span className="nav-icon"><UserCheck size={14} /></span>
  Completion & Extension Approvals
</NavLink>
              <NavLink to="/training/enquiries" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><ClipboardList size={14} /></span>
                Enquiries
              </NavLink>
              <NavLink to="/training/fee-conversion" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><Layers size={14} /></span>
                Fee & Conversion
              </NavLink>
              <NavLink to="/training/batches/new" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><GraduationCap size={14} /></span>
                New Batch
              </NavLink>
              <NavLink to="/training/welcome-emails" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><MessageCircle size={14} /></span>
                Welcome Emails
              </NavLink>
            </div>
          )}
        </>
      )}

      {inWorkspace("student") && hasAccess(studentRequirement, user) && !isIntern && (
        <>
          <NavLink to="/student/dashboard" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">🎒</span> My Dashboard
          </NavLink>
          <NavLink to="/student/attendance" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">📅</span> My Attendance
          </NavLink>
          <NavLink to="/student/ask-trainer" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">💬</span> Ask Trainer
          </NavLink>
          <NavLink to="/student/assessments" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">🎯</span> Assessments
          </NavLink>
          <NavLink to="/student/progress" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">📈</span> Progress
          </NavLink>
          <NavLink to="/student/assignments" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">📝</span> Assignments
          </NavLink>
          <NavLink to="/student/recordings" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">🎥</span> Recordings
          </NavLink>
          <NavLink to="/student/reports" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">📊</span> Reports
          </NavLink>
        </>
      )}

      {inWorkspace("intern") && isIntern && (
        <>
          <NavLink to="/intern/my-internship" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">🎓</span> My Internship
          </NavLink>
          <NavLink to="/intern/attendance" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">📅</span> My Attendance
          </NavLink>
          <NavLink to="/intern/tasks" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">📝</span> My Tasks
          </NavLink>
          <NavLink to="/intern/testing-reports" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">🧪</span> Testing Reports
          </NavLink>
          <NavLink to="/intern/worklog" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">🕒</span> Daily Work Report
          </NavLink>
          <NavLink to="/intern/leave" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">🌴</span> Apply Leave
          </NavLink>
          <NavLink to="/intern/ask-lead" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">💬</span> Ask Project Lead
          </NavLink>
          <NavLink to="/intern/performance" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">📊</span> My Performance
          </NavLink>
          <NavLink to="/intern/project" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">📁</span> My Project
          </NavLink>
        </>
      )}

      {/* Project Management: any active team member (lead or regular
          member) or admin can VIEW these pages. Write actions inside
          each page are further restricted to the actual Project
          Manager via can_manage_project on the backend, and the
          create/edit buttons should be hidden client-side too
          (see Deployments.jsx / ProjectTeam.jsx / etc.) */}
      {(isSystemAdministrator || isProjectTeamMember) && (
        <>
          <button
            type="button"
            className={"nav-item nav-group-toggle" + (projectMgmtOpen ? " open" : "")}
            onClick={() => setProjectMgmtOpen((prev) => !prev)}
          >
            <span className="nav-icon">
              <FolderKanban size={16} />
            </span>
            Project Management
            <span className="nav-chevron">
              <ChevronDown size={14} />
            </span>
          </button>

          {projectMgmtOpen && (
            <div className="nav-subgroup">
              <NavLink to="/project/dashboard" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><LayoutDashboard size={14} /></span>
                Project Dashboard
              </NavLink>
              <NavLink to="/project/team" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><Users size={14} /></span>
                Project Team
              </NavLink>
              <NavLink to="/project/documents" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
  <span className="nav-icon"><FileText size={14} /></span>
  Project Documents
</NavLink>
              <NavLink to="/project/requirements" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><FileText size={14} /></span>
                Requirements
              </NavLink>
              <NavLink to="/project/kanban" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><Layers size={14} /></span>
                Kanban Board
              </NavLink>
              <NavLink to="/project/milestones" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><ClipboardList size={14} /></span>
                Milestones
              </NavLink>
              <NavLink to="/project/deployments" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><BarChart3 size={14} /></span>
                Deployments
              </NavLink>
              <NavLink to="/project/tech-stack" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><Layers size={14} /></span>
                Repository & Tech Stack
              </NavLink>
              <NavLink to="/project/change-requests" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><MessageCircle size={14} /></span>
                Change Requests
              </NavLink>
              {(isSystemAdministrator || isActualProjectManager) && (
  <NavLink to="/project/recommend-internship-action" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
    <span className="nav-icon"><UserCheck size={14} /></span>
    Internship Completion/Extension
  </NavLink>
)}
{isSystemAdministrator && (
  <NavLink to="/project/create" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
    <span className="nav-icon"><FolderKanban size={14} /></span>
    Create Project
  </NavLink>
)}
            </div>
          )}
        </>
      )}

      {/* Client Management: PM (real per-project PM, not just anyone
          with view access to Project Management) or admin only.
          Leads and regular team members never see this. */}
      {(isSystemAdministrator || isActualProjectManager) && (
        <>
          <button
            type="button"
            className={"nav-item nav-group-toggle" + (clientMgmtOpen ? " open" : "")}
            onClick={() => setClientMgmtOpen((prev) => !prev)}
          >
            <span className="nav-icon">
              <Briefcase size={16} />
            </span>
            Client Management
            <span className="nav-chevron">
              <ChevronDown size={14} />
            </span>
          </button>

          {clientMgmtOpen && (
            <div className="nav-subgroup">
              {isSystemAdministrator && (
                <NavLink to="/clients/directory" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                  <span className="nav-icon"><Users size={14} /></span>
                  Client Directory
                </NavLink>
              )}
              <NavLink to="/clients/meetings" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><CalendarCheck size={14} /></span>
                Meetings / Call Log
              </NavLink>
              <NavLink to="/clients/follow-ups" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
  <span className="nav-icon"><MessageCircle size={14} /></span>
  Follow-Ups
</NavLink>
              <NavLink to="/clients/requests" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><ClipboardList size={14} /></span>
                Client Requests
              </NavLink>
              <NavLink to="/clients/payments" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><FileText size={14} /></span>
                Payments
              </NavLink>
              <NavLink to="/clients/approval-documents" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><FileText size={14} /></span>
                Approval Documents
              </NavLink>
              <NavLink to="/clients/my-clients" className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}>
                <span className="nav-icon"><Briefcase size={14} /></span>
                My Clients
              </NavLink>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

export default Sidebar;