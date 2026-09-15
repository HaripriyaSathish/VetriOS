import {
  ShieldCheck, Eye, FileText, Users, FolderKanban, BarChart3, Settings, GraduationCap, UserCog,
} from "lucide-react";
import "../components-styles/PermissionsPanel.css";

// Permission codes are prefixed by module (e.g. DOCUMENT_CREATE) — group
// by that prefix so this reads as sections instead of one long wall of
// identical pills. Each module gets a fixed color (the same 8-hue
// dataviz-validated categorical set used elsewhere) so the sections read
// apart from each other at a glance — never cycled/reassigned per data.
const PERMISSION_GROUPS = {
  AUDIT: { label: "Audit", icon: Eye, from: "#2a6fd6", to: "#123d82" },
  DOCUMENT: { label: "Documents", icon: FileText, from: "#c2410c", to: "#7c2d12" },
  EMPLOYEE: { label: "Employees", icon: Users, from: "#12b981", to: "#0b5e40" },
  PROJECT: { label: "Projects", icon: FolderKanban, from: "#b45309", to: "#78350f" },
  REPORT: { label: "Reports", icon: BarChart3, from: "#be5985", to: "#7a3a54" },
  SYSTEM: { label: "System", icon: Settings, from: "#15803d", to: "#0b3f1f" },
  TRAINING: { label: "Training", icon: GraduationCap, from: "#4c3aa7", to: "#2b2166" },
  USER: { label: "Users", icon: UserCog, from: "#b91c1c", to: "#6b1010" },
};
const DEFAULT_GROUP = { label: null, icon: ShieldCheck, from: "#5a6472", to: "#3a4152" };

export function groupPermissions(codes) {
  const groups = {};
  for (const code of codes) {
    const prefix = code.split("_")[0];
    (groups[prefix] ||= []).push(code);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prefix, items]) => ({
      prefix,
      items,
      ...DEFAULT_GROUP,
      ...PERMISSION_GROUPS[prefix],
      label: PERMISSION_GROUPS[prefix]?.label || prefix,
    }));
}

// Self-contained card — used on both the System Administrator dashboard
// and the common dashboard every other role lands on, so the "what can I
// actually do here" view looks and behaves identically everywhere.
function PermissionsPanel({ permissions }) {
  const groups = groupPermissions(permissions);

  return (
    <div className="permp-card">
      <div className="permp-card-head">
        <span className="permp-card-title">Your Permissions</span>
        <span className="permp-card-sub">{permissions.length} granted across {groups.length} modules</span>
      </div>
      <div className="permp-grid">
        {groups.map((group) => (
          <div
            className="permp-group"
            key={group.prefix}
            style={{ background: `linear-gradient(135deg, ${group.from}, ${group.to})` }}
          >
            <div className="permp-group-head">
              <span className="permp-group-icon"><group.icon size={13} /></span>
              <span className="permp-group-label">{group.label}</span>
              <span className="permp-group-count">{group.items.length}</span>
            </div>
            <div className="permp-tags">
              {group.items.map((code) => (
                <span className="permp-tag" key={code}>{code}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PermissionsPanel;
