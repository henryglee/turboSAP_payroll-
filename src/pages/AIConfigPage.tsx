/**
 * AIConfigPage - Hybrid AI Configuration Interface
 *
 * Split layout:
 * - Top: Live configuration preview table (updates as user answers)
 * - Bottom: AI-guided Q&A assistant
 *
 * This is separate from both PayrollAreaPage and AIPayrollPage.
 */

import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useConfigStore } from '../store';
import {
  Sparkles,
  Download,
  ChevronRight,
  HelpCircle,
  Loader2,
  CheckCircle2,
  Table,
  MessageSquare,
  Settings,
  Info
} from 'lucide-react';
import type { PayrollArea, PayFrequencyType } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Types
interface PeriodConfig {
  paydays: string[];
}

interface FrequencyConfig {
  periods: { [periodKey: string]: PeriodConfig };
}

interface ConfigState {
  frequencies: string[];
  frequencyConfigs: { [freq: string]: FrequencyConfig };
  regions: string[];
  needsRegionSeparation: boolean;
  businessUnits: string[];
  needsBusinessUnitSeparation: boolean;
}

interface PayrollAreaPreview {
  code: string;
  description: string;
  frequency: string;
  period: string;
  payday: string;
  region: string;
  businessUnit?: string;
  isComplete: boolean;
}

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

// Constants
const FREQUENCIES = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Bi-weekly' },
  { id: 'semimonthly', label: 'Semi-monthly' },
  { id: 'monthly', label: 'Monthly' },
];

const PERIODS: { [freq: string]: { id: string; label: string }[] } = {
  weekly: [
    { id: 'mon-sun', label: 'Mon-Sun' },
    { id: 'sun-sat', label: 'Sun-Sat' },
  ],
  biweekly: [
    { id: 'mon-sun', label: 'Mon-Sun' },
    { id: 'sun-sat', label: 'Sun-Sat' },
  ],
  semimonthly: [
    { id: '1-15_16-end', label: '1st-15th & 16th-End' },
  ],
  monthly: [
    { id: '1-end', label: '1st-End' },
  ],
};

const PAYDAYS: { [freq: string]: { id: string; label: string }[] } = {
  weekly: [
    { id: 'friday', label: 'Fri' },
    { id: 'thursday', label: 'Thu' },
    { id: 'wednesday', label: 'Wed' },
  ],
  biweekly: [
    { id: 'friday', label: 'Fri' },
    { id: 'thursday', label: 'Thu' },
  ],
  semimonthly: [
    { id: '15-last', label: '15th & Last' },
    { id: '15-30', label: '15th & 30th' },
  ],
  monthly: [
    { id: '15', label: '15th' },
    { id: 'last', label: 'Last day' },
  ],
};

const REGIONS = [
  { id: 'mainland', label: 'Mainland US' },
  { id: 'hawaii', label: 'Hawaii' },
  { id: 'puerto_rico', label: 'Puerto Rico' },
  { id: 'alaska', label: 'Alaska' },
];

// Step definitions
type StepId = 'frequencies' | 'frequency-details' | 'regions' | 'business-units' | 'review';

const STEPS: { id: StepId; label: string }[] = [
  { id: 'frequencies', label: 'Pay Frequencies' },
  { id: 'frequency-details', label: 'Schedule Details' },
  { id: 'regions', label: 'Geographic Regions' },
  { id: 'business-units', label: 'Business Units' },
  { id: 'review', label: 'Review' },
];

export function AIConfigPage() {
  const { profile } = useConfigStore();

  // Configuration state
  const [config, setConfig] = useState<ConfigState>({
    frequencies: [],
    frequencyConfigs: {},
    regions: [],
    needsRegionSeparation: false,
    businessUnits: [],
    needsBusinessUnitSeparation: false,
  });

  // UI state
  const [currentStep, setCurrentStep] = useState<StepId>('frequencies');
  const [currentFrequencyIndex, setCurrentFrequencyIndex] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userQuestion, setUserQuestion] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [previewAreas, setPreviewAreas] = useState<PayrollAreaPreview[]>([]);
  const [aiStatus, setAiStatus] = useState<{ enabled: boolean; message: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check AI status on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/ai-config/status`)
      .then(res => res.json())
      .then(data => setAiStatus(data))
      .catch(() => setAiStatus({ enabled: false, message: 'AI service unavailable' }));
  }, []);

  // Compute preview areas whenever config changes
  useEffect(() => {
    const areas = computePreviewAreas(config);
    setPreviewAreas(areas);
  }, [config]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Generate initial AI message when step changes
  useEffect(() => {
    generateStepMessage(currentStep);
  }, [currentStep, currentFrequencyIndex]);

  // Compute preview areas from config (correct permutation logic)
  function computePreviewAreas(cfg: ConfigState): PayrollAreaPreview[] {
    const areas: PayrollAreaPreview[] = [];
    let codeIndex = 1;

    if (cfg.frequencies.length === 0) {
      return [];
    }

    for (const freq of cfg.frequencies) {
      const freqConfig = cfg.frequencyConfigs[freq];

      if (!freqConfig || Object.keys(freqConfig.periods).length === 0) {
        // Incomplete - show placeholder
        areas.push({
          code: `Z${codeIndex++}`,
          description: `${freq.charAt(0).toUpperCase() + freq.slice(1)} (configuring...)`,
          frequency: freq,
          period: '-',
          payday: '-',
          region: '-',
          isComplete: false,
        });
        continue;
      }

      // For each period this frequency uses
      for (const [periodKey, periodConfig] of Object.entries(freqConfig.periods)) {
        if (periodConfig.paydays.length === 0) {
          areas.push({
            code: `Z${codeIndex++}`,
            description: `${freq} ${periodKey} (select payday)`,
            frequency: freq,
            period: periodKey,
            payday: '-',
            region: '-',
            isComplete: false,
          });
          continue;
        }

        // For each payday in this period
        for (const payday of periodConfig.paydays) {
          // For each region (or 'All' if no separation)
          const regions = cfg.needsRegionSeparation && cfg.regions.length > 0
            ? cfg.regions
            : ['all'];

          for (const region of regions) {
            const freqAbbrev = {
              weekly: 'Wkly',
              biweekly: 'BiWk',
              semimonthly: 'SemiMo',
              monthly: 'Mo'
            }[freq] || freq.slice(0, 4);

            const regionAbbrev = {
              mainland: 'ML',
              hawaii: 'HI',
              puerto_rico: 'PR',
              alaska: 'AK',
              all: ''
            }[region] || region.slice(0, 2).toUpperCase();

            const paydayAbbrev = payday.charAt(0).toUpperCase() + payday.slice(1, 3);

            const descParts = [freqAbbrev, paydayAbbrev];
            if (regionAbbrev) descParts.push(regionAbbrev);

            areas.push({
              code: `Z${codeIndex++}`,
              description: descParts.join(' '),
              frequency: freq,
              period: periodKey,
              payday: payday,
              region: region === 'all' ? 'All' : region,
              isComplete: true,
            });
          }
        }
      }
    }

    return areas;
  }

  // Static fallback messages
  const FALLBACK_MESSAGES: { [key in StepId]: string } = {
    'frequencies': "Let's start by selecting which pay frequencies your company uses. Most organizations have 1-3 different frequencies based on employee types.",
    'frequency-details': "Now configure the pay period pattern and pay days for this frequency. These determine when pay periods end and when employees receive payment.",
    'regions': "If you have employees in Hawaii, Puerto Rico, or Alaska, they typically need separate payroll areas due to different tax rules and time zones.",
    'business-units': "Business unit separation allows different divisions to have independent payroll processing, GL postings, and reporting.",
    'review': "Your configuration is complete. Review the payroll areas in the table above and export when ready.",
  };

  // Generate AI message for current step
  async function generateStepMessage(step: StepId) {
    setIsLoadingAI(true);

    try {
      const response = await fetch(`${API_BASE}/api/ai-config/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: step,
          config: config,
          currentFrequency: config.frequencies[currentFrequencyIndex] || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message,
        }]);
      } else {
        // Use fallback
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: FALLBACK_MESSAGES[step],
        }]);
      }
    } catch (err) {
      // Use fallback on error
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: FALLBACK_MESSAGES[step],
      }]);
    } finally {
      setIsLoadingAI(false);
    }
  }

  // Handle frequency selection
  function toggleFrequency(freqId: string) {
    setConfig(prev => {
      const newFreqs = prev.frequencies.includes(freqId)
        ? prev.frequencies.filter(f => f !== freqId)
        : [...prev.frequencies, freqId];

      // Initialize config for new frequencies
      const newConfigs = { ...prev.frequencyConfigs };
      for (const freq of newFreqs) {
        if (!newConfigs[freq]) {
          newConfigs[freq] = { periods: {} };
        }
      }
      // Remove config for deselected frequencies
      for (const freq of Object.keys(newConfigs)) {
        if (!newFreqs.includes(freq)) {
          delete newConfigs[freq];
        }
      }

      return { ...prev, frequencies: newFreqs, frequencyConfigs: newConfigs };
    });
  }

  // Handle period selection for current frequency
  function togglePeriod(periodId: string) {
    const freq = config.frequencies[currentFrequencyIndex];
    if (!freq) return;

    setConfig(prev => {
      const freqConfig = prev.frequencyConfigs[freq] || { periods: {} };
      const newPeriods = { ...freqConfig.periods };

      if (newPeriods[periodId]) {
        delete newPeriods[periodId];
      } else {
        newPeriods[periodId] = { paydays: [] };
      }

      return {
        ...prev,
        frequencyConfigs: {
          ...prev.frequencyConfigs,
          [freq]: { ...freqConfig, periods: newPeriods },
        },
      };
    });
  }

  // Handle payday selection for a specific period
  function togglePayday(periodId: string, paydayId: string) {
    const freq = config.frequencies[currentFrequencyIndex];
    if (!freq) return;

    setConfig(prev => {
      const freqConfig = prev.frequencyConfigs[freq];
      if (!freqConfig) return prev;

      const periodConfig = freqConfig.periods[periodId];
      if (!periodConfig) return prev;

      const newPaydays = periodConfig.paydays.includes(paydayId)
        ? periodConfig.paydays.filter(p => p !== paydayId)
        : [...periodConfig.paydays, paydayId];

      return {
        ...prev,
        frequencyConfigs: {
          ...prev.frequencyConfigs,
          [freq]: {
            ...freqConfig,
            periods: {
              ...freqConfig.periods,
              [periodId]: { paydays: newPaydays },
            },
          },
        },
      };
    });
  }

  // Handle region selection
  function toggleRegion(regionId: string) {
    setConfig(prev => ({
      ...prev,
      regions: prev.regions.includes(regionId)
        ? prev.regions.filter(r => r !== regionId)
        : [...prev.regions, regionId],
    }));
  }

  // Navigate to next step
  function nextStep() {
    if (currentStep === 'frequencies') {
      if (config.frequencies.length === 0) return;
      setCurrentFrequencyIndex(0);
      setCurrentStep('frequency-details');
    } else if (currentStep === 'frequency-details') {
      if (currentFrequencyIndex < config.frequencies.length - 1) {
        setCurrentFrequencyIndex(prev => prev + 1);
      } else {
        setCurrentStep('regions');
      }
    } else if (currentStep === 'regions') {
      setCurrentStep('review'); // Skip business units for demo simplicity
    } else if (currentStep === 'business-units') {
      setCurrentStep('review');
    }
  }

  // Ask AI a question
  async function askQuestion() {
    if (!userQuestion.trim()) return;

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: userQuestion,
    }]);

    const question = userQuestion;
    setUserQuestion('');
    setIsLoadingAI(true);

    try {
      const response = await fetch(`${API_BASE}/api/ai-config/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: currentStep,
          config: config,
          currentFrequency: config.frequencies[currentFrequencyIndex] || null,
          userQuestion: question,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I can help explain SAP payroll concepts. What would you like to know about pay frequencies, periods, or regional separation?",
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I can help explain SAP payroll concepts. What would you like to know?",
      }]);
    } finally {
      setIsLoadingAI(false);
    }
  }

  // Save to store and export
  function handleExport() {
    const areas: PayrollArea[] = previewAreas
      .filter(a => a.isComplete)
      .map(a => ({
        code: a.code,
        description: a.description,
        frequency: a.frequency as PayFrequencyType,
        calendarId: getCalendarId(a.frequency),
        businessUnit: a.businessUnit,
        timeZone: undefined,
        union: undefined,
        employeeCount: 0,
        generatedBy: 'system' as const,
        reasoning: [`Frequency: ${a.frequency}`, `Period: ${a.period}`, `Payday: ${a.payday}`, `Region: ${a.region}`],
        periodPattern: a.period,
        payDay: a.payday,
        region: a.region === 'All' ? undefined : a.region,
      }));

    useConfigStore.setState({
      payrollAreas: areas,
      validation: {
        isValid: true,
        employeesCovered: 0,
        totalEmployees: profile.totalEmployees,
        warnings: [],
        errors: [],
      },
    });

    // Navigate to export page
    window.location.href = '/export';
  }

  function getCalendarId(freq: string): string {
    const codes: { [key: string]: number } = {
      weekly: 80,
      biweekly: 20,
      semimonthly: 30,
      monthly: 40,
    };
    return String(codes[freq] || 90);
  }

  // Get current step index for progress
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progressPercent = ((currentStepIndex + 1) / STEPS.length) * 100;

  // Current frequency being configured
  const currentFreq = config.frequencies[currentFrequencyIndex];
  const currentFreqConfig = currentFreq ? config.frequencyConfigs[currentFreq] : null;

  return (
    <DashboardLayout
      title="AI Payroll Configuration"
      description="Configure payroll areas with AI assistance"
      currentPath="/ai-config"
    >
      <div className="space-y-4">
        {/* Awaiting Enterprise Configuration - Full page block */}
        {aiStatus && !aiStatus.enabled ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="max-w-md text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-violet-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                AI Assistant — Awaiting Configuration
              </h2>
              <p className="text-gray-600 mb-4">
                This feature uses AI to guide you through payroll configuration with intelligent recommendations.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-medium">Why isn't this enabled yet?</span>
                </p>
                <p className="text-sm text-gray-600">
                  For security, we don't ship with pre-configured API credentials. During implementation, your team will connect your organization's preferred AI provider (OpenAI, Anthropic, Azure, etc.) — ensuring data stays within your security policies.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <a
                  href="/payroll-area"
                  className="inline-flex items-center justify-center px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
                >
                  Use Standard Configuration
                  <ChevronRight className="w-4 h-4 ml-1" />
                </a>
                <p className="text-xs text-gray-500">
                  The standard payroll area page is fully functional
                </p>
              </div>
            </div>
          </div>
        ) : (
        <>
        {/* Progress bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-medium text-gray-700">
                Step {currentStepIndex + 1} of {STEPS.length}: {STEPS[currentStepIndex]?.label}
              </span>
            </div>
            <span className="text-sm text-gray-500">
              {previewAreas.filter(a => a.isComplete).length} areas configured
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Live Preview Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Table className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Live Configuration Preview</span>
            </div>
            {currentStep === 'review' && (
              <button
                onClick={handleExport}
                className="px-3 py-1.5 bg-violet-600 text-white text-sm rounded-md hover:bg-violet-700 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            )}
          </div>
          <div className="overflow-x-auto max-h-48">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Freq</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payday</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewAreas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-gray-400 text-sm">
                      Select pay frequencies to begin...
                    </td>
                  </tr>
                ) : (
                  previewAreas.map((area) => (
                    <tr key={area.code} className={area.isComplete ? '' : 'bg-amber-50'}>
                      <td className="px-3 py-2 font-mono text-violet-600">{area.code}</td>
                      <td className="px-3 py-2 text-gray-900">{area.description}</td>
                      <td className="px-3 py-2 text-gray-600 capitalize">{area.frequency}</td>
                      <td className="px-3 py-2 text-gray-600">{area.period}</td>
                      <td className="px-3 py-2 text-gray-600 capitalize">{area.payday}</td>
                      <td className="px-3 py-2 text-gray-600 capitalize">{area.region}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Configuration Assistant */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-medium text-violet-900">Configuration Assistant</span>
          </div>

          {/* Messages */}
          <div className="h-32 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`text-sm ${msg.role === 'assistant' ? 'text-gray-700' : 'text-violet-700 text-right'}`}
              >
                {msg.content}
              </div>
            ))}
            {isLoadingAI && (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Question input area */}
          <div className="p-4 border-t border-gray-200 space-y-4">
            {/* Step-specific content */}
            {currentStep === 'frequencies' && (
              <div>
                <div className="text-sm text-gray-600 mb-3">Select pay frequencies:</div>
                <div className="flex flex-wrap gap-2">
                  {FREQUENCIES.map((freq) => (
                    <button
                      key={freq.id}
                      onClick={() => toggleFrequency(freq.id)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        config.frequencies.includes(freq.id)
                          ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-500'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {freq.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 'frequency-details' && currentFreq && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-gray-700">
                  Configure {currentFreq.toUpperCase()} ({currentFrequencyIndex + 1}/{config.frequencies.length})
                </div>

                {/* Period selection */}
                <div>
                  <div className="text-xs text-gray-500 mb-2">Pay periods:</div>
                  <div className="flex flex-wrap gap-2">
                    {PERIODS[currentFreq]?.map((period) => (
                      <button
                        key={period.id}
                        onClick={() => togglePeriod(period.id)}
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                          currentFreqConfig?.periods[period.id]
                            ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-500'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payday selection per period */}
                {currentFreqConfig && Object.keys(currentFreqConfig.periods).map((periodId) => (
                  <div key={periodId}>
                    <div className="text-xs text-gray-500 mb-2">
                      {periodId.toUpperCase()} paydays:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {PAYDAYS[currentFreq]?.map((payday) => (
                        <button
                          key={payday.id}
                          onClick={() => togglePayday(periodId, payday.id)}
                          className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                            currentFreqConfig.periods[periodId]?.paydays.includes(payday.id)
                              ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {payday.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {currentStep === 'regions' && (
              <div>
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-sm text-gray-600">Need regional separation?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, needsRegionSeparation: true }))}
                      className={`px-3 py-1 rounded text-sm ${
                        config.needsRegionSeparation
                          ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-500'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, needsRegionSeparation: false, regions: [] }))}
                      className={`px-3 py-1 rounded text-sm ${
                        !config.needsRegionSeparation
                          ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-500'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
                {config.needsRegionSeparation && (
                  <div className="flex flex-wrap gap-2">
                    {REGIONS.map((region) => (
                      <button
                        key={region.id}
                        onClick={() => toggleRegion(region.id)}
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                          config.regions.includes(region.id)
                            ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-500'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {region.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentStep === 'review' && (
              <div className="text-center py-4">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <div className="text-sm text-gray-600">
                  Configuration complete! Review the table above and export when ready.
                </div>
              </div>
            )}

            {/* Navigation + Ask question */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2 flex-1">
                <HelpCircle className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={userQuestion}
                  onChange={(e) => setUserQuestion(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                  onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
                />
              </div>
              {currentStep !== 'review' && (
                <button
                  onClick={nextStep}
                  disabled={
                    (currentStep === 'frequencies' && config.frequencies.length === 0) ||
                    (currentStep === 'frequency-details' && !hasValidFrequencyConfig())
                  }
                  className="ml-4 px-4 py-1.5 bg-violet-600 text-white text-sm rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </DashboardLayout>
  );

  function hasValidFrequencyConfig(): boolean {
    const freq = config.frequencies[currentFrequencyIndex];
    if (!freq) return false;
    const cfg = config.frequencyConfigs[freq];
    if (!cfg || Object.keys(cfg.periods).length === 0) return false;
    // Check at least one payday selected for each period
    for (const period of Object.values(cfg.periods)) {
      if (period.paydays.length === 0) return false;
    }
    return true;
  }
}
