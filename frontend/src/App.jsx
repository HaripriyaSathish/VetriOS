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
import MyAttendance from "./modules/hr/pages/MyAttendance";
import MyLeave from "./modules/hr/pages/MyLeave";
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

// Route table for the whole app. Everything under AppLayout requires a
// signed-in user (ProtectedRoute); each module route is additionally
// gated by the same requirement Sidebar uses to decide what to show
// (PermissionGate), so a bare URL visit can't bypass access control.
function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/identity/login" element={<Login />} />
      <Route path="/apply" element={<PublicEnquiryForm />} />

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
          <PermissionGate requirement={{ type: "role", value: "Business Team" }}>
            <FeeConversion />
          </PermissionGate>
        } />
        <Route path="/training/fee-conversion/:enquiryId" element={
          <PermissionGate requirement={{ type: "role", value: "Business Team" }}>
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
          <PermissionGate requirement={{ type: "role", value: "Business Team" }}>
            <WelcomeEmails />
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
              <ModulePlaceholder name="Worklogs" />
            </PermissionGate>
          }
        />

        {NAV_ITEMS.filter((item) => item.id !== "training" && item.id !== "hr").map((item) => (
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