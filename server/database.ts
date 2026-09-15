import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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
  Observer,
  initialSettings,
  initialOffices,
  initialCandidates,
  initialVoters,
  initialTimeline,
  initialYCEC,
  initialVotes,
  initialScreeningCriteria,
  initialAgents,
  initialObservers
} from './mockData';

export interface UserSession {
  token: string;
  raNumber: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  deviceInfo?: string;
}

export interface MagicLinkRequest {
  token: string;
  raNumber: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
}

export interface StoreData {
  settings: SiteSettings;
  offices: Office[];
  candidates: CandidateProfile[];
  voters: Voter[];
  timeline: TimelineItem[];
  ycec: YCECMember[];
  votes: CastVote[];
  sessions: UserSession[];
  magicLinks: MagicLinkRequest[];
  screeningCriteria: ScreeningCriteria[];
  candidateScreenings: CandidateScreening[];
  agents: ElectionAgent[];
  observers: Observer[];
}

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

export class Database {
  private data: StoreData;

  constructor() {
    this.ensureDataDir();
    this.data = this.loadData();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadData(): StoreData {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        
        // Ensure new arrays exist if loading from prior format
        if (!parsed.screeningCriteria) parsed.screeningCriteria = [...initialScreeningCriteria];
        if (!parsed.candidateScreenings) parsed.candidateScreenings = [];
        if (!parsed.agents) parsed.agents = [...initialAgents];
        if (!parsed.observers) parsed.observers = [...initialObservers];
        if (!parsed.settings.permissions) parsed.settings.permissions = { ...initialSettings.permissions };

        return parsed;
      }
    } catch (err) {
      console.error('Error loading store file, falling back to defaults:', err);
    }

    const defaultData: StoreData = {
      settings: { ...initialSettings },
      offices: [...initialOffices],
      candidates: [...initialCandidates],
      voters: [...initialVoters],
      timeline: [...initialTimeline],
      ycec: [...initialYCEC],
      votes: [...initialVotes],
      sessions: [],
      magicLinks: [],
      screeningCriteria: [...initialScreeningCriteria],
      candidateScreenings: [],
      agents: [...initialAgents],
      observers: [...initialObservers]
    };

    this.saveData(defaultData);
    return defaultData;
  }

  private saveData(dataToSave: StoreData = this.data) {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving store to disk:', err);
    }
  }

  // --- Settings ---
  public getSettings(): SiteSettings {
    return this.data.settings;
  }

  public updateSettings(newSettings: Partial<SiteSettings>): SiteSettings {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.saveData();
    return this.data.settings;
  }

  // --- Offices ---
  public getOffices(): Office[] {
    return this.data.offices.sort((a, b) => a.order - b.order);
  }

  public getOfficeById(id: string): Office | undefined {
    return this.data.offices.find(o => o.id === id);
  }

  public addOffice(office: Omit<Office, 'id'>): Office {
    const newOffice: Office = {
      ...office,
      id: `off-${Date.now()}`
    };
    this.data.offices.push(newOffice);
    this.saveData();
    return newOffice;
  }

  public deleteOffice(id: string): boolean {
    const initialLen = this.data.offices.length;
    this.data.offices = this.data.offices.filter(o => o.id !== id);
    if (this.data.offices.length !== initialLen) {
      this.saveData();
      return true;
    }
    return false;
  }

  // --- Candidates ---
  public getCandidates(): CandidateProfile[] {
    return this.data.candidates;
  }

  public getCandidatesByOffice(officeId: string): CandidateProfile[] {
    return this.data.candidates.filter(c => c.officeId === officeId);
  }

  public getCandidateById(id: string): CandidateProfile | undefined {
    return this.data.candidates.find(c => c.id === id);
  }

  public addCandidate(candidate: Omit<CandidateProfile, 'id'>): CandidateProfile {
    const newCand: CandidateProfile = {
      ...candidate,
      id: `cand-${Date.now()}`
    };
    this.data.candidates.push(newCand);
    this.saveData();
    return newCand;
  }

  // --- Voters ---
  public getVoters(): Voter[] {
    return this.data.voters;
  }

  public getVoterByRA(raNumber: string): Voter | undefined {
    const cleanRA = raNumber.replace(/^RA-?/i, '').trim();
    return this.data.voters.find(v => v.raNumber.replace(/^RA-?/i, '').trim() === cleanRA);
  }

  public getVoterById(id: string): Voter | undefined {
    return this.data.voters.find(v => v.id === id);
  }

  public getVoterByEmail(email: string): Voter | undefined {
    const clean = email.trim().toLowerCase();
    return this.data.voters.find(v => v.email.trim().toLowerCase() === clean);
  }

  public addVoter(payload: {
    email: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    raNumber: string;
    role?: 'voter' | 'contestant' | 'committee' | 'superadmin';
    department?: string;
    phone?: string;
  }): Voter {
    const cleanRA = payload.raNumber.replace(/^RA-?/i, '').trim();
    const existing = this.getVoterByRA(cleanRA);
    if (existing) {
      throw new Error(`A voter with RA Number ${cleanRA} already exists.`);
    }

    // REQUIREMENT: users are not accredited during registration!
    const newVoter: Voter = {
      id: `vot-${Date.now()}`,
      raNumber: cleanRA,
      email: payload.email.trim().toLowerCase(),
      firstName: payload.firstName.trim(),
      middleName: payload.middleName?.trim() || '',
      lastName: payload.lastName.trim(),
      role: payload.role || 'voter',
      isAccredited: false, // Default unaccredited on registration!
      isScreened: false,
      department: payload.department || 'General Constituent',
      phone: payload.phone || '',
      registeredAt: new Date().toISOString()
    };

    this.data.voters.push(newVoter);
    this.saveData();
    return newVoter;
  }

  public updateVoter(id: string, updates: Partial<Voter>): Voter {
    const idx = this.data.voters.findIndex(v => v.id === id);
    if (idx === -1) throw new Error('Voter not found');
    this.data.voters[idx] = { ...this.data.voters[idx], ...updates };
    this.saveData();
    return this.data.voters[idx];
  }

  public accreditVoter(id: string, isAccredited: boolean): Voter {
    const voter = this.updateVoter(id, { isAccredited });
    return voter;
  }

  public deleteVoter(id: string): boolean {
    const initialLen = this.data.voters.length;
    this.data.voters = this.data.voters.filter(v => v.id !== id);
    if (this.data.voters.length !== initialLen) {
      this.saveData();
      return true;
    }
    return false;
  }

  // --- Committee Admins ---
  public getCommitteeAdmins(): Voter[] {
    return this.data.voters.filter(v => v.role === 'committee');
  }

  public addCommitteeAdmins(voterIds: string[]): Voter[] {
    const updated: Voter[] = [];
    for (const vid of voterIds) {
      const voter = this.getVoterById(vid);
      if (voter && voter.role !== 'superadmin') {
        voter.role = 'committee';
        updated.push(voter);
      }
    }
    this.saveData();
    return updated;
  }

  public removeCommitteeAdmin(voterId: string): Voter {
    const voter = this.getVoterById(voterId);
    if (!voter) throw new Error('Voter not found');
    voter.role = 'voter';
    if (this.data.settings.permissions) {
      const p = this.data.settings.permissions;
      p.canRegisterUsers = p.canRegisterUsers.filter(id => id !== voter.id && id !== voter.raNumber);
      p.canAccreditUsers = p.canAccreditUsers.filter(id => id !== voter.id && id !== voter.raNumber);
      p.canCreateOffices = p.canCreateOffices.filter(id => id !== voter.id && id !== voter.raNumber);
      p.canAssignOffices = p.canAssignOffices.filter(id => id !== voter.id && id !== voter.raNumber);
      p.canCreateScreeningCriteria = p.canCreateScreeningCriteria.filter(id => id !== voter.id && id !== voter.raNumber);
      p.canAssignAgents = p.canAssignAgents.filter(id => id !== voter.id && id !== voter.raNumber);
      p.canCreateObservers = p.canCreateObservers.filter(id => id !== voter.id && id !== voter.raNumber);
    }
    this.saveData();
    return voter;
  }

  // --- Assign Offices (A user cannot be assigned more than one office; makes them contestant) ---
  public assignOffice(voterId: string, officeId: string): { voter: Voter; candidate: CandidateProfile } {
    const voter = this.getVoterById(voterId);
    if (!voter) throw new Error('Voter not found.');

    const office = this.getOfficeById(officeId);
    if (!office) throw new Error('Office not found.');

    // RULE: A user cannot be assigned more than one office!
    if (voter.assignedOfficeId && voter.assignedOfficeId !== officeId) {
      const currentOffice = this.getOfficeById(voter.assignedOfficeId);
      throw new Error(`User is already contesting for "${currentOffice?.title || 'another office'}". A user cannot be assigned more than one office.`);
    }

    // Update voter status
    voter.role = 'contestant';
    voter.assignedOfficeId = officeId;
    voter.isScreened = voter.isScreened || false;

    // Check if candidate profile exists for this RA Number
    let cand = this.data.candidates.find(c => c.raNumber === voter.raNumber);
    if (cand) {
      cand.officeId = officeId;
    } else {
      cand = {
        id: `cand-${Date.now()}`,
        officeId,
        name: `${voter.firstName} ${voter.middleName ? voter.middleName + ' ' : ''}${voter.lastName}`,
        raNumber: voter.raNumber,
        avatar: voter.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80`,
        tagline: `Committed to service and leadership in ${office.title}.`,
        vision: `To lead the office of ${office.title} with complete transparency, excellence, and dedication to all constituents.`,
        antecedent: ["Nominated by Electoral Assembly", "Certified Community Member"],
        currentOffices: [office.title],
        achievements: ["Successfully completed nomination filing"],
        contactEmail: voter.email
      };
      this.data.candidates.push(cand);
    }

    this.saveData();
    return { voter, candidate: cand };
  }

  public unassignOffice(voterId: string): Voter {
    const voter = this.getVoterById(voterId);
    if (!voter) throw new Error('Voter not found.');

    const oldOfficeId = voter.assignedOfficeId;
    voter.assignedOfficeId = undefined;
    voter.role = 'voter';
    voter.isScreened = false;

    // Remove candidate profile
    if (oldOfficeId) {
      this.data.candidates = this.data.candidates.filter(c => c.raNumber !== voter.raNumber);
    }

    this.saveData();
    return voter;
  }

  // --- Screening Criteria & Screening Evaluation ---
  public getScreeningCriteria(officeId?: string): ScreeningCriteria[] {
    if (officeId) {
      return this.data.screeningCriteria.filter(sc => sc.officeId === officeId);
    }
    return this.data.screeningCriteria;
  }

  public saveScreeningCriteria(officeId: string, title: string, criteria: string[]): ScreeningCriteria {
    const existingIdx = this.data.screeningCriteria.findIndex(sc => sc.officeId === officeId);
    if (existingIdx >= 0) {
      this.data.screeningCriteria[existingIdx].title = title;
      this.data.screeningCriteria[existingIdx].criteria = criteria;
      this.saveData();
      return this.data.screeningCriteria[existingIdx];
    } else {
      const newCrit: ScreeningCriteria = {
        id: `crit-${Date.now()}`,
        officeId,
        title,
        criteria
      };
      this.data.screeningCriteria.push(newCrit);
      this.saveData();
      return newCrit;
    }
  }

  public deleteScreeningCriteria(id: string): boolean {
    const initialLen = this.data.screeningCriteria.length;
    this.data.screeningCriteria = this.data.screeningCriteria.filter(sc => sc.id !== id);
    if (this.data.screeningCriteria.length !== initialLen) {
      this.saveData();
      return true;
    }
    return false;
  }

  public screenCandidate(
    candidateId: string,
    officeId: string,
    results: { criterion: string; passed: boolean }[]
  ): CandidateScreening {
    const totalCount = results.length;
    const passedCount = results.filter(r => r.passed).length;
    const percentage = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
    
    // RULE: Total must be 50% or more. So if 6 criteria, contestant must get 3 or more to be declared screened.
    const isScreened = totalCount > 0 && passedCount >= Math.ceil(totalCount / 2);

    const screeningRecord: CandidateScreening = {
      candidateId,
      officeId,
      results,
      passedCount,
      totalCount,
      percentage,
      isScreened,
      screenedAt: new Date().toISOString()
    };

    const existingIdx = this.data.candidateScreenings.findIndex(cs => cs.candidateId === candidateId);
    if (existingIdx >= 0) {
      this.data.candidateScreenings[existingIdx] = screeningRecord;
    } else {
      this.data.candidateScreenings.push(screeningRecord);
    }

    // Update matching voter isScreened status
    const cand = this.getCandidateById(candidateId);
    if (cand) {
      const voter = this.getVoterByRA(cand.raNumber);
      if (voter) {
        voter.isScreened = isScreened;
      }
    }

    this.saveData();
    return screeningRecord;
  }

  public getCandidateScreening(candidateId: string): CandidateScreening | undefined {
    return this.data.candidateScreenings.find(cs => cs.candidateId === candidateId);
  }

  // --- Agents ---
  public getAgents(): ElectionAgent[] {
    return this.data.agents;
  }

  public addAgent(voterId: string, officeId: string, candidateId: string): ElectionAgent {
    const voter = this.getVoterById(voterId);
    if (!voter) throw new Error('Voter not found.');

    const cand = this.getCandidateById(candidateId);
    if (!cand) throw new Error('Contestant not found.');

    const office = this.getOfficeById(officeId);
    if (!office) throw new Error('Office not found.');

    // Check if voter is already an agent
    const existingAgent = this.data.agents.find(a => a.voterId === voterId);
    if (existingAgent) {
      throw new Error(`This voter is already assigned as an agent for ${existingAgent.candidateName}.`);
    }

    const agent: ElectionAgent = {
      id: `agent-${Date.now()}`,
      voterId: voter.id,
      voterRaNumber: voter.raNumber,
      voterName: `${voter.firstName} ${voter.lastName}`,
      officeId,
      candidateId: cand.id,
      candidateName: cand.name,
      assignedAt: new Date().toISOString()
    };

    voter.isAgent = true;
    voter.agentOfficeId = officeId;
    voter.agentCandidateId = cand.id;

    this.data.agents.push(agent);
    this.saveData();
    return agent;
  }

  public deleteAgent(agentId: string): boolean {
    const agent = this.data.agents.find(a => a.id === agentId);
    if (agent) {
      const voter = this.getVoterById(agent.voterId);
      if (voter) {
        voter.isAgent = false;
        voter.agentOfficeId = undefined;
        voter.agentCandidateId = undefined;
      }
      this.data.agents = this.data.agents.filter(a => a.id !== agentId);
      this.saveData();
      return true;
    }
    return false;
  }

  // --- Observers (Unique links, read-only, single-device enforced) ---
  public getObservers(): Observer[] {
    return this.data.observers;
  }

  public addObserver(name: string, rank: string, office: string, phone: string): Observer {
    const token = `obs_${crypto.randomBytes(16).toString('hex')}`;
    const newObserver: Observer = {
      id: `obs-${Date.now()}`,
      name: name.trim(),
      rank: rank.trim(),
      office: office?.trim() || '',
      phone: phone.trim(),
      token,
      createdAt: new Date().toISOString()
    };

    this.data.observers.push(newObserver);
    this.saveData();
    return newObserver;
  }

  public regenerateObserverToken(observerId: string): Observer {
    const obs = this.data.observers.find(o => o.id === observerId);
    if (!obs) throw new Error('Observer not found.');

    obs.token = `obs_${crypto.randomBytes(16).toString('hex')}`;
    obs.lastActiveDeviceId = undefined; // reset single device binding
    this.saveData();
    return obs;
  }

  public deleteObserver(observerId: string): boolean {
    const initialLen = this.data.observers.length;
    this.data.observers = this.data.observers.filter(o => o.id !== observerId);
    if (this.data.observers.length !== initialLen) {
      this.saveData();
      return true;
    }
    return false;
  }

  public verifyObserverToken(token: string, deviceId?: string): Observer {
    const obs = this.data.observers.find(o => o.token === token);
    if (!obs) {
      throw new Error('Invalid observer credential link.');
    }

    // SINGLE DEVICE POLICY FOR OBSERVER:
    // "Observer can only use the link in not more than one device at a time."
    if (deviceId) {
      if (!obs.lastActiveDeviceId) {
        obs.lastActiveDeviceId = deviceId;
        this.saveData();
      } else if (obs.lastActiveDeviceId !== deviceId) {
        // Transfer / bind to new device and invalidate previous device
        obs.lastActiveDeviceId = deviceId;
        this.saveData();
      }
    }

    return obs;
  }

  // --- Timeline ---
  public getTimeline(): TimelineItem[] {
    return this.data.timeline.sort((a, b) => a.order - b.order);
  }

  public addTimelineItem(item: Omit<TimelineItem, 'id'>): TimelineItem {
    const newItem: TimelineItem = { ...item, id: `time-${Date.now()}` };
    this.data.timeline.push(newItem);
    this.saveData(this.data);
    return newItem;
  }

  public updateTimelineItem(id: string, updates: Partial<TimelineItem>): TimelineItem | null {
    const idx = this.data.timeline.findIndex(t => t.id === id);
    if (idx === -1) return null;
    this.data.timeline[idx] = { ...this.data.timeline[idx], ...updates };
    this.saveData(this.data);
    return this.data.timeline[idx];
  }

  public deleteTimelineItem(id: string): boolean {
    const before = this.data.timeline.length;
    this.data.timeline = this.data.timeline.filter(t => t.id !== id);
    if (this.data.timeline.length !== before) {
      this.saveData(this.data);
      return true;
    }
    return false;
  }

  // --- YCEC ---
  public getYCEC(): YCECMember[] {
    return this.data.ycec;
  }

  // --- Votes ---
  public getVotes(): CastVote[] {
    return this.data.votes;
  }

  public getVotesByVoter(raNumber: string): CastVote[] {
    const cleanRA = raNumber.replace(/^RA-?/i, '').trim();
    return this.data.votes.filter(v => v.voterRaNumber.replace(/^RA-?/i, '').trim() === cleanRA);
  }

  public castVote(
    voterRaNumber: string,
    officeId: string,
    choice: 'candidate' | 'for' | 'against',
    candidateId?: string,
    ipAddress?: string
  ): { vote: CastVote; isChange: boolean } {
    const cleanRA = voterRaNumber.replace(/^RA-?/i, '').trim();
    
    // Check if voter already has a vote for this office
    const existingIndex = this.data.votes.findIndex(
      v => v.voterRaNumber.replace(/^RA-?/i, '').trim() === cleanRA && v.officeId === officeId
    );

    const now = new Date().toISOString();
    let isChange = false;

    if (existingIndex >= 0) {
      isChange = true;
      this.data.votes[existingIndex] = {
        ...this.data.votes[existingIndex],
        choice,
        candidateId,
        timestamp: now,
        ipAddress
      };
      this.saveData();
      return { vote: this.data.votes[existingIndex], isChange };
    } else {
      const newVote: CastVote = {
        id: `vote-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        voterRaNumber: cleanRA,
        officeId,
        choice,
        candidateId,
        timestamp: now,
        ipAddress
      };
      this.data.votes.push(newVote);
      this.saveData();
      return { vote: newVote, isChange };
    }
  }

  public getCandidateVoters(candidateId: string): { voter: Voter; timestamp: string }[] {
    const votes = this.data.votes.filter(
      v => (v.candidateId === candidateId && v.choice === 'candidate') ||
           (v.candidateId === candidateId && v.choice === 'for')
    );
    const result: { voter: Voter; timestamp: string }[] = [];
    for (const v of votes) {
      const voter = this.getVoterByRA(v.voterRaNumber);
      if (voter) {
        result.push({ voter, timestamp: v.timestamp });
      }
    }
    return result;
  }

  public getLiveResults() {
    const offices = this.getOffices();
    const candidates = this.getCandidates();
    const votes = this.getVotes();

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

  // --- Authentication & Single Device Session Management ---
  public createMagicLink(raNumber: string, email: string): MagicLinkRequest {
    const token = crypto.randomBytes(32).toString('hex');
    const cleanRA = raNumber.replace(/^RA-?/i, '').trim();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    const magicLink: MagicLinkRequest = {
      token,
      raNumber: cleanRA,
      email,
      createdAt: new Date().toISOString(),
      expiresAt,
      used: false
    };

    this.data.magicLinks = this.data.magicLinks.filter(
      m => new Date(m.expiresAt).getTime() > Date.now()
    );
    this.data.magicLinks.push(magicLink);
    this.saveData();

    return magicLink;
  }

  public verifyMagicLink(token: string, deviceInfo?: string): { voter: Voter; sessionToken: string } {
    const link = this.data.magicLinks.find(m => m.token === token && !m.used);
    if (!link) {
      throw new Error('Invalid or expired authentication link.');
    }

    if (new Date(link.expiresAt).getTime() < Date.now()) {
      throw new Error('This authentication link has expired.');
    }

    link.used = true;

    const voter = this.getVoterByRA(link.raNumber);
    if (!voter) {
      throw new Error('Voter profile not found.');
    }

    const sessionToken = this.createExclusiveSession(voter, deviceInfo);
    return { voter, sessionToken };
  }

  /**
   * Creates a single-device-exclusive session for a voter.
   * Any existing sessions for the voter's RA Number are invalidated first.
   */
  public createExclusiveSession(voter: Voter, deviceInfo?: string): string {
    // SINGLE DEVICE ENFORCEMENT: Invalidate any existing sessions for this RA Number!
    this.data.sessions = this.data.sessions.filter(
      s => s.raNumber.replace(/^RA-?/i, '').trim() !== voter.raNumber.replace(/^RA-?/i, '').trim()
    );

    // Create new exclusive session token
    const sessionToken = crypto.randomBytes(40).toString('hex');
    const session: UserSession = {
      token: sessionToken,
      raNumber: voter.raNumber,
      userId: voter.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      deviceInfo
    };

    this.data.sessions.push(session);
    this.saveData();

    return sessionToken;
  }

  public getSession(sessionToken: string): UserSession | undefined {
    return this.data.sessions.find(s => s.token === sessionToken);
  }

  public revokeSession(sessionToken: string) {
    this.data.sessions = this.data.sessions.filter(s => s.token !== sessionToken);
    this.saveData();
  }
}

export const db = new Database();
