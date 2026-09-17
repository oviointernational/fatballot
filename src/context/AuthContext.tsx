import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Voter } from '../types';

// Supabase is used server-side only (persistence + email OTP delivery).
// The browser never talks to Supabase directly and holds no Supabase keys.
// This export is kept only if downstream code references it.
export const supa = null;

interface AuthResult {
  success: boolean;
  message: string;
  maskedEmail?: string;
  voterName?: string;
  /** DEV-ONLY: returned when no email service is configured locally. */
  devCode?: string;
}

interface AuthContextType {
  user: Voter | null;
  sessionToken: string | null;
  isLoading: boolean;
  supersededError: string | null;
  setupRequired: boolean;
  refreshSetupStatus: () => Promise<void>;
  /** Step 1: enter RA number -> a 6-digit code is emailed to the registered address. */
  requestLoginCode: (raNumber: string) => Promise<AuthResult>;
  /** Step 2: enter the emailed 6-digit code -> signed in (7-day single-device session). */
  verifyLoginCode: (raNumber: string, code: string) => Promise<AuthResult>;
  /** First-to-register: claims the Superadmin seat, then starts the code flow. */
  setupSuperadmin: (profile: { email: string; firstName: string; lastName: string }) => Promise<AuthResult>;
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

  const requestLoginCode = async (raNumber: string): Promise<AuthResult> => {
    const cleanRA = raNumber.replace(/^RA-?/i, '').trim();
    if (!cleanRA) {
      return { success: false, message: 'Please enter your RA Number.' };
    }
    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raNumber: cleanRA, deviceInfo: navigator.userAgent })
      });
      const read = await readApiResponse(res);
      if (!read.data) {
        return { success: false, message: platformErrorMessage(read) };
      }
      if (!read.ok) {
        return { success: false, message: read.data.message || 'Could not send login code.' };
      }
      return {
        success: true,
        message: read.data.message,
        maskedEmail: read.data.maskedEmail,
        voterName: read.data.voterName,
        devCode: read.data.devCode
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error occurred.' };
    }
  };

  const verifyLoginCode = async (raNumber: string, code: string): Promise<AuthResult> => {
    const cleanRA = raNumber.replace(/^RA-?/i, '').trim();
    if (!/^\d{6}$/.test(code.trim())) {
      return { success: false, message: 'Please enter the 6-digit code sent to your email.' };
    }
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raNumber: cleanRA, code: code.trim(), deviceInfo: navigator.userAgent })
      });
      const read = await readApiResponse(res);
      if (!read.data) {
        return { success: false, message: platformErrorMessage(read) };
      }
      if (!read.ok) {
        return { success: false, message: read.data.message || 'Verification failed.' };
      }
      applySession(read.data);
      return { success: true, message: 'Signed in successfully.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error occurred.' };
    }
  };

  // First-to-register: claims the Superadmin seat on a fresh system, then
  // immediately requests the login code for RA-1001. Single-use by design.
  const setupSuperadmin = async (profile: { email: string; firstName: string; lastName: string }): Promise<AuthResult> => {
    const cleanEmail = profile.email.trim().toLowerCase();
    if (!cleanEmail || !profile.firstName.trim() || !profile.lastName.trim()) {
      return { success: false, message: 'Please complete all fields.' };
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
      const read = await readApiResponse(res);
      if (!read.data) {
        return { success: false, message: platformErrorMessage(read) };
      }
      if (!read.ok) {
        return { success: false, message: read.data.message || 'Setup failed.' };
      }
      await refreshSetupStatus();
      const codeRes = await requestLoginCode(read.data.voter.raNumber);
      if (!codeRes.success) {
        return { success: false, message: `Seat claimed for ${cleanEmail}, but the login code could not be sent: ${codeRes.message}` };
      }
      return { ...codeRes, message: `Superadmin seat claimed. ${codeRes.message}` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Setup failed.' };
    }
  };

  // Server-side bypass used by dev/test shortcuts in AdminPage.
  // Creates an exclusive backend session directly for an RA number.
  // DISABLED in production builds — the server also rejects it there.
  const quickLogin = async (raNumber: string) => {
    if (import.meta.env.PROD) {
      alert('Quick login is disabled in production. Please sign in with your RA Number and emailed code.');
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
        requestLoginCode,
        verifyLoginCode,
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
