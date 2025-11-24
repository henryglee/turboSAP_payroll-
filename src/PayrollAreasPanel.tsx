import { useConfigStore } from './store';
import { Download, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export function PayrollAreasPanel() {
  const { payrollAreas, validation, exportJSON } = useConfigStore();

  const handleExport = () => {
    const jsonData = exportJSON();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payroll-area-configuration.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    // CSV headers
    const headers = [
      'Code',
      'Description',
      'Frequency',
      'Period Pattern',
      'Pay Day',
      'Calendar ID',
      'Employee Count',
      'Business Unit',
      'Region',
      'Reasoning'
    ];

    // Helper function to escape CSV values
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // If contains comma, quote, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Convert areas to CSV rows
    const rows = payrollAreas.map(area => [
      escapeCSV(area.code),
      escapeCSV(area.description),
      escapeCSV(area.frequency),
      escapeCSV(area.periodPattern),
      escapeCSV(area.payDay),
      escapeCSV(area.calendarId),
      escapeCSV(area.employeeCount),
      escapeCSV(area.businessUnit || ''),
      escapeCSV(area.region || ''),
      escapeCSV(area.reasoning.join('; '))  // Join reasoning array with semicolons
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payroll-areas.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="right-panel">
      <div className="payroll-areas-header">
        <div>
          <h2>Payroll Areas ({payrollAreas.length})</h2>
          <p style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.25rem' }}>
            Minimal areas calculated based on SAP best practices
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="button button-small" onClick={handleExportCSV}>
            <Download size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
            Export CSV
          </button>
          <button className="button button-small" onClick={handleExport}>
            <Download size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
            Export JSON
          </button>
        </div>
      </div>

      <div className="validation-summary">
        <h3>
          {validation.isValid ? (
            <span style={{ color: '#22543d' }}>
              <CheckCircle size={16} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
              Configuration Valid
            </span>
          ) : (
            <span style={{ color: '#742a2a' }}>
              <XCircle size={16} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
              Configuration Issues
            </span>
          )}
        </h3>
        <div className="validation-item success">
          ✓ Coverage: {validation.employeesCovered} / {validation.totalEmployees} employees
        </div>

        {validation.warnings.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            {validation.warnings.map((warning, idx) => (
              <div key={idx} className="validation-item warning">
                ⚠ {warning}
              </div>
            ))}
          </div>
        )}

        {validation.errors.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            {validation.errors.map((error, idx) => (
              <div key={idx} className="validation-item error">
                ✗ {error}
              </div>
            ))}
          </div>
        )}
      </div>

      {validation.warnings.length > 0 && (
        <div className="warning-box">
          <h4>
            <AlertTriangle size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
            Recommendations
          </h4>
          <ul>
            {validation.warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="table-container" style={{ marginTop: '1rem' }}>
        {payrollAreas.length > 0 ? (
          <table className="payroll-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th>Frequency</th>
                <th>Calendar</th>
                <th>Employees</th>
                <th>Reasoning</th>
              </tr>
            </thead>
            <tbody>
              {payrollAreas.map((area, idx) => (
                <tr key={idx}>
                  <td>
                    <span className="code-badge">{area.code}</span>
                  </td>
                  <td>{area.description}</td>
                  <td style={{ textTransform: 'capitalize' }}>{area.frequency}</td>
                  <td>{area.calendarId}</td>
                  <td>{area.employeeCount}</td>
                  <td>
                    <ul className="reasoning-list">
                      {area.reasoning.map((reason, rIdx) => (
                        <li key={rIdx}>{reason}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <AlertTriangle size={48} style={{ opacity: 0.3 }} />
            <p>No payroll areas configured yet.</p>
            <p style={{ fontSize: '0.75rem' }}>
              Adjust the configuration on the left to generate payroll areas.
            </p>
          </div>
        )}
      </div>

      <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f7fafc', borderRadius: '4px' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#2d3748' }}>
          SAP Table Preview
        </h3>
        <div style={{ fontSize: '0.8125rem', color: '#4a5568' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>T549A (Payroll Areas):</strong> {payrollAreas.length} entries
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>T549Q (Calendars):</strong>{' '}
            {new Set(payrollAreas.map((a) => a.calendarId)).size} unique calendars
          </div>
          <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.5rem' }}>
            Export JSON to see full SAP table mappings
          </div>
        </div>
      </div>
    </div>
  );
}
