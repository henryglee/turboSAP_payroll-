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

import { useState } from 'react';
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

  const handleExportCalendarCSV = () => {
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
  };

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
                          Calendar CSV
                        </button>
                        <button
                          onClick={handleExportPayrollAreaConfigCSV}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors"
                        >
                          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                          Payroll Area Config CSV
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
