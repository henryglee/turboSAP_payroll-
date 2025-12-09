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

  const handleExportCalendarCSV = () => {
    const headers = [
      'period_parameters',
      'period_parameter_name',
      'time_unit',
      'time_unit_desc',
      'start_date',
    ];

    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = payrollAreas.map(area => [
      escapeCSV('80'),                 // period_parameters (fixed for now)
      escapeCSV(area.description),     // period_parameter_name
      escapeCSV('03'),                 // time_unit (fixed for now)
      escapeCSV(area.frequency),       // time_unit_desc
      escapeCSV('1/1/1990'),           // start_date (fixed for now)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calendar-id-configuration.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

    const handleExportPayrollAreaConfigCSV = () => {
    const headers = [
      'payroll_area',
      'payroll_area_text',
      'period_parameters',
      'run_payroll',
      'date_modifier',
    ];

    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = payrollAreas.map(area => [
      escapeCSV(area.region || ''), // payroll_area from Region column
      escapeCSV('McCarthy'),        // payroll_area_text (fixed for now)
      escapeCSV('08'),              // period_parameters (fixed for now)
      escapeCSV('X'),               // run_payroll (fixed for now)
      escapeCSV('0'),               // date_modifier (fixed for now)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payroll-area-configuration.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPayrollPeriodCSV = () => {
    const headers = [
      'period_parameters',
      'payroll_year',
      'payroll_period',
      'period_begin_date',
      'period_end_date',
      'prior_period_year',
      'prior_period_period',
    ];

    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const NUM_PERIODS = 52; // one year
    const startDate = new Date(2024, 11, 23); // 12/23/2024 (month is 0-based)

    const rows: string[][] = [];
    let payrollPeriod = 1; // global counter

    let currentPriorYear: number | null = null;
    let priorPeriodCounter = 0;

    const formatDate = (d: Date) => {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    };

    // set first row
     // convert payrollPeriod and priorPeriodCounter to strings
    const payrollPeriodStr = String(payrollPeriod).padStart(2, '0');
    const priorPeriodCounterStr = String(NUM_PERIODS).padStart(2, '0');

    rows.push([
      escapeCSV('80'),                    // period_parameters
      escapeCSV(startDate.getFullYear()), // payroll_year
      escapeCSV(payrollPeriodStr),          // payroll_period
      escapeCSV(formatDate(startDate)),   // period_begin_date
      escapeCSV(formatDate(startDate)),   // period_end_date
      escapeCSV(startDate.getFullYear()), // prior_period_year
      escapeCSV(priorPeriodCounterStr),          // prior_period_period
    ]);
    payrollPeriod += 1;
    
    for (let i = 1; i < NUM_PERIODS; i++) {
      const periodBegin = new Date(startDate);
      periodBegin.setDate(startDate.getDate() + i * 7);

      const periodEnd = new Date(periodBegin);
      periodEnd.setDate(periodBegin.getDate() + 6);

      const payrollYear = periodEnd.getFullYear();
      const priorPeriodYear = periodEnd.getFullYear();

      if (currentPriorYear === null || currentPriorYear !== priorPeriodYear) {
        currentPriorYear = priorPeriodYear;
        priorPeriodCounter = 1;
      } else {
        priorPeriodCounter += 1;
      }

      // convert payrollPeriod and priorPeriodCounter to strings
      const payrollPeriodStr = String(payrollPeriod).padStart(2, '0');
      const priorPeriodCounterStr = String(priorPeriodCounter).padStart(2, '0');

      rows.push([
        escapeCSV('80'),                    // period_parameters
        escapeCSV(payrollYear),            // payroll_year
        escapeCSV(payrollPeriodStr),          // payroll_period
        escapeCSV(formatDate(periodBegin)),// period_begin_date
        escapeCSV(formatDate(periodEnd)),  // period_end_date
        escapeCSV(priorPeriodYear),        // prior_period_year
        escapeCSV(priorPeriodCounterStr),     // prior_period_period
      ]);

      payrollPeriod += 1;
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payroll-period-configuration.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPayDateConfigCSV = () => {
    const headers = [
      'molga',
      'date_modifier',
      'period_parameters',
      'payroll_year',
      'payroll_period',
      'date_type',
      'date',
    ];

    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const NUM_ROWS = 52; // adjust if needed

    // First date: 1/3/2025
    // JS Date: month is 0-based, so January = 0
    const startDate = new Date(2025, 0, 3);

    const rows: string[][] = [];

    let currentYear: number | null = null;
    let payrollPeriodCounter = 0;

    const formatDate = (d: Date) => {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    };

    for (let i = 0; i < NUM_ROWS; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i * 7);

      const year = date.getFullYear();

      // Reset payroll_period when the year changes
      if (currentYear === null || currentYear !== year) {
        currentYear = year;
        payrollPeriodCounter = 1;
      } else {
        payrollPeriodCounter += 1;
      }

      rows.push([
        escapeCSV('10'),                 // molga
        escapeCSV('0'),                  // date_modifier
        escapeCSV('80'),                 // period_parameters
        escapeCSV(year),                 // payroll_year (from date)
        escapeCSV(payrollPeriodCounter), // payroll_period (per year)
        escapeCSV('01'),                 // date_type
        escapeCSV(formatDate(date)),     // date
      ]);
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pay-date-configuration.csv';
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
               <button className="button button-small" onClick={handleExportCalendarCSV}>
                <Download size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Export Calendar CSV
              </button>
              <button className="button button-small" onClick={handleExportPayrollAreaConfigCSV}>
                <Download size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Export Payroll Area Config CSV
              </button>
              <button className="button button-small" onClick={handleExportPayrollPeriodCSV}>
                <Download size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Export Payroll Period CSV
              </button>
              <button className="button button-small" onClick={handleExportPayDateConfigCSV}>
                <Download size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Export Pay Date Config CSV
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
