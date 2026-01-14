/**
 * CompanyCodePage - Spreadsheet-style company code configuration
 * Excel-like grid with inline editing for SAP company codes
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuthStore } from '../store/auth';
import { useConfigStore } from '../store';
import type { CompanyCode } from '../types';
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================
// Column Configuration
// ============================================

interface ColumnDef {
  key: keyof CompanyCode;
  label: string;
  width: number; // in pixels
  required: boolean;
  placeholder?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: 'companyName', label: 'Company Name (25 Char)', width: 200, required: true, placeholder: 'Acme Global Corp.' },
  { key: 'companyCode', label: 'Company Code', width: 120, required: true, placeholder: '1000' },
  { key: 'shortName', label: 'Short Name', width: 120, required: false, placeholder: 'Acme Glo.' },
  { key: 'currency', label: 'Local Currency', width: 100, required: true, placeholder: 'USD' },
  { key: 'street', label: 'Street and House Number', width: 200, required: true, placeholder: '123 Financial Way' },
  { key: 'city', label: 'City', width: 120, required: true, placeholder: 'New York' },
  { key: 'state', label: 'State', width: 80, required: true, placeholder: 'NY' },
  { key: 'zipCode', label: 'Zip Code', width: 100, required: true, placeholder: '10001' },
  { key: 'country', label: 'Country', width: 80, required: true, placeholder: 'US' },
  { key: 'poBox', label: 'PO Box', width: 100, required: false, placeholder: 'PO Box 456' },
  { key: 'language', label: 'Language', width: 80, required: false, placeholder: 'EN' },
  { key: 'chartOfAccounts', label: 'Chart of Accounts', width: 140, required: false, placeholder: 'COA1' },
  { key: 'fiscalYearVariant', label: 'Fiscal Year Variant', width: 140, required: false, placeholder: 'K4' },
  { key: 'vatRegistrationNumber', label: 'VAT Reg. Number', width: 140, required: false, placeholder: 'US123456789' },
  { key: 'creditControlArea', label: 'Credit Control Area', width: 140, required: false, placeholder: '1000' },
  { key: 'taxJurisdictionCode', label: 'Tax Jurisdiction', width: 120, required: false, placeholder: 'NY0000000' },
];

// ============================================
// LocalStorage Helpers
// ============================================

const STORAGE_KEY_PREFIX = 'turbosap.company_code.draft.v1';

function getStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}.${userId}`;
}

function loadDraft(userId: string): CompanyCode[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDraft(userId: string, data: CompanyCode[]) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
}

// ============================================
// Validation Helpers
// ============================================

const REQUIRED_KEYS: (keyof CompanyCode)[] = [
  'companyCode',
  'companyName',
  'currency',
  'street',
  'city',
  'state',
  'zipCode',
  'country',
];

function isRowEmpty(row: CompanyCode): boolean {
  // A row is empty if no fields have any data
  return !row.companyCode && !row.companyName && !row.currency &&
         !row.street && !row.city && !row.state && !row.zipCode && !row.country;
}

function isRowComplete(row: CompanyCode): boolean {
  // A row is complete if ALL required fields are filled
  return REQUIRED_KEYS.every((key) => {
    const val = row[key];
    return typeof val === 'string' ? val.trim() !== '' : Boolean(val);
  });
}

function isRowPartial(row: CompanyCode): boolean {
  // A row is partial if it has some data but is not complete
  return !isRowEmpty(row) && !isRowComplete(row);
}

function getMissingFields(row: CompanyCode): string[] {
  return REQUIRED_KEYS.filter((key) => {
    const val = row[key];
    return typeof val === 'string' ? val.trim() === '' : !val;
  }).map((key) => {
    const col = COLUMNS.find((c) => c.key === key);
    return col?.label || key;
  });
}

// ============================================
// Empty Row Factory
// ============================================

function createEmptyRow(): CompanyCode {
  return {
    companyCode: '',
    companyName: '',
    shortName: '',
    currency: '',
    language: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    poBox: '',
    chartOfAccounts: '',
    fiscalYearVariant: '',
    vatRegistrationNumber: '',
    creditControlArea: '',
    negativePostingsPermitted: false,
    productiveFlag: false,
    taxJurisdictionCode: '',
  };
}

// ============================================
// Main Component
// ============================================

export function CompanyCodePage() {
  const { user } = useAuthStore();
  const userId = user?.userId ? String(user.userId) : 'anonymous';
  const notifyCompanyCodeChanged = useConfigStore((s) => s.notifyCompanyCodeChanged);

  const [rows, setRows] = useState<CompanyCode[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasChanges, setHasChanges] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Load data on mount
  useEffect(() => {
    const loaded = loadDraft(userId);
    if (loaded.length === 0) {
      // Start with one empty row
      setRows([createEmptyRow()]);
    } else {
      setRows(loaded);
    }
  }, [userId]);

  // Auto-save with debounce
  const triggerSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');
    setHasChanges(true);

    saveTimeoutRef.current = setTimeout(() => {
      saveDraft(userId, rows);
      // Notify store so status updates propagate
      notifyCompanyCodeChanged?.();
      setSaveStatus('saved');
      setHasChanges(false);

      // Reset to idle after 2s
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  }, [userId, rows, notifyCompanyCodeChanged]);

  // Trigger save when rows change
  useEffect(() => {
    if (rows.length > 0) {
      triggerSave();
    }
  }, [rows, triggerSave]);

  // Handle cell change
  const handleCellChange = (rowIndex: number, key: keyof CompanyCode, value: string | boolean) => {
    setRows((prev) => {
      const newRows = [...prev];
      newRows[rowIndex] = { ...newRows[rowIndex], [key]: value };
      return newRows;
    });
  };

  // Add new row
  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  // Delete row
  const handleDeleteRow = (index: number) => {
    setRows((prev) => {
      if (prev.length === 1) {
        // Keep at least one row, just clear it
        return [createEmptyRow()];
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Validation stats
  const completeRows = rows.filter(isRowComplete);
  const partialRows = rows.filter(isRowPartial);
  const validRowCount = completeRows.length;
  const incompleteRowCount = partialRows.length;

  // Calculate total table width (row number + columns + status + actions)
  const totalWidth = COLUMNS.reduce((sum, col) => sum + col.width, 0) + 110; // +40 row#, +30 status, +40 actions

  return (
    <DashboardLayout
      title="Company Codes"
      description="Configure SAP company codes - the organizational units for your enterprise structure"
    >
      <div className="flex flex-col h-[calc(100vh-140px)]">
        {/* Toolbar */}
        <div className="shrink-0 flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleAddRow}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Row
            </button>
            <span className="text-sm text-muted-foreground">
              {validRowCount} complete row{validRowCount !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Save Status */}
            <div className="flex items-center gap-2 text-sm">
              {saveStatus === 'saving' && (
                <>
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-muted-foreground">Saving...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="text-success">Saved</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Validation Banner - only show if there are incomplete rows */}
        {incompleteRowCount > 0 && (
          <div className="shrink-0 mb-4 px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              {incompleteRowCount} row{incompleteRowCount !== 1 ? 's have' : ' has'} missing required fields
            </span>
          </div>
        )}

        {/* Spreadsheet Container */}
        <div
          ref={tableRef}
          className="flex-1 overflow-auto bg-card border border-border rounded-lg"
        >
          <table
            className="border-collapse text-sm"
            style={{ minWidth: `${totalWidth}px` }}
          >
            {/* Header Row 1: Column Labels */}
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#4a5568] text-white">
                <th className="border-r border-gray-600 px-2 py-2 text-center font-medium w-10">
                  #
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="border-r border-gray-600 px-3 py-2 text-left font-medium whitespace-nowrap"
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="border-r border-gray-600 px-2 py-2 text-center font-medium w-8">

                </th>
                <th className="px-2 py-2 text-center font-medium w-10">

                </th>
              </tr>
              {/* Header Row 2: Required/Optional */}
              <tr className="bg-[#5a6778] text-gray-300 text-xs">
                <th className="border-r border-gray-600 px-2 py-1"></th>
                {COLUMNS.map((col) => (
                  <th
                    key={`req-${col.key}`}
                    className="border-r border-gray-600 px-3 py-1 text-left font-normal"
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.required ? 'Mandatory' : 'Optional'}
                  </th>
                ))}
                <th className="border-r border-gray-600 px-2 py-1"></th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>

            {/* Data Rows */}
            <tbody>
              {rows.map((row, rowIndex) => {
                const rowIsEmpty = isRowEmpty(row);
                const rowIsComplete = isRowComplete(row);
                const rowIsPartial = isRowPartial(row);
                const missing = rowIsPartial ? getMissingFields(row) : [];

                return (
                  <tr
                    key={rowIndex}
                    className={cn(
                      'border-b border-border hover:bg-secondary/50 transition-colors',
                      rowIndex % 2 === 0 ? 'bg-card' : 'bg-secondary/20'
                    )}
                  >
                    {/* Row Number */}
                    <td className="border-r border-border px-2 py-1 text-center text-muted-foreground bg-secondary/50 font-mono text-xs">
                      {rowIndex + 1}
                    </td>

                    {/* Data Cells */}
                    {COLUMNS.map((col, colIndex) => {
                      const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                      const value = row[col.key];
                      const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : (value || '');
                      const isMissing = col.required && !displayValue && !rowIsEmpty;

                      return (
                        <td
                          key={col.key}
                          className={cn(
                            'border-r border-border px-1 py-0.5',
                            isMissing && 'bg-red-50 dark:bg-red-950/20'
                          )}
                          style={{ width: col.width, minWidth: col.width }}
                          onClick={() => setEditingCell({ row: rowIndex, col: colIndex })}
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              value={displayValue}
                              onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  setEditingCell(null);
                                }
                                if (e.key === 'Tab') {
                                  e.preventDefault();
                                  const nextCol = colIndex + 1;
                                  if (nextCol < COLUMNS.length) {
                                    setEditingCell({ row: rowIndex, col: nextCol });
                                  } else if (rowIndex + 1 < rows.length) {
                                    setEditingCell({ row: rowIndex + 1, col: 0 });
                                  }
                                }
                                if (e.key === 'Escape') {
                                  setEditingCell(null);
                                }
                              }}
                              autoFocus
                              className="w-full px-2 py-1 border border-primary rounded bg-card text-foreground outline-none text-sm"
                              placeholder={col.placeholder}
                            />
                          ) : (
                            <div
                              className={cn(
                                'px-2 py-1 min-h-[28px] cursor-text rounded hover:bg-primary/5',
                                !displayValue && 'text-muted-foreground/50'
                              )}
                            >
                              {displayValue || col.placeholder}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Row Status */}
                    <td className="border-r border-border px-2 py-1 text-center">
                      {rowIsComplete && (
                        <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                      )}
                      {rowIsPartial && (
                        <div title={`Missing: ${missing.join(', ')}`}>
                          <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-1 text-center">
                      <button
                        onClick={() => handleDeleteRow(rowIndex)}
                        className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                        title="Delete row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Empty state row if no data */}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUMNS.length + 3}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    No company codes configured. Click "Add Row" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer hint */}
        <div className="shrink-0 mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Click any cell to edit. Press Tab to move to the next cell, Enter to confirm.</span>
          <span>Changes are auto-saved</span>
        </div>
      </div>
    </DashboardLayout>
  );
}
