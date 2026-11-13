import { useEffect, useState } from "react";
import { Check, ExternalLink, Info, Navigation, Plus, Save, Trash2, Users, UsersRound } from "lucide-react";
import client from "../../../api/client";
import "../../student/styles/StudentDashboard.css";
import "../../hr/styles/Attendance.css";
import "../styles/UserAccounts.css";

const GROUP_LABEL = { EMPLOYEE: "Employees", INTERN: "Interns" };
const EMPTY_HOLIDAY = { date: "", name: "", type: "HOLIDAY" };
const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

// System Administrator: "Leave & attendance settings" — leave days per year for
// employees and interns, permission hours per month, and each branch's
// check-in location (used for offline employees' location-based check-in).
function LeaveSettings() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [applyYear, setApplyYear] = useState(String(new Date().getFullYear()));
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState("");
  const [geoMsg, setGeoMsg] = useState({});
  const [holiday, setHoliday] = useState(EMPTY_HOLIDAY);
  const [holidayErr, setHolidayErr] = useState("");
  const [holidayBusy, setHolidayBusy] = useState(false);

  useEffect(() => {
    client
      .get("/api/identity/leave-attendance-settings/")
      .then(({ data: d }) => setData(d))
      .catch(() => setError("Couldn't load the settings."));
  }, []);

  const setAllowance = (group, code, value) =>
    setData((d) => ({ ...d, leave_allowance: { ...d.leave_allowance, [group]: { ...d.leave_allowance[group], [code]: value } } }));
  const setBranch = (id, patch) =>
    setData((d) => ({ ...d, branches: d.branches.map((b) => (b.branch_id === id ? { ...b, ...patch } : b)) }));

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const { data: d } = await client.put("/api/identity/leave-attendance-settings/", data);
      setData(d);
      setSaved("Settings saved.");
      return true;
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't save the settings.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const applyToEveryone = async () => {
    setApplyMsg("");
    if (!(await save())) return;
    setApplying(true);
    try {
      const { data: preview } = await client.post("/api/identity/leave-attendance-settings/apply-leave/", {
        year: Number(applyYear),
        dry_run: true,
      });
      const ok = window.confirm(
        `Apply these leave days to ${preview.employees} people for ${preview.year}?\n\n` +
          `${preview.created} balances will be created and ${preview.updated} updated (${preview.unchanged} already match).\n` +
          "Days already taken are kept."
      );
      if (!ok) return;
      const { data: done } = await client.post("/api/identity/leave-attendance-settings/apply-leave/", {
        year: Number(applyYear),
      });
      setApplyMsg(`Done: ${done.created} created, ${done.updated} updated for ${done.year}.`);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't apply the leave days.");
    } finally {
      setApplying(false);
    }
  };

  const addHoliday = async () => {
    setHolidayErr("");
    setHolidayBusy(true);
    try {
      const { data: list } = await client.post("/api/identity/holidays/", holiday);
      setData((d) => ({ ...d, holidays: list }));
      setHoliday((h) => ({ ...EMPTY_HOLIDAY, type: h.type }));
    } catch (err) {
      setHolidayErr(err.response?.data?.detail || "Couldn't add the holiday.");
    } finally {
      setHolidayBusy(false);
    }
  };

  const removeHoliday = async (h) => {
    if (!window.confirm(`Remove "${h.name}" (${fmtDate(h.date)})?`)) return;
    setHolidayErr("");
    try {
      const { data: list } = await client.delete("/api/identity/holidays/", { params: { date: h.date } });
      setData((d) => ({ ...d, holidays: list }));
    } catch (err) {
      setHolidayErr(err.response?.data?.detail || "Couldn't remove the holiday.");
    }
  };

  const fillFromMyLocation = (id) => {
    if (!navigator.geolocation) {
      setGeoMsg((m) => ({ ...m, [id]: "This browser can't share its location." }));
      return;
    }
    setGeoMsg((m) => ({ ...m, [id]: "Getting your location…" }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBranch(id, { lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
        setGeoMsg((m) => ({ ...m, [id]: `Filled in (accurate to about ${Math.round(pos.coords.accuracy)} m). Save to keep it.` }));
      },
      () => setGeoMsg((m) => ({ ...m, [id]: "Couldn't get the location — allow location access for this site and try again." })),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  if (!data) {
    return (
      <div className="ua-screen ls-page">
        <div className="ua-head"><div><h1>Leave &amp; attendance settings</h1><p>{error || "Loading…"}</p></div></div>
      </div>
    );
  }

  const yearOptions = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];

  return (
    <div className="ua-screen ls-page">
      <div className="ua-head">
        <div>
          <h1>Leave &amp; attendance settings</h1>
          <p>Set how many leave days people get, the hourly permission limit, and where each branch is for check-in</p>
        </div>
        <button type="button" className="ua-btn-accent" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? "Saving…" : "Save settings"}
        </button>
      </div>

      {error && <p className="ua-error">{error}</p>}
      {saved && <p className="ls-saved"><Check size={16} /> {saved}</p>}

      <section className="na-card ls-card">
        <h3><span className="na-n">1</span>Leave allowance<span className="na-opt">Days per year</span></h3>
        <p className="ua-perm-hint">How many days of each leave type a person gets in a year. Maternity leave isn't included.</p>
        <table className="ls-table">
          <thead>
            <tr>
              <th>Leave type</th>
              {Object.keys(GROUP_LABEL).map((g) => (
                <th key={g}><Users size={14} /> {GROUP_LABEL[g]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.leave_types.map((t) => (
              <tr key={t.code}>
                <td><b>{t.name}</b></td>
                {Object.keys(GROUP_LABEL).map((g) => (
                  <td key={g}>
                    <input
                      type="number" min="0" max="365" step="0.5"
                      value={data.leave_allowance[g][t.code] ?? ""}
                      onChange={(e) => setAllowance(g, t.code, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ls-info">
          <Info size={18} />
          <span>
            <b>Work from home</b> and <b>On duty</b> aren't listed here: they have no fixed allowance and vary for
            each employee, so there is nothing to set. Hourly permission has its own limit below.
          </span>
        </div>

        <div className="ls-apply">
          <span className="ls-apply-ic"><UsersRound size={26} /></span>
          <div className="ls-apply-text">
            <b>Apply to everyone</b>
            <p>
              Saving only stores the numbers above. <strong>Nobody's leave balance changes until you apply them.</strong>{" "}
              This writes these days into every employee's and intern's balance for the year you choose. Days already
              taken are kept, and you'll see a summary to confirm before anything changes.
            </p>
          </div>
          <div className="ls-apply-act">
            <select value={applyYear} onChange={(e) => setApplyYear(e.target.value)} aria-label="Year to apply to">
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button type="button" className="ls-apply-btn" onClick={applyToEveryone} disabled={applying || saving}>
              <Check size={18} /> {applying ? "Working…" : `Apply to everyone for ${applyYear}`}
            </button>
          </div>
        </div>
        {applyMsg && <p className="ls-saved"><Check size={16} /> {applyMsg}</p>}
      </section>

      <section className="na-card ls-card">
        <h3><span className="na-n">2</span>Permission<span className="na-opt">Per month</span></h3>
        <p className="ua-perm-hint">Hourly permission each person can take in a month. Requests that would go over this are refused.</p>
        <div className="ls-inline">
          <input
            type="number" min="0" max="200" step="0.5"
            value={data.permission_hours_per_month}
            onChange={(e) => setData((d) => ({ ...d, permission_hours_per_month: e.target.value }))}
          />
          <span>hours per person per month</span>
        </div>
      </section>

      <section className="na-card ls-card">
        <h3><span className="na-n">3</span>Branch locations<span className="na-opt">Check-in</span></h3>
        <p className="ua-perm-hint">
          Offline employees check in from their branch. A check-in outside the radius is flagged (not blocked).
          Stand at the branch and use "Use my current location", or type the coordinates.
        </p>
        <table className="ls-table">
          <thead>
            <tr><th>Branch</th><th>Latitude</th><th>Longitude</th><th>Radius (m)</th><th /></tr>
          </thead>
          <tbody>
            {data.branches.map((b) => (
              <tr key={b.branch_id}>
                <td><b>{b.branch_name}</b></td>
                <td><input type="number" step="0.000001" value={b.lat ?? ""} onChange={(e) => setBranch(b.branch_id, { lat: e.target.value })} /></td>
                <td><input type="number" step="0.000001" value={b.lng ?? ""} onChange={(e) => setBranch(b.branch_id, { lng: e.target.value })} /></td>
                <td><input type="number" min="20" max="5000" step="10" value={b.radius_m ?? ""} onChange={(e) => setBranch(b.branch_id, { radius_m: e.target.value })} /></td>
                <td>
                  <div className="ls-row-actions">
                    <button type="button" className="ua-btn-sm" onClick={() => fillFromMyLocation(b.branch_id)}>
                      <Navigation size={14} /> Use my current location
                    </button>
                    {b.lat !== null && b.lat !== "" && b.lng !== null && b.lng !== "" && (
                      <a className="ls-map" href={`https://www.google.com/maps?q=${b.lat},${b.lng}`} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} /> View on map
                      </a>
                    )}
                  </div>
                  {geoMsg[b.branch_id] && <small className="ls-geo">{geoMsg[b.branch_id]}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="na-card ls-card">
        <h3><span className="na-n">4</span>Holidays<span className="na-opt">Company calendar</span></h3>
        <p className="ua-perm-hint">
          Add a day by name and date. Sundays are always off, so you don't need to add them. Added days apply to everyone
          straight away; they don't need the Save button.
        </p>
        <div className="ls-hol-form">
          <input type="date" value={holiday.date} onChange={(e) => setHoliday((h) => ({ ...h, date: e.target.value }))} aria-label="Date" />
          <input
            type="text" maxLength={80} placeholder="Name, e.g. Founder's birthday" value={holiday.name}
            onChange={(e) => setHoliday((h) => ({ ...h, name: e.target.value }))} aria-label="Holiday name"
          />
          <select value={holiday.type} onChange={(e) => setHoliday((h) => ({ ...h, type: e.target.value }))} aria-label="Type">
            <option value="HOLIDAY">Holiday</option>
            <option value="WFH">Work from home</option>
          </select>
          <button type="button" className="ua-btn-accent" onClick={addHoliday} disabled={holidayBusy}>
            <Plus size={16} /> {holidayBusy ? "Adding…" : "Add"}
          </button>
        </div>
        {holidayErr && <p className="ua-error">{holidayErr}</p>}
        <div className="ls-info">
          <Info size={18} />
          <span>
            <b>Holiday:</b> nobody is marked absent, reports skip the day and it isn't deducted from leave.{" "}
            <b>Work from home:</b> for emergencies like a red alert or a strike. People still check in (from anywhere);
            anyone who doesn't is still absent.
          </span>
        </div>
        {data.holidays?.length ? (
          <table className="ls-table ls-hol-table">
            <thead><tr><th>Date</th><th>Name</th><th>Type</th><th /></tr></thead>
            <tbody>
              {data.holidays.map((h) => (
                <tr key={h.date}>
                  <td>{fmtDate(h.date)}</td>
                  <td><b>{h.name}</b></td>
                  <td><span className={`ls-hol-tag${h.type === "WFH" ? " wfh" : ""}`}>{h.type === "WFH" ? "Work from home" : "Holiday"}</span></td>
                  <td>
                    <button type="button" className="ua-btn-sm" onClick={() => removeHoliday(h)}>
                      <Trash2 size={14} /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ua-perm-hint">No holidays added yet.</p>
        )}
      </section>

      <div className="ls-foot">
        <button type="button" className="ua-btn-accent" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

export default LeaveSettings;
