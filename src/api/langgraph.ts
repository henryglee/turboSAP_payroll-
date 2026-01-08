/**
 * API layer for LangGraph backend communication.
 *
 * This module handles all HTTP calls to the FastAPI backend.
 * The backend runs at http://localhost:8000 by default.
 */

import { apiFetch } from './utils';
import type {
  StartSessionRequest,
  StartSessionResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from '../types/chat';

/**
 * Start a new configuration session for any module.
 *
 * @param module - Which module to configure ('payroll_area' | 'payment_method'). Defaults to 'payroll_area'.
 * @param request - Optional company name and other data
 * @returns Session ID and first question
 */
export async function startSession(
  module: 'payroll_area' | 'payment_method' = 'payroll_area',
  request: Omit<StartSessionRequest, 'module'> = {}
): Promise<StartSessionResponse> {
  return apiFetch<StartSessionResponse>('/api/start', {
    method: 'POST',
    body: JSON.stringify({
      ...request,
      module,
    }),
  });
}

/**
 * Submit an answer and get the next question or final results.
 *
 * @param request - Session ID, question ID, and answer
 * @returns Next question or generated payroll areas
 */
export async function submitAnswer(
  request: SubmitAnswerRequest
): Promise<SubmitAnswerResponse> {
  return apiFetch<SubmitAnswerResponse>('/api/answer', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: request.sessionId,
      questionId: request.questionId,
      answer: request.answer,
    }),
  });
}

/**
 * Health check - verify backend is running
 */
export async function checkHealth(): Promise<boolean> {
  try {
    await apiFetch<{ status: string }>('/api/health');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current session state (for debugging/recovery)
 */
export async function getSession(sessionId: string): Promise<{
  sessionId: string;
  answers: Record<string, string | string[]>;
  currentQuestionId: string | null;
  done: boolean;
  progress: number;
}> {
  return apiFetch(`/api/session/${sessionId}`);
}

export async function startPaymentSession(): Promise<StartSessionResponse> {
  return apiFetch<StartSessionResponse>('/api/session/payment_method/start', {
    method: 'POST',
    body: JSON.stringify({}), 
  });
}

export async function submitPaymentAnswer(
  request: SubmitAnswerRequest
): Promise<SubmitAnswerResponse> {
  return apiFetch<SubmitAnswerResponse>('/api/session/payment_method/answer', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: request.sessionId,
      questionId: request.questionId,
      answer: request.answer,
    }),
  });
}

// src/api/sessionState.ts
export async function patchSessionState(sessionId: string, patch: Record<string, unknown>) {
  const res = await fetch(`/api/export/sessions/${sessionId}/state`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`patchSessionState failed: ${res.status} ${text}`);
  }

  return res.json();
}

