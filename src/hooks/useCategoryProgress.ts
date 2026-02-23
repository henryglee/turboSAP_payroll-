/**
 * useCategoryProgress - Generic hook for tracking category completion
 *
 * Fetches tasks from hierarchy API for a given category,
 * evaluates completion status against localStorage/Zustand stores,
 * and returns aggregated progress.
 */

import { useMemo } from 'react';
import { useAuthStore } from '../store/auth';
import { useConfigStore } from '../store';
import { useEmployeeGroupStore } from '../stores/employeeGroupStore';
import { usePersonnelAreaV2Store } from '../stores/usePersonnelAreaV2Store';

// =============================================================================
// Types
// =============================================================================

export type ModuleStatus = 'not-started' | 'in-progress' | 'completed';

export interface ModuleProgress {
  slug: string;
  name: string;
  route: string;
  icon: string;
  status: ModuleStatus;
  itemCount: number;
  description?: string;
}

export interface CategoryProgress {
  categoryId: string;
  categoryName: string;
  modules: ModuleProgress[];
  completedCount: number;
  totalCount: number;
  percentComplete: number;
  activeModuleSlug: string | null;
  isComplete: boolean;
}

// =============================================================================
// Module Configurations by Category
// =============================================================================

interface ModuleConfig {
  slug: string;
  icon: string;
  route: string;
  description: string;
}

// C003 - Enterprise Structure
const ENTERPRISE_STRUCTURE_MODULES: Record<string, ModuleConfig> = {
  'Company Code': {
    slug: 'company-code',
    icon: 'building-2',
    route: '/company-code',
    description: 'Define company codes and legal entities',
  },
  'Payroll Area': {
    slug: 'payroll-area',
    icon: 'calendar-clock',
    route: '/payroll-area',
    description: 'Configure payroll frequencies and areas',
  },
  'Personnel Area': {
    slug: 'personnel-area',
    icon: 'map-pin',
    route: '/personnel-area-v2',
    description: 'Set up personnel areas and subareas',
  },
  'Employee Group': {
    slug: 'employee-group',
    icon: 'users',
    route: '/employee-group',
    description: 'Define employee groups and subgroups',
  },
};

// C006 - Tax Configuration
const TAX_CONFIG_MODULES: Record<string, ModuleConfig> = {
  'Tax Company': {
    slug: 'tax-company',
    icon: 'receipt-cent',
    route: '/tax-company',
    description: 'Configure tax companies and authorities',
  },
  'Tax IDs': {
    slug: 'tax-id',
    icon: 'receipt-cent',
    route: '/tax-id',
    description: 'Set up tax identification numbers',
  },
  'SUI Tax Rate': {
    slug: 'sui-tax-rate',
    icon: 'receipt-cent',
    route: '/sui-tax-rate',
    description: 'Configure state unemployment insurance rates',
  },
};

// C009 - Banking
const BANKING_MODULES: Record<string, ModuleConfig> = {
  'Payment Methods': {
    slug: 'payment-method',
    icon: 'credit-card',
    route: '/payment-methods',
    description: 'Configure payment methods and bank accounts',
  },
};

// =============================================================================
// Status Evaluation Functions
// =============================================================================

interface CompanyCodeRow {
  companyCode?: string;
  companyName?: string;
  currency?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

function evaluateCompanyCodeStatus(userKey: string): { status: ModuleStatus; itemCount: number } {
  const REQUIRED_KEYS: (keyof CompanyCodeRow)[] = [
    'companyCode', 'companyName', 'currency',
    'street', 'city', 'state', 'zipCode', 'country',
  ];

  try {
    const raw = localStorage.getItem(`turbosap.company_code.draft.v1.${userKey}`);
    if (!raw) return { status: 'not-started', itemCount: 0 };

    const data: CompanyCodeRow[] = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) {
      return { status: 'not-started', itemCount: 0 };
    }

    // Check if any row has all required fields filled
    const completeCodes = data.filter((c) =>
      REQUIRED_KEYS.every((key) => {
        const val = c[key];
        return typeof val === 'string' ? val.trim() !== '' : Boolean(val);
      })
    );

    if (completeCodes.length === 0) {
      // Some data exists but not complete
      return { status: 'in-progress', itemCount: data.length };
    }

    return { status: 'completed', itemCount: completeCodes.length };
  } catch {
    return { status: 'not-started', itemCount: 0 };
  }
}

interface PayrollAreaItem {
  employeeCount?: number;
  description?: string;
}

function evaluatePayrollAreaStatus(payrollAreas: PayrollAreaItem[]): { status: ModuleStatus; itemCount: number } {
  if (!Array.isArray(payrollAreas) || payrollAreas.length === 0) {
    return { status: 'not-started', itemCount: 0 };
  }

  // Check if any areas have meaningful data (not just default template)
  const validAreas = payrollAreas.filter((a) =>
    (a.employeeCount && a.employeeCount > 0) || (a.description && a.description !== '')
  );

  if (validAreas.length === 0) {
    return { status: 'in-progress', itemCount: payrollAreas.length };
  }

  return { status: 'completed', itemCount: validAreas.length };
}

function evaluateEmployeeGroupStatus(
  currentStep: string,
  validCombinations: unknown[]
): { status: ModuleStatus; itemCount: number } {
  if (!currentStep || currentStep === 'dimensions') {
    return { status: 'not-started', itemCount: 0 };
  }

  if (currentStep === 'review' && Array.isArray(validCombinations) && validCombinations.length > 0) {
    return { status: 'completed', itemCount: validCombinations.length };
  }

  // In the middle of the wizard
  return { status: 'in-progress', itemCount: 0 };
}

function evaluatePersonnelAreaStatus(
  currentScreen: string,
  regions: unknown[]
): { status: ModuleStatus; itemCount: number } {
  if (!currentScreen || currentScreen === '1.1') {
    return { status: 'not-started', itemCount: 0 };
  }

  if (currentScreen === '4.1' && Array.isArray(regions) && regions.length > 0) {
    return { status: 'completed', itemCount: regions.length };
  }

  // In the middle of the wizard
  return { status: 'in-progress', itemCount: Array.isArray(regions) ? regions.length : 0 };
}

// Tax Company status
function evaluateTaxCompanyStatus(userKey: string): { status: ModuleStatus; itemCount: number } {
  try {
    const raw = localStorage.getItem(`turbosap.tax_company.draft.v1.${userKey}`);
    if (!raw) return { status: 'not-started', itemCount: 0 };

    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) {
      return { status: 'not-started', itemCount: 0 };
    }

    // Check if any row has required fields (code and name)
    const validRows = data.filter((row: { code?: number; name?: string }) =>
      row.code && row.name && row.name.trim() !== ''
    );

    if (validRows.length === 0) {
      return { status: 'in-progress', itemCount: data.length };
    }

    return { status: 'completed', itemCount: validRows.length };
  } catch {
    return { status: 'not-started', itemCount: 0 };
  }
}

// Tax ID status
function evaluateTaxIdStatus(userKey: string): { status: ModuleStatus; itemCount: number } {
  try {
    const raw = localStorage.getItem(`turbosap.tax_id_grid.draft.v1.${userKey}`);
    if (!raw) return { status: 'not-started', itemCount: 0 };

    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) {
      return { status: 'not-started', itemCount: 0 };
    }

    return { status: 'completed', itemCount: data.length };
  } catch {
    return { status: 'not-started', itemCount: 0 };
  }
}

// SUI Tax Rate status
function evaluateSuiTaxRateStatus(userKey: string): { status: ModuleStatus; itemCount: number } {
  try {
    const raw = localStorage.getItem(`turbosap.sui_tax_rate_grid.draft.v1.${userKey}`);
    if (!raw) return { status: 'not-started', itemCount: 0 };

    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) {
      return { status: 'not-started', itemCount: 0 };
    }

    return { status: 'completed', itemCount: data.length };
  } catch {
    return { status: 'not-started', itemCount: 0 };
  }
}

// Payment Method status
interface PaymentDraft {
  selectedMethods?: string[];
  paymentResults?: unknown[] | null;
}

function evaluatePaymentMethodStatus(userKey: string): { status: ModuleStatus; itemCount: number } {
  try {
    const raw = localStorage.getItem(`turbosap.payment_method.draft.v1.${userKey}`);
    if (!raw) return { status: 'not-started', itemCount: 0 };

    const draft: PaymentDraft = JSON.parse(raw);

    // Check if they have payment results (completed the wizard)
    if (draft.paymentResults && Array.isArray(draft.paymentResults) && draft.paymentResults.length > 0) {
      return { status: 'completed', itemCount: draft.paymentResults.length };
    }

    // Check if they have selected methods (started)
    if (draft.selectedMethods && draft.selectedMethods.length > 0) {
      return { status: 'in-progress', itemCount: draft.selectedMethods.length };
    }

    return { status: 'not-started', itemCount: 0 };
  } catch {
    return { status: 'not-started', itemCount: 0 };
  }
}

// =============================================================================
// Main Hook
// =============================================================================

export function useCategoryProgress(categoryId: string): CategoryProgress {
  const { user } = useAuthStore();
  const userKey = user?.userId ? String(user.userId) : 'anonymous';

  // Subscribe to Zustand stores for reactivity
  const payrollAreas = useConfigStore((state) => state.payrollAreas);
  const companyCodeVersion = useConfigStore((state) => state.companyCodeVersion);

  const egCurrentStep = useEmployeeGroupStore((state) => state.currentStep);
  const egValidCombinations = useEmployeeGroupStore((state) => state.validCombinations);

  const paCurrentScreen = usePersonnelAreaV2Store((state) => state.currentScreen);
  const paRegions = usePersonnelAreaV2Store((state) => state.regions);

  // Calculate module progress
  const moduleProgress = useMemo((): ModuleProgress[] => {
    const modules: ModuleProgress[] = [];

    if (categoryId === 'C003') {
      // Enterprise Structure
      const moduleList = [
        { taskName: 'Company Code', evaluator: () => evaluateCompanyCodeStatus(userKey) },
        { taskName: 'Payroll Area', evaluator: () => evaluatePayrollAreaStatus(payrollAreas) },
        { taskName: 'Employee Group', evaluator: () => evaluateEmployeeGroupStatus(egCurrentStep, egValidCombinations) },
        { taskName: 'Personnel Area', evaluator: () => evaluatePersonnelAreaStatus(paCurrentScreen, paRegions) },
      ];

      for (const { taskName, evaluator } of moduleList) {
        const config = ENTERPRISE_STRUCTURE_MODULES[taskName];
        if (!config) continue;
        const { status, itemCount } = evaluator();
        modules.push({
          slug: config.slug,
          name: taskName,
          route: config.route,
          icon: config.icon,
          status,
          itemCount,
          description: config.description,
        });
      }
    } else if (categoryId === 'C006') {
      // Tax Configuration
      const moduleList = [
        { taskName: 'Tax Company', evaluator: () => evaluateTaxCompanyStatus(userKey) },
        { taskName: 'Tax IDs', evaluator: () => evaluateTaxIdStatus(userKey) },
        { taskName: 'SUI Tax Rate', evaluator: () => evaluateSuiTaxRateStatus(userKey) },
      ];

      for (const { taskName, evaluator } of moduleList) {
        const config = TAX_CONFIG_MODULES[taskName];
        if (!config) continue;
        const { status, itemCount } = evaluator();
        modules.push({
          slug: config.slug,
          name: taskName,
          route: config.route,
          icon: config.icon,
          status,
          itemCount,
          description: config.description,
        });
      }
    } else if (categoryId === 'C009') {
      // Banking
      const moduleList = [
        { taskName: 'Payment Methods', evaluator: () => evaluatePaymentMethodStatus(userKey) },
      ];

      for (const { taskName, evaluator } of moduleList) {
        const config = BANKING_MODULES[taskName];
        if (!config) continue;
        const { status, itemCount } = evaluator();
        modules.push({
          slug: config.slug,
          name: taskName,
          route: config.route,
          icon: config.icon,
          status,
          itemCount,
          description: config.description,
        });
      }
    }

    return modules;
  }, [categoryId, userKey, payrollAreas, companyCodeVersion, egCurrentStep, egValidCombinations, paCurrentScreen, paRegions]);

  // Calculate aggregates
  const completedCount = moduleProgress.filter((m) => m.status === 'completed').length;
  const totalCount = moduleProgress.length;
  const percentComplete = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isComplete = completedCount === totalCount && totalCount > 0;

  // Find the first incomplete module as the "active" one
  const activeModuleSlug = useMemo(() => {
    const firstIncomplete = moduleProgress.find(
      (m) => m.status !== 'completed'
    );
    return firstIncomplete?.slug ?? null;
  }, [moduleProgress]);

  // Get category name
  const CATEGORY_NAMES: Record<string, string> = {
    C003: 'Enterprise Structure',
    C006: 'Tax Configuration',
    C009: 'Banking',
  };
  const categoryName = CATEGORY_NAMES[categoryId] ?? categoryId;

  return {
    categoryId,
    categoryName,
    modules: moduleProgress,
    completedCount,
    totalCount,
    percentComplete,
    activeModuleSlug,
    isComplete,
  };
}

// =============================================================================
// Aggregate Progress Hook - All Categories Combined
// =============================================================================

export interface AggregateProgress {
  totalModules: number;
  completedModules: number;
  percentComplete: number;
  categories: CategoryProgress[];
}

export function useAggregateProgress(): AggregateProgress {
  const enterprise = useCategoryProgress('C003');
  const tax = useCategoryProgress('C006');
  const banking = useCategoryProgress('C009');

  const categories = [enterprise, tax, banking];
  const totalModules = categories.reduce((sum, c) => sum + c.totalCount, 0);
  const completedModules = categories.reduce((sum, c) => sum + c.completedCount, 0);
  const percentComplete = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  return {
    totalModules,
    completedModules,
    percentComplete,
    categories,
  };
}
