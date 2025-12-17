/**
 * ChatCard - Restyled chat interface for the new DashboardLayout UI
 * Wraps the chat Q&A flow in a card with modern styling
 *
 * Features:
 * - Light background with card styling
 * - Progress bar at top
 * - Breadcrumb navigation
 * - Chat messages with updated colors
 */

import React, { useState, useEffect, useRef } from 'react';
import { startSession, submitAnswer } from '../../api/langgraph';
import type { ChatMessage, Question, GeneratedPayrollArea, ChatState } from '../../types/chat';
import { MessageCircle, Play, CheckCircle2, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth';
import { useConfigStore } from '../../store';

// ============================================
// User-scoped localStorage persistence
// ============================================
interface PayrollDraft {
  sessionId: string | null;
  messages: ChatMessage[];
  answers: Record<string, string | string[]>;
  isComplete: boolean;
  progress: number;
}

function payrollSessionKey(userKey: string) {
  return `turbosap.payroll_area.sessionId.${userKey}`;
}

function payrollDraftKey(userKey: string) {
  return `turbosap.payroll_area.draft.v1.${userKey}`;
}

function savePayrollSessionId(userKey: string, id: string) {
  localStorage.setItem(payrollSessionKey(userKey), id);
}

function clearPayrollSession(userKey: string) {
  localStorage.removeItem(payrollSessionKey(userKey));
  localStorage.removeItem(payrollDraftKey(userKey));
}

function loadPayrollDraft(userKey: string): PayrollDraft | null {
  try {
    const raw = localStorage.getItem(payrollDraftKey(userKey));
    if (!raw) return null;
    const draft = JSON.parse(raw) as PayrollDraft;
    // Restore Date objects for messages
    draft.messages = draft.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
    return draft;
  } catch {
    return null;
  }
}

function savePayrollDraft(userKey: string, draft: PayrollDraft) {
  localStorage.setItem(payrollDraftKey(userKey), JSON.stringify(draft));
}

interface ChatCardProps {
  /** Called when configuration is complete with generated payroll areas */
  onComplete: (areas: GeneratedPayrollArea[]) => void;
}

export function ChatCard({ onComplete }: ChatCardProps) {
  const [state, setState] = useState<ChatState>({
    sessionId: null,
    messages: [],
    currentQuestion: null,
    answers: {},
    isComplete: false,
    isLoading: false,
    progress: 0,
    error: null,
  });
  const [hydrated, setHydrated] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get user for scoped persistence
  const { user } = useAuthStore();
  const userKey = user?.userId ? String(user.userId) : 'anonymous';

  // Load saved draft on mount
  useEffect(() => {
    const draft = loadPayrollDraft(userKey);
    if (draft && draft.sessionId) {
      setState(prev => ({
        ...prev,
        sessionId: draft.sessionId,
        messages: draft.messages,
        answers: draft.answers,
        isComplete: draft.isComplete,
        progress: draft.progress,
        // If complete, no current question; otherwise last message might have one
        currentQuestion: draft.isComplete ? null : (draft.messages[draft.messages.length - 1]?.question || null),
      }));
    }
    setHydrated(true);
  }, [userKey]);

  // Save draft whenever state changes (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    if (!state.sessionId) return; // Don't save empty state

    const draft: PayrollDraft = {
      sessionId: state.sessionId,
      messages: state.messages,
      answers: state.answers,
      isComplete: state.isComplete,
      progress: state.progress,
    };
    savePayrollDraft(userKey, draft);

    // Also save sessionId separately for quick lookup
    if (state.sessionId) {
      savePayrollSessionId(userKey, state.sessionId);
    }
  }, [hydrated, userKey, state.sessionId, state.messages, state.answers, state.isComplete, state.progress]);

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // Reset/restart function
  const handleReset = () => {
    // Clear localStorage session data
    clearPayrollSession(userKey);

    // Clear Zustand store payroll areas so sidebar shows "not started"
    useConfigStore.setState({
      payrollAreas: [],
      validation: {
        isValid: false,
        employeesCovered: 0,
        totalEmployees: 0,
        warnings: [],
        errors: [],
      },
    });

    // Reset local component state
    setState({
      sessionId: null,
      messages: [],
      currentQuestion: null,
      answers: {},
      isComplete: false,
      isLoading: false,
      progress: 0,
      error: null,
    });
  };

  /**
   * Start a new configuration session
   */
  const handleStart = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await startSession();

      const questionMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        type: 'system',
        content: response.question.text,
        question: response.question,
        timestamp: new Date(),
      };

      setState(prev => ({
        ...prev,
        sessionId: response.sessionId,
        messages: [questionMessage],
        currentQuestion: response.question,
        isLoading: false,
        progress: 5,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to start session',
      }));
    }
  };

  /**
   * Handle user selecting an answer
   */
  const handleSelectOption = async (questionId: string, answer: string | string[]) => {
    if (!state.sessionId) return;

    const displayText = getAnswerDisplayText(state.currentQuestion, answer);

    const answerMessage: ChatMessage = {
      id: `msg-${Date.now()}-answer`,
      type: 'user',
      content: displayText,
      selectedOptions: Array.isArray(answer) ? answer : [answer],
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, answerMessage],
      answers: { ...prev.answers, [questionId]: answer },
      isLoading: true,
      currentQuestion: null,
    }));

    try {
      const response = await submitAnswer({
        sessionId: state.sessionId,
        questionId,
        answer,
      });

      if (response.done) {
        const resultMessage: ChatMessage = {
          id: `msg-${Date.now()}-result`,
          type: 'result',
          content: response.message || `Configuration complete! Generated ${response.payrollAreas?.length || 0} payroll areas.`,
          timestamp: new Date(),
        };

        setState(prev => ({
          ...prev,
          messages: [...prev.messages, resultMessage],
          isComplete: true,
          isLoading: false,
          progress: 100,
        }));

        if (response.payrollAreas) {
          onComplete(response.payrollAreas);
        }
      } else {
        const questionMessage: ChatMessage = {
          id: `msg-${Date.now()}-question`,
          type: 'system',
          content: response.question!.text,
          question: response.question,
          timestamp: new Date(),
        };

        setState(prev => ({
          ...prev,
          messages: [...prev.messages, questionMessage],
          currentQuestion: response.question || null,
          isLoading: false,
          progress: response.progress,
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to submit answer',
      }));
    }
  };

  const getAnswerDisplayText = (question: Question | null, answer: string | string[]): string => {
    if (!question?.options) {
      return Array.isArray(answer) ? answer.join(', ') : answer;
    }

    const answers = Array.isArray(answer) ? answer : [answer];
    const labels = answers.map(a => {
      const option = question.options?.find(o => o.id === a);
      return option?.label || a;
    });

    return labels.join(', ');
  };

  /**
   * Build breadcrumb trail showing configuration context
   */
  const buildBreadcrumb = (question: Question | null, answers: Record<string, string | string[]>): string[] => {
    if (!question) return [];

    const breadcrumbs: string[] = [];

    const parseCalendarKey = (key: string): string => {
      const freqLabels: Record<string, string> = {
        weekly: 'Weekly',
        biweekly: 'Bi-weekly',
        semimonthly: 'Semi-monthly',
        monthly: 'Monthly'
      };

      const patternLabels: Record<string, string> = {
        monsun: 'Mon-Sun',
        sunsat: 'Sun-Sat',
        '1end': '1st-End',
        '11516end': '1st-15th/16th-End'
      };

      const paydayLabels: Record<string, string> = {
        friday: 'Fri',
        thursday: 'Thu',
        wednesday: 'Wed',
        last: 'Last',
        '15': '15th',
        '1': '1st',
        '15last': '15th & Last',
        '1530': '15th & 30th'
      };

      let freq = '';
      let pattern = '';
      let payday = '';

      for (const f of Object.keys(freqLabels)) {
        if (key.startsWith(f + '_')) {
          freq = freqLabels[f];
          const rest = key.slice(f.length + 1);

          for (const p of Object.keys(patternLabels)) {
            if (rest.startsWith(p + '_')) {
              pattern = patternLabels[p];
              payday = rest.slice(p.length + 1);
              payday = paydayLabels[payday] || payday.charAt(0).toUpperCase() + payday.slice(1);
              break;
            }
          }

          if (!pattern) {
            payday = paydayLabels[rest] || rest.charAt(0).toUpperCase() + rest.slice(1);
          }

          break;
        }
      }

      if (pattern) {
        return `${freq} ${pattern} ${payday}`;
      } else {
        return `${freq} ${payday}`;
      }
    };

    const currentFrequencyMatch = question.id.match(/^q1_(weekly|biweekly|semimonthly|monthly)_(pattern|payday)$/);

    if (currentFrequencyMatch) {
      const [, frequency] = currentFrequencyMatch;

      const frequencyLabels: Record<string, string> = {
        weekly: 'Weekly',
        biweekly: 'Bi-weekly',
        semimonthly: 'Semi-monthly',
        monthly: 'Monthly'
      };
      breadcrumbs.push(frequencyLabels[frequency]);

      const patternAnswer = answers[`q1_${frequency}_pattern`];
      if (patternAnswer && typeof patternAnswer === 'string') {
        const patternLabels: Record<string, string> = {
          'mon-sun': 'Mon-Sun',
          'sun-sat': 'Sun-Sat',
          '1-15_16-end': '1st-15th/16th-End'
        };
        breadcrumbs.push(patternLabels[patternAnswer] || patternAnswer);
      }

      const paydayAnswer = answers[`q1_${frequency}_payday`];
      if (paydayAnswer && typeof paydayAnswer === 'string') {
        const paydayLabels: Record<string, string> = {
          'friday': 'Fri',
          'thursday': 'Thu',
          'wednesday': 'Wed',
          'last': 'Last day',
          '15': '15th',
          '1': '1st',
          '15-last': '15th & Last',
          '15-30': '15th & 30th'
        };
        breadcrumbs.push(paydayLabels[paydayAnswer] || paydayAnswer);
      }

      if (question.id.includes('_pattern')) {
        breadcrumbs.push('Pay Period');
      } else if (question.id.includes('_payday')) {
        breadcrumbs.push('Pay Day');
      }
    }
    else if (question.id.startsWith('business_')) {
      const key = question.id.replace(/^business_names_/, '').replace(/^business_/, '');
      const calendarLabel = parseCalendarKey(key);
      breadcrumbs.push(calendarLabel);
      breadcrumbs.push('Business Units');
    }
    else if (question.id.startsWith('geographic_') || question.id.startsWith('regions_')) {
      const key = question.id.replace(/^regions_/, '').replace(/^geographic_/, '');
      const calendarLabel = parseCalendarKey(key);
      breadcrumbs.push(calendarLabel);

      const businessKey = `business_${key}`;
      if (answers[businessKey] === 'yes') {
        breadcrumbs.push('Business Units');
      }

      breadcrumbs.push('Geographic Areas');
    }

    return breadcrumbs;
  };

  // Not started yet - show start button
  if (!state.sessionId && !state.isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <MessageCircle className="h-5 w-5 text-teal-600" />
          <h2 className="text-lg font-semibold">Configuration Assistant</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="rounded-full bg-teal-600/10 p-4 mb-4">
            <Play className="h-8 w-8 text-teal-600" />
          </div>
          <h3 className="text-lg font-medium mb-2">Ready to Configure</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Answer a few questions to generate your optimal payroll area setup based on SAP best practices.
          </p>
          {state.error && (
            <div className="flex items-center gap-2 text-destructive mb-4 p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              {state.error}
            </div>
          )}
          <button
            onClick={handleStart}
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
          >
            <Play className="h-4 w-4" />
            Start Configuration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Configuration Assistant</h2>
          </div>
          <div className="flex items-center gap-2">
            {state.isComplete && (
              <span className="inline-flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </span>
            )}
            {state.sessionId && (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg hover:bg-muted transition-colors"
                title="Start over"
              >
                <RotateCcw className="h-4 w-4" />
                Start Over
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${state.progress}%` }}
          />
        </div>

        {/* Breadcrumb */}
        {!state.isComplete && state.currentQuestion && buildBreadcrumb(state.currentQuestion, state.answers).length > 0 && (
          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
            {buildBreadcrumb(state.currentQuestion, state.answers).map((crumb, index, arr) => (
              <React.Fragment key={index}>
                <span className={cn(
                  index === arr.length - 1 ? 'text-foreground font-medium' : ''
                )}>
                  {crumb}
                </span>
                {index < arr.length - 1 && <span className="text-muted-foreground/50">›</span>}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="p-4 max-h-[500px] overflow-y-auto space-y-4">
        {state.messages.map((message, index) => (
          <ChatBubble
            key={message.id}
            message={message}
            onSelectOption={handleSelectOption}
            isLatest={index === state.messages.length - 1 && !state.isLoading && !state.isComplete}
          />
        ))}

        {/* Loading indicator */}
        {state.isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}

        {/* Error message */}
        {state.error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            <AlertCircle className="h-4 w-4" />
            {state.error}
            <button
              onClick={() => setState(prev => ({ ...prev, error: null }))}
              className="ml-auto text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

/**
 * ChatBubble - Individual message component
 */
interface ChatBubbleProps {
  message: ChatMessage;
  onSelectOption: (questionId: string, answer: string | string[]) => void;
  isLatest: boolean;
}

function ChatBubble({ message, onSelectOption, isLatest }: ChatBubbleProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [textInput, setTextInput] = useState('');

  const handleOptionClick = (optionId: string) => {
    if (!message.question) return;

    if (message.question.type === 'multiple_select') {
      // Toggle selection for multiple select
      setSelectedOptions(prev =>
        prev.includes(optionId)
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      // Single choice - submit immediately
      onSelectOption(message.question.id, optionId);
    }
  };

  const handleSubmit = () => {
    if (!message.question || selectedOptions.length === 0) return;
    onSelectOption(message.question.id, selectedOptions);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.question || !textInput.trim()) return;
    onSelectOption(message.question.id, textInput.trim());
    setTextInput('');
  };

  if (message.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground px-4 py-2 rounded-2xl rounded-br-sm max-w-[80%]">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.type === 'result') {
    return (
      <div className="flex justify-start">
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-2xl rounded-bl-sm max-w-[80%]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // System message with question
  return (
    <div className="flex justify-start">
      <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-sm max-w-[90%] space-y-3">
        <p className="text-foreground">{message.content}</p>

        {/* Text input for type='text' questions */}
        {message.question?.type === 'text' && isLatest && (
          <form onSubmit={handleTextSubmit} className="mt-3">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={message.question.placeholder || "Enter your answer..."}
              className="w-full px-3 py-2 border-2 border-border rounded-lg focus:outline-none focus:border-primary bg-background text-foreground"
              autoFocus
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              className="w-full mt-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit
            </button>
          </form>
        )}

        {/* Options for choice/multiple_select questions */}
        {message.question?.options && isLatest && (
          <div className="space-y-2 mt-3">
            {message.question.options.map(option => (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all",
                  message.question?.type === 'multiple_select' && selectedOptions.includes(option.id)
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-background hover:border-primary/50"
                )}
              >
                <div className="flex items-start gap-3">
                  {message.question?.type === 'multiple_select' && (
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                      selectedOptions.includes(option.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                    )}>
                      {selectedOptions.includes(option.id) && (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-sm">{option.label}</span>
                    {option.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {message.question?.type === 'multiple_select' && selectedOptions.length > 0 && (
              <button
                onClick={handleSubmit}
                className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors mt-2"
              >
                Continue with {selectedOptions.length} selected
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
