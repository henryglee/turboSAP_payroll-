import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type OrgType = 'single' | 'regional' | 'divisional' | null;
export type WizardScreen = '1.1' | '1.2' | '2.1' | '2.2' | '3.1' | '3.2' | '4.1';

export interface Region {
  id: string;
  code: string;           // 4 chars (e.g., "1000")
  name: string;           // e.g., "Southwest"
  needsSubareas: boolean;
}

export interface Subarea {
  id: string;
  regionId: string;
  code: string;           // 4 chars (e.g., "PHX1")
  description: string;    // max 15 chars
  notes?: string;
}

export interface CompanyCode {
  code: string;
  name: string;
}

export interface PersonnelAreaV2State {
  // Navigation
  currentScreen: WizardScreen;

  // Phase 1: Organization structure
  orgType: OrgType;
  regions: Region[];

  // Phase 2: Difference factors
  differenceFactors: string[];  // ['pay', 'benefits', 'pto', etc.]

  // Phase 3: Subareas and company codes
  subareas: Subarea[];
  companyCodeMode: 'same' | 'individual';
  globalCompanyCode: string;
  regionCompanyCodes: Record<string, string>;  // regionId -> companyCode

  // Company codes loaded from localStorage
  availableCompanyCodes: CompanyCode[];
}

export interface PersonnelAreaV2Actions {
  // Navigation
  setScreen: (screen: WizardScreen) => void;
  goBack: () => void;
  goNext: () => void;

  // Phase 1
  setOrgType: (type: OrgType) => void;
  addRegion: () => void;
  updateRegion: (id: string, updates: Partial<Omit<Region, 'id'>>) => void;
  removeRegion: (id: string) => void;

  // Phase 2
  toggleDifferenceFactor: (factor: string) => void;
  setRegionNeedsSubareas: (regionId: string, needsSubareas: boolean) => void;

  // Phase 3
  addSubarea: (regionId: string) => void;
  updateSubarea: (id: string, updates: Partial<Omit<Subarea, 'id' | 'regionId'>>) => void;
  removeSubarea: (id: string) => void;
  setCompanyCodeMode: (mode: 'same' | 'individual') => void;
  setGlobalCompanyCode: (code: string) => void;
  setRegionCompanyCode: (regionId: string, code: string) => void;

  // Utilities
  loadCompanyCodes: () => void;
  reset: () => void;
  canProceed: () => boolean;

  // Export helpers
  generateT500P: () => string;
  generateT001P: () => string;
}

type PersonnelAreaV2Store = PersonnelAreaV2State & PersonnelAreaV2Actions;

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────

const initialState: PersonnelAreaV2State = {
  currentScreen: '1.1',
  orgType: null,
  regions: [],
  differenceFactors: [],
  subareas: [],
  companyCodeMode: 'same',
  globalCompanyCode: '',
  regionCompanyCodes: {},
  availableCompanyCodes: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Screen Flow Logic
// ─────────────────────────────────────────────────────────────────────────────

const SCREEN_ORDER: WizardScreen[] = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1'];

function getNextScreen(current: WizardScreen, state: PersonnelAreaV2State): WizardScreen {
  // From 1.1 (OrgType):
  //   - single -> 3.2 (skip to company code)
  //   - regional/divisional -> 1.2 (regions)
  if (current === '1.1') {
    if (state.orgType === 'single') {
      return '3.2';
    }
    return '1.2';
  }

  // From 2.1 (DifferenceFactors):
  //   - no factors selected -> 3.2 (skip subareas)
  //   - factors selected -> 2.2 (toggle regions)
  if (current === '2.1') {
    if (state.differenceFactors.length === 0) {
      return '3.2';
    }
    return '2.2';
  }

  // Default: go to next in order
  const idx = SCREEN_ORDER.indexOf(current);
  if (idx < SCREEN_ORDER.length - 1) {
    return SCREEN_ORDER[idx + 1];
  }
  return current;
}

function getPrevScreen(current: WizardScreen, state: PersonnelAreaV2State): WizardScreen {
  // From 3.2 (CompanyCode):
  //   - if single org -> 1.1
  //   - if no factors -> 2.1
  //   - otherwise -> 3.1
  if (current === '3.2') {
    if (state.orgType === 'single') {
      return '1.1';
    }
    if (state.differenceFactors.length === 0) {
      return '2.1';
    }
    return '3.1';
  }

  // From 2.2 (RegionToggle) -> 2.1 (Factors)
  if (current === '2.2') {
    return '2.1';
  }

  // Default: go to prev in order
  const idx = SCREEN_ORDER.indexOf(current);
  if (idx > 0) {
    return SCREEN_ORDER[idx - 1];
  }
  return current;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateRegionCode(existingCodes: string[]): string {
  let code = 1000;
  const existing = new Set(existingCodes);
  while (existing.has(code.toString())) {
    code += 100;
  }
  return code.toString();
}

function generateSubareaCode(name: string, existingCodes: string[]): string {
  let base = name
    .substring(0, 4)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .padEnd(4, '0');

  if (!existingCodes.includes(base)) return base;

  for (let i = 1; i <= 99; i++) {
    const candidate = base.substring(0, 3) + i.toString();
    if (!existingCodes.includes(candidate)) {
      return candidate.substring(0, 4);
    }
  }
  return base;
}

function loadCompanyCodesFromStorage(): CompanyCode[] {
  try {
    // Check all localStorage keys for company code data
    const codes: CompanyCode[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('turbosap.company_code.draft.v1')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item.companyCode && item.companyName) {
                codes.push({ code: item.companyCode, name: item.companyName });
              }
            }
          }
        }
      }
    }
    return codes;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const usePersonnelAreaV2Store = create<PersonnelAreaV2Store>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ─────────────────────────────────────────────────────────────────────
      // Navigation
      // ─────────────────────────────────────────────────────────────────────

      setScreen: (screen) => set({ currentScreen: screen }),

      goBack: () => {
        const state = get();
        const prevScreen = getPrevScreen(state.currentScreen, state);
        set({ currentScreen: prevScreen });
      },

      goNext: () => {
        const state = get();
        const nextScreen = getNextScreen(state.currentScreen, state);
        set({ currentScreen: nextScreen });
      },

      // ─────────────────────────────────────────────────────────────────────
      // Phase 1: Organization Type & Regions
      // ─────────────────────────────────────────────────────────────────────

      setOrgType: (type) => {
        const updates: Partial<PersonnelAreaV2State> = { orgType: type };

        // If single org, auto-create one "Main" region
        if (type === 'single') {
          updates.regions = [{
            id: crypto.randomUUID(),
            code: '1000',
            name: 'Main',
            needsSubareas: false,
          }];
        } else if (get().regions.length === 0) {
          // For regional/divisional, start with one empty region
          updates.regions = [{
            id: crypto.randomUUID(),
            code: '1000',
            name: '',
            needsSubareas: false,
          }];
        }

        set(updates);
      },

      addRegion: () => {
        const state = get();
        const existingCodes = state.regions.map(r => r.code);
        const newRegion: Region = {
          id: crypto.randomUUID(),
          code: generateRegionCode(existingCodes),
          name: '',
          needsSubareas: false,
        };
        set({ regions: [...state.regions, newRegion] });
      },

      updateRegion: (id, updates) => {
        set((state) => ({
          regions: state.regions.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }));
      },

      removeRegion: (id) => {
        set((state) => ({
          regions: state.regions.filter((r) => r.id !== id),
          // Also remove subareas for this region
          subareas: state.subareas.filter((s) => s.regionId !== id),
          // Remove company code assignment
          regionCompanyCodes: Object.fromEntries(
            Object.entries(state.regionCompanyCodes).filter(([key]) => key !== id)
          ),
        }));
      },

      // ─────────────────────────────────────────────────────────────────────
      // Phase 2: Difference Factors & Region Toggles
      // ─────────────────────────────────────────────────────────────────────

      toggleDifferenceFactor: (factor) => {
        set((state) => {
          const factors = state.differenceFactors.includes(factor)
            ? state.differenceFactors.filter((f) => f !== factor)
            : [...state.differenceFactors, factor];
          return { differenceFactors: factors };
        });
      },

      setRegionNeedsSubareas: (regionId, needsSubareas) => {
        set((state) => {
          const regions = state.regions.map((r) =>
            r.id === regionId ? { ...r, needsSubareas } : r
          );

          // If region now needs subareas but has none, auto-create "9999 General"
          let subareas = state.subareas;
          if (needsSubareas) {
            const regionSubareas = subareas.filter((s) => s.regionId === regionId);
            if (regionSubareas.length === 0) {
              subareas = [
                ...subareas,
                {
                  id: crypto.randomUUID(),
                  regionId,
                  code: '9999',
                  description: 'General',
                },
              ];
            }
          }

          return { regions, subareas };
        });
      },

      // ─────────────────────────────────────────────────────────────────────
      // Phase 3: Subareas & Company Codes
      // ─────────────────────────────────────────────────────────────────────

      addSubarea: (regionId) => {
        const state = get();
        const existingCodes = state.subareas
          .filter((s) => s.regionId === regionId)
          .map((s) => s.code);

        const newSubarea: Subarea = {
          id: crypto.randomUUID(),
          regionId,
          code: generateSubareaCode('NEW', existingCodes),
          description: '',
        };
        set({ subareas: [...state.subareas, newSubarea] });
      },

      updateSubarea: (id, updates) => {
        set((state) => ({
          subareas: state.subareas.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },

      removeSubarea: (id) => {
        set((state) => ({
          subareas: state.subareas.filter((s) => s.id !== id),
        }));
      },

      setCompanyCodeMode: (mode) => set({ companyCodeMode: mode }),

      setGlobalCompanyCode: (code) => set({ globalCompanyCode: code }),

      setRegionCompanyCode: (regionId, code) => {
        set((state) => ({
          regionCompanyCodes: { ...state.regionCompanyCodes, [regionId]: code },
        }));
      },

      // ─────────────────────────────────────────────────────────────────────
      // Utilities
      // ─────────────────────────────────────────────────────────────────────

      loadCompanyCodes: () => {
        const codes = loadCompanyCodesFromStorage();
        set({ availableCompanyCodes: codes });
      },

      reset: () => set({ ...initialState }),

      canProceed: () => {
        const state = get();

        switch (state.currentScreen) {
          case '1.1':
            return state.orgType !== null;

          case '1.2':
            return (
              state.regions.length > 0 &&
              state.regions.every((r) => r.code && r.name)
            );

          case '2.1':
            // Can always proceed (even with no factors selected)
            return true;

          case '2.2':
            // Must have at least one region marked as needing subareas
            return state.regions.some((r) => r.needsSubareas);

          case '3.1':
            // All regions with needsSubareas must have at least one subarea with valid data
            const regionsNeedingSubareas = state.regions.filter((r) => r.needsSubareas);
            return regionsNeedingSubareas.every((region) => {
              const regionSubareas = state.subareas.filter((s) => s.regionId === region.id);
              return (
                regionSubareas.length > 0 &&
                regionSubareas.every((s) => s.code && s.description)
              );
            });

          case '3.2':
            // Must have company code(s) assigned
            if (state.companyCodeMode === 'same') {
              return !!state.globalCompanyCode;
            }
            return state.regions.every((r) => !!state.regionCompanyCodes[r.id]);

          case '4.1':
            return true;

          default:
            return false;
        }
      },

      // ─────────────────────────────────────────────────────────────────────
      // Export Helpers
      // ─────────────────────────────────────────────────────────────────────

      generateT500P: () => {
        const state = get();
        const lines: string[] = ['PERSA,NAME1,BUKRS'];

        for (const region of state.regions) {
          const companyCode = state.companyCodeMode === 'same'
            ? state.globalCompanyCode
            : state.regionCompanyCodes[region.id] || '';

          lines.push(`${region.code},${region.name},${companyCode}`);
        }

        return lines.join('\n');
      },

      generateT001P: () => {
        const state = get();
        const lines: string[] = ['WERKS,BTRTL,BTEXT'];

        for (const region of state.regions) {
          const regionSubareas = state.subareas.filter((s) => s.regionId === region.id);

          if (regionSubareas.length === 0) {
            // Auto-create 9999 General for regions without subareas
            lines.push(`${region.code},9999,General`);
          } else {
            for (const subarea of regionSubareas) {
              lines.push(`${region.code},${subarea.code},${subarea.description}`);
            }
          }
        }

        return lines.join('\n');
      },
    }),
    {
      name: 'turbosap-personnel-area-v2',
      version: 1,
      partialize: (state) => ({
        currentScreen: state.currentScreen,
        orgType: state.orgType,
        regions: state.regions,
        differenceFactors: state.differenceFactors,
        subareas: state.subareas,
        companyCodeMode: state.companyCodeMode,
        globalCompanyCode: state.globalCompanyCode,
        regionCompanyCodes: state.regionCompanyCodes,
        // Don't persist availableCompanyCodes - load fresh each time
      }),
    }
  )
);
