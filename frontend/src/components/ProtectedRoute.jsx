import { Navigate } from "react-router-dom";

// Gate for pages that require a signed-in user — bounces to /login when
// there's no access token in storage.
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
