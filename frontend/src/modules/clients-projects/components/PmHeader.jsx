import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// Page header shared by every Project Manager workspace page (PM Figma,
// Requirements 2019-6123): orange-dot eyebrow, Plus Jakarta title,
// subtitle on the left, actions on the right, optional back link above.
export default function PmHeader({ eyebrow = "Project Workspace", section, title, subtitle, back, backLabel, children }) {
  return (
    <>
      {back && (
        <Link to={back} className="pm-back"><ArrowLeft size={14} /> {backLabel || "Back"}</Link>
      )}
      <div className="pm-head">
        <div>
          <p className="pm-eyebrow">{eyebrow}{section && <> <i /> <span>{section}</span></>}</p>
          <h1 className="bp-title">{title}</h1>
          {subtitle && <p className="bp-sub pm-head-sub">{subtitle}</p>}
        </div>
        {children && <div className="bp-actions">{children}</div>}
      </div>
    </>
  );
}
