import { Download } from "lucide-react";

// Shared "configure filters, preview, export" panel — used on Attendance,
// Onboarding, and Exit Management. Period/Department/Status are each
// optional (pass null to omit a field entirely, e.g. Onboarding's status
// options differ from Exit's).
function ReportFilterPanel({
  title,
  subtitle = "Configure filters, preview results, and export a snapshot.",
  period,
  onPeriodChange,
  departments,
  departmentValue,
  onDepartmentChange,
  statusOptions,
  statusValue,
  onStatusChange,
  onPreview,
  onExport,
  previewing = false,
  exporting = false,
}) {
  return (
    <div className="hr-panel rpt-filter-panel">
      <div className="rpt-filter-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="rpt-filter-row">
        {onPeriodChange && (
          <div>
            <label>Period</label>
            <input type="month" value={period} onChange={(e) => onPeriodChange(e.target.value)} />
          </div>
        )}
        {departments && (
          <div>
            <label>Department</label>
            <select value={departmentValue} onChange={(e) => onDepartmentChange(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.department_id} value={d.department_id}>
                  {d.department_name}
                </option>
              ))}
            </select>
          </div>
        )}
        {statusOptions && (
          <div>
            <label>Status</label>
            <select value={statusValue} onChange={(e) => onStatusChange(e.target.value)}>
              <option value="">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="rpt-filter-actions">
        <button type="button" className="hr-btn-sm" onClick={onPreview} disabled={previewing}>
          {previewing ? "Loading…" : "Preview report"}
        </button>
        <button type="button" className="hr-btn-accent" onClick={onExport} disabled={exporting}>
          <Download size={14} /> {exporting ? "Exporting…" : "Export report"}
        </button>
      </div>
    </div>
  );
}

export default ReportFilterPanel;
