import { useEffect, useState } from "react";
import {
  ArrowRight, Award, BookOpen, CalendarDays, CheckCircle2, ChevronDown, CircleAlert, GraduationCap,
  LoaderCircle, Mail, MapPin, MessageCircle, Phone, Rocket, School, Send, ShieldCheck, User,
} from "lucide-react";
import client from "../../../api/client";
import { figmaImage } from "../../../assets/figmaImages";
import "../styles/PublicEnquiryForm.css";

const EMPTY = {
  course_id: "", name: "", date_of_birth: "", whatsapp_number: "",
  personal_email: "", address: "", education_summary: "", passed_out_year: "",
};

const NAME_REGEX = /^[A-Za-z\s.]{3,100}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;

function validate(form) {
  const errors = {};

  if (!form.course_id) {
    errors.course_id = "Please select a course.";
  }

  if (!form.name.trim()) {
    errors.name = "Full name is required.";
  } else if (!NAME_REGEX.test(form.name.trim())) {
    errors.name = "Name should only contain letters and spaces (3–100 characters).";
  }

  if (form.personal_email && !EMAIL_REGEX.test(form.personal_email.trim())) {
    errors.personal_email = "Enter a valid email address.";
  }

  if (!form.date_of_birth) {
    errors.date_of_birth = "Date of birth is required.";
  } else {
    const dob = new Date(form.date_of_birth);
    const today = new Date();
    if (dob > today) {
      errors.date_of_birth = "Date of birth can't be in the future.";
    } else {
      const age = today.getFullYear() - dob.getFullYear() -
        ((today.getMonth(), today.getDate()) < (dob.getMonth(), dob.getDate()) ? 1 : 0);
      if (age < 10 || age > 100) {
        errors.date_of_birth = "Please enter a valid date of birth.";
      }
    }
  }

  if (!form.whatsapp_number.trim()) {
    errors.whatsapp_number = "WhatsApp/Mobile number is required.";
  } else if (!PHONE_REGEX.test(form.whatsapp_number.trim())) {
    errors.whatsapp_number = "Enter a valid 10-digit mobile number.";
  }

  if (!form.address.trim()) {
    errors.address = "Address is required.";
  } else if (form.address.trim().length < 10) {
    errors.address = "Please enter a more complete address.";
  }

  if (!form.education_summary.trim()) {
    errors.education_summary = "Educational details are required.";
  }

  if (form.passed_out_year) {
    const year = parseInt(form.passed_out_year, 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < 1980 || year > currentYear + 1) {
      errors.passed_out_year = `Enter a valid year between 1980 and ${currentYear + 1}.`;
    }
  }

  return errors;
}

const STEPS = [
  { Icon: Send, title: "Share your details", text: "Takes about two minutes." },
  { Icon: MessageCircle, title: "We reach out on WhatsApp", text: "Our admissions team answers your questions." },
  { Icon: Rocket, title: "Pick a batch & start", text: "Join the cohort that fits your schedule." },
];

function Field({ label, error, icon: Icon, optional, full, children }) {
  return (
    <label className={`pf-field${full ? " full" : ""}${error ? " has-error" : ""}`}>
      <span className="pf-label">
        {label}
        {optional && <small> (optional)</small>}
      </span>
      <span className="pf-control">
        {Icon && <Icon size={16} className="pf-control-icon" aria-hidden="true" />}
        {children}
      </span>
      {error && <span className="pf-field-error"><CircleAlert size={13} /> {error}</span>}
    </label>
  );
}

function PublicEnquiryForm() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    client.get("/api/admissions/public/courses/").then(({ data }) => setCourses(data));
  }, []);

  const updateField = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    setServerError("");
    try {
      await client.post("/api/admissions/public/enquiries/", form);
      setDone(true);
    } catch (err) {
      setServerError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const logo = figmaImage("vetri-logo");
  const selectedCourse = courses.find((c) => String(c.course_id) === String(form.course_id));

  return (
    <div className="pf-screen">
      <aside className="pf-hero">
        <span className="pf-blob a" aria-hidden="true" />
        <span className="pf-blob b" aria-hidden="true" />
        <span className="pf-grid" aria-hidden="true" />

        <div className="pf-hero-inner">
          <div className="pf-brand">
            {logo ? <img src={logo} alt="Vetri IT Systems" /> : <GraduationCap size={26} />}
            <div>
              <b>Vetri IT Systems</b>
              <small>Learn · Grow · Succeed</small>
            </div>
          </div>

          <span className="pf-eyebrow"><i /> Admissions open</span>
          <h1>Start your tech journey <span>with Vetri.</span></h1>
          <p>Tell us a little about yourself and the course you're interested in — our team will guide you through the rest.</p>

          <ol className="pf-steps">
            {STEPS.map(({ Icon, title, text }, i) => (
              <li key={title} style={{ "--i": i }}>
                <span className="pf-step-ico"><Icon size={17} /></span>
                <div>
                  <b>{title}</b>
                  <small>{text}</small>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </aside>

      <main className="pf-main">
        {done ? (
          <div className="pf-card pf-thankyou">
            <span className="pf-check"><CheckCircle2 size={40} /></span>
            <h2>Thank you{form.name ? `, ${form.name.split(" ")[0]}` : ""}!</h2>
            <p>We've received your enquiry{selectedCourse ? <> for <b>{selectedCourse.course_name}</b></> : ""}. Our team will reach out to you on WhatsApp shortly.</p>
            <p className="pf-thankyou-sub"><MessageCircle size={15} /> Keep an eye on +91 {form.whatsapp_number}</p>
          </div>
        ) : (
          <form className="pf-card" onSubmit={handleSubmit} noValidate>
            <div className="pf-card-head">
              <span className="pf-card-ico"><GraduationCap size={22} /></span>
              <div>
                <h2>Course Enquiry</h2>
                <p>Fill in your details and our team will get in touch.</p>
              </div>
            </div>

            <section className="pf-section">
              <p className="pf-section-title"><span>1</span> Course</p>
              <Field label="Course you're interested in" error={errors.course_id} icon={BookOpen} full>
                <select value={form.course_id} onChange={(e) => updateField("course_id", e.target.value)}>
                  <option value="">Select a course</option>
                  {courses.map((c) => (
                    <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="pf-select-caret" aria-hidden="true" />
              </Field>
            </section>

            <section className="pf-section">
              <p className="pf-section-title"><span>2</span> About you</p>
              <div className="pf-grid-2">
                <Field label="Full name" error={errors.name} icon={User} full>
                  <input value={form.name} placeholder="As on your certificates" autoComplete="name" onChange={(e) => updateField("name", e.target.value)} />
                </Field>
                <Field label="WhatsApp / Mobile number" error={errors.whatsapp_number} icon={Phone}>
                  <span className="pf-prefix">+91</span>
                  <input
                    className="pf-has-prefix"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="10-digit number"
                    value={form.whatsapp_number}
                    onChange={(e) => updateField("whatsapp_number", e.target.value.replace(/\D/g, "").slice(0, 10))}
                    maxLength={10}
                  />
                </Field>
                <Field label="Email address" error={errors.personal_email} icon={Mail} optional>
                  <input type="email" autoComplete="email" placeholder="you@example.com" value={form.personal_email} onChange={(e) => updateField("personal_email", e.target.value)} />
                </Field>
                <Field label="Date of birth" error={errors.date_of_birth} icon={CalendarDays}>
                  <input type="date" value={form.date_of_birth} onChange={(e) => updateField("date_of_birth", e.target.value)} />
                </Field>
                <Field label="Address" error={errors.address} icon={MapPin} full>
                  <textarea rows={2} autoComplete="street-address" placeholder="Door no, street, city, pincode" value={form.address} onChange={(e) => updateField("address", e.target.value)} />
                </Field>
              </div>
            </section>

            <section className="pf-section">
              <p className="pf-section-title"><span>3</span> Education</p>
              <div className="pf-grid-2">
                <Field label="Educational details" error={errors.education_summary} icon={School} full>
                  <textarea rows={2} placeholder="Degree, institution, specialization…" value={form.education_summary} onChange={(e) => updateField("education_summary", e.target.value)} />
                </Field>
                <Field label="Passed out year" error={errors.passed_out_year} icon={Award} optional>
                  <input type="number" inputMode="numeric" placeholder="e.g. 2025" value={form.passed_out_year} onChange={(e) => updateField("passed_out_year", e.target.value)} />
                </Field>
              </div>
            </section>

            {serverError && <p className="pf-error"><CircleAlert size={15} /> {serverError}</p>}

            <button type="submit" disabled={submitting} className="pf-submit">
              {submitting ? <><LoaderCircle size={17} className="pf-spin" /> Submitting…</> : <>Submit Enquiry <ArrowRight size={17} /></>}
            </button>
            <p className="pf-privacy"><ShieldCheck size={13} /> Your details are only used by the Vetri admissions team to contact you.</p>
          </form>
        )}
      </main>
    </div>
  );
}

export default PublicEnquiryForm;
