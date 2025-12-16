/**
 * Payment Method Page - Form-based UI for payment configuration
 * Uses Lovable design system (Sidebar + Header + Form sections)
 * CSS is imported globally in main.tsx
 *
 * Submits to April's question-by-question backend sequentially
 */

import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout.tsx';
import { startSession, submitAnswer } from '../api/langgraph.ts';
import type { PaymentMethodConfig } from '../types/chat';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronRight, AlertTriangle, Download, Plus, Trash2, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils';

// Validation helper functions
function validateAchRouting(value: string): { valid: boolean; message?: string } {
  if (!value) return { valid: true }; // Empty is OK (optional field)
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length !== 9) {
    return { valid: false, message: 'ACH routing number must be exactly 9 digits' };
  }
  return { valid: true };
}

function parseCheckRange(range: string): { start: number; end: number } | null {
  const match = range.trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return null;
  return { start: parseInt(match[1]), end: parseInt(match[2]) };
}

function validateCheckRange(value: string): { valid: boolean; message?: string } {
  if (!value) return { valid: true }; // Empty is OK
  const parsed = parseCheckRange(value);
  if (!parsed) {
    return { valid: false, message: 'Format must be "1000000 - 9999999" (numbers with dash)' };
  }
  if (parsed.start >= parsed.end) {
    return { valid: false, message: 'Start number must be less than end number' };
  }
  return { valid: true };
}

function checkRangesOverlap(range1: string, range2: string): boolean {
  if (!range1 || !range2) return false;
  const r1 = parseCheckRange(range1);
  const r2 = parseCheckRange(range2);
  if (!r1 || !r2) return false;

  // Check if ranges overlap
  return !(r1.end < r2.start || r2.end < r1.start);
}

const PAYMENT_SESSION_KEY = 'turbosap.payment_method.sessionId';

function getSavedPaymentSessionId() {
  return localStorage.getItem(PAYMENT_SESSION_KEY) || '';
}

function savePaymentSessionId(id: string) {
  localStorage.setItem(PAYMENT_SESSION_KEY, id);
}

// function clearPaymentSessionId() {
//   localStorage.removeItem(PAYMENT_SESSION_KEY);
// }

const PAYMENT_DRAFT_KEY = 'turbosap.payment_method.draft.v1';

type PaymentDraft = {
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
};

function loadPaymentDraft(): PaymentDraft | null {
  try {
    const raw = localStorage.getItem(PAYMENT_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as PaymentDraft) : null;
  } catch {
    return null;
  }
}

function savePaymentDraft(draft: PaymentDraft) {
  localStorage.setItem(PAYMENT_DRAFT_KEY, JSON.stringify(draft));
}

// function clearPaymentDraft() {
//   localStorage.removeItem(PAYMENT_DRAFT_KEY);
// }


// Types for editable CSV data
interface EditablePaymentMethod {
  payment_method: string;
  description: string;
  used: string;
}

interface EditableCheckRange {
  company_code: string;
  bank_account: string;
  check_number_range: string;
}




export function PaymentMethodPage() {
  // Form state - matching April's question IDs
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [houseBanks, setHouseBanks] = useState(''); // q1_p_house_banks
  const [achSpec, setAchSpec] = useState(''); // q1_p_ach_spec
  const [checkVolume, setCheckVolume] = useState(''); // q2_q_volume

  // Check configurations (System Generated and Manual)
  const [systemCheckBankAccount, setSystemCheckBankAccount] = useState('');
  const [systemCheckRange, setSystemCheckRange] = useState('');
  const [manualCheckBankAccount, setManualCheckBankAccount] = useState('');
  const [manualCheckRange, setManualCheckRange] = useState('');

  const [agreeNoPreNote, setAgreeNoPreNote] = useState<boolean | null>(null); // q5_pre_note_confirmation

  // Validation state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});

  // Results state
  const [paymentResults, setPaymentResults] = useState<PaymentMethodConfig[] | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state for collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    ach: true,
    check: true,
    systemCheck: true,
    manualCheck: true,
    prenotification: true,
  });
  const [hydrated, setHydrated] = useState(false);


  // Editable CSV data state
  const [editablePaymentMethods, setEditablePaymentMethods] = useState<EditablePaymentMethod[]>([]);
  const [editableCheckRanges, setEditableCheckRanges] = useState<EditableCheckRange[]>([]);
  const [editablePreNotification, setEditablePreNotification] = useState<string>('No');

useEffect(() => {
  const draft = loadPaymentDraft();

  if (draft) {
    // Restore UI state
    setSelectedMethods(draft.selectedMethods ?? []);
    setHouseBanks(draft.houseBanks ?? '');
    setAchSpec(draft.achSpec ?? '');
    setCheckVolume(draft.checkVolume ?? '');
    setSystemCheckBankAccount(draft.systemCheckBankAccount ?? '');
    setSystemCheckRange(draft.systemCheckRange ?? '');
    setManualCheckBankAccount(draft.manualCheckBankAccount ?? '');
    setManualCheckRange(draft.manualCheckRange ?? '');
    setAgreeNoPreNote(draft.agreeNoPreNote ?? null);
    setPaymentResults(draft.paymentResults ?? null);
    setShowResults(draft.showResults ?? false);
  }

  // ✅ IMPORTANT: mark hydration complete AFTER restore
  setHydrated(true);
}, []);




useEffect(() => {
  if (!hydrated) return;

  const draft: PaymentDraft = {
    selectedMethods,
    houseBanks,
    achSpec,
    checkVolume,
    systemCheckBankAccount,
    systemCheckRange,
    manualCheckBankAccount,
    manualCheckRange,
    agreeNoPreNote,
    paymentResults,
    showResults,
  };

  savePaymentDraft(draft);
}, [
  hydrated,
  selectedMethods,
  houseBanks,
  achSpec,
  checkVolume,
  systemCheckBankAccount,
  systemCheckRange,
  manualCheckBankAccount,
  manualCheckRange,
  agreeNoPreNote,
  paymentResults,
  showResults,
]);


  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleMethodToggle = (method: string) => {
    setSelectedMethods(prev =>
      prev.includes(method)
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  };

  

  // Validate field on change
  const validateField = (fieldName: string, value: string) => {
    const newErrors = { ...fieldErrors };
    const newWarnings = { ...fieldWarnings };

    // Clear previous errors/warnings for this field
    delete newErrors[fieldName];
    delete newWarnings[fieldName];

    switch (fieldName) {
      case 'achSpec':
        const achValidation = validateAchRouting(value);
        if (!achValidation.valid) {
          newWarnings[fieldName] = achValidation.message!;
        }
        break;
      case 'systemCheckRange':
      case 'manualCheckRange':
        const rangeValidation = validateCheckRange(value);
        if (!rangeValidation.valid) {
          newWarnings[fieldName] = rangeValidation.message!;
        }
        // Check for overlap
        if (fieldName === 'systemCheckRange' && manualCheckRange) {
          if (checkRangesOverlap(value, manualCheckRange)) {
            newErrors[fieldName] = 'System and Manual check ranges cannot overlap!';
          }
        } else if (fieldName === 'manualCheckRange' && systemCheckRange) {
          if (checkRangesOverlap(systemCheckRange, value)) {
            newErrors[fieldName] = 'Manual and System check ranges cannot overlap!';
          }
        }
        break;
    }

    setFieldErrors(newErrors);
    setFieldWarnings(newWarnings);
  };

  // Validate all required fields before submission
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Check if at least one payment method selected
    if (selectedMethods.length === 0) {
      setError('Please select at least one payment method');
      return false;
    }

    // Validate P (ACH) fields
    if (selectedMethods.includes('P')) {
      if (!houseBanks.trim()) {
        errors.houseBanks = 'House banks are required for ACH';
      }
      if (!achSpec.trim()) {
        errors.achSpec = 'ACH file specification is required';
      }
    }

    // Validate Q (Check) fields
    if (selectedMethods.includes('Q')) {
      if (!checkVolume.trim()) {
        errors.checkVolume = 'Check volume is required';
      }
      if (!systemCheckRange.trim() && !manualCheckRange.trim()) {
        errors.systemCheckRange = 'At least one check configuration is required';
      }
      // Validate ranges don't overlap
      if (systemCheckRange && manualCheckRange && checkRangesOverlap(systemCheckRange, manualCheckRange)) {
        errors.systemCheckRange = 'Check ranges cannot overlap';
        errors.manualCheckRange = 'Check ranges cannot overlap';
      }
    }

    // Validate pre-note
    if (agreeNoPreNote === null) {
      errors.agreeNoPreNote = 'Please confirm your pre-note decision';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  
  /**
   * Handle form submission - Submit sequentially to April's backend
   * Maps form data to April's question-by-question flow
   */
  const handleGenerateConfig = async () => {
    // Validate form first
    if (!validateForm()) {
      setError('Please fix the errors below before submitting');
      return;
    }

    setIsLoading(true);
    setError(null);
    setShowResults(false);

    try {
      // Step 1: Start session for payment_method module
      let sessionId = getSavedPaymentSessionId();

      if (!sessionId) {
        const start = await startSession('payment_method');
        sessionId = start.sessionId;
        savePaymentSessionId(sessionId);
      }


      // Step 2: Answer Q1 - Payment method P (ACH)?
      let response = await submitAnswer({
        sessionId,
        questionId: 'q1_payment_method_p',
        answer: selectedMethods.includes('P') ? 'yes' : 'no',
      });

      // Step 3: If P selected, answer house banks
      if (selectedMethods.includes('P')) {
        response = await submitAnswer({
          sessionId,
          questionId: 'q1_p_house_banks',
          answer: houseBanks,
        });

        // Step 4: Answer ACH spec
        response = await submitAnswer({
          sessionId,
          questionId: 'q1_p_ach_spec',
          answer: achSpec,
        });
      }

      // Step 5: Answer Q2 - Payment method Q (Physical Check)?
      response = await submitAnswer({
        sessionId,
        questionId: 'q2_payment_method_q',
        answer: selectedMethods.includes('Q') ? 'yes' : 'no',
      });

      // Step 6: If Q selected, answer check volume
      if (selectedMethods.includes('Q')) {
        response = await submitAnswer({
          sessionId,
          questionId: 'q2_q_volume',
          answer: checkVolume,
        });

        // Step 7: Answer check range (combine both if available)
        const checkRangeData = {
          systemGenerated: systemCheckRange ? {
            bankAccount: systemCheckBankAccount,
            range: systemCheckRange,
          } : null,
          manualCheck: manualCheckRange ? {
            bankAccount: manualCheckBankAccount,
            range: manualCheckRange,
          } : null,
        };

        response = await submitAnswer({
          sessionId,
          questionId: 'q2_q_check_range',
          answer: JSON.stringify(checkRangeData),
        });
      }

      // Step 8: Answer Q3 - Payment method K (Pay Card)?
      response = await submitAnswer({
        sessionId,
        questionId: 'q3_payment_method_k',
        answer: selectedMethods.includes('K') ? 'yes' : 'no',
      });

      // Step 9: Answer Q4 - Payment method M (Manual Check)?
      response = await submitAnswer({
        sessionId,
        questionId: 'q4_payment_method_m',
        answer: selectedMethods.includes('M') ? 'yes' : 'no',
      });

      // Step 10: Answer Q5 - Pre-note confirmation
      response = await submitAnswer({
        sessionId,
        questionId: 'q5_pre_note_confirmation',
        answer: agreeNoPreNote ? 'agree' : 'disagree',
      });

      // Check if we got results
      if (response.done && response.paymentMethods) {
        setPaymentResults(response.paymentMethods);
        setShowResults(true);
      } else {
        setError('Configuration incomplete - please check all required fields');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate configuration');
      console.error('Error generating config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Parse paymentResults into editable CSV format when results are generated
  useEffect(() => {
    if (paymentResults && paymentResults.length > 0) {
      // Parse payment methods
      const methods: EditablePaymentMethod[] = paymentResults
        .filter(m => ['P', 'Q', 'K', 'M'].includes(m.code))
        .map(m => ({
          payment_method: m.code,
          description: m.description,
          used: m.used ? 'Yes' : 'No',
        }));
      setEditablePaymentMethods(methods);

      // Parse check ranges
      const ranges: EditableCheckRange[] = [];

      // Add system generated check range if exists
      if (systemCheckRange && systemCheckBankAccount) {
        ranges.push({
          company_code: '1000', // Default company code
          bank_account: systemCheckBankAccount,
          check_number_range: systemCheckRange.replace(/\s+/g, ''), // Remove spaces
        });
      }

      // Add manual check range if exists
      if (manualCheckRange && manualCheckBankAccount) {
        ranges.push({
          company_code: '1000', // Default company code
          bank_account: manualCheckBankAccount,
          check_number_range: manualCheckRange.replace(/\s+/g, ''), // Remove spaces
        });
      }

      setEditableCheckRanges(ranges);

      // Parse pre-notification
      const preNoteConfig = paymentResults.find(m => m.code === 'PRE_NOTE');
      if (preNoteConfig) {
        setEditablePreNotification(preNoteConfig.agree_no_pre_note ? 'No' : 'Yes');
      } else {
        setEditablePreNotification(agreeNoPreNote ? 'No' : 'Yes');
      }
    }
  }, [
    paymentResults,
    systemCheckRange,
    systemCheckBankAccount,
    manualCheckRange,
    manualCheckBankAccount,
    agreeNoPreNote,
  ]);


  // CSV Export Functions
  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const key = header.toLowerCase().replace(/ /g, '_');
          return escapeCSV(String(row[key] || ''));
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPaymentMethods = () => {
    exportToCSV(
      editablePaymentMethods,
      'Payment_Method_File.csv',
      ['Payment_Method', 'Description', 'Used']
    );
  };

  const handleExportCheckRanges = () => {
    exportToCSV(
      editableCheckRanges,
      'Check_Range_File.csv',
      ['Company_Code', 'Bank_Account', 'Check_Number_Range']
    );
  };

  const handleExportPreNotification = () => {
    exportToCSV(
      [{ pre_notification_required: editablePreNotification }],
      'Pre_Notification.csv',
      ['Pre_Notification_Required']
    );
  };

  const handleExportAll = () => {
    handleExportPaymentMethods();
    setTimeout(() => handleExportCheckRanges(), 100);
    setTimeout(() => handleExportPreNotification(), 200);
  };

  // Add/remove check range rows
  const handleAddCheckRange = () => {
    setEditableCheckRanges([
      ...editableCheckRanges,
      { company_code: '1000', bank_account: '', check_number_range: '' }
    ]);
  };

  const handleRemoveCheckRange = (index: number) => {
    setEditableCheckRanges(editableCheckRanges.filter((_, i) => i !== index));
  };

  const handleUpdateCheckRange = (index: number, field: keyof EditableCheckRange, value: string) => {
    const updated = [...editableCheckRanges];
    updated[index][field] = value;
    setEditableCheckRanges(updated);
  };

  const handleUpdatePaymentMethod = (index: number, field: keyof EditablePaymentMethod, value: string) => {
    const updated = [...editablePaymentMethods];
    updated[index][field] = value;
    setEditablePaymentMethods(updated);
  };

  return (
    <DashboardLayout
      title="Payment Method Configuration"
      description="Configure payment methods for payroll processing"
      currentPath="/payment-methods"
    >
      <div className="space-y-6">
        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Payment Method Selection */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-secondary rounded-lg">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Select Payment Methods <span className="text-red-500">*</span>
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose which payment methods to configure for your payroll
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* P - ACH Option */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedMethods.includes('P')}
                onChange={() => handleMethodToggle('P')}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/50"
              />
              <div className="flex-1">
                <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                  P - Direct Deposit ACH
                </div>
                <div className="text-sm text-muted-foreground">
                  Electronic bank transfers - recommended for most employees
                </div>
              </div>
            </label>

            {/* Q - Physical Check Option */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedMethods.includes('Q')}
                onChange={() => handleMethodToggle('Q')}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/50"
              />
              <div className="flex-1">
                <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                  Q - Physical Check
                </div>
                <div className="text-sm text-muted-foreground">
                  Paper checks mailed or handed to employees
                </div>
              </div>
            </label>

            {/* K - Pay Card Option */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedMethods.includes('K')}
                onChange={() => handleMethodToggle('K')}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/50"
              />
              <div className="flex-1">
                <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                  K - Pay Card (Debit Card)
                </div>
                <div className="text-sm text-muted-foreground">
                  Payroll debit cards for employees
                </div>
              </div>
            </label>

            {/* M - Manual/Off-cycle Check Option */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedMethods.includes('M')}
                onChange={() => handleMethodToggle('M')}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/50"
              />
              <div className="flex-1">
                <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                  M - Manual / Off-cycle Check
                </div>
                <div className="text-sm text-muted-foreground">
                  Manual checks for special payroll runs
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* ACH Configuration Section */}
        {selectedMethods.includes('P') && (
          <div className="bg-card border border-border rounded-lg p-6">
            <button
              onClick={() => toggleSection('ach')}
              className="w-full flex items-center justify-between mb-6 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-secondary rounded-lg">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    ACH Configuration
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Configure bank account details for ACH transfers
                  </p>
                </div>
              </div>
              {expandedSections.ach ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {expandedSections.ach && (
              <div className="space-y-4 border-t border-border pt-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    House Bank Names <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={houseBanks}
                    onChange={(e) => {
                      setHouseBanks(e.target.value);
                      if (fieldErrors.houseBanks) {
                        const newErrors = { ...fieldErrors };
                        delete newErrors.houseBanks;
                        setFieldErrors(newErrors);
                      }
                    }}
                    placeholder="e.g., Bank of America, Wells Fargo"
                    className={cn(
                      "w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                      fieldErrors.houseBanks && "border-red-500"
                    )}
                  />
                  {fieldErrors.houseBanks && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {fieldErrors.houseBanks}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    List the house bank names used for ACH payments
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    ACH File Specification (9 digits) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={achSpec}
                    onChange={(e) => {
                      setAchSpec(e.target.value);
                      validateField('achSpec', e.target.value);
                      if (fieldErrors.achSpec) {
                        const newErrors = { ...fieldErrors };
                        delete newErrors.achSpec;
                        setFieldErrors(newErrors);
                      }
                    }}
                    placeholder="e.g., 123456789"
                    maxLength={9}
                    className={cn(
                      "w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                      fieldWarnings.achSpec && "border-yellow-500",
                      fieldErrors.achSpec && "border-red-500"
                    )}
                  />
                  {fieldWarnings.achSpec && (
                    <p className="text-sm text-yellow-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      {fieldWarnings.achSpec}
                    </p>
                  )}
                  {fieldErrors.achSpec && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {fieldErrors.achSpec}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    ACH routing number (must be 9 digits)
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Check Configuration Section */}
        {selectedMethods.includes('Q') && (
          <div className="bg-card border border-border rounded-lg p-6">
            <button
              onClick={() => toggleSection('check')}
              className="w-full flex items-center justify-between mb-6 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-secondary rounded-lg">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Check Configuration
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Configure physical check details
                  </p>
                </div>
              </div>
              {expandedSections.check ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {expandedSections.check && (
              <div className="space-y-6 border-t border-border pt-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Check Volume <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={checkVolume}
                    onChange={(e) => {
                      setCheckVolume(e.target.value);
                      if (fieldErrors.checkVolume) {
                        const newErrors = { ...fieldErrors };
                        delete newErrors.checkVolume;
                        setFieldErrors(newErrors);
                      }
                    }}
                    placeholder="e.g., 500 checks per month"
                    className={cn(
                      "w-full px-4 py-2 bg-background border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary ",
                      fieldErrors.checkVolume && "border-red-500"
                    )}
                  />
                  {fieldErrors.checkVolume && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {fieldErrors.checkVolume}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Volume of physical payroll checks
                  </p>
                </div>

                {/* System Generated Check Configuration */}
                <div className="border border-border rounded-lg p-4 bg-secondary">
                  <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <span className="text-primary">●</span> System Generated Check
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Bank Account Number
                      </label>
                      <input
                        type="text"
                        value={systemCheckBankAccount}
                        onChange={(e) => setSystemCheckBankAccount(e.target.value)}
                        placeholder="e.g., 9999999999"
                        className="w-full px-4 py-2 bg-background border border-border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary "
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Check Number Range
                      </label>
                      <input
                        type="text"
                        value={systemCheckRange}
                        onChange={(e) => {
                          setSystemCheckRange(e.target.value);
                          validateField('systemCheckRange', e.target.value);
                        }}
                        placeholder="e.g., 1000000 - 9999999"
                        className={cn(
                          "w-full px-4 py-2 bg-background border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary ",
                          fieldWarnings.systemCheckRange && "border-yellow-500",
                          fieldErrors.systemCheckRange && "border-red-500"
                        )}
                      />
                      {fieldWarnings.systemCheckRange && (
                        <p className="text-sm text-yellow-600 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          {fieldWarnings.systemCheckRange}
                        </p>
                      )}
                      {fieldErrors.systemCheckRange && (
                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {fieldErrors.systemCheckRange}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Manual Check Configuration */}
                <div className="border border-border rounded-lg p-4 bg-secondary">
                  <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <span className="text-primary">●</span> Manual Check
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Bank Account Number
                      </label>
                      <input
                        type="text"
                        value={manualCheckBankAccount}
                        onChange={(e) => setManualCheckBankAccount(e.target.value)}
                        placeholder="e.g., 88888888888"
                        className="w-full px-4 py-2 bg-background border border-border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary "
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Check Number Range
                      </label>
                      <input
                        type="text"
                        value={manualCheckRange}
                        onChange={(e) => {
                          setManualCheckRange(e.target.value);
                          validateField('manualCheckRange', e.target.value);
                        }}
                        placeholder="e.g., 10000000 - 19999999"
                        className={cn(
                          "w-full px-4 py-2 bg-background border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary ",
                          fieldWarnings.manualCheckRange && "border-yellow-500",
                          fieldErrors.manualCheckRange && "border-red-500"
                        )}
                      />
                      {fieldWarnings.manualCheckRange && (
                        <p className="text-sm text-yellow-600 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          {fieldWarnings.manualCheckRange}
                        </p>
                      )}
                      {fieldErrors.manualCheckRange && (
                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {fieldErrors.manualCheckRange}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Important:</strong> System Generated and Manual Check ranges must NOT overlap!
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pre-notification Section */}
        <div className="bg-card border border-border rounded-lg p-6">
          <button
            onClick={() => toggleSection('prenotification')}
            className="w-full flex items-center justify-between mb-6 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-secondary rounded-lg">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Pre-notification Requirements <span className="text-red-500">*</span>
                </h2>
                <p className="text-sm text-muted-foreground">
                  Important information about ACH pre-notification
                </p>
              </div>
            </div>
            {expandedSections.prenotification ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          {expandedSections.prenotification && (
            <div className="space-y-4 border-t border-border pt-6">
              <div className="bg-secondary rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  We recommend <strong>NOT</strong> to have the pre-note process. There is a check replacement
                  process that can be used if the bank transfer fails due to an invalid bank account.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Please confirm your decision:
                </p>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="preNote"
                    checked={agreeNoPreNote === true}
                    onChange={() => {
                      setAgreeNoPreNote(true);
                      const newErrors = { ...fieldErrors };
                      delete newErrors.agreeNoPreNote;
                      setFieldErrors(newErrors);
                    }}
                    className="mt-0.5 h-4 w-4 text-primary focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">
                      Yes, I confirm we will NOT use the pre-note process
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Recommended - uses check replacement for failed transfers
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="preNote"
                    checked={agreeNoPreNote === false}
                    onChange={() => {
                      setAgreeNoPreNote(false);
                      const newErrors = { ...fieldErrors };
                      delete newErrors.agreeNoPreNote;
                      setFieldErrors(newErrors);
                    }}
                    className="mt-0.5 h-4 w-4 text-primary focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">
                      No, we prefer to retain the pre-note process
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Requires additional setup and processing time
                    </div>
                  </div>
                </label>

                {fieldErrors.agreeNoPreNote && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {fieldErrors.agreeNoPreNote}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Generate Button */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleGenerateConfig}
            disabled={isLoading}
            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50 font-medium rounded-lg transition-colors"
          >
            {isLoading ? 'Generating Configuration...' : 'Generate Configuration'}
          </button>
        </div>

        {/* Results Display */}
        {showResults && paymentResults && (
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-secondary rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Configuration Generated Successfully
                </h2>
                <p className="text-sm text-muted-foreground">
                  Your payment method configuration is ready
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {paymentResults.map((method, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {method.code} - {method.description}
                      </h3>
                    </div>
                    {method.used && (
                      <span className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded">
                        In Use
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    {method.house_banks && (
                      <div>
                        <span className="text-muted-foreground">House Banks: </span>
                        <span className="text-foreground">{method.house_banks}</span>
                      </div>
                    )}
                    {method.ach_file_spec && (
                      <div>
                        <span className="text-muted-foreground">ACH Spec: </span>
                        <span className="text-foreground">{method.ach_file_spec}</span>
                      </div>
                    )}
                    {method.check_volume && (
                      <div>
                        <span className="text-muted-foreground">Check Volume: </span>
                        <span className="text-foreground">{method.check_volume}</span>
                      </div>
                    )}
                    {method.check_number_range && (
                      <div>
                        <span className="text-muted-foreground">Check Range: </span>
                        <span className="font-mono text-foreground">{method.check_number_range}</span>
                      </div>
                    )}
                  </div>

                  {method.reasoning && method.reasoning.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Configuration Reasoning:
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {method.reasoning.map((reason, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Editable CSV Export Section */}
            <div className="border-t border-border pt-6 mt-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Export Configuration Files
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Review and edit data before exporting to CSV
                  </p>
                </div>
                <button
                  onClick={handleExportAll}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export All CSVs
                </button>
              </div>

              <div className="space-y-6">
                {/* Payment Methods Table */}
                <div className="rounded-lg border border-border bg-background">
                  <div className="flex items-center justify-between p-4 border-b border-border bg-secondary">
                    <h4 className="font-medium text-foreground">Payment Methods</h4>
                    <button
                      onClick={handleExportPaymentMethods}
                      className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors flex items-center gap-1"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-secondary/50 border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Payment Method</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Description</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Used</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editablePaymentMethods.map((method, index) => (
                          <tr key={index} className="border-b border-border last:border-0">
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={method.payment_method}
                                onChange={(e) => handleUpdatePaymentMethod(index, 'payment_method', e.target.value)}
                                className="w-full px-2 py-1 border border-input rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={method.description}
                                onChange={(e) => handleUpdatePaymentMethod(index, 'description', e.target.value)}
                                className="w-full px-2 py-1 border border-input rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={method.used}
                                onChange={(e) => handleUpdatePaymentMethod(index, 'used', e.target.value)}
                                className="w-full px-2 py-1 border border-input rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                              >
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Check Ranges Table */}
                <div className="rounded-lg border border-border bg-background">
                  <div className="flex items-center justify-between p-4 border-b border-border bg-secondary">
                    <h4 className="font-medium text-foreground">Check Ranges</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddCheckRange}
                        className="px-3 py-1.5 text-sm bg-secondary text-foreground rounded hover:bg-secondary/80 transition-colors flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Row
                      </button>
                      <button
                        onClick={handleExportCheckRanges}
                        className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors flex items-center gap-1"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-secondary/50 border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Company Code</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Bank Account</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Check Number Range</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground w-16">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editableCheckRanges.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                              No check ranges configured. Click "Add Row" to add one.
                            </td>
                          </tr>
                        ) : (
                          editableCheckRanges.map((range, index) => (
                            <tr key={index} className="border-b border-border last:border-0">
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={range.company_code}
                                  onChange={(e) => handleUpdateCheckRange(index, 'company_code', e.target.value)}
                                  className="w-full px-2 py-1 border border-input rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                  placeholder="1000"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={range.bank_account}
                                  onChange={(e) => handleUpdateCheckRange(index, 'bank_account', e.target.value)}
                                  className="w-full px-2 py-1 border border-input rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                  placeholder="999999999"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={range.check_number_range}
                                  onChange={(e) => handleUpdateCheckRange(index, 'check_number_range', e.target.value)}
                                  className="w-full px-2 py-1 border border-input rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                  placeholder="10000000-29999999"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => handleRemoveCheckRange(index)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Remove row"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pre-Notification Setting */}
                <div className="rounded-lg border border-border bg-background">
                  <div className="flex items-center justify-between p-4 border-b border-border bg-secondary">
                    <h4 className="font-medium text-foreground">Pre-Notification</h4>
                    <button
                      onClick={handleExportPreNotification}
                      className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors flex items-center gap-1"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export CSV
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-4">
                      <label className="text-sm font-medium text-foreground">
                        Pre-Notification Required:
                      </label>
                      <select
                        value={editablePreNotification}
                        onChange={(e) => setEditablePreNotification(e.target.value)}
                        className="px-4 py-2 bg-background border border-border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
