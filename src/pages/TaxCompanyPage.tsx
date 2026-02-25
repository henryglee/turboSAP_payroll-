import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuthStore } from '../store/auth';
import { useConfigStore } from '../store';
import type { TaxCompany } from '../types';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

const STORAGE_KEY_PREFIX = 'turbosap.tax_company.draft.v1';

function getStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}.${userId}`;
}

function loadDraft(userId: string): TaxCompany[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDraft(userId: string, data: TaxCompany[]) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
}

export function TaxCompanyPage() {
  const { user } = useAuthStore();
  const userId = user?.userId ? String(user.userId) : 'anonymous';
  const notifyTaxCompanyChanged = useConfigStore((s: any) => s.notifyTaxCompanyChanged);

  const [rows, setRows] = useState<TaxCompany[]>([]);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [, setHasChanges] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loaded = loadDraft(userId);
    setRows(loaded);
  }, [userId]);

  const triggerSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');
    setHasChanges(true);

    saveTimeoutRef.current = setTimeout(() => {
      saveDraft(userId, rows);
      if (notifyTaxCompanyChanged) {
        notifyTaxCompanyChanged();
      }
      setSaveStatus('saved');
      setHasChanges(false);

      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  }, [userId, rows, notifyTaxCompanyChanged]);

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

      const idxName = headerIndex('name');
      const idxStreet = headerIndex('street');
      const idxCity = headerIndex('city');
      const idxState = headerIndex('state');
      const idxZipCode = headerIndex('zipcode');
      const idxCountry = headerIndex('country');

      if (idxName === -1 || idxStreet === -1 || idxCity === -1 || idxState === -1 || idxZipCode === -1 || idxCountry === -1) {
        alert('CSV is missing one or more required columns. Expected: name, street, city, state, zipcode, country.');
        return;
      }

      setRows((prev) => {
        let currentMaxCode = prev.reduce((max, row) => Math.max(max, row.code), 0);
        const importedRows: TaxCompany[] = csvRows
          .filter((r) => r.some((cell) => cell && cell.trim()))
          .map((r) => {
            currentMaxCode = currentMaxCode === 0 ? 1000 : currentMaxCode + 1000;
            return {
              code: currentMaxCode,
              name: (r[idxName] || '').slice(0, 40),
              address: {
                street: r[idxStreet] || '',
                city: r[idxCity] || '',
                state: (r[idxState] || '').slice(0, 2),
                zipCode: r[idxZipCode] || '',
                country: r[idxCountry] || 'US',
              },
            } as TaxCompany;
          });

        return importedRows;
      });
    };
    reader.readAsText(file);

    event.target.value = '';
  };

  const handleAddRow = () => {
    setRows((prev) => {
      const maxCode = prev.reduce((max, row) => Math.max(max, row.code), 0);
      const nextCode = maxCode === 0 ? 1000 : maxCode + 1000;
      return [...prev, { 
        code: nextCode, 
        name: '', 
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: 'US' // Default to US
        } 
      }];
    });
  };

  const handleDeleteRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCellChange = (rowIndex: number, field: keyof Omit<TaxCompany, 'code' | 'address'>, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex], [field]: value } as TaxCompany;
      next[rowIndex] = row;
      return next;
    });
  };

  const handleAddressChange = (rowIndex: number, field: keyof TaxCompany['address'], value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { 
        ...next[rowIndex], 
        address: { 
          ...next[rowIndex].address, 
          [field]: value 
        } 
      };
      next[rowIndex] = row;
      return next;
    });
  };

  return (
    <DashboardLayout
      title="Tax Companies"
      description="Maintain tax company names and addresses for export to SAP"
      currentPath="/tax-company"
    >
      <div className="flex flex-col h-[calc(100vh-140px)]">
        <div className="shrink-0 flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleAddRow}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Tax Company
            </button>
            <button
              onClick={handleImportClick}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Import CSV
            </button>
            <span className="text-sm text-muted-foreground">
              {rows.length} tax company{rows.length !== 1 ? ' records' : ' record'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {saveStatus === 'saving' && (
              <>
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-muted-foreground">Saving...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <span className="text-success">Saved</span>
            )}
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
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#4a5568] text-white">
                <th className="px-3 py-2 text-left font-medium w-24 border-r border-gray-600">Tax Company Code</th>
                <th className="px-3 py-2 text-left font-medium border-r border-gray-600">Tax Company Name (max 40)</th>
                <th className="px-3 py-2 text-left font-medium border-r border-gray-600">Street Address</th>
                <th className="px-3 py-2 text-left font-medium border-r border-gray-600">City</th>
                <th className="px-3 py-2 text-left font-medium border-r border-gray-600">State</th>
                <th className="px-3 py-2 text-left font-medium border-r border-gray-600">Postal Code</th>
                <th className="px-3 py-2 text-left font-medium border-r border-gray-600">Country</th>
                <th className="px-3 py-2 text-left font-medium border-r border-gray-600"></th>
                <th className="px-3 py-2 text-center font-medium w-10" />
              </tr>
              <tr className="bg-[#5a6778] text-gray-300 text-xs">
                <th className="px-3 py-1 text-left border-r border-gray-600">Auto-generated</th>
                <th className="px-3 py-1 text-left border-r border-gray-600">Required</th>
                <th className="px-3 py-1 text-left border-r border-gray-600">Required</th>
                <th className="px-3 py-1 text-left border-r border-gray-600">Optional</th>
                <th className="px-3 py-1 text-left border-r border-gray-600">Required</th>
                <th className="px-3 py-1 text-left border-r border-gray-600">Required</th>
                <th className="px-3 py-1 text-left border-r border-gray-600">Required</th>
                <th className="px-3 py-1 text-left border-r border-gray-600"></th>
                <th className="px-3 py-1" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.code}
                  className={cn(
                    'border-b border-border hover:bg-secondary/50 transition-colors',
                    index % 2 === 0 ? 'bg-card' : 'bg-secondary/20'
                  )}
                >
                  <td className="px-3 py-1 border-r border-border text-muted-foreground font-mono text-xs">
                    {row.code}
                  </td>
                  <td
                    className="px-3 py-1 border-r border-border cursor-text"
                    onClick={() => setEditingRow(index)}
                  >
                    {editingRow === index ? (
                      <input
                        type="text"
                        value={row.name}
                        maxLength={40}
                        onChange={(e) => handleCellChange(index, 'name', e.target.value)}
                        onBlur={() => setEditingRow(null)}
                        className="w-full px-2 py-1 border border-primary rounded bg-card text-foreground outline-none text-sm"
                        placeholder="Tax company legal name"
                        autoFocus
                      />
                    ) : (
                      <div
                        className={cn(
                          'px-2 py-1 min-h-[28px] rounded',
                          !row.name && 'text-muted-foreground/50'
                        )}
                      >
                        {row.name || 'Enter tax company name'}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1 border-r border-border">
                    <input
                      type="text"
                      value={row.address.street}
                      onChange={(e) => handleAddressChange(index, 'street', e.target.value)}
                      className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none text-sm"
                      placeholder="Street address"
                    />
                  </td>
                  <td className="px-3 py-1 border-r border-border">
                    <input
                      type="text"
                      value={row.address.city}
                      onChange={(e) => handleAddressChange(index, 'city', e.target.value)}
                      className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none text-sm"
                      placeholder="City"
                    />
                  </td>
                  <td className="px-3 py-1 border-r border-border">
                    <input
                      type="text"
                      value={row.address.state}
                      onChange={(e) => handleAddressChange(index, 'state', e.target.value)}
                      className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none text-sm"
                      placeholder="State/Province"
                      maxLength={2}
                    />
                  </td>
                  <td className="px-3 py-1 border-r border-border">
                    <input
                      type="text"
                      value={row.address.zipCode}
                      onChange={(e) => handleAddressChange(index, 'zipCode', e.target.value)}
                      className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none text-sm"
                      placeholder="Postal code"
                    />
                  </td>
                  <td className="px-3 py-1 border-r border-border">
                    <select
                      value={row.address.country}
                      onChange={(e) => handleAddressChange(index, 'country', e.target.value)}
                      className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none text-sm"
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="MX">Mexico</option>
                    </select>
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button
                      onClick={() => handleDeleteRow(index)}
                      className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      title="Delete row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    No tax companies configured. Click "Add Tax Company" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 mt-3 text-xs text-muted-foreground">
          Tax company code starts at 1000 and increments by 1000 for each new entry. Name is limited to 40 characters.
        </div>
      </div>
    </DashboardLayout>
  );
}
