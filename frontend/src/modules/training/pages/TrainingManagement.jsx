import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BookOpen, GraduationCap, Pencil, Plus, Search, UserRound, Users, ClipboardList, ChevronDown,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/TrainerDashboard.css";
import "../styles/TrainingBatches.css";

const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const initials = (name) => (name || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
const STATUS_CHIP = { ACTIVE: "green", PLANNED: "blue", UPCOMING: "blue", COMPLETED: "gray", CANCELLED: "red", ON_HOLD: "orange" };

function TrainingManagement() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "trainers" ? "trainers" : "batches");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    client.get("/api/training/management/overview/")
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load Training Management."));
  }, []);

  const statuses = useMemo(() => [...new Set((data?.batches || []).map((b) => b.status).filter(Boolean))], [data]);

  const batches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.batches || []).filter((b) =>
      (status === "all" || b.status === status) &&
      (!q || [b.batch_name, b.course_name, b.trainer_name].some((v) => (v || "").toLowerCase().includes(q))));
  }, [data, search, status]);

  const trainers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.trainers || []).filter((t) =>
      !q || [t.trainer_name, t.email, t.specialization].some((v) => (v || "").toLowerCase().includes(q)));
  }, [data, search]);

  if (error) return <p className="bp-error">{error}</p>;
  if (!data) return <p className="bp-loading">Loading…</p>;

  const activeBatches = data.batches.filter((b) => b.status === "ACTIVE").length;
  const activeTrainers = data.trainers.filter((t) => t.is_active).length;
  const unassigned = data.batches.filter((b) => !b.trainer_name).length;

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Business Team / <span>Training Management</span></p>
          <h1 className="bp-title">Training Management</h1>
          <p className="bp-sub">Every batch and trainer across the academy — schedule cohorts, assign trainers and track enrolment.</p>
        </div>
        <div className="bp-actions">
          {data.is_business_team && (
            <Link to="/training/enquiries" className="bp-btn outline"><ClipboardList size={16} /> Enquiries</Link>
          )}
          {data.can_create && (
            <Link to="/training/batches/new" className="bp-btn orange"><Plus size={16} /> New Batch</Link>
          )}
        </div>
      </div>

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label tb-label">TOTAL BATCHES</p>
            <span className="tb-stat-icon navy"><GraduationCap size={20} /></span>
          </div>
          <p className="bp-stat-value">{data.total_batches}</p>
          <p className="tb-foot">
            <span className="bp-chip green">{activeBatches} active</span>
            {unassigned > 0 && <span className="bp-chip orange">{unassigned} unassigned</span>}
          </p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label tb-label">TRAINERS</p>
            <span className="tb-stat-icon blue"><UserRound size={20} /></span>
          </div>
          <p className="bp-stat-value">{data.total_trainers}</p>
          <p className="tb-foot"><span className="bp-chip blue">{activeTrainers} active</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label tb-label">STUDENTS</p>
            <span className="tb-stat-icon orange"><Users size={20} /></span>
          </div>
          <p className="bp-stat-value tr-orange">{data.total_students}</p>
          <p className="tr-stat-sub">Enrolled across all batches</p>
        </div>
      </div>

      <div className="bp-panel tb-toolbar">
        <div className="bp-tabs">
          <button type="button" className={`bp-tab ${tab === "batches" ? "active" : ""}`} onClick={() => setTab("batches")}>
            All Batches <small>({data.batches.length})</small>
          </button>
          <button type="button" className={`bp-tab ${tab === "trainers" ? "active" : ""}`} onClick={() => setTab("trainers")}>
            All Trainers <small>({data.trainers.length})</small>
          </button>
        </div>
        <div className="tb-toolbar-right">
          <label className="bp-search">
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "batches" ? "Search batch, course or trainer…" : "Search trainer, email or skill…"}
            />
          </label>
          {tab === "batches" && (
            <label className="bp-select">
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All statuses</option>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={14} />
            </label>
          )}
        </div>
      </div>

      <section className="bp-panel">
        <div className="bp-table-wrap">
          {tab === "batches" ? (
            <table className="bp-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Trainer</th>
                  <th>Start Date</th>
                  <th>Status</th>
                  <th>Students</th>
                  {data.can_edit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr className="bp-empty-row">
                    <td colSpan={data.can_edit ? 6 : 5}>{data.batches.length ? "No batches match your filters." : "No batches yet."}</td>
                  </tr>
                ) : batches.map((b, i) => (
                  <tr key={b.batch_id} style={{ "--row": i }}>
                    <td>
                      <div className="bp-person">
                        <span className="tb-stat-icon navy tm-ico"><BookOpen size={16} /></span>
                        <div>
                          <Link to={`/training/batches/${b.batch_id}`} className="bp-person-name tm-link">{b.batch_name}</Link>
                          <p className="bp-person-sub">{b.course_name}</p>
                        </div>
                      </div>
                    </td>
                    <td>{b.trainer_name ? <span className="bp-strong">{b.trainer_name}</span> : <span className="bp-chip orange">Unassigned</span>}</td>
                    <td className="bp-muted">{fmt(b.start_date)}</td>
                    <td><span className={`bp-chip ${STATUS_CHIP[b.status] || "blue"}`}>{b.status}</span></td>
                    <td className="bp-strong">{b.students_enrolled}</td>
                    {data.can_edit && (
                      <td>
                        <Link to={`/training/batches/${b.batch_id}/edit`} className="bp-btn outline small"><Pencil size={12} /> Edit</Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="bp-table">
              <thead>
                <tr>
                  <th>Trainer</th>
                  <th>Specialization</th>
                  <th>Batches</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {trainers.length === 0 ? (
                  <tr className="bp-empty-row">
                    <td colSpan={4}>{data.trainers.length ? "No trainers match your search." : "No trainers yet."}</td>
                  </tr>
                ) : trainers.map((t, i) => (
                  <tr key={t.trainer_id} style={{ "--row": i }}>
                    <td>
                      <div className="bp-person">
                        <span className={`bp-avatar t${(i % 3) + 1}`}>{initials(t.trainer_name)}</span>
                        <div>
                          <Link to={`/training/management/trainers/${t.trainer_id}`} className="bp-person-name tm-link" title="View this trainer's batches and progress">{t.trainer_name}</Link>
                          <p className="bp-person-sub">{t.email || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td>{t.specialization || <span className="bp-muted">—</span>}</td>
                    <td className="bp-strong">{t.batch_count}</td>
                    <td><span className={`bp-chip ${t.is_active ? "green" : "gray"}`}>{t.is_active ? "Active" : "Inactive"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default TrainingManagement;
