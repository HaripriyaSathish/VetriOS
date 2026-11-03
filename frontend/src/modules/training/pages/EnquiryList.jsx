import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download, Plus, FileText, BellRing, CalendarCheck, UserCheck, Search, ChevronDown, FunnelX, Phone, Mail, MapPin,
  Globe, Camera, MessageCircle, Users, Footprints, CircleDot, TrendingUp, CircleAlert, ArrowRight, Check,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  course_id: "", name: "", date_of_birth: "", whatsapp_number: "",
  personal_email: "", education_summary: "", passed_out_year: "", source: "other", address: "",
};

const SOURCES = {
  instagram: { label: "Instagram", Icon: Camera },
  whatsapp: { label: "WhatsApp", Icon: MessageCircle },
  referral: { label: "Referral", Icon: Users },
  walk_in: { label: "Walk-in", Icon: Footprints },
  website: { label: "Website", Icon: Globe },
  public_form: { label: "Website", Icon: Globe },
  other: { label: "Other", Icon: CircleDot },
};

const TABS = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "shortlisted", label: "Follow-up" },
  { key: "converted", label: "Converted" },
];

const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function loggedAt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function stage(e) {
  if (e.status === "new") return { pill: "New Lead", tone: "blue", next: "Check eligibility" };
  if (e.status === "shortlisted") {
    return e.has_fee_plan
      ? { pill: "Interested", tone: "blue", next: "Collect fee payment" }
      : { pill: "Follow-up", tone: "orange", next: "Set fee plan" };
  }
  if (e.status === "converted") return { pill: "Converted", tone: "green", next: "Account created" };
  return { pill: e.status, tone: "gray", next: "" };
}

function downloadCsv(rows) {
  const head = ["Name", "WhatsApp", "Email", "Course", "Source", "Age", "Eligible", "Passed Out", "Status", "Logged"];
  const lines = rows.map((e) => [
    e.name, e.whatsapp_number, e.personal_email, e.course_name, e.source, e.age, e.is_eligible,
    e.passed_out_year, e.status, e.created_at,
  ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `enquiries_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function EnquiryList() {
  const [enquiries, setEnquiries] = useState([]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState(0);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get("/api/admissions/enquiries/");
      setEnquiries(data);
      setLoadedAt(Date.now());
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't load enquiries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    client.get("/api/training/courses/").then(({ data }) => setCourses(data || [])).catch(() => {});
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await client.post("/api/admissions/enquiries/", form);
      setFormOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const markEligible = async (enquiryId) => {
    try {
      await client.post(`/api/admissions/enquiries/${enquiryId}/mark-eligible/`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't mark eligible.");
    }
  };

  const counts = useMemo(() => ({
    all: enquiries.length,
    new: enquiries.filter((e) => e.status === "new").length,
    shortlisted: enquiries.filter((e) => e.status === "shortlisted").length,
    converted: enquiries.filter((e) => e.status === "converted").length,
  }), [enquiries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enquiries.filter((e) => {
      if (tab !== "all" && e.status !== tab) return false;
      if (course && e.course_name !== course) return false;
      if (source && e.source !== source) return false;
      if (!q) return true;
      return [e.name, e.personal_email, e.whatsapp_number, e.course_name].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [enquiries, tab, course, source, search]);

  if (loading) return <p className="bp-loading">Loading enquiries…</p>;

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonth = enquiries.filter((e) => e.created_at && new Date(e.created_at) >= monthStart).length;
  const stale = enquiries.filter((e) => e.status === "new" && e.created_at && loadedAt - new Date(e.created_at) > 48 * 3600 * 1000).length;
  const awaitingFee = enquiries.filter((e) => e.status === "shortlisted" && !e.has_fee_plan).length;
  const ready = enquiries.filter((e) => e.status === "shortlisted" && e.has_fee_plan).length;
  const convertedPct = counts.all ? Math.round((counts.converted / counts.all) * 100) : 0;

  const courseNames = [...new Set(enquiries.map((e) => e.course_name).filter(Boolean))].sort();
  const sourceKeys = [...new Set(enquiries.map((e) => e.source).filter(Boolean))];

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="bp-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Pipeline Operations › <span>Enquiries</span></p>
          <h1 className="bp-title">Enquiries &amp; Leads</h1>
          <p className="bp-sub">Track incoming student leads, conversion velocity, and coordinate direct outreach.</p>
        </div>
        <div className="bp-actions">
          <button type="button" className="bp-btn outline" onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0}>
            <Download size={15} /> Export CSV
          </button>
          <button type="button" className="bp-btn navy" onClick={openCreate}><Plus size={15} /> Add Enquiry</button>
        </div>
      </div>

      {error && <p className="bp-error">{error}</p>}

      <div className="bp-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Total Enquiries</p>
            <span className="bp-stat-icon"><FileText size={17} /></span>
          </div>
          <p className="bp-stat-value">
            {counts.all}
            {thisMonth > 0 && <span className="bp-chip blue"><TrendingUp size={11} /> +{thisMonth} this month</span>}
          </p>
          <div className="bp-stat-foot">
            <div className="bp-meter" style={{ flex: 1 }}><span style={{ width: `${convertedPct}%` }} /></div>
            <span>{convertedPct}% converted</span>
          </div>
        </div>

        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Needs Follow-up</p>
            <span className="bp-stat-icon orange"><BellRing size={17} /></span>
          </div>
          <p className="bp-stat-value" style={{ color: "var(--vt-orange)" }}>
            {counts.new}
            {stale > 0 && <span className="bp-chip red"><CircleAlert size={11} /> Critical</span>}
          </p>
          <div className="bp-stat-foot">
            <span>{stale} pending past 48 hrs</span>
            {counts.new > 0 && <b>Take action</b>}
          </div>
        </div>

        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Shortlisted</p>
            <span className="bp-stat-icon"><CalendarCheck size={17} /></span>
          </div>
          <p className="bp-stat-value">{counts.shortlisted}</p>
          <div className="bp-stat-foot">
            <span>Eligible leads in follow-up</span>
            <span>{awaitingFee} awaiting fee setup</span>
          </div>
        </div>

        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Ready to Enroll</p>
            <span className="bp-stat-icon green"><UserCheck size={17} /></span>
          </div>
          <p className="bp-stat-value">{ready}</p>
          <div className="bp-stat-foot">
            <span>Fee plan set, awaiting conversion</span>
            <b style={{ color: "var(--vt-navy-700)" }}>Final stage</b>
          </div>
        </div>
      </div>

      <div className="bp-panel">
        <div className="bp-filters">
          <div className="bp-tabs">
            {TABS.map((t) => (
              <button key={t.key} type="button" className={`bp-tab ${tab === t.key ? "active" : ""}`} onClick={() => { setTab(t.key); setPage(1); }}>
                {t.label} <small>({counts[t.key]})</small>
              </button>
            ))}
          </div>
          <label className="bp-search">
            <Search size={15} />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search leads by name, email or phone..." aria-label="Search leads" />
          </label>
          <label className="bp-select">
            <select value={course} onChange={(e) => { setCourse(e.target.value); setPage(1); }} aria-label="Course interest">
              <option value="">Course Interest: All</option>
              {courseNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="bp-select">
            <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} aria-label="Lead source">
              <option value="">Lead Source: All</option>
              {sourceKeys.map((s) => <option key={s} value={s}>{SOURCES[s]?.label || s}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <button type="button" className="bp-btn outline small" title="Clear filters" aria-label="Clear filters"
            onClick={() => { setSearch(""); setCourse(""); setSource(""); setTab("all"); setPage(1); }}>
            <FunnelX size={15} />
          </button>
        </div>

        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr>
                <th>Lead Name &amp; Contact</th>
                <th>Course Interested</th>
                <th>Source</th>
                <th>Eligibility</th>
                <th>Logged</th>
                <th>Status &amp; Next Step</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr className="bp-empty-row"><td colSpan={7}>{enquiries.length === 0 ? "No enquiries logged yet." : "No leads match these filters."}</td></tr>
              ) : (
                shown.map((e, i) => {
                  const src = SOURCES[e.source] || SOURCES.other;
                  const st = stage(e);
                  return (
                    <tr key={e.enquiry_id} style={{ "--row": i }}>
                      <td>
                        <div className="bp-person">
                          <span className={`bp-avatar t${i % 4}`}>{initialsOf(e.name)}</span>
                          <div>
                            <p className="bp-person-name">{e.name}</p>
                            <div className="bp-contact">
                              <span><Phone size={11} /> {e.whatsapp_number}</span>
                              {e.address
                                ? <span><MapPin size={11} /> {e.address.split(",").slice(-1)[0].trim()}</span>
                                : e.personal_email && <span><Mail size={11} /> {e.personal_email}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="bp-strong">{e.course_name}</td>
                      <td><span className="bp-chip blue"><src.Icon size={11} /> {src.label}</span></td>
                      <td>
                        {e.is_eligible == null ? <span className="bp-muted">—</span> : (
                          <span className={`bp-chip ${e.is_eligible ? "green" : "red"}`}>
                            {e.is_eligible ? "Eligible" : "Not eligible"}
                          </span>
                        )}
                        <p className="bp-person-sub">
                          {e.age != null ? `Age ${e.age}` : ""}{e.passed_out_year ? ` · ${e.passed_out_year} pass-out` : ""}
                        </p>
                      </td>
                      <td className="bp-muted">{loggedAt(e.created_at)}</td>
                      <td>
                        <span className={`bp-chip ${st.tone}`}>{st.pill}</span>
                        {st.next && <p className="bp-next"><ArrowRight size={11} /> {st.next}</p>}
                      </td>
                      <td>
                        {e.status === "new" && (
                          <button type="button" className="bp-btn orange small" onClick={() => markEligible(e.enquiry_id)}>
                            Mark Eligible
                          </button>
                        )}
                        {e.status === "shortlisted" && (
                          <Link to={`/training/fee-conversion/${e.enquiry_id}`} className="bp-btn navy small">
                            {e.has_fee_plan ? "Manage Payment" : "Convert"}
                          </Link>
                        )}
                        {e.status === "converted" && (
                          <Link to={`/training/fee-conversion/${e.enquiry_id}`} className="bp-btn soft small">
                            <Check size={12} /> Enrolled
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="bp-pager">
          <span>Showing <b>{shown.length}</b> of <b>{filtered.length}</b> leads</span>
          <div className="bp-pages">
            <button type="button" className="bp-page-btn" disabled={current === 1} onClick={() => setPage(current - 1)}>‹</button>
            {Array.from({ length: pages }, (_, idx) => idx + 1).map((p) => (
              <button key={p} type="button" className={`bp-page-btn ${p === current ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button type="button" className="bp-page-btn" disabled={current === pages} onClick={() => setPage(current + 1)}>›</button>
          </div>
        </div>
      </div>

      {formOpen && (
        <div className="bp-modal-backdrop" onClick={closeForm}>
          <form className="bp-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <h2>Add an enquiry</h2>
            <p>Log a new lead — eligibility is worked out from the date of birth.</p>
            <div className="bp-form-grid">
              <label className="bp-field full">
                <span>Course</span>
                {courses.length > 0 ? (
                  <select value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} required>
                    <option value="">Select a course…</option>
                    {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
                  </select>
                ) : (
                  <input value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} placeholder="Course ID" required />
                )}
              </label>
              <label className="bp-field full">
                <span>Name</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
              <label className="bp-field">
                <span>Date of birth</span>
                <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} required />
              </label>
              <label className="bp-field">
                <span>WhatsApp number</span>
                <input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} required />
              </label>
              <label className="bp-field">
                <span>Personal email</span>
                <input type="email" value={form.personal_email} onChange={(e) => setForm({ ...form, personal_email: e.target.value })} />
              </label>
              <label className="bp-field">
                <span>Passed out year</span>
                <input type="number" value={form.passed_out_year} onChange={(e) => setForm({ ...form, passed_out_year: e.target.value })} />
              </label>
              <label className="bp-field full">
                <span>Educational details</span>
                <input value={form.education_summary} onChange={(e) => setForm({ ...form, education_summary: e.target.value })} />
              </label>
              <label className="bp-field full">
                <span>Address</span>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </label>
              <label className="bp-field full">
                <span>Source</span>
                <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  <option value="instagram">Instagram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="referral">Referral</option>
                  <option value="walk_in">Walk-in</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
            {formError && <p className="bp-form-error">{formError}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={closeForm}>Cancel</button>
              <button type="submit" className="bp-btn navy" disabled={submitting}>{submitting ? "Saving…" : "Save Enquiry"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default EnquiryList;
