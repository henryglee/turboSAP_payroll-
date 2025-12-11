import { useState, useEffect } from 'react';
import { useConfigStore } from './store';
import { Download, CheckCircle, AlertTriangle, XCircle, Edit, Save, X, Plus, Trash2 } from 'lucide-react';
import type { PayrollArea } from './types';

export function PayrollAreasPanel() {
  const { payrollAreas, validation, exportJSON, setPayrollAreas } = useConfigStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editedAreas, setEditedAreas] = useState<PayrollArea[]>([]);

  const [selectedPeriodAreaCode, setSelectedPeriodAreaCode] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPeriodAreaCode && payrollAreas.length > 0) {
      setSelectedPeriodAreaCode(payrollAreas[0].code);
    }
  }, [payrollAreas, selectedPeriodAreaCode]);

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
    if (!payrollAreas.length) {
      alert('No payroll areas available.');
      return;
    }

    const area =
      payrollAreas.find(a => a.code === selectedPeriodAreaCode) ?? payrollAreas[0];

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

    const rows = [
      [
        escapeCSV(String(area.calendarId || '80')), // period_parameters (link to calendarId)
        escapeCSV(area.description),                // period_parameter_name (from description)
        escapeCSV('03'),                            // time_unit (still fixed, SAP code for weeks/months as you prefer)
        escapeCSV(area.frequency),                  // time_unit_desc (from frequency)
        escapeCSV('1/1/1990'),                      // start_date (anchor; adjust if needed)
      ],
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendar-id-${area.code}-${area.frequency}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPayrollAreaConfigCSV = () => {
    if (!payrollAreas.length) {
      alert('No payroll areas available.');
      return;
    }

    const area =
      payrollAreas.find(a => a.code === selectedPeriodAreaCode) ?? payrollAreas[0];

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

    const payrollAreaValue = area.region || '';

    const rows = [
      [
        escapeCSV(payrollAreaValue),             // payroll_area from Region column
        escapeCSV('McCarthy'),                  // payroll_area_text (still fixed, adjust if needed)
        escapeCSV(String(area.calendarId || '08')), // period_parameters (link to calendarId if you want)
        escapeCSV('X'),                         // run_payroll
        escapeCSV('0'),                         // date_modifier
      ],
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-area-configuration-${area.code}-${area.frequency}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (d: Date) => {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  type PayrollPeriodRow = [
    string, // period_parameters
    string, // payroll_year
    string, // payroll_period
    string, // period_begin_date
    string, // period_end_date
    string, // prior_period_year
    string, // prior_period_period
  ];

  const BASE_START_DATE = new Date(2024, 11, 23); // keep your existing anchor

  function generatePayrollPeriodsForArea(
    area: PayrollArea,
    numYears: number = 1
  ): PayrollPeriodRow[] {
    const rows: PayrollPeriodRow[] = [];
    let payrollPeriod = 1;
    let currentPriorYear: number | null = null;
    let priorPeriodCounter = 0;

    // helper to push a row
    const pushRow = (begin: Date, end: Date) => {
      const payrollYear = end.getFullYear();
      const priorPeriodYear = end.getFullYear();

      if (currentPriorYear === null || currentPriorYear !== priorPeriodYear) {
        currentPriorYear = priorPeriodYear;
        priorPeriodCounter = 1;
      } else {
        priorPeriodCounter += 1;
      }

      const payrollPeriodStr = String(payrollPeriod).padStart(2, '0');
      const priorPeriodCounterStr = String(priorPeriodCounter).padStart(2, '0');

      rows.push([
        String(area.calendarId || '80'), // period_parameters: tie to calendarId or keep '80'
        String(payrollYear),
        payrollPeriodStr,
        formatDate(begin),
        formatDate(end),
        String(priorPeriodYear),
        priorPeriodCounterStr,
      ]);

      payrollPeriod += 1;
    };

    // frequency-specific generation
    const start = new Date(BASE_START_DATE);

    switch (area.frequency) {
      case 'weekly': {
        const numPeriods = 52 * numYears;
        for (let i = 0; i < numPeriods; i++) {
          const begin = new Date(start);
          begin.setDate(start.getDate() + i * 7);
          const end = new Date(begin);
          end.setDate(begin.getDate() + 6);
          pushRow(begin, end);
        }
        break;
      }

      case 'biweekly': {
        const numPeriods = 26 * numYears;
        for (let i = 0; i < numPeriods; i++) {
          const begin = new Date(start);
          begin.setDate(start.getDate() + i * 14);
          const end = new Date(begin);
          end.setDate(begin.getDate() + 13);
          pushRow(begin, end);
        }
        break;
      }

      case 'semimonthly': {
        const totalMonths = 12 * numYears;
        let cursor = new Date(start);
        for (let m = 0; m < totalMonths; m++) {
          const year = cursor.getFullYear();
          const month = cursor.getMonth();

          // 1st-15th
          const firstBegin = new Date(year, month, 1);
          const firstEnd = new Date(year, month, 15);
          pushRow(firstBegin, firstEnd);

          // 16th-end
          const secondBegin = new Date(year, month, 16);
          const secondEnd = new Date(year, month + 1, 0); // last day of month
          pushRow(secondBegin, secondEnd);

          cursor = new Date(year, month + 1, 1);
        }
        break;
      }

      case 'monthly': {
        const totalMonths = 12 * numYears;
        let cursor = new Date(start);
        for (let m = 0; m < totalMonths; m++) {
          const year = cursor.getFullYear();
          const month = cursor.getMonth();

          const begin = new Date(year, month, 1);
          const end = new Date(year, month + 1, 0);
          pushRow(begin, end);

          cursor = new Date(year, month + 1, 1);
        }
        break;
      }

      default: {
        // Fallback: weekly
        const numPeriods = 52 * numYears;
        for (let i = 0; i < numPeriods; i++) {
          const begin = new Date(start);
          begin.setDate(start.getDate() + i * 7);
          const end = new Date(begin);
          end.setDate(begin.getDate() + 6);
          pushRow(begin, end);
        }
      }
    }

    return rows;
  }

  const handleExportPayrollPeriodCSV = () => {
    if (!payrollAreas.length) {
      alert('No payroll areas available.');
      return;
    }

    const area =
    payrollAreas.find(a => a.code === selectedPeriodAreaCode) ?? payrollAreas[0];

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

    const rows = generatePayrollPeriodsForArea(area).map(r =>
    r.map(escapeCSV)
    );

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const labelFrequency = area.frequency;
    a.download = `payroll-period-${area.code}-${labelFrequency}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const PAYDAY_TO_WEEKDAY: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday : 6,
  };

  function findClosestPayDate(base: Date, payDay: string): Date {
    const target = PAYDAY_TO_WEEKDAY[payDay.toLowerCase()];
    if (target === undefined) return new Date(base); // fallback

    const baseDow = base.getDay();

    // distance going forward to next target weekday
    const forward = (target - baseDow + 7) % 7;
    // distance going backward to previous target weekday
    const backward = (baseDow - target + 7) % 7;

    let offset = 0;
    if (forward <= backward) {
      offset = forward;      // same day or nearest in the future
    } else {
      offset = -backward;    // nearest in the past
    }

    const result = new Date(base);
    result.setDate(result.getDate() + offset);
    return result;
  }

  function getLastDayOfMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstSemiMonthlyPayDate(anchor: Date, pattern: string): Date {
    const date = new Date(anchor);
    while (true) {
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();
      const lastDay = getLastDayOfMonth(year, month);

      let isPayday = false;
      if (pattern === '15-last') {
        isPayday = day === 15 || day === lastDay;
      } else if (pattern === '15-30') {
        isPayday = day === 15 || day === 30;
      }

      if (isPayday) return date;

      date.setDate(day + 1);
    }
  }

  function getNextSemiMonthlyPayDate(current: Date, pattern: string): Date {
    const date = new Date(current);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const lastDay = getLastDayOfMonth(year, month);

    if (pattern === '15-last') {
      if (day === 15) {
        return new Date(year, month, lastDay);
      }
      return new Date(year, month + 1, 15);
    }

    // '15-30'
    if (day === 15) {
      return new Date(year, month, 30);
    }
    return new Date(year, month + 1, 15);
  }

  function getFirstMonthlyPayDate(anchor: Date, pattern: string): Date {
    const date = new Date(anchor);
    while (true) {
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();
      const lastDay = getLastDayOfMonth(year, month);

      let targetDay = 1;
      if (pattern === 'last') targetDay = lastDay;
      else if (pattern === '15') targetDay = 15;
      else if (pattern === '1') targetDay = 1;

      if (day <= targetDay) {
        return new Date(year, month, targetDay);
      }

      // move to next month and recompute
      const nextMonth = new Date(year, month + 1, 1);
      const nextYear = nextMonth.getFullYear();
      const nextMonthIndex = nextMonth.getMonth();
      const nextLastDay = getLastDayOfMonth(nextYear, nextMonthIndex);
      let nextTarget = 1;
      if (pattern === 'last') nextTarget = nextLastDay;
      else if (pattern === '15') nextTarget = 15;
      else if (pattern === '1') nextTarget = 1;

      return new Date(nextYear, nextMonthIndex, nextTarget);
    }
  }

  function getNextMonthlyPayDate(current: Date, pattern: string): Date {
    const year = current.getFullYear();
    const month = current.getMonth() + 1; // next month
    const lastDay = getLastDayOfMonth(year, month);

    let targetDay = 1;
    if (pattern === 'last') targetDay = lastDay;
    else if (pattern === '15') targetDay = 15;
    else if (pattern === '1') targetDay = 1;

    return new Date(year, month, targetDay);
  }

  const handleExportPayDateConfigCSV = () => {
      if (!payrollAreas.length) {
      alert('No payroll areas available.');
      return;
    }

    const area =
      payrollAreas.find(a => a.code === selectedPeriodAreaCode) ?? payrollAreas[0];

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

    // Base anchor: 1/3/2025
    const anchor = new Date(2025, 0, 3);

    let firstPayDate: Date;
    let numRows: number;
    let useSimpleStep = false;
    let stepDays = 7;

    if (area.frequency === 'weekly' || area.frequency === 'biweekly') {
      const weekdayPayday = area.payDay || 'friday';
      firstPayDate = findClosestPayDate(anchor, weekdayPayday);

      useSimpleStep = true;
      if (area.frequency === 'weekly') {
        stepDays = 7;
        numRows = 52;
      } else {
        stepDays = 14;
        numRows = 26;
      }
    } else if (area.frequency === 'semimonthly') {
        const pattern = area.payDay || '15-last';
        firstPayDate = getFirstSemiMonthlyPayDate(anchor, pattern);
        numRows = 24; // 2 per month * 12 months
    } else if (area.frequency === 'monthly') {
        const pattern = area.payDay || 'last';
        firstPayDate = getFirstMonthlyPayDate(anchor, pattern);
        numRows = 12; // 1 per month
    } else {
        // fallback: treat like weekly
        firstPayDate = findClosestPayDate(anchor, area.payDay || 'friday');
        useSimpleStep = true;
        stepDays = 7;
        numRows = 52;
    }

    const rows: string[][] = [];
    let currentYear: number | null = null;
    let payrollPeriodCounter = 0;

    let currentDate = new Date(firstPayDate);

    for (let i = 0; i < numRows; i++) {
      const date = new Date(currentDate);

      const year = date.getFullYear();

      if (currentYear === null || currentYear !== year) {
        currentYear = year;
        payrollPeriodCounter = 1;
      } else {
        payrollPeriodCounter += 1;
      }

      rows.push([
        escapeCSV('10'),
        escapeCSV('0'),
        escapeCSV(String(area.calendarId || '80')),
        escapeCSV(year),
        escapeCSV(payrollPeriodCounter),
        escapeCSV('01'),
        escapeCSV(formatDate(date)),
      ]);

      if (useSimpleStep) {
        currentDate.setDate(currentDate.getDate() + stepDays);
      } else if (area.frequency === 'semimonthly') {
        currentDate = getNextSemiMonthlyPayDate(currentDate, area.payDay || '15-last');
      } else if (area.frequency === 'monthly') {
        currentDate = getNextMonthlyPayDate(currentDate, area.payDay || 'last');
      }
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pay-date-configuration-${area.code}-${area.frequency}.csv`;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
      {isEditing ? (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="button button-small"
            onClick={handleSave}
            style={{ background: '#48bb78', color: 'white' }}
          >
            <Save size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
            Save
          </button>
          <button
            className="button button-small"
            onClick={handleCancel}
            style={{ background: '#e53e3e', color: 'white' }}
          >
            <X size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
            Cancel
          </button>
        </div>
      ) : (
        <>
          {/* Top row: Edit, Export CSV, dropdown, Export JSON */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
            <select
              value={selectedPeriodAreaCode ?? ''}
              onChange={(e) => setSelectedPeriodAreaCode(e.target.value || null)}
              className="button button-small"
              style={{ padding: '0.25rem 0.5rem' }}
            >
              {payrollAreas.map(area => (
                <option key={area.code} value={area.code}>
                  {area.code} – {area.frequency}
                </option>
              ))}
            </select>
          </div>

          {/* Second row: Export Files group */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#4a5568',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Export Files
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
            </div>
          </div>
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
