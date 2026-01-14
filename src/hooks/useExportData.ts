/**
 * useExportData - Hook for loading all export data from stores/localStorage
 * Used by ExportCenterPage to gather data from both Payroll and Payment modules
 */

import { useMemo, useEffect, useRef } from 'react';
import { useConfigStore } from '../store';
import { useAuthStore } from '../store/auth';
import type { PayrollArea, CompanyCode } from '../types';
import type {
  PaymentMethodRow,
  CheckRangeRow,
} from '../utils/fileGenerators';

interface EditablePaymentMethod {
  payment_method: string;
  description: string;
  used: string; // "Yes" | "No" (your PaymentMethodPage uses this)
}

interface EditableCheckRange {
  company_code: string;
  bank_account: string;
  check_number_range: string;
}



// ============================================
// Types
// ============================================

export interface PaymentData {
  methods: PaymentMethodRow[];
  checkRanges: CheckRangeRow[];
  preNotificationRequired: boolean;
}

export interface ModuleStatus {
  status: 'complete' | 'not-started';
  itemCount: number;
}

export interface ExportDataResult {
  // Payroll data
  payrollAreas: PayrollArea[];
  payrollStatus: ModuleStatus;

  // Payment data
  paymentData: PaymentData | null;
  paymentStatus: ModuleStatus;

  // Company code data
  companyCodes: CompanyCode[];
  companyCodeStatus: ModuleStatus;

  // User info
  userKey: string;
}

// ============================================
// LocalStorage helpers
// ============================================

function paymentDraftKey(userKey: string) {
  return `turbosap.payment_method.draft.v1.${userKey}`;
}

function companyCodeDraftKey(userKey: string) {
  return `turbosap.company_code.draft.v1.${userKey}`;
}

function loadCompanyCodeDraft(userKey: string): CompanyCode[] {
  try {
    const raw = localStorage.getItem(companyCodeDraftKey(userKey));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
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

  editablePaymentMethods?: EditablePaymentMethod[];
  editableCheckRanges?: EditableCheckRange[];
  editablePreNotification?: string; // "Yes" | "No"
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

  // Subscribe to company code version to trigger re-computation when localStorage changes
  const companyCodeVersion = useConfigStore((state) => state.companyCodeVersion);

  
  const paymentData = useMemo((): PaymentData | null => {
  const draft = loadPaymentDraft(userKey);
  if (!draft) return null;

  // ✅ Preferred path: read the same tables the UI edits & persists
  const editableMethods = draft.editablePaymentMethods ?? [];
  const editableRanges = draft.editableCheckRanges ?? [];
  const editablePreNote = draft.editablePreNotification;

  const hasEditable =
    editableMethods.length > 0 ||
    editableRanges.length > 0 ||
    typeof editablePreNote === "string";

  if (hasEditable) {
    const methods: PaymentMethodRow[] = editableMethods.map((m) => ({
      payment_method: m.payment_method,
      description: m.description,
      // ExportCenter expects 'X' or '' in your generator format
      used: m.used === "Yes" ? "X" : "",
    }));

    const checkRanges: CheckRangeRow[] = editableRanges.map((r) => ({
      company_code: r.company_code,
      bank_account: r.bank_account,
      check_number_range: r.check_number_range,
    }));

    // If UI says "Pre-Notification Required: Yes/No"
    // Your PaymentMethodPage sets editablePreNotification to "Yes" or "No"
    const preNotificationRequired =
      (editablePreNote ?? "No").toLowerCase() === "yes";

    return { methods, checkRanges, preNotificationRequired };
  }

  // -----------------------------
  // Fallback path: old draft shape
  // -----------------------------
  if (!draft.paymentResults || draft.paymentResults.length === 0) {
    return null;
  }

  const methods: PaymentMethodRow[] = draft.paymentResults
    .filter((r) => ["P", "Q", "K", "M"].includes(r.code))
    .map((r) => ({
      payment_method: r.code,
      description: r.description,
      used: r.used ? "X" : "",
    }));

  const checkRanges: CheckRangeRow[] = [];

  if (draft.systemCheckBankAccount && draft.systemCheckRange) {
    checkRanges.push({
      company_code: "1000",
      bank_account: draft.systemCheckBankAccount,
      check_number_range: draft.systemCheckRange,
    });
  }

  if (draft.manualCheckBankAccount && draft.manualCheckRange) {
    checkRanges.push({
      company_code: "1000",
      bank_account: draft.manualCheckBankAccount,
      check_number_range: draft.manualCheckRange,
    });
  }

  const preNotificationRequired = draft.agreeNoPreNote !== true;

  return { methods, checkRanges, preNotificationRequired };
}, [userKey, paymentDataVersion]);


  // Calculate payroll status (simplified: complete or not-started)
  const payrollStatus = useMemo((): ModuleStatus => {
    // Check if any areas have meaningful data (not just default template)
    const validAreas = payrollAreas.filter(
      (a) => a.employeeCount > 0 || a.description !== ''
    );
    if (validAreas.length === 0) {
      return { status: 'not-started', itemCount: 0 };
    }
    return {
      status: 'complete',
      itemCount: validAreas.length,
    };
  }, [payrollAreas]);

  const didPersistPayroll = useRef(false);

useEffect(() => {
  if (!payrollAreas || payrollAreas.length === 0) return;

  // only persist when "complete" (same logic you used for payrollStatus)
  const hasData = payrollAreas.some(
    (a) => a.employeeCount > 0 || a.description !== ''
  );
  if (!hasData) return;

  if (didPersistPayroll.current) return;
  didPersistPayroll.current = true;

  (async () => {
    try {
      // get latest payroll session_id
      const latestResp = await fetch('/api/export/latest?module=payroll');
      if (!latestResp.ok) throw new Error('failed to fetch latest payroll session');
      const latest = await latestResp.json();

      const sessionId = latest.session_id as string;
      if (!sessionId) throw new Error('missing session_id from /api/export/latest');

      // persist payroll data
      const persistResp = await fetch(`/api/export/sessions/${sessionId}/persist-payroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrollAreas }),
      });

      if (!persistResp.ok) {
        const text = await persistResp.text();
        throw new Error(`persist-payroll failed: ${text}`);
      }
    } catch (e) {
      console.error(e);
      didPersistPayroll.current = false; // allow retry
    }
  })();
}, [payrollAreas]);


  // Calculate payment status (simplified: complete or not-started)
  const paymentStatus = useMemo((): ModuleStatus => {
    if (!paymentData) {
      return { status: 'not-started', itemCount: 0 };
    }
    const methodCount = paymentData.methods.filter((m) => m.used === 'X').length;
    if (methodCount === 0) {
      return { status: 'not-started', itemCount: 0 };
    }
    return {
      status: 'complete',
      itemCount: methodCount,
    };
  }, [paymentData]);

  // Load company codes from localStorage
  const companyCodes = useMemo((): CompanyCode[] => {
    return loadCompanyCodeDraft(userKey);
  }, [userKey, companyCodeVersion]);

  // Calculate company code status (simplified: complete or not-started)
  // A row is complete only if ALL required fields are filled
  const companyCodeStatus = useMemo((): ModuleStatus => {
    const REQUIRED_KEYS: (keyof CompanyCode)[] = [
      'companyCode', 'companyName', 'currency',
      'street', 'city', 'state', 'zipCode', 'country',
    ];

    const completeCodes = companyCodes.filter((c) =>
      REQUIRED_KEYS.every((key) => {
        const val = c[key];
        return typeof val === 'string' ? val.trim() !== '' : Boolean(val);
      })
    );

    if (completeCodes.length === 0) {
      return { status: 'not-started', itemCount: 0 };
    }
    return {
      status: 'complete',
      itemCount: completeCodes.length,
    };
  }, [companyCodes]);

 const didPersistPayment = useRef(false);

useEffect(() => {
  if (!paymentData) return;

  // only persist when complete
  const methodCount = paymentData.methods.filter((m) => m.used === 'X').length;
  if (methodCount <= 0) return;

  // avoid spamming backend on re-render
  if (didPersistPayment.current) return;
  didPersistPayment.current = true;

  (async () => {
    try {
      // 1) get latest payment session_id from backend (since DB is keyed by session_id)
      const latestResp = await fetch('/api/export/latest?module=payment');
      if (!latestResp.ok) throw new Error('failed to fetch latest payment session');
      const latest = await latestResp.json();

      const sessionId = latest.session_id as string;
      if (!sessionId) throw new Error('missing session_id from /api/export/latest');

      // 2) persist payment data into SQLite config_state
      const persistResp = await fetch(`/api/export/sessions/${sessionId}/persist-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      });

      if (!persistResp.ok) {
        const text = await persistResp.text();
        throw new Error(`persist-payment failed: ${text}`);
      }
    } catch (e) {
      console.error(e);
      // allow retry later
      didPersistPayment.current = false;
    }
  })();
}, [paymentData]);


  return {
    payrollAreas,
    payrollStatus,
    paymentData,
    paymentStatus,
    companyCodes,
    companyCodeStatus,
    userKey,
  };
}

