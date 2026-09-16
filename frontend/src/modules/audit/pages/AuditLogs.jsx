import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../api/client';
import '../styles/AuditLogs.css';

const TABS = [
  { key: 'audit', label: 'Audit Log', endpoint: '/api/audit/audit-logs/' },
  { key: 'access', label: 'Access Log', endpoint: '/api/audit/access-logs/' },
  { key: 'system', label: 'System Events', endpoint: '/api/audit/system-events/' },
];

const STATUS_CLASS = {
  SUCCESS: 'status-success',
  FAILED: 'status-failed',
  DENIED: 'status-failed',
  WARNING: 'status-warning',
  INFO: 'status-info',
};

export default function AuditLogs() {
  const [activeTab, setActiveTab] = useState('audit');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    event_status: '',
    event_type: '',
  });

  const currentTab = TABS.find((t) => t.key === activeTab);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (activeTab !== 'audit' && filters.event_status) params.event_status = filters.event_status;
      if (activeTab !== 'audit' && filters.event_type) params.event_type = filters.event_type;

      const res = await apiClient.get(currentTab.endpoint, { params });
      setRows(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load logs.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, currentTab]);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => fetchLogs();

  const clearFilters = () => {
    setFilters({ date_from: '', date_to: '', event_status: '', event_type: '' });
  };

  return (
    <div className="audit-logs-page">
      <div className="audit-logs-header">
        <h1>Audit Logs</h1>
        <p className="audit-logs-subtitle">
          System-wide activity, access, and event history.
        </p>
      </div>

      <div className="audit-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`audit-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="audit-filters">
        <div className="filter-group">
          <label>From</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => handleFilterChange('date_from', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>To</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => handleFilterChange('date_to', e.target.value)}
          />
        </div>

        {activeTab !== 'audit' && (
          <>
            <div className="filter-group">
              <label>Status</label>
              <select
                value={filters.event_status}
                onChange={(e) => handleFilterChange('event_status', e.target.value)}
              >
                <option value="">All</option>
                {activeTab === 'access' && (
                  <>
                    <option value="SUCCESS">Success</option>
                    <option value="FAILED">Failed</option>
                    <option value="DENIED">Denied</option>
                  </>
                )}
                {activeTab === 'system' && (
                  <>
                    <option value="SUCCESS">Success</option>
                    <option value="FAILED">Failed</option>
                    <option value="WARNING">Warning</option>
                    <option value="INFO">Info</option>
                  </>
                )}
              </select>
            </div>
            <div className="filter-group">
              <label>Event Type</label>
              <input
                type="text"
                placeholder="e.g. LOGIN"
                value={filters.event_type}
                onChange={(e) => handleFilterChange('event_type', e.target.value)}
              />
            </div>
          </>
        )}

        <button className="btn-apply" onClick={applyFilters}>Apply</button>
        <button className="btn-clear" onClick={clearFilters}>Clear</button>
      </div>

      {error && <div className="audit-error">{error}</div>}

      <div className="audit-table-wrapper">
        {loading ? (
          <div className="audit-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="audit-empty">No records found.</div>
        ) : activeTab === 'audit' ? (
          <table className="audit-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>Source</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.audit_id}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.user_name || '—'}</td>
                  <td><span className="badge">{r.action}</span></td>
                  <td>{r.entity_type}</td>
                  <td>{r.entity_id}</td>
                  <td>{r.source || '—'}</td>
                  <td className="remarks-cell">{r.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : activeTab === 'access' ? (
          <table className="audit-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Event</th>
                <th>Resource</th>
                <th>Status</th>
                <th>IP</th>
                <th>Session</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.access_log_id}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.user_name || '—'}</td>
                  <td>{r.event_type}</td>
                  <td>{r.resource_type ? `${r.resource_type} #${r.resource_id ?? ''}` : '—'}</td>
                  <td>
                    <span className={`status-pill ${STATUS_CLASS[r.event_status] || ''}`}>
                      {r.event_status}
                    </span>
                  </td>
                  <td>{r.ip_reference || '—'}</td>
                  <td>{r.session_reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="audit-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event Code</th>
                <th>Type</th>
                <th>Source</th>
                <th>User</th>
                <th>Status</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.system_event_id}>
                  <td>{new Date(r.occurred_at).toLocaleString()}</td>
                  <td><span className="badge">{r.event_code}</span></td>
                  <td>{r.event_type}</td>
                  <td>{r.event_source || '—'}</td>
                  <td>{r.user_name || '—'}</td>
                  <td>
                    <span className={`status-pill ${STATUS_CLASS[r.event_status] || ''}`}>
                      {r.event_status}
                    </span>
                  </td>
                  <td className="remarks-cell">{r.event_message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}