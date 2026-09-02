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
import ProtectedRoute from "./components/ProtectedRoute";
import PermissionGate from "./components/PermissionGate";
import AppLayout from "./components/AppLayout";
import { NAV_ITEMS } from "./config/nav";
import EnquiryList from "./modules/training/pages/EnquiryList";


// Route table for the whole app. Everything under AppLayout requires a
// signed-in user (ProtectedRoute); each module route is additionally
// gated by the same requirement Sidebar uses to decide what to show
// (PermissionGate), so a bare URL visit can't bypass access control.
function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/identity/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />

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

        {/* Real HR dashboard, replacing the generic placeholder for this one module */}
        <Route
          path="/hr"
          element={
            <PermissionGate requirement={{ type: "role", value: ["HR Administrator", "System Administrator"] }}>
              <HRDashboard />
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