/**
 * PayrollResultsCard - Results display for generated payroll areas
 * Adapted from PayrollAreasPanel for the new DashboardLayout UI
 *
 * Features:
 * - Collapsible card with area count
 * - Inline editing with modern styling
 * - Multiple CSV export options
 * - Validation summary
 */

import { useState, useEffect } from 'react';
import { useConfigStore } from '../store';
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Table,
  FileSpreadsheet,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { PayrollArea } from '../types';

export function PayrollResultsCard() {
  const { payrollAreas, validation, exportJSON, setPayrollAreas } = useConfigStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedAreas, setEditedAreas] = useState<PayrollArea[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [selectedPeriodAreaCode, setSelectedPeriodAreaCode] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPeriodAreaCode && payrollAreas.length > 0) {
      setSelectedPeriodAreaCode(payrollAreas[0].code);
    }
  }, [payrollAreas, selectedPeriodAreaCode]);

  const handleEdit = () => {
    setEditedAreas(JSON.parse(JSON.stringify(payrollAreas)));
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

  // CSV Export helpers
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['Code', 'Description', 'Frequency', 'Period Pattern', 'Pay Day', 'Calendar ID', 'Employee Count', 'Business Unit', 'Region', 'Reasoning'];
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
      escapeCSV(area.reasoning.join('; '))
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    downloadCSV(csvContent, 'payroll-areas.csv');
    setShowExportMenu(false);
  };

  const handleExportJSON = () => {
    const jsonData = exportJSON();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payroll-area-configuration.json';
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  /*const handleExportCalendarCSV = () => {
  const headers = ['period_parameters', 'period_parameter_name', 'time_unit', 'time_unit_desc', 'start_date'];
  const rows = payrollAreas.map(area => [
    escapeCSV('80'),
    escapeCSV(area.description),
    escapeCSV('03'),
    escapeCSV(area.frequency),
    escapeCSV('1/1/1990'),
  ]);
  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  downloadCSV(csvContent, 'calendar-id-configuration.csv');
  setShowExportMenu(false);
  };*/

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

  /*
  const handleExportPayrollAreaConfigCSV = () => {
    const headers = ['payroll_area', 'payroll_area_text', 'period_parameters', 'run_payroll', 'date_modifier'];
    const rows = payrollAreas.map(area => [
      escapeCSV(area.region || ''),
      escapeCSV('McCarthy'),
      escapeCSV('08'),
      escapeCSV('X'),
      escapeCSV('0'),
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    downloadCSV(csvContent, 'payroll-area-configuration.csv');
    setShowExportMenu(false);
  }; */

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

  const handleExportPayrollPeriodConfigCSV = () => {
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


  if (payrollAreas.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header - Clickable to collapse */}
      <div
        className="flex items-center justify-between p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
          <Table className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">
            Generated Payroll Areas
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({payrollAreas.length} {payrollAreas.length === 1 ? 'area' : 'areas'})
            </span>
          </h2>
        </div>

        {/* Validation badge */}
        {validation.isValid ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
            <CheckCircle2 className="h-4 w-4" />
            Valid
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
            <XCircle className="h-4 w-4" />
            Issues
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-border bg-background rounded-md hover:bg-muted transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
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

                {/* Export dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-border bg-background rounded-md hover:bg-muted transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Export
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </button>

                  {showExportMenu && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-10">
                      <div className="p-1">
                        <button
                          onClick={handleExportCSV}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors"
                        >
                          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                          Payroll Areas CSV
                        </button>
                        <button
                          onClick={handleExportCalendarCSV}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors"
                        >
                          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                          Payroll Calendar CSV
                        </button>
                        <button
                          onClick={handleExportPayrollAreaConfigCSV}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors"
                        >
                          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                          Payroll Area Configuration CSV
                        </button>
                        <button
                          onClick={handleExportPayrollPeriodConfigCSV}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors"
                        >
                          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                          Payroll Period Configuration CSV
                        </button>
                        <button
                          onClick={handleExportPayDateConfigCSV}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors"
                        >
                          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                          Payroll Date Configuration CSV
                        </button>
                        <div className="border-t border-border my-1" />
                        <button
                          onClick={handleExportJSON}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors"
                        >
                          <Download className="h-4 w-4 text-muted-foreground" />
                          Full JSON Export
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Validation summary */}
          <div className={cn(
            "p-3 rounded-lg text-sm",
            validation.isValid ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          )}>
            <div className="flex items-center gap-2">
              {validation.isValid ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span className="font-medium">
                Coverage: {validation.employeesCovered} / {validation.totalEmployees} employees
              </span>
            </div>

            {validation.warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {validation.warnings.map((warning, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-amber-700">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}

            {validation.errors.length > 0 && (
              <div className="mt-2 space-y-1">
                {validation.errors.map((error, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Code</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Description</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Frequency</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Calendar</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Employees</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Reasoning</th>
                  {isEditing && <th className="w-12"></th>}
                </tr>
              </thead>
              <tbody>
                {displayAreas.map((area, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={area.code}
                          onChange={(e) => handleCellChange(idx, 'code', e.target.value)}
                          className="w-full px-2 py-1 border border-border rounded text-sm"
                        />
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                          {area.code}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={area.description}
                          onChange={(e) => handleCellChange(idx, 'description', e.target.value)}
                          className="w-full px-2 py-1 border border-border rounded text-sm"
                        />
                      ) : (
                        area.description
                      )}
                    </td>
                    <td className="py-2 px-3 capitalize">
                      {isEditing ? (
                        <select
                          value={area.frequency}
                          onChange={(e) => handleCellChange(idx, 'frequency', e.target.value)}
                          className="w-full px-2 py-1 border border-border rounded text-sm"
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
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={area.calendarId}
                          onChange={(e) => handleCellChange(idx, 'calendarId', e.target.value)}
                          className="w-full px-2 py-1 border border-border rounded text-sm"
                        />
                      ) : (
                        area.calendarId
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input
                          type="number"
                          value={area.employeeCount}
                          onChange={(e) => handleCellChange(idx, 'employeeCount', parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-border rounded text-sm"
                        />
                      ) : (
                        area.employeeCount.toLocaleString()
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {area.reasoning.slice(0, 2).map((reason, rIdx) => (
                          <li key={rIdx}>• {reason}</li>
                        ))}
                        {area.reasoning.length > 2 && (
                          <li className="text-primary">+{area.reasoning.length - 2} more</li>
                        )}
                      </ul>
                    </td>
                    {isEditing && (
                      <td className="py-2 px-3">
                        <button
                          onClick={() => handleDeleteRow(idx)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add row button */}
          {isEditing && (
            <button
              onClick={handleAddRow}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add New Row
            </button>
          )}

          {/* SAP Table preview */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <h4 className="font-medium text-foreground mb-2">SAP Table Preview</h4>
            <div className="space-y-1 text-muted-foreground">
              <div>
                <span className="font-medium">T549A (Payroll Areas):</span> {displayAreas.length} entries
              </div>
              <div>
                <span className="font-medium">T549Q (Calendars):</span>{' '}
                {new Set(displayAreas.map(a => a.calendarId)).size} unique calendars
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
