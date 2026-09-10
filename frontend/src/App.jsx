import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./modules/identity-access/pages/Login";
import Dashboard from "./pages/Dashboard";
import ModulePlaceholder from "./pages/ModulePlaceholder";
import UserAccounts from "./modules/identity-access/pages/UserAccounts";
import RolesPermissions from "./modules/identity-access/pages/RolesPermissions";
import Permissions from "./modules/identity-access/pages/Permissions";
import UserPermissions from "./modules/identity-access/pages/UserPermissions";
import TrainingRouter from "./modules/training/pages/TrainingRouter";
import HRDashboard from "./modules/hr/pages/HRDashboard";
import Attendance from "./modules/hr/pages/Attendance";
import Leave from "./modules/hr/pages/Leave";
import Worklogs from "./modules/hr/pages/Worklogs";
import Onboarding from "./modules/hr/pages/Onboarding";
import Promotions from "./modules/hr/pages/Promotions";
import PayrollReferences from "./modules/hr/pages/PayrollReferences";
import ExitManagement from "./modules/hr/pages/ExitManagement";
import HRReports from "./modules/hr/pages/Reports";
import MyAttendance from "./modules/hr/pages/MyAttendance";
import MyLeave from "./modules/hr/pages/MyLeave";
import MyWorklog from "./modules/hr/pages/MyWorklog";
import TeamWorklogs from "./modules/hr/pages/TeamWorklogs";
import ProtectedRoute from "./components/ProtectedRoute";
import PermissionGate from "./components/PermissionGate";
import AppLayout from "./components/AppLayout";
import { NAV_ITEMS } from "./config/nav";
import EnquiryList from "./modules/training/pages/EnquiryList";
import BatchDetail from "./modules/training/pages/BatchDetail";
import FeeConversion from "./modules/training/pages/FeeConversion";
import FeeConvertDetail from "./modules/training/pages/FeeConvertDetail";
import PublicEnquiryForm from "./modules/public/pages/PublicEnquiryForm";
import BatchForm from "./modules/training/pages/BatchForm";
import WelcomeEmails from "./modules/training/pages/WelcomeEmails";
import TrainingAttendance from "./modules/training/pages/Attendance";
import Assignments from "./modules/training/pages/Assignments";
import Reports from "./modules/training/pages/Reports";
import MockInterview from "./modules/training/pages/MockInterview";
import Messages from "./modules/training/pages/Messages";
import AbsenteesRecordings from "./modules/training/pages/AbsenteesRecordings";
import DropoutTracking from "./modules/training/pages/DropoutTracking";
import StudentDashboard from "./modules/student/pages/StudentDashboard";
import StudentAttendance from "./modules/student/pages/StudentAttendance";
import AskTrainer from "./modules/student/pages/AskTrainer";
import Assessments from "./modules/student/pages/Assessments";
import StudentProgress from "./modules/student/pages/Progress";
import StudentAssignments from "./modules/student/pages/Assignments";
import StudentRecordings from "./modules/student/pages/Recordings";
import StudentReports from "./modules/student/pages/Reports";
import AllStudentsList from "./modules/training/pages/AllStudentsList";
import StudentDetail from "./modules/training/pages/StudentDetail";
import InternshipApprovals from "./modules/training/pages/InternshipApprovals";
import CompletionExtensionApprovals from "./modules/training/pages/CompletionExtensionApprovals";
import MyInternship from "./modules/interns/pages/MyInternship";
import MyInternAttendance from "./modules/interns/pages/MyAttendance";
import MyTasks from "./modules/interns/pages/MyTasks";
import MyInternWorklog from "./modules/interns/pages/MyWorklog";
import AskProjectLead from "./modules/interns/pages/AskProjectLead";
import TestingReports from "./modules/interns/pages/TestingReports";
import ApplyLeave from "./modules/interns/pages/ApplyLeave";
import MyPerformance from "./modules/interns/pages/MyPerformance";
import ChooseWorkspace from "./pages/ChooseWorkspace";
import MyProject from "./modules/interns/pages/MyProject";
import ProjectDashboard from "./modules/clients-projects/pages/ProjectDashboard";
import TeamProjects from "./modules/clients-projects/pages/TeamProjects";
import KanbanProjects from "./modules/clients-projects/pages/KanbanProjects";
import ProjectTeam from "./modules/clients-projects/pages/ProjectTeam";
import ProjectDocumentsProjects from "./modules/clients-projects/pages/ProjectDocumentsProjects";
import ProjectDocuments from "./modules/clients-projects/pages/ProjectDocuments";
import DocumentsLibrary from "./modules/documents/pages/Library";
import AIGenerator from "./modules/documents/pages/AIGenerator";
import DocumentTemplates from "./modules/documents/pages/Templates";
import DocumentApprovals from "./modules/documents/pages/Approvals";
import DocumentGovernance from "./modules/documents/pages/Governance";
import CreateProject from "./modules/clients-projects/pages/CreateProject";
import KanbanBoard from "./modules/clients-projects/pages/KanbanBoard";
import RequirementsProjects from "./modules/clients-projects/pages/RequirementsProjects";
import Requirements from "./modules/clients-projects/pages/Requirements";
import MilestonesProjects from "./modules/clients-projects/pages/MilestonesProjects";
import Milestones from "./modules/clients-projects/pages/Milestones";
import DeploymentsProjects from "./modules/clients-projects/pages/DeploymentsProjects";
import Deployments from "./modules/clients-projects/pages/Deployments";
import TechStackProjects from "./modules/clients-projects/pages/TechStackProjects";
import TechStack from "./modules/clients-projects/pages/TechStack";
import ChangeRequestsProjects from "./modules/clients-projects/pages/ChangeRequestsProjects";
import ChangeRequests from "./modules/clients-projects/pages/ChangeRequests";
import ClientDirectory from "./modules/clients-projects/pages/ClientDirectory";
import ClientDetail from "./modules/clients-projects/pages/ClientDetail";
import MeetingsClients from "./modules/clients-projects/pages/MeetingsClients";
import Meetings from "./modules/clients-projects/pages/Meetings";
import ClientRequestsClients from "./modules/clients-projects/pages/ClientRequestsClients";
import ClientRequests from "./modules/clients-projects/pages/ClientRequests";
import PaymentsClients from "./modules/clients-projects/pages/PaymentsClients";
import Payments from "./modules/clients-projects/pages/Payments";
import ApprovalDocumentsProjects from "./modules/clients-projects/pages/ApprovalDocumentsProjects";
import ApprovalDocuments from "./modules/clients-projects/pages/ApprovalDocuments";
import MyClients from "./modules/clients-projects/pages/MyClients";
import FollowUpsClients from "./modules/clients-projects/pages/FollowUpsClients";
import FollowUps from "./modules/clients-projects/pages/FollowUps";
import RecommendInternshipAction from "./modules/clients-projects/pages/RecommendInternshipAction";
// Route table for the whole app. Everything under AppLayout requires a
// signed-in user (ProtectedRoute); each module route is additionally
// gated by the same requirement Sidebar uses to decide what to show
// (PermissionGate), so a bare URL visit can't bypass access control.
//
// EXCEPTION: /project/* VIEW routes (dashboard, team, requirements,
// kanban, milestones, deployments, tech-stack, change-requests) are
// intentionally left WITHOUT PermissionGate. Access to these is driven
// by live project membership (ProjectTeamMember), not a static system
// role — PermissionGate can only check the cached role list in
// localStorage, so it can't express "any active team member on this
// project." The backend (can_view_project) is the real enforcement
// here; each page already renders its own "Not authorized" state from
// a 403 response. Client Management routes keep PermissionGate — those
// stay PM/System Administrator only, which IS a simple role check.
function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/identity/login" element={<Login />} />
      <Route path="/apply" element={<PublicEnquiryForm />} />
      <Route
        path="/choose-workspace"
        element={
          <ProtectedRoute>
            <ChooseWorkspace />
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<ModulePlaceholder name="Profile" />} />
        <Route path="/settings" element={<ModulePlaceholder name="Settings" />} />
        <Route path="/my/attendance" element={<MyAttendance />} />
        <Route path="/my/leave" element={<MyLeave />} />
        <Route path="/my/worklog" element={<MyWorklog />} />
        <Route path="/my/team-worklogs" element={<TeamWorklogs />} />

        <Route
          path="/identity/users"
          element={
            <PermissionGate requirement={{ type: "role", value: "System Administrator" }}>
              <UserAccounts />
            </PermissionGate>
          }
        />
        <Route
          path="/identity/roles"
          element={
            <PermissionGate requirement={{ type: "role", value: "System Administrator" }}>
              <RolesPermissions />
            </PermissionGate>
          }
        />
        <Route
          path="/identity/permissions"
          element={
            <PermissionGate requirement={{ type: "role", value: "System Administrator" }}>
              <Permissions />
            </PermissionGate>
          }
        />
        <Route
          path="/identity/user-permissions"
          element={
            <PermissionGate requirement={{ type: "role", value: "System Administrator" }}>
              <UserPermissions />
            </PermissionGate>
          }
        />

        {/* Real Training dashboard, replacing the generic placeholder for this one module */}
        <Route path="/training" element={
          <PermissionGate requirement={{ type: "perm", value: "TRAINING_VIEW" }}>
            <TrainingRouter />
          </PermissionGate>
        } />
        <Route path="/training/enquiries" element={
          <PermissionGate requirement={{ type: "perm", value: "TRAINING_VIEW" }}>
            <EnquiryList />
          </PermissionGate>
        } />
        <Route path="/training/batches/:batchId" element={
          <PermissionGate requirement={{ type: "perm", value: "TRAINING_VIEW" }}>
            <BatchDetail />
          </PermissionGate>
        } />
        <Route path="/training/fee-conversion" element={
          <PermissionGate requirement={{ type: "role", value: ["Business Team", "System Administrator"] }}>
            <FeeConversion />
          </PermissionGate>
        } />
        <Route path="/training/fee-conversion/:enquiryId" element={
          <PermissionGate requirement={{ type: "role", value: ["Business Team", "System Administrator"] }}>
            <FeeConvertDetail />
          </PermissionGate>
        } />
        <Route path="/training/batches/new" element={
          <PermissionGate requirement={{ type: "perm", value: "TRAINING_VIEW" }}>
            <BatchForm />
          </PermissionGate>
        } />
        <Route path="/training/batches/:batchId/edit" element={
          <PermissionGate requirement={{ type: "perm", value: "TRAINING_VIEW" }}>
            <BatchForm />
          </PermissionGate>
        } />
        <Route path="/training/welcome-emails" element={
          <PermissionGate requirement={{ type: "role", value: ["Business Team", "System Administrator"] }}>
            <WelcomeEmails />
          </PermissionGate>
        } />
        <Route path="/training/internship-approvals" element={
          <PermissionGate requirement={{ type: "role", value: ["Business Team", "System Administrator"] }}>
            <InternshipApprovals />
          </PermissionGate>
        } />
        <Route path="/training/completion-extension-approvals" element={
  <PermissionGate requirement={{ type: "role", value: ["Business Team", "System Administrator"] }}>
    <CompletionExtensionApprovals />
  </PermissionGate>
} />
        <Route path="/training/attendance" element={
          <PermissionGate requirement={{ type: "role", value: "Employee" }}>
            <TrainingAttendance />
          </PermissionGate>
        } />
        <Route path="/training/assignments" element={
          <PermissionGate requirement={{ type: "perm", value: "TRAINING_VIEW" }}>
            <Assignments />
          </PermissionGate>
        } />
        <Route path="/training/reports" element={
          <PermissionGate requirement={{ type: "perm", value: "TRAINING_VIEW" }}>
            <Reports />
          </PermissionGate>
        } />
        <Route path="/training/mock-interviews" element={
          <PermissionGate requirement={{ type: "perm", value: "TRAINING_VIEW" }}>
            <MockInterview />
          </PermissionGate>
        } />
        <Route path="/training/messages" element={
          <PermissionGate requirement={{ type: "perm", value: "TRAINING_VIEW" }}>
            <Messages />
          </PermissionGate>
        } />
        <Route path="/training/absentees-recordings" element={
          <PermissionGate requirement={{ type: "perm", value: "TRAINING_VIEW" }}>
            <AbsenteesRecordings />
          </PermissionGate>
        } />
        <Route path="/training/dropout-tracking" element={
          <PermissionGate requirement={{ type: "perm", value: "TRAINING_VIEW" }}>
            <DropoutTracking />
          </PermissionGate>
        } />
        <Route path="/training/students" element={
          <PermissionGate requirement={{ type: "role", value: ["Business Team", "System Administrator"] }}>
         <AllStudentsList />
          </PermissionGate>
        } />
         <Route path="/training/students/:personId" element={
         <PermissionGate requirement={{ type: "role", value: ["Business Team", "System Administrator"] }}>
         <StudentDetail />
         </PermissionGate>
        } />
        <Route path="/student/dashboard" element={
          <PermissionGate requirement={{ type: "role", value: "Student" }}>
            <StudentDashboard />
          </PermissionGate>
        } />
        <Route path="/student/attendance" element={
          <PermissionGate requirement={{ type: "role", value: "Student" }}>
            <StudentAttendance />
          </PermissionGate>
        } />
        <Route path="/student/ask-trainer" element={
          <PermissionGate requirement={{ type: "role", value: "Student" }}>
            <AskTrainer />
          </PermissionGate>
        } />
        <Route path="/student/assessments" element={
          <PermissionGate requirement={{ type: "role", value: "Student" }}>
            <Assessments />
          </PermissionGate>
        } />
        <Route path="/student/progress" element={<PermissionGate requirement={{ type: "role", value: "Student" }}><StudentProgress /></PermissionGate>} />
        <Route path="/student/assignments" element={<PermissionGate requirement={{ type: "role", value: "Student" }}><StudentAssignments /></PermissionGate>} />
        <Route path="/student/recordings" element={<PermissionGate requirement={{ type: "role", value: "Student" }}><StudentRecordings /></PermissionGate>} />
        <Route path="/student/reports" element={<PermissionGate requirement={{ type: "role", value: "Student" }}><StudentReports /></PermissionGate>} />
         <Route path="/intern/my-internship" element={
  <PermissionGate requirement={{ type: "role", value: "Intern" }}>
    <MyInternship />
  </PermissionGate>
} />
<Route path="/intern/attendance" element={
  <PermissionGate requirement={{ type: "role", value: "Intern" }}>
    <MyInternAttendance />
  </PermissionGate>
} />
<Route path="/intern/tasks" element={
  <PermissionGate requirement={{ type: "role", value: "Intern" }}>
    <MyTasks />
  </PermissionGate>
} />
<Route path="/intern/project" element={
  <PermissionGate requirement={{ type: "role", value: "Intern" }}>
    <MyProject />
  </PermissionGate>
} />
<Route path="/intern/worklog" element={
  <PermissionGate requirement={{ type: "role", value: "Intern" }}>
    <MyInternWorklog />
  </PermissionGate>
} />
<Route path="/intern/ask-lead" element={
  <PermissionGate requirement={{ type: "role", value: "Intern" }}>
    <AskProjectLead />
  </PermissionGate>
} />
<Route path="/intern/testing-reports" element={
          <PermissionGate requirement={{ type: "role", value: "Intern" }}>
            <TestingReports />
          </PermissionGate>
        } />
        <Route path="/intern/leave" element={
          <PermissionGate requirement={{ type: "role", value: "Intern" }}>
            <ApplyLeave />
          </PermissionGate>
        } />
        <Route path="/intern/performance" element={
  <PermissionGate requirement={{ type: "role", value: "Intern" }}>
    <MyPerformance />
  </PermissionGate>
} />
<Route path="/project/create" element={
  <PermissionGate requirement={{ type: "role", value: "System Administrator" }}>
    <CreateProject />
  </PermissionGate>
} />
{/* ---- Project Management VIEW routes: no PermissionGate ----
    Access is driven by live ProjectTeamMember data; the backend
    (can_view_project) and each page's own error state are the real
    gate here — see note at top of file. */}
<Route path="/project/dashboard" element={<ProjectDashboard />} />
<Route path="/project/team" element={<TeamProjects />} />
<Route path="/project/:projectId/team" element={<ProjectTeam />} />
<Route path="/project/documents" element={<ProjectDocumentsProjects />} />
<Route path="/project/:projectId/documents" element={<ProjectDocuments />} />
<Route path="/project/kanban" element={<KanbanProjects />} />
<Route path="/project/:projectId/kanban" element={<KanbanBoard />} />
<Route path="/project/requirements" element={<RequirementsProjects />} />
<Route path="/project/requirements/:projectId" element={<Requirements />} />
<Route path="/project/milestones" element={<MilestonesProjects />} />
<Route path="/project/:projectId/milestones" element={<Milestones />} />
<Route path="/project/deployments" element={<DeploymentsProjects />} />
<Route path="/project/:projectId/deployments" element={<Deployments />} />
<Route path="/project/tech-stack" element={<TechStackProjects />} />
<Route path="/project/:projectId/tech-stack" element={<TechStack />} />
<Route path="/project/change-requests" element={<ChangeRequestsProjects />} />
<Route path="/project/:projectId/change-requests" element={<ChangeRequests />} />

{/* ---- Client Management routes: KEEP PermissionGate ----
    Stays PM/System Administrator only, per requirement. */}
<Route path="/clients/directory" element={
  <PermissionGate requirement={{ type: "role", value: "System Administrator" }}>
    <ClientDirectory />
  </PermissionGate>
} />
<Route path="/clients/directory/:clientId" element={
  <PermissionGate requirement={{ type: "role", value: ["Project Manager", "System Administrator"] }}>
    <ClientDetail />
  </PermissionGate>
} />
<Route path="/clients/:clientId" element={
  <PermissionGate requirement={{ type: "role", value: ["Project Manager", "System Administrator"] }}>
    <ClientDetail />
  </PermissionGate>
} />
<Route path="/clients/meetings" element={
  <PermissionGate requirement={{ type: "role", value: ["Project Manager", "System Administrator"] }}>
    <MeetingsClients />
  </PermissionGate>
} />
<Route path="/clients/:clientId/meetings" element={
  <PermissionGate requirement={{ type: "role", value: ["Project Manager", "System Administrator"] }}>
    <Meetings />
  </PermissionGate>
} />
<Route path="/clients/requests" element={
  <PermissionGate requirement={{ type: "role", value: ["Project Manager", "System Administrator"] }}>
    <ClientRequestsClients />
  </PermissionGate>
} />
<Route path="/clients/:clientId/requests" element={
  <PermissionGate requirement={{ type: "role", value: ["Project Manager", "System Administrator"] }}>
    <ClientRequests />
  </PermissionGate>
} />
<Route path="/clients/payments" element={
  <PermissionGate requirement={{ type: "role", value: ["Project Manager", "System Administrator"] }}>
    <PaymentsClients />
  </PermissionGate>
} />
<Route path="/clients/:clientId/payments" element={
  <PermissionGate requirement={{ type: "role", value: ["Project Manager", "System Administrator"] }}>
    <Payments />
  </PermissionGate>
} />
<Route path="/clients/approval-documents" element={
  <PermissionGate requirement={{ type: "role", value: ["Project Manager", "System Administrator"] }}>
    <ApprovalDocumentsProjects />
  </PermissionGate>
} />
<Route path="/project/:projectId/approval-documents" element={
  <PermissionGate requirement={{ type: "role", value: ["Project Manager", "System Administrator"] }}>
    <ApprovalDocuments />
  </PermissionGate>
} />
<Route path="/clients/my-clients" element={
  <PermissionGate requirement={{ type: "role", value: ["Project Manager", "System Administrator"] }}>
    <MyClients />
  </PermissionGate>
} />
<Route path="/clients/follow-ups" element={
  <PermissionGate requirement={{ type: "role", value: ["Project Manager", "System Administrator"] }}>
    <FollowUpsClients />
  </PermissionGate>
} />
<Route path="/clients/:clientId/follow-ups" element={
  <PermissionGate requirement={{ type: "role", value: ["Project Manager", "System Administrator"] }}>
    <FollowUps />
  </PermissionGate>
} />
<Route path="/project/recommend-internship-action" element={
  <PermissionGate requirement={{ type: "role", value: ["Project Manager", "System Administrator"] }}>
    <RecommendInternshipAction />
  </PermissionGate>
} />
        {/* Workspace (HR) group — HR Dashboard is still a placeholder;
            Employee is the one real page so far. */}
        <Route
          path="/hr"
          element={
            <PermissionGate requirement={{ type: "role", value: ["HR Administrator", "System Administrator"] }}>
              <ModulePlaceholder name="HR Dashboard" />
            </PermissionGate>
          }
        />
        <Route
          path="/hr/employees"
          element={
            <PermissionGate requirement={{ type: "role", value: ["HR Administrator", "System Administrator"] }}>
              <HRDashboard />
            </PermissionGate>
          }
        />
        <Route
          path="/hr/attendance"
          element={
            <PermissionGate requirement={{ type: "role", value: ["HR Administrator", "System Administrator"] }}>
              <Attendance />
            </PermissionGate>
          }
        />
        <Route
          path="/hr/leave"
          element={
            <PermissionGate requirement={{ type: "role", value: ["HR Administrator", "System Administrator"] }}>
              <Leave />
            </PermissionGate>
          }
        />
        <Route
          path="/hr/worklogs"
          element={
            <PermissionGate requirement={{ type: "role", value: ["HR Administrator", "System Administrator"] }}>
              <Worklogs />
            </PermissionGate>
          }
        />
        <Route
          path="/hr/onboarding"
          element={
            <PermissionGate requirement={{ type: "role", value: ["HR Administrator", "System Administrator"] }}>
              <Onboarding />
            </PermissionGate>
          }
        />
        <Route
          path="/hr/promotions"
          element={
            <PermissionGate requirement={{ type: "role", value: ["HR Administrator", "System Administrator"] }}>
              <Promotions />
            </PermissionGate>
          }
        />
        <Route
          path="/hr/payroll-references"
          element={
            <PermissionGate requirement={{ type: "role", value: ["HR Administrator", "System Administrator"] }}>
              <PayrollReferences />
            </PermissionGate>
          }
        />
        <Route
          path="/hr/exit-management"
          element={
            <PermissionGate requirement={{ type: "role", value: ["HR Administrator", "System Administrator"] }}>
              <ExitManagement />
            </PermissionGate>
          }
        />
        <Route
          path="/hr/reports"
          element={
            <PermissionGate requirement={{ type: "role", value: ["HR Administrator", "System Administrator"] }}>
              <HRReports />
            </PermissionGate>
          }
        />

        {/* Document Generator group */}
        <Route
          path="/documents"
          element={
            <PermissionGate requirement={{ type: "perm", value: "DOCUMENT_VIEW" }}>
              <DocumentsLibrary />
            </PermissionGate>
          }
        />
        <Route
          path="/documents/ai-generator"
          element={
            <PermissionGate requirement={{ type: "perm", value: "DOCUMENT_VIEW" }}>
              <AIGenerator />
            </PermissionGate>
          }
        />
        <Route
          path="/documents/templates"
          element={
            <PermissionGate requirement={{ type: "perm", value: "DOCUMENT_VIEW" }}>
              <DocumentTemplates />
            </PermissionGate>
          }
        />
        <Route
          path="/documents/approvals"
          element={
            <PermissionGate requirement={{ type: "perm", value: "DOCUMENT_VIEW" }}>
              <DocumentApprovals />
            </PermissionGate>
          }
        />
        <Route
          path="/documents/governance"
          element={
            <PermissionGate requirement={{ type: "perm", value: "DOCUMENT_VIEW" }}>
              <DocumentGovernance />
            </PermissionGate>
          }
        />

        {NAV_ITEMS.filter((item) => item.id !== "training" && item.id !== "hr" && item.id !== "documents").map((item) => (
          <Route
            key={item.id}
            path={item.path}
            element={
              <PermissionGate requirement={item.requirement}>
                <ModulePlaceholder name={item.name} />
              </PermissionGate>
            }
          />
        ))}
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

    </Routes>
  );
}

export default App;