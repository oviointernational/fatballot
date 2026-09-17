import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Voter } from '../types';

// Authentication is fully self-contained: RA number + password verified by
// our own server (scrypt hashes). No Firebase, no email codes, no external
// auth service — the browser only ever talks to /api.
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
  /** Sign in with RA number + password (7-day single-device session). */
  login: (raNumber: string, password: string) => Promise<AuthResult>;
  /** Change own password while signed in. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  /** First-to-register: claims the Superadmin seat and signs in. */
  setupSuperadmin: (profile: { email: string; firstName: string; lastName: string; password: string }) => Promise<AuthResult>;
  logout: () => Promise<void>;
  clearSupersededError: () => void;
  quickLogin: (raNumber: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface ApiRead {
  ok: boolean;
  status: number;
  data: any | null;
  raw: string;
}

/**
 * Reads an API response defensively. Hosting platforms sometimes answer with
 * a non-JSON error document (proxy/gateway/function pages); the raw text is
 * preserved so the UI can show exactly what the platform said instead of a
 * bare "Unexpected token ..." syntax error.
 */
async function readApiResponse(res: Response): Promise<ApiRead> {
  let raw = '';
  try {
    raw = await res.text();
  } catch {
    raw = '';
  }
  if (!raw) return { ok: res.ok, status: res.status, data: null, raw: '' };
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(raw), raw };
  } catch {
    return { ok: false, status: res.status, data: null, raw };
  }
}

function platformErrorMessage(read: ApiRead): string {
  const snippet = read.raw.replace(/\s+/g, ' ').trim().slice(0, 180);
  return `The server returned an unexpected response (HTTP ${read.status}${
    snippet ? `: "${snippet}"` : ''
  }). The API may be down or still deploying — please wait a minute and try again. If it persists, open /api/health and send us what it shows.`;
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
      const read = await readApiResponse(res);

      if (res.status === 401) {
        if (read.data?.error === 'SESSION_SUPERSEDED') {
          setSupersededError('You have been logged out because your account was accessed from another device, or your 7-day session expired.');
        }
        setUser(null);
        setSessionToken(null);
        localStorage.removeItem('fatballot_token');
        return;
      }

      if (read.ok && read.data) {
        setUser(read.data);
      } else if (!read.ok && !read.data) {
        console.error('Error fetching current user:', platformErrorMessage(read));
        setIsLoading(false);
        return;
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
        const read = await readApiResponse(res);
        if (read.data) setSetupRequired(Boolean(read.data.setupRequired));
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

  const applySession = (data: any) => {
    setUser(data.voter);
    setSessionToken(data.sessionToken);
    localStorage.setItem('fatballot_token', data.sessionToken);
    setSupersededError(null);
  };

  const login = async (raNumber: string, password: string): Promise<AuthResult> => {
    const cleanRA = raNumber.replace(/^RA-?/i, '').trim();
    if (!cleanRA) {
      return { success: false, message: 'Please enter your RA Number.' };
    }
    if (!password) {
      return { success: false, message: 'Please enter your password.' };
    }
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raNumber: cleanRA, password, deviceInfo: navigator.userAgent })
      });
      const read = await readApiResponse(res);
      if (!read.data) {
        return { success: false, message: platformErrorMessage(read) };
      }
      if (!read.ok) {
        return { success: false, message: read.data.message || 'Sign-in failed.' };
      }
      applySession(read.data);
      return { success: true, message: 'Signed in successfully.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error occurred.' };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
    if (!currentPassword || !newPassword) {
      return { success: false, message: 'Please fill in both password fields.' };
    }
    if (newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters.' };
    }
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken || ''
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const read = await readApiResponse(res);
      if (!read.data) {
        return { success: false, message: platformErrorMessage(read) };
      }
      if (!read.ok) {
        return { success: false, message: read.data.message || 'Could not change password.' };
      }
      return { success: true, message: 'Password changed successfully.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error occurred.' };
    }
  };

  // First-to-register: claims the Superadmin seat on a fresh system and signs
  // straight in with the just-set password. Single-use by design.
  const setupSuperadmin = async (profile: { email: string; firstName: string; lastName: string; password: string }): Promise<AuthResult> => {
    const cleanEmail = profile.email.trim().toLowerCase();
    if (!cleanEmail || !profile.firstName.trim() || !profile.lastName.trim() || !profile.password) {
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
          lastName: profile.lastName.trim(),
          password: profile.password
        })
      });
      const read = await readApiResponse(res);
      if (!read.data) {
        return { success: false, message: platformErrorMessage(read) };
      }
      if (!read.ok) {
        return { success: false, message: read.data.message || 'Setup failed.' };
      }
      applySession(read.data);
      await refreshSetupStatus();
      return { success: true, message: 'Superadmin seat claimed. You are signed in.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Setup failed.' };
    }
  };

  // Server-side bypass used by dev/test shortcuts in AdminPage.
  // Creates an exclusive backend session directly for an RA number.
  // DISABLED in production builds — the server also rejects it there.
  const quickLogin = async (raNumber: string) => {
    if (import.meta.env.PROD) {
      alert('Quick login is disabled in production. Please sign in with your RA Number and password.');
      return false;
    }
    try {
      const cleanRA = raNumber.replace(/^RA-?/i, '').trim();
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raNumber: cleanRA, deviceInfo: navigator.userAgent })
      });

      const read = await readApiResponse(res);
      if (!read.data) {
        throw new Error(platformErrorMessage(read));
      }
      if (!read.ok) {
        throw new Error(read.data.message || 'Quick login failed.');
      }

      setUser(read.data.voter);
      setSessionToken(read.data.sessionToken);
      localStorage.setItem('fatballot_token', read.data.sessionToken);
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
        changePassword,
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
