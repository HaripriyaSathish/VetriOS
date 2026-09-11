import { useEffect, useState } from "react";
import { Send, Clock, Layers, AlertTriangle } from "lucide-react";
import client from "../../../api/client";
import "../styles/Email.css";

function EmailDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/api/email/dashboard/")
      .then(({ data }) => setStats(data))
      .catch(() => setError("Couldn't load email stats."));
  }, []);

  return (
    <div className="mail-screen">
      <div className="mail-head">
        <div>
          <span className="mail-eyebrow">Email</span>
          <h1>Dashboard</h1>
          <p>Draft, approve, and send emails backed by real templates and batches.</p>
        </div>
        <span className="mail-provider-badge">Gmail only</span>
      </div>

      {error && <div className="mail-error">{error}</div>}

      {stats && (
        <div className="mail-stat-row">
          <div className="mail-stat">
            <div className="mail-stat-icon navy"><Send size={18} /></div>
            <div>
              <div className="mail-stat-value">{stats.sent}</div>
              <div className="mail-stat-label">Sent</div>
            </div>
          </div>
          <div className="mail-stat">
            <div className="mail-stat-icon orange"><Clock size={18} /></div>
            <div>
              <div className="mail-stat-value">{stats.pending_approval}</div>
              <div className="mail-stat-label">Pending approval</div>
            </div>
          </div>
          <div className="mail-stat">
            <div className="mail-stat-icon green"><Layers size={18} /></div>
            <div>
              <div className="mail-stat-value">{stats.active_batches}</div>
              <div className="mail-stat-label">Active batches</div>
            </div>
          </div>
          <div className="mail-stat">
            <div className="mail-stat-icon rose"><AlertTriangle size={18} /></div>
            <div>
              <div className="mail-stat-value">{stats.total_emails}</div>
              <div className="mail-stat-label">Total emails</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmailDashboard;
