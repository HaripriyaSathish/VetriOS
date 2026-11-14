import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  CalendarDays,
  CalendarOff,
  History,
  MapPin,
  Palmtree,
  Search,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import client from "../../../api/client";
import Breadcrumbs from "../../../components/Breadcrumbs";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import "../styles/EmployeesHistory.css";

const RANGES = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 0, label: "All time" },
];
const TYPES = [
  { key: "", label: "All" },
  { key: "Employee", label: "Employees" },
  { key: "Leave", label: "Leave" },
  { key: "Holiday", label: "Holidays" },
];
const TYPE_ICON = { Employee: Users, Leave: CalendarOff, Holiday: Palmtree };
const KIND_ICON = { joined: UserPlus, department: Building2, branch: MapPin, promotion: TrendingUp };

const initials = (name) =>
  String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const dayKey = (iso) => new Date(iso).toDateString();
function dayHeading(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

function tenure(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(`${iso}T00:00:00`)) / 86400000);
  if (days < 0) return "Not started";
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"}`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} yr ${m} mo` : `${y} ${y === 1 ? "year" : "years"}`;
}

// HR Admin > History. Two tabs: an activity log (who did what) and one
// employee's job timeline.
function EmployeesHistory() {
  const [tab, setTab] = useState("activity");

  return (
    <div className="eh-page">
      <Breadcrumbs
        items={[
          { label: "HR Admin", to: "/hr", icon: Briefcase },
          { label: "Employees history" },
        ]}
      />
      <div className="eh-hero">
        <div className="eh-hero-row">
          <span className="eh-hero-ic"><History size={26} /></span>
          <div>
            <h1>Employees history</h1>
            <p>See what changed, and who changed it</p>
          </div>
        </div>
        <div className="eh-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "activity"} className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>
            <History size={16} /> Activity log
          </button>
          <button type="button" role="tab" aria-selected={tab === "timeline"} className={tab === "timeline" ? "on" : ""} onClick={() => setTab("timeline")}>
            <CalendarDays size={16} /> Employee timeline
          </button>
        </div>
      </div>

      {tab === "activity" ? <ActivityLog /> : <EmployeeTimeline />}
    </div>
  );
}

function ActivityLog() {
  const [days, setDays] = useState(30);
  const [type, setType] = useState("");
  const [actor, setActor] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState({ results: [], actors: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // wait a moment after typing before asking the server
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let live = true;
    client
      .get("/api/hr/history/activity/", { params: { days, type, actor, q: query } })
      .then(({ data: d }) => {
        if (!live) return;
        setData(d);
        setError("");
      })
      .catch(() => live && setError("Couldn't load the activity log."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [days, type, actor, query]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const r of data.results) {
      const k = dayKey(r.time);
      if (!map.has(k)) map.set(k, { heading: dayHeading(r.time), items: [] });
      map.get(k).items.push(r);
    }
    return [...map.values()];
  }, [data.results]);

  return (
    <section className="eh-card">
      <div className="eh-filters">
        <label className="eh-search">
          <Search size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a name or action" />
        </label>
        <select value={actor} onChange={(e) => { setLoading(true); setActor(e.target.value); }} aria-label="Done by">
          <option value="">Done by: everyone</option>
          {data.actors.map((a) => (
            <option key={a.user_id} value={a.user_id}>{a.name}</option>
          ))}
        </select>
      </div>
      <div className="eh-chiprow">
        <div className="eh-chips">
          {TYPES.map((t) => (
            <button key={t.key} type="button" className={type === t.key ? "on" : ""} onClick={() => { setLoading(true); setType(t.key); }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="eh-chips alt">
          {RANGES.map((r) => (
            <button key={r.days} type="button" className={days === r.days ? "on" : ""} onClick={() => { setLoading(true); setDays(r.days); }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="eh-error">{error}</p>}
      {loading && !data.results.length && <p className="eh-empty">Loading…</p>}
      {!loading && !error && groups.length === 0 && (
        <div className="eh-empty-card">
          <History size={30} />
          <b>Nothing here yet</b>
          <p>
            Actions are recorded from now on, so this fills up as HR creates employees, decides leave or changes holidays.
            Try a longer time range if you've filtered.
          </p>
        </div>
      )}

      {groups.map((g) => (
        <div className="eh-day" key={g.heading}>
          <h3>{g.heading}</h3>
          {g.items.map((r) => {
            const Icon = TYPE_ICON[r.type] || History;
            return (
              <div className="eh-item" key={r.id}>
                <span className={`eh-badge t-${r.type.toLowerCase()}`}><Icon size={17} /></span>
                <div className="eh-item-body">
                  <div className="eh-line">
                    <span className="eh-who">
                      {r.actor_person_id ? <EmployeeAvatar personId={r.actor_person_id} size={22} version={0} /> : <i className="eh-ini">{initials(r.actor_name)}</i>}
                      <b>{r.actor_name}</b>
                    </span>{" "}
                    {r.text}
                  </div>
                  {r.detail && <div className="eh-detail">{r.detail}</div>}
                </div>
                <div className="eh-meta">
                  <span className={`eh-tag t-${r.type.toLowerCase()}`}>{r.type === "Employee" ? "Employee" : r.type}</span>
                  <small>{timeOf(r.time)}</small>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}

function EmployeeTimeline() {
  const [employees, setEmployees] = useState([]);
  const [find, setFind] = useState("");
  const [picked, setPicked] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    client
      .get("/api/hr/employees/")
      .then(({ data: d }) => setEmployees([...d].sort((a, b) => a.full_name.localeCompare(b.full_name))))
      .catch(() => setError("Couldn't load the employees."));
  }, []);

  const shown = useMemo(() => {
    const q = find.trim().toLowerCase();
    return employees.filter((e) => !q || `${e.full_name} ${e.employee_code || ""}`.toLowerCase().includes(q)).slice(0, 8);
  }, [employees, find]);

  const choose = (e) => {
    setPicked(String(e.employee_id));
    setFind(e.full_name);
    setLoading(true);
    setError("");
    client
      .get(`/api/hr/history/employee/${e.employee_id}/`)
      .then(({ data: d }) => setData(d))
      .catch(() => setError("Couldn't load this employee's history."))
      .finally(() => setLoading(false));
  };

  const emp = data?.employee;

  return (
    <section className="eh-card">
      <div className="eh-pick">
        <label className="eh-search wide">
          <Search size={16} />
          <input
            value={find}
            onChange={(e) => { setFind(e.target.value); setPicked(""); }}
            placeholder="Type an employee's name or code"
            aria-label="Choose employee"
          />
        </label>
        {find && !picked && (
          <ul className="eh-suggest">
            {shown.length === 0 && <li className="none">{employees.length ? `No one matches “${find}”.` : "Loading employees…"}</li>}
            {shown.map((e) => (
              <li key={e.employee_id}>
                <button type="button" onClick={() => choose(e)}>
                  <EmployeeAvatar personId={e.person_id} size={30} version={0} />
                  <span><b>{e.full_name}</b><small>{e.employee_code} · {e.designation_name || "No designation"}</small></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="eh-error">{error}</p>}
      {loading && <p className="eh-empty">Loading…</p>}

      {!emp && !loading && (
        <div className="eh-empty-card">
          <CalendarDays size={30} />
          <b>Choose an employee</b>
          <p>Search above to see their joining date, department and branch changes, and promotions in one timeline.</p>
        </div>
      )}

      {emp && !loading && (
        <>
          <div className="eh-profile">
            <EmployeeAvatar personId={emp.person_id} size={58} version={0} />
            <div className="eh-profile-info">
              <h2>{emp.full_name}</h2>
              <p>{[emp.employee_code, emp.designation].filter(Boolean).join(" · ")}</p>
              <div className="eh-pills">
                {emp.department && <span><Building2 size={13} /> {emp.department}</span>}
                {emp.branch && <span><MapPin size={13} /> {emp.branch}</span>}
                <span><CalendarDays size={13} /> With us {tenure(emp.joining_date)}</span>
              </div>
            </div>
          </div>

          <ol className="eh-timeline">
            {data.events.map((ev, i) => {
              const Icon = KIND_ICON[ev.kind] || History;
              return (
                <li key={`${ev.kind}-${i}`} className={`k-${ev.kind}`}>
                  <span className="eh-dot"><Icon size={15} /></span>
                  <div className="eh-tl-body">
                    <b>{ev.title}</b>
                    {ev.detail && <p>{ev.detail}</p>}
                  </div>
                  <time>{fmtDate(ev.date)}</time>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}

export default EmployeesHistory;
