import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, FolderKanban, Search, Tag } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const STATUS_CHIP = { ACTIVE: "green", INACTIVE: "gray", PROSPECT: "blue", ON_HOLD: "orange" };

function ClientPicker({ title, subtitle, getPath }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    client.get("/api/projects/clients/")
      .then(({ data }) => setClients(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load clients."))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => [c.client_name, c.client_code, c.industry].some((v) => (v || "").toLowerCase().includes(q)));
  }, [clients, search]);

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader eyebrow="Client Management" section={title} title={title} subtitle={subtitle} back="/clients/my-clients" backLabel="Client Management" />

      {error && <p className="bp-panel bp-error">{error}</p>}

      <div className="bp-panel pm-toolbar">
        <span className="bp-chip blue"><Building2 size={12} /> {clients.length} {clients.length === 1 ? "client" : "clients"}</span>
        <label className="bp-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients…" />
        </label>
      </div>

      {loading ? (
        <p className="bp-loading">Loading clients…</p>
      ) : visible.length === 0 ? (
        <p className="bp-panel pm-empty-panel">{clients.length ? "No clients match your search." : "No clients yet."}</p>
      ) : (
        <div className="pm-pick-grid">
          {visible.map((c, idx) => (
            <Link key={c.client_id} to={getPath(c.client_id)} className="pm-pick" style={{ "--i": idx }}>
              <div className="pm-pick-top">
                <span className="pm-ico small orange"><Building2 size={17} /></span>
                <span className={`bp-chip ${STATUS_CHIP[(c.status || "").toUpperCase()] || "blue"}`}>{c.status}</span>
              </div>
              <b className="pm-pick-name">{c.client_name}</b>
              <small className="pm-pick-code">{c.client_code}</small>
              <div className="pm-pick-meta">
                {c.industry && <span><Tag size={12} /> {c.industry}</span>}
                <span><FolderKanban size={12} /> {c.project_count} project{c.project_count === 1 ? "" : "s"}</span>
              </div>
              <span className="pm-pick-open">Open <ArrowRight size={13} /></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ClientPicker;
