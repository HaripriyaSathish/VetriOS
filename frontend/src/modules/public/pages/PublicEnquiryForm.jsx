import { useEffect, useState } from "react";
import client from "../../../api/client";
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

  if (done) {
    return (
      <div className="pf-screen">
        <div className="pf-card pf-thankyou">
          <h1>Thank you!</h1>
          <p>We've received your details and our team will reach out to you on WhatsApp shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pf-screen">
      <form className="pf-card" onSubmit={handleSubmit} noValidate>
        <h1>Course Enquiry</h1>
        <p className="pf-sub">Fill in your details and our team will get in touch.</p>

        <label>Course you're interested in</label>
        <select
          value={form.course_id}
          onChange={(e) => updateField("course_id", e.target.value)}
        >
          <option value="">Select a course</option>
          {courses.map((c) => (
            <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
          ))}
        </select>
        {errors.course_id && <p className="pf-field-error">{errors.course_id}</p>}

        <label>Full Name</label>
        <input value={form.name} onChange={(e) => updateField("name", e.target.value)} />
        {errors.name && <p className="pf-field-error">{errors.name}</p>}

        <label>Email Address</label>
        <input
          type="email"
          value={form.personal_email}
          onChange={(e) => updateField("personal_email", e.target.value)}
        />
        {errors.personal_email && <p className="pf-field-error">{errors.personal_email}</p>}

        <label>Date of Birth</label>
        <input
          type="date"
          value={form.date_of_birth}
          onChange={(e) => updateField("date_of_birth", e.target.value)}
        />
        {errors.date_of_birth && <p className="pf-field-error">{errors.date_of_birth}</p>}

        <label>WhatsApp / Mobile Number</label>
        <input
          value={form.whatsapp_number}
          onChange={(e) => updateField("whatsapp_number", e.target.value.replace(/\D/g, "").slice(0, 10))}
          maxLength={10}
        />
        {errors.whatsapp_number && <p className="pf-field-error">{errors.whatsapp_number}</p>}

        <label>Address</label>
        <textarea
          value={form.address}
          onChange={(e) => updateField("address", e.target.value)}
        />
        {errors.address && <p className="pf-field-error">{errors.address}</p>}

        <label>Educational Details (degree, institution, etc.)</label>
        <textarea
          value={form.education_summary}
          onChange={(e) => updateField("education_summary", e.target.value)}
        />
        {errors.education_summary && <p className="pf-field-error">{errors.education_summary}</p>}

        <label>Passed Out Year</label>
        <input
          type="number"
          value={form.passed_out_year}
          onChange={(e) => updateField("passed_out_year", e.target.value)}
        />
        {errors.passed_out_year && <p className="pf-field-error">{errors.passed_out_year}</p>}

        {serverError && <p className="pf-error">{serverError}</p>}

        <button type="submit" disabled={submitting} className="pf-submit">
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </form>
    </div>
  );
}

export default PublicEnquiryForm;