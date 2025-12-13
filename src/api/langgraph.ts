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
  StartPaymentSessionResponse,
  SubmitPaymentAnswerRequest,
  SubmitPaymentAnswerResponse,
} from '../types/chat';
import { API_BASE_URL } from '../config/api';

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
    await apiFetch<{ status: string }>('/');
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

/**
 * Start a new payment-method configuration session.
 *
 * Calls FastAPI: POST /api/session/payment_method/start
 */
export async function startPaymentSession(): Promise<StartPaymentSessionResponse> {
  return apiFetch<StartPaymentSessionResponse>('/api/session/payment_method/start', {
    method: 'POST',
    body: JSON.stringify({}), 
  });
}

/**
 * Submit an answer for the payment-method flow and get the next question
 * or final payment method configurations.
 *
 * Calls FastAPI: POST /api/session/payment_method/answer
 */
export async function submitPaymentAnswer(
  request: SubmitPaymentAnswerRequest
): Promise<SubmitPaymentAnswerResponse> {
  return apiFetch<SubmitPaymentAnswerResponse>('/api/session/payment_method/answer', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: request.sessionId,
      questionId: request.questionId,
      answer: request.answer,
    }),
  });
}
