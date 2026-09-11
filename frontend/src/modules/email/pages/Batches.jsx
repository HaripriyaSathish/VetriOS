import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Briefcase, ArrowUpRight } from "lucide-react";
import client from "../../../api/client";
import "../styles/Email.css";

const BULK_TYPES = [
  {
    label: "Students Welcome Email",
    description: "Welcome email sent to newly enrolled students.",
    icon: UserPlus,
    route: "/email/batches/students-welcome",
  },
  {
    label: "Internship Onboarding",
    description: "Onboarding email sent to interns starting their internship.",
    icon: Briefcase,
    route: "/email/batches/internship-onboarding",
  },
  {
    label: "Role Revision",
    description: "Notify employees of a role or designation change.",
    icon: ArrowUpRight,
    route: "/email/batches/role-revision",
  },
];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function Batches() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/api/email/batches/").then(({ data }) => setBatches(data)).catch(() => setError("Couldn't load batches."));
  }, []);

  return (
    <div className="mail-screen">
      <div className="mail-head">
        <div>
          <span className="mail-eyebrow">Email</span>
          <h1>Bulk</h1>
          <p>Bulk sends, tracked from queue to delivery.</p>
        </div>
      </div>

      {error && <div className="mail-error">{error}</div>}

      <p className="mail-type-label">Bulk email types</p>
      <div className="mail-type-grid">
        {BULK_TYPES.map((type) => (
          <button
            key={type.label}
            type="button"
            className="mail-type-card"
            onClick={() => navigate(type.route || "/email/compose")}
          >
            <span className="mail-type-card-icon">
              <type.icon size={20} />
            </span>
            <h4 className="mail-type-card-title">{type.label}</h4>
            <p className="mail-type-card-desc">{type.description}</p>
          </button>
        ))}
      </div>

      <div className="mail-panel">
        <div className="mail-panel-body" style={{ padding: 0 }}>
          {batches.length === 0 ? (
            <p className="mail-empty">No batches yet.</p>
          ) : (
            <div className="mail-table-wrap">
              <table className="mail-table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Type</th>
                    <th>Created by</th>
                    <th>Total</th>
                    <th>Sent</th>
                    <th>Failed</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.email_batch_id}>
                      <td>{b.batch_name}</td>
                      <td>{b.email_type_name || "—"}</td>
                      <td>{b.created_by_name || "—"}</td>
                      <td>{b.total_emails}</td>
                      <td>{b.successful_emails}</td>
                      <td>{b.failed_emails}</td>
                      <td><span className={`mail-badge ${b.status.toLowerCase()}`}>{b.status}</span></td>
                      <td>{formatDate(b.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Batches;
