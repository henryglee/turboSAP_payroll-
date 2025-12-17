/**
 * useExportData - Hook for loading all export data from stores/localStorage
 * Used by ExportCenterPage to gather data from both Payroll and Payment modules
 */

import { useMemo } from 'react';
import { useConfigStore } from '../store';
import { useAuthStore } from '../store/auth';
import type { PayrollArea } from '../types';
import type {
  PaymentMethodRow,
  CheckRangeRow,
} from '../utils/fileGenerators';

// ============================================
// Types
// ============================================

export interface PaymentData {
  methods: PaymentMethodRow[];
  checkRanges: CheckRangeRow[];
  preNotificationRequired: boolean;
}

export interface ModuleStatus {
  status: 'complete' | 'incomplete' | 'not-started';
  itemCount: number;
}

export interface ExportDataResult {
  // Payroll data
  payrollAreas: PayrollArea[];
  payrollStatus: ModuleStatus;

  // Payment data
  paymentData: PaymentData | null;
  paymentStatus: ModuleStatus;

  // User info
  userKey: string;
}

// ============================================
// LocalStorage helpers
// ============================================

function paymentDraftKey(userKey: string) {
  return `turbosap.payment_method.draft.v1.${userKey}`;
}

interface PaymentDraft {
  selectedMethods: string[];
  houseBanks: string;
  achSpec: string;
  checkVolume: string;
  systemCheckBankAccount: string;
  systemCheckRange: string;
  manualCheckBankAccount: string;
  manualCheckRange: string;
  agreeNoPreNote: boolean | null;
  paymentResults: PaymentMethodConfig[] | null;
  showResults: boolean;
}

// Matches the actual PaymentMethodConfig from types/chat.ts
interface PaymentMethodConfig {
  code: string;
  description: string;
  used?: boolean;
  house_banks?: string;
  ach_file_spec?: string;
  check_volume?: string;
  check_number_range?: string;
  agree_no_pre_note?: boolean;
}

function loadPaymentDraft(userKey: string): PaymentDraft | null {
  try {
    const raw = localStorage.getItem(paymentDraftKey(userKey));
    return raw ? (JSON.parse(raw) as PaymentDraft) : null;
  } catch {
    return null;
  }
}

// ============================================
// Main Hook
// ============================================

export function useExportData(): ExportDataResult {
  const { user } = useAuthStore();
  const userKey = user?.userId ? String(user.userId) : 'anonymous';

  // Get payroll areas from Zustand store
  const payrollAreas = useConfigStore((state) => state.payrollAreas);

  // Subscribe to payment data version to trigger re-computation when localStorage changes
  const paymentDataVersion = useConfigStore((state) => state.paymentDataVersion);

  // Load payment data from localStorage (memoized to avoid re-parsing)
  const paymentData = useMemo((): PaymentData | null => {
    const draft = loadPaymentDraft(userKey);
    if (!draft || !draft.paymentResults || draft.paymentResults.length === 0) {
      return null;
    }

    // Transform draft data into export format
    // Filter to only payment method codes (P, Q, K, M) and map to export structure
    const methods: PaymentMethodRow[] = draft.paymentResults
      .filter((r) => ['P', 'Q', 'K', 'M'].includes(r.code))
      .map((r) => ({
        payment_method: r.code,
        description: r.description,
        used: r.used ? 'X' : '',
      }));

    // Build check ranges from draft
    const checkRanges: CheckRangeRow[] = [];

    if (draft.systemCheckBankAccount && draft.systemCheckRange) {
      checkRanges.push({
        company_code: '1000', // Default company code
        bank_account: draft.systemCheckBankAccount,
        check_number_range: draft.systemCheckRange,
      });
    }

    if (draft.manualCheckBankAccount && draft.manualCheckRange) {
      checkRanges.push({
        company_code: '1000',
        bank_account: draft.manualCheckBankAccount,
        check_number_range: draft.manualCheckRange,
      });
    }

    // Pre-notification: if agreeNoPreNote is true, pre-notification is NOT required
    // If agreeNoPreNote is false or null, pre-notification IS required
    const preNotificationRequired = draft.agreeNoPreNote !== true;

    return {
      methods,
      checkRanges,
      preNotificationRequired,
    };
  }, [userKey, paymentDataVersion]);

  // Calculate payroll status
  const payrollStatus = useMemo((): ModuleStatus => {
    if (payrollAreas.length === 0) {
      return { status: 'not-started', itemCount: 0 };
    }
    // Check if any areas have meaningful data (not just default template)
    const hasData = payrollAreas.some(
      (a) => a.employeeCount > 0 || a.description !== ''
    );
    return {
      status: hasData ? 'complete' : 'incomplete',
      itemCount: payrollAreas.length,
    };
  }, [payrollAreas]);

  // Calculate payment status
  const paymentStatus = useMemo((): ModuleStatus => {
    if (!paymentData) {
      return { status: 'not-started', itemCount: 0 };
    }
    const methodCount = paymentData.methods.filter((m) => m.used === 'X').length;
    return {
      status: methodCount > 0 ? 'complete' : 'incomplete',
      itemCount: methodCount,
    };
  }, [paymentData]);

  return {
    payrollAreas,
    payrollStatus,
    paymentData,
    paymentStatus,
    userKey,
  };
}
