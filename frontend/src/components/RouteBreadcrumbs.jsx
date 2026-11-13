import { useLocation } from "react-router-dom";
import { Briefcase, ShieldCheck } from "lucide-react";
import Breadcrumbs from "./Breadcrumbs";

const SYSADMIN = { label: "System Administrator", to: "/dashboard", icon: ShieldCheck };
const HRADMIN = { label: "HR Admin", to: "/hr", icon: Briefcase };

// Breadcrumbs for pages that don't draw their own. Only the System
// Administrator and HR Admin menus are listed — every other route returns
// nothing. (New/Edit account, Login requests and the User & Accounts list
// render their own breadcrumbs, so they're not here.)
const CRUMBS = {
  "/identity/roles": [SYSADMIN, { label: "Roles" }],
  "/identity/permissions": [SYSADMIN, { label: "Permissions" }],
  "/system-admin/approvals": [SYSADMIN, { label: "Promotion approvals" }],
  "/identity/leave-settings": [SYSADMIN, { label: "Leave & attendance settings" }],

  "/hr": [HRADMIN, { label: "HR Dashboard" }],
  "/hr/employees": [HRADMIN, { label: "Employees" }],
  "/hr/organization": [HRADMIN, { label: "Organization" }],
  "/hr/attendance": [HRADMIN, { label: "Attendance" }],
  "/hr/leave": [HRADMIN, { label: "Leave management" }],
  "/hr/worklogs": [HRADMIN, { label: "Worklogs" }],
  "/hr/onboarding": [HRADMIN, { label: "Onboarding" }],
  "/hr/promotions": [HRADMIN, { label: "Promotions" }],
  "/hr/payroll-references": [HRADMIN, { label: "Payroll References" }],
  "/hr/reports": [HRADMIN, { label: "Employee Reports" }],
};

export default function RouteBreadcrumbs({ user }) {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, "") || "/";
  // /dashboard is every role's landing page — only the System Administrator
  // one (which has its own dashboard) gets a path.
  const isSysAdmin = (user?.roles || []).includes("System Administrator");
  const items = path === "/dashboard" ? (isSysAdmin ? [SYSADMIN, { label: "Dashboard" }] : null) : CRUMBS[path];
  if (!items) return null;
  return (
    <div className="route-crumbs">
      <Breadcrumbs items={items} />
    </div>
  );
}
