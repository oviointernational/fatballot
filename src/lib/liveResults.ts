import { supabase } from './supabase';
import { Office, CandidateProfile, OfficeLiveResult } from '../types';
import { mapOfficeRow, mapCandidateRow } from './mappers';

const buildLiveResults = (
  offices: Office[],
  candidates: CandidateProfile[],
  counts: any[],
  totals: any[]
): OfficeLiveResult[] => {
  const totalsByOffice: Record<string, number> = {};
  totals.forEach((t) => { totalsByOffice[t.office_id] = Number(t.total) || 0; });

  const countsByOffice: Record<string, any[]> = {};
  counts.forEach((c) => {
    if (!countsByOffice[c.office_id]) countsByOffice[c.office_id] = [];
    countsByOffice[c.office_id].push(c);
  });

  return offices.map((office) => {
    const officeCands = candidates.filter((c) => c.officeId === office.id);
    const officeCounts = countsByOffice[office.id] || [];
    const totalVotes = totalsByOffice[office.id] || 0;

    const candidata: OfficeLiveResult['candidates'] = officeCands.map((c) => {
      const row = officeCounts.find((r) => r.candidate_id === c.id);
      const forCount = row ? Number(row.votes_for) || 0 : 0;
      const againstCount = row ? Number(row.votes_against) || 0 : 0;
      return {
        candidateId: c.id,
        candidateName: row?.candidate_name || c.name,
        avatar: row?.avatar || c.avatar,
        count: forCount,
        percentage: totalVotes > 0 ? Math.round((forCount / totalVotes) * 1000) / 10 : 0,
        forCount,
        againstCount
      };
    });

    return {
      officeId: office.id,
      officeTitle: office.title,
      totalVotes,
      candidates: candidata,
      isSingleCandidate: officeCands.length === 1
    };
  });
};

/** Load offices + candidates + live counts and compose one results payload. */
export const fetchLiveResults = async (): Promise<OfficeLiveResult[]> => {
  const [offRes, candRes, countsRes, totalsRes] = await Promise.all([
    supabase.from('offices').select('*').order('order'),
    supabase.from('candidates').select('*'),
    supabase.from('vote_counts').select('office_id,candidate_id,candidate_name,avatar,votes_for,votes_against'),
    supabase.from('office_totals').select('office_id,total')
  ]);

  const offices = (offRes.data || []).map(mapOfficeRow);
  const candidates = (candRes.data || []).map(mapCandidateRow);
  return buildLiveResults(offices, candidates, countsRes.data || [], totalsRes.data || []);
};

/** Fetch aggregate election statistics (voter_stats view). */
export const fetchSystemStats = async (): Promise<{
  officesCount: number;
  registeredVotersCount: number;
  accreditedVotersCount: number;
  contestantsCount: number;
  ycecCount: number;
  totalVotesCount: number;
} | null> => {
  const { data } = await supabase.from('voter_stats').select('*').maybeSingle();
  if (!data) return null;
  return {
    officesCount: Number(data.offices_count) || 0,
    registeredVotersCount: Number(data.registered_voters) || 0,
    accreditedVotersCount: Number(data.accredited_voters) || 0,
    contestantsCount: Number(data.contestants_count) || 0,
    ycecCount: Number(data.ycec_count) || 0,
    totalVotesCount: Number(data.votes_count) || 0
  };
};