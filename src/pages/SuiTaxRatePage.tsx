import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuthStore } from '../store/auth';
import { getTaxReference, type TaxReferenceResponse } from '../api/taxReference';
import { cn } from '../lib/utils';

const STORAGE_KEY_PREFIX = 'turbosap.sui_tax_rate_grid.draft.v1';
function getStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}.${userId}`;
}

type SuiTaxRateGridDraft = Record<string, SuiTaxRateRow[]>;

interface SuiTaxRateRow {
  tax_company_code: string;
  state: string;
  sui_tax_rate: string;
}

function loadGridDraft(userId: string): SuiTaxRateGridDraft {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGridDraft(userId: string, data: SuiTaxRateGridDraft) {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
  } catch {
  }
}

const TAX_COMPANY_KEY_PREFIX = 'turbosap.tax_company.draft.v1';
function getTaxCompanyKey(userId: string) {
  return `${TAX_COMPANY_KEY_PREFIX}.${userId}`;
}

interface TaxCompanyDraftItem { code: number; name: string; }

function loadTaxCompanies(userId: string): TaxCompanyDraftItem[] {
  try {
    const raw = localStorage.getItem(getTaxCompanyKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function buildDefaultRows(taxRef: TaxReferenceResponse, taxCompanyCode: string): SuiTaxRateRow[] {
  const rows: SuiTaxRateRow[] = [];

  const states = Object.values(taxRef.states).sort((a, b) => a.name.localeCompare(b.name));
  for (const st of states) {
    rows.push({
      tax_company_code: taxCompanyCode,
      state: st.code,
      sui_tax_rate: '',
    });
  }

  return rows;
}

export function SuiTaxRatePage() {
  const { user } = useAuthStore();
  const userId = user?.userId ? String(user.userId) : 'anonymous';

  const [taxRef, setTaxRef] = useState<TaxReferenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<SuiTaxRateGridDraft>({});
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>('');
  const [rows, setRows] = useState<SuiTaxRateRow[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [statePasteText, setStatePasteText] = useState('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleRevert = () => {
    if (!taxRef || !selectedCompanyCode) return;
    const ok = window.confirm('This will discard all SUI tax rate edits for this tax company and restore the default state list. Continue?');
    if (!ok) return;
    const def = buildDefaultRows(taxRef, selectedCompanyCode);
    setRows(def);
    setDraft((prev) => ({ ...prev, [selectedCompanyCode]: def }));
    saveGridDraft(userId, { ...draft, [selectedCompanyCode]: def });
  };

  useEffect(() => {
    const d = loadGridDraft(userId);
    setDraft(d);

    async function loadRef() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTaxReference();
        setTaxRef(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tax reference');
      } finally {
        setLoading(false);
      }
    }

    loadRef();
  }, [userId]);

  const taxCompanies = useMemo(() => loadTaxCompanies(userId), [userId]);

  useEffect(() => {
    if (!selectedCompanyCode && taxCompanies.length > 0) {
      setSelectedCompanyCode(String(taxCompanies[0].code));
    }
  }, [taxCompanies, selectedCompanyCode]);

  useEffect(() => {
    if (!selectedCompanyCode) return;
    const existing = draft[selectedCompanyCode];
    if (existing && existing.length > 0) {
      setRows(existing);
    } else if (taxRef) {
      const def = buildDefaultRows(taxRef, selectedCompanyCode);
      setRows(def);
      setDraft((prev) => ({ ...prev, [selectedCompanyCode]: def }));
    }
  }, [selectedCompanyCode, draft, taxRef]);

  const triggerSave = useCallback(() => {
    if (!selectedCompanyCode) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const next = { ...draft, [selectedCompanyCode]: rows } as SuiTaxRateGridDraft;
      setDraft(next);
      saveGridDraft(userId, next);
    }, 500);
  }, [userId, draft, rows, selectedCompanyCode]);

  useEffect(() => {
    triggerSave();
  }, [rows, triggerSave]);

  const parseCSV = (content: string): { headers: string[]; rows: string[][] } => {
    const lines = content.split('\n').filter((line) => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current);
      return result;
    };

    const headers = parseRow(lines[0]);
    const dataRows = lines.slice(1).map(parseRow);
    return { headers, rows: dataRows };
  };

  const handleImportClick = () => {
    if (!selectedCompanyCode) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (!text) return;

      const { headers, rows: csvRows } = parseCSV(text);
      if (headers.length === 0) return;

      const headerIndex = (name: string) => headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());

      const idxState = headerIndex('state');
      const idxSuiTaxRate = headerIndex('sui_tax_rate');

      if (idxState === -1 || idxSuiTaxRate === -1) {
        alert('CSV is missing required columns: State and/or SUI_Tax_Rate.');
        return;
      }

      const importedRows: SuiTaxRateRow[] = csvRows.map((r) => {
        const suiTaxRateValue = (r[idxSuiTaxRate] || '').slice(0, 10);
        return {
          tax_company_code: selectedCompanyCode,
          state: r[idxState] || '',
          sui_tax_rate: suiTaxRateValue,
        };
      });

      setRows(importedRows);
    };
    reader.readAsText(file);

    event.target.value = '';
  };

  const columns = [
    { key: 'tax_company_code', label: 'Tax Company Code', width: 140 },
    { key: 'state', label: 'State', width: 120 },
    { key: 'sui_tax_rate', label: 'SUI Tax Rate (max 10)', width: 180 },
  ] as const;

  const handleApplyStatePaste = () => {
    const lines = statePasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '');

    if (lines.length === 0) return;

    setRows((prev) =>
      prev.map((row, idx) => ({
        ...row,
        state: lines[idx] !== undefined ? lines[idx].slice(0, 10) : row.state,
      }))
    );
  };

  const handleApplyPaste = () => {
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '');

    if (lines.length === 0) return;

    setRows((prev) =>
      prev.map((row, idx) => ({
        ...row,
        sui_tax_rate: lines[idx] !== undefined ? lines[idx].slice(0, 10) : row.sui_tax_rate,
      }))
    );
  };

  return (
    <DashboardLayout
      title="SUI Tax Rates"
      description="Maintain SUI tax rates per state, per tax company"
      currentPath="/sui-tax-rate"
    >
      <div className="flex flex-col h-[calc(100vh-140px)]">
        <div className="shrink-0 mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">Tax Company</label>
            <select
              value={selectedCompanyCode}
              onChange={(e) => setSelectedCompanyCode(e.target.value)}
              className="px-3 py-2 text-sm rounded-md border border-input bg-background min-w-[140px]"
              disabled={taxCompanies.length === 0}
            >
              {taxCompanies.length === 0 && <option value="">No tax companies</option>}
              {taxCompanies.map((c) => (
                <option key={c.code} value={String(c.code)}>{c.code}</option>
              ))}
            </select>

            {loading && <span className="text-xs text-muted-foreground">Loading reference...</span>}
            {error && <span className="text-xs text-destructive">{error}</span>}
          </div>

          <div className="flex flex-col items-end gap-2 text-xs min-w-[260px]">
            <div className="w-full flex flex-col gap-1">
              <div className="flex gap-4">
                <div className="w-1/2 flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">Bulk paste States</label>
                  <textarea
                    value={statePasteText}
                    onChange={(e) => setStatePasteText(e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1 border border-input rounded bg-background text-foreground text-xs resize-none"
                    placeholder={"e.g.\nCA\nNY\n..."}
                  />
                  <div className="flex justify-end gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setStatePasteText('')}
                      className="px-2 py-1 rounded-md border bg-secondary text-foreground hover:bg-secondary/80"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyStatePaste}
                      className="px-3 py-1 rounded-md border bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                      disabled={!selectedCompanyCode || rows.length === 0}
                    >
                      Apply
                    </button>
                  </div>
                </div>
                <div className="w-1/2 flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">Bulk paste SUI tax rates</label>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1 border border-input rounded bg-background text-foreground text-xs resize-none"
                    placeholder={"e.g.\n3.40\n2.75\n..."}
                  />
                  <div className="flex justify-end gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setPasteText('')}
                      className="px-2 py-1 rounded-md border bg-secondary text-foreground hover:bg-secondary/80"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyPaste}
                      className="px-3 py-1 rounded-md border bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                      disabled={!selectedCompanyCode || rows.length === 0}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={handleImportClick}
                className="px-3 py-1.5 rounded-md border bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={!selectedCompanyCode}
              >
                Import CSV
              </button>
              <button
                type="button"
                onClick={handleRevert}
                className="px-3 py-1.5 rounded-md border bg-destructive text-destructive-foreground hover:opacity-90"
                disabled={!selectedCompanyCode}
              >
                Revert to Default States
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-card border border-border rounded-lg">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <table className="border-collapse text-sm" style={{ minWidth: '700px' }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#4a5568] text-white">
                <th className="px-2 py-2 text-center font-medium w-10 border-r border-gray-600">#</th>
                {columns.map((c) => (
                  <th
                    key={c.key as string}
                    className="px-3 py-2 text-left font-medium border-r border-gray-600 whitespace-nowrap"
                    style={{ width: (c as any).width, minWidth: (c as any).width }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
              <tr className="bg-[#5a6778] text-gray-300 text-xs">
                <th className="px-2 py-1 text-center border-r border-gray-600" />
                {columns.map((c) => (
                  <th
                    key={'req-' + (c.key as string)}
                    className="px-3 py-1 text-left border-r border-gray-600"
                  >
                    {c.key === 'sui_tax_rate' || c.key === 'state' ? 'Editable' : 'Pre-filled'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className={cn(
                    'border-b border-border hover:bg-secondary/50 transition-colors',
                    idx % 2 === 0 ? 'bg-card' : 'bg-secondary/20'
                  )}
                >
                  <td className="px-2 py-1 text-center text-muted-foreground bg-secondary/50 font-mono text-xs border-r border-border">
                    {idx + 1}
                  </td>
                  <td className="px-2 py-1 border-r border-border text-muted-foreground">
                    {row.tax_company_code}
                  </td>
                  <td className="px-2 py-1 border-r border-border">
                    <input
                      type="text"
                      value={row.state}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRows((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], state: val };
                          return next;
                        });
                      }}
                      className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none"
                      placeholder="State code (e.g., CA)"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.sui_tax_rate}
                      maxLength={10}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 10);
                        setRows((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], sui_tax_rate: val };
                          return next;
                        });
                      }}
                      className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none"
                      placeholder="Enter SUI tax rate"
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    {taxCompanies.length === 0
                      ? 'Create a Tax Company first.'
                      : 'Select a Tax Company to initialize its SUI Tax Rate sheet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            State rows are pre-filled from reference. Tax Company Code is not editable. Changes auto-save per tax company.
          </span>
          <span>
            {rows.filter((r) => r.sui_tax_rate.trim() !== '').length} states with SUI tax rate set
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}
