export interface Office {
  id: string;
  title: string;
  order: number;
  description: string;
  icon: string; // Lucide icon identifier
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
}

export interface Voter {
  id: string;
  raNumber: string; // e.g. "1001", "2001", "3001"
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  role: 'voter' | 'contestant' | 'committee' | 'superadmin';
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
  // scrypt password hash for RA-number + password sign-in.
  // NEVER sent to clients (stripped at every API boundary).
  passwordHash?: string;
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
  permissions: RolePermissions;
}

export interface CastVote {
  id: string;
  voterRaNumber: string;
  officeId: string;
  choice: 'candidate' | 'for' | 'against';
  candidateId?: string; // empty if against
  timestamp: string;
  ipAddress?: string;
}

