import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Ban, BriefcaseBusiness, Check, CheckCheck, ChevronDown, Eye, FileText, GraduationCap, Info,
  KeyRound, LayoutGrid, ListChecks, Pencil, Plus, Search, Shield, ShieldCheck, Trash2, Users, X,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/Permissions.css";

// The permission table has no category/module column — VetriOSDB's
// handover materials don't define "relevant" permissions per role
// either (confirmed: Student's own role is still an open question
// there). So "module" here is just the naming convention already in
// the data — the prefix before the first underscore — used to split
// the list into tabs, not a real DB-backed category.
function groupOf(code) {
  return code.split("_")[0];
}

const titleCase = (text) => text.charAt(0) + text.slice(1).toLowerCase();

// Icon tile for a role card, picked from the role's name.
function roleIcon(name = "") {
  const n = name.toLowerCase();
  if (n.includes("admin")) return ShieldCheck;
  if (n.includes("hr") || n.includes("manager")) return Users;
  if (n.includes("trainee") || n.includes("student") || n.includes("intern")) return GraduationCap;
  if (n.includes("project") || n.includes("client") || n.includes("lead") || n.includes("business")) {
    return BriefcaseBusiness;
  }
  if (n.includes("doc")) return FileText;
  if (n.includes("viewer") || n.includes("guest")) return Eye;
  return Shield;
}

// Icon for a permission row, picked from the action at the end of its code.
function actionIcon(code = "") {
  const action = code.split("_").pop();
  if (action === "VIEW") return Eye;
  if (action === "CREATE") return Plus;
  if (action === "UPDATE" || action === "EDIT") return Pencil;
  if (action === "DELETE") return Trash2;
  return KeyRound;
}

const SYSADMIN = "System Administrator";

// Permissions screen — pick a role, then switch what it can do. Two views:
// "By role" (role cards, module pills, one switch per permission) and
// "Matrix" (every role against every permission in one grid). Every switch
// applies or removes a role_permission row immediately.
function Permissions() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [grants, setGrants] = useState(new Set());
  const [activeRoleId, setActiveRoleId] = useState(null);
  const [activeGroup, setActiveGroup] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [view, setView] = useState("role"); // "role" | "matrix"
  const [expandedId, setExpandedId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { title, body, label, danger, run }
  const [confirming, setConfirming] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [rolesRes, permsRes, matrixRes] = await Promise.all([
        client.get("/api/identity/roles/cards/"),
        client.get("/api/identity/permissions/"),
        client.get("/api/identity/role-permissions/"),
      ]);
      setRoles(rolesRes.data);
      setPermissions(permsRes.data);
      setGrants(new Set(matrixRes.data.map((g) => `${g.role_id}:${g.permission_id}`)));
      setActiveRoleId((current) => current ?? rolesRes.data[0]?.role_id ?? null);
    } catch {
      setError("Couldn't load permissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const groups = useMemo(() => {
    const byGroup = new Map();
    permissions.forEach((perm) => {
      const name = groupOf(perm.permission_code);
      if (!byGroup.has(name)) byGroup.set(name, []);
      byGroup.get(name).push(perm);
    });
    return [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const grantedCountByRole = useMemo(() => {
    const counts = new Map();
    grants.forEach((key) => {
      const roleId = key.split(":")[0];
      counts.set(roleId, (counts.get(roleId) || 0) + 1);
    });
    return counts;
  }, [grants]);

  const cellKey = (roleId, permissionId) => `${roleId}:${permissionId}`;
  const isGranted = (roleId, perm) => grants.has(cellKey(roleId, perm.permission_id));

  // Optimistic flip for one or many permissions of one role; the ones whose
  // request fails are rolled back.
  const applyGrants = async (roleId, perms, want) => {
    const keys = perms.map((p) => cellKey(roleId, p.permission_id));
    setPending((prev) => new Set([...prev, ...keys]));
    setGrants((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (want ? next.add(k) : next.delete(k)));
      return next;
    });

    const results = await Promise.allSettled(
      perms.map((p) => {
        const url = `/api/identity/roles/${roleId}/permissions/${p.permission_id}/`;
        return want ? client.put(url) : client.delete(url);
      })
    );
    const failed = perms.filter((_, i) => results[i].status === "rejected");
    if (failed.length) {
      setGrants((prev) => {
        const next = new Set(prev);
        failed.forEach((p) => {
          const k = cellKey(roleId, p.permission_id);
          if (want) next.delete(k);
          else next.add(k);
        });
        return next;
      });
      setError(
        failed.length === 1
          ? "Couldn't update that permission."
          : `Couldn't update ${failed.length} permissions.`
      );
    }
    setPending((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    });
  };

  // Single switches apply straight away, except taking permissions away from
  // System Administrator; bulk changes always ask first.
  const requestChange = (roleId, perms, want) => {
    if (!perms.length) return;
    const role = roles.find((r) => r.role_id === roleId);
    const roleName = role?.role_name || "this role";
    const bulk = perms.length > 1;
    const adminRemoval = role?.role_name === SYSADMIN && !want;
    if (!bulk && !adminRemoval) {
      applyGrants(roleId, perms, want);
      return;
    }
    const what = bulk
      ? `${perms.length} permissions`
      : `"${perms[0].permission_name}"`;
    setError("");
    setConfirm({
      title: want ? `Allow ${what}?` : `Remove ${what}?`,
      body: want
        ? `${roleName} will be able to do ${bulk ? "all of these" : "this"}. It applies to everyone with that role.`
        : adminRemoval
        ? `${SYSADMIN} manages accounts and access. Removing ${bulk ? "these" : "this"} can lock administrators out of parts of the system.`
        : `${roleName} will lose ${bulk ? "all of these" : "this"}. It applies to everyone with that role.`,
      label: want ? "Allow" : "Remove",
      danger: !want,
      run: () => applyGrants(roleId, perms, want),
    });
  };

  const runConfirm = async () => {
    setConfirming(true);
    await confirm.run();
    setConfirming(false);
    setConfirm(null);
  };

  const activeRole = roles.find((r) => r.role_id === activeRoleId);
  const searching = search.trim().length > 0;

  const scopePerms = useMemo(() => {
    if (searching) {
      const q = search.trim().toLowerCase();
      return permissions.filter(
        (p) =>
          p.permission_code.toLowerCase().includes(q) ||
          p.permission_name.toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
      );
    }
    if (activeGroup === "ALL") return permissions;
    return groups.find(([name]) => name === activeGroup)?.[1] || [];
  }, [searching, search, permissions, groups, activeGroup]);

  const allowedInScope = activeRole ? scopePerms.filter((p) => isGranted(activeRole.role_id, p)) : [];
  const restrictedInScope = activeRole ? scopePerms.filter((p) => !isGranted(activeRole.role_id, p)) : [];

  const visiblePerms =
    view === "role" && statusFilter === "ALLOWED"
      ? allowedInScope
      : view === "role" && statusFilter === "RESTRICTED"
      ? restrictedInScope
      : scopePerms;

  const groupGrantedCount = (perms) =>
    activeRole ? perms.filter((p) => isGranted(activeRole.role_id, p)).length : 0;

  const roleGrantedTotal = activeRole ? grantedCountByRole.get(String(activeRole.role_id)) || 0 : 0;
  const pct = permissions.length ? Math.round((roleGrantedTotal / permissions.length) * 100) : 0;

  const scopeName = searching ? "results" : activeGroup === "ALL" ? "all" : titleCase(activeGroup);

  const rolesUsing = (perm) => roles.filter((r) => isGranted(r.role_id, perm));

  const statusChips = [
    ["ALL", "All", scopePerms.length],
    ["ALLOWED", "Allowed", allowedInScope.length],
    ["RESTRICTED", "Restricted", restrictedInScope.length],
  ];

  // Matrix rows grouped by module, in the same order as the module pills.
  const matrixGroups = groups
    .map(([name]) => [name, visiblePerms.filter((p) => groupOf(p.permission_code) === name)])
    .filter(([, perms]) => perms.length > 0);

  return (
    <div className="perm-screen">
      <div className="perm-head">
        <div>
          <h1>Permissions</h1>
          <p>Pick a role, then switch what it is allowed to do</p>
        </div>
        <div className="perm-view-toggle" role="tablist" aria-label="View">
          <button
            type="button"
            className={view === "role" ? "on" : ""}
            onClick={() => setView("role")}
          >
            <ListChecks size={15} /> By role
          </button>
          <button
            type="button"
            className={view === "matrix" ? "on" : ""}
            onClick={() => setView("matrix")}
          >
            <LayoutGrid size={15} /> Matrix
          </button>
        </div>
      </div>

      {error && <p className="perm-error">{error}</p>}

      {loading ? (
        <p className="perm-empty">Loading…</p>
      ) : (
        <>
          {view === "role" && (
            <>
              <div className="perm-role-tabs">
                {roles.map((role) => {
                  const Icon = roleIcon(role.role_name);
                  const count = grantedCountByRole.get(String(role.role_id)) || 0;
                  const rolePct = permissions.length ? Math.round((count / permissions.length) * 100) : 0;
                  return (
                    <button
                      key={role.role_id}
                      className={"perm-role-card" + (role.role_id === activeRoleId ? " active" : "")}
                      onClick={() => setActiveRoleId(role.role_id)}
                    >
                      <span className="perm-role-top">
                        <span className="perm-role-name">{role.role_name}</span>
                        <Icon size={16} />
                      </span>
                      <span className="perm-role-count">
                        {count} of {permissions.length} allowed
                      </span>
                      <span className="perm-track"><i style={{ width: `${rolePct}%` }} /></span>
                    </button>
                  );
                })}
              </div>

              {activeRole && (
                <div className="perm-summary">
                  <span className="perm-ring" style={{ "--pct": `${pct}%` }}>
                    <span>{pct}%</span>
                  </span>
                  <div className="perm-summary-text">
                    <b>
                      {activeRole.role_name} can do {roleGrantedTotal} of {permissions.length} things
                    </b>
                    <span>Changes are saved as soon as you switch them</span>
                  </div>
                  <span className="perm-note">
                    <Info size={13} /> Applies to everyone with this role
                  </span>
                </div>
              )}
            </>
          )}

          {!searching && (
            <div className="perm-module-tabs">
              <button
                className={"perm-module-tab" + (activeGroup === "ALL" ? " active" : "")}
                onClick={() => setActiveGroup("ALL")}
              >
                All <span className="perm-module-count">{permissions.length}</span>
              </button>
              {groups.map(([name, perms]) => (
                <button
                  key={name}
                  className={"perm-module-tab" + (name === activeGroup ? " active" : "")}
                  onClick={() => setActiveGroup(name)}
                >
                  {titleCase(name)}
                  <span className="perm-module-count">
                    {view === "role" ? `${groupGrantedCount(perms)}/${perms.length}` : perms.length}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="perm-toolbar">
            <label className="perm-search-wrap">
              <span className="perm-search-icon"><Search size={15} /></span>
              <input
                className="perm-search"
                placeholder="Search all permissions"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="perm-search-clear"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  <X size={12} />
                </button>
              )}
            </label>

            {view === "role" && (
              <>
                <div className="perm-seg">
                  {statusChips.map(([key, label, count]) => (
                    <button
                      key={key}
                      type="button"
                      className={"perm-seg-btn" + (statusFilter === key ? " on" : "")}
                      onClick={() => setStatusFilter(key)}
                    >
                      {label} <b>{count}</b>
                    </button>
                  ))}
                </div>
                <div className="perm-bulk">
                  <button
                    type="button"
                    className="perm-bulk-btn"
                    disabled={!activeRole || visiblePerms.every((p) => isGranted(activeRoleId, p))}
                    onClick={() =>
                      requestChange(
                        activeRoleId,
                        visiblePerms.filter((p) => !isGranted(activeRoleId, p)),
                        true
                      )
                    }
                    title={`Allow every ${scopeName === "all" ? "" : scopeName + " "}permission shown`}
                  >
                    <CheckCheck size={14} /> Allow all
                  </button>
                  <button
                    type="button"
                    className="perm-bulk-btn danger"
                    disabled={!activeRole || visiblePerms.every((p) => !isGranted(activeRoleId, p))}
                    onClick={() =>
                      requestChange(
                        activeRoleId,
                        visiblePerms.filter((p) => isGranted(activeRoleId, p)),
                        false
                      )
                    }
                    title={`Remove every ${scopeName === "all" ? "" : scopeName + " "}permission shown`}
                  >
                    <Ban size={14} /> Clear all
                  </button>
                </div>
              </>
            )}
          </div>

          {view === "role" ? (
            <div className="perm-panel">
              {visiblePerms.length === 0 ? (
                <p className="perm-empty-row">
                  {searching ? `No permissions match "${search}".` : "Nothing to show here."}
                </p>
              ) : (
                visiblePerms.map((perm) => {
                  const has = activeRole ? isGranted(activeRole.role_id, perm) : false;
                  const busy = activeRole && pending.has(cellKey(activeRole.role_id, perm.permission_id));
                  const Icon = actionIcon(perm.permission_code);
                  const using = rolesUsing(perm);
                  const open = expandedId === perm.permission_id;
                  return (
                    <div className={"perm-row" + (has ? "" : " off")} key={perm.permission_id}>
                      <div className="perm-row-main">
                        <span className="perm-row-icon"><Icon size={17} /></span>
                        <div className="perm-row-text">
                          <div className="perm-name">{perm.permission_name}</div>
                          <div className="perm-sub">{perm.description || "No description added."}</div>
                        </div>
                        <span className="perm-code">{perm.permission_code}</span>
                        <button
                          type="button"
                          className={"perm-used" + (open ? " open" : "")}
                          onClick={() => setExpandedId(open ? null : perm.permission_id)}
                          title="Which roles have this permission"
                        >
                          <Users size={13} /> {using.length} {using.length === 1 ? "role" : "roles"}
                          <ChevronDown size={12} />
                        </button>
                        <span className={"perm-state " + (has ? "on" : "off")}>
                          {busy ? "…" : has ? "Allowed" : "Restricted"}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={has}
                          aria-label={`${perm.permission_name} for ${activeRole?.role_name}`}
                          className={"perm-switch" + (has ? " on" : "")}
                          disabled={busy}
                          onClick={() => requestChange(activeRole.role_id, [perm], !has)}
                        />
                      </div>
                      {open && (
                        <div className="perm-row-roles">
                          <span>Allowed for</span>
                          {using.length ? (
                            using.map((r) => (
                              <span className="perm-role-pill" key={r.role_id}>{r.role_name}</span>
                            ))
                          ) : (
                            <em>No role has this permission yet.</em>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="perm-panel perm-matrix-panel">
              {visiblePerms.length === 0 ? (
                <p className="perm-empty-row">
                  {searching ? `No permissions match "${search}".` : "Nothing to show here."}
                </p>
              ) : (
                <div className="perm-matrix-scroll">
                  <table className="perm-matrix">
                    <thead>
                      <tr>
                        <th className="perm-matrix-first">Permission</th>
                        {roles.map((role) => (
                          <th key={role.role_id}>
                            <span className="perm-matrix-role">{role.role_name}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixGroups.map(([name, perms]) => (
                        <Fragment key={name}>
                          <tr className="perm-matrix-group">
                            <td colSpan={roles.length + 1}>{titleCase(name)}</td>
                          </tr>
                          {perms.map((perm) => (
                            <tr key={perm.permission_id}>
                              <td className="perm-matrix-first">
                                <div className="perm-name">{perm.permission_name}</div>
                                <div className="perm-code-sm">{perm.permission_code}</div>
                              </td>
                              {roles.map((role) => {
                                const has = isGranted(role.role_id, perm);
                                const busy = pending.has(cellKey(role.role_id, perm.permission_id));
                                return (
                                  <td key={role.role_id} className="perm-matrix-cell">
                                    <button
                                      type="button"
                                      className={"perm-cell" + (has ? " on" : "")}
                                      disabled={busy}
                                      aria-pressed={has}
                                      aria-label={`${perm.permission_name} for ${role.role_name}`}
                                      title={has ? "Allowed — click to remove" : "Restricted — click to allow"}
                                      onClick={() => requestChange(role.role_id, [perm], !has)}
                                    >
                                      {has ? <Check size={14} /> : null}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {confirm && (
        <div className="perm-modal-backdrop" onClick={() => !confirming && setConfirm(null)}>
          <div className="perm-modal" onClick={(e) => e.stopPropagation()}>
            <span className={"perm-modal-icon" + (confirm.danger ? " danger" : "")}>
              {confirm.danger ? <Ban size={20} /> : <CheckCheck size={20} />}
            </span>
            <h2>{confirm.title}</h2>
            <p>{confirm.body}</p>
            <div className="perm-modal-actions">
              <button
                type="button"
                className="perm-btn-sm"
                onClick={() => setConfirm(null)}
                disabled={confirming}
              >
                Cancel
              </button>
              <button
                type="button"
                className={confirm.danger ? "perm-btn-danger" : "perm-btn-accent"}
                onClick={runConfirm}
                disabled={confirming}
              >
                {confirming ? "Working…" : confirm.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Permissions;
