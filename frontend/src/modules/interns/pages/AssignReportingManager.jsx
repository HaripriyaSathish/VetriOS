import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  UserRoundX, UsersRound, Gauge, Search, ChevronDown, Clock3, TriangleAlert, CircleCheck, Info, FolderKanban,
} from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/AssignManager.css";

const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const fmtDate = (d) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function AssignReportingManager() {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selection, setSelection] = useState({});
  const [saving, setSaving] = useState(null);
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("");
  const [view, setView] = useState("all");

  const load = () =>
    client.get("/api/training/business/manager-assignment/")
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load interns."));

  useEffect(() => {
    load();
    client.get("/api/projects/users-lookup/").then(({ data }) => setUsers(data || [])).catch(() => {});
  }, []);

  const assign = async (internId) => {
    const managerId = selection[internId];
    if (!managerId) {
      setError("Select a manager first.");
      return;
    }
    setSaving(internId);
    setError("");
    setMessage("");
    try {
      await client.post(`/api/interns/${internId}/assign-manager/`, { manager_user_id: managerId });
      setMessage("Reporting manager assigned.");
      setSelection((prev) => ({ ...prev, [internId]: "" }));
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't assign manager.");
    } finally {
      setSaving(null);
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.interns.filter((i) => {
      if (view === "unassigned" && i.manager_user_id) return false;
      if (domain && i.course_name !== domain) return false;
      if (!q) return true;
      return [i.name, i.intern_code, i.email, i.batch_name, i.manager_name].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [data, search, domain, view]);

  if (!data && !error) return <p className="bp-loading">Loading interns…</p>;
  if (!data) return <p className="bp-error">{error}</p>;

  const st = data.stats;
  const domains = [...new Set(data.interns.map((i) => i.course_name).filter(Boolean))];
  const maxLoad = Math.max(1, ...data.managers.map((m) => m.count));

  return (
    <div className="bp-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Workforce Allocation › <span>Manager Mapping</span></p>
          <h1 className="bp-title">Assign Reporting Manager</h1>
          <p className="bp-sub">Pair interns with the employee they report to. This drives who can submit their testing reports and performance reviews.</p>
        </div>
      </div>

      {error && <p className="bp-error">{error}</p>}
      {message && <p className="bp-notice">{message}</p>}

      <div className="bp-stats">
        <div className="bp-stat am-glow orange" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label"><span className="bp-stat-icon orange am-inline"><UserRoundX size={15} /></span> Unassigned Interns</p>
            {st.unassigned > 0 && <span className="bp-chip red">Needs action</span>}
          </div>
          <p className="bp-stat-value">{st.unassigned} <small className="am-small">interns awaiting a manager</small></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label"><span className="bp-stat-icon am-inline"><UsersRound size={15} /></span> Active Reporting Managers</p>
            <span className="bp-chip blue">{users.length} available</span>
          </div>
          <p className="bp-stat-value">{st.active_managers} <small className="am-small">managing {st.interns - st.unassigned} intern{st.interns - st.unassigned === 1 ? "" : "s"}</small></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label"><span className="bp-stat-icon green am-inline"><Gauge size={15} /></span> Mentorship Ratio</p>
            {st.ratio != null && <span className={`bp-chip ${st.ratio <= 4 ? "green" : "orange"}`}>{st.ratio <= 4 ? "Healthy" : "Stretched"}</span>}
          </div>
          <p className="bp-stat-value">{st.ratio != null ? `1 : ${st.ratio}` : "—"} <small className="am-small">interns per manager</small></p>
        </div>
      </div>

      <div className="bp-panel">
        <div className="bp-filters">
          <label className="bp-search">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search interns or managers..." aria-label="Search interns" />
          </label>
          <div className="bp-tabs">
            <button type="button" className={`bp-tab ${domain === "" ? "active" : ""}`} onClick={() => setDomain("")}>All Domains</button>
            {domains.map((d) => (
              <button key={d} type="button" className={`bp-tab ${domain === d ? "active" : ""}`} onClick={() => setDomain(d)}>{d}</button>
            ))}
          </div>
          <div className="bp-tabs">
            <button type="button" className={`bp-tab ${view === "all" ? "active" : ""}`} onClick={() => setView("all")}>All</button>
            <button type="button" className={`bp-tab ${view === "unassigned" ? "active" : ""}`} onClick={() => setView("unassigned")}>
              Unassigned <small>({st.unassigned})</small>
            </button>
          </div>
        </div>

        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr>
                <th>Intern Profile</th>
                <th>Domain</th>
                <th>Cohort / Batch</th>
                <th>Allocated Project</th>
                <th>Assign Manager</th>
                <th>Status / SLA</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr className="bp-empty-row"><td colSpan={7}>{data.interns.length === 0 ? "No active interns found." : "No interns match."}</td></tr>
              ) : filtered.map((i, idx) => {
                const waiting = !i.manager_user_id && i.days_since_start != null;
                const late = waiting && i.days_since_start > 2;
                return (
                  <tr key={i.intern_id} style={{ "--row": idx }}>
                    <td>
                      <div className="bp-person">
                        <span className={`bp-avatar t${idx % 4}`}>{initialsOf(i.name)}</span>
                        <div>
                          <Link to={`/training/students/${i.person_id}`} className="bp-person-name am-name">{i.name}</Link>
                          <p className="bp-person-sub">#{i.intern_code}{i.email ? ` · ${i.email}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="bp-strong">{i.course_name || "—"}</td>
                    <td><span className="am-batch"><span className="am-dot" /> {i.batch_name || "—"}</span></td>
                    <td>
                      {i.project_name
                        ? <span className="am-project"><FolderKanban size={12} /> {i.project_name}</span>
                        : <span className="bp-muted">Not allocated</span>}
                    </td>
                    <td>
                      <label className="bp-select am-select">
                        <select
                          value={selection[i.intern_id] ?? ""}
                          onChange={(e) => setSelection((prev) => ({ ...prev, [i.intern_id]: e.target.value }))}
                          aria-label={`Manager for ${i.name}`}
                        >
                          <option value="">{i.manager_name ? `${i.manager_name} (current)` : "Select Manager"}</option>
                          {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
                        </select>
                        <ChevronDown size={14} />
                      </label>
                    </td>
                    <td>
                      {i.manager_user_id ? (
                        <span className="bp-chip green"><CircleCheck size={11} /> Since {fmtDate(i.assigned_since)}</span>
                      ) : waiting ? (
                        <span className={`bp-chip ${late ? "red" : "blue"}`}>
                          {late ? <TriangleAlert size={11} /> : <Clock3 size={11} />} {i.days_since_start}d waiting
                        </span>
                      ) : <span className="bp-chip gray">Unassigned</span>}
                    </td>
                    <td>
                      <button type="button" className="bp-btn navy small" disabled={saving === i.intern_id || !selection[i.intern_id]} onClick={() => assign(i.intern_id)}>
                        {saving === i.intern_id ? "Saving…" : i.manager_user_id ? "Reassign" : "Confirm Assignment"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bp-pager">
          <span className="am-note"><Info size={13} /> Changing a manager closes the old assignment and starts a new one from today.</span>
          <span>Showing <b>{filtered.length}</b> of <b>{data.interns.length}</b> interns</span>
        </div>
      </div>

      <div className="am-capacity-head">
        <h3>Manager Mentorship Load</h3>
        <span className="bp-chip blue">{data.managers.length} active manager{data.managers.length === 1 ? "" : "s"}</span>
      </div>
      {data.managers.length === 0 ? (
        <p className="bp-muted">No manager has interns assigned yet.</p>
      ) : (
        <div className="am-capacity">
          {data.managers.map((m, idx) => (
            <div key={m.user_id} className="am-mentor" style={{ "--i": idx }}>
              <div className="am-mentor-top">
                <span className={`bp-avatar t${idx % 4}`}>{initialsOf(m.name)}</span>
                <div>
                  <p className="bp-person-name">{m.name}</p>
                  <p className="bp-person-sub">{m.count} intern{m.count === 1 ? "" : "s"} reporting</p>
                </div>
                <span className={`bp-chip ${m.count >= 4 ? "orange" : "green"}`}>{m.count >= 4 ? "Heavy load" : "Available"}</span>
              </div>
              <div className="am-load"><span>Intern load</span><b>{m.count}</b></div>
              <div className="bp-meter"><span className={m.count >= 4 ? "orange" : ""} style={{ width: `${(m.count / maxLoad) * 100}%` }} /></div>
              <p className="am-names">{m.interns.join(", ")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AssignReportingManager;
