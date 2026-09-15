import { useOutletContext } from "react-router-dom";
import SystemAdminDashboard from "../modules/identity-access/pages/SystemAdminDashboard";
import CommonDashboard from "./CommonDashboard";

// Landing page after login. System Administrator gets its own KPI/charts
// dashboard; every other role (HR Administrator, Business Team, Employee,
// ...) shares the common dashboard — quick links, permissions, and their
// own recent activity.
function Dashboard() {
  const { user } = useOutletContext();

  if ((user.roles || []).includes("System Administrator")) {
    return <SystemAdminDashboard user={user} />;
  }

  return <CommonDashboard user={user} />;
}

export default Dashboard;
