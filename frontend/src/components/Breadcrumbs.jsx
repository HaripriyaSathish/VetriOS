import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import "../components-styles/Breadcrumbs.css";

// "System Administrator › User & Accounts › New account" — the path to the
// current page. Every item except the last is a link; the last is the
// current page. items: [{ label, to?, icon? }]
export default function Breadcrumbs({ items }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          const Icon = item.icon;
          return (
            <li key={item.label} className={last ? "current" : ""} aria-current={last ? "page" : undefined}>
              {last || !item.to ? (
                <span>{Icon && <Icon size={14} />}{item.label}</span>
              ) : (
                <Link to={item.to}>{Icon && <Icon size={14} />}{item.label}</Link>
              )}
              {!last && <ChevronRight size={14} className="crumbs-sep" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
