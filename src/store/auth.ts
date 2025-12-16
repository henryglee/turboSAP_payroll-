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

// Load from localStorage on initialization
const loadAuthFromStorage = (): { token: string | null; user: UserInfo | null } => {
  try {
    const stored = localStorage.getItem('turbosap-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
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
    // Save to localStorage
    localStorage.setItem('turbosap-auth', JSON.stringify({ token, user }));
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
        localStorage.setItem('turbosap-auth', JSON.stringify({ token: state.token, user: updatedUser }));
      }
      return {
        user: updatedUser,
      };
    }),
}));

