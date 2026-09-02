import { useEffect, useState } from "react";
import client from "../../../api/client";
import "../styles/HRDashboard.css";

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  employee_code: "",
  designation_id: "",
  employment_type_id: "",
  joining_date: "",
};

function initials(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// HR screen — lists every employee record and lets an HR Administrator
// (or System Administrator) add a new one. Creating an employee always
// creates their person record too — there's no "attach to existing
// person" mode here yet, unlike Identity & Access's account creation.
function HRDashboard() {
  const [employees, setEmployees] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [empRes, desRes, typeRes] = await Promise.all([
        client.get("/api/hr/employees/"),
        client.get("/api/hr/designations/"),
        client.get("/api/hr/employment-types/"),
      ]);
      setEmployees(empRes.data);
      setDesignations(desRes.data);
      setEmploymentTypes(typeRes.data);
    } catch (err) {
      setError("Couldn't load employees.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await client.post("/api/hr/employees/", form);
      setModalOpen(false);
      await loadData();
    } catch (err) {
      const data = err.response?.data;
      const firstError = data && Object.values(data)[0];
      setFormError(Array.isArray(firstError) ? firstError[0] : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hr-screen">
      <div className="hr-head">
        <div>
          <h1>Employees</h1>
          <p>{employees.length} employees · employee, person</p>
        </div>
        <button className="hr-btn-accent" onClick={openCreate}>
          + New Employee
        </button>
      </div>

      {error && <p className="hr-error">{error}</p>}

      <div className="hr-panel">
        <div className="hr-panel-head">
          <h3>All employees</h3>
        </div>

        {loading ? (
          <p className="hr-empty">Loading…</p>
        ) : employees.length === 0 ? (
          <p className="hr-empty">No employees yet — add the first one.</p>
        ) : (
          <div className="hr-table-scroll">
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Code</th>
                  <th>Designation</th>
                  <th>Employment Type</th>
                  <th>Joining Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.employee_id}>
                    <td>
                      <div className="hr-cell-user">
                        <div className="hr-avatar">{initials(emp.full_name)}</div>
                        <div>
                          <div className="hr-name">{emp.full_name}</div>
                          <div className="hr-sub">{emp.email || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hr-mono">{emp.employee_code}</td>
                    <td>{emp.designation_name || "—"}</td>
                    <td>{emp.employment_type_name || "—"}</td>
                    <td className="hr-mono">{emp.joining_date || "—"}</td>
                    <td>
                      <span className={"hr-pill " + (emp.status === "ACTIVE" ? "on" : "off")}>
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="hr-modal-backdrop" onClick={closeModal}>
          <form className="hr-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <button type="button" className="hr-modal-x" onClick={closeModal} aria-label="Close">
              ✕
            </button>
            <h2>New employee</h2>
            <p className="hr-hint">Creates a new person record along with their employee details.</p>

            <div className="hr-form-row">
              <div>
                <label>First name</label>
                <input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Last name</label>
                <input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
            </div>

            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <label>Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />

            <label>Employee code</label>
            <input
              value={form.employee_code}
              onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
              required
            />

            <div className="hr-form-row">
              <div>
                <label>Designation</label>
                <select
                  value={form.designation_id}
                  onChange={(e) => setForm({ ...form, designation_id: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {designations.map((d) => (
                    <option key={d.designation_id} value={d.designation_id}>
                      {d.designation_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Employment type</label>
                <select
                  value={form.employment_type_id}
                  onChange={(e) => setForm({ ...form, employment_type_id: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {employmentTypes.map((t) => (
                    <option key={t.employment_type_id} value={t.employment_type_id}>
                      {t.employment_type_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label>Joining date</label>
            <input
              type="date"
              value={form.joining_date}
              onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
              required
            />

            {formError && <p className="hr-error">{formError}</p>}

            <div className="hr-modal-actions">
              <button type="button" className="hr-btn-sm" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="hr-btn-accent" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default HRDashboard;
