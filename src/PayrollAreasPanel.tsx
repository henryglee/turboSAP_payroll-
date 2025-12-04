import { useState } from 'react';
import { useConfigStore } from './store';
import { Download, CheckCircle, AlertTriangle, XCircle, Edit, Save, X, Plus, Trash2 } from 'lucide-react';
import type { PayrollArea } from './types';

export function PayrollAreasPanel() {
  const { payrollAreas, validation, exportJSON, setPayrollAreas } = useConfigStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editedAreas, setEditedAreas] = useState<PayrollArea[]>([]);

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

  const handleEdit = () => {
    setEditedAreas(JSON.parse(JSON.stringify(payrollAreas))); // Deep copy
    setIsEditing(true);
  };

  const handleSave = () => {
    setPayrollAreas(editedAreas);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedAreas([]);
    setIsEditing(false);
  };

  const handleCellChange = (index: number, field: keyof PayrollArea, value: any) => {
    const newAreas = [...editedAreas];
    newAreas[index] = { ...newAreas[index], [field]: value };
    setEditedAreas(newAreas);
  };

  const handleAddRow = () => {
    const newRow: PayrollArea = {
      code: `Z${editedAreas.length + 1}`,
      description: 'New Area',
      frequency: 'weekly',
      calendarId: '80',
      businessUnit: '',
      employeeCount: 0,
      generatedBy: 'consultant',
      reasoning: ['Manually added by user'],
      periodPattern: 'mon-sun',
      payDay: 'friday',
    };
    setEditedAreas([...editedAreas, newRow]);
  };

  const handleDeleteRow = (index: number) => {
    const newAreas = editedAreas.filter((_, i) => i !== index);
    setEditedAreas(newAreas);
  };

  const displayAreas = isEditing ? editedAreas : payrollAreas;

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
          {isEditing ? (
            <>
              <button className="button button-small" onClick={handleSave} style={{ background: '#48bb78', color: 'white' }}>
                <Save size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Save
              </button>
              <button className="button button-small" onClick={handleCancel} style={{ background: '#e53e3e', color: 'white' }}>
                <X size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button className="button button-small" onClick={handleEdit}>
                <Edit size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Edit
              </button>
              <button className="button button-small" onClick={handleExportCSV}>
                <Download size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Export CSV
              </button>
              <button className="button button-small" onClick={handleExport}>
                <Download size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Export JSON
              </button>
            </>
          )}
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
        {displayAreas.length > 0 ? (
          <table className="payroll-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th>Frequency</th>
                <th>Calendar</th>
                <th>Employees</th>
                <th>Reasoning</th>
                {isEditing && <th style={{ width: '60px' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {displayAreas.map((area, idx) => (
                <tr key={idx}>
                  <td>
                    {isEditing ? (
                      <input
                        type="text"
                        value={area.code}
                        onChange={(e) => handleCellChange(idx, 'code', e.target.value)}
                        style={{ width: '100%', padding: '0.25rem', border: '1px solid #cbd5e0', borderRadius: '4px' }}
                      />
                    ) : (
                      <span className="code-badge">{area.code}</span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="text"
                        value={area.description}
                        onChange={(e) => handleCellChange(idx, 'description', e.target.value)}
                        style={{ width: '100%', padding: '0.25rem', border: '1px solid #cbd5e0', borderRadius: '4px' }}
                      />
                    ) : (
                      area.description
                    )}
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>
                    {isEditing ? (
                      <select
                        value={area.frequency}
                        onChange={(e) => handleCellChange(idx, 'frequency', e.target.value)}
                        style={{ width: '100%', padding: '0.25rem', border: '1px solid #cbd5e0', borderRadius: '4px' }}
                      >
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="semimonthly">Semimonthly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    ) : (
                      area.frequency
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="text"
                        value={area.calendarId}
                        onChange={(e) => handleCellChange(idx, 'calendarId', e.target.value)}
                        style={{ width: '100%', padding: '0.25rem', border: '1px solid #cbd5e0', borderRadius: '4px' }}
                      />
                    ) : (
                      area.calendarId
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        value={area.employeeCount}
                        onChange={(e) => handleCellChange(idx, 'employeeCount', parseInt(e.target.value) || 0)}
                        style={{ width: '100%', padding: '0.25rem', border: '1px solid #cbd5e0', borderRadius: '4px' }}
                      />
                    ) : (
                      area.employeeCount
                    )}
                  </td>
                  <td>
                    <ul className="reasoning-list">
                      {area.reasoning.map((reason, rIdx) => (
                        <li key={rIdx}>{reason}</li>
                      ))}
                    </ul>
                  </td>
                  {isEditing && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteRow(idx)}
                        className="button button-small"
                        style={{ background: '#e53e3e', color: 'white', padding: '0.25rem 0.5rem' }}
                        title="Delete row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
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

        {/* Add Row Button (only visible in edit mode) */}
        {isEditing && displayAreas.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={handleAddRow}
              className="button"
              style={{ background: '#3182ce', color: 'white', width: '100%' }}
            >
              <Plus size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              Add New Row
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f7fafc', borderRadius: '4px' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#2d3748' }}>
          SAP Table Preview
        </h3>
        <div style={{ fontSize: '0.8125rem', color: '#4a5568' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>T549A (Payroll Areas):</strong> {displayAreas.length} entries
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>T549Q (Calendars):</strong>{' '}
            {new Set(displayAreas.map((a) => a.calendarId)).size} unique calendars
          </div>
          <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.5rem' }}>
            Export JSON to see full SAP table mappings
          </div>
        </div>
      </div>
    </div>
  );
}
