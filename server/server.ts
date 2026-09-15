import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from './database';
import { auditLedger, AuditActor } from './auditLedger';

const app = express();
const PORT = process.env.PORT || 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.join(__dirname, '..', 'dist');

// Firebase web API key used to verify passwordless sign-in ID tokens server-side
const FIREBASE_API_KEY = 'AIzaSyDBzRlGJfUZXU86t5xMg1Q18rdjBbXzsEA';

app.use(cors());
app.use(express.json());

// Create HTTP server & WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Broadcast helper for real-time live election updates
export function broadcastLiveResults() {
  const liveData = db.getLiveResults();
  const payload = JSON.stringify({ type: 'LIVE_RESULTS_UPDATE', data: liveData });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on('connection', ws => {
  // Send immediate live stats on connect
  ws.send(JSON.stringify({ type: 'LIVE_RESULTS_UPDATE', data: db.getLiveResults() }));
});

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

app.post('/api/offices', requireAuth, (req: AuthenticatedRequest, res: Response) => {
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

app.post('/api/candidates', requireAuth, (req: AuthenticatedRequest, res: Response) => {
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

app.delete('/api/offices/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
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

app.post('/api/offices/assign', requireAuth, (req: AuthenticatedRequest, res: Response) => {
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
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: 'ASSIGN_FAILED', message: err.message });
  }
});

app.post('/api/offices/unassign', requireAuth, (req: AuthenticatedRequest, res: Response) => {
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
    res.json({ success: true, voter });
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

app.post('/api/voters', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee member access required to register voters.' });
  }

  const { email, firstName, middleName, lastName, raNumber, role, department, phone } = req.body;
  if (!email || !firstName || !lastName || !raNumber) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'First name, last name, email, and RA number are required.' });
  }

  try {
    const newVoter = db.addVoter({
      email,
      firstName,
      middleName,
      lastName,
      raNumber,
      role,
      department,
      phone
    });

    auditLedger.recordEvent('VOTER_REGISTERED', {
      raNumber: req.voter.raNumber,
      name: `${req.voter.firstName} ${req.voter.lastName}`,
      role: req.voter.role
    }, {
      newVoterRA: newVoter.raNumber,
      newVoterEmail: newVoter.email,
      newVoterName: `${newVoter.firstName} ${newVoter.lastName}`
    });

    res.status(201).json(newVoter);
  } catch (err: any) {
    res.status(400).json({ error: 'REGISTRATION_FAILED', message: err.message });
  }
});

app.put('/api/voters/:id/accredit', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
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
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: 'ACCREDITATION_FAILED', message: err.message });
  }
});

app.delete('/api/voters/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee member access required to delete voters.' });
  }

  const voterId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const voter = db.getVoterById(voterId);
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
  res.json(db.getCommitteeAdmins());
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
    res.json({ success: true, voter: updated });
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
// AUTHENTICATION (RA Number Magic Link & Single Device)
// ----------------------------------------------------
app.post('/api/auth/request-magic-link', (req: Request, res: Response) => {
  const { raNumber } = req.body;
  if (!raNumber) {
    return res.status(400).json({ error: 'RA_REQUIRED', message: 'Please enter your RA Number.' });
  }

  // GATE: The email bound to the RA Number is looked up. Unknown RA -> Access Denied.
  const voter = db.getVoterByRA(String(raNumber).replace(/^RA-?/i, ''));
  if (!voter) {
    return res.status(404).json({
      error: 'VOTER_NOT_FOUND',
      message: `Access Denied. No voter found with RA Number ${raNumber.replace(/^RA-?/i, '')}. Please contact the Electoral Committee.`
    });
  }

  auditLedger.recordEvent('AUTH_MAGIC_LINK_REQUESTED', {
    raNumber: voter.raNumber,
    email: voter.email,
    name: `${voter.firstName} ${voter.lastName}`
  }, { ip: req.ip });

  // The client triggers Firebase's passwordless email with this bound address
  res.json({
    success: true,
    message: `A sign-in link has been dispatched to ${voter.email.replace(/(.{2})(.*)(?=@)/, '$1***')}.`,
    email: voter.email,
    voterName: `${voter.firstName} ${voter.lastName}`
  });
});

// Firebase passwordless email-link sign-in completion.
// Verifies the Firebase ID token, resolves the bound voter, then issues the exclusive session.
app.post('/api/auth/firebase-login', async (req: Request, res: Response) => {
  const { idToken, deviceInfo } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'TOKEN_REQUIRED', message: 'ID token is required.' });
  }

  try {
    // Validate the ID token against Firebase's identitytoolkit API using the web API key
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      }
    );

    const lookupData = await lookupRes.json();
    const firebaseUser = lookupData?.users?.[0];

    if (!lookupRes.ok || !firebaseUser) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'The sign-in link is invalid, expired, or was already used.'
      });
    }

    if (!firebaseUser.email) {
      return res.status(401).json({ error: 'NO_EMAIL', message: 'No email associated with this sign-in.' });
    }

    // Map back to the voter registered under that email
    const voter = db.getVoterByEmail(firebaseUser.email);
    if (!voter) {
      return res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'Access Denied. This email is not registered with the electoral roll.'
      });
    }

    const sessionToken = db.createExclusiveSession(voter, deviceInfo || req.headers['user-agent']);

    auditLedger.recordEvent('AUTH_LOGIN_SUCCESS', {
      raNumber: voter.raNumber,
      email: voter.email,
      name: `${voter.firstName} ${voter.lastName}`,
      role: voter.role
    }, {
      provider: 'firebase-email-link',
      deviceInfo: deviceInfo || req.headers['user-agent'],
      ip: req.ip,
      singleDeviceEnforced: true
    });

    res.json({
      success: true,
      sessionToken,
      voter: {
        id: voter.id,
        raNumber: voter.raNumber,
        email: voter.email,
        firstName: voter.firstName,
        middleName: voter.middleName,
        lastName: voter.lastName,
        role: voter.role,
        isAccredited: voter.isAccredited,
        department: voter.department,
        phone: voter.phone,
        avatar: voter.avatar
      }
    });
  } catch (err: any) {
    res.status(400).json({ error: 'VERIFICATION_FAILED', message: err.message });
  }
});

// Dev / testing shortcut: creates an exclusive session directly for an RA number.
// Powers the quick-login buttons in AdminPage without needing Firebase.
app.post('/api/auth/dev-login', (req: Request, res: Response) => {
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
    voter: {
      id: voter.id,
      raNumber: voter.raNumber,
      email: voter.email,
      firstName: voter.firstName,
      middleName: voter.middleName,
      lastName: voter.lastName,
      role: voter.role,
      isAccredited: voter.isAccredited,
      department: voter.department,
      phone: voter.phone,
      avatar: voter.avatar
    }
  });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json(req.voter);
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
  const candidateVoters = db.getCandidateVoters(cId);
  res.json(candidateVoters);
});

// ----------------------------------------------------
// SCREENING CRITERIA & SCREENING EVALUATION
// ----------------------------------------------------
app.get('/api/screening-criteria', (req: Request, res: Response) => {
  const officeId = req.query.officeId as string;
  res.json(db.getScreeningCriteria(officeId));
});

app.post('/api/screening-criteria', requireAuth, (req: AuthenticatedRequest, res: Response) => {
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

app.delete('/api/screening-criteria/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.voter?.role !== 'superadmin' && req.voter?.role !== 'committee') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Committee access required.' });
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = db.deleteScreeningCriteria(id);
  res.json({ success: deleted });
});

app.post('/api/candidates/:id/screen', requireAuth, (req: AuthenticatedRequest, res: Response) => {
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

app.post('/api/agents', requireAuth, (req: AuthenticatedRequest, res: Response) => {
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

app.delete('/api/agents/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
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

app.post('/api/observers', requireAuth, (req: AuthenticatedRequest, res: Response) => {
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

app.post('/api/observers/:id/regenerate-link', requireAuth, (req: AuthenticatedRequest, res: Response) => {
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

app.delete('/api/observers/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
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
// PRODUCTION: Serve the built React frontend
// ----------------------------------------------------
// Static assets (JS/CSS/images) from the Vite build
app.use(express.static(FRONTEND_DIR));

// SPA fallback: any non-API GET route (e.g. /login for the Firebase email link) serves index.html
app.get(/^\/(?!api|ws).*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`FatBallot Server active on port ${PORT}`);
});
