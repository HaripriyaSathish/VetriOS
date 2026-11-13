import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Briefcase, CalendarDays, Check, Clock, House, Send, UserRound } from "lucide-react";
import client from "../../../api/client";
import Breadcrumbs from "../../../components/Breadcrumbs";
import "../../student/styles/StudentDashboard.css";
import "../styles/Attendance.css";
import "../../identity-access/styles/UserAccounts.css";
import "../styles/LeaveRequest.css";

const KINDS = [
  { key: "LEAVE", label: "Leave", desc: "Casual, sick, earned and other leave", Icon: CalendarDays },
  { key: "PERMISSION", label: "Hourly permission", desc: "A few hours within a working day", Icon: Clock },
  { key: "WFH", label: "Work from home", desc: "Whole days, for offline employees", Icon: House },
  { key: "ON_DUTY", label: "On duty", desc: "Travel, a program or an exhibition", Icon: Briefcase },
];
const CATEGORIES = ["HR Administrator", "System Administrator", "Business Team"];

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const workingDays = (a, b) => {
  let n = 0;
  for (let d = new Date(`${a}T00:00:00`); a && b && d <= new Date(`${b}T00:00:00`); d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0) n += 1; // Sunday is a holiday
  }
  return n;
};
const hoursBetween = (from, to) => {
  if (!from || !to || to <= from) return 0;
  const [h1, m1] = from.split(":").map(Number);
  const [h2, m2] = to.split(":").map(Number);
  return (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
};
const fmtHours = (h) => (Number.isInteger(h) ? `${h} h` : `${Math.round(h * 100) / 100} h`);

// Full-page "New request": leave, hourly permission, work from home or on duty,
// sent to an approver you pick (role first, then the person).
function NewLeaveRequest() {
  const navigate = useNavigate();
  // Opened from Leave management (HR / System Admin) or from Apply Leave (employees):
  // go back to whichever page it came from.
  const backTo = useLocation().state?.from || "/my/leave";
  const backLabel = backTo === "/hr/leave" ? "Leave management" : "Apply leave";
  const me = JSON.parse(localStorage.getItem("user") || "null");

  const [info, setInfo] = useState(null); // /leave/me/ (balances + options)
  const [types, setTypes] = useState([]);
  const [kind, setKind] = useState("LEAVE");
  const [form, setForm] = useState({
    leave_type_id: "", start_date: "", end_date: "", date: todayIso(), from_time: "", to_time: "", on_duty_reason: "", reason: "",
  });
  const [category, setCategory] = useState("HR Administrator");
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [approverId, setApproverId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([client.get("/api/hr/leave/me/"), client.get("/api/hr/leave/types/")])
      .then(([m, t]) => {
        setInfo(m.data);
        setTypes(t.data);
      })
      .catch(() => setError("Couldn't load your leave details."));
  }, []);

  useEffect(() => {
    setPeopleLoading(true);
    setApproverId("");
    client
      .get("/api/identity/admins/", { params: { category } })
      .then(({ data }) => {
        const list = data.filter((p) => p.user_id !== me?.user_id);
        setPeople(list);
        if (list.length === 1) setApproverId(String(list[0].user_id));
      })
      .catch(() => setPeople([]))
      .finally(() => setPeopleLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const options = info?.options;
  const canWfh = options?.can_wfh;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const permHours = hoursBetween(form.from_time, form.to_time);
  const perm = options?.permission;
  const approver = people.find((p) => String(p.user_id) === String(approverId));
  const chosenType = types.find((t) => String(t.leave_type_id) === String(form.leave_type_id));
  const balance = (info?.my_balances || []).find((b) => String(b.leave_type_id) === String(form.leave_type_id));

  const length = useMemo(() => {
    if (kind === "PERMISSION") return permHours ? fmtHours(permHours) : "—";
    if (kind === "LEAVE") {
      const n = workingDays(form.start_date, form.end_date || form.start_date);
      return n ? `${n} ${n === 1 ? "day" : "days"}` : "—";
    }
    const n = workingDays(form.start_date, form.end_date || form.start_date);
    return n ? `${n} working ${n === 1 ? "day" : "days"}` : "—";
  }, [kind, form, permHours]);

  const when =
    kind === "PERMISSION"
      ? form.date && form.from_time && form.to_time
        ? `${fmtDate(form.date)}, ${form.from_time}–${form.to_time}`
        : "—"
      : form.start_date
        ? form.end_date && form.end_date !== form.start_date
          ? `${fmtDate(form.start_date)} – ${fmtDate(form.end_date)}`
          : fmtDate(form.start_date)
        : "—";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!approverId) {
      setError("Choose the person this request goes to.");
      return;
    }
    const body = { request_kind: kind, reason: form.reason, approver_category: category, approver_user_id: Number(approverId) };
    if (kind === "LEAVE") Object.assign(body, { leave_type_id: Number(form.leave_type_id), start_date: form.start_date, end_date: form.end_date || form.start_date });
    if (kind === "PERMISSION") Object.assign(body, { date: form.date, from_time: form.from_time, to_time: form.to_time });
    if (kind === "WFH") Object.assign(body, { start_date: form.start_date, end_date: form.end_date || form.start_date });
    if (kind === "ON_DUTY")
      Object.assign(body, { start_date: form.start_date, end_date: form.end_date || form.start_date, on_duty_reason: form.on_duty_reason });
    setSubmitting(true);
    try {
      await client.post("/api/hr/leave/requests/", body);
      navigate(backTo);
    } catch (err) {
      const d = err.response?.data;
      const first = d && Object.values(d)[0];
      setError(d?.detail || (Array.isArray(first) ? first[0] : "Something went wrong."));
      setSubmitting(false);
    }
  };

  return (
    <div className="lq-page">
      <Breadcrumbs items={[{ label: backLabel, to: backTo }, { label: "New request" }]} />
      <div className="lq-head">
        <h1>New request</h1>
        <p>Leave, hourly permission, work from home or on duty — pick who it goes to</p>
      </div>

      <div className="lq-layout">
        <form className="lq-form" onSubmit={submit}>
          <section className="na-card">
            <h3><span className="na-n">1</span>What are you requesting?</h3>
            <div className="lq-kinds">
              {KINDS.map(({ key, label, desc, Icon }) => {
                const disabled = key === "WFH" && info && !canWfh;
                return (
                  <button
                    type="button"
                    key={key}
                    className={"lq-kind" + (kind === key ? " on" : "")}
                    disabled={disabled}
                    onClick={() => setKind(key)}
                    title={disabled ? "Work from home is for offline employees (those who work from a branch)" : undefined}
                  >
                    <span className="lq-kind-ic"><Icon size={20} /></span>
                    <b>{label}</b>
                    <small>{disabled ? "Offline employees only" : desc}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="na-card lq-details">
            <h3><span className="na-n">2</span>Details</h3>

            {kind === "LEAVE" && (
              <>
                <label>Leave type</label>
                <select value={form.leave_type_id} onChange={(e) => set({ leave_type_id: e.target.value })} required>
                  <option value="">Select…</option>
                  {types.map((t) => (
                    <option key={t.leave_type_id} value={t.leave_type_id}>{t.leave_type_name}</option>
                  ))}
                </select>
              </>
            )}

            {kind === "ON_DUTY" && (
              <>
                <label>Reason for being on duty</label>
                <select value={form.on_duty_reason} onChange={(e) => set({ on_duty_reason: e.target.value })} required>
                  <option value="">Select…</option>
                  {(options?.on_duty_reasons || []).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </>
            )}

            {kind === "PERMISSION" ? (
              <>
                <div className="lq-row">
                  <div>
                    <label>Date</label>
                    <input type="date" min={todayIso()} value={form.date} onChange={(e) => set({ date: e.target.value })} required />
                  </div>
                  <div>
                    <label>From</label>
                    <input type="time" value={form.from_time} onChange={(e) => set({ from_time: e.target.value })} required />
                  </div>
                  <div>
                    <label>To</label>
                    <input type="time" value={form.to_time} onChange={(e) => set({ to_time: e.target.value })} required />
                  </div>
                </div>
                {permHours > 0 && <span className="lq-chip">{fmtHours(permHours)}</span>}
              </>
            ) : (
              <div className="lq-row two">
                <div>
                  <label>{kind === "LEAVE" ? "Start date" : "From"}</label>
                  <input
                    type="date"
                    min={kind === "LEAVE" ? undefined : todayIso()}
                    value={form.start_date}
                    onChange={(e) => set({ start_date: e.target.value, end_date: form.end_date && form.end_date < e.target.value ? e.target.value : form.end_date })}
                    required
                  />
                </div>
                <div>
                  <label>{kind === "LEAVE" ? "End date (optional)" : "To (optional)"}</label>
                  <input
                    type="date"
                    min={form.start_date || undefined}
                    value={form.end_date}
                    onChange={(e) => set({ end_date: e.target.value })}
                  />
                </div>
              </div>
            )}

            <p className="ua-perm-hint">
              Only need one day? Pick the start date and leave the end date empty. Sundays and holidays aren't counted.
            </p>

            <label>{kind === "ON_DUTY" ? "Details (optional)" : "Reason (optional)"}</label>
            <textarea rows={3} value={form.reason} onChange={(e) => set({ reason: e.target.value })} />
          </section>

          <section className="na-card">
            <h3><span className="na-n">3</span>Send to</h3>
            <label>Role</label>
            <div className="ua2-chips">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={"ua2-chip" + (category === c ? " on" : "")}
                  onClick={() => setCategory(c)}
                >
                  {category === c && <Check size={14} />}
                  {c}
                </button>
              ))}
            </div>
            <label>Person</label>
            <select value={approverId} onChange={(e) => setApproverId(e.target.value)} required disabled={peopleLoading || people.length === 0}>
              <option value="">{peopleLoading ? "Loading…" : people.length ? "Select a person…" : `No active ${category} to send to`}</option>
              {people.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
            </select>
          </section>

          {error && <p className="ua-error">{error}</p>}

          <div className="na-actions">
            <button type="button" className="ua-btn-sm" onClick={() => navigate(backTo)}>Cancel</button>
            <button type="submit" className="ua-btn-accent" disabled={submitting || !info?.employee_id}>
              <Send size={16} /> {submitting ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>

        <aside className="na-summary lq-summary">
          <div className="na-sum-head">
            <span className="lq-sum-ic">{(() => { const K = KINDS.find((k) => k.key === kind).Icon; return <K size={26} />; })()}</span>
            <b>{KINDS.find((k) => k.key === kind).label}</b>
            <small>{kind === "LEAVE" && chosenType ? chosenType.leave_type_name : "Request summary"}</small>
          </div>
          <div className="na-sum-body">
            <div className="na-sum-row inline"><span className="na-sum-lab">When</span><b>{when}</b></div>
            <div className="na-sum-row inline"><span className="na-sum-lab">Length</span><b>{length}</b></div>
            <div className="na-sum-row inline">
              <span className="na-sum-lab"><UserRound size={15} /> Sent to</span>
              <b>{approver ? approver.full_name : "—"}</b>
            </div>
            <div className="na-sum-row inline"><span className="na-sum-lab">Role</span><b>{category}</b></div>
          </div>
          {kind === "PERMISSION" && perm && (
            <div className="na-sum-check">
              <div className="na-sum-progress"><span>Permission this month</span><b>{fmtHours(perm.used_hours + permHours)} of {fmtHours(perm.limit_hours)}</b></div>
              <div className="na-bar">
                <i style={{ width: `${Math.min(100, ((perm.used_hours + permHours) / (perm.limit_hours || 1)) * 100)}%` }} />
              </div>
              <small className="lq-note">
                {perm.used_hours + permHours > perm.limit_hours
                  ? "This is more than your monthly limit — it will be refused."
                  : `${fmtHours(Math.max(perm.left_hours - permHours, 0))} left after this request.`}
              </small>
            </div>
          )}
          {kind === "LEAVE" && balance && (
            <div className="na-sum-check">
              <div className="na-sum-progress"><span>{balance.leave_type_name} balance</span><b>{balance.remaining_days} days left</b></div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default NewLeaveRequest;
