import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Voter } from '../types';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { firebaseAuth, PASSWORD_RESET_REDIRECT_URL } from '../lib/firebase';

// Supabase is no longer used on the client side; the backend persists via
// server/supabase.ts with environment-configured credentials.
// This export is kept only if downstream code references it.
export const supa = null;

interface AuthResult {
  success: boolean;
  message: string;
}

interface AuthContextType {
  user: Voter | null;
  sessionToken: string | null;
  isLoading: boolean;
  supersededError: string | null;
  setupRequired: boolean;
  refreshSetupStatus: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthResult>;
  activateAccount: (email: string, password: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  setupSuperadmin: (profile: { email: string; password: string; firstName: string; lastName: string }) => Promise<AuthResult>;
  logout: () => Promise<void>;
  clearSupersededError: () => void;
  quickLogin: (raNumber: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function firebaseErrorMessage(err: any, fallback: string): string {
  const code: string = err?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. If you have not activated your account yet, use "Activate your account" below.';
    case 'auth/email-already-in-use':
      return 'This email is already activated. Sign in instead, or reset your password if you forgot it.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled for this Firebase project. Enable it under Authentication -> Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return err?.message || fallback;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Voter | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem('fatballot_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [supersededError, setSupersededError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState<boolean>(false);

  const fetchCurrentUser = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'x-session-token': token }
      });

      if (res.status === 401) {
        const err = await res.json();
        if (err.error === 'SESSION_SUPERSEDED') {
          setSupersededError('You have been logged out because your account was accessed from another device.');
        }
        setUser(null);
        setSessionToken(null);
        localStorage.removeItem('fatballot_token');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
        setSessionToken(null);
        localStorage.removeItem('fatballot_token');
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSetupStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/setup-status');
      if (res.ok) {
        const data = await res.json();
        setSetupRequired(Boolean(data.setupRequired));
      }
    } catch (err) {
      console.error('Error fetching setup status:', err);
    }
  }, []);

  useEffect(() => {
    refreshSetupStatus();
  }, [refreshSetupStatus]);

  useEffect(() => {
    if (sessionToken) {
      fetchCurrentUser(sessionToken);
    } else {
      setIsLoading(false);
    }
  }, [sessionToken, fetchCurrentUser]);

  // Exchange a verified Firebase ID token for an exclusive backend session.
  // The backend denies any email that is not enrolled on the electoral roll.
  const finalizeSession = async (idToken: string, deviceInfo: string) => {
    const res = await fetch('/api/auth/firebase-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, deviceInfo })
    });

    const data = await res.json();
    if (!res.ok) {
      // Roll rejection: drop the Firebase session too so state stays clean.
      await firebaseSignOut(firebaseAuth).catch(() => undefined);
      throw new Error(data.message || 'Login failed.');
    }

    setUser(data.voter);
    setSessionToken(data.sessionToken);
    localStorage.setItem('fatballot_token', data.sessionToken);
    setSupersededError(null);
  };

  // Standard sign-in for activated accounts.
  const login = async (email: string, password: string): Promise<AuthResult> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, message: 'Please enter your email and password.' };
    }
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, password);
      const idToken = await cred.user.getIdToken();
      await finalizeSession(idToken, navigator.userAgent);
      return { success: true, message: 'Signed in successfully.' };
    } catch (err: any) {
      await firebaseSignOut(firebaseAuth).catch(() => undefined);
      return { success: false, message: firebaseErrorMessage(err, 'Sign-in failed.') };
    }
  };

  // First-time activation: the email must already be enrolled on the
  // electoral roll by an administrator — no self-registration.
  const activateAccount = async (email: string, password: string): Promise<AuthResult> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, message: 'Please enter your email and choose a password.' };
    }
    if (password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }
    try {
      const gate = await fetch('/api/auth/request-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const gateData = await gate.json();
      if (!gate.ok) {
        return { success: false, message: gateData.message || 'This email is not on the electoral roll.' };
      }

      const cred = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, password);
      const idToken = await cred.user.getIdToken();
      await finalizeSession(idToken, navigator.userAgent);
      return { success: true, message: `Welcome, ${gateData.voterName}. Your account is activated.` };
    } catch (err: any) {
      await firebaseSignOut(firebaseAuth).catch(() => undefined);
      return { success: false, message: firebaseErrorMessage(err, 'Activation failed.') };
    }
  };

  // Password reset for activated accounts (Firebase dispatches the email).
  const requestPasswordReset = async (email: string): Promise<AuthResult> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Please enter your email address.' };
    }
    try {
      await sendPasswordResetEmail(firebaseAuth, cleanEmail, {
        url: PASSWORD_RESET_REDIRECT_URL()
      });
      return {
        success: true,
        message: 'If this email is activated, a password-reset link is on its way. Check your inbox (and spam).'
      };
    } catch (err: any) {
      return { success: false, message: firebaseErrorMessage(err, 'Could not send reset email.') };
    }
  };

  // First-to-register: claims the Superadmin seat on a fresh system, then
  // creates the Firebase credential and signs in. Single-use by design.
  const setupSuperadmin = async (profile: { email: string; password: string; firstName: string; lastName: string }): Promise<AuthResult> => {
    const cleanEmail = profile.email.trim().toLowerCase();
    if (!cleanEmail || !profile.password || !profile.firstName.trim() || !profile.lastName.trim()) {
      return { success: false, message: 'Please complete all fields.' };
    }
    if (profile.password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }
    try {
      const res = await fetch('/api/auth/setup-superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          firstName: profile.firstName.trim(),
          lastName: profile.lastName.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.message || 'Setup failed.' };
      }

      let cred;
      try {
        cred = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, profile.password);
      } catch (err: any) {
        if (err?.code === 'auth/email-already-in-use') {
          cred = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, profile.password);
        } else {
          throw err;
        }
      }
      const idToken = await cred.user.getIdToken();
      await finalizeSession(idToken, navigator.userAgent);
      await refreshSetupStatus();
      return { success: true, message: 'Superadmin account claimed. You are signed in.' };
    } catch (err: any) {
      await firebaseSignOut(firebaseAuth).catch(() => undefined);
      return { success: false, message: firebaseErrorMessage(err, 'Setup failed.') };
    }
  };

  // Server-side bypass used by dev/test shortcuts in AdminPage.
  // Creates an exclusive backend session directly for an RA number without Firebase.
  // DISABLED in production builds — the server also rejects it there.
  const quickLogin = async (raNumber: string) => {
    if (import.meta.env.PROD) {
      alert('Quick login is disabled in production. Please sign in with your email and password.');
      return false;
    }
    try {
      const cleanRA = raNumber.replace(/^RA-?/i, '').trim();
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raNumber: cleanRA, deviceInfo: navigator.userAgent })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Quick login failed.');
      }

      setUser(data.voter);
      setSessionToken(data.sessionToken);
      localStorage.setItem('fatballot_token', data.sessionToken);
      setSupersededError(null);
      return true;
    } catch (err: any) {
      alert(err.message || 'Quick login failed.');
      return false;
    }
  };

  const logout = async () => {
    if (sessionToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'x-session-token': sessionToken }
        });
      } catch (err) {
        console.error('Logout error', err);
      }
    }
    await firebaseSignOut(firebaseAuth).catch(() => undefined);
    setUser(null);
    setSessionToken(null);
    localStorage.removeItem('fatballot_token');
  };

  const clearSupersededError: () => void = () => setSupersededError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionToken,
        isLoading,
        supersededError,
        setupRequired,
        refreshSetupStatus,
        login,
        activateAccount,
        requestPasswordReset,
        setupSuperadmin,
        logout,
        clearSupersededError,
        quickLogin
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
