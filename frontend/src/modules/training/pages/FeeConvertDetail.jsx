import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, Download, IndianRupee, KeyRound, Mail, MessageCircle, Receipt,
  RotateCcw, Save, ShieldAlert, UserPlus, Wallet, CalendarClock,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/TrainerDashboard.css";
import "../styles/TrainingBatches.css";
import "../styles/FeeConvertDetail.css";

function FeeConvertDetail() {
  const { enquiryId } = useParams();

  const [enquiry, setEnquiry] = useState(null);
  const [plan, setPlan] = useState(null);
  const [planExists, setPlanExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({ base_fee: "", gst_percentage: "18.00", plan_type: "full", installment_count: 1 });
  const [creating, setCreating] = useState(false);

  const [convertForm, setConvertForm] = useState({
    username: "", password: "", official_email: "", official_email_password: "",
  });
  const [converting, setConverting] = useState(false);
  const [credentialReveal, setCredentialReveal] = useState(null);
  const [resetting, setResetting] = useState(false);

  const [officialEmailInput, setOfficialEmailInput] = useState("");
  const [officialEmailPasswordInput, setOfficialEmailPasswordInput] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const enquiryRes = await client.get(`/api/admissions/enquiries/${enquiryId}/`);
      setEnquiry(enquiryRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't load enquiry.");
    }

    try {
      const { data } = await client.get(`/api/admissions/enquiries/${enquiryId}/fee-plan/`);
      setPlan(data);
      setPlanExists(true);
    } catch (err) {
      if (err.response?.status === 404) setPlanExists(false);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquiryId]);

  const createPlan = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      await client.post(`/api/admissions/enquiries/${enquiryId}/fee-plan/`, form);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't create fee plan.");
    } finally {
      setCreating(false);
    }
  };

  const markPaid = async (installmentId) => {
    try {
      await client.post(`/api/admissions/installments/${installmentId}/mark-paid/`);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't mark installment paid.");
    }
  };

  const convertToStudent = async (event) => {
    event.preventDefault();
    setConverting(true);
    setError("");
    try {
      const { data } = await client.post(
        `/api/admissions/enquiries/${enquiryId}/convert-to-student/`,
        {
          username: convertForm.username,
          password: convertForm.password,
          official_email: convertForm.official_email,
        }
      );
      setCredentialReveal({ ...data, official_email_password: convertForm.official_email_password });
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't convert to student.");
    } finally {
      setConverting(false);
    }
  };

  const resetPassword = async () => {
    setResetting(true);
    setError("");
    try {
      const { data } = await client.post(`/api/admissions/enquiries/${enquiryId}/reset-password/`);
      setCredentialReveal(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't reset password.");
    } finally {
      setResetting(false);
    }
  };

  const saveOfficialEmail = async () => {
    setSavingEmail(true);
    setError("");
    try {
      await client.post(`/api/admissions/enquiries/${enquiryId}/official-email/`, {
        official_email: officialEmailInput,
      });
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't save official email.");
    } finally {
      setSavingEmail(false);
    }
  };

  const whatsappShareUrl = (cred) => {
    let message = `Hi! Your VetriOS student login:\nUsername: ${cred.username}\nPassword: ${cred.password}`;
    if (cred.official_email) {
      message += `\n\nYour official email:\nAddress: ${cred.official_email}`;
      if (cred.official_email_password) {
        message += `\nPassword: ${cred.official_email_password}`;
      }
    }
    message += `\n\nPlease log in and change your passwords after first login.`;
    const number = (cred.whatsapp_number || "").replace(/\D/g, "");
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  };

  const whatsappShareUrlForExisting = (enquiry, officialEmail, officialEmailPassword) => {
    let message = `Hi! Your VetriOS account details:\nUsername: ${enquiry.username}`;
    message += `\n(If you've lost your login password, ask us to reset it.)`;
    if (officialEmail) {
      message += `\n\nYour official email:\nAddress: ${officialEmail}`;
      if (officialEmailPassword) {
        message += `\nPassword: ${officialEmailPassword}`;
      }
    }
    const number = (enquiry.whatsapp_number || "").replace(/\D/g, "");
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  };

  const downloadInvoice = async (installmentId, studentName) => {
    try {
      const response = await client.get(
        `/api/admissions/installments/${installmentId}/invoice/`,
        { responseType: "blob" }
      );
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Invoice_${studentName.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setError("Couldn't download invoice.");
    }
  };

  const shareInvoiceViaWhatsApp = async (installmentId, studentName, whatsappNumber) => {
    try {
      const response = await client.get(
        `/api/admissions/installments/${installmentId}/invoice/`,
        { responseType: "blob" }
      );
      const file = new File([response.data], `Invoice_${studentName.replace(/\s+/g, "_")}.pdf`, {
        type: "application/pdf",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Invoice",
          text: `Invoice for ${studentName}`,
        });
      } else {
        const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);

        const number = (whatsappNumber || "").replace(/\D/g, "");
        const message = `Hi ${studentName}, please find your invoice attached (downloaded to your device — please attach it here).`;
        window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank");
      }
    } catch {
      setError("Couldn't share invoice.");
    }
  };

  if (loading) return <p className="bp-loading">Loading…</p>;

  const hasAnyPaid = plan?.installments?.some((i) => i.paid);
  const installments = plan?.installments || [];
  const paidCount = installments.filter((i) => i.paid).length;
  const paidAmount = installments.filter((i) => i.paid).reduce((s, i) => s + Number(i.amount || 0), 0);
  const total = Number(plan?.total_with_gst || 0);
  const paidPct = total ? Math.min(100, Math.round((paidAmount / total) * 100)) : 0;
  const rupee = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  return (
    <div className="bp-page tr-page">
      <Link to="/training/fee-conversion" className="fcd-back">
        <ArrowLeft size={15} /> Back to Fee &amp; Conversion
      </Link>

      <div className="bp-head">
        <div>
          <p className="bp-crumb">Business Team / Fee &amp; Conversion / <span>{enquiry?.name || "Enquiry"}</span></p>
          <h1 className="bp-title">Set Fee &amp; Convert{enquiry ? ` — ${enquiry.name}` : ""}</h1>
          <p className="bp-sub">Create the fee plan, record payments, then open the student's VetriOS account.</p>
        </div>
        {enquiry?.account_created && <span className="bp-chip green fcd-head-chip"><CheckCircle2 size={13} /> Account created</span>}
      </div>

      {error && <p className="fcd-alert">{error}</p>}

      <ol className="fcd-steps">
        <li className={planExists ? "done" : "current"}><b>1</b> Fee plan</li>
        <li className={hasAnyPaid ? "done" : planExists ? "current" : ""}><b>2</b> First payment</li>
        <li className={enquiry?.account_created ? "done" : hasAnyPaid ? "current" : ""}><b>3</b> Student account</li>
      </ol>

      {!planExists ? (
        <form className="bp-panel tr-card" onSubmit={createPlan}>
          <div className="tr-card-head">
            <div>
              <h3><Wallet size={18} /> Set Fee Plan</h3>
              <p>GST is added on top of the base fee. Installment plans split the total evenly.</p>
            </div>
          </div>

          <div className="bp-form-grid">
            <label className="bp-field">
              <span>Base fee (before GST) *</span>
              <input
                type="number" step="0.01" required placeholder="e.g. 45000"
                value={form.base_fee}
                onChange={(e) => setForm({ ...form, base_fee: e.target.value })}
              />
            </label>
            <label className="bp-field">
              <span>GST %</span>
              <input
                type="number" step="0.01"
                value={form.gst_percentage}
                onChange={(e) => setForm({ ...form, gst_percentage: e.target.value })}
              />
            </label>
            <label className="bp-field">
              <span>Plan type</span>
              <select value={form.plan_type} onChange={(e) => setForm({ ...form, plan_type: e.target.value })}>
                <option value="full">Full payment</option>
                <option value="emi">Installments</option>
              </select>
            </label>
            {form.plan_type === "emi" && (
              <label className="bp-field">
                <span>Number of installments</span>
                <input
                  type="number" min="2"
                  value={form.installment_count}
                  onChange={(e) => setForm({ ...form, installment_count: e.target.value })}
                />
              </label>
            )}
          </div>

          {form.base_fee && (
            <p className="fcd-preview">
              Total with GST: <b>{rupee(Number(form.base_fee) * (1 + Number(form.gst_percentage || 0) / 100))}</b>
            </p>
          )}

          <div className="bp-actions">
            <button type="submit" className="bp-btn orange" disabled={creating}>
              <Save size={16} /> {creating ? "Saving…" : "Create Fee Plan"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="bp-stats tr-stats">
            <div className="bp-stat" style={{ "--i": 0 }}>
              <div className="bp-stat-top">
                <p className="bp-stat-label tb-label">TOTAL FEE (INCL. GST)</p>
                <span className="tb-stat-icon navy"><IndianRupee size={20} /></span>
              </div>
              <p className="bp-stat-value">{rupee(plan.total_with_gst)}</p>
              <p className="tr-stat-sub">Base {rupee(plan.base_fee)} + {plan.gst_percentage}% GST</p>
            </div>
            <div className="bp-stat" style={{ "--i": 1 }}>
              <div className="bp-stat-top">
                <p className="bp-stat-label tb-label">PLAN</p>
                <span className="tb-stat-icon blue"><CalendarClock size={20} /></span>
              </div>
              <p className="bp-stat-value">{plan.plan_type === "emi" ? plan.installment_count : 1} <small className="tb-unit">{plan.plan_type === "emi" ? "installments" : "full payment"}</small></p>
              <p className="tb-foot"><span className="bp-chip blue">{paidCount} of {installments.length} paid</span></p>
            </div>
            <div className="bp-stat" style={{ "--i": 2 }}>
              <div className="bp-stat-top">
                <p className="bp-stat-label tb-label">COLLECTED</p>
                <span className="tb-stat-icon green"><Receipt size={20} /></span>
              </div>
              <p className="bp-stat-value">{rupee(paidAmount)}</p>
              <div className="tr-progress thin"><span style={{ width: `${paidPct}%` }} /></div>
              <p className="tb-foot"><span>{paidPct}% of total</span></p>
            </div>
          </div>

          <section className="bp-panel">
            <div className="tr-card-head fcd-panel-head">
              <div>
                <h3><Receipt size={18} /> Installments</h3>
                <p>Mark payments as they arrive; invoices unlock once paid.</p>
              </div>
            </div>
            <div className="bp-table-wrap">
              <table className="bp-table">
                <thead>
                  <tr>
                    <th>#</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((i, idx) => (
                    <tr key={i.student_fee_installment_id} style={{ "--row": idx }}>
                      <td><span className="fcd-num">{i.installment_number}</span></td>
                      <td className="bp-strong">{rupee(i.amount)}</td>
                      <td className="bp-muted">{i.due_date}</td>
                      <td>
                        <span className={`bp-chip ${i.paid ? "green" : "orange"}`}>
                          {i.paid ? `Paid ${i.paid_on}` : "Unpaid"}
                        </span>
                      </td>
                      <td>
                        <div className="fcd-actions">
                          {!i.paid ? (
                            <button type="button" className="bp-btn navy small" onClick={() => markPaid(i.student_fee_installment_id)}>
                              <CheckCircle2 size={13} /> Mark Paid
                            </button>
                          ) : (
                            <>
                              <button type="button" className="bp-btn outline small" onClick={() => downloadInvoice(i.student_fee_installment_id, enquiry.name)}>
                                <Download size={13} /> Invoice
                              </button>
                              <button
                                type="button" className="bp-btn soft small"
                                onClick={() => shareInvoiceViaWhatsApp(i.student_fee_installment_id, enquiry.name, enquiry.whatsapp_number)}
                              >
                                <MessageCircle size={13} /> WhatsApp
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bp-panel tr-card">
            <div className="tr-card-head">
              <div>
                <h3><UserPlus size={18} /> Student Account</h3>
                <p>VetriOS login and official email for this student.</p>
              </div>
            </div>

            {credentialReveal ? (
              <div className="fcd-reveal">
                <p className="fcd-warn"><ShieldAlert size={15} /> These are shown only once and cannot be retrieved again — share them now.</p>
                <dl className="fcd-creds">
                  <div><dt>Username</dt><dd>{credentialReveal.username}</dd></div>
                  <div><dt>Login password</dt><dd>{credentialReveal.password}</dd></div>
                  {credentialReveal.official_email && <div><dt>Official email</dt><dd>{credentialReveal.official_email}</dd></div>}
                  {credentialReveal.official_email_password && <div><dt>Official email password</dt><dd>{credentialReveal.official_email_password}</dd></div>}
                </dl>
                <div className="bp-actions">
                  <a href={whatsappShareUrl(credentialReveal)} target="_blank" rel="noreferrer" className="bp-btn orange">
                    <MessageCircle size={16} /> Share via WhatsApp
                  </a>
                </div>
              </div>
            ) : enquiry?.account_created ? (
              <div className="fcd-existing">
                <p className="fcd-info">
                  Account already exists — username <b>{enquiry.username}</b>.
                  {enquiry.official_email && <> Official email <b>{enquiry.official_email}</b>.</>}
                  {" "}Passwords aren't stored, so they can't be shown again. Reset to generate a new one.
                </p>

                <div className="bp-form-grid">
                  <label className="bp-field">
                    <span><Mail size={12} style={{ verticalAlign: "-1px" }} /> {enquiry.official_email ? "Update official email" : "Set official email"} <small className="bp-muted">(from Hostinger)</small></span>
                    <input
                      type="email"
                      value={officialEmailInput}
                      onChange={(e) => setOfficialEmailInput(e.target.value)}
                      placeholder={enquiry.official_email || "name@vetritech.in"}
                    />
                  </label>
                  <label className="bp-field">
                    <span>Official email password</span>
                    <input
                      type="text"
                      value={officialEmailPasswordInput}
                      onChange={(e) => setOfficialEmailPasswordInput(e.target.value)}
                      placeholder="not stored — used once, for sharing only"
                    />
                  </label>
                </div>

                <div className="bp-actions">
                  <button type="button" className="bp-btn navy" onClick={saveOfficialEmail} disabled={savingEmail}>
                    <Save size={16} /> {savingEmail ? "Saving…" : "Save Official Email"}
                  </button>
                  <a
                    href={whatsappShareUrlForExisting(enquiry, officialEmailInput || enquiry.official_email, officialEmailPasswordInput)}
                    target="_blank" rel="noreferrer" className="bp-btn soft"
                  >
                    <MessageCircle size={16} /> Share via WhatsApp
                  </a>
                  <button type="button" className="bp-btn outline fcd-reset" onClick={resetPassword} disabled={resetting}>
                    <RotateCcw size={16} /> {resetting ? "Resetting…" : "Reset Password"}
                  </button>
                </div>
              </div>
            ) : !hasAnyPaid ? (
              <p className="fcd-info"><KeyRound size={15} style={{ verticalAlign: "-3px" }} /> At least one installment must be paid before creating the account.</p>
            ) : (
              <form onSubmit={convertToStudent} className="fcd-existing">
                <div className="bp-form-grid">
                  <label className="bp-field">
                    <span>Username *</span>
                    <input required value={convertForm.username} onChange={(e) => setConvertForm({ ...convertForm, username: e.target.value })} />
                  </label>
                  <label className="bp-field">
                    <span>Temporary password *</span>
                    <input type="text" required value={convertForm.password} onChange={(e) => setConvertForm({ ...convertForm, password: e.target.value })} />
                  </label>
                  <label className="bp-field">
                    <span>Official email address <small className="bp-muted">(from Hostinger)</small></span>
                    <input type="email" value={convertForm.official_email} onChange={(e) => setConvertForm({ ...convertForm, official_email: e.target.value })} />
                  </label>
                  <label className="bp-field">
                    <span>Official email password</span>
                    <input type="text" value={convertForm.official_email_password} onChange={(e) => setConvertForm({ ...convertForm, official_email_password: e.target.value })} />
                  </label>
                </div>
                <div className="bp-actions">
                  <button type="submit" className="bp-btn orange" disabled={converting}>
                    <UserPlus size={16} /> {converting ? "Creating…" : "Create Student Account"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default FeeConvertDetail;
