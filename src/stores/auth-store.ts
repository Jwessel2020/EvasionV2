/**
 * Authentication Store
 * Global state management for auth using Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/types';

interface AuthState {
  // State
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: true,
      
      // Actions
      setUser: (user) => {
        // Set dev cookie for middleware
        if (typeof document !== 'undefined' && user) {
          document.cookie = 'evasion-dev-auth=true; path=/; max-age=86400';
        }
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        });
      },
      
      setLoading: (isLoading) => set({ isLoading }),
      
      logout: () => {
        // Clear dev cookie
        if (typeof document !== 'undefined') {
          document.cookie = 'evasion-dev-auth=; path=/; max-age=0';
        }
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },
    }),
    {
      name: 'evasion-auth',
      partialize: (state) => ({
        // Only persist user data, not loading state
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
