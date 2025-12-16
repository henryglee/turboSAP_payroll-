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
  // Note: role is always "client" for new registrations
  // Admin accounts must be created by existing admins
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

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  newPassword: string;
}

/**
 * Change current user's password.
 * Requires authentication token.
 */
export async function changePassword(request: ChangePasswordRequest): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>('/api/auth/change-password', {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

/**
 * Reset a user's password (admin only).
 * Requires authentication token with admin role.
 */
export async function resetUserPassword(userId: number, request: ResetPasswordRequest): Promise<{ status: string; userId: number; message: string }> {
  return apiFetch<{ status: string; userId: number; message: string }>(`/api/admin/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

