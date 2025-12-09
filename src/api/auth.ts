/**
 * Authentication API layer for TurboSAP Payroll Configuration.
 *
 * Handles user registration, login, and session management.
 */

import { apiFetch } from './utils';

export interface RegisterRequest {
  username: string;
  password: string;
  companyName?: string;
  role?: 'client' | 'admin';
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  userId: number;
  username: string;
  role: string;
  companyName?: string;
  logoPath?: string;
  token: string;
}

export interface UserInfo {
  userId: number;
  username: string;
  role: string;
  companyName?: string;
  logoPath?: string;
  createdAt?: string;
  lastLogin?: string;
}

/**
 * Register a new user.
 */
export async function register(request: RegisterRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Login and get JWT token.
 */
export async function login(request: LoginRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get current user information.
 * Requires authentication token.
 */
export async function getCurrentUser(token: string): Promise<UserInfo> {
  return apiFetch<UserInfo>('/api/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

