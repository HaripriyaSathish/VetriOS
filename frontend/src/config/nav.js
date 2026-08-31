// Module nav config, carried over from the "VetriOS Console" mockup —
// each item's requirement mirrors the gating rule we designed there
// (role = System Administrator for Identity & Access, permission codes
// for the rest, "ANY" active role for Communication until a dedicated
// COMMUNICATION_* permission exists).
export const NAV_ITEMS = [
  {
    id: "identity",
    icon: "🔑",
    name: "Identity & Access",
    path: "/identity",
    requirement: { type: "role", value: "System Administrator" },
  },
  {
    id: "hr",
    icon: "🧑‍💼",
    name: "HR",
    path: "/hr",
    requirement: { type: "perm", value: "EMPLOYEE_VIEW" },
  },
  {
    id: "training",
    icon: "🎓",
    name: "Training",
    path: "/training",
    requirement: { type: "perm", value: "TRAINING_VIEW" },
  },
  {
    id: "internship",
    icon: "🧭",
    name: "Internship",
    path: "/internship",
    requirement: { type: "perm", value: "TRAINING_VIEW" },
  },
  {
    id: "clients",
    icon: "🤝",
    name: "Clients",
    path: "/clients",
    requirement: { type: "perm", value: "PROJECT_VIEW" },
  },
  {
    id: "projects",
    icon: "📁",
    name: "Projects",
    path: "/projects",
    requirement: { type: "perm", value: "PROJECT_VIEW" },
  },
  {
    id: "documents",
    icon: "📄",
    name: "Document Generator",
    path: "/documents",
    requirement: { type: "perm", value: "DOCUMENT_VIEW" },
  },
  {
    id: "communication",
    icon: "✉️",
    name: "Communication",
    path: "/communication",
    requirement: { type: "role", value: "ANY" },
  },
  {
    id: "ai",
    icon: "🧠",
    name: "AI / RAG",
    path: "/ai",
    requirement: { type: "perm", value: "SYSTEM_ADMIN" },
  },
];

// Same gating rule shapes used above — checked against the user's
// resolved roles/permissions from the /me response.
export function hasAccess(requirement, user) {
  if (!requirement || !user) return false;

  if (requirement.type === "role") {
    if (requirement.value === "ANY") {
      return (user.roles || []).length > 0;
    }
    return (user.roles || []).includes(requirement.value);
  }

  if (requirement.type === "perm") {
    return (user.permissions || []).includes(requirement.value);
  }

  return false;
}
