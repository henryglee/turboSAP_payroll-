/**
 * ChatInterface - Main chat component for Q&A flow.
 *
 * Manages the conversation state and communicates with the LangGraph backend.
 * When complete, calls onComplete with the generated payroll areas.
 */

import React, { useState, useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { startSession, submitAnswer } from '../../api/langgraph';
import type { ChatMessage, Question, GeneratedPayrollArea, ChatState } from '../../types/chat';
import './chat.css';

interface ChatInterfaceProps {
  /** Called when configuration is complete with generated payroll areas */
  onComplete: (areas: GeneratedPayrollArea[]) => void;
}

export function ChatInterface({ onComplete }: ChatInterfaceProps) {
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  /**
   * Start a new configuration session
   */
  const handleStart = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await startSession();

      // Add the first question as a message
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

    // Get the display text for the answer
    const displayText = getAnswerDisplayText(state.currentQuestion, answer);

    // Add user's answer as a message
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
        // Configuration complete
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

        // Notify parent with generated areas
        if (response.payrollAreas) {
          onComplete(response.payrollAreas);
        }
      } else {
        // More questions to answer
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

  /**
   * Get human-readable display text for an answer
   */
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
   * Build breadcrumb trail showing the complete configuration context
   * Uses all answers collected so far to show the full path
   */
  const buildBreadcrumb = (question: Question | null, answers: Record<string, string | string[]>): string[] => {
    if (!question) return [];

    const breadcrumbs: string[] = [];

    // Helper function to parse calendar key and build readable label
    const parseCalendarKey = (key: string): string => {
      // Key format examples: weekly_monsun_friday, biweekly_sunsat_thursday
      // Need to parse: frequency_pattern_payday

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

      // Try to match frequency
      let freq = '';
      let pattern = '';
      let payday = '';

      for (const f of Object.keys(freqLabels)) {
        if (key.startsWith(f + '_')) {
          freq = freqLabels[f];
          const rest = key.slice(f.length + 1);

          // Try to match pattern and payday from the rest
          for (const p of Object.keys(patternLabels)) {
            if (rest.startsWith(p + '_')) {
              pattern = patternLabels[p];
              payday = rest.slice(p.length + 1);
              payday = paydayLabels[payday] || payday.charAt(0).toUpperCase() + payday.slice(1);
              break;
            }
          }

          // If no pattern match (like monthly), payday is the rest
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

    // Detect which frequency we're currently configuring
    const currentFrequencyMatch = question.id.match(/^q1_(weekly|biweekly|semimonthly|monthly)_(pattern|payday)$/);

    if (currentFrequencyMatch) {
      const [, frequency] = currentFrequencyMatch;

      // Add the specific frequency being configured
      const frequencyLabels: Record<string, string> = {
        weekly: 'Weekly',
        biweekly: 'Bi-weekly',
        semimonthly: 'Semi-monthly',
        monthly: 'Monthly'
      };
      breadcrumbs.push(frequencyLabels[frequency]);

      // If pattern already answered, include it
      const patternAnswer = answers[`q1_${frequency}_pattern`];
      if (patternAnswer && typeof patternAnswer === 'string') {
        const patternLabels: Record<string, string> = {
          'mon-sun': 'Mon-Sun',
          'sun-sat': 'Sun-Sat',
          '1-15_16-end': '1st-15th/16th-End'
        };
        breadcrumbs.push(patternLabels[patternAnswer] || patternAnswer);
      }

      // If payday already answered, include it
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

      // Add current step label
      if (question.id.includes('_pattern')) {
        breadcrumbs.push('› Pay Period');
      } else if (question.id.includes('_payday')) {
        breadcrumbs.push('› Pay Day');
      }
    }
    // Handle dynamic business unit questions: business_{key} or business_names_{key}
    else if (question.id.startsWith('business_')) {
      // Extract calendar key from question ID
      const key = question.id.replace(/^business_names_/, '').replace(/^business_/, '');
      const calendarLabel = parseCalendarKey(key);

      breadcrumbs.push(calendarLabel);
      breadcrumbs.push('Business Units');
    }
    // Handle dynamic geographic questions: geographic_{key} or regions_{key}
    else if (question.id.startsWith('geographic_') || question.id.startsWith('regions_')) {
      // Extract calendar key from question ID
      const key = question.id.replace(/^regions_/, '').replace(/^geographic_/, '');
      const calendarLabel = parseCalendarKey(key);

      breadcrumbs.push(calendarLabel);

      // Check if business units were configured for this calendar
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
      <div className="chat-container">
        <div className="start-container">
          <h3>Payroll Area Configuration</h3>
          <p>Answer a few questions to generate your optimal payroll area setup.</p>
          {state.error && <div className="error-message">{state.error}</div>}
          <button className="start-button" onClick={handleStart}>
            Start Configuration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* Header with progress */}
      <div className="chat-header">
        <div style={{ marginBottom: '1rem' }}>
          <h2 className="section-title">Chat Configuration</h2>
          <p style={{ marginTop: '0.5rem', color: '#718096', fontSize: '0.9375rem', lineHeight: '1.6' }}>
            {state.isComplete ? 'Configuration complete! Review the generated payroll areas.' : 'Answer questions to generate your optimal payroll area setup.'}
          </p>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${state.progress}%` }} />
        </div>
        {/* Breadcrumb navigation */}
        {!state.isComplete && state.currentQuestion && buildBreadcrumb(state.currentQuestion, state.answers).length > 0 && (
          <div className="breadcrumb-container">
            {buildBreadcrumb(state.currentQuestion, state.answers).map((crumb, index, arr) => (
              <React.Fragment key={index}>
                <span className="breadcrumb-item">{crumb}</span>
                {index < arr.length - 1 && <span className="breadcrumb-separator">›</span>}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="messages-container">
        {state.messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            onSelectOption={handleSelectOption}
            isLatest={index === state.messages.length - 1 && !state.isLoading && !state.isComplete}
          />
        ))}

        {/* Loading indicator */}
        {state.isLoading && (
          <div className="message message-system">
            <div className="loading-indicator">
              <div className="loading-dots">
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
              </div>
              <span>Thinking...</span>
            </div>
          </div>
        )}

        {/* Error message */}
        {state.error && (
          <div className="error-message">
            {state.error}
            <button
              onClick={() => setState(prev => ({ ...prev, error: null }))}
              style={{ marginLeft: '1rem' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
