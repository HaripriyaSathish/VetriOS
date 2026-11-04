import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download, UserPlus, UsersRound, Laptop, BriefcaseBusiness, TrendingUp, Search, ChevronDown, SlidersHorizontal,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";

const PAGE_SIZE = 10;
const STATUS_TONE = { Active: "blue", Internship: "orange", Completed: "green", Dropped: "red" };

const rupee = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtDate = (d) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function FeeStatus({ s }) {
  if (s.fee_status === "none") return <span className="bp-chip gray">No fee plan</span>;
  if (s.fee_status === "paid") return <span className="bp-chip blue">{rupee(s.fee_paid)} (Paid)</span>;
  if (s.fee_status === "partial") return <span className="bp-chip orange">{rupee(s.fee_paid)} / {rupee(s.fee_total)} (Partial)</span>;
  return <span className="bp-chip red">{rupee(s.fee_total)} (Unpaid)</span>;
}

function downloadCsv(rows) {
  const head = ["Name", "Student Code", "Email", "Phone", "Course", "Batch", "Joined", "Attendance %", "Fee Paid", "Fee Total", "Status"];
  const lines = rows.map((s) => [
    s.name, s.student_code, s.email, s.phone, s.course_name, s.batch_name, s.joined_date,
    s.attendance_percent ?? "", s.fee_paid ?? "", s.fee_total ?? "", s.status,
  ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `students_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AllStudentsList() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    client.get("/api/training/business/students/")
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load students."));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.students.filter((s) => {
      if (batch && String(s.batch_id) !== batch) return false;
      if (status && s.status !== status) return false;
      if (!q) return true;
      return [s.name, s.email, s.student_code, s.phone, s.course_name, s.batch_name]
        .some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [data, search, batch, status]);

  if (error) return <p className="bp-error">{error}</p>;
  if (!data) return <p className="bp-loading">Loading students…</p>;

  const st = data.stats;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const statuses = [...new Set(data.students.map((s) => s.status))];

  const pageNumbers = [];
  for (let p = 1; p <= pages; p += 1) {
    if (p === 1 || p === pages || Math.abs(p - current) <= 1) pageNumbers.push(p);
    else if (pageNumbers[pageNumbers.length - 1] !== "…") pageNumbers.push("…");
  }

  return (
    <div className="bp-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Academy Management › <span>Roster</span></p>
          <h1 className="bp-title">All Students</h1>
          <p className="bp-sub">Enrolled trainees across all cohorts and active learning tracks</p>
        </div>
        <div className="bp-actions">
          <button type="button" className="bp-btn outline" onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0}>
            <Download size={15} /> Export CSV
          </button>
          <Link to="/training/enquiries" className="bp-btn navy"><UserPlus size={15} /> Enroll Student</Link>
        </div>
      </div>

      <div className="bp-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Total Enrolled</p>
            <span className="bp-stat-icon"><UsersRound size={17} /></span>
          </div>
          <p className="bp-stat-value">
            {st.total_enrolled}
            {st.added_this_month > 0 && (
              <span className="bp-chip blue"><TrendingUp size={11} /> +{st.added_this_month} this month</span>
            )}
          </p>
          <div className="bp-meter"><span style={{ width: "100%" }} /></div>
        </div>

        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">Active in Training</p>
            <span className="bp-stat-icon"><Laptop size={17} /></span>
          </div>
          <p className="bp-stat-value">
            {st.active_in_training}
            {st.active_percent != null && <span className="bp-chip blue">{st.active_percent}% of cohort</span>}
          </p>
          <div className="bp-meter"><span style={{ width: `${st.active_percent ?? 0}%` }} /></div>
        </div>

        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">In Internship</p>
            <span className="bp-stat-icon orange"><BriefcaseBusiness size={17} /></span>
          </div>
          <p className="bp-stat-value">
            {st.in_internship}
            {st.internship_percent != null && <span className="bp-chip orange">{st.internship_percent}% transition</span>}
          </p>
          <div className="bp-meter"><span className="orange" style={{ width: `${st.internship_percent ?? 0}%` }} /></div>
        </div>
      </div>

      <div className="bp-panel">
        <div className="bp-filters">
          <label className="bp-search">
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by student name, ID or email..."
              aria-label="Search students"
            />
          </label>
          <label className="bp-select">
            <select value={batch} onChange={(e) => { setBatch(e.target.value); setPage(1); }} aria-label="Batch">
              <option value="">All Batches</option>
              {data.batches.map((b) => <option key={b.batch_id} value={b.batch_id}>{b.batch_name}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="bp-select">
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
              <option value="">All Statuses</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <button
            type="button"
            className="bp-btn outline small"
            onClick={() => { setSearch(""); setBatch(""); setStatus(""); setPage(1); }}
            title="Clear filters"
            aria-label="Clear filters"
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>

        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr>
                <th>Student Profile</th>
                <th>Course / Batch</th>
                <th>Joined Date</th>
                <th>Attendance</th>
                <th>Fee Status</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr className="bp-empty-row"><td colSpan={7}>No students match these filters.</td></tr>
              ) : (
                shown.map((s, i) => (
                  <tr key={s.person_id} style={{ "--row": i }}>
                    <td>
                      <div className="bp-person">
                        <span className={`bp-avatar t${i % 4}`}>
                          {s.photo_url ? <img src={s.photo_url} alt="" /> : initialsOf(s.name)}
                        </span>
                        <div>
                          <p className="bp-person-name">{s.name}</p>
                          <p className="bp-person-sub">{s.email || s.phone || "—"} • #{s.student_code}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="bp-strong" style={{ margin: 0 }}>{s.course_name || "—"}</p>
                      <p className="bp-person-sub">{s.batch_name || "Not enrolled"}</p>
                    </td>
                    <td className="bp-muted">{fmtDate(s.joined_date)}</td>
                    <td>
                      {s.attendance_percent == null ? (
                        <span className="bp-muted">—</span>
                      ) : (
                        <div className="bp-att">
                          <div className="bp-meter">
                            <span className={s.attendance_percent < 85 ? "orange" : ""} style={{ width: `${s.attendance_percent}%` }} />
                          </div>
                          <b>{s.attendance_percent}%</b>
                        </div>
                      )}
                    </td>
                    <td><FeeStatus s={s} /></td>
                    <td><span className={`bp-chip ${STATUS_TONE[s.status] || "gray"}`}>{s.status}</span></td>
                    <td><Link to={`/training/students/${s.person_id}`} className="bp-btn soft small">View Profile</Link></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bp-pager">
          <span>
            Showing <b>{filtered.length ? (current - 1) * PAGE_SIZE + 1 : 0}</b> to{" "}
            <b>{Math.min(current * PAGE_SIZE, filtered.length)}</b> of <b>{filtered.length}</b> students
          </span>
          <div className="bp-pages">
            <button type="button" className="bp-page-btn" disabled={current === 1} onClick={() => setPage(current - 1)}>‹ Previous</button>
            {pageNumbers.map((p, i) => (p === "…"
              ? <span key={`gap-${i}`}>…</span>
              : (
                <button key={p} type="button" className={`bp-page-btn ${p === current ? "active" : ""}`} onClick={() => setPage(p)}>
                  {p}
                </button>
              )))}
            <button type="button" className="bp-page-btn" disabled={current === pages} onClick={() => setPage(current + 1)}>Next ›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AllStudentsList;
