import { Navigate } from "react-router-dom";
import { hasAccess } from "../config/nav";

// Route-level enforcement of the same requirement Sidebar uses to decide
// what to show — so a user can't reach a module just by typing its URL.
function PermissionGate({ requirement, children }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!hasAccess(requirement, user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default PermissionGate;
