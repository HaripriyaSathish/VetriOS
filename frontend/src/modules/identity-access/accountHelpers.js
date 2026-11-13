// Small helpers shared by the User & Accounts screens (list, New account
// page, and the Edit popup).

// Exactly 8 characters: at least one capital letter, one digit, one
// special (non-alphanumeric) character.
export const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8}$/;
export const PASSWORD_HINT =
  "Exactly 8 characters, with at least one capital letter, one number, and one special character.";

// "09:30" -> "9:30 AM"
export const fmtClock = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

// Length of the working day between two HH:MM times ("9 hrs", "8h 30m").
export const workDuration = (a, b) => {
  if (!a || !b || b <= a) return "";
  const [h1, m1] = a.split(":").map(Number);
  const [h2, m2] = b.split(":").map(Number);
  const mins = h2 * 60 + m2 - (h1 * 60 + m1);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h} hrs`;
};

export const initialsOf = (name) =>
  (name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

// "Today, 10:05 AM" / "Yesterday, ..." / "15 Sep 2026" for last-login text.
export function formatLastLogin(value) {
  if (!value) return "Never signed in";
  const d = new Date(value);
  const dayStart = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dayStart(new Date()) - dayStart(d)) / 86400000);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}
