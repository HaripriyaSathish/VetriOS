import { useState } from "react";
import { Check, X, CheckSquare, Eye } from "lucide-react";
import "../styles/Documents.css";

// Static mock rows — UI-only build. Wire this up to a real
// document_approval-backed endpoint once the shared DB is reachable again.
const MOCK_APPROVALS = [
  {
    id: 1, title: "Experience Certificate — S. Varma", submitter: "S. Varma",
    type: "Certificate", confidentiality: "internal", submitted: "1d ago", atStage: 2, status: "pending",
  },
  {
    id: 2, title: "Master Services Agreement — Northwind", submitter: "P. Nair",
    type: "Agreement", confidentiality: "restricted", submitted: "3h ago", atStage: 1, status: "pending",
  },
  {
    id: 3, title: "Internship Certificate — M. Bose", submitter: "M. Bose",
    type: "Certificate", confidentiality: "internal", submitted: "12h ago", atStage: 3, status: "pending",
  },
];

const CONF_LABEL = { public: "Public", internal: "Internal", restricted: "Restricted", confidential: "Confidential" };
const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function Approvals() {
  const [approvals, setApprovals] = useState(MOCK_APPROVALS);
  const [tab, setTab] = useState("pending");

  const resolve = (id, status) =>
    setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));

  const counts = {
    pending: approvals.filter((a) => a.status === "pending").length,
    approved: approvals.filter((a) => a.status === "approved").length,
    rejected: approvals.filter((a) => a.status === "rejected").length,
  };
  const visible = approvals.filter((a) => a.status === tab);

  return (
    <div className="doc-screen">
      <div className="doc-head">
        <div>
          <span className="doc-eyebrow">Document Generator</span>
          <h1>Approvals</h1>
          <p>Track and manage document approvals.</p>
        </div>
      </div>

      <div className="doc-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={"doc-tab" + (tab === t.key ? " active" : "")}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className="doc-tab-count">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="doc-panel">
        {visible.length === 0 ? (
          <p className="doc-empty">Nothing here right now.</p>
        ) : (
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Document Name</th>
                  <th>Requested By</th>
                  <th>Submitted On</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="doc-table-title">
                        <CheckSquare size={15} color="#8a93a6" />
                        {a.title}
                      </div>
                      <span className={`doc-badge ${a.confidentiality}`} style={{ marginTop: 4, display: "inline-block" }}>
                        {CONF_LABEL[a.confidentiality]}
                      </span>
                    </td>
                    <td>{a.submitter}</td>
                    <td>{a.submitted}</td>
                    <td>
                      <span className="doc-category-tag orange">at L{a.atStage} · {a.status}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="doc-btn-sm" title="View">
                          <Eye size={13} />
                        </button>
                        <button type="button" className="doc-btn-approve" onClick={() => resolve(a.id, "approved")}>
                          <Check size={13} />
                        </button>
                        <button type="button" className="doc-btn-reject" onClick={() => resolve(a.id, "rejected")}>
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Approvals;
