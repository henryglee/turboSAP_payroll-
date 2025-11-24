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
} from '../types/chat';

// API base URL - change this for production
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
