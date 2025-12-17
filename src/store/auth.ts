/**
 * Authentication store using Zustand.
 *
 * Manages user authentication state and token persistence.
 */

import { create } from 'zustand';
import type { UserInfo } from '../api/auth';

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: UserInfo) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<UserInfo>) => void;
}

// Session timeout duration (10 minutes in milliseconds)
const SESSION_TIMEOUT = 10 * 60 * 1000;

// Load from localStorage on initialization
const loadAuthFromStorage = (): { token: string | null; user: UserInfo | null } => {
  try {
    const stored = localStorage.getItem('turbosap-auth');
    if (stored) {
      const parsed = JSON.parse(stored);

      // Check if session has expired
      if (parsed.loginTime) {
        const now = Date.now();
        const elapsed = now - parsed.loginTime;

        if (elapsed > SESSION_TIMEOUT) {
          // Session expired - clear storage and return null
          localStorage.removeItem('turbosap-auth');
          return { token: null, user: null };
        }
      }

      return {
        token: parsed.token || null,
        user: parsed.user || null,
      };
    }
  } catch {
    // Ignore errors
  }
  return { token: null, user: null };
};

const { token: initialToken, user: initialUser } = loadAuthFromStorage();

export const useAuthStore = create<AuthState>((set) => ({
  token: initialToken,
  user: initialUser,
  isAuthenticated: !!(initialToken && initialUser),

  setAuth: (token, user) => {
    // Save to localStorage with login timestamp
    localStorage.setItem('turbosap-auth', JSON.stringify({
      token,
      user,
      loginTime: Date.now()
    }));
    set({
      token,
      user,
      isAuthenticated: true,
    });
  },

clearAuth: () => {
  // ✅ Clear auth
  localStorage.removeItem('turbosap-auth');

  // ✅ Clear Payment Method local state
  localStorage.removeItem('turbosap.payment_method.draft.v1');
  localStorage.removeItem('turbosap.payment_method.sessionId');

  set({
    token: null,
    user: null,
    isAuthenticated: false,
  });
},


  updateUser: (updates) =>
    set((state) => {
      const updatedUser = state.user ? { ...state.user, ...updates } : null;
      if (updatedUser && state.token) {
        // Preserve loginTime when updating user
        const stored = localStorage.getItem('turbosap-auth');
        const loginTime = stored ? JSON.parse(stored).loginTime : Date.now();
        localStorage.setItem('turbosap-auth', JSON.stringify({
          token: state.token,
          user: updatedUser,
          loginTime
        }));
      }
      return {
        user: updatedUser,
      };
    }),
}));

