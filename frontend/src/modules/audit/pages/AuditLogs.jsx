import { useState, useEffect, useMemo } from 'react';
import {
  Download, ScrollText, ShieldAlert, FileSignature, TrendingUp, TrendingDown, ShieldCheck,
  Search, ChevronDown, RotateCw, Monitor, Server, CircleCheck, CircleX, TriangleAlert, Info,
} from 'lucide-react';
import apiClient from '../../../api/client';
import '../../training/styles/BusinessPages.css';
import '../styles/AuditLogs.css';

const TABS = [
  { key: 'audit', label: 'Audit Log', endpoint: '/api/audit/audit-logs/' },
  { key: 'access', label: 'Access Log', endpoint: '/api/audit/access-logs/' },
  { key: 'system', label: 'System Events', endpoint: '/api/audit/system-events/' },
];

const RANGES = [
  { key: '1', label: 'Today' },
  { key: '7', label: 'Last 7 Days' },
  { key: '30', label: 'Last 30 Days' },
  { key: '', label: 'All Time' },
];

const STATUS_TONE = {
  SUCCESS: { tone: 'green', Icon: CircleCheck },
  FAILED: { tone: 'red', Icon: CircleX },
  DENIED: { tone: 'red', Icon: CircleX },
  WARNING: { tone: 'orange', Icon: TriangleAlert },
  INFO: { tone: 'blue', Icon: Info },
};

const PAGE_SIZE = 10;

const initialsOf = (name) =>
  (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

const isoDaysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
};

const sameDay = (a, b) => a.toDateString() === b.toDateString();

function stampOf(value) {
  const d = new Date(value);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day = sameDay(d, now) ? 'Today' : sameDay(d, yesterday) ? 'Yesterday' : d.toLocaleDateString([], { day: '2-digit', month: 'short' });
  const mins = Math.round((now - d) / 60000);
  const ago = mins < 60 ? `${Math.max(mins, 0)} min ago` : mins < 1440 ? `${Math.round(mins / 60)} hrs ago` : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  return { main: `${day}, ${time}`, ago };
}

// One row shape for all three logs so the table, filters and CSV export
// don't need to branch on the active tab.
function normalise(tab, r) {
  if (tab === 'audit') {
    return {
      id: `a${r.audit_id}`, at: r.created_at, user: r.user_name, action: r.action,
      description: r.remarks || `${r.entity_type} #${r.entity_id}`,
      module: r.entity_type, source: r.source, status: null,
    };
  }
  if (tab === 'access') {
    return {
      id: `x${r.access_log_id}`, at: r.created_at, user: r.user_name, action: r.event_type,
      description: r.resource_type ? `${r.resource_type} #${r.resource_id ?? ''}` : (r.session_reference || ''),
      module: r.resource_type, source: r.ip_reference, status: r.event_status,
    };
  }
  return {
    id: `s${r.system_event_id}`, at: r.occurred_at, user: r.user_name, action: r.event_code,
    description: r.event_message || r.event_type,
    module: r.entity_type || r.event_type, source: r.event_source, status: r.event_status,
  };
}

function downloadCsv(rows, tabLabel) {
  const head = ['Timestamp', 'User', 'Action', 'Description', 'Module', 'Source', 'Status'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [head.join(',')].concat(
    rows.map((r) => [new Date(r.at).toLocaleString(), r.user, r.action, r.description, r.module, r.source, r.status].map(esc).join(',')),
  );
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tabLabel.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogs() {
  const [activeTab, setActiveTab] = useState('audit');
  const [range, setRange] = useState('7');
  const [logs, setLogs] = useState({ audit: [], access: [], system: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [moduleFilter, setModuleFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = range ? { date_from: isoDaysAgo(Number(range)) } : {};
    Promise.allSettled(TABS.map((t) => apiClient.get(t.endpoint, { params })))
      .then((results) => {
        if (cancelled) return;
        const next = {};
        TABS.forEach((t, i) => {
          next[t.key] = results[i].status === 'fulfilled' ? results[i].value.data : [];
        });
        setLogs(next);
        const failed = results.find((r) => r.status === 'rejected');
        if (failed) setError(failed.reason?.response?.data?.detail || 'Failed to load logs.');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [range, reloadKey]);

  useEffect(() => { setPage(1); }, [activeTab, range, moduleFilter, userFilter, search]);
  useEffect(() => { setModuleFilter(''); setUserFilter(''); }, [activeTab]);

  const rows = useMemo(() => logs[activeTab].map((r) => normalise(activeTab, r)), [logs, activeTab]);
  const modules = useMemo(() => [...new Set(rows.map((r) => r.module).filter(Boolean))].sort(), [rows]);
  const users = useMemo(() => [...new Set(rows.map((r) => r.user).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (!moduleFilter || r.module === moduleFilter) &&
      (!userFilter || r.user === userFilter) &&
      (!q || [r.action, r.description, r.module, r.user, r.source].some((v) => String(v ?? '').toLowerCase().includes(q))),
    );
  }, [rows, moduleFilter, userFilter, search]);

  const stats = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const all = [
      ...logs.audit.map((r) => r.created_at),
      ...logs.access.map((r) => r.created_at),
      ...logs.system.map((r) => r.occurred_at),
    ].map((v) => new Date(v));
    const today = all.filter((d) => sameDay(d, now)).length;
    const prev = all.filter((d) => sameDay(d, yesterday)).length;
    const flags = [...logs.access, ...logs.system].filter((r) => ['FAILED', 'DENIED'].includes(r.event_status)).length;
    const signoffs = logs.audit.filter((r) => /APPROV|SIGN/i.test(r.action || '')).length;
    return { today, prev, flags, signoffs };
  }, [logs]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const tabLabel = TABS.find((t) => t.key === activeTab).label;
  const rangeLabel = RANGES.find((r) => r.key === range).label;
  const delta = stats.prev ? Math.round(((stats.today - stats.prev) / stats.prev) * 100) : null;

  const pageButtons = [];
  for (let p = 1; p <= pages; p += 1) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) pageButtons.push(p);
    else if (pageButtons[pageButtons.length - 1] !== '…') pageButtons.push('…');
  }

  return (
    <div className="bp-page audit-page">
      <div className="bp-head">
        <div>
          <p className="audit-kicker">
            <span className="bp-chip blue">System Compliance</span>
            <span className="audit-kicker-dot" /> Activity Ledger
          </p>
          <h1 className="bp-title">Audit Logs &amp; Governance</h1>
          <p className="bp-sub">Record of workforce actions, admissions changes, approvals and security events.</p>
        </div>
        <div className="bp-actions">
          <button type="button" className="bp-btn navy" onClick={() => downloadCsv(filtered, tabLabel)} disabled={!filtered.length}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="bp-stats">
        <div className="bp-stat" style={{ '--i': 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">EVENTS TODAY</p>
            <span className="bp-stat-icon"><ScrollText size={17} /></span>
          </div>
          <p className="bp-stat-value">{stats.today} <small className="audit-stat-unit">logged actions</small></p>
          {delta != null ? (
            <p className={`audit-trend ${delta >= 0 ? 'up' : 'down'}`}>
              {delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {delta >= 0 ? '+' : ''}{delta}% from yesterday
            </p>
          ) : (
            <p className="audit-trend muted">{stats.prev} yesterday</p>
          )}
        </div>
        <div className="bp-stat" style={{ '--i': 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">SECURITY FLAGS</p>
            <span className="bp-stat-icon green"><ShieldAlert size={17} /></span>
          </div>
          <p className="bp-stat-value">{stats.flags} <small className="audit-stat-unit">failed / denied</small></p>
          {stats.flags === 0 ? (
            <span className="bp-chip green"><ShieldCheck size={13} /> System Healthy</span>
          ) : (
            <span className="bp-chip red"><ShieldAlert size={13} /> Review needed · {rangeLabel}</span>
          )}
        </div>
        <div className="bp-stat" style={{ '--i': 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label">SIGN-OFFS</p>
            <span className="bp-stat-icon orange"><FileSignature size={17} /></span>
          </div>
          <p className="bp-stat-value">{stats.signoffs} <small className="audit-stat-unit">approvals</small></p>
          <p className="audit-trend orange">{rangeLabel}</p>
        </div>
      </div>

      <div className="bp-panel audit-filters">
        <div className="audit-filter-row">
          <label className="bp-select">
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="bp-select">
            <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              <option value="">All Categories</option>
              {modules.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="bp-select">
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
              <option value="">All Users</option>
              {users.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <div className="audit-viewing">
            <span>Viewing:</span>
            <div className="bp-tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`bp-tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label} <small>{logs[tab.key].length}</small>
                </button>
              ))}
            </div>
            <button type="button" className="audit-refresh" onClick={() => setReloadKey((k) => k + 1)} aria-label="Refresh">
              <RotateCw size={15} />
            </button>
          </div>
        </div>
        <label className="bp-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by target, action or ID…" />
        </label>
      </div>

      {error && <div className="bp-notice audit-error">{error}</div>}

      <div className="bp-panel">
        <div className="bp-table-wrap">
          <table className="bp-table audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action &amp; Event Description</th>
                <th>Module</th>
                <th>Source / IP</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="bp-empty-row"><td colSpan={6}>Loading…</td></tr>
              ) : visible.length === 0 ? (
                <tr className="bp-empty-row"><td colSpan={6}>No records found.</td></tr>
              ) : visible.map((r, i) => {
                const stamp = stampOf(r.at);
                const st = r.status ? (STATUS_TONE[r.status] || { tone: 'gray', Icon: Info }) : null;
                return (
                  <tr key={r.id}>
                    <td>
                      <p className="bp-strong audit-when">{stamp.main}</p>
                      <p className="bp-person-sub">{stamp.ago}</p>
                    </td>
                    <td>
                      <div className="bp-person audit-person">
                        <span className={`bp-avatar t${i % 4}`}>{r.user ? initialsOf(r.user) : <Server size={14} />}</span>
                        <p className="bp-person-name">{r.user || 'System'}</p>
                      </div>
                    </td>
                    <td>
                      <p className="audit-action">{r.action}</p>
                      {r.description && <p className="audit-desc">{r.description}</p>}
                    </td>
                    <td>{r.module ? <span className="bp-chip blue">{r.module}</span> : <span className="bp-muted">—</span>}</td>
                    <td>
                      <span className="audit-source">
                        <Monitor size={14} /> {r.source || '—'}
                      </span>
                    </td>
                    <td>
                      {st ? (
                        <span className={`bp-chip ${st.tone}`}><st.Icon size={13} /> {r.status.charAt(0) + r.status.slice(1).toLowerCase()}</span>
                      ) : (
                        <span className="bp-chip green"><CircleCheck size={13} /> Recorded</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="bp-pager">
          <span>
            Showing <b>{filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}</b> to <b>{Math.min(page * PAGE_SIZE, filtered.length)}</b> of <b>{filtered.length}</b> events
          </span>
          <div className="bp-pages">
            <button type="button" className="bp-page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>‹ Previous</button>
            {pageButtons.map((p, i) => (p === '…' ? (
              <span key={`gap${i}`} className="bp-muted">…</span>
            ) : (
              <button key={p} type="button" className={`bp-page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            )))}
            <button type="button" className="bp-page-btn" disabled={page === pages} onClick={() => setPage(page + 1)}>Next ›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
