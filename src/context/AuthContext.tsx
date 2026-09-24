import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { mapVoterRow } from '../lib/mappers';
import { Voter } from '../types';

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
  user: Voter | null;
  /** Supabase access token (kept for interface compatibility). */
  sessionToken: string | null;
  isLoading: boolean;
  isRecovery: boolean;
  supersededError: string | null;
  setupRequired: boolean;
  refreshSetupStatus: () => Promise<void>;
  /** Sign in with an email address (or RA number, which is resolved). */
  login: (identifier: string, password: string) => Promise<AuthResult>;
  /** Register a voter whose RA + email are in the committee's registration bank. */
  register: (input: RegisterInput) => Promise<AuthResult>;
  /** Supabase password-reset email. */
  forgotPassword: (email: string) => Promise<AuthResult>;
  /** Set a new password (recovery link, or anytime while signed in). */
  updatePassword: (newPassword: string) => Promise<AuthResult>;
  /** Change password while signed in (current password is verified first). */
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  /** Update own public contact details. */
  updateProfile: (partial: Partial<Pick<Voter, 'firstName' | 'lastName' | 'middleName' | 'phone' | 'department' | 'avatar'>>) => Promise<AuthResult>;
  setupSuperadmin: (profile: { email: string; firstName: string; lastName: string; password: string }) => Promise<AuthResult>;
  logout: () => Promise<void>;
  clearSupersededError: () => void;
  quickLogin: (raNumber: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PENDING_KEY = 'fatballot_pending_registration';

const loadVoterByAuthId = async (authUid: string): Promise<Voter | null> => {
  const { data, error } = await supabase
    .from('voters')
    .select('*')
    .eq('auth_uid', authUid)
    .maybeSingle();
  if (error || !data || data.is_active === false) return null;
  return mapVoterRow(data);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Voter | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const [supersededError, setSupersededError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState<boolean>(false);

  const refreshSetupStatus = useCallback(async () => {
    setSetupRequired(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const profile = await loadVoterByAuthId(session.user.id);
      setUser(profile);
      setSessionToken(session.access_token);
    } else {
      setUser(null);
      setSessionToken(null);
    }
  }, []);

  /** Appends an audit-ladder event attributed to a voter. */
  const auditSelf = useCallback(async (eventType: string, details: Record<string, unknown> = {}, actorOverride?: Voter): Promise<void> => {
    const actor = actorOverride || user;
    if (!actor) return;
    try {
      await supabase.rpc('append_audit', {
        p_event_type: eventType,
        p_actor: { id: actor.id, raNumber: actor.raNumber, name: actor.name, email: actor.email, role: actor.role },
        p_details: { raNumber: actor.raNumber, ...details }
      });
    } catch (e) {
      console.error(`Audit append failed (${eventType})`, e);
    }
  }, [user]);

  /** Finishes a sign-up whose voter insert was deferred (email-confirm link). */
  const completeRegistration = useCallback(async (): Promise<AuthResult> => {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return { success: false, message: 'No pending registration.' };
    let pending: RegisterInput;
    try { pending = JSON.parse(raw); } catch { return { success: false, message: 'Pending registration is corrupt.' }; }
    const cleanRA = pending.ra_number.replace(/^RA-?/i, '').trim();
    const email = pending.email.trim().toLowerCase();
    const parts = pending.full_name.trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || firstName;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return { success: false, message: 'Not signed in.' };

    const { error } = await supabase.from('voters').insert({
      id: authUser.id,
      auth_uid: authUser.id,
      ra_number: parseInt(cleanRA, 10),
      email,
      first_name: firstName,
      last_name: lastName,
      role: 'voter',
      registered_at: new Date().toISOString()
    });
    if (error) return { success: false, message: 'Registration was not accepted: ' + error.message };
    localStorage.removeItem(PENDING_KEY);
    const profile = await loadVoterByAuthId(authUser.id);
    setUser(profile);
    return { success: true, message: 'Registered successfully.' };
  }, []);

  const syncFromSession = useCallback(async (session: any) => {
    if (!session?.user) return;
    const profile = await loadVoterByAuthId(session.user.id);
    if (!profile) {
      const completed = await completeRegistration();
      if (completed.success) return;
      // A signed-in auth user with no voter record and nothing pending.
      await supabase.auth.signOut();
      setUser(null);
      return;
    }
    setUser(profile);
    setSessionToken(session.access_token);
  }, [completeRegistration]);

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
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        syncFromSession(session);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setSessionToken(null);
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

  const login = async (identifier: string, password: string): Promise<AuthResult> => {
    const clean = identifier.trim();
    if (!clean || !password) {
      return { success: false, message: 'Please enter your email/RA number and password.' };
    }
    try {
      let email = clean;
      if (!clean.includes('@')) {
        const ra = parseInt(clean.replace(/^RA-?/i, ''), 10);
        if (isNaN(ra)) return { success: false, message: 'Enter a valid RA number or email.' };
        const { data: resolved, error: rpcErr } = await supabase.rpc('lookup_email_for_ra', { p_ra_number: ra });
        if (rpcErr || !resolved) return { success: false, message: 'No account matches that RA number.' };
        email = resolved;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('invalid login') || msg.includes('invalid email') || msg.includes('invalid password')) {
          return { success: false, message: 'Incorrect email or password.' };
        }
        if (msg.includes('not confirmed')) {
          return { success: false, message: 'Please confirm your email before signing in.' };
        }
        return { success: false, message: error.message };
      }
      const profile = await loadVoterByAuthId(data.user.id);
      if (!profile) {
        await supabase.auth.signOut();
        return { success: false, message: 'Your account has no voter record yet. Please register with your RA number.' };
      }
      setUser(profile);
      setSessionToken(data.session.access_token);
      await auditSelf('AUTH_LOGIN_SUCCESS', { method: 'password' }, profile);
      return { success: true, message: 'Signed in successfully.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error occurred.' };
    }
  };

  const register = async (input: RegisterInput): Promise<AuthResult> => {
    const cleanRA = input.ra_number.replace(/^RA-?/i, '').trim();
    const email = input.email.trim().toLowerCase();
    const fullName = input.full_name.trim();
    if (!cleanRA || !email || !fullName || !input.password) {
      return { success: false, message: 'Please complete every field.' };
    }
    if (input.password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }

    const { data, error } = await supabase.auth.signUp({ email, password: input.password });
    if (error) {
      if ((error.message || '').toLowerCase().includes('already registered')) {
        return { success: false, message: 'That email is already registered. Please sign in instead.' };
      }
      return { success: false, message: error.message };
    }

    localStorage.setItem(PENDING_KEY, JSON.stringify({ ra_number: cleanRA, email, full_name: fullName, password: input.password }));

    if (data.session?.user) {
      const completed = await completeRegistration();
      if (!completed.success) {
        return { success: false, message: completed.message };
      }
      const profile = await loadVoterByAuthId(data.session.user.id);
      if (profile) setUser(profile);
      return { success: true, message: `Welcome, ${profile?.name || fullName}. You are registered and signed in.` };
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
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'If an account exists with that email, a password-reset link is on its way.' };
  };

  const updatePassword = async (newPassword: string): Promise<AuthResult> => {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters.' };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, message: error.message };
    setIsRecovery(false);
    await auditSelf('PASSWORD_RESET', { method: 'recovery-link' });
    return { success: true, message: 'Password updated successfully.' };
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
    if (!currentPassword || !newPassword) {
      return { success: false, message: 'Please fill in both password fields.' };
    }
    if (newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters.' };
    }
    if (!user?.email) return { success: false, message: 'You need to be signed in.' };
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (verifyError) return { success: false, message: 'Your current password is incorrect.' };
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, message: error.message };
      await auditSelf('PASSWORD_CHANGED');
      return { success: true, message: 'Password changed successfully.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Could not change password.' };
    }
  };

  const updateProfile = async (partial: Partial<Pick<Voter, 'firstName' | 'lastName' | 'middleName' | 'phone' | 'department' | 'avatar'>>): Promise<AuthResult> => {
    if (!user) return { success: false, message: 'You need to be signed in.' };
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return { success: false, message: 'You need to be signed in.' };
    const { error } = await supabase
      .from('voters')
      .update({
        first_name: partial.firstName,
        last_name: partial.lastName,
        middle_name: partial.middleName,
        phone: partial.phone,
        department: partial.department,
        avatar: partial.avatar
      })
      .eq('auth_uid', authUser.id);
    if (error) return { success: false, message: error.message };
    await auditSelf('VOTER_UPDATED', { fields: Object.keys(partial) });
    const profile = await loadVoterByAuthId(authUser.id);
    if (profile) setUser(profile);
    return { success: true, message: 'Profile updated successfully.' };
  };

  const setupSuperadmin = async (): Promise<AuthResult> => {
    return { success: false, message: 'The Superadmin account is already provisioned. Please sign in with the seeded credentials.' };
  };

  const logout = async () => {
    await auditSelf('AUTH_LOGOUT');
    await supabase.auth.signOut();
    setUser(null);
    setSessionToken(null);
    setIsRecovery(false);
  };

  const clearSupersededError: () => void = () => setSupersededError(null);

  const quickLogin = async (raNumber: string): Promise<boolean> => {
    alert('Quick login requires the application server. Please sign in with your email and password instead.');
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionToken,
        isLoading,
        isRecovery,
        supersededError,
        setupRequired,
        refreshSetupStatus,
        login,
        register,
        forgotPassword,
        updatePassword,
        changePassword,
        updateProfile,
        setupSuperadmin,
        logout,
        clearSupersededError,
        quickLogin,
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