// The Role on an offer letter must read like a real job title tied to the course: "AI Fullstack Developer"
// for the AI Fullstack course is fine; "aisf", "aaa" or "bbb" is not. The server runs the same check
// (it is the one that counts); this just tells the person before they generate.
const ROLE_NOUNS = new Set([
  "developer", "engineer", "designer", "analyst", "tester", "executive", "manager", "associate", "specialist",
  "consultant", "marketer", "administrator", "architect", "programmer", "trainee", "intern", "officer",
  "coordinator", "lead", "scientist", "strategist", "writer", "support", "assistant", "technician",
  "representative", "recruiter", "producer", "editor", "creator",
]);
const ACRONYMS = new Set(["AI", "ML", "UI", "UX", "QA", "HR", "IT", "DM", "SEO", "SQL", "API", "BI", "AWS", "VR", "AR"]);
const VOWELS = /[aeiouy]/i;

const wordsOf = (text) => (text || "").split(/[^A-Za-z]+/).filter(Boolean);

// AI Fullstack Development -> AI Fullstack Developer, Digital Marketing -> Digital Marketing Executive
export function suggestRole(courseName) {
  const name = (courseName || "").trim();
  const tails = [["Development", "Developer"], ["Designing", "Designer"], ["Design", "Designer"], ["Testing", "Tester"], ["Analytics", "Analyst"], ["Analysis", "Analyst"]];
  for (const [tail, noun] of tails) if (name.endsWith(tail)) return name.slice(0, -tail.length) + noun;
  if (name.endsWith("Marketing")) return `${name} Executive`;
  return name ? `${name} Developer` : "AI Fullstack Developer";
}

// Trim, collapse spaces and Title Case each word (AI, UI, QA... stay upper case)
export function cleanRole(role) {
  return (role || "")
    .trim()
    .split(/\s+/)
    .map((w) => (ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : /^[A-Za-z]+$/.test(w) ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

// "" when the role is fine, otherwise the message to show.
export function validateRole(role, courseNames = [], designationNames = []) {
  const r = (role || "").trim();
  if (!r) return "Enter the role.";
  if (!/^[A-Za-z][A-Za-z &/.-]{3,59}$/.test(r)) return "Use a real job title with letters only, for example AI Fullstack Developer.";
  const words = wordsOf(r);
  if (words.length < 2) return "A role needs at least two words, for example AI Fullstack Developer.";
  for (const w of words) {
    const bad = w.length < 2 || (w.length >= 3 && !VOWELS.test(w)) || /(.)\1\1/i.test(w);
    if (bad) return `"${w}" doesn't look like a real word. Use a job title such as AI Fullstack Developer.`;
  }
  const lowered = new Set(words.map((w) => w.toLowerCase()));
  const designations = designationNames.map((d) => d.toLowerCase());
  if (designations.includes(r.toLowerCase())) return "";
  const designationWords = new Set(designations.flatMap((d) => wordsOf(d)));
  if (![...lowered].some((w) => ROLE_NOUNS.has(w) || designationWords.has(w)))
    return "The role should be a job title, for example AI Fullstack Developer or Digital Marketing Executive.";
  const courses = courseNames.filter(Boolean);
  if (courses.length) {
    const ok = courses.every((c) => wordsOf(c).filter((w) => w.length > 3).some((w) => lowered.has(w.toLowerCase())));
    if (!ok) return `The role should match the course (${courses[0]}), for example ${suggestRole(courses[0])}.`;
  }
  return "";
}
