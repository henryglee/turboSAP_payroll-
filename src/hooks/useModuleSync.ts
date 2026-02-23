/**
 * useModuleSync - Hook for syncing legacy module localStorage data to the backend
 *
 * Reads the localStorage key declared in each legacy module's config.json (dataAccess.storageKey),
 * and POSTs the data to POST /api/modules/{slug}/sync when triggered.
 *
 * The backend adapter validates, normalizes, and generates CSV outputs — the same format
 * generic modules produce via module_runner + output_generator.
 */

import { useCallback, useState } from 'react';
import { syncLegacyModule, type LegacySyncResult } from '../api/modules';

// Legacy module localStorage key mapping (from config.json dataAccess.storageKey)
const LEGACY_STORAGE_KEYS: Record<string, { storageKey: string; storePath?: string }> = {
  'payroll-area': { storageKey: 'turbosap-config', storePath: 'state.payrollAreas' },
  'employee-group': { storageKey: 'turbosap-employee-group', storePath: 'state' },
  'personnel-area': { storageKey: 'turbosap-personnel-area-v2', storePath: 'state' },
};

function readLocalStorageData(slug: string): Record<string, unknown> | null {
  const config = LEGACY_STORAGE_KEYS[slug];
  if (!config) return null;

  try {
    const raw = localStorage.getItem(config.storageKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export interface ModuleSyncState {
  syncing: boolean;
  lastResult: LegacySyncResult | null;
  error: string | null;
}

/**
 * Hook for syncing a single legacy module's localStorage data to the backend.
 *
 * Usage:
 *   const { sync, syncing, lastResult, error } = useModuleSync('payroll-area');
 *   // Call sync() when user finishes the module or clicks "Save"
 */
export function useModuleSync(slug: string) {
  const [state, setState] = useState<ModuleSyncState>({
    syncing: false,
    lastResult: null,
    error: null,
  });

  const sync = useCallback(async (): Promise<LegacySyncResult | null> => {
    const data = readLocalStorageData(slug);
    if (!data) {
      setState((s) => ({ ...s, error: `No localStorage data found for ${slug}` }));
      return null;
    }

    setState({ syncing: true, lastResult: null, error: null });

    try {
      const result = await syncLegacyModule(slug, data);
      setState({ syncing: false, lastResult: result, error: null });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setState({ syncing: false, lastResult: null, error: message });
      return null;
    }
  }, [slug]);

  return {
    sync,
    syncing: state.syncing,
    lastResult: state.lastResult,
    error: state.error,
  };
}

/**
 * Sync all legacy modules at once.
 * Useful for an "Export All" or "Sync All" button.
 */
export function useSyncAllLegacyModules() {
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<Record<string, LegacySyncResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const syncAll = useCallback(async () => {
    setSyncing(true);
    setResults({});
    setErrors({});

    const newResults: Record<string, LegacySyncResult> = {};
    const newErrors: Record<string, string> = {};

    for (const slug of Object.keys(LEGACY_STORAGE_KEYS)) {
      const data = readLocalStorageData(slug);
      if (!data) {
        newErrors[slug] = 'No localStorage data found';
        continue;
      }

      try {
        const result = await syncLegacyModule(slug, data);
        newResults[slug] = result;
      } catch (err) {
        newErrors[slug] = err instanceof Error ? err.message : 'Sync failed';
      }
    }

    setResults(newResults);
    setErrors(newErrors);
    setSyncing(false);

    return { results: newResults, errors: newErrors };
  }, []);

  return { syncAll, syncing, results, errors };
}
