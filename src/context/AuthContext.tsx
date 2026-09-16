import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Voter } from '../types';
import {
  sendSignInLinkToEmail,
  signInWithEmailLink,
  isSignInWithEmailLink
} from 'firebase/auth';
import { firebaseAuth, EMAIL_LINK_REDIRECT_URL } from '../lib/firebase';

// Supabase is no longer used on the client side; the backend persists via
// server/supabase.ts with environment-configured credentials.
// This export is kept only if downstream code references it.
export const supa = null;

interface MagicLinkInfo {
  email: string;
  voterName: string;
}

interface AuthContextType {
  user: Voter | null;
  sessionToken: string | null;
  isLoading: boolean;
  supersededError: string | null;
  pendingMagicLink: MagicLinkInfo | null;
  requestMagicLink: (raNumber: string) => Promise<{ success: boolean; message: string; info?: MagicLinkInfo }>;
  logout: () => Promise<void>;
  clearPendingMagicLink: () => void;
  clearSupersededError: () => void;
  quickLogin: (raNumber: string) => Promise<boolean>;
  completingFirebaseLink: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const EMAIL_STORAGE_KEY = 'fatballot_email_for_signin';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Voter | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem('fatballot_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [supersededError, setSupersededError] = useState<string | null>(null);
  const [pendingMagicLink, setPendingMagicLink] = useState<MagicLinkInfo | null>(null);
  const [completingFirebaseLink, setCompletingFirebaseLink] = useState<boolean>(false);

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

  useEffect(() => {
    if (sessionToken) {
      fetchCurrentUser(sessionToken);
    } else {
      setIsLoading(false);
    }
  }, [sessionToken, fetchCurrentUser]);

  // Exchange a verified Firebase ID token for an exclusive backend session
  const finalizeSession = async (idToken: string, deviceInfo: string) => {
    const res = await fetch('/api/auth/firebase-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, deviceInfo })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Login failed.');
    }

    setUser(data.voter);
    setSessionToken(data.sessionToken);
    localStorage.setItem('fatballot_token', data.sessionToken);
    setPendingMagicLink(null);
    setSupersededError(null);
  };

  // When the user clicks the Firebase email link, this completes the sign-in
  const completeFirebaseSignIn = useCallback(async (): Promise<boolean> => {
    if (!isSignInWithEmailLink(firebaseAuth, window.location.href)) return false;

    setCompletingFirebaseLink(true);
    setIsLoading(true);
    try {
      const email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
      if (!email) {
        throw new Error('No pending sign-in email found. Please request a new sign-in link and click it again.');
      }

      const userCred = await signInWithEmailLink(firebaseAuth, email, window.location.href);
      const idToken = await userCred.user.getIdToken();

      await finalizeSession(idToken, navigator.userAgent);

      // Clean the URL to remove the oobCode so refresh doesn't re-attempt sign-in
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    } catch (err: any) {
      alert(err.message || 'Failed to complete the sign-in link.');
      return false;
    } finally {
      setCompletingFirebaseLink(false);
      setIsLoading(false);
    }
  }, []);

  // Detect and complete a Firebase email-link sign-in on app load
  useEffect(() => {
    if (isSignInWithEmailLink(firebaseAuth, window.location.href)) {
      completeFirebaseSignIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Request a magic link with an RA Number -> Firebase emails the bound address
  const requestMagicLink = async (raNumber: string) => {
    try {
      const cleanRA = raNumber.replace(/^RA-?/i, '').trim();
      const res = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raNumber: cleanRA })
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.message || 'Failed to request sign-in link.' };
      }

      const email: string = data.email;
      const voterName: string = data.voterName;

      // Firebase dispatches the passwordless sign-in email to the voter's bound address
      await sendSignInLinkToEmail(firebaseAuth, email, {
        url: EMAIL_LINK_REDIRECT_URL(),
        handleCodeInApp: true
      });

      window.localStorage.setItem(EMAIL_STORAGE_KEY, email);

      const info: MagicLinkInfo = { email, voterName };
      setPendingMagicLink(info);
      return { success: true, message: data.message, info };
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/operation-not-allowed') {
        return {
          success: false,
          message: 'Email link (passwordless) sign-in is not enabled for this Firebase project. Enable it under Authentication -> Sign-in method.'
        };
      }
      return { success: false, message: err.message || 'Network error occurred.' };
    }
  };

  // Server-side bypass used by dev/test shortcuts in AdminPage.
  // Creates an exclusive backend session directly for an RA number without Firebase.
  const quickLogin = async (raNumber: string) => {
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
    setUser(null);
    setSessionToken(null);
    localStorage.removeItem('fatballot_token');
  };

  const clearPendingMagicLink: () => void = () => setPendingMagicLink(null);
  const clearSupersededError: () => void = () => setSupersededError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionToken,
        isLoading,
        supersededError,
        pendingMagicLink,
        requestMagicLink,
        logout,
        clearPendingMagicLink,
        clearSupersededError,
        quickLogin,
        completingFirebaseLink
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