import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, FolderKanban, Plus, Search, X, CheckCircle2 } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const STATUS_CHIP = { ACTIVE: "green", INACTIVE: "gray", PROSPECT: "blue", ON_HOLD: "orange" };
const EMPTY_FORM = { code: "", name: "", clientType: "", industry: "", email: "", phone: "" };

function ClientDirectory() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => (
    client.get("/api/projects/clients/")
      .then(({ data }) => { setClients(data); setError(""); })
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load clients."))
      .finally(() => setLoading(false))
  ), []);

  useEffect(() => { load(); }, [load]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const createClient = async (event) => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      setFormError("Client code and name are required.");
      return;
    }
    setCreating(true);
    setFormError("");
    try {
      await client.post("/api/projects/clients/", {
        client_code: form.code,
        client_name: form.name,
        client_type: form.clientType,
        industry: form.industry,
        email: form.email,
        phone: form.phone,
      });
      setMessage(`Client “${form.name}” added.`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't add client.");
    } finally {
      setCreating(false);
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => [c.client_name, c.client_code].some((v) => (v || "").toLowerCase().includes(q)));
  }, [clients, search]);

  const activeCount = clients.filter((c) => (c.status || "").toUpperCase() === "ACTIVE").length;
  const projectCount = clients.reduce((s, c) => s + (c.project_count || 0), 0);

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        eyebrow="Client Management"
        section="Directory"
        title="Client Directory"
        subtitle="Every client in the organisation — System Administrator only."
        back="/clients/my-clients"
        backLabel="Client Management"
      >
        <button type="button" className={`bp-btn ${showForm ? "outline" : "orange"}`} onClick={() => { setShowForm((v) => !v); setFormError(""); }}>
          {showForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> New Client</>}
        </button>
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok"><CheckCircle2 size={15} style={{ verticalAlign: "-3px" }} /> {message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">TOTAL CLIENTS</p><span className="pm-ico navy"><Building2 size={20} /></span></div>
          <p className="bp-stat-value">{clients.length}</p>
          <p className="pm-foot"><span className="pm-ok">{activeCount} active</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">PROJECTS</p><span className="pm-ico orange"><FolderKanban size={20} /></span></div>
          <p className="bp-stat-value">{projectCount}</p>
          <p className="pm-foot"><span>Across all clients</span></p>
        </div>
      </div>

      {showForm && (
        <form className="bp-panel tr-card" onSubmit={createClient}>
          <div className="tr-card-head">
            <div>
              <h3><Plus size={18} /> New Client</h3>
              <p>Code and name are required; the rest can be filled in later.</p>
            </div>
          </div>
          <div className="bp-form-grid">
            <label className="bp-field"><span>Client code *</span><input placeholder="e.g. ACME01" value={form.code} onChange={setField("code")} /></label>
            <label className="bp-field"><span>Client name *</span><input placeholder="e.g. Acme Corporation" value={form.name} onChange={setField("name")} /></label>
            <label className="bp-field"><span>Type</span><input placeholder="e.g. Enterprise" value={form.clientType} onChange={setField("clientType")} /></label>
            <label className="bp-field"><span>Industry</span><input placeholder="e.g. Automotive" value={form.industry} onChange={setField("industry")} /></label>
            <label className="bp-field"><span>Email</span><input type="email" placeholder="contact@client.com" value={form.email} onChange={setField("email")} /></label>
            <label className="bp-field"><span>Phone</span><input placeholder="+91 …" value={form.phone} onChange={setField("phone")} /></label>
          </div>
          {formError && <p className="bp-form-error">{formError}</p>}
          <div className="bp-actions">
            <button type="submit" className="bp-btn navy" disabled={creating}>
              <Plus size={16} /> {creating ? "Adding…" : "Add Client"}
            </button>
          </div>
        </form>
      )}

      <div className="bp-panel pm-toolbar">
        <h3 className="pm-panel-title">All Clients</h3>
        <label className="bp-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client name or code…" />
        </label>
      </div>

      {loading ? (
        <p className="bp-loading">Loading clients…</p>
      ) : visible.length === 0 ? (
        <p className="bp-panel pm-empty-panel">{clients.length ? "No clients match your search." : "No clients yet. Add the first one above."}</p>
      ) : (
        <div className="pm-pick-grid">
          {visible.map((c, idx) => (
            <Link key={c.client_id} to={`/clients/directory/${c.client_id}`} className="pm-pick" style={{ "--i": idx }}>
              <div className="pm-pick-top">
                <span className="pm-ico small orange"><Building2 size={17} /></span>
                <span className={`bp-chip ${STATUS_CHIP[(c.status || "").toUpperCase()] || "blue"}`}>{c.status}</span>
              </div>
              <b className="pm-pick-name">{c.client_name}</b>
              <small className="pm-pick-code">{c.client_code}</small>
              <div className="pm-pick-meta">
                <span><FolderKanban size={13} /> {c.project_count} project{c.project_count === 1 ? "" : "s"}</span>
              </div>
              <span className="pm-pick-open">Open client <ArrowRight size={13} /></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ClientDirectory;
