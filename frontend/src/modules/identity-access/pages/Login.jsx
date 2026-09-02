import { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../../../api/client";
import "../styles/Login.css";

// Sign-in form: POSTs to /api/identity/login/, stores the returned JWT
// pair, then sends the user on to the dashboard.
function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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

      navigate("/dashboard");
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
        <div className="login-panel-content">
          <span className="login-mark">V</span>
          <h1>VetriOS</h1>
          <p>
            One workspace for documents, communication, HR, and every other
            module your organization runs on.
          </p>
        </div>
      </div>

      <div className="login-form-side">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-header">
            <h2>Sign in</h2>
            <p>Enter your credentials to continue</p>
          </div>

          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoFocus
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
