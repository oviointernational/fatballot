import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Hash, 
  Shield, 
  CheckCircle2, 
  Download, 
  Clock, 
  Users, 
  Vote, 
  FileText, 
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';
import { exportMyVotesPdf, exportCandidateVotersPdf } from '../utils/pdfGenerator';
import { AuditBlock, CastVote, Voter } from '../types';

function formatEventTitle(block: AuditBlock): string {
  switch (block.eventType) {
    case "VOTE_CAST":
      return "Ballot: Status → Cast";
    case "VOTE_CHANGED":
      return "Ballot: Status → Updated";
    case "VOTER_ACCREDITED":
      return "Accreditation: Status → Verified";
    case "VOTER_UNACCREDITED":
      return "Accreditation: Status → Pending";
    case "VOTER_REGISTERED":
      return "Registration: Status → Enrolled";
    case "VOTER_UPDATED":
      return "Registration: Status → Details Updated";
    case "VOTER_DELETED":
      return "Registration: Status → Removed";
    case "OFFICE_ASSIGNED":
      return "Office: Status → Contestant Assigned";
    case "OFFICE_UNASSIGNED":
      return "Office: Status → Unassigned";
    case "CANDIDATE_SCREENED_PASS":
      return "Screening: Status → Passed";
    case "CANDIDATE_SCREENED_FAIL":
      return "Screening: Status → Pending";
    case "CANDIDATE_REGISTERED":
      return "Candidacy: Status → Registered";
    case "AGENT_ASSIGNED":
      return "Agent: Status → Commissioned";
    case "OBSERVER_CREATED":
      return "Observer: Status → Pass Issued";
    case "OBSERVER_TOKEN_REGENERATED":
      return "Observer: Status → Token Regenerated";
    case "SETTINGS_UPDATED":
      return "Governance: Status → Settings Updated";
    case "OFFICE_CREATED":
      return "Office: Status → Created";
    case "OFFICE_DELETED":
      return "Office: Status → Removed";
    case "COMMITTEE_ADMINS_APPOINTED":
      return "Committee: Status → Admins Appointed";
    case "COMMITTEE_ADMIN_REMOVED":
      return "Committee: Status → Admin Removed";
    case "PDF_EXPORTED":
      return "Export: Status → PDF Generated";
    case "AUTH_ACTIVATION_REQUESTED":
      return "Sign-In: Status → Account Activated";
    case "PASSWORD_CHANGED":
      return "Security: Status → Password Changed";
    case "PASSWORD_RESET":
      return "Security: Status → Password Reset by Committee";
    case "AUTH_LOGIN_SUCCESS":
      return "Sign-In: Status → Authenticated";
    case "AUTH_LOGOUT":
      return "Sign-In: Status → Logged Out";
    case "GENESIS_BLOCK":
      return "Ledger: Status → Genesis Initialized";
    case "SUPERADMIN_SETUP":
      return "Governance: Status → Superadmin Claimed";
    default:
      return `${block.eventType}: Status → Recorded`;
  }
}

function formatOptionalDetail(block: AuditBlock): string | null {
  if (block.details?.officeTitle) {
    return `Office: ${block.details.officeTitle}${block.details?.candidateName ? ` · Contestant: ${block.details.candidateName}` : ""}`;
  }
  if (block.details?.candidateName) {
    return `Contestant: ${block.details.candidateName}`;
  }
  if (block.details?.voterName) {
    return `Voter: ${block.details.voterName}${block.details?.voterRA ? ` (RA-${block.details.voterRA})` : ""}`;
  }
  if (block.details?.newVoterName) {
    return `New Voter: ${block.details.newVoterName}${block.details?.newVoterRA ? ` (RA-${block.details.newVoterRA})` : ""}`;
  }
  if (block.details?.note) {
    return String(block.details.note);
  }
  if (block.details?.raNumber) {
    return `Electoral RA: RA-${block.details.raNumber}`;
  }
  if (block.details?.ip) {
    return `IP: ${block.details.ip}`;
  }
  return null;
}

export const ProfilePage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { user, sessionToken, changePassword } = useAuth();
  const { offices, candidates, myVotes, settings } = useElection();

  const [myLogs, setMyLogs] = useState<AuditBlock[]>([]);
  const [candidateVoters, setCandidateVoters] = useState<{ voter: Voter; timestamp: string }[]>([]);
  const [candidateVotersError, setCandidateVotersError] = useState<string | null>(null);
  const [exportingMyVotes, setExportingMyVotes] = useState(false);
  const [exportingCandidateVoters, setExportingCandidateVoters] = useState(false);
  const [expandedLogIndex, setExpandedLogIndex] = useState<number | null>(null);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [changingPw, setChangingPw] = useState(false);

  // If user is a contestant, find their candidate profile
  const myCandidateProfile = candidates.find(c => c.raNumber === user?.raNumber);

  useEffect(() => {
    if (!sessionToken || !user) return;

    // Fetch user's personal audit log
    fetch('/api/audit-log/my', {
      headers: { 'x-session-token': sessionToken }
    })
      .then(res => res.json())
      .then(setMyLogs)
      .catch(console.error);

    // If contestant, fetch their voters
    if (myCandidateProfile) {
      fetch(`/api/votes/candidate-voters/${myCandidateProfile.id}`, {
        headers: { 'x-session-token': sessionToken }
      })
        .then(async res => {
          if (res.ok) {
            const data = await res.json();
            setCandidateVoters(data);
          } else {
            const err = await res.json();
            setCandidateVotersError(err.message || 'Permission denied');
          }
        })
        .catch(err => setCandidateVotersError('Unable to load voters list'));
    }
  }, [sessionToken, user, myCandidateProfile]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl text-center shadow-lg space-y-4">
        <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sign In to View Voter Profile</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Sign in with your RA Number and emailed code to inspect your ballot record, accreditation credentials, and security ledger.
        </p>
        <button
          onClick={() => onNavigate('login')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all inline-flex items-center space-x-2"
        >
          <span>Sign In with Email</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match.');
      return;
    }
    setChangingPw(true);
    const res = await changePassword(currentPw, newPw);
    setChangingPw(false);
    if (!res.success) {
      setPwError(res.message);
    } else {
      setPwSuccess(res.message);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    }
  };

  const handleExportMyVotes = async () => {
    if (!user) return;
    setExportingMyVotes(true);
    try {
      await exportMyVotesPdf(myVotes, offices, candidates, user, sessionToken);
    } catch (e) {
      console.error(e);
    } finally {
      setExportingMyVotes(false);
    }
  };

  const handleExportCandidateVoters = async () => {
    if (!myCandidateProfile) return;
    setExportingCandidateVoters(true);
    try {
      await exportCandidateVotersPdf(myCandidateProfile, candidateVoters, sessionToken);
    } catch (e) {
      console.error(e);
    } finally {
      setExportingCandidateVoters(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* 1. Voter Details Profile Card */}
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="relative">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.firstName}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-blue-500/20 shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-md">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
              )}
              {user.isAccredited && (
                <div
                  className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs shadow-sm ring-2 ring-white dark:ring-[#0F172A]"
                  title="Accredited Voter"
                >
                  ✓
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                  {user.firstName} {user.middleName ? user.middleName + ' ' : ''}{user.lastName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  RA-{user.raNumber}
                </span>
              </div>

              <p className="text-sm text-gray-500 dark:text-slate-400">
                {user.email} • {user.department || 'General Constituent'}
              </p>

              <div className="flex items-center space-x-3 pt-1 text-xs">
                <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Accreditation: {user.isAccredited ? 'Verified & Active' : 'Pending'}</span>
                </span>
                <span className="text-gray-300 dark:text-slate-600">|</span>
                <span className="font-mono text-gray-500 capitalize">
                  Role: {user.role}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end text-xs text-gray-500 dark:text-slate-400 space-y-2">
            <div className="p-3 bg-gray-50 dark:bg-[#16223B] border border-gray-200 dark:border-[#1E2E4E] rounded-2xl flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <span>Single active session enforced</span>
            </div>
            <span className="text-[11px] font-mono text-gray-400">
              Registered: {new Date(user.registeredAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Account Security: Change Password */}
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
        <div className="border-b border-gray-100 dark:border-[#1E2E4E] pb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span>Account Security</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Change the password you use with RA-{user.raNumber} to sign in
          </p>
        </div>

        {pwError && (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-900/50 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pwError}</span>
          </div>
        )}
        {pwSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900/50 text-xs font-semibold">
            {pwSuccess}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-300">Current Password</label>
            <input
              type="password"
              required
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-300">New Password (min. 6)</label>
            <input
              type="password"
              required
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-300">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white outline-none"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={changingPw}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-60"
            >
              {changingPw ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      </section>

      {/* 3. "Who You Voted For" [List can be exported as PDF] */}
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-[#1E2E4E] pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Vote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>My Cast Ballots (Who You Voted For)</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Verified record of candidates and referendums you selected
            </p>
          </div>

          {myVotes.length > 0 && (
            <button
              onClick={handleExportMyVotes}
              disabled={exportingMyVotes}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center space-x-2 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Export Ballot Receipt (PDF)</span>
            </button>
          )}
        </div>

        {myVotes.length === 0 ? (
          <div className="py-8 text-center text-gray-500 dark:text-slate-400 text-sm">
            <p>You have not cast any votes yet.</p>
            <button
              onClick={() => onNavigate('vote')}
              className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Proceed to Vote Portal
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-400 uppercase bg-gray-50 dark:bg-[#16223B]/60 rounded-xl">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Office / Position</th>
                  <th className="py-3 px-4">Your Selection</th>
                  <th className="py-3 px-4">Cast Timestamp</th>
                  <th className="py-3 px-4 rounded-r-xl">Cryptographic Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#1E2E4E]">
                {myVotes.map((vote) => {
                  const office = offices.find(o => o.id === vote.officeId);
                  const cand = candidates.find(c => c.id === vote.candidateId);

                  let choiceBadge = (
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {cand?.name || 'Selected Candidate'}
                    </span>
                  );

                  if (vote.choice === 'for') {
                    choiceBadge = (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                        <span>VOTED FOR:</span>
                        <span>{cand?.name}</span>
                      </span>
                    );
                  } else if (vote.choice === 'against') {
                    choiceBadge = (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 font-bold text-xs">
                        <span>VOTED AGAINST:</span>
                        <span>{cand?.name}</span>
                      </span>
                    );
                  }

                  return (
                    <tr key={vote.id} className="hover:bg-gray-50 dark:hover:bg-[#16223B]/30 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                        {office?.title || 'Contested Office'}
                      </td>
                      <td className="py-3.5 px-4">{choiceBadge}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-500 dark:text-slate-400">
                        {new Date(vote.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center space-x-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Recorded on Ledger</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. Contestant Specific Section: "Those That Voted For You" [PDF exportable] */}
      {myCandidateProfile && (
        <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-[#1E2E4E] pb-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                <Users className="w-4 h-4" />
                <span>Candidate Transparency Backers</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                Voters Who Cast Ballots for You ({myCandidateProfile.name})
              </h2>
            </div>

            {settings.contestantsCanViewVoters && candidateVoters.length > 0 && (
              <button
                onClick={handleExportCandidateVoters}
                disabled={exportingCandidateVoters}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center space-x-2 shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Export Backers List (PDF)</span>
              </button>
            )}
          </div>

          {!settings.contestantsCanViewVoters ? (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>
                Voter disclosure is currently disabled by the Electoral Committee. Once authorized by Superadmin in settings, backer transparency lists will appear here.
              </span>
            </div>
          ) : candidateVoters.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">
              No votes recorded for your candidacy yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-gray-400 uppercase bg-gray-50 dark:bg-[#16223B]/60 rounded-xl">
                  <tr>
                    <th className="py-3 px-4 rounded-l-xl">Voter RA Number</th>
                    <th className="py-3 px-4">Voter Name</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 rounded-r-xl">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1E2E4E]">
                  {candidateVoters.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-[#16223B]/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        RA-{item.voter.raNumber}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                        {item.voter.firstName} {item.voter.middleName ? item.voter.middleName + ' ' : ''}{item.voter.lastName}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500 dark:text-slate-400">
                        {item.voter.department || 'N/A'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-500">
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 5. Immutable User Security & Activity Log */}
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1E2E4E] pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Personal Security & Activity Ledger</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Cryptographically signed actions attributed to your RA credentials
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Chained Audit Verified</span>
          </span>
        </div>

        {myLogs.length === 0 ? (
          <div className="py-4 text-center text-xs text-gray-400">
            No logged activity recorded for this session yet.
          </div>
        ) : (
          <div className="space-y-0">
            {myLogs
              .slice()
              .reverse()
              .map((log) => {
                const isExpanded = expandedLogIndex === log.index;
                const formattedDate = new Date(log.timestamp).toLocaleString("en-US", {
                  year: "numeric",
                  month: "numeric",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true
                });
                const actorName = log.actor?.name || (log.actor?.role ? `System [${log.actor.role}]` : "System");

                return (
                  <div
                    key={log.index}
                    className="border-b border-gray-100 dark:border-[#1E2E4E] last:border-b-0 transition-colors"
                  >
                    {/* Single Row Item */}
                    <div
                      onClick={() => setExpandedLogIndex(isExpanded ? null : log.index)}
                      className="px-4 py-3.5 hover:bg-gray-50/70 dark:hover:bg-[#16223B]/50 transition-colors cursor-pointer flex items-start space-x-3.5"
                    >
                      {/* Teal dot indicator */}
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500 dark:bg-teal-400 shrink-0 mt-1.5" />

                      {/* Content Block */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                            {formatEventTitle(log)}
                          </p>
                          <span className="text-[11px] font-mono text-gray-400 shrink-0">
                            {isExpanded ? "▲ Hide JSON" : "▼ Inspect JSON"}
                          </span>
                        </div>

                        {/* Subtitle: Date · Actor Name */}
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                          {formattedDate} · {actorName}
                          {log.actor?.raNumber && (
                            <span className="font-mono text-blue-600 dark:text-blue-400 ml-1">
                              (RA-{log.actor.raNumber})
                            </span>
                          )}
                        </p>

                        {/* Optional detail line */}
                        {formatOptionalDetail(log) && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 font-medium">
                            {formatOptionalDetail(log)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Expanded Code & JSON stuff revealed on click */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 bg-gray-50/80 dark:bg-[#121B2E] border-t border-gray-100 dark:border-[#1E2E4E] space-y-3 text-xs animate-fadeIn">
                        {/* Cryptographic SHA-256 Hashes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                          <div className="p-3 rounded-2xl bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] break-all">
                            <span className="text-gray-400 block mb-1 font-sans font-semibold text-[10px] uppercase tracking-wider">
                              Previous Block Hash
                            </span>
                            <span className="text-gray-700 dark:text-slate-300">{log.previousHash}</span>
                          </div>

                          <div className="p-3 rounded-2xl bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] break-all">
                            <span className="text-gray-400 block mb-1 font-sans font-semibold text-[10px] uppercase tracking-wider">
                              Current Block Hash (SHA-256)
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{log.hash}</span>
                          </div>
                        </div>

                        {/* Code / JSON Display */}
                        <div>
                          <div className="flex items-center justify-between pb-1.5 text-[11px] font-mono text-gray-400">
                            <span>Payload JSON — Block #{log.index}</span>
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-sans font-bold">
                              Cryptographically Signed
                            </span>
                          </div>
                          <pre className="p-4 rounded-2xl bg-gray-900 text-emerald-400 font-mono text-xs overflow-x-auto border border-gray-800 shadow-inner leading-relaxed">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
};
