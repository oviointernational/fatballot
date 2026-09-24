export interface Office {
  id: string;
  title: string;
  order: number;
  description: string;
  icon: string;
}

export interface CandidateProfile {
  id: string;
  officeId: string;
  name: string;
  raNumber: string;
  avatar: string;
  tagline: string;
  vision: string;
  antecedent: string[];
  currentOffices: string[];
  achievements: string[];
  contactEmail: string;
  order: number;
}

export interface Voter {
  id: string;
  raNumber: string;
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  name?: string;
  role: 'voter' | 'contestant' | 'commissioner' | 'superadmin';
  isAccredited: boolean;
  isScreened?: boolean;
  assignedOfficeId?: string;
  isAgent?: boolean;
  agentOfficeId?: string;
  agentCandidateId?: string;
  department?: string;
  phone?: string;
  avatar?: string;
  registeredAt: string;
}

export interface ScreeningCriteria {
  id: string;
  officeId: string;
  title: string;
  criteria: string[];
}

export interface CandidateScreening {
  candidateId: string;
  officeId: string;
  results: { criterion: string; passed: boolean }[];
  passedCount: number;
  totalCount: number;
  percentage: number;
  isScreened: boolean;
  screenedAt: string;
}

export interface ElectionAgent {
  id: string;
  voterId: string;
  voterRaNumber: string;
  voterName: string;
  officeId: string;
  candidateId: string;
  candidateName: string;
  assignedAt: string;
}

export interface Observer {
  id: string;
  name: string;
  rank: string;
  office?: string;
  phone: string;
  token: string;
  createdAt: string;
  lastActiveDeviceId?: string;
}

export interface RolePermissions {
  canRegisterUsers: string[];
  canAccreditUsers: string[];
  canCreateOffices: string[];
  canAssignOffices: string[];
  canCreateScreeningCriteria: string[];
  canAssignAgents: string[];
  canCreateObservers: string[];
}

export interface TimelineItem {
  id: string;
  order: number;
  title: string;
  description: string;
  date: string;
  status: 'completed' | 'active' | 'upcoming';
  icon: string;
}

export interface YCECMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  avatar: string;
  tenure: string;
  order: number;
}

export interface SiteSettings {
  siteName: string;
  aboutTitle: string;
  aboutContent: string;
  aboutImageUrl: string;
  electionStartTime: string;
  electionEndTime: string;
  contestantsCanViewVoters: boolean;
  publicAuditLog: boolean;
  registrationOpen?: boolean;
  /** If true, even non-accredited voters may cast a ballot. */
  allowUnaccreditedVoting?: boolean;
  /** 'none' = no election configured at all (no timer, no results). Omitted = time-driven. */
  electionMode?: 'none';
  permissions?: RolePermissions;
}

export interface RegistrationEntry {
  id: number;
  raNumber: string;
  email: string;
  fullName: string;
  createdAt: string;
}

export interface CastVote {
  id: string;
  voterRaNumber: string;
  officeId: string;
  choice: 'candidate' | 'for' | 'against';
  candidateId?: string;
  timestamp: string;
}

export interface CandidateLiveResult {
  candidateId: string;
  candidateName: string;
  avatar: string;
  count: number;
  percentage: number;
  forCount: number;
  againstCount: number;
}

export interface OfficeLiveResult {
  officeId: string;
  officeTitle: string;
  totalVotes: number;
  candidates: CandidateLiveResult[];
  isSingleCandidate: boolean;
}

export interface AuditBlock {
  index: number;
  timestamp: string;
  eventType: string;
  actor: {
    id?: string;
    raNumber?: string;
    name?: string;
    email?: string;
    role?: string;
  };
  details: Record<string, any>;
  previousHash: string;
  hash: string;
}

export interface SystemStats {
  officesCount: number;
  registeredVotersCount: number;
  accreditedVotersCount: number;
  contestantsCount: number;
  ycecCount: number;
  totalVotesCount: number;
}
