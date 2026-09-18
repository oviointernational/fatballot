import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { hasSupabase, getSupabase } from './supabase';
import {
  Office,
  CandidateProfile,
  Voter,
  TimelineItem,
  YCECMember,
  SiteSettings,
  CastVote,
  ScreeningCriteria,
  CandidateScreening,
  ElectionAgent,
  Observer
} from './mockData';

export interface UserSession {
  token: string;
  raNumber: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  deviceInfo?: string;
}

// ---------------------------------------------------------------------------
// Supabase-backed store. Single source of truth is the relational tables
// created by supabase/schema.sql — no JSON blob, no local files. The method
// names and shapes match the previous store so server/app.ts is unaffected
// apart from awaiting (every method that touches the DB is async).
// The server holds the SERVICE_ROLE key only; browsers never touch Supabase.
// ---------------------------------------------------------------------------

type Row = Record<string, any>;

function cleanRA(ra: string): string {
  return String(ra || '').replace(/^RA-?/i, '').trim();
}

function mapVoter(r: Row): Voter {
  return {
    id: r.id,
    raNumber: r.ra_number,
    email: r.email,
    firstName: r.first_name,
    middleName: r.middle_name ?? '',
    lastName: r.last_name,
    role: r.role,
    isAccredited: !!r.is_accredited,
    isScreened: !!r.is_screened,
    assignedOfficeId: r.assigned_office_id ?? undefined,
    isAgent: !!r.is_agent,
    agentOfficeId: r.agent_office_id ?? undefined,
    agentCandidateId: r.agent_candidate_id ?? undefined,
    department: r.department ?? '',
    phone: r.phone ?? '',
    avatar: r.avatar ?? '',
    registeredAt: r.registered_at,
    passwordHash: r.password_hash ?? undefined
  };
}

function mapOffice(r: Row): Office {
  return { id: r.id, title: r.title, order: r.order ?? 0, description: r.description ?? '', icon: r.icon ?? 'Crown' };
}

function mapCandidate(r: Row): CandidateProfile {
  return {
    id: r.id,
    officeId: r.office_id ?? '',
    name: r.name,
    raNumber: r.ra_number,
    avatar: r.avatar ?? '',
    tagline: r.tagline ?? '',
    vision: r.vision ?? '',
    antecedent: r.antecedent ?? [],
    currentOffices: r.current_offices ?? [],
    achievements: r.achievements ?? [],
    contactEmail: r.contact_email ?? ''
  };
}

function mapVote(r: Row): CastVote {
  return {
    id: r.id,
    voterRaNumber: r.voter_ra_number,
    officeId: r.office_id,
    choice: r.choice,
    candidateId: r.candidate_id ?? undefined,
    timestamp: r.timestamp,
    ipAddress: r.ip_address ?? undefined
  };
}

function mapTimeline(r: Row): TimelineItem {
  return { id: r.id, order: r.order ?? 0, title: r.title, description: r.description ?? '', date: r.date, status: r.status, icon: r.icon ?? 'Clock' };
}

function mapYCEC(r: Row): YCECMember {
  return { id: r.id, name: r.name, role: r.role, email: r.email, phone: r.phone ?? '', avatar: r.avatar ?? '', tenure: r.tenure ?? '' };
}

function mapCriteria(r: Row): ScreeningCriteria {
  return { id: r.id, officeId: r.office_id, title: r.title, criteria: r.criteria ?? [] };
}

function mapScreening(r: Row): CandidateScreening {
  return {
    candidateId: r.candidate_id,
    officeId: r.office_id,
    results: r.results ?? [],
    passedCount: r.passed_count ?? 0,
    totalCount: r.total_count ?? 0,
    percentage: r.percentage ?? 0,
    isScreened: !!r.is_screened,
    screenedAt: r.screened_at ?? ''
  };
}

function mapAgent(r: Row): ElectionAgent {
  return {
    id: r.id,
    voterId: r.voter_id,
    voterRaNumber: r.voter_ra_number,
    voterName: r.voter_name,
    officeId: r.office_id,
    candidateId: r.candidate_id,
    candidateName: r.candidate_name,
    assignedAt: r.assigned_at
  };
}

function mapObserver(r: Row): Observer {
  return {
    id: r.id,
    name: r.name,
    rank: r.rank,
    office: r.office ?? '',
    phone: r.phone,
    token: r.token,
    createdAt: r.created_at,
    lastActiveDeviceId: r.last_active_device_id ?? undefined
  };
}

function mapSession(r: Row): UserSession {
  return {
    token: r.token,
    raNumber: r.ra_number,
    userId: r.user_id,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    deviceInfo: r.device_info ?? undefined
  };
}

function dbError(err: any, fallback: string): Error {
  const msg = err?.message || fallback;
  if (err?.code === '23505') {
    if (msg.includes('voters_ra_number')) return new Error('A voter with this RA Number already exists.');
    if (msg.includes('voters_email')) return new Error('A voter with this email already exists.');
    if (msg.includes('candidates_ra_number')) return new Error('A contestant with this RA Number already exists.');
    if (msg.includes('agents_voter_id')) return new Error('This voter is already assigned as an agent.');
    if (msg.includes('observers_token')) return new Error('Observer token collision, please retry.');
    return new Error('This record already exists.');
  }
  return new Error(msg || fallback);
}

export class Database {
  private supabase: SupabaseClient;

  constructor() {
    if (!hasSupabase()) {
      throw new Error(
        'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
        '(see .env.example), then run supabase/schema.sql on a fresh project.'
      );
    }
    this.supabase = getSupabase();
  }

  // Ensures the placeholder Superadmin exists (fresh DBs) and applies
  // SUPERADMIN_* environment overrides. Called once at boot.
  public async init(): Promise<void> {
    await this.ensureSuperadmin();
  }

  public async ensureSuperadmin(): Promise<boolean> {
    const envRA = cleanRA(process.env.SUPERADMIN_RA || '1001') || '1001';
    const envEmail = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
    const envFirst = (process.env.SUPERADMIN_FIRST_NAME || '').trim();
    const envLast = (process.env.SUPERADMIN_LAST_NAME || '').trim();

    const { data, error } = await this.supabase
      .from('voters')
      .select('*')
      .eq('role', 'superadmin')
      .limit(1)
      .maybeSingle();
    if (error) throw dbError(error, 'Failed to read voters.');

    if (!data) {
      const now = new Date().toISOString();
      const { error: insErr } = await this.supabase.from('voters').insert({
        id: 'vot-superadmin',
        ra_number: envRA,
        email: envEmail || 'superadmin@fatballot.org',
        first_name: envFirst || 'Electoral',
        middle_name: 'Chief',
        last_name: envLast || 'SuperAdmin',
        role: 'superadmin',
        is_accredited: true,
        department: 'Electoral Commission Directorate',
        phone: '',
        avatar: '',
        registered_at: now,
        password_hash: null
      });
      if (insErr) throw dbError(insErr, 'Failed to seed superadmin.');
      return true;
    }

    const updates: Row = {};
    if (!data.is_accredited) updates.is_accredited = true;
    if (envEmail && String(data.email).toLowerCase() !== envEmail) updates.email = envEmail;
    if (envFirst && data.first_name !== envFirst) updates.first_name = envFirst;
    if (envLast && data.last_name !== envLast) updates.last_name = envLast;
    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await this.supabase.from('voters').update(updates).eq('id', data.id);
      if (upErr) throw dbError(upErr, 'Failed to update superadmin.');
      return true;
    }
    return false;
  }

  // --- Settings ---
  public async getSettings(): Promise<SiteSettings> {
    const { data, error } = await this.supabase
      .from('settings')
      .select('data')
      .eq('id', 1)
      .maybeSingle();
    if (error) throw dbError(error, 'Failed to read settings.');
    if (!data?.data) throw new Error('Settings row missing. Run supabase/schema.sql on a fresh database.');
    return data.data as SiteSettings;
  }

  public async updateSettings(newSettings: Partial<SiteSettings>): Promise<SiteSettings> {
    const current = await this.getSettings();
    const merged = { ...current, ...newSettings };
    const { error } = await this.supabase
      .from('settings')
      .update({ data: merged })
      .eq('id', 1);
    if (error) throw dbError(error, 'Failed to update settings.');
    return merged;
  }

  // --- Offices ---
  public async getOffices(): Promise<Office[]> {
    const { data, error } = await this.supabase
      .from('offices')
      .select('*')
      .order('order', { ascending: true });
    if (error) throw dbError(error, 'Failed to read offices.');
    return (data ?? []).map(mapOffice);
  }

  public async getOfficeById(id: string): Promise<Office | undefined> {
    const { data, error } = await this.supabase
      .from('offices')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw dbError(error, 'Failed to read office.');
    return data ? mapOffice(data) : undefined;
  }

  public async addOffice(office: Omit<Office, 'id'>): Promise<Office> {
    const row = {
      id: `off-${Date.now()}`,
      title: office.title,
      order: office.order ?? 0,
      description: office.description ?? '',
      icon: office.icon ?? 'Crown'
    };
    const { error } = await this.supabase.from('offices').insert(row);
    if (error) throw dbError(error, 'Failed to create office.');
    return mapOffice(row);
  }

  public async deleteOffice(id: string): Promise<boolean> {
    const { error, count } = await this.supabase
      .from('offices')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw dbError(error, 'Failed to delete office.');
    return (count ?? 0) > 0;
  }

  // --- Candidates ---
  public async getCandidates(): Promise<CandidateProfile[]> {
    const { data, error } = await this.supabase.from('candidates').select('*');
    if (error) throw dbError(error, 'Failed to read candidates.');
    return (data ?? []).map(mapCandidate);
  }

  public async getCandidatesByOffice(officeId: string): Promise<CandidateProfile[]> {
    const { data, error } = await this.supabase
      .from('candidates')
      .select('*')
      .eq('office_id', officeId);
    if (error) throw dbError(error, 'Failed to read candidates.');
    return (data ?? []).map(mapCandidate);
  }

  public async getCandidateById(id: string): Promise<CandidateProfile | undefined> {
    const { data, error } = await this.supabase
      .from('candidates')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw dbError(error, 'Failed to read candidate.');
    return data ? mapCandidate(data) : undefined;
  }

  public async addCandidate(candidate: Omit<CandidateProfile, 'id'>): Promise<CandidateProfile> {
    const row = {
      id: `cand-${Date.now()}`,
      office_id: candidate.officeId,
      name: candidate.name,
      ra_number: candidate.raNumber,
      avatar: candidate.avatar ?? '',
      tagline: candidate.tagline ?? '',
      vision: candidate.vision ?? '',
      antecedent: candidate.antecedent ?? [],
      current_offices: candidate.currentOffices ?? [],
      achievements: candidate.achievements ?? [],
      contact_email: candidate.contactEmail ?? ''
    };
    const { error } = await this.supabase.from('candidates').insert(row);
    if (error) throw dbError(error, 'Failed to register candidate.');
    return mapCandidate(row);
  }

  // --- Voters ---
  public async getVoters(): Promise<Voter[]> {
    const { data, error } = await this.supabase
      .from('voters')
      .select('*')
      .order('registered_at', { ascending: true });
    if (error) throw dbError(error, 'Failed to read voters.');
    return (data ?? []).map(mapVoter);
  }

  public async getVoterByRA(raNumber: string): Promise<Voter | undefined> {
    const { data, error } = await this.supabase
      .from('voters')
      .select('*')
      .eq('ra_number', cleanRA(raNumber))
      .maybeSingle();
    if (error) throw dbError(error, 'Failed to read voter.');
    return data ? mapVoter(data) : undefined;
  }

  public async getVoterById(id: string): Promise<Voter | undefined> {
    const { data, error } = await this.supabase
      .from('voters')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw dbError(error, 'Failed to read voter.');
    return data ? mapVoter(data) : undefined;
  }

  public async getVoterByEmail(email: string): Promise<Voter | undefined> {
    const { data, error } = await this.supabase
      .from('voters')
      .select('*')
      .ilike('email', String(email).trim())
      .limit(1)
      .maybeSingle();
    if (error) throw dbError(error, 'Failed to read voter.');
    return data ? mapVoter(data) : undefined;
  }

  public async addVoter(payload: {
    email: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    raNumber: string;
    role?: 'voter' | 'contestant' | 'committee' | 'superadmin';
    department?: string;
    phone?: string;
  }): Promise<Voter> {
    const clean = cleanRA(payload.raNumber);
    const existing = await this.getVoterByRA(clean);
    if (existing) {
      throw new Error(`A voter with RA Number ${clean} already exists.`);
    }
    const emailTaken = await this.getVoterByEmail(payload.email);
    if (emailTaken) {
      throw new Error('A voter with this email already exists.');
    }

    // REQUIREMENT: users are not accredited during registration!
    const row = {
      id: `vot-${Date.now()}`,
      ra_number: clean,
      email: String(payload.email).trim().toLowerCase(),
      first_name: String(payload.firstName).trim(),
      middle_name: String(payload.middleName ?? '').trim(),
      last_name: String(payload.lastName).trim(),
      role: payload.role || 'voter',
      is_accredited: false,
      is_screened: false,
      department: payload.department || 'General Constituent',
      phone: payload.phone || '',
      avatar: '',
      registered_at: new Date().toISOString(),
      password_hash: null
    };
    const { error } = await this.supabase.from('voters').insert(row);
    if (error) throw dbError(error, 'Failed to register voter.');
    return mapVoter(row);
  }

  public async updateVoter(id: string, updates: Partial<Voter>): Promise<Voter> {
    const row: Row = {};
    if (updates.email !== undefined) row.email = updates.email;
    if (updates.firstName !== undefined) row.first_name = updates.firstName;
    if (updates.middleName !== undefined) row.middle_name = updates.middleName;
    if (updates.lastName !== undefined) row.last_name = updates.lastName;
    if (updates.role !== undefined) row.role = updates.role;
    if (updates.isAccredited !== undefined) row.is_accredited = updates.isAccredited;
    if (updates.isScreened !== undefined) row.is_screened = updates.isScreened;
    if (updates.assignedOfficeId !== undefined) row.assigned_office_id = updates.assignedOfficeId ?? null;
    if (updates.isAgent !== undefined) row.is_agent = updates.isAgent;
    if (updates.agentOfficeId !== undefined) row.agent_office_id = updates.agentOfficeId ?? null;
    if (updates.agentCandidateId !== undefined) row.agent_candidate_id = updates.agentCandidateId ?? null;
    if (updates.department !== undefined) row.department = updates.department;
    if (updates.phone !== undefined) row.phone = updates.phone;
    if (updates.avatar !== undefined) row.avatar = updates.avatar;
    if (updates.passwordHash !== undefined) row.password_hash = updates.passwordHash ?? null;

    const { data, error } = await this.supabase
      .from('voters')
      .update(row)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw dbError(error, 'Failed to update voter.');
    if (!data) throw new Error('Voter not found');
    return mapVoter(data);
  }

  public async accreditVoter(id: string, isAccredited: boolean): Promise<Voter> {
    return this.updateVoter(id, { isAccredited });
  }

  public async deleteVoter(id: string): Promise<boolean> {
    const { error, count } = await this.supabase
      .from('voters')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw dbError(error, 'Failed to delete voter.');
    return (count ?? 0) > 0;
  }

  // --- Committee Admins ---
  public async getCommitteeAdmins(): Promise<Voter[]> {
    const { data, error } = await this.supabase
      .from('voters')
      .select('*')
      .eq('role', 'committee');
    if (error) throw dbError(error, 'Failed to read committee admins.');
    return (data ?? []).map(mapVoter);
  }

  public async addCommitteeAdmins(voterIds: string[]): Promise<Voter[]> {
    const updated: Voter[] = [];
    for (const vid of voterIds) {
      const voter = await this.getVoterById(vid);
      if (voter && voter.role !== 'superadmin') {
        updated.push(await this.updateVoter(vid, { role: 'committee' }));
      }
    }
    return updated;
  }

  public async removeCommitteeAdmin(voterId: string): Promise<Voter> {
    const voter = await this.getVoterById(voterId);
    if (!voter) throw new Error('Voter not found');
    const settings = await this.getSettings();
    if (settings.permissions) {
      const p = settings.permissions;
      const drop = (list: string[]) => list.filter(id => id !== voter.id && id !== voter.raNumber);
      p.canRegisterUsers = drop(p.canRegisterUsers);
      p.canAccreditUsers = drop(p.canAccreditUsers);
      p.canCreateOffices = drop(p.canCreateOffices);
      p.canAssignOffices = drop(p.canAssignOffices);
      p.canCreateScreeningCriteria = drop(p.canCreateScreeningCriteria);
      p.canAssignAgents = drop(p.canAssignAgents);
      p.canCreateObservers = drop(p.canCreateObservers);
      await this.updateSettings({ permissions: p });
    }
    return this.updateVoter(voterId, { role: 'voter' });
  }

  // --- Assign Offices (one office per voter; makes them a contestant) ---
  public async assignOffice(voterId: string, officeId: string): Promise<{ voter: Voter; candidate: CandidateProfile }> {
    const voter = await this.getVoterById(voterId);
    if (!voter) throw new Error('Voter not found.');

    const office = await this.getOfficeById(officeId);
    if (!office) throw new Error('Office not found.');

    // RULE: A user cannot be assigned more than one office!
    if (voter.assignedOfficeId && voter.assignedOfficeId !== officeId) {
      const currentOffice = await this.getOfficeById(voter.assignedOfficeId);
      throw new Error(`User is already contesting for "${currentOffice?.title || 'another office'}". A user cannot be assigned more than one office.`);
    }

    const updatedVoter = await this.updateVoter(voterId, {
      role: 'contestant',
      assignedOfficeId: officeId,
      isScreened: voter.isScreened || false
    });

    // Reuse the candidate profile for this RA Number if one exists.
    const { data: existing } = await this.supabase
      .from('candidates')
      .select('*')
      .eq('ra_number', voter.raNumber)
      .maybeSingle();

    let candidate: CandidateProfile;
    if (existing) {
      const { data: moved, error } = await this.supabase
        .from('candidates')
        .update({ office_id: officeId })
        .eq('id', existing.id)
        .select()
        .maybeSingle();
      if (error) throw dbError(error, 'Failed to move candidate.');
      candidate = mapCandidate(moved);
    } else {
      candidate = await this.addCandidate({
        officeId,
        name: `${voter.firstName} ${voter.middleName ? voter.middleName + ' ' : ''}${voter.lastName}`,
        raNumber: voter.raNumber,
        avatar: voter.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80`,
        tagline: `Committed to service and leadership in ${office.title}.`,
        vision: `To lead the office of ${office.title} with complete transparency, excellence, and dedication to all constituents.`,
        antecedent: ['Nominated by Electoral Assembly', 'Certified Community Member'],
        currentOffices: [office.title],
        achievements: ['Successfully completed nomination filing'],
        contactEmail: voter.email
      });
    }

    return { voter: updatedVoter, candidate };
  }

  public async unassignOffice(voterId: string): Promise<Voter> {
    const voter = await this.getVoterById(voterId);
    if (!voter) throw new Error('Voter not found.');

    const oldOfficeId = voter.assignedOfficeId;
    const updated = await this.updateVoter(voterId, {
      assignedOfficeId: undefined,
      role: 'voter',
      isScreened: false
    });

    if (oldOfficeId) {
      await this.supabase.from('candidates').delete().eq('ra_number', voter.raNumber);
    }
    return updated;
  }

  // --- Screening Criteria & Screening Evaluation ---
  public async getScreeningCriteria(officeId?: string): Promise<ScreeningCriteria[]> {
    let q = this.supabase.from('screening_criteria').select('*');
    if (officeId) q = q.eq('office_id', officeId);
    const { data, error } = await q;
    if (error) throw dbError(error, 'Failed to read screening criteria.');
    return (data ?? []).map(mapCriteria);
  }

  public async saveScreeningCriteria(officeId: string, title: string, criteria: string[]): Promise<ScreeningCriteria> {
    const { data, error } = await this.supabase
      .from('screening_criteria')
      .upsert(
        { id: `crit-${Date.now()}`, office_id: officeId, title, criteria },
        { onConflict: 'office_id', ignoreDuplicates: false }
      )
      .select();
    if (error) throw dbError(error, 'Failed to save screening criteria.');
    const row = (data ?? [])[0];
    if (!row) throw new Error('Failed to save screening criteria.');
    const list = await this.getScreeningCriteria(officeId);
    return list[0] ?? mapCriteria(row);
  }

  public async deleteScreeningCriteria(id: string): Promise<boolean> {
    const { error, count } = await this.supabase
      .from('screening_criteria')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw dbError(error, 'Failed to delete screening criteria.');
    return (count ?? 0) > 0;
  }

  public async screenCandidate(
    candidateId: string,
    officeId: string,
    results: { criterion: string; passed: boolean }[]
  ): Promise<CandidateScreening> {
    const totalCount = results.length;
    const passedCount = results.filter(r => r.passed).length;
    const percentage = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

    // RULE: >= 50% to be declared screened.
    const isScreened = totalCount > 0 && passedCount >= Math.ceil(totalCount / 2);

    const row = {
      candidate_id: candidateId,
      office_id: officeId,
      results,
      passed_count: passedCount,
      total_count: totalCount,
      percentage,
      is_screened: isScreened,
      screened_at: new Date().toISOString()
    };
    const { error } = await this.supabase
      .from('candidate_screenings')
      .upsert(row, { onConflict: 'candidate_id', ignoreDuplicates: false });
    if (error) throw dbError(error, 'Failed to record screening.');

    const cand = await this.getCandidateById(candidateId);
    if (cand) {
      const voter = await this.getVoterByRA(cand.raNumber);
      if (voter) await this.updateVoter(voter.id, { isScreened });
    }

    return mapScreening(row);
  }

  public async getCandidateScreening(candidateId: string): Promise<CandidateScreening | undefined> {
    const { data, error } = await this.supabase
      .from('candidate_screenings')
      .select('*')
      .eq('candidate_id', candidateId)
      .maybeSingle();
    if (error) throw dbError(error, 'Failed to read screening.');
    return data ? mapScreening(data) : undefined;
  }

  // --- Agents ---
  public async getAgents(): Promise<ElectionAgent[]> {
    const { data, error } = await this.supabase.from('agents').select('*');
    if (error) throw dbError(error, 'Failed to read agents.');
    return (data ?? []).map(mapAgent);
  }

  public async addAgent(voterId: string, officeId: string, candidateId: string): Promise<ElectionAgent> {
    const voter = await this.getVoterById(voterId);
    if (!voter) throw new Error('Voter not found.');

    const cand = await this.getCandidateById(candidateId);
    if (!cand) throw new Error('Contestant not found.');

    const office = await this.getOfficeById(officeId);
    if (!office) throw new Error('Office not found.');

    const { data: existing } = await this.supabase
      .from('agents')
      .select('*')
      .eq('voter_id', voterId)
      .maybeSingle();
    if (existing) {
      throw new Error(`This voter is already assigned as an agent for ${existing.candidate_name}.`);
    }

    const row = {
      id: `agent-${Date.now()}`,
      voter_id: voter.id,
      voter_ra_number: voter.raNumber,
      voter_name: `${voter.firstName} ${voter.lastName}`,
      office_id: officeId,
      candidate_id: cand.id,
      candidate_name: cand.name,
      assigned_at: new Date().toISOString()
    };
    const { error } = await this.supabase.from('agents').insert(row);
    if (error) throw dbError(error, 'Failed to assign agent.');

    await this.updateVoter(voter.id, {
      isAgent: true,
      agentOfficeId: officeId,
      agentCandidateId: cand.id
    });
    return mapAgent(row);
  }

  public async deleteAgent(agentId: string): Promise<boolean> {
    const { data: agent } = await this.supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .maybeSingle();
    if (agent) {
      await this.updateVoter(agent.voter_id, {
        isAgent: false,
        agentOfficeId: undefined,
        agentCandidateId: undefined
      }).catch(() => undefined);
      const { error } = await this.supabase.from('agents').delete().eq('id', agentId);
      if (error) throw dbError(error, 'Failed to remove agent.');
      return true;
    }
    return false;
  }

  // --- Observers (unique links, read-only, single-device enforced) ---
  public async getObservers(): Promise<Observer[]> {
    const { data, error } = await this.supabase.from('observers').select('*');
    if (error) throw dbError(error, 'Failed to read observers.');
    return (data ?? []).map(mapObserver);
  }

  public async addObserver(name: string, rank: string, office: string, phone: string): Promise<Observer> {
    const row = {
      id: `obs-${Date.now()}`,
      name: name.trim(),
      rank: rank.trim(),
      office: office?.trim() || '',
      phone: phone.trim(),
      token: `obs_${crypto.randomBytes(16).toString('hex')}`,
      created_at: new Date().toISOString(),
      last_active_device_id: null
    };
    const { error } = await this.supabase.from('observers').insert(row);
    if (error) throw dbError(error, 'Failed to create observer.');
    return mapObserver(row);
  }

  public async regenerateObserverToken(observerId: string): Promise<Observer> {
    const { data, error } = await this.supabase
      .from('observers')
      .update({
        token: `obs_${crypto.randomBytes(16).toString('hex')}`,
        last_active_device_id: null
      })
      .eq('id', observerId)
      .select()
      .maybeSingle();
    if (error) throw dbError(error, 'Failed to regenerate link.');
    if (!data) throw new Error('Observer not found.');
    return mapObserver(data);
  }

  public async deleteObserver(observerId: string): Promise<boolean> {
    const { error, count } = await this.supabase
      .from('observers')
      .delete({ count: 'exact' })
      .eq('id', observerId);
    if (error) throw dbError(error, 'Failed to delete observer.');
    return (count ?? 0) > 0;
  }

  public async verifyObserverToken(token: string, deviceId?: string): Promise<Observer> {
    const { data, error } = await this.supabase
      .from('observers')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (error) throw dbError(error, 'Failed to verify observer.');
    if (!data) {
      throw new Error('Invalid observer credential link.');
    }

    // SINGLE DEVICE POLICY: transfer / bind to the newest device.
    if (deviceId && data.last_active_device_id !== deviceId) {
      await this.supabase
        .from('observers')
        .update({ last_active_device_id: deviceId })
        .eq('id', data.id);
      data.last_active_device_id = deviceId;
    }
    return mapObserver(data);
  }

  // --- Timeline ---
  public async getTimeline(): Promise<TimelineItem[]> {
    const { data, error } = await this.supabase
      .from('timeline')
      .select('*')
      .order('order', { ascending: true });
    if (error) throw dbError(error, 'Failed to read timeline.');
    return (data ?? []).map(mapTimeline);
  }

  public async addTimelineItem(item: Omit<TimelineItem, 'id'>): Promise<TimelineItem> {
    const row = {
      id: `time-${Date.now()}`,
      order: item.order ?? 99,
      title: item.title,
      description: item.description ?? '',
      date: item.date,
      status: item.status ?? 'upcoming',
      icon: item.icon ?? 'Clock'
    };
    const { error } = await this.supabase.from('timeline').insert(row);
    if (error) throw dbError(error, 'Failed to add timeline item.');
    return mapTimeline(row);
  }

  public async updateTimelineItem(id: string, updates: Partial<TimelineItem>): Promise<TimelineItem | null> {
    const row: Row = {};
    if (updates.order !== undefined) row.order = updates.order;
    if (updates.title !== undefined) row.title = updates.title;
    if (updates.description !== undefined) row.description = updates.description;
    if (updates.date !== undefined) row.date = updates.date;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.icon !== undefined) row.icon = updates.icon;
    const { data, error } = await this.supabase
      .from('timeline')
      .update(row)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw dbError(error, 'Failed to update timeline item.');
    return data ? mapTimeline(data) : null;
  }

  public async deleteTimelineItem(id: string): Promise<boolean> {
    const { error, count } = await this.supabase
      .from('timeline')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw dbError(error, 'Failed to delete timeline item.');
    return (count ?? 0) > 0;
  }

  // --- YCEC ---
  public async getYCEC(): Promise<YCECMember[]> {
    const { data, error } = await this.supabase.from('ycec_members').select('*');
    if (error) throw dbError(error, 'Failed to read YCEC.');
    return (data ?? []).map(mapYCEC);
  }

  // --- Votes ---
  public async getVotes(): Promise<CastVote[]> {
    const { data, error } = await this.supabase.from('votes').select('*');
    if (error) throw dbError(error, 'Failed to read votes.');
    return (data ?? []).map(mapVote);
  }

  public async getVotesByVoter(raNumber: string): Promise<CastVote[]> {
    const { data, error } = await this.supabase
      .from('votes')
      .select('*')
      .eq('voter_ra_number', cleanRA(raNumber));
    if (error) throw dbError(error, 'Failed to read votes.');
    return (data ?? []).map(mapVote);
  }

  public async castVote(
    voterRaNumber: string,
    officeId: string,
    choice: 'candidate' | 'for' | 'against',
    candidateId?: string,
    ipAddress?: string
  ): Promise<{ vote: CastVote; isChange: boolean }> {
    const clean = cleanRA(voterRaNumber);
    const now = new Date().toISOString();

    const { data: existing } = await this.supabase
      .from('votes')
      .select('*')
      .eq('voter_ra_number', clean)
      .eq('office_id', officeId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await this.supabase
        .from('votes')
        .update({ choice, candidate_id: candidateId ?? null, timestamp: now, ip_address: ipAddress ?? null })
        .eq('id', existing.id)
        .select()
        .maybeSingle();
      if (error) throw dbError(error, 'Failed to update vote.');
      return { vote: mapVote(data), isChange: true };
    }

    const row = {
      id: `vote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      voter_ra_number: clean,
      office_id: officeId,
      choice,
      candidate_id: candidateId ?? null,
      timestamp: now,
      ip_address: ipAddress ?? null
    };
    const { error } = await this.supabase.from('votes').insert(row);
    if (error) throw dbError(error, 'Failed to cast vote.');
    return { vote: mapVote(row), isChange: false };
  }

  public async getCandidateVoters(candidateId: string): Promise<{ voter: Voter; timestamp: string }[]> {
    const { data, error } = await this.supabase
      .from('votes')
      .select('*')
      .eq('candidate_id', candidateId)
      .in('choice', ['candidate', 'for']);
    if (error) throw dbError(error, 'Failed to read candidate voters.');
    const result: { voter: Voter; timestamp: string }[] = [];
    for (const v of data ?? []) {
      const voter = await this.getVoterByRA(v.voter_ra_number);
      if (voter) result.push({ voter, timestamp: v.timestamp });
    }
    return result;
  }

  public async getLiveResults() {
    const offices = await this.getOffices();
    const candidates = await this.getCandidates();
    const votes = await this.getVotes();

    return offices.map(off => {
      const officeVotes = votes.filter(v => v.officeId === off.id);
      const totalVotes = officeVotes.length;
      const officeCandidates = candidates.filter(c => c.officeId === off.id);

      const candidateResults = officeCandidates.map(cand => {
        let count = 0;
        let forCount = 0;
        let againstCount = 0;

        if (officeCandidates.length === 1) {
          forCount = officeVotes.filter(v => v.candidateId === cand.id && v.choice === 'for').length;
          againstCount = officeVotes.filter(v => v.candidateId === cand.id && v.choice === 'against').length;
          count = forCount;
        } else {
          count = officeVotes.filter(v => v.candidateId === cand.id && v.choice === 'candidate').length;
        }

        const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

        return {
          candidateId: cand.id,
          candidateName: cand.name,
          avatar: cand.avatar,
          count,
          percentage,
          forCount,
          againstCount
        };
      });

      return {
        officeId: off.id,
        officeTitle: off.title,
        totalVotes,
        candidates: candidateResults,
        isSingleCandidate: officeCandidates.length === 1
      };
    });
  }

  // --- Passwords (RA number + password sign-in, fully self-contained) ---
  public hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$16384$8$1$${salt}$${derived}`;
  }

  public verifyPassword(storedHash: string, password: string): boolean {
    try {
      const parts = storedHash.split('$');
      if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
      const [, n, r, p, salt, expected] = parts;
      const derived = crypto.scryptSync(password, salt, 64, {
        N: parseInt(n, 10),
        r: parseInt(r, 10),
        p: parseInt(p, 10)
      }).toString('hex');
      const a = Buffer.from(derived, 'hex');
      const b = Buffer.from(expected, 'hex');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  public async setVoterPassword(id: string, password: string): Promise<Voter> {
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    return this.updateVoter(id, { passwordHash: this.hashPassword(password) });
  }

  public publicVoter(voter: Voter): Omit<Voter, 'passwordHash'> {
    const { passwordHash: _dropped, ...pub } = voter;
    return pub;
  }

  // --- Single-device-exclusive sessions (7-day lifetime) ---
  public async createExclusiveSession(voter: Voter, deviceInfo?: string): Promise<string> {
    // SINGLE DEVICE ENFORCEMENT: invalidate any existing sessions for this RA.
    await this.supabase.from('sessions').delete().eq('ra_number', voter.raNumber);

    const sessionToken = crypto.randomBytes(40).toString('hex');
    const now = new Date();
    const { error } = await this.supabase.from('sessions').insert({
      token: sessionToken,
      ra_number: voter.raNumber,
      user_id: voter.id,
      device_info: deviceInfo ?? null,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
    if (error) throw dbError(error, 'Failed to create session.');
    return sessionToken;
  }

  public async getSession(sessionToken: string): Promise<UserSession | undefined> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('token', sessionToken)
      .maybeSingle();
    if (error) throw dbError(error, 'Failed to read session.');
    if (!data) return undefined;
    if (new Date(data.expires_at).getTime() < Date.now()) {
      await this.supabase.from('sessions').delete().eq('token', sessionToken);
      return undefined;
    }
    return mapSession(data);
  }

  public async revokeSession(sessionToken: string): Promise<void> {
    await this.supabase.from('sessions').delete().eq('token', sessionToken);
  }
}

export const db = new Database();
