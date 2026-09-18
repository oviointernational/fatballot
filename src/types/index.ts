export type UserRole = 'member' | 'admin' | 'superadmin';
export type ProfileStatus = 'active' | 'suspended';

export interface Profile {
  id: string;
  ra_number: string;
  email: string;
  full_name: string;
  phone: string;
  department: string;
  level: string;
  role: UserRole;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
}

export interface RegistrationEntry {
  id: string;
  ra_number: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface Office {
  id: string;
  title: string;
  description: string;
  icon: string;
  sort_order: number;
  created_at: string;
}

export interface Candidate {
  id: string;
  office_id: string;
  ra_number: string;
  full_name: string;
  avatar: string;
  tagline: string;
  statement: string;
  created_at: string;
}

export type VoteChoice = 'candidate' | 'for' | 'against';

export interface VoteRow {
  id: string;
  voter_id: string;
  office_id: string;
  candidate_id: string;
  choice: VoteChoice;
  created_at: string;
}

export interface SiteSettings {
  id: number;
  site_name: string;
  about_title: string;
  about_content: string;
  about_image_url: string;
  election_start: string;
  election_end: string;
  registration_open: boolean;
  voting_open: boolean;
  updated_at: string;
}

export interface VoteCountRow {
  office_id: string;
  candidate_id: string;
  candidate_name: string;
  avatar: string;
  tagline: string;
  votes_for: number;
  votes_against: number;
}

export interface OfficeTotalRow {
  office_id: string;
  total: number;
}

export interface VoterStats {
  registered_voters: number;
  active_voters: number;
  offices_count: number;
  candidates_count: number;
  votes_count: number;
}

export interface OfficeLiveResult {
  officeId: string;
  officeTitle: string;
  totalVotes: number;
  isSingleCandidate: boolean;
  candidates: {
    candidateId: string;
    candidateName: string;
    avatar: string;
    tagline: string;
    count: number;
    forCount: number;
    againstCount: number;
    percentage: number;
  }[];
}