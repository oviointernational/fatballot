import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  SiteSettings,
  Office,
  Candidate,
  VoteRow,
  VoteChoice,
  VoteCountRow,
  OfficeTotalRow,
  VoterStats,
  OfficeLiveResult
} from '../types';
import { useAuth } from './AuthContext';

interface CastVoteResult {
  success: boolean;
  message?: string;
}

interface ElectionContextType {
  settings: SiteSettings | null;
  offices: Office[];
  candidates: Candidate[];
  liveResults: OfficeLiveResult[];
  myVotes: VoteRow[];
  stats: VoterStats | null;
  isLoading: boolean;
  isElectionActive: boolean;
  hasElectionStarted: boolean;
  hasElectionEnded: boolean;
  castVote: (officeId: string, choice: VoteChoice, candidateId: string) => Promise<CastVoteResult>;
  updateSettings: (partial: Partial<SiteSettings>) => Promise<boolean>;
  refreshAll: () => Promise<void>;
}

const ElectionContext = createContext<ElectionContextType | undefined>(undefined);

export const ElectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [voteCounts, setVoteCounts] = useState<VoteCountRow[]>([]);
  const [officeTotals, setOfficeTotals] = useState<OfficeTotalRow[]>([]);
  const [myVotes, setMyVotes] = useState<VoteRow[]>([]);
  const [stats, setStats] = useState<VoterStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPublicData = useCallback(async () => {
    const [settingsQ, officesQ, candidatesQ, countsQ, totalsQ, statsQ] = await Promise.all([
      supabase.from('settings').select('*').maybeSingle(),
      supabase.from('offices').select('*').order('sort_order'),
      supabase.from('candidates').select('*'),
      supabase.from('vote_counts').select('*'),
      supabase.from('office_totals').select('*'),
      supabase.from('voter_stats').select('*').single()
    ]);
    if (!settingsQ.error && settingsQ.data) setSettings(settingsQ.data as SiteSettings);
    if (!officesQ.error) setOffices((officesQ.data as Office[]) || []);
    if (!candidatesQ.error) setCandidates((candidatesQ.data as Candidate[]) || []);
    if (!countsQ.error) setVoteCounts((countsQ.data as VoteCountRow[]) || []);
    if (!totalsQ.error) setOfficeTotals((totalsQ.data as OfficeTotalRow[]) || []);
    if (!statsQ.error && statsQ.data) setStats(statsQ.data as VoterStats);
  }, []);

  const loadMyVotes = useCallback(async () => {
    if (!user) {
      setMyVotes([]);
      return;
    }
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('voter_id', user.id);
    if (!error) setMyVotes((data as VoteRow[]) || []);
  }, [user]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadPublicData(), loadMyVotes()]);
  }, [loadPublicData, loadMyVotes]);

  useEffect(() => {
    loadPublicData().finally(() => setIsLoading(false));
  }, [loadPublicData]);

  useEffect(() => {
    loadMyVotes();
  }, [loadMyVotes]);

  // Live results polling (Supabase is stateless on the client; poll the views).
  useEffect(() => {
    let cancelled = false;
    let timer: any = null;

    const refresh = async () => {
      const [countsQ, totalsQ, statsQ] = await Promise.all([
        supabase.from('vote_counts').select('*'),
        supabase.from('office_totals').select('*'),
        supabase.from('voter_stats').select('*').single()
      ]);
      if (cancelled) return;
      if (!countsQ.error) setVoteCounts((countsQ.data as VoteCountRow[]) || []);
      if (!totalsQ.error) setOfficeTotals((totalsQ.data as OfficeTotalRow[]) || []);
      if (!statsQ.error && statsQ.data) setStats(statsQ.data as VoterStats);
      timer = setTimeout(refresh, 4000);
    };

    refresh();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const now = new Date().getTime();
  const startTime = settings?.election_start ? new Date(settings.election_start).getTime() : 0;
  const endTime = settings?.election_end ? new Date(settings.election_end).getTime() : 0;
  const hasElectionStarted = now >= startTime;
  const hasElectionEnded = now > endTime;
  const isElectionActive = hasElectionStarted && !hasElectionEnded;

  const liveResults: OfficeLiveResult[] = offices.map((office) => {
    const rows = voteCounts.filter((v) => v.office_id === office.id);
    const total = officeTotals.find((t) => t.office_id === office.id)?.total ?? 0;
    return {
      officeId: office.id,
      officeTitle: office.title,
      totalVotes: total,
      isSingleCandidate: rows.length === 1,
      candidates: rows.map((r) => ({
        candidateId: r.candidate_id,
        candidateName: r.candidate_name,
        avatar: r.avatar,
        tagline: r.tagline,
        count: r.votes_for + r.votes_against,
        forCount: r.votes_for,
        againstCount: r.votes_against,
        percentage: total > 0 ? Math.round(((r.votes_for + r.votes_against) / total) * 100) : 0
      }))
    };
  });

  const castVote = async (officeId: string, choice: VoteChoice, candidateId: string): Promise<CastVoteResult> => {
    if (!user) return { success: false, message: 'Please sign in to vote.' };
    if (!settings?.voting_open) return { success: false, message: 'Voting is currently closed.' };

    const { error } = await supabase
      .from('votes')
      .upsert(
        {
          voter_id: user.id,
          office_id: officeId,
          candidate_id: candidateId,
          choice
        },
        { onConflict: 'voter_id,office_id' }
      );

    if (error) {
      return { success: false, message: error.message || 'Failed to submit your ballot.' };
    }
    await Promise.all([loadMyVotes(), loadPublicData()]);
    return { success: true };
  };

  const updateSettings = async (partial: Partial<SiteSettings>): Promise<boolean> => {
    const { error } = await supabase
      .from('settings')
      .update({ ...partial, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) {
      console.error('settings update error', error.message);
      return false;
    }
    await loadPublicData();
    return true;
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
        isElectionActive,
        hasElectionStarted,
        hasElectionEnded,
        castVote,
        updateSettings,
        refreshAll
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