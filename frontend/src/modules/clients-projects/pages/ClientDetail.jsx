import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Building2, Mail, Phone, CalendarDays, FolderKanban, UserPlus, FilePlus2, Star, CalendarCheck, MessageCircle,
  ClipboardList, Wallet, Briefcase,
} from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const STATUS_CHIP = { ACTIVE: "green", INACTIVE: "gray", PROSPECT: "blue", ON_HOLD: "orange", CLOSED: "gray" };
const initials = (a, b) => `${(a || "?")[0]}${(b || "")[0] || ""}`.toUpperCase();
const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

function ClientDetail() {
  const { clientId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = (user?.roles || []).includes("System Administrator");

  const [modal, setModal] = useState(null); // "contact" | "commercial"
  const [contactFirst, setContactFirst] = useState("");
  const [contactLast, setContactLast] = useState("");
  const [contactDesignation, setContactDesignation] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactIsPrimary, setContactIsPrimary] = useState(false);
  const [refType, setRefType] = useState("");
  const [contractRef, setContractRef] = useState("");
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchClient = () =>
    client.get(`/api/projects/clients/${clientId}/`)
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load client."))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const addContact = async () => {
    if (!contactFirst.trim()) {
      setFormError("First name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await client.post(`/api/projects/clients/${clientId}/contacts/`, {
        first_name: contactFirst,
        last_name: contactLast,
        designation: contactDesignation,
        email: contactEmail,
        phone: contactPhone,
        is_primary: contactIsPrimary,
      });
      setContactFirst(""); setContactLast(""); setContactDesignation("");
      setContactEmail(""); setContactPhone(""); setContactIsPrimary(false);
      setModal(null);
      setMessage("Contact added.");
      fetchClient();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't add contact.");
    } finally {
      setSaving(false);
    }
  };

  const addCommercialReference = async () => {
    if (!refType.trim()) {
      setFormError("Reference type is required.");
      return;
    }
    if (contractStart && contractEnd && contractEnd < contractStart) {
      setFormError("The end date can't be before the start date.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await client.post(`/api/projects/clients/${clientId}/commercial-reference/`, {
        reference_type: refType,
        contract_reference: contractRef,
        contract_start_date: contractStart || null,
        contract_end_date: contractEnd || null,
        currency_code: currencyCode,
      });
      setRefType(""); setContractRef(""); setContractStart(""); setContractEnd(""); setCurrencyCode("INR");
      setModal(null);
      setMessage("Commercial reference added.");
      fetchClient();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't add commercial reference.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="bp-page pm-page"><p className="bp-loading">Loading client…</p></div>;
  if (error && !data) return <div className="bp-page pm-page"><p className="bp-panel bp-error">{error}</p></div>;

  const shortcuts = [
    { to: `/clients/${clientId}/meetings`, icon: CalendarCheck, label: "Meetings" },
    { to: `/clients/${clientId}/follow-ups`, icon: MessageCircle, label: "Follow-Ups" },
    { to: `/clients/${clientId}/requests`, icon: ClipboardList, label: "Requests" },
    { to: `/clients/${clientId}/payments`, icon: Wallet, label: "Payments" },
  ];

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        eyebrow="Client Management"
        section={data.client_code}
        title={data.client_name}
        subtitle={[data.client_type, data.industry].filter(Boolean).join(" · ") || "Client profile"}
        back={isAdmin ? "/clients/directory" : "/clients/my-clients"}
        backLabel={isAdmin ? "Client Directory" : "Client Management"}
      >
        <span className={`bp-chip ${STATUS_CHIP[(data.status || "").toUpperCase()] || "blue"}`}>{data.status}</span>
        <button type="button" className="bp-btn outline" onClick={() => { setModal("commercial"); setFormError(""); }}><FilePlus2 size={16} /> Add Reference</button>
        <button type="button" className="bp-btn navy" onClick={() => { setModal("contact"); setFormError(""); }}><UserPlus size={16} /> Add Contact</button>
      </PmHeader>

      {error && <p className="bp-panel bp-error">{error}</p>}
      {message && <p className="bp-panel pm-notice-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">CONTACT</p><span className="pm-ico navy"><Building2 size={20} /></span></div>
          <p className="pm-contact-line"><Mail size={13} /> {data.email || "—"}</p>
          <p className="pm-contact-line"><Phone size={13} /> {data.phone || "—"}</p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">ONBOARDED</p><span className="pm-ico orange"><CalendarDays size={20} /></span></div>
          <p className="bp-stat-value pm-stat-text">{day(data.onboarded_date)}</p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label pm-label">PROJECTS</p><span className="pm-ico green"><FolderKanban size={20} /></span></div>
          <p className="bp-stat-value">{data.project_count}</p>
          <p className="pm-foot"><span>{data.contacts.length} contacts</span></p>
        </div>
      </div>

      <div className="pm-hub">
        {shortcuts.map((s, idx) => (
          <Link key={s.to} to={s.to} className="pm-pick pm-hub-tile" style={{ "--i": idx }}>
            <span className="pm-ico small soft"><s.icon size={17} /></span>
            <b className="pm-pick-name">{s.label}</b>
          </Link>
        ))}
      </div>

      <section className="bp-panel tr-card">
        <div className="tr-card-head">
          <div className="pm-card-title">
            <span className="pm-ico small soft"><FolderKanban size={17} /></span>
            <div><h3>Linked Projects</h3><p>Projects delivered for this client</p></div>
          </div>
        </div>
        {data.projects.length === 0 ? <p className="pm-empty">No projects linked yet.</p> : (
          <div className="pm-tags">
            {data.projects.map((p) => (
              <Link key={p.project_id} to={`/project/${p.project_id}/team`} className="pm-tag pm-tag-link"><FolderKanban size={11} /> {p.project_name} <small>· {p.status}</small></Link>
            ))}
          </div>
        )}
      </section>

      <div className="pm-grid even">
        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div className="pm-card-title">
              <span className="pm-ico small soft"><UserPlus size={17} /></span>
              <div><h3>Contacts</h3><p>People we work with at {data.client_name}</p></div>
            </div>
          </div>
          {data.contacts.length === 0 ? <p className="pm-empty">No contacts added yet.</p> : (
            <div className="pm-people">
              {data.contacts.map((c, idx) => (
                <div key={c.client_contact_id} className="pm-person">
                  <span className={`bp-avatar t${idx % 4}`}>{initials(c.first_name, c.last_name)}</span>
                  <div className="pm-person-main">
                    <b>{c.first_name} {c.last_name || ""} {c.is_primary && <span className="bp-chip orange"><Star size={10} /> Primary</span>}</b>
                    <small>{c.designation || "—"}</small>
                  </div>
                  <div className="pm-score">
                    {c.email && <span className="pm-contact-line"><Mail size={11} /> {c.email}</span>}
                    {c.phone && <span className="pm-contact-line"><Phone size={11} /> {c.phone}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div className="pm-card-title">
              <span className="pm-ico small soft"><Briefcase size={17} /></span>
              <div><h3>Commercial Reference</h3><p>Contracts and agreements on file</p></div>
            </div>
          </div>
          {data.commercial_references.length === 0 ? <p className="pm-empty">No commercial reference on file.</p> : (
            <div className="pm-engagements">
              {data.commercial_references.map((r) => (
                <div key={r.commercial_reference_id} className="pm-eng">
                  <div>
                    <b>{r.reference_type}</b>
                    <small>{r.contract_reference || "No reference"} · {day(r.contract_start_date)} → {day(r.contract_end_date)}</small>
                  </div>
                  {r.currency_code && <span className="bp-chip blue">{r.currency_code}</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {modal && (
        <div className="bp-modal-backdrop" onClick={() => !saving && setModal(null)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal === "contact" ? "Add Contact" : "Add Commercial Reference"}</h2>
            <p className="bp-sub">{data.client_name}</p>
            {modal === "contact" ? (
              <div className="bp-form-grid">
                <label className="bp-field"><span>First name</span><input value={contactFirst} onChange={(e) => setContactFirst(e.target.value)} /></label>
                <label className="bp-field"><span>Last name</span><input value={contactLast} onChange={(e) => setContactLast(e.target.value)} /></label>
                <label className="bp-field full"><span>Designation</span><input value={contactDesignation} onChange={(e) => setContactDesignation(e.target.value)} /></label>
                <label className="bp-field"><span>Email</span><input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></label>
                <label className="bp-field"><span>Phone</span><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></label>
                <label className="pm-check full"><input type="checkbox" checked={contactIsPrimary} onChange={(e) => setContactIsPrimary(e.target.checked)} /> Primary contact</label>
              </div>
            ) : (
              <div className="bp-form-grid">
                <label className="bp-field"><span>Reference type</span><input value={refType} onChange={(e) => setRefType(e.target.value)} placeholder="e.g. Master Agreement" /></label>
                <label className="bp-field"><span>Contract reference</span><input value={contractRef} onChange={(e) => setContractRef(e.target.value)} /></label>
                <label className="bp-field"><span>Start date</span><input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} /></label>
                <label className="bp-field"><span>End date</span><input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} /></label>
                <label className="bp-field"><span>Currency</span><input value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} placeholder="INR" /></label>
              </div>
            )}
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setModal(null)} disabled={saving}>Cancel</button>
              <button type="button" className="bp-btn navy" onClick={modal === "contact" ? addContact : addCommercialReference} disabled={saving}>{saving ? "Adding…" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientDetail;
