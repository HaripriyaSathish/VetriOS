import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Mail, Phone, CalendarDays, UserRound, GraduationCap, CalendarCheck, ClipboardCheck, Wallet,
  BriefcaseBusiness, FileText, Upload, Eye, Check, Clock3, MapPin, BookOpen, Award,
} from "lucide-react";
import client from "../../../api/client";
import { hasAccess } from "../../../config/nav";
import "../styles/BusinessPages.css";
import "../styles/StudentDetail.css";

const SLOTS = [
  { key: "10TH", label: "10th Marksheet" },
  { key: "12TH", label: "12th Marksheet" },
  { key: "UG", label: "UG Certificate" },
  { key: "PG", label: "PG Certificate" },
  { key: "TC", label: "Terms & Conditions (Signed)" },
];

const rupee = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtDate = (d) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const titleCase = (s) => (s || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function ageFrom(dob) {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age -= 1;
  return age;
}

function StudentDetail() {
  const { personId } = useParams();
  const [profile, setProfile] = useState(null);
  const [certs, setCerts] = useState(null);
  const [certError, setCertError] = useState("");
  const [error, setError] = useState("");
  const [files, setFiles] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  const user = JSON.parse(localStorage.getItem("user") || "null");
  const canUpload = hasAccess({ type: "role", value: "Business Team" }, user);

  const loadCerts = () =>
    client.get(`/api/documents/students/${personId}/certificates/`)
      .then(({ data }) => { setCerts(data); setCertError(""); })
      .catch((err) => setCertError(err.response?.data?.detail || "Couldn't load certificates."));

  useEffect(() => {
    client.get(`/api/training/business/students/${personId}/`)
      .then(({ data }) => setProfile(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load student details."));
    loadCerts();
  }, [personId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (e) => {
    e.preventDefault();
    const selected = Object.entries(files).filter(([, f]) => f);
    if (selected.length === 0) {
      setUploadMsg("Choose at least one file to upload.");
      return;
    }
    const formData = new FormData();
    selected.forEach(([slot, file]) => formData.append(slot, file));
    setUploading(true);
    setUploadMsg("");
    try {
      await client.post(`/api/documents/students/${personId}/certificates/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadMsg("Uploaded successfully.");
      setFiles({});
      await loadCerts();
    } catch (err) {
      setUploadMsg(err.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (documentId) => {
    try {
      const response = await client.get(`/api/documents/${documentId}/download/`, { responseType: "blob" });
      const contentType = response.headers["content-type"] || "application/octet-stream";
      const url = window.URL.createObjectURL(new Blob([response.data], { type: contentType }));
      window.open(url, "_blank");
    } catch {
      setUploadMsg("Couldn't open the file.");
    }
  };

  if (error) return <p className="bp-error">{error}</p>;
  if (!profile) return <p className="bp-loading">Loading student profile…</p>;

  const current = profile.enrollments[0];
  const fee = profile.fee;
  const feePct = fee && Number(fee.total) ? Math.round((Number(fee.paid) / Number(fee.total)) * 100) : null;
  const age = ageFrom(profile.date_of_birth);
  const uploadedCount = certs ? SLOTS.filter((s) => certs.certificates[s.key]?.uploaded).length : 0;

  return (
    <div className="bp-page">
      <Link to="/training/students" className="sd2-back"><ArrowLeft size={15} /> Back to All Students</Link>

      {/* ---------- Profile hero ---------- */}
      <section className="sd2-hero">
        <span className="sd2-orb" aria-hidden="true" />
        <div className="sd2-id">
          <span className="sd2-avatar">
            {profile.photo_url ? <img src={profile.photo_url} alt="" /> : initialsOf(profile.name)}
          </span>
          <div>
            <p className="sd2-crumb">Academy Management › Student Profile</p>
            <h1>{profile.name}</h1>
            <div className="sd2-tags">
              <span className="sd2-tag">#{profile.student_code}</span>
              <span className="sd2-tag green">{titleCase(profile.student_status)}</span>
              {profile.internship && <span className="sd2-tag orange">Intern · {profile.internship.intern_code}</span>}
            </div>
            <div className="sd2-contact">
              {profile.email && <span><Mail size={13} /> {profile.email}</span>}
              {profile.phone && <span><Phone size={13} /> {profile.phone}</span>}
              {profile.username && <span><UserRound size={13} /> {profile.username}</span>}
              {profile.date_of_birth && <span><CalendarDays size={13} /> {fmtDate(profile.date_of_birth)}{age != null ? ` · ${age} yrs` : ""}</span>}
            </div>
          </div>
        </div>
        <div className="sd2-kpis">
          <div className="sd2-kpi">
            <CalendarCheck size={16} />
            <p>Attendance</p>
            <b>{current?.attendance_percent != null ? `${current.attendance_percent}%` : "—"}</b>
          </div>
          <div className="sd2-kpi">
            <ClipboardCheck size={16} />
            <p>Tasks</p>
            <b>{current ? `${current.tasks_submitted}/${current.tasks_total}` : "—"}</b>
          </div>
          <div className="sd2-kpi">
            <Wallet size={16} />
            <p>Fee Paid</p>
            <b>{feePct != null ? `${feePct}%` : "—"}</b>
          </div>
        </div>
      </section>

      <div className="sd2-grid">
        <div className="sd2-col">
          {/* ---------- Enrollments ---------- */}
          <div className="sd2-card" style={{ "--i": 0 }}>
            <h3><span className="sd2-icon"><GraduationCap size={15} /></span> Enrollments</h3>
            {profile.enrollments.length === 0 ? (
              <p className="sd2-empty">Not enrolled in any batch yet.</p>
            ) : profile.enrollments.map((e) => (
              <div key={e.enrollment_id} className="sd2-enroll">
                <div className="sd2-enroll-head">
                  <div>
                    <p className="sd2-strong">{e.course_name}</p>
                    <Link to={`/training/batches/${e.batch_id}`} className="sd2-link">{e.batch_name}</Link>
                  </div>
                  <span className={`bp-chip ${e.status === "ACTIVE" ? "blue" : e.status === "COMPLETED" ? "green" : "gray"}`}>{titleCase(e.status)}</span>
                </div>
                <div className="sd2-facts">
                  <div><p>Trainer</p><b>{e.trainer_name || "Unassigned"}</b></div>
                  <div><p>Enrolled</p><b>{fmtDate(e.enrollment_date)}</b></div>
                  <div><p>Batch runs</p><b>{fmtDate(e.batch_start)} – {fmtDate(e.batch_end)}</b></div>
                  <div><p>Avg score</p><b>{e.average_score != null ? `${e.average_score}/100` : "—"}</b></div>
                </div>
                <div className="sd2-meter-row">
                  <span>Attendance {e.attendance_present}/{e.attendance_total} days</span>
                  <b>{e.attendance_percent != null ? `${e.attendance_percent}%` : "—"}</b>
                </div>
                <div className="bp-meter"><span className={e.attendance_percent != null && e.attendance_percent < 85 ? "orange" : ""} style={{ width: `${e.attendance_percent ?? 0}%` }} /></div>
                <div className="sd2-meter-row">
                  <span>Tasks submitted</span>
                  <b>{e.tasks_submitted}/{e.tasks_total}</b>
                </div>
                <div className="bp-meter"><span style={{ width: `${e.tasks_total ? (e.tasks_submitted / e.tasks_total) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>

          {/* ---------- Internship ---------- */}
          {profile.internship && (
            <div className="sd2-card" style={{ "--i": 1 }}>
              <h3><span className="sd2-icon orange"><BriefcaseBusiness size={15} /></span> Internship</h3>
              <div className="sd2-facts">
                <div><p>Intern code</p><b>{profile.internship.intern_code}</b></div>
                <div><p>Status</p><b>{titleCase(profile.internship.status)}</b></div>
                <div><p>Start</p><b>{fmtDate(profile.internship.start_date)}</b></div>
                <div><p>End</p><b>{fmtDate(profile.internship.end_date)}</b></div>
                <div className="wide"><p>Reporting manager</p><b>{profile.internship.manager_name || "Not assigned yet"}</b></div>
              </div>
            </div>
          )}

          {/* ---------- Background ---------- */}
          {profile.enquiry && (
            <div className="sd2-card" style={{ "--i": 2 }}>
              <h3><span className="sd2-icon"><BookOpen size={15} /></span> Background</h3>
              <div className="sd2-facts">
                <div><p>Education</p><b>{profile.enquiry.education_summary || "—"}</b></div>
                <div><p>Passed out</p><b>{profile.enquiry.passed_out_year || "—"}</b></div>
                <div><p>Lead source</p><b>{titleCase(profile.enquiry.source)}</b></div>
                <div><p>Enquired on</p><b>{fmtDate(profile.enquiry.created_at)}</b></div>
                {profile.enquiry.address && (
                  <div className="wide"><p><MapPin size={11} /> Address</p><b>{profile.enquiry.address}</b></div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="sd2-col">
          {/* ---------- Fee plan ---------- */}
          <div className="sd2-card" style={{ "--i": 1 }}>
            <h3><span className="sd2-icon green"><Wallet size={15} /></span> Fee Plan</h3>
            {!fee ? (
              <p className="sd2-empty">No fee plan on record.</p>
            ) : (
              <>
                <div className="sd2-fee-top">
                  <div>
                    <p className="sd2-fee-paid">{rupee(fee.paid)}</p>
                    <p className="sd2-muted">paid of {rupee(fee.total)} · {titleCase(fee.plan_type)} plan</p>
                  </div>
                  <span className={`bp-chip ${feePct === 100 ? "green" : "orange"}`}>{feePct}% paid</span>
                </div>
                <div className="bp-meter sd2-fee-meter"><span style={{ width: `${feePct}%` }} /></div>
                <p className="sd2-muted">Base {rupee(fee.base_fee)} + {Number(fee.gst_percentage)}% GST</p>
                <div className="sd2-installments">
                  {fee.installments.map((i) => {
                    const overdue = !i.paid && new Date(`${i.due_date}T00:00:00`) < new Date(new Date().toDateString());
                    return (
                      <div key={i.installment_number} className={`sd2-inst ${i.paid ? "paid" : overdue ? "late" : ""}`}>
                        <span className="sd2-inst-icon">{i.paid ? <Check size={13} strokeWidth={3} /> : <Clock3 size={13} />}</span>
                        <div className="sd2-inst-text">
                          <p className="sd2-strong">Installment {i.installment_number}</p>
                          <p className="sd2-muted">{i.paid ? `Paid ${fmtDate(i.paid_on)}` : `Due ${fmtDate(i.due_date)}`}</p>
                        </div>
                        <b>{rupee(i.amount)}</b>
                      </div>
                    );
                  })}
                </div>
                {profile.enquiry && (
                  <Link to={`/training/fee-conversion/${profile.enquiry.enquiry_id}`} className="bp-btn soft small sd2-manage">
                    Manage payments
                  </Link>
                )}
              </>
            )}
          </div>

          {/* ---------- Certificates (existing upload/download) ---------- */}
          <div className="sd2-card" style={{ "--i": 2 }}>
            <h3>
              <span className="sd2-icon"><Award size={15} /></span> Certificates
              {certs && <span className="bp-chip blue sd2-count">{uploadedCount}/{SLOTS.length} uploaded</span>}
            </h3>
            {certError ? (
              <p className="sd2-empty">{certError}</p>
            ) : !certs ? (
              <p className="sd2-empty">Loading…</p>
            ) : (
              <>
                <div className="sd2-certs">
                  {SLOTS.map(({ key, label }) => {
                    const cert = certs.certificates[key];
                    return (
                      <div key={key} className={`sd2-cert ${cert.uploaded ? "done" : ""}`}>
                        <span className="sd2-cert-icon"><FileText size={15} /></span>
                        <div className="sd2-inst-text">
                          <p className="sd2-strong">{label}</p>
                          <p className="sd2-muted">{cert.uploaded ? cert.file_name : "Not uploaded"}</p>
                        </div>
                        {cert.uploaded ? (
                          <button type="button" className="bp-btn soft small" onClick={() => handleDownload(cert.document_id)}>
                            <Eye size={13} /> View
                          </button>
                        ) : (
                          <span className="bp-chip orange">Pending</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {canUpload && (
                  <form onSubmit={handleUpload} className="sd2-upload">
                    <p className="sd2-strong">Upload / replace certificates</p>
                    <div className="sd2-upload-grid">
                      {SLOTS.map(({ key, label }) => (
                        <label key={key} className="sd2-file">
                          <span>{label}</span>
                          <input type="file" onChange={(e) => setFiles((prev) => ({ ...prev, [key]: e.target.files[0] }))} />
                          <em>{files[key]?.name || "Choose file…"}</em>
                        </label>
                      ))}
                    </div>
                    {uploadMsg && <p className={uploadMsg.includes("success") ? "sd2-ok" : "sd2-bad"}>{uploadMsg}</p>}
                    <button type="submit" disabled={uploading} className="bp-btn navy small">
                      <Upload size={13} /> {uploading ? "Uploading…" : "Upload Selected"}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentDetail;
