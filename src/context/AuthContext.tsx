import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Voter } from '../types';

// Supabase configuration
const supabaseUrl = 'https://hfmteamawqiaqnvpgp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmbXRlYW1hd3FpYXdhcW52cGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NjMyMjcsImV4cCI6MjEwNTAzOTIyN30.FFVyut3QFnFpNIkib53WVcWVOJGxyPJs9sq8esCsDtQ';

import { createClient } from '@supabase/supabase-js';
export const supa = createClient(supabaseUrl, supabaseAnonKey);

interface MagicLinkInfo {
  email: string;
  token: string;
  magicLinkUrl: string;
  voterName: string;
}

interface AuthContextType {
  user: Voter | null;
  sessionToken: string | null;
  isLoading: boolean;
  supersededError: string | null;
  pendingMagicLink: MagicLinkInfo | null;
  requestMagicLink: (raNumber: string) => Promise<{ success: boolean; message: string; info?: MagicLinkInfo }>;
  verifyToken: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearPendingMagicLink: () => void;
  clearSupersededError: () => void;
  quickLogin: (raNumber: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Voter | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem('fatballot_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [supersededError, setSupersededError] = useState<string | null>(null);
  const [pendingMagicLink, setPendingMagicLink] = useState<MagicLinkInfo | null>(null);

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

  // Request a magic link with RA Number
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
        return { success: false, message: data.message || 'Failed to request magic link.' };
      }

      const info: MagicLinkInfo = {
        email: data.email,
        token: data.token,
        magicLinkUrl: data.magicLinkUrl,
        voterName: data.voterName
      };

      setPendingMagicLink(info);
      return { success: true, message: data.message, info };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error occurred.' };
    }
  };

  // Verify magic link token
  const verifyToken = async (token: string) => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/verify-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          deviceInfo: navigator.userAgent
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Token verification failed.');
      }

      setUser(data.voter);
      setSessionToken(data.sessionToken);
      localStorage.setItem('fatballot_token', data.sessionToken);
      setPendingMagicLink(null);
      setSupersededError(null);
      return true;
    } catch (err: any) {
      alert(err.message || 'Failed to authenticate');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Quick direct login for testing various roles
  const quickLogin = async (raNumber: string) => {
    const reqRes = await requestMagicLink(raNumber);
    if (reqRes.success && reqRes.info) {
      return await verifyToken(reqRes.info.token);
    }
    return false;
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
        verifyToken,
        logout,
        clearPendingMagicLink,
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