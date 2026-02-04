/**
 * Authentication Hook
 * Provides auth state and actions
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import type { AuthUser } from '@/types';

// DEV MODE: Test credentials for local development
const DEV_MODE = process.env.NODE_ENV === 'development';
const DEV_USER: AuthUser = {
  id: 'dev-user-001',
  email: 'test@evasion.dev',
  username: 'testdriver',
  displayName: 'Test Driver',
  avatarUrl: null,
  isVerified: true,
};
const DEV_PASSWORD = 'Test1234';

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout: storeLogout } = useAuthStore();
  const supabase = getSupabaseClient();

  // Initialize auth state from Supabase session
  useEffect(() => {
    const initAuth = async () => {
      // Check if already has dev user in store
      if (DEV_MODE && user?.id === 'dev-user-001') {
        setLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Fetch user profile from our database
          const { data: profile } = await supabase
            .from('users')
            .select('id, email, username, display_name, avatar_url, is_verified')
            .eq('id', session.user.id)
            .single();
          
          if (profile) {
            setUser({
              id: profile.id,
              email: profile.email,
              username: profile.username,
              displayName: profile.display_name,
              avatarUrl: profile.avatar_url,
              isVerified: profile.is_verified,
            });
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setUser(null);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Fetch user profile
          const { data: profile } = await supabase
            .from('users')
            .select('id, email, username, display_name, avatar_url, is_verified')
            .eq('id', session.user.id)
            .single();
          
          if (profile) {
            setUser({
              id: profile.id,
              email: profile.email,
              username: profile.username,
              displayName: profile.display_name,
              avatarUrl: profile.avatar_url,
              isVerified: profile.is_verified,
            });
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, setUser, setLoading, user]);

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    
    // DEV MODE: Allow test login
    if (DEV_MODE && email === DEV_USER.email && password === DEV_PASSWORD) {
      console.log('🔧 DEV MODE: Using test account');
      setUser(DEV_USER);
      return { user: DEV_USER, session: null };
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      throw error;
    }

    return data;
  }, [supabase, setLoading, setUser]);

  // Signup function
  const signup = useCallback(async (
    email: string,
    password: string,
    metadata: {
      username: string;
      displayName: string;
      dateOfBirth: string;
    }
  ) => {
    setLoading(true);
    
    // DEV MODE: Simulate signup success
    if (DEV_MODE && !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase')) {
      console.log('🔧 DEV MODE: Simulating signup success');
      setLoading(false);
      return { user: null, session: null };
    }
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) {
      setLoading(false);
      throw error;
    }

    return data;
  }, [supabase, setLoading]);

  // Logout function
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    storeLogout();
    router.push('/login');
  }, [supabase, storeLogout, router]);

  // Password reset
  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      throw error;
    }
  }, [supabase]);

  // Update password
  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw error;
    }
  }, [supabase]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    signup,
    logout,
    resetPassword,
    updatePassword,
  };
}
