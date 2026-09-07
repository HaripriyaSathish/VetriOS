import { useState } from "react";
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
} from "lucide-react";
import { NAV_ITEMS, hasAccess } from "../config/nav";
import "../components-styles/Sidebar.css";

const SYSADMIN_PATHS = ["/dashboard", "/identity/users", "/identity/roles", "/identity/permissions"];
const HR_PATHS = ["/hr"];
const BUSINESS_TEAM_PATHS = [
  "/training/students", "/training/internship-approvals", "/training/enquiries",
  "/training/fee-conversion", "/training/batches/new", "/training/welcome-emails",
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
  const projectManagerRequirement = { type: "role", value: ["Project Manager", "System Administrator"] };
  const trainingItem = NAV_ITEMS.find((item) => item.id === "training");
  const hrItem = NAV_ITEMS.find((item) => item.id === "hr");

  const isSystemAdministrator = hasAccess(identityRequirement, user);
  const isIntern = hasAccess(internRequirement, user);

  // System Administrator always sees everything merged, no workspace
  // filtering. Everyone else only sees the section matching whichever
  // workspace they picked at login (or were auto-routed into, if they
  // only had one option) — set in localStorage by Login.jsx/ChooseWorkspace.jsx.
  const activeWorkspace = localStorage.getItem("active_workspace");
  const inWorkspace = (key) => isSystemAdministrator || activeWorkspace === key;

  const isOnSysAdminPage = SYSADMIN_PATHS.some((path) => location.pathname.startsWith(path));
  const [sysAdminOpen, setSysAdminOpen] = useState(isOnSysAdminPage);

  const canSeeHR = hrItem && hasAccess(hrItem.requirement, user);
  const isOnHRPage = HR_PATHS.some((path) => location.pathname.startsWith(path));
  const [hrOpen, setHrOpen] = useState(isOnHRPage);

  const isOnBusinessTeamPage = BUSINESS_TEAM_PATHS.some((path) => location.pathname.startsWith(path));
  const [businessTeamOpen, setBusinessTeamOpen] = useState(isOnBusinessTeamPage);

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

      {/* Self-service Attendance/Leave for anyone without the full HR
          module (Employee, Manager, Viewer) — HR Administrator/System
          Administrator use the real HR module's Attendance/Leave instead.
          Interns are excluded — they have their own dedicated
          /intern/attendance and /intern/leave pages instead. Also gated
          to the "training" workspace, since that's the workspace these
          self-service links belong to for a regular Employee. */}
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

      {/* Worklog is personal to every employee, HR Administrator
          included. System Administrator and Interns both skip it —
          same workspace-gating reasoning as above. */}
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

      {/* Not tied to a role or workspace — shown to whoever is
          currently listed as a department's lead. */}
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

          {/* User Permissions menu hidden for now — page/route still exist,
              re-add this NavLink when it's needed again. */}
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

      {inWorkspace("project") && hasAccess(projectManagerRequirement, user) && (
        <NavLink to="/project/dashboard" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
          <span className="nav-icon"><FolderKanban size={16} /></span> Project Management
        </NavLink>
      )}
    </aside>
  );
}

export default Sidebar;