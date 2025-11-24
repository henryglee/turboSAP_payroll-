/**
 * ChatInterface - Main chat component for Q&A flow.
 *
 * Manages the conversation state and communicates with the LangGraph backend.
 * When complete, calls onComplete with the generated payroll areas.
 */

import React, { useState, useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { startSession, submitAnswer } from '../../api/langgraph';
import type { ChatMessage, Question, GeneratedPayrollArea, ChatState, createInitialChatState } from '../../types/chat';
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
        <h2>TurboSAP Configuration</h2>
        <p>{state.isComplete ? 'Complete!' : 'Answer the questions below'}</p>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${state.progress}%` }} />
        </div>
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
