import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuthStore } from '../store/auth';
import { getTaxReference, type TaxReferenceResponse } from '../api/taxReference';
import type { TaxIdGridRow } from '../utils/fileGenerators';
import { cn } from '../lib/utils';

// LocalStorage per-user, grid format keyed by tax company code
const STORAGE_KEY_PREFIX = 'turbosap.tax_id_grid.draft.v2';
function getStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}.${userId}`;
}

type TaxIdGridDraft = Record<string, TaxIdGridRow[]>; // key: tax_company_code

function loadGridDraft(userId: string): TaxIdGridDraft {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGridDraft(userId: string, data: TaxIdGridDraft) {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
  } catch {
    // ignore
  }
}

// Load tax companies from their draft to build the dropdown
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

function buildDefaultRows(taxRef: TaxReferenceResponse, taxCompanyCode: string): TaxIdGridRow[] {
  const rows: TaxIdGridRow[] = [];

  const pushRows = (authorityCode: string, authorityName: string, taxTypes: string[], hasLocal?: boolean) => {
    const hasLocalStr = hasLocal ? 'Yes' : 'No';
    for (const ttCode of taxTypes) {
      const tt = taxRef.taxTypeCodes[ttCode];
      if (!tt) continue;
      rows.push({
        tax_company_code: taxCompanyCode,
        tax_authority: authorityCode,
        authority_description: authorityName,
        county: '',
        tax_type_code: ttCode,
        tax_type_name: tt.name,
        paid_by: tt.paidBy,
        has_local_taxes: hasLocalStr,
        tax_id: '',
      });
    }
  };

  // Federal
  pushRows(taxRef.federal.code, taxRef.federal.name, taxRef.federal.taxTypes, false);
  // States
  const states = Object.values(taxRef.states).sort((a, b) => a.name.localeCompare(b.name));
  for (const st of states) {
    pushRows(st.code, st.name, st.taxTypes, st.hasLocalTaxes);
  }

  return rows;
}

export function TaxIdPage() {
  const { user } = useAuthStore();
  const userId = user?.userId ? String(user.userId) : 'anonymous';

  const [taxRef, setTaxRef] = useState<TaxReferenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<TaxIdGridDraft>({});
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>('');
  const [rows, setRows] = useState<TaxIdGridRow[]>([]);
  const [activeTab, setActiveTab] = useState<'spreadsheet' | 'components'>('spreadsheet');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const handleAddRow = () => {
    if (!selectedCompanyCode) return;
    const newRow: TaxIdGridRow = {
      tax_company_code: selectedCompanyCode,
      tax_authority: '',
      authority_description: '',
      county: '',
      tax_type_code: '',
      tax_type_name: '',
      paid_by: '',
      has_local_taxes: '',
      tax_id: '',
    };
    setRows((prev) => [...prev, newRow]);
  };

  const handleDeleteRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRevert = () => {
    if (!selectedCompanyCode) return;
    const ok = window.confirm('This will discard all edits for this tax company and restore a blank sheet. Continue?');
    if (!ok) return;
    const empty: TaxIdGridRow[] = [];
    setRows(empty);
    setDraft((prev) => ({ ...prev, [selectedCompanyCode]: empty }));
    saveGridDraft(userId, { ...draft, [selectedCompanyCode]: empty });
  };

  // Load tax reference and existing draft
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

  // Build tax company dropdown options
  const taxCompanies = useMemo(() => loadTaxCompanies(userId), [userId]);

  // Initialize selection when tax companies become available
  useEffect(() => {
    if (!selectedCompanyCode && taxCompanies.length > 0) {
      setSelectedCompanyCode(String(taxCompanies[0].code));
    }
  }, [taxCompanies, selectedCompanyCode]);

  // When selection changes, load or initialize its rows
  useEffect(() => {
    if (!selectedCompanyCode) return;
    const existing = draft[selectedCompanyCode];
    if (existing && existing.length > 0) {
      setRows(existing);
    } else {
      setRows([]);
    }
  }, [selectedCompanyCode, draft, taxRef]);

  // Debounced save when rows change
  const triggerSave = useCallback(() => {
    if (!selectedCompanyCode) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const next = { ...draft, [selectedCompanyCode]: rows } as TaxIdGridDraft;
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (!text) return;

      const { headers, rows: csvRows } = parseCSV(text);
      if (headers.length === 0) return;

      const headerIndex = (name: string) => headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());

      const idxTaxAuthority = headerIndex('tax_authority');
      const idxAuthorityDescription = headerIndex('authority_description');
      const idxCounty = headerIndex('county');
      const idxTaxTypeCode = headerIndex('tax_type_code');
      const idxTaxTypeName = headerIndex('tax_type_name');
      const idxPaidBy = headerIndex('paid_by');
      const idxHasLocalTaxes = headerIndex('has_local_taxes');
      const idxTaxId = headerIndex('tax_id');

      if (
        idxTaxAuthority === -1 ||
        idxAuthorityDescription === -1 ||
        idxTaxTypeCode === -1 ||
        idxTaxTypeName === -1 ||
        idxPaidBy === -1 ||
        idxHasLocalTaxes === -1 ||
        idxTaxId === -1
      ) {
        alert('CSV is missing one or more required columns.');
        return;
      }

      const importedRows: TaxIdGridRow[] = csvRows.map((r) => {
        const taxIdValue = (r[idxTaxId] || '').slice(0, 15);
        return {
          tax_company_code: selectedCompanyCode,
          tax_authority: r[idxTaxAuthority] || '',
          authority_description: r[idxAuthorityDescription] || '',
          county: idxCounty === -1 ? '' : (r[idxCounty] || ''),
          tax_type_code: r[idxTaxTypeCode] || '',
          tax_type_name: r[idxTaxTypeName] || '',
          paid_by: r[idxPaidBy] || '',
          has_local_taxes: r[idxHasLocalTaxes] || '',
          tax_id: taxIdValue,
        };
      });

      setRows(importedRows);
    };
    reader.readAsText(file);

    event.target.value = '';
  };

  // Spreadsheet columns config
  const columns = [
    { key: 'tax_company_code', label: 'Tax Company Code', width: 140 },
    { key: 'tax_authority', label: 'Tax Authority', width: 100 },
    { key: 'authority_description', label: 'Authority Description', width: 220 },
    { key: 'county', label: 'County', width: 160 },
    { key: 'tax_type_code', label: 'Tax Type Code', width: 120 },
    { key: 'tax_type_name', label: 'Tax Type Name', width: 220 },
    { key: 'paid_by', label: 'Paid By', width: 100 },
    { key: 'has_local_taxes', label: 'Has Local Taxes', width: 140 },
    { key: 'tax_id', label: 'Tax ID (max 15)', width: 160 },
  ] as const;
  type ColumnKey = (typeof columns)[number]['key'];

  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(() => {
    const initial: Record<ColumnKey, boolean> = {} as Record<ColumnKey, boolean>;
    columns.forEach((c) => {
      initial[c.key] = true;
    });
    return initial;
  });

  // Components tab: grouped view by authority, single Tax ID editor that writes to all rows for that authority
  const authorities = useMemo(() => {
    const map = new Map<string, { name: string; hasLocal: string }>();
    rows.forEach((r) => {
      if (!map.has(r.tax_authority)) {
        map.set(r.tax_authority, { name: r.authority_description, hasLocal: r.has_local_taxes });
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [rows]);

  const getAuthorityTaxId = (authCode: string): string => {
    // If multiple rows exist, prefer first non-empty tax_id
    const r = rows.find((r) => r.tax_authority === authCode && r.tax_id.trim() !== '');
    return r ? r.tax_id : '';
  };

  const setAuthorityTaxId = (authCode: string, val: string) => {
    const value = val.slice(0, 15);
    setRows((prev) => prev.map((r) => (r.tax_authority === authCode ? { ...r, tax_id: value } : r)));
  };

  return (
    <DashboardLayout
      title="Tax IDs"
      description="Maintain Tax IDs per authority and tax type, per tax company"
      currentPath="/tax-id"
    >
      <div className="flex flex-col h-[calc(100vh-140px)]">
        {/* Toolbar */}
        <div className="shrink-0 mb-4 flex items-center justify-between">
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

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleImportClick}
              className="px-3 py-1.5 rounded-md border bg-blue-600 text-white hover:bg-blue-700"
              disabled={!selectedCompanyCode}
            >
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('spreadsheet')}
              className={cn('px-3 py-1.5 rounded-md border', activeTab === 'spreadsheet' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border')}
            >
              Spreadsheet
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('components')}
              className={cn('px-3 py-1.5 rounded-md border', activeTab === 'components' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border')}
            >
              Components
            </button>
            <span className="mx-2 opacity-30">|</span>
            <button
              type="button"
              onClick={handleAddRow}
              className="px-3 py-1.5 rounded-md border bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!selectedCompanyCode}
            >
              Add Row
            </button>
            <button
              type="button"
              onClick={handleRevert}
              className="px-3 py-1.5 rounded-md border bg-destructive text-destructive-foreground hover:opacity-90"
              disabled={!selectedCompanyCode}
            >
              Revert to Original
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'spreadsheet' ? (
          <div className="flex-1 overflow-auto bg-card border border-border rounded-lg">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="px-3 py-2 border-b border-border flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium">Columns:</span>
              {columns.map((c) => (
                <label key={c.key as string} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={visibleColumns[c.key]}
                    onChange={() =>
                      setVisibleColumns((prev) => ({
                        ...prev,
                        [c.key]: !prev[c.key],
                      }))
                    }
                    className="h-3 w-3"
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
            <table className="border-collapse text-sm" style={{ minWidth: '1100px' }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#4a5568] text-white">
                  <th className="px-2 py-2 text-center font-medium w-10 border-r border-gray-600">#</th>
                  {columns
                    .filter((c) => visibleColumns[c.key])
                    .map((c) => (
                      <th
                        key={c.key as string}
                        className="px-3 py-2 text-left font-medium border-r border-gray-600 whitespace-nowrap"
                        style={{ width: (c as any).width, minWidth: (c as any).width }}
                      >
                        {c.label}
                      </th>
                    ))}
                  <th className="px-3 py-2 text-left font-medium border-gray-600">Action</th>
                </tr>
                <tr className="bg-[#5a6778] text-gray-300 text-xs">
                  <th className="px-2 py-1 text-center border-r border-gray-600"></th>
                  {columns
                    .filter((c) => visibleColumns[c.key])
                    .map((c) => (
                      <th
                        key={'req-' + (c.key as string)}
                        className="px-3 py-1 text-left border-r border-gray-600"
                      >
                        {c.key === 'tax_id' ? 'Required' : 'Pre-filled'}
                      </th>
                    ))}
                  <th className="px-3 py-1 text-left border-gray-600"></th>
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
                    {/* tax_company_code (read-only) */}
                    {visibleColumns.tax_company_code && (
                      <td className="px-2 py-1 border-r border-border text-muted-foreground">
                        {row.tax_company_code}
                      </td>
                    )}
                    {/* tax_authority (editable) */}
                    {visibleColumns.tax_authority && (
                      <td className="px-2 py-1 border-r border-border">
                        <input
                          type="text"
                          value={row.tax_authority}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], tax_authority: val };
                              return next;
                            });
                          }}
                          className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none"
                          placeholder="Tax authority code"
                        />
                      </td>
                    )}
                    {/* authority_description (editable) */}
                    {visibleColumns.authority_description && (
                      <td className="px-2 py-1 border-r border-border">
                        <input
                          type="text"
                          value={row.authority_description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], authority_description: val };
                              return next;
                            });
                          }}
                          className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none"
                          placeholder="Authority name"
                        />
                      </td>
                    )}
                    {/* county (editable) */}
                    {visibleColumns.county && (
                      <td className="px-2 py-1 border-r border-border">
                        <input
                          type="text"
                          value={row.county}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], county: val };
                              return next;
                            });
                          }}
                          className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none"
                          placeholder="County"
                        />
                      </td>
                    )}
                    {/* tax_type_code (editable) */}
                    {visibleColumns.tax_type_code && (
                      <td className="px-2 py-1 border-r border-border">
                        <input
                          type="text"
                          value={row.tax_type_code}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], tax_type_code: val };
                              return next;
                            });
                          }}
                          className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none"
                          placeholder="Tax type code"
                        />
                      </td>
                    )}
                    {/* tax_type_name (editable) */}
                    {visibleColumns.tax_type_name && (
                      <td className="px-2 py-1 border-r border-border">
                        <input
                          type="text"
                          value={row.tax_type_name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], tax_type_name: val };
                              return next;
                            });
                          }}
                          className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none"
                          placeholder="Tax type name"
                        />
                      </td>
                    )}
                    {/* paid_by (editable) */}
                    {visibleColumns.paid_by && (
                      <td className="px-2 py-1 border-r border-border">
                        <input
                          type="text"
                          value={row.paid_by}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], paid_by: val };
                              return next;
                            });
                          }}
                          className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none"
                          placeholder="employee / employer"
                        />
                      </td>
                    )}
                    {/* has_local_taxes (editable) */}
                    {visibleColumns.has_local_taxes && (
                      <td className="px-2 py-1 border-r border-border">
                        <input
                          type="text"
                          value={row.has_local_taxes}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], has_local_taxes: val };
                              return next;
                            });
                          }}
                          className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none"
                          placeholder="Yes / No"
                        />
                      </td>
                    )}
                    {/* tax_id editable */}
                    {visibleColumns.tax_id && (
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={row.tax_id}
                          maxLength={15}
                          onChange={(e) => {
                            const val = e.target.value.slice(0, 15);
                            setRows((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], tax_id: val };
                              return next;
                            });
                          }}
                          className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none"
                          placeholder="Enter Tax ID"
                        />
                      </td>
                    )}
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(idx)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // Components tab
          <div className="flex-1 overflow-auto bg-card border border-border rounded-lg p-4">
            {rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No rows. Select a Tax Company to begin.</div>
            ) : (
              <div className="space-y-4">
                {authorities.map(([code, info]) => (
                  <div key={code} className="rounded-lg border border-border p-3">
                    <div className="text-xs text-muted-foreground mb-1">{code} • {info.name} {info.hasLocal === 'Yes' ? '(has local taxes)' : ''}</div>
                    <div className="max-w-sm">
                      <label className="block text-sm font-medium text-foreground mb-1">Tax ID for {info.name}</label>
                      <input
                        type="text"
                        value={getAuthorityTaxId(code)}
                        maxLength={15}
                        onChange={(e) => setAuthorityTaxId(code, e.target.value)}
                        className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Enter Tax ID (max 15 characters)"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Applies to all tax types for this authority.</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="shrink-0 mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Rows are pre-filled from reference. Only Tax Company Code is not editable. Changes auto-save per tax company.</span>
          <span>{rows.filter((r) => r.tax_id.trim() !== '').length} authorities set</span>
        </div>
      </div>
    </DashboardLayout>
  );
}
