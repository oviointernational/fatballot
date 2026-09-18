/**
 * Relational database smoke test for FatBallot.
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server key) in the
 * environment and supabase/schema.sql applied on a FRESH project. Exercises
 * every Database + AuditLedger method end to end on an isolated RA series
 * (9000-range) and then removes all test rows, leaving seed data intact.
 *
 * Usage:
 *   $env:SUPABASE_URL="https://xyz.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="<service_role key>"
 *   npm run verify:db
 */
import 'dotenv/config';
import { db } from '../server/database';
import { auditLedger } from '../server/auditLedger';

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`ok   ${name}`);
  } else {
    failures++;
    console.log(`FAIL ${name}${extra !== undefined ? ' :: ' + JSON.stringify(extra) : ''}`);
  }
}

async function main() {
  await db.init();
  await auditLedger.init();
  console.log('connected + superadmin ensured');

  // --- settings ---
  const settings = await db.getSettings();
  check('settings read', settings.siteName === 'FatBallot');
  const updated = await db.updateSettings({ siteName: 'FatBallot' });
  check('settings update', updated.siteName === 'FatBallot');

  // --- offices ---
  const offices = await db.getOffices();
  check('seed offices', offices.length === 6, offices.length);
  const testOffice = await db.addOffice({ title: 'Verify Office', description: 'tmp', order: 90, icon: 'Star' });
  check('office create', !!testOffice.id);
  check('office read', (await db.getOfficeById(testOffice.id))?.title === 'Verify Office');

  // --- voters + passwords ---
  const v1 = await db.addVoter({ email: 'verify1@test.local', firstName: 'Verify', lastName: 'One', raNumber: '9001', department: 'QA', phone: '1' });
  check('voter create unaccredited', v1.isAccredited === false);
  await db.setVoterPassword(v1.id, 'verify-pass-1');
  const withHash = await db.getVoterById(v1.id);
  check('password verifies', !!withHash?.passwordHash && db.verifyPassword(withHash.passwordHash, 'verify-pass-1'));
  check('password rejects wrong', !db.verifyPassword(withHash!.passwordHash!, 'wrong-pass'));
  check('publicVoter strips hash', !('passwordHash' in db.publicVoter(withHash!)));
  const v2 = await db.addVoter({ email: 'verify2@test.local', firstName: 'Verify', lastName: 'Two', raNumber: '9002' });
  await db.setVoterPassword(v2.id, 'verify-pass-2');
  let dup = false;
  try {
    await db.addVoter({ email: 'verify1@test.local', firstName: 'D', lastName: 'U', raNumber: '9003' });
  } catch { dup = true; }
  check('duplicate email rejected', dup);
  check('getVoterByRA', (await db.getVoterByRA('RA-9001'))?.id === v1.id);
  check('getVoterByEmail ci', (await db.getVoterByEmail('VERIFY2@TEST.LOCAL'))?.id === v2.id);
  check('accredit', (await db.accreditVoter(v2.id, true)).isAccredited === true);

  // --- committee admins + permissions plumbing ---
  await db.addCommitteeAdmins([v2.id]);
  check('committee promote', (await db.getVoterById(v2.id))?.role === 'committee');
  check('committee list', (await db.getCommitteeAdmins()).some(v => v.id === v2.id));
  await db.removeCommitteeAdmin(v2.id);
  check('committee demote', (await db.getVoterById(v2.id))?.role === 'voter');

  // --- offices assign + candidates + screening ---
  const assigned = await db.assignOffice(v2.id, testOffice.id);
  check('assign makes contestant', assigned.voter.role === 'contestant' && !!assigned.candidate.id);
  const crit = await db.saveScreeningCriteria(testOffice.id, 'Verify Bench', ['rule-a', 'rule-b']);
  check('criteria save', crit.criteria.length === 2);
  check('criteria list', (await db.getScreeningCriteria(testOffice.id)).length >= 1);
  const screening = await db.screenCandidate(assigned.candidate.id, testOffice.id, [
    { criterion: 'rule-a', passed: true },
    { criterion: 'rule-b', passed: true }
  ]);
  check('screening pass', screening.isScreened === true && screening.percentage === 100);
  check('screening read', (await db.getCandidateScreening(assigned.candidate.id))?.passedCount === 2);

  // --- votes ---
  const cast1 = await db.castVote('9002', testOffice.id, 'for', assigned.candidate.id, '127.0.0.1');
  check('vote cast', cast1.isChange === false);
  const cast2 = await db.castVote('9002', testOffice.id, 'against', assigned.candidate.id);
  check('vote change', cast2.isChange === true);
  check('my votes', (await db.getVotesByVoter('9002')).length === 1);
  const live = await db.getLiveResults();
  const liveOffice = live.find(o => o.officeId === testOffice.id);
  check('live results single-candidate against', liveOffice?.totalVotes === 1 && (liveOffice?.candidates[0]?.againstCount ?? -1) === 1);
  check('candidate voters empty on against', (await db.getCandidateVoters(assigned.candidate.id)).length === 0);

  // --- agents ---
  const agent = await db.addAgent(v1.id, testOffice.id, assigned.candidate.id);
  check('agent assign', !!agent.id);
  check('agents list', (await db.getAgents()).some(a => a.id === agent.id));
  check('agent delete', await db.deleteAgent(agent.id));

  // --- observers ---
  const obs = await db.addObserver('Verify Observer', 'Monitor', 'HQ', '+100000');
  check('observer create', !!obs.token);
  const verified = await db.verifyObserverToken(obs.token, 'device-a');
  check('observer verify binds device', verified.lastActiveDeviceId === 'device-a');
  const regen = await db.regenerateObserverToken(obs.id);
  check('observer regenerate', regen.token !== obs.token);
  check('observer delete', await db.deleteObserver(obs.id));

  // --- timeline ---
  const item = await db.addTimelineItem({ title: 'Verify Step', description: 'tmp', date: 'Today', status: 'active', icon: 'Clock', order: 77 });
  check('timeline create', !!item.id);
  check('timeline update', (await db.updateTimelineItem(item.id, { status: 'completed' }))?.status === 'completed');
  check('timeline delete', await db.deleteTimelineItem(item.id));
  check('timeline seeds intact', (await db.getTimeline()).length === 6);
  check('ycec seeds intact', (await db.getYCEC()).length === 5);

  // --- sessions (single device, 7 days) ---
  const t1 = await db.createExclusiveSession((await db.getVoterById(v1.id))!, 'device-1');
  const t2 = await db.createExclusiveSession((await db.getVoterById(v1.id))!, 'device-2');
  check('single device kills old', (await db.getSession(t1)) === undefined);
  const s2 = await db.getSession(t2);
  const lifetimeDays = s2 ? (new Date(s2.expiresAt).getTime() - new Date(s2.createdAt).getTime()) / 86400000 : -1;
  check('7-day session', Math.abs(lifetimeDays - 7) < 0.01, lifetimeDays);
  await db.revokeSession(t2);
  check('revoke', (await db.getSession(t2)) === undefined);

  // --- audit ledger ---
  auditLedger.recordEvent('VERIFY_PROBE', { raNumber: '9001', name: 'Verify One', role: 'voter' }, { note: 'db verify' });
  await new Promise(r => setTimeout(r, 1500));
  const chain = await auditLedger.getChain();
  check('chain grows', chain.length >= 2, chain.length);
  check('chain verifies', (await auditLedger.verifyIntegrity()).valid === true);
  check('user logs', (await auditLedger.getUserLogs('9001')).length >= 1);
  check('contestant logs query', Array.isArray(await auditLedger.getContestantLogs(assigned.candidate.id, '9002')));

  // --- cleanup test rows ---
  await db.unassignOffice(v2.id);
  await db.deleteVoter(v1.id);
  await db.deleteVoter(v2.id);
  await db.deleteOffice(testOffice.id);
  await db.deleteScreeningCriteria(crit.id);
  const votersLeft = await db.getVoters();
  check('test voters removed', !votersLeft.some(v => v.raNumber === '9001' || v.raNumber === '9002'));
  check('offices back to seed', (await db.getOffices()).length === 6);

  console.log(failures === 0 ? 'VERIFY-DB: ALL PASS' : `VERIFY-DB: ${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('VERIFY-DB ERROR:', err?.message || err);
  process.exit(1);
});
