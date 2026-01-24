/**
 * Export Utilities
 * Centralized functions for CSV generation, file downloads, and data formatting
 */

// ============================================
// CSV Utilities
// ============================================

/**
 * Escape a value for CSV format (RFC 4180 compliant)
 */
export function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects to CSV string
 */
export function toCSV<T extends Record<string, unknown>>(
  rows: T[],
  headers: (keyof T)[]
): string {
  const headerRow = headers.map(h => escapeCSV(String(h))).join(',');
  const dataRows = rows.map(row =>
    headers.map(h => escapeCSV(row[h])).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Convert an array of objects to CSV with custom header labels
 */
export function toCSVWithLabels<T>(
  rows: T[],
  columns: { key: keyof T; label: string }[]
): string {
  const headerRow = columns.map(c => escapeCSV(c.label)).join(',');
  const dataRows = rows.map(row =>
    columns.map(c => escapeCSV((row as Record<string, unknown>)[c.key as string])).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

// ============================================
// Download Utilities
// ============================================

/**
 * Download content as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download content as CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const name = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  downloadFile(content, name, 'text/csv');
}

/**
 * Download content as JSON file
 */
export function downloadJSON(data: unknown, filename: string): void {
  const name = filename.endsWith('.json') ? filename : `${filename}.json`;
  const content = JSON.stringify(data, null, 2);
  downloadFile(content, name, 'application/json');
}

/**
 * Download multiple files as a ZIP
 * Uses JSZip if available, otherwise downloads sequentially
 */
export async function downloadAsZip(
  files: { name: string; content: string }[],
  zipName: string
): Promise<void> {
  // Dynamic import JSZip to avoid bundling if not used
  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    files.forEach(file => {
      zip.file(file.name, file.content);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    // Fallback: download files sequentially with delay
    console.warn('JSZip not available, downloading files individually');
    for (let i = 0; i < files.length; i++) {
      downloadCSV(files[i].content, files[i].name);
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }
}

// ============================================
// Date Formatting Utilities
// ============================================

/**
 * Format date as M/D/YYYY for CSV export
 */
export function formatDateForCSV(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

/**
 * Format date as MM/DD/YYYY for CSV export
 */
export function formatDatePadded(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}/${date.getFullYear()}`;
}

/**
 * Get the last day of a month
 */
export function getLastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months to a date
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// ============================================
// SAP Constants
// ============================================

export const SAP_DEFAULTS = {
  PAYROLL_AREA_TEXT: 'McCarthy',
  RUN_PAYROLL: 'X',
  DATE_MODIFIER: '0',
  TIME_UNIT: '03',
  CALENDAR_START_DATE: '1/1/1990',
  MOLGA: '10',
  DATE_TYPE: '01',
  PAY_DATE_ANCHOR: new Date(2025, 0, 3),  // Jan 3, 2025
  PERIOD_ANCHOR: new Date(2024, 11, 23),   // Dec 23, 2024
} as const;

export const PAYDAY_TO_WEEKDAY: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  semimonthly: 'Semi-monthly',
  monthly: 'Monthly',
};
