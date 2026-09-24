import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Office, CandidateProfile, SiteSettings, CastVote, OfficeLiveResult, SystemStats } from '../types';
import { supabase } from '../lib/supabase';
import { mapCastVoteRow, mapOfficeRow, mapCandidateRow } from '../lib/mappers';
import { fetchLiveResults, fetchSystemStats } from '../lib/liveResults';
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
  noElection: boolean;
}

const defaultSettings: SiteSettings = {
  siteName: "FatBallot",
  aboutTitle: "Official 2026 Youth & Community Executive Elections",
  aboutContent: "Welcome to FatBallot.",
  aboutImageUrl: "",
  electionStartTime: new Date().toISOString(),
  electionEndTime: new Date(Date.now() + 86400000).toISOString(),
  contestantsCanViewVoters: true,
  publicAuditLog: false,
  registrationOpen: true,
  allowUnaccreditedVoting: false
};

const ElectionContext = createContext<ElectionContextType | undefined>(undefined);

const mapSettings = (data: any): SiteSettings => ({
  ...defaultSettings,
  ...data,
  permissions: data?.permissions
});

const mapCastVote = (row: any): CastVote => mapCastVoteRow(row);

export const ElectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, sessionToken } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [offices, setOffices] = useState<Office[]>([]);
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [liveResults, setLiveResults] = useState<OfficeLiveResult[]>([]);
  const [myVotes, setMyVotes] = useState<CastVote[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchPublicData = useCallback(async () => {
    try {
      const [setRes, offRes, candRes] = await Promise.all([
        supabase.from('settings').select('data').eq('id', 1).maybeSingle(),
        supabase.from('offices').select('*').order('order'),
        supabase.from('candidates').select('*').order('order')
      ]);

      if (setRes.data) setSettings(mapSettings(setRes.data.data));
      if (offRes.data) setOffices(offRes.data.map(mapOfficeRow));
      if (candRes.data) setCandidates(candRes.data.map(mapCandidateRow));
      const s = await fetchSystemStats();
      if (s) setStats(s);
    } catch (err) {
      console.error('Error fetching public election data:', err);
    }
  }, []);

  const fetchLive = useCallback(async () => {
    try {
      const results = await fetchLiveResults();
      setLiveResults(results);
    } catch (err) {
      console.error('Live results refresh error', err);
    }
  }, []);

  const fetchMyVotes = useCallback(async () => {
    if (!user?.raNumber) {
      setMyVotes([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('voter_ra_number', parseInt(user.raNumber, 10))
        .order('timestamp');
      if (error) throw error;
      setMyVotes((data || []).map(mapCastVote));
    } catch (err) {
      console.error('Error fetching user votes:', err);
    }
  }, [user?.raNumber]);

  useEffect(() => {
    fetchPublicData();
  }, [fetchPublicData]);

  useEffect(() => {
    if (offices.length) fetchLive();
  }, [offices, fetchLive]);

  useEffect(() => {
    fetchMyVotes();
  }, [fetchMyVotes, user]);

  // Live results polling
  useEffect(() => {
    let cancelled = false;
    let timer: any = null;

    const refresh = async () => {
      if (cancelled) return;
      try {
        await fetchLive();
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
  }, [fetchLive]);

  // Compute election status
  const noElection = settings.electionMode === 'none';
  const now = new Date().getTime();
  const startTime = new Date(settings.electionStartTime).getTime();
  const endTime = new Date(settings.electionEndTime).getTime();
  const hasElectionStarted = !noElection && now >= startTime;
  const hasElectionEnded = !noElection && now > endTime;
  const isElectionActive = !noElection && hasElectionStarted && !hasElectionEnded;

  const auditActor = () => {
    if (!user) return {};
    return {
      id: user.id,
      raNumber: user.raNumber,
      name: user.name,
      email: user.email,
      role: user.role
    };
  };

  // Cast vote with instant auto-save and state update
  const castVote = async (
    officeId: string,
    choice: 'candidate' | 'for' | 'against',
    candidateId?: string
  ): Promise<{ success: boolean; isChange?: boolean; message?: string }> => {
    if (!user) {
      return { success: false, message: 'Please log in with your RA Number to cast your vote.' };
    }

    const previous = myVotes.find((v) => v.officeId === officeId);
    const isChange = !!previous;

    try {
      let choiceValue = choice;
      let candidateValue = candidateId || null;
      // Referendum-style races use choice 'for'/'against' kept verbatim.
      const { error } = await supabase
        .from('votes')
        .upsert(
          {
            voter_ra_number: parseInt(user.raNumber, 10),
            office_id: officeId,
            choice: choiceValue,
            candidate_id: candidateValue,
            timestamp: new Date().toISOString()
          },
          { onConflict: 'voter_ra_number,office_id' }
        );

      if (error) {
        const msg = error.message || '';
        if (msg.toLowerCase().includes('accredit')) {
          return { success: false, message: 'Accreditation required to vote. Please see the electoral committee.' };
        }
        if (msg.toLowerCase().includes('row level security') || msg.toLowerCase().includes('permission')) {
          return { success: false, message: `Your ballot could not be recorded (${msg}).` };
        }
        return { success: false, message: 'Failed to submit vote: ' + msg };
      }

      const row = { id: 'local', voter_ra_number: parseInt(user.raNumber, 10), office_id: officeId, choice, candidate_id: candidateValue, timestamp: new Date().toISOString() };
      const mapped = mapCastVote(row);
      setMyVotes((prev) => [...prev.filter((v) => v.officeId !== officeId), mapped]);

      // Record the ballot in the audit ledger (event type VOTE_CAST or VOTE_CHANGED).
      try {
        await supabase.rpc('append_audit', {
          p_event_type: isChange ? 'VOTE_CHANGED' : 'VOTE_CAST',
          p_actor: auditActor(),
          p_details: {
            officeId,
            choice,
            candidateId: candidateValue,
            previousChoice: previous?.choice,
            previousCandidateId: previous?.candidateId
          }
        });
      } catch (e) {
        console.error('Audit append failed', e);
      }

      return { success: true, isChange };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error occurred.' };
    }
  };

  const updateSettings = async (newSettings: Partial<SiteSettings>) => {
    if (!sessionToken) return false;
    try {
      const { data: current } = await supabase.from('settings').select('data').eq('id', 1).maybeSingle();
      const nextData = {
        ...(current?.data || {}),
        ...newSettings
      };
      const { error } = await supabase.from('settings').update({ data: nextData }).eq('id', 1);
      if (error) return false;
      setSettings(mapSettings(nextData));

      try {
        await supabase.rpc('append_audit', {
          p_event_type: 'SETTINGS_UPDATED',
          p_actor: auditActor(),
          p_details: { changes: newSettings }
        });
      } catch (e) {
        console.error('Audit append failed', e);
      }
      return true;
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
        hasElectionEnded,
        noElection
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