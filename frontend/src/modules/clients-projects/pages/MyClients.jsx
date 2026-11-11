import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2, CalendarCheck, MessageCircle, ClipboardList, Wallet, FileCheck2, ArrowRight, FolderKanban, Search, Users,
} from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const SECTIONS = [
  { to: "/clients/meetings", icon: CalendarCheck, label: "Meetings / Call Log", sub: "Scheduled calls and notes", tone: "navy", per: "meetings" },
  { to: "/clients/follow-ups", icon: MessageCircle, label: "Follow-Ups", sub: "Communication log", tone: "orange", per: "follow-ups" },
  { to: "/clients/requests", icon: ClipboardList, label: "Client Requests", sub: "Asks that become requirements", tone: "green", per: "requests" },
  { to: "/clients/payments", icon: Wallet, label: "Payments", sub: "Received payments", tone: "navy", per: "payments" },
  { to: "/clients/approval-documents", icon: FileCheck2, label: "Approval Documents", sub: "Client sign-offs", tone: "orange" },
];

const STATUS_CHIP = { ACTIVE: "green", INACTIVE: "gray", PROSPECT: "blue", ON_HOLD: "orange" };

function MyClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = (user?.roles || []).includes("System Administrator");

  useEffect(() => {
    client.get("/api/projects/my-clients/")
      .then(({ data }) => setClients(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your clients."))
      .finally(() => setLoading(false));
  }, []);

  const projectCount = clients.reduce((a, c) => a + c.projects.length, 0);
  const visible = clients.filter((c) => {
    const q = search.trim().toLowerCase();
    return !q || [c.client_name, ...c.projects.map((p) => p.project_name)].some((v) => (v || "").toLowerCase().includes(q));
  });

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader eyebrow="Client Management" section="Engagement Hub" title="Client Management" subtitle="Clients tied to projects you manage, and every client workflow in one place.">
        {isAdmin && <Link to="/clients/directory" className="bp-btn outline"><Users size={16} /> Client Directory</Link>}
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">MY CLIENTS</p><span className="pm-ico navy"><Building2 size={20} /></span></div>
          <p className="bp-stat-value">{clients.length}</p>
          <p className="pm-foot"><span>{clients.filter((c) => (c.status || "").toUpperCase() === "ACTIVE").length} active</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">PROJECTS</p><span className="pm-ico orange"><FolderKanban size={20} /></span></div>
          <p className="bp-stat-value">{projectCount}</p>
          <p className="pm-foot"><span>Across these clients</span></p>
        </div>
      </div>

      <div className="pm-hub">
        {SECTIONS.map((s, idx) => (
          <Link key={s.to} to={s.to} className="pm-pick pm-hub-tile" style={{ "--i": idx }}>
            <span className={`pm-ico small ${s.tone}`}><s.icon size={17} /></span>
            <b className="pm-pick-name">{s.label}</b>
            <small className="pm-pick-code">{s.sub}</small>
            <span className="pm-pick-open">Open <ArrowRight size={13} /></span>
          </Link>
        ))}
      </div>

      <div className="bp-panel pm-toolbar">
        <h3 className="pm-panel-title">My Clients</h3>
        <label className="bp-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients or projects…" />
        </label>
      </div>

      {loading ? (
        <p className="bp-loading">Loading your clients…</p>
      ) : visible.length === 0 ? (
        <p className="bp-panel pm-empty-panel">{clients.length ? "No clients match your search." : "No clients on your projects yet."}</p>
      ) : (
        <div className="pm-list">
          {visible.map((c, idx) => (
            <article key={c.client_id} className="bp-panel pm-item" style={{ "--i": idx }}>
              <div className="pm-item-top">
                <div className="bp-person">
                  <span className="pm-ico small orange"><Building2 size={17} /></span>
                  <div>
                    <Link to={`/clients/${c.client_id}`} className="pm-item-title pm-link">{c.client_name}</Link>
                    <p className="bp-person-sub">{c.projects.length} project{c.projects.length === 1 ? "" : "s"}</p>
                  </div>
                </div>
                <span className={`bp-chip ${STATUS_CHIP[(c.status || "").toUpperCase()] || "blue"}`}>{c.status}</span>
              </div>
              <div className="pm-tags">
                {c.projects.map((p) => (
                  <Link key={p.project_id} to={`/project/${p.project_id}/team`} className="pm-tag pm-tag-link"><FolderKanban size={11} /> {p.project_name}</Link>
                ))}
              </div>
              <div className="pm-item-foot">
                <span>Open for this client:</span>
                <div className="pm-row-actions">
                  {SECTIONS.filter((s) => s.per).map((s) => (
                    <Link key={s.per} to={`/clients/${c.client_id}/${s.per}`} className="bp-btn outline small"><s.icon size={12} /> {s.label.split(" /")[0]}</Link>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyClients;
