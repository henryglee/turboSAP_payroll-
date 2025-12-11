/**
 * API layer for LangGraph backend communication.
 *
 * This module handles all HTTP calls to the FastAPI backend.
 * The backend runs at http://localhost:8000 by default.
 */

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
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Start a new configuration session.
 *
 * @param request - Optional company name
 * @returns Session ID and first question
 */
export async function startSession(
  request: StartSessionRequest = {}
): Promise<StartSessionResponse> {
  return apiFetch<StartSessionResponse>('/api/start', {
    method: 'POST',
    body: JSON.stringify(request),
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

// ============================================
// Payment Method API Functions
// ============================================

/**
 * Start a new payment method configuration session.
 *
 * @returns Session ID and first question
 */
export async function startPaymentSession(): Promise<StartPaymentSessionResponse> {
  return apiFetch<StartPaymentSessionResponse>('/api/payment/start', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Submit an answer for the payment method flow.
 *
 * @param request - Session ID, question ID, and answer
 * @returns Next question or final payment method configurations
 */
export async function submitPaymentAnswer(
  request: SubmitPaymentAnswerRequest
): Promise<SubmitPaymentAnswerResponse> {
  return apiFetch<SubmitPaymentAnswerResponse>('/api/payment/answer', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: request.sessionId,
      questionId: request.questionId,
      answer: request.answer,
    }),
  });
}
