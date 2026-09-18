import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface AuthResult {
  success: boolean;
  message: string;
}

export interface RegisterInput {
  ra_number: string;
  email: string;
  full_name: string;
  password: string;
}

interface AuthContextType {
  user: Profile | null;
  isLoading: boolean;
  isRecovery: boolean;
  /** Sign in with the email + password that were used to register. */
  login: (email: string, password: string) => Promise<AuthResult>;
  /** Registers a voter IF their RA number + email match the committee's registration bank. */
  register: (input: RegisterInput) => Promise<AuthResult>;
  /** Supabase password-reset email (works for any registered account). */
  forgotPassword: (email: string) => Promise<AuthResult>;
  /** Set a new password (used after a recovery link, or anytime while signed in). */
  updatePassword: (newPassword: string) => Promise<AuthResult>;
  /** Update own contact details (RA, email, role stay locked by the database). */
  updateProfile: (partial: Partial<Pick<Profile, 'full_name' | 'phone' | 'department' | 'level'>>) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PENDING_KEY = 'fatballot_pending_registration';

function pendingToInput(raw: string | null): { ra_number: string; email: string; full_name: string } | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('profile load error', error.message);
      return null;
    }
    return data as Profile | null;
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const profile = await loadProfile(session.user.id);
      setUser(profile ?? null);
    } else {
      setUser(null);
    }
  }, [loadProfile]);

  /** Finishes a sign-up whose profile insert was deferred (email-confirm link clicked). */
  const completeRegistration = useCallback(async (): Promise<{ error?: string; data?: Profile }> => {
    const pending = pendingToInput(localStorage.getItem(PENDING_KEY));
    const { data: { user } } = await supabase.auth.getUser();
    if (!pending || !user) return {};
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        ra_number: pending.ra_number,
        email: pending.email.toLowerCase(),
        full_name: pending.full_name
      })
      .select('*')
      .single();
    if (error) return { error: error.message };
    localStorage.removeItem(PENDING_KEY);
    setUser(data as Profile);
    return { data: data as Profile };
  }, []);

  const syncFromSession = useCallback(async (session: any) => {
    if (!session?.user) return;
    let profile = await loadProfile(session.user.id);
    if (!profile) {
      const completed = await completeRegistration();
      if (completed.data) return;
      if (completed.error) {
        // Likely a bank mismatch: the account exists but has no voter record.
        // Keep them signed out so the register/login pages can explain it.
        await supabase.auth.signOut();
        setUser(null);
        return;
      }
      // A signed-in auth user with no profile and no pending registration:
      // treat as not a registered voter.
      await supabase.auth.signOut();
      setUser(null);
      return;
    }
    setUser(profile);
  }, [loadProfile, completeRegistration]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) {
        await syncFromSession(session);
        setIsLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        syncFromSession(session);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsRecovery(false);
      } else if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [syncFromSession]);

  const login = async (email: string, password: string): Promise<AuthResult> => {
    if (!email.trim() || !password) {
      return { success: false, message: 'Please enter your email and password.' };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) {
      if (error.message.toLowerCase().includes('invalid login')) {
        return { success: false, message: 'Incorrect email or password.' };
      }
      if (error.message.toLowerCase().includes('email not confirmed')) {
        return { success: false, message: 'Please confirm your email before signing in.' };
      }
      return { success: false, message: error.message };
    }
    // Rely on SIGNED_IN for the profile push, but verify here too,
    // because React state updates are asynchronous.
    await syncFromSession(data.session);
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      const profile = await loadProfile(sessionData.session.user.id);
      if (profile) return { success: true, message: 'Signed in successfully.' };
    }
    return { success: false, message: 'Your account has no voter record yet. Please register with your RA number.' };
  };

  const register = async (input: RegisterInput): Promise<AuthResult> => {
    const ra = input.ra_number.trim();
    const email = input.email.trim().toLowerCase();
    const fullName = input.full_name.trim();
    if (!ra || !email || !fullName || !input.password) {
      return { success: false, message: 'Please complete every field.' };
    }
    if (input.password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }

    const { data, error } = await supabase.auth.signUp({ email, password: input.password });
    if (error) {
      if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already been registered')) {
        return { success: false, message: 'That email is already registered. Please sign in instead.' };
      }
      return { success: false, message: error.message };
    }

    // Stage the profile details so they can be replayed after email confirmation.
    localStorage.setItem(PENDING_KEY, JSON.stringify({ ra_number: ra, email, full_name: fullName }));

    if (data.session?.user) {
      const completed = await completeRegistration();
      if (completed.error) {
        return {
          success: false,
          message: 'Registration was not accepted: ' + completed.error
        };
      }
      return { success: true, message: `Welcome, ${fullName}. You are registered and signed in.` };
    }

    return {
      success: true,
      message: 'Almost there! Please click the confirmation link we just emailed you. Your profile completes automatically after that.'
    };
  };

  const forgotPassword = async (email: string): Promise<AuthResult> => {
    if (!email.trim()) {
      return { success: false, message: 'Please enter the email you registered with.' };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/update-password`
    });
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'If an account exists with that email, a password-reset link is on its way.' };
  };

  const updatePassword = async (newPassword: string): Promise<AuthResult> => {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters.' };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, message: error.message };
    setIsRecovery(false);
    return { success: true, message: 'Password updated successfully.' };
  };

  const updateProfile = async (partial: Partial<Pick<Profile, 'full_name' | 'phone' | 'department' | 'level'>>): Promise<AuthResult> => {
    if (!user) return { success: false, message: 'You need to be signed in.' };
    const { error } = await supabase
      .from('profiles')
      .update({ ...partial, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return { success: false, message: error.message };
    await refreshProfile();
    return { success: true, message: 'Profile updated successfully.' };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsRecovery(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isRecovery,
        login,
        register,
        forgotPassword,
        updatePassword,
        updateProfile,
        logout,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};