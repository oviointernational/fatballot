import {
  Voter, Office, CandidateProfile, CastVote, TimelineItem, YCECMember,
  ScreeningCriteria, CandidateScreening, ElectionAgent, Observer,
  RegistrationEntry, AuditBlock
} from '../types';

export const mapVoterRow = (row: any): Voter => ({
  id: row.id,
  raNumber: String(row.ra_number),
  email: row.email,
  firstName: row.first_name || '',
  middleName: row.middle_name || '',
  lastName: row.last_name || '',
  name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' '),
  role: row.role,
  isAccredited: row.is_accredited || false,
  isScreened: row.is_screened || false,
  assignedOfficeId: row.assigned_office_id || undefined,
  isAgent: row.is_agent || false,
  agentOfficeId: row.agent_office_id || undefined,
  agentCandidateId: row.agent_candidate_id || undefined,
  department: row.department || '',
  phone: row.phone || '',
  avatar: row.avatar || '',
  registeredAt: row.registered_at
});

export const mapOfficeRow = (row: any): Office => ({
  id: row.id,
  title: row.title,
  order: row.order,
  description: row.description || '',
  icon: row.icon || 'Crown'
});

export const mapCandidateRow = (row: any): CandidateProfile => ({
  id: row.id,
  officeId: row.office_id,
  name: row.name,
  raNumber: String(row.ra_number),
  avatar: row.avatar,
  tagline: row.tagline || '',
  vision: row.vision || '',
  antecedent: row.antecedent || [],
  currentOffices: row.current_offices || [],
  achievements: row.achievements || [],
  contactEmail: row.contact_email || ''
});

export const mapCastVoteRow = (row: any): CastVote => ({
  id: row.id,
  voterRaNumber: String(row.voter_ra_number),
  officeId: row.office_id,
  choice: row.choice,
  candidateId: row.candidate_id || undefined,
  timestamp: row.timestamp
});

export const mapTimelineRow = (row: any): TimelineItem => ({
  id: row.id,
  order: row.order,
  title: row.title,
  description: row.description || '',
  date: row.date,
  status: row.status,
  icon: row.icon || 'Clock'
});

export const mapYCECRow = (row: any): YCECMember => ({
  id: row.id,
  name: row.name,
  role: row.role,
  email: row.email,
  phone: row.phone || '',
  avatar: row.avatar || '',
  tenure: row.tenure || ''
});

export const mapScreeningCriteriaRow = (row: any): ScreeningCriteria => ({
  id: row.id,
  officeId: row.office_id,
  title: row.title,
  criteria: row.criteria || []
});

export const mapCandidateScreeningRow = (row: any): CandidateScreening => ({
  candidateId: row.candidate_id,
  officeId: row.office_id,
  results: row.results || [],
  passedCount: row.passed_count || 0,
  totalCount: row.total_count || 0,
  percentage: row.percentage || 0,
  isScreened: row.is_screened || false,
  screenedAt: row.screened_at || ''
});

export const mapAgentRow = (row: any): ElectionAgent => ({
  id: row.id,
  voterId: row.voter_id,
  voterRaNumber: String(row.voter_ra_number),
  voterName: row.voter_name,
  officeId: row.office_id,
  candidateId: row.candidate_id,
  candidateName: row.candidate_name,
  assignedAt: row.assigned_at
});

export const mapObserverRow = (row: any): Observer => ({
  id: row.id,
  name: row.name,
  rank: row.rank,
  office: row.office || undefined,
  phone: row.phone,
  token: row.token,
  createdAt: row.created_at,
  lastActiveDeviceId: undefined
});

export const mapRegistrationRow = (row: any): RegistrationEntry => ({
  id: row.id,
  raNumber: String(row.ra_number),
  email: row.email,
  fullName: row.full_name || '',
  createdAt: row.created_at
});

export const mapAuditRow = (row: any, index: number): AuditBlock => ({
  index,
  timestamp: row.timestamp,
  eventType: row.event_type,
  actor: row.actor || {},
  details: row.details || {},
  previousHash: row.previous_hash,
  hash: row.hash
});