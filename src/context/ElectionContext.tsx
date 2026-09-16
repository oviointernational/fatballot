import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Office, CandidateProfile, SiteSettings, CastVote, OfficeLiveResult, SystemStats } from '../types';
import { useAuth } from './AuthContext';

interface ElectionContextType {
  settings: SiteSettings;
  offices: Office[];
  candidates: CandidateProfile[];
  liveResults: OfficeLiveResult[];
  myVotes: CastVote[];
  stats: SystemStats | null;
  isLoading: boolean;
  castVote: (officeId: string, choice: 'candidate' | 'for' | 'against', candidateId?: string) => Promise<{ success: boolean; isChange?: boolean; message?: string }>;
  updateSettings: (newSettings: Partial<SiteSettings>) => Promise<boolean>;
  refreshAll: () => Promise<void>;
  isElectionActive: boolean;
  hasElectionStarted: boolean;
  hasElectionEnded: boolean;
}

const defaultSettings: SiteSettings = {
  siteName: "FatBallot",
  aboutTitle: "Official 2026 Youth & Community Executive Elections",
  aboutContent: "Welcome to FatBallot.",
  aboutImageUrl: "",
  electionStartTime: new Date().toISOString(),
  electionEndTime: new Date(Date.now() + 86400000).toISOString(),
  contestantsCanViewVoters: true,
  publicAuditLog: false
};

const ElectionContext = createContext<ElectionContextType | undefined>(undefined);

export const ElectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { sessionToken, user } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [offices, setOffices] = useState<Office[]>([]);
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [liveResults, setLiveResults] = useState<OfficeLiveResult[]>([]);
  const [myVotes, setMyVotes] = useState<CastVote[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchPublicData = useCallback(async () => {
    try {
      const [setRes, offRes, candRes, statRes, liveRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/offices'),
        fetch('/api/candidates'),
        fetch('/api/stats'),
        fetch('/api/votes/live-results')
      ]);

      if (setRes.ok) setSettings(await setRes.json());
      if (offRes.ok) setOffices(await offRes.json());
      if (candRes.ok) setCandidates(await candRes.json());
      if (statRes.ok) setStats(await statRes.json());
      if (liveRes.ok) setLiveResults(await liveRes.json());
    } catch (err) {
      console.error('Error fetching public election data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMyVotes = useCallback(async () => {
    if (!sessionToken) {
      setMyVotes([]);
      return;
    }
    try {
      const res = await fetch('/api/votes/my-votes', {
        headers: { 'x-session-token': sessionToken }
      });
      if (res.ok) {
        setMyVotes(await res.json());
      }
    } catch (err) {
      console.error('Error fetching user votes:', err);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchPublicData();
  }, [fetchPublicData]);

  useEffect(() => {
    fetchMyVotes();
  }, [fetchMyVotes, user]);

  // Live results polling (works on stateless deployments; replaces WebSockets)
  useEffect(() => {
    let cancelled = false;
    let timer: any = null;

    const refresh = async () => {
      if (cancelled) return;
      try {
        const [res, statsRes] = await Promise.all([
          fetch('/api/votes/live-results'),
          fetch('/api/stats')
        ]);
        if (!cancelled && res.ok) setLiveResults(await res.json());
        if (!cancelled && statsRes.ok) setStats(await statsRes.json());
      } catch (e) {
        console.error('Live results refresh error', e);
      }
      if (!cancelled) timer = setTimeout(refresh, 4000);
    };

    refresh();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Compute election status
  const now = new Date().getTime();
  const startTime = new Date(settings.electionStartTime).getTime();
  const endTime = new Date(settings.electionEndTime).getTime();
  const hasElectionStarted = now >= startTime;
  const hasElectionEnded = now > endTime;
  const isElectionActive = hasElectionStarted && !hasElectionEnded;

  // Cast vote with instant auto-save and state update
  const castVote = async (
    officeId: string,
    choice: 'candidate' | 'for' | 'against',
    candidateId?: string
  ) => {
    if (!sessionToken) {
      return { success: false, message: 'Please log in with your RA Number to cast your vote.' };
    }

    try {
      const res = await fetch('/api/votes/cast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken
        },
        body: JSON.stringify({ officeId, choice, candidateId })
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.message || 'Failed to submit vote.' };
      }

      // Update local myVotes state immediately
      setMyVotes(prev => {
        const filtered = prev.filter(v => v.officeId !== officeId);
        return [...filtered, data.vote];
      });

      return { success: true, isChange: data.isChange };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error occurred.' };
    }
  };

  const updateSettings = async (newSettings: Partial<SiteSettings>) => {
    if (!sessionToken) return false;
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken
        },
        body: JSON.stringify(newSettings)
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update settings:', err);
      return false;
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchPublicData(), fetchMyVotes()]);
  };

  return (
    <ElectionContext.Provider
      value={{
        settings,
        offices,
        candidates,
        liveResults,
        myVotes,
        stats,
        isLoading,
        castVote,
        updateSettings,
        refreshAll,
        isElectionActive,
        hasElectionStarted,
        hasElectionEnded
      }}
    >
      {children}
    </ElectionContext.Provider>
  );
};

export const useElection = () => {
  const context = useContext(ElectionContext);
  if (!context) throw new Error('useElection must be used within ElectionProvider');
  return context;
};
