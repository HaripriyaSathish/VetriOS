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
} from "lucide-react";
import { NAV_ITEMS, hasAccess } from "../config/nav";
import "../components-styles/Sidebar.css";

const SYSADMIN_PATHS = ["/dashboard", "/identity/users", "/identity/roles", "/identity/permissions"];
const HR_PATHS = ["/hr"];

function Sidebar() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const location = useLocation();
  const [trainingOpen, setTrainingOpen] = useState(true);

  const identityRequirement = { type: "role", value: "System Administrator" };
  const businessTeamRequirement = { type: "role", value: "Business Team" };
  const trainerRequirement = { type: "role", value: "Employee" };
  const studentRequirement = { type: "role", value: "Student" };
  const trainingItem = NAV_ITEMS.find((item) => item.id === "training");
  const hrItem = NAV_ITEMS.find((item) => item.id === "hr");

  const isSystemAdministrator = hasAccess(identityRequirement, user);
  const isOnSysAdminPage = SYSADMIN_PATHS.some((path) => location.pathname.startsWith(path));
  const [sysAdminOpen, setSysAdminOpen] = useState(isOnSysAdminPage);

  const canSeeHR = hrItem && hasAccess(hrItem.requirement, user);
  const isOnHRPage = HR_PATHS.some((path) => location.pathname.startsWith(path));
  const [hrOpen, setHrOpen] = useState(isOnHRPage);

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

      {/* Self-service Attendance for anyone with an actual Employee record
          (employee_code on /me) — accounts like Training applicants/test
          logins have a login but no Employee row, so this page would just
          show a dead end for them. HR Administrator also gets this (their
          HR-module Attendance page is org-wide today's records, not their
          own history), labeled "My Attendance" to tell the two apart. Only
          System Administrator (a pure system-access account, not really
          "staff") skips it entirely. */}
      {!isSystemAdministrator && !!user?.employee_code && (
        <NavLink
          to="/my/attendance"
          className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
        >
          <span className="nav-icon">
            <CalendarCheck size={16} />
          </span>
          My Attendance
        </NavLink>
      )}

      {/* Apply Leave stays HR-gated out — HR Administrator already manages
          leave requests through the real HR module's Leave page. */}
      {!isSystemAdministrator && !canSeeHR && !!user?.employee_code && (
        <NavLink
          to="/my/leave"
          className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
        >
          <span className="nav-icon">
            <Palmtree size={16} />
          </span>
          Apply Leave
        </NavLink>
      )}

      {/* Worklog is personal to every employee, HR Administrator
          included — unlike Attendance/Leave, the HR-wide Worklogs page
          is read-only (no embedded "submit mine" control), so HR still
          needs this self-service link. Only System Administrator (a
          pure system-access account, not really "staff") skips it. */}
      {!isSystemAdministrator && !!user?.employee_code && (
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

      {/* Not tied to a role — shown to whoever is currently listed as a
          department's lead in department_lead, regardless of their RBAC
          role (a lead is still just "Employee" in this schema). */}
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

              <NavLink
                to="/training/students"
                className={({ isActive }) => "nav-item nav-subitem" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">
                  <FileText size={14} />
                </span>
                All Students
              </NavLink>
            </div>
          )}

          {/* User Permissions menu hidden for now — page/route still exist,
              re-add this NavLink when it's needed again. */}
        </>
      )}

      {canSeeHR && (
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

      {trainingItem && hasAccess(trainingItem.requirement, user) && (
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

            {hasAccess(businessTeamRequirement, user) && (
        <>
          <NavLink to="/training/students" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon"><FileText size={16} /></span> All Students
          </NavLink>
          <NavLink to="/training/internship-approvals" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">🎓</span> Internship Approvals
          </NavLink>
          <NavLink to="/training/enquiries" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">📋</span> Enquiries
          </NavLink>
          <NavLink to="/training/fee-conversion" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">💳</span> Fee & Conversion
          </NavLink>
          <NavLink to="/training/batches/new" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">➕</span> New Batch
          </NavLink>
          <NavLink to="/training/welcome-emails" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <span className="nav-icon">✉️</span> Welcome Emails
          </NavLink>
        </>
      )}

      {hasAccess(studentRequirement, user) && (
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
    </aside>
  );
}

export default Sidebar;