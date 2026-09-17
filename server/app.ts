import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { db } from './database';
import { hasSupabase } from './supabase';
import { auditLedger, AuditActor } from './auditLedger';

const app = express();
// FRONTEND_DIR must resolve identically under both ESM and CommonJS bundles
// (import.meta.url is undefined in CJS), so derive it from the process cwd.
const FRONTEND_DIR = path.join(process.cwd(), 'dist');

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

app.use(cors());
app.use(express.json());

// Real-time broadcast is overridden by the local server (WebSockets).
// Serverless deployments (Vercel) are stateless, so live results rely on client polling.
let broadcastFn: () => void = () => {};
export function setBroadcastLiveResults(fn: () => void) {
  broadcastFn = fn;
}
export function broadcastLiveResults() {
  broadcastFn();
}

// Middleware to extract authenticated voter from session token
interface AuthenticatedRequest extends Request {
  voter?: ReturnType<typeof db.getVoterById>;
  sessionToken?: string;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const isProd = process.env.NODE_ENV === 'production';
  const token = req.headers['x-session-token'] as string;
  if (!token) {
    // In dev / demo mode, fallback to superadmin if no token passed
    const defaultSuperadmin = db.getVoterByRA('1001');
    if (!isProd && defaultSuperadmin) {
      req.voter = defaultSuperadmin;
      req.sessionToken = 'demo-superadmin-token';
      return next();
    }
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' });
  }

  const session = db.getSession(token);
  if (!session) {
    const fallbackVoter = db.getVoterByRA('1001');
    if (!isProd && fallbackVoter) {
      req.voter = fallbackVoter;
      req.sessionToken = token;
      return next();
    }
    return res.status(401).json({
      error: 'SESSION_SUPERSEDED',
      message: 'Your session has expired or you have logged in from another device.'
    });
  }

  const voter = db.getVoterByRA(session.raNumber);
  if (!voter) {
    return res.status(401).json({ error: 'USER_NOT_FOUND', message: 'Voter account not found.' });
  }

  req.voter = voter;
  req.sessionToken = token;
  next();
}

function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.headers['x-session-token'] as string;
  if (token) {
    const session = db.getSession(token);
    if (session) {
      req.voter = db.getVoterByRA(session.raNumber);
      req.sessionToken = token;
    }
  }
  next();
}

// ----------------------------------------------------
// PERMISSIONS (Superadmin-delegated access control)
// ----------------------------------------------------
// The Access Control matrix (settings.permissions) decides which roles or
// individual officers may perform each administrative mandate. Superadmin
// always passes. Entries may be role names ('committee') or specific
// voter ids / RA numbers (per-officer delegation from the Admin portal).
const PERMISSION_MAP: Record<string, 'canRegisterUsers' | 'canAccreditUsers' | 'canCreateOffices' | 'canAssignOffices' | 'canCreateScreeningCriteria' | 'canAssignAgents' | 'canCreateObservers'> = {
  registerUsers: 'canRegisterUsers',
  accreditUsers: 'canAccreditUsers',
  createOffices: 'canCreateOffices',
  assignOffices: 'canAssignOffices',
  screeningCriteria: 'canCreateScreeningCriteria',
  agents: 'canAssignAgents',
  observers: 'canCreateObservers'
};

function hasPermission(action: keyof typeof PERMISSION_MAP, voter: ReturnType<typeof db.getVoterById>): boolean {
  if (!voter) return false;
  if (voter.role === 'superadmin') return true;
  const perms = db.getSettings().permissions;
  // Legacy fallback when no matrix is stored: committee members retain access.
  if (!perms) return voter.role === 'committee';
  const list = perms[PERMISSION_MAP[action]] || [];
  return list.includes(voter.role) || list.includes(voter.id) || list.includes(voter.raNumber);
}

function requirePermission(action: keyof typeof PERMISSION_MAP) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!hasPermission(action, req.voter)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Your administrator has not granted you permission for this action. Contact the Superadmin.'
      });
    }
    next();
  };
}

// ----------------------------------------------------
// SETTINGS
// ----------------------------------------------------
app.get('/api/settings', (_req: Request, res: Response) => {
  res.json(db.getSettings());
});

app.post('/api/settings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only Superadmin can update settings.' });
  }

  const updated = db.updateSettings(req.body);
  auditLedger.recordEvent('SETTINGS_UPDATED', {
    raNumber: req.voter.raNumber,
    name: `${req.voter.firstName} ${req.voter.lastName}`,
    email: req.voter.email,
    role: req.voter.role
  }, { updatedFields: Object.keys(req.body) });

  res.json(updated);
});

// ----------------------------------------------------
// STATS
// ----------------------------------------------------
app.get('/api/stats', (_req: Request, res: Response) => {
  const offices = db.getOffices();
  const voters = db.getVoters();
  const candidates = db.getCandidates();
  const ycec = db.getYCEC();
  const votes = db.getVotes();

  const accreditedVoters = voters.filter(v => v.isAccredited);

  res.json({
    officesCount: offices.length,
    registeredVotersCount: voters.length,
    accreditedVotersCount: accreditedVoters.length,
    contestantsCount: candidates.length,
    ycecCount: ycec.length,
    totalVotesCount: votes.length
  });
});

// ----------------------------------------------------
// OFFICES
// ----------------------------------------------------
app.get('/api/offices', (_req: Request, res: Response) => {
  res.json(db.getOffices());
});

app.post('/api/offices', requireAuth, requirePermission('createOffices'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee permission required.' });
  }

  const newOffice = db.addOffice(req.body);
  auditLedger.recordEvent('OFFICE_CREATED', {
    raNumber: req.voter.raNumber,
    name: `${req.voter.firstName} ${req.voter.lastName}`,
    role: req.voter.role
  }, { officeId: newOffice.id, title: newOffice.title });

  broadcastLiveResults();
  res.status(201).json(newOffice);
});

// ----------------------------------------------------
// CANDIDATES / CONTESTANTS
// ----------------------------------------------------
app.get('/api/candidates', (_req: Request, res: Response) => {
  res.json(db.getCandidates());
});

app.get('/api/candidates/:id', (req: Request, res: Response) => {
  const candId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const cand = db.getCandidateById(candId);
  if (!cand) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(cand);
});

app.post('/api/candidates', requireAuth, requirePermission('assignOffices'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee permission required.' });
  }

  const cand = db.addCandidate(req.body);
  auditLedger.recordEvent('CANDIDATE_REGISTERED', {
    raNumber: req.voter.raNumber,
    name: `${req.voter.firstName} ${req.voter.lastName}`,
    role: req.voter.role
  }, { candidateId: cand.id, name: cand.name, officeId: cand.officeId });

  broadcastLiveResults();
  res.status(201).json(cand);
});

app.delete('/api/offices/:id', requireAuth, requirePermission('createOffices'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee permission required.' });
  }

  const officeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const office = db.getOfficeById(officeId);
  const deleted = db.deleteOffice(officeId);
  if (deleted) {
    auditLedger.recordEvent('OFFICE_DELETED', {
      raNumber: req.voter.raNumber,
      name: `${req.voter.firstName} ${req.voter.lastName}`,
      role: req.voter.role
    }, { officeId, title: office?.title });
    broadcastLiveResults();
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'NOT_FOUND' });
});

app.post('/api/offices/assign', requireAuth, requirePermission('assignOffices'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee permission required.' });
  }

  const { voterId, officeId } = req.body;
  if (!voterId || !officeId) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'voterId and officeId are required.' });
  }

  try {
    const result = db.assignOffice(voterId, officeId);
    auditLedger.recordEvent('OFFICE_ASSIGNED', {
      raNumber: req.voter.raNumber,
      name: `${req.voter.firstName} ${req.voter.lastName}`,
      role: req.voter.role
    }, {
      voterRA: result.voter.raNumber,
      voterName: `${result.voter.firstName} ${result.voter.lastName}`,
      officeId,
      candidateId: result.candidate.id
    });
    broadcastLiveResults();
    res.json({ voter: db.publicVoter(result.voter), candidate: result.candidate });
  } catch (err: any) {
    res.status(400).json({ error: 'ASSIGN_FAILED', message: err.message });
  }
});

app.post('/api/offices/unassign', requireAuth, requirePermission('assignOffices'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee permission required.' });
  }

  const { voterId } = req.body;
  if (!voterId) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'voterId is required.' });
  }

  try {
    const voter = db.unassignOffice(voterId);
    auditLedger.recordEvent('OFFICE_UNASSIGNED', {
      raNumber: req.voter.raNumber,
      name: `${req.voter.firstName} ${req.voter.lastName}`,
      role: req.voter.role
    }, { voterRA: voter.raNumber });
    broadcastLiveResults();
    res.json({ success: true, voter: db.publicVoter(voter) });
  } catch (err: any) {
    res.status(400).json({ error: 'UNASSIGN_FAILED', message: err.message });
  }
});

// ----------------------------------------------------
// VOTERS
// ----------------------------------------------------
app.get('/api/voters', (_req: Request, res: Response) => {
  // Public listing with full fields for directory & admin
  const voters = db.getVoters().map(v => ({
    id: v.id,
    raNumber: v.raNumber,
    name: `${v.firstName} ${v.middleName ? v.middleName + ' ' : ''}${v.lastName}`,
    firstName: v.firstName,
    middleName: v.middleName,
    lastName: v.lastName,
    email: v.email,
    role: v.role,
    isAccredited: v.isAccredited,
    isScreened: v.isScreened,
    assignedOfficeId: v.assignedOfficeId,
    isAgent: v.isAgent,
    agentOfficeId: v.agentOfficeId,
    agentCandidateId: v.agentCandidateId,
    department: v.department,
    phone: v.phone,
    registeredAt: v.registeredAt
  }));
  res.json(voters);
});

app.post('/api/voters', requireAuth, requirePermission('registerUsers'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee member access required to register voters.' });
  }

  const { email, firstName, middleName, lastName, raNumber, role, department, phone, password } = req.body;
  if (!email || !firstName || !lastName || !raNumber) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'First name, last name, email, and RA number are required.' });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Set an initial password of at least 6 characters for the voter and share it with them securely.' });
  }

  try {
    const created = db.addVoter({
      email,
      firstName,
      middleName,
      lastName,
      raNumber,
      role,
      department,
      phone
    });
    const newVoter = db.setVoterPassword(created.id, String(password));

    auditLedger.recordEvent('VOTER_REGISTERED', {
      raNumber: req.voter.raNumber,
      name: `${req.voter.firstName} ${req.voter.lastName}`,
      role: req.voter.role
    }, {
      newVoterRA: newVoter.raNumber,
      newVoterEmail: newVoter.email,
      newVoterName: `${newVoter.firstName} ${newVoter.lastName}`
    });

    res.status(201).json(db.publicVoter(newVoter));
  } catch (err: any) {
    res.status(400).json({ error: 'REGISTRATION_FAILED', message: err.message });
  }
});

app.put('/api/voters/:id', requireAuth, requirePermission('registerUsers'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee member access required to edit voters.' });
  }

  const voterId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const target = db.getVoterById(voterId);
  if (!target) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Voter not found.' });
  }

  // Only the Superadmin may edit a Superadmin account (or change roles).
  const isSuperadmin = req.voter?.role === 'superadmin';
  if (!isSuperadmin && (target.role === 'superadmin' || req.body.role)) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only Superadmin can edit Superadmin accounts or change roles.' });
  }

  const { email, firstName, middleName, lastName, department, phone, avatar, role } = req.body;
  const updates: Record<string, unknown> = {};
  if (email !== undefined) {
    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Please provide a valid email address.' });
    }
    const clash = db.getVoterByEmail(cleanEmail);
    if (clash && clash.id !== target.id) {
      return res.status(400).json({ error: 'EMAIL_TAKEN', message: 'Another voter is already registered with this email.' });
    }
    updates.email = cleanEmail;
  }
  if (firstName !== undefined) updates.firstName = String(firstName).trim();
  if (middleName !== undefined) updates.middleName = String(middleName).trim();
  if (lastName !== undefined) updates.lastName = String(lastName).trim();
  if (department !== undefined) updates.department = String(department).trim();
  if (phone !== undefined) updates.phone = String(phone).trim();
  if (avatar !== undefined) updates.avatar = String(avatar).trim();
  if (role !== undefined && isSuperadmin) {
    if (!['voter', 'contestant', 'committee', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: 'INVALID_ROLE', message: 'Unknown role.' });
    }
    // There must always be at least one Superadmin left.
    if (target.role === 'superadmin' && role !== 'superadmin' &&
        db.getVoters().filter(v => v.role === 'superadmin').length <= 1) {
      return res.status(400).json({ error: 'LAST_SUPERADMIN', message: 'The last Superadmin account cannot be demoted.' });
    }
    updates.role = role;
  }

  if (!updates.firstName && !target.firstName) {
    return res.status(400).json({ error: 'INVALID_NAME', message: 'First name cannot be empty.' });
  }

  try {
    const updated = db.updateVoter(target.id, updates);
    auditLedger.recordEvent('VOTER_UPDATED', {
      raNumber: req.voter!.raNumber,
      name: `${req.voter!.firstName} ${req.voter!.lastName}`,
      role: req.voter!.role
    }, {
      voterRA: updated.raNumber,
      voterName: `${updated.firstName} ${updated.lastName}`,
      updatedFields: Object.keys(updates)
    });
    res.json(db.publicVoter(updated));
  } catch (err: any) {
    res.status(400).json({ error: 'UPDATE_FAILED', message: err.message });
  }
});

app.put('/api/voters/:id/accredit', requireAuth, requirePermission('accreditUsers'), (req: AuthenticatedRequest, res: Response) => {  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee member access required to accredit voters.' });
  }

  const voterId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { isAccredited } = req.body;

  try {
    const updated = db.accreditVoter(voterId, Boolean(isAccredited));
    auditLedger.recordEvent(isAccredited ? 'VOTER_ACCREDITED' : 'VOTER_UNACCREDITED', {
      raNumber: req.voter.raNumber,
      name: `${req.voter.firstName} ${req.voter.lastName}`,
      role: req.voter.role
    }, {
      voterRA: updated.raNumber,
      voterName: `${updated.firstName} ${updated.lastName}`,
      isAccredited
    });
    res.json(db.publicVoter(updated));
  } catch (err: any) {
    res.status(400).json({ error: 'ACCREDITATION_FAILED', message: err.message });
  }
});

app.delete('/api/voters/:id', requireAuth, requirePermission('registerUsers'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee member access required to delete voters.' });
  }

  const voterId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const voter = db.getVoterById(voterId);
  if (voter?.role === 'superadmin' &&
      db.getVoters().filter(v => v.role === 'superadmin').length <= 1) {
    return res.status(400).json({ error: 'LAST_SUPERADMIN', message: 'The last Superadmin account cannot be deleted.' });
  }
  const deleted = db.deleteVoter(voterId);

  if (deleted) {
    auditLedger.recordEvent('VOTER_DELETED', {
      raNumber: req.voter.raNumber,
      name: `${req.voter.firstName} ${req.voter.lastName}`,
      role: req.voter.role
    }, { deletedVoterRA: voter?.raNumber, deletedVoterName: `${voter?.firstName} ${voter?.lastName}` });
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'NOT_FOUND' });
});

// ----------------------------------------------------
// COMMITTEE ADMIN MANAGEMENT
// ----------------------------------------------------
app.get('/api/committee-admins', requireAuth, (_req: Request, res: Response) => {
  res.json(db.getCommitteeAdmins().map(v => db.publicVoter(v)));
});

app.post('/api/committee-admins', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only Superadmin can appoint Committee Administrators.' });
  }

  const { voterIds } = req.body;
  if (!Array.isArray(voterIds) || voterIds.length === 0) {
    return res.status(400).json({ error: 'INVALID_REQUEST', message: 'Please select one or more registered voters.' });
  }

  const updated = db.addCommitteeAdmins(voterIds);
  auditLedger.recordEvent('COMMITTEE_ADMINS_APPOINTED', {
    raNumber: req.voter.raNumber,
    name: `${req.voter.firstName} ${req.voter.lastName}`,
    role: req.voter.role
  }, {
    appointedCount: updated.length,
    appointedRAs: updated.map(u => u.raNumber)
  });

  res.json({ success: true, updated });
});

app.delete('/api/committee-admins/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only Superadmin can remove Committee Administrators.' });
  }

  const voterId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const updated = db.removeCommitteeAdmin(voterId);
    auditLedger.recordEvent('COMMITTEE_ADMIN_REMOVED', {
      raNumber: req.voter.raNumber,
      name: `${req.voter.firstName} ${req.voter.lastName}`,
      role: req.voter.role
    }, {
      removedRA: updated.raNumber,
      removedName: `${updated.firstName} ${updated.lastName}`
    });
    res.json({ success: true, voter: db.publicVoter(updated) });
  } catch (err: any) {
    res.status(400).json({ error: 'FAILED', message: err.message });
  }
});

// ----------------------------------------------------
// TIMELINE & YCEC
// ----------------------------------------------------
app.get('/api/timeline', (_req: Request, res: Response) => {
  res.json(db.getTimeline());
});

app.post('/api/timeline', requireAuth, (req: Request, res: Response) => {
  const { title, description, date, status, icon, order } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'title and date required' });
  const item = db.addTimelineItem({ title, description: description || '', date, status: status || 'upcoming', icon: icon || 'Clock', order: order ?? 99 });
  res.status(201).json(item);
});

app.put('/api/timeline/:id', requireAuth, (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const updated = db.updateTimelineItem(id, req.body);
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json(updated);
});

app.delete('/api/timeline/:id', requireAuth, (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const ok = db.deleteTimelineItem(id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ success: true });
});

app.get('/api/ycec', (_req: Request, res: Response) => {
  res.json(db.getYCEC());
});

// ----------------------------------------------------
// AUTHENTICATION (RA Number + Password, 7-Day Single Device)
// ----------------------------------------------------
// Registration is CLOSED: nobody can self-register. The electoral roll is
// built exclusively by staff holding the 'registerUsers' permission, who set
// each voter's initial password at enrolment. The very first account — the
// Superadmin — is claimed once via setup-superadmin on a fresh system.
// Passwords are scrypt-hashed server-side; everything is self-contained,
// with 7-day single-device-exclusive sessions.

// A fresh system = only the placeholder Superadmin, empty ballot box.
// Once the seat is claimed (real name + real email), setup closes forever.
const PLACEHOLDER_SUPERADMIN_EMAIL = 'superadmin@fatballot.org';
function isFreshSystem(): boolean {
  const voters = db.getVoters();
  if (voters.length !== 1 || db.getCandidates().length !== 0 || db.getVotes().length !== 0) {
    return false;
  }
  const only = voters[0];
  return only.role === 'superadmin'
    && only.email.trim().toLowerCase() === PLACEHOLDER_SUPERADMIN_EMAIL
    && !only.passwordHash;
}

app.get('/api/auth/setup-status', (_req: Request, res: Response) => {
  res.json({ setupRequired: isFreshSystem() });
});

// First-to-register: claims the Superadmin seat on a fresh system.
// Single-use by design — afterwards it returns 403 SETUP_COMPLETE.
app.post('/api/auth/setup-superadmin', (req: Request, res: Response) => {
  if (!isFreshSystem()) {
    return res.status(403).json({
      error: 'SETUP_COMPLETE',
      message: 'The Superadmin account has already been claimed.'
    });
  }

  const { email, firstName, lastName, password } = req.body;
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Please provide a valid email address.' });
  }
  if (!String(firstName || '').trim() || !String(lastName || '').trim()) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'First name and last name are required.' });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters.' });
  }

  const clash = db.getVoterByEmail(cleanEmail);
  const superadmin = db.getVoters().find(v => v.role === 'superadmin') ?? db.getVoterByRA('1001');
  if (!superadmin) {
    return res.status(500).json({ error: 'NO_SUPERADMIN', message: 'Superadmin seed missing. Restart the server.' });
  }
  if (clash && clash.id !== superadmin.id) {
    return res.status(400).json({ error: 'EMAIL_TAKEN', message: 'This email is already on the electoral roll.' });
  }

  const updated = db.updateVoter(superadmin.id, {
    email: cleanEmail,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    isAccredited: true,
    role: 'superadmin',
    passwordHash: db.hashPassword(String(password))
  });

  auditLedger.recordEvent('SUPERADMIN_SETUP', {
    raNumber: updated.raNumber,
    email: updated.email,
    name: `${updated.firstName} ${updated.lastName}`,
    role: 'superadmin'
  }, { ip: req.ip });

  // Log the new Superadmin straight in with the just-set password.
  const sessionToken = db.createExclusiveSession(updated, req.headers['user-agent']);

  res.status(201).json({
    success: true,
    sessionToken,
    voter: db.publicVoter(updated)
  });
});

// RA number + password sign-in. Fully self-contained: the password hash is
// verified locally with scrypt — no email, no codes, no external service.
// Success issues the exclusive 7-day single-device session.
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { raNumber, password, deviceInfo } = req.body;
  const cleanRA = String(raNumber || '').replace(/^RA-?/i, '').trim();
  if (!cleanRA) {
    return res.status(400).json({ error: 'RA_REQUIRED', message: 'Please enter your RA Number.' });
  }
  if (!password) {
    return res.status(400).json({ error: 'PASSWORD_REQUIRED', message: 'Please enter your password.' });
  }

  const voter = db.getVoterByRA(cleanRA);
  if (!voter) {
    return res.status(404).json({
      error: 'VOTER_NOT_FOUND',
      message: `Access Denied. No voter found with RA Number ${cleanRA}. Please contact the Electoral Committee.`
    });
  }
  if (!voter.passwordHash) {
    return res.status(403).json({
      error: 'PASSWORD_NOT_SET',
      message: 'No password has been set for this account yet. Please ask your Electoral Committee officer to set one for you.'
    });
  }

  const ok = db.verifyPassword(voter.passwordHash, String(password));
  if (!ok) {
    // Small uniform delay blunts online guessing; message stays generic.
    setTimeout(() => {
      res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Incorrect RA Number or password. Please check and try again.'
      });
    }, 400);
    return;
  }

  const sessionToken = db.createExclusiveSession(voter, deviceInfo || req.headers['user-agent']);

  auditLedger.recordEvent('AUTH_LOGIN_SUCCESS', {
    raNumber: voter.raNumber,
    email: voter.email,
    name: `${voter.firstName} ${voter.lastName}`,
    role: voter.role
  }, {
    provider: 'ra-password',
    deviceInfo: deviceInfo || req.headers['user-agent'],
    ip: req.ip,
    singleDeviceEnforced: true,
    sessionDays: 7
  });

  res.json({
    success: true,
    sessionToken,
    voter: db.publicVoter(voter)
  });
});

// Change own password (authenticated).
app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const voter = req.voter!;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Current and new passwords are required.' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'New password must be at least 6 characters.' });
  }
  if (!voter.passwordHash || !db.verifyPassword(voter.passwordHash, String(currentPassword))) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Your current password is incorrect.' });
  }

  try {
    const updated = db.setVoterPassword(voter.id, String(newPassword));
    auditLedger.recordEvent('PASSWORD_CHANGED', {
      raNumber: updated.raNumber,
      email: updated.email,
      name: `${updated.firstName} ${updated.lastName}`,
      role: updated.role
    }, { ip: req.ip });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: 'UPDATE_FAILED', message: err.message });
  }
});

// Reset a voter's password (committee staff holding the registerUsers grant;
// Superadmin always allowed). Used when a voter forgets their password.
app.post('/api/auth/reset-password', requireAuth, requirePermission('registerUsers'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee member access required.' });
  }

  const { voterId, newPassword } = req.body;
  if (!voterId || !newPassword) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Voter and new password are required.' });
  }
  const target = db.getVoterById(String(voterId));
  if (!target) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Voter not found.' });
  }

  try {
    const updated = db.setVoterPassword(target.id, String(newPassword));
    auditLedger.recordEvent('PASSWORD_RESET', {
      raNumber: req.voter!.raNumber,
      name: `${req.voter!.firstName} ${req.voter!.lastName}`,
      role: req.voter!.role
    }, {
      voterRA: updated.raNumber,
      voterName: `${updated.firstName} ${updated.lastName}`,
      ip: req.ip
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: 'UPDATE_FAILED', message: err.message });
  }
});

// Dev / testing shortcut: creates an exclusive session directly for an RA number.
// Powers the quick-login buttons in AdminPage.
// DISABLED in production — RA-number + password sign-in is the only gate.
app.post('/api/auth/dev-login', (req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (isProd) {
    return res.status(403).json({
      error: 'DEV_LOGIN_DISABLED',
      message: 'Quick login is disabled in production. Please sign in with your RA Number and password.'
    });
  }

  const { raNumber, deviceInfo } = req.body;
  if (!raNumber) {
    return res.status(400).json({ error: 'RA_REQUIRED', message: 'RA number is required.' });
  }

  const cleanRA = String(raNumber).replace(/^RA-?/i, '').trim();
  const voter = db.getVoterByRA(cleanRA);
  if (!voter) {
    return res.status(404).json({ error: 'VOTER_NOT_FOUND', message: `No voter found with RA Number ${cleanRA}.` });
  }

  const sessionToken = db.createExclusiveSession(voter, deviceInfo || req.headers['user-agent']);

  auditLedger.recordEvent('AUTH_LOGIN_SUCCESS', {
    raNumber: voter.raNumber,
    email: voter.email,
    name: `${voter.firstName} ${voter.lastName}`,
    role: voter.role
  }, {
    provider: 'dev-shortcut',
    deviceInfo: deviceInfo || req.headers['user-agent'],
    ip: req.ip,
    singleDeviceEnforced: true
  });

  res.json({
    success: true,
    sessionToken,
    voter: db.publicVoter(voter)
  });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json(db.publicVoter(req.voter!));
});

app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.sessionToken) {
    db.revokeSession(req.sessionToken);
  }

  if (req.voter) {
    auditLedger.recordEvent('AUTH_LOGOUT', {
      raNumber: req.voter.raNumber,
      email: req.voter.email,
      name: `${req.voter.firstName} ${req.voter.lastName}`
    });
  }

  res.json({ success: true });
});

// ----------------------------------------------------
// VOTES & LIVE DASHBOARD
// ----------------------------------------------------
app.get('/api/votes/my-votes', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const myVotes = db.getVotesByVoter(req.voter!.raNumber);
  res.json(myVotes);
});

app.post('/api/votes/cast', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { officeId, choice, candidateId } = req.body;
  const voter = req.voter!;

  if (!officeId || !choice) {
    return res.status(400).json({ error: 'MISSING_DATA', message: 'Office and choice are required.' });
  }

  // REQUIREMENT: Only accredited voters can vote!
  if (!voter.isAccredited) {
    return res.status(403).json({
      error: 'ACCREDITATION_REQUIRED',
      message: 'You have not been accredited yet. Only accredited voters are authorized to cast ballots.'
    });
  }

  // Check election active window
  const settings = db.getSettings();
  const now = new Date().getTime();
  const start = new Date(settings.electionStartTime).getTime();
  const end = new Date(settings.electionEndTime).getTime();

  if (now < start) {
    return res.status(403).json({ error: 'ELECTION_NOT_STARTED', message: 'Voting has not commenced yet.' });
  }
  if (now > end) {
    return res.status(403).json({ error: 'ELECTION_ENDED', message: 'Voting has concluded. No further ballots accepted.' });
  }

  const { vote, isChange } = db.castVote(
    voter.raNumber,
    officeId,
    choice,
    candidateId,
    req.ip
  );

  auditLedger.recordEvent(isChange ? 'VOTE_CHANGED' : 'VOTE_CAST', {
    raNumber: voter.raNumber,
    name: `${voter.firstName} ${voter.lastName}`,
    email: voter.email
  }, {
    officeId,
    choice,
    candidateId,
    isChange
  });

  // Real-time broadcast to all connected dashboards
  broadcastLiveResults();

  res.json({ success: true, vote, isChange });
});

app.get('/api/votes/live-results', (_req: Request, res: Response) => {
  res.json(db.getLiveResults());
});

app.get('/api/votes/candidate-voters/:candidateId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const settings = db.getSettings();
  const isSuperadmin = req.voter?.role === 'superadmin';
  const isContestant = req.voter?.role === 'contestant';

  // Check permission
  if (!isSuperadmin && (!isContestant || !settings.contestantsCanViewVoters)) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Voter transparency list is restricted by election committee settings.'
    });
  }

  const cId = Array.isArray(req.params.candidateId) ? req.params.candidateId[0] : req.params.candidateId;
  const candidateVoters = db.getCandidateVoters(cId).map(item => ({
    voter: db.publicVoter(item.voter),
    timestamp: item.timestamp
  }));
  res.json(candidateVoters);
});

// ----------------------------------------------------
// SCREENING CRITERIA & SCREENING EVALUATION
// ----------------------------------------------------
app.get('/api/screening-criteria', (req: Request, res: Response) => {
  const officeId = req.query.officeId as string;
  res.json(db.getScreeningCriteria(officeId));
});

app.post('/api/screening-criteria', requireAuth, requirePermission('screeningCriteria'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee access required.' });
  }

  const { officeId, title, criteria } = req.body;
  if (!officeId || !title || !criteria || !Array.isArray(criteria)) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'officeId, title, and criteria list required.' });
  }

  const saved = db.saveScreeningCriteria(officeId, title, criteria);
  auditLedger.recordEvent('SCREENING_CRITERIA_UPDATED', {
    raNumber: req.voter.raNumber,
    name: `${req.voter.firstName} ${req.voter.lastName}`,
    role: req.voter.role
  }, { officeId, title, criteriaCount: criteria.length });

  res.json(saved);
});

app.delete('/api/screening-criteria/:id', requireAuth, requirePermission('screeningCriteria'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee access required.' });
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = db.deleteScreeningCriteria(id);
  res.json({ success: deleted });
});

app.post('/api/candidates/:id/screen', requireAuth, requirePermission('screeningCriteria'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee access required.' });
  }

  const candId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { officeId, results } = req.body;
  if (!officeId || !results || !Array.isArray(results)) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'officeId and results array required.' });
  }

  const screening = db.screenCandidate(candId, officeId, results);
  const cand = db.getCandidateById(candId);

  auditLedger.recordEvent(screening.isScreened ? 'CANDIDATE_SCREENED_PASS' : 'CANDIDATE_SCREENED_FAIL', {
    raNumber: req.voter.raNumber,
    name: `${req.voter.firstName} ${req.voter.lastName}`,
    role: req.voter.role
  }, {
    candidateId: candId,
    candidateName: cand?.name,
    passedCount: screening.passedCount,
    totalCount: screening.totalCount,
    percentage: screening.percentage,
    isScreened: screening.isScreened
  });

  res.json(screening);
});

app.get('/api/candidates/:id/screening', (req: Request, res: Response) => {
  const candId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const screening = db.getCandidateScreening(candId);
  res.json(screening || null);
});

// ----------------------------------------------------
// AGENTS
// ----------------------------------------------------
app.get('/api/agents', (_req: Request, res: Response) => {
  res.json(db.getAgents());
});

app.post('/api/agents', requireAuth, requirePermission('agents'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee access required.' });
  }

  const { voterId, officeId, candidateId } = req.body;
  if (!voterId || !officeId || !candidateId) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'voterId, officeId, and candidateId required.' });
  }

  try {
    const agent = db.addAgent(voterId, officeId, candidateId);
    auditLedger.recordEvent('AGENT_ASSIGNED', {
      raNumber: req.voter.raNumber,
      name: `${req.voter.firstName} ${req.voter.lastName}`,
      role: req.voter.role
    }, {
      agentRA: agent.voterRaNumber,
      agentName: agent.voterName,
      candidateId,
      candidateName: agent.candidateName,
      officeId
    });

    res.status(201).json(agent);
  } catch (err: any) {
    res.status(400).json({ error: 'AGENT_ASSIGN_FAILED', message: err.message });
  }
});

app.delete('/api/agents/:id', requireAuth, requirePermission('agents'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee access required.' });
  }

  const agentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = db.deleteAgent(agentId);
  res.json({ success: deleted });
});

// ----------------------------------------------------
// OBSERVERS (Read-only, single-device enforced)
// ----------------------------------------------------
app.get('/api/observers', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee access required.' });
  }
  res.json(db.getObservers());
});

app.post('/api/observers', requireAuth, requirePermission('observers'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee access required.' });
  }

  const { name, rank, office, phone } = req.body;
  if (!name || !rank || !phone) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Name, rank, and phone required.' });
  }

  const newObs = db.addObserver(name, rank, office, phone);
  auditLedger.recordEvent('OBSERVER_CREATED', {
    raNumber: req.voter.raNumber,
    name: `${req.voter.firstName} ${req.voter.lastName}`,
    role: req.voter.role
  }, {
    observerName: newObs.name,
    rank: newObs.rank,
    office: newObs.office
  });

  res.status(201).json(newObs);
});

app.post('/api/observers/:id/regenerate-link', requireAuth, requirePermission('observers'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee access required.' });
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const updated = db.regenerateObserverToken(id);
    auditLedger.recordEvent('OBSERVER_TOKEN_REGENERATED', {
      raNumber: req.voter.raNumber,
      name: `${req.voter.firstName} ${req.voter.lastName}`,
      role: req.voter.role
    }, { observerName: updated.name });

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: 'REGENERATE_FAILED', message: err.message });
  }
});

app.delete('/api/observers/:id', requireAuth, requirePermission('observers'), (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee access required.' });
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = db.deleteObserver(id);
  res.json({ success: deleted });
});

app.get('/api/observers/verify/:token', (req: Request, res: Response) => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const deviceId = req.headers['user-agent'] || 'device-default';

  try {
    const observer = db.verifyObserverToken(token, deviceId);
    res.json({
      valid: true,
      observer: {
        id: observer.id,
        name: observer.name,
        rank: observer.rank,
        office: observer.office,
        phone: observer.phone
      }
    });
  } catch (err: any) {
    res.status(401).json({ valid: false, message: err.message });
  }
});

app.get('/api/audit-log/agent-monitor/:candidateId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const candId = Array.isArray(req.params.candidateId) ? req.params.candidateId[0] : req.params.candidateId;
  const cand = db.getCandidateById(candId);
  const logs = auditLedger.getContestantLogs(candId, cand?.raNumber);
  res.json(logs);
});

// ----------------------------------------------------
// IMMUTABLE AUDIT LEDGER
// ----------------------------------------------------
app.get('/api/audit-log', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json(auditLedger.getChain());
});

app.get('/api/audit-log/verify', (_req: Request, res: Response) => {
  res.json(auditLedger.verifyIntegrity());
});

app.get('/api/audit-log/my', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json(auditLedger.getUserLogs(req.voter!.raNumber));
});

app.post('/api/audit-log/export-event', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
  const { listName } = req.body;
  const actor: AuditActor = req.voter ? {
    raNumber: req.voter.raNumber,
    name: `${req.voter.firstName} ${req.voter.lastName}`,
    email: req.voter.email,
    role: req.voter.role
  } : {
    role: 'ANONYMOUS_VISITOR'
  };

  auditLedger.recordEvent('PDF_EXPORTED', actor, {
    listName: listName || 'Unknown Document',
    ip: req.ip
  });

  res.json({ success: true });
});

// ----------------------------------------------------
// HEALTH + API SAFETY NET
// ----------------------------------------------------
// Lightweight diagnostic: confirms the API function is alive, whether the
// Supabase backend is configured, and server time. Open /api/health in a
// browser when diagnosing production issues.
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    supabaseConfigured: hasSupabase(),
    production: isProduction()
  });
});

// Safety net: every /api/* path that matches no route above returns JSON,
// never Express's default HTML error page (which breaks res.json() clients
// with "Unexpected token ..." syntax errors).
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Unknown API endpoint.'
  });
});

// Central error handler: serialize ALL downstream errors as JSON.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('FatBallot API error:', err);
  if (res.headersSent) return;
  res.status(err?.status || 500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: err?.message || 'An unexpected server error occurred.'
  });
});

// ----------------------------------------------------
// PRODUCTION: Serve the built React frontend
// ----------------------------------------------------
// Static assets (JS/CSS/images) from the Vite build
app.use(express.static(FRONTEND_DIR));

// SPA fallback: any non-API GET route serves index.html
app.get(/^\/(?!api|ws).*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

export default app;
