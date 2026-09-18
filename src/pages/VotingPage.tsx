import React, { useState, useEffect } from 'react';
import {
  Check,
  X as XIcon,
  Eye,
  Vote as VoteIcon,
  BarChart3,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  Crown,
  Shield,
  FileText,
  Coins,
  Megaphone,
  Radio,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useElection } from '../context/ElectionContext';
import { useAuth } from '../context/AuthContext';
import { CountdownTimer } from '../components/common/CountdownTimer';
import { CandidateModal } from '../components/common/CandidateModal';
import { Candidate, VoteChoice } from '../types';

const iconMap: Record<string, React.ComponentType<any>> = {
  Crown,
  Shield,
  FileText,
  Coins,
  Sparkles,
  Megaphone
};

export const VotingPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const {
    offices,
    candidates,
    myVotes,
    castVote,
    liveResults,
    isElectionActive,
    hasElectionStarted,
    hasElectionEnded
  } = useElection();
  const { user } = useAuth();

  const [activeOfficeId, setActiveOfficeId] = useState<string>('');
  const [selectedCandidateForModal, setSelectedCandidateForModal] = useState<Candidate | null>(null);
  const [submittingVote, setSubmittingVote] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<{ message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'ballot' | 'liveMonitor'>('ballot');

  useEffect(() => {
    if (offices.length > 0 && !activeOfficeId) {
      setActiveOfficeId(offices[0].id);
    }
  }, [offices, activeOfficeId]);

  const activeOffice = offices.find((o) => o.id === activeOfficeId) || offices[0];
  const activeCandidates = candidates.filter((c) => c.office_id === activeOffice?.id);
  const isSingleCandidate = activeCandidates.length === 1;

  const currentVote = myVotes.find((v) => v.office_id === activeOffice?.id);

  const handleVoteSubmit = async (choice: VoteChoice, candidateId: string) => {
    if (!user) {
      onNavigate('login');
      return;
    }

    if (!isElectionActive) {
      alert(hasElectionEnded ? 'Election has concluded. No further votes accepted.' : 'Election has not commenced yet.');
      return;
    }

    setSubmittingVote(true);
    const res = await castVote(activeOffice.id, choice, candidateId);
    setSubmittingVote(false);

    if (res.success) {
      try {
        confetti({ particleCount: 60, spread: 55, origin: { y: 0.8 } });
      } catch (e) {
        // ignore confetti errors
      }
      setSaveFeedback({
        message: currentVote ? 'Ballot updated & saved securely!' : 'Vote cast & saved securely!'
      });
      setTimeout(() => setSaveFeedback(null), 3500);
    } else {
      alert(res.message || 'Failed to submit vote');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-[#080C15]">
      {/* Top Banner / Tab Navigation & Countdown */}
      <div className="border-b border-gray-200 dark:border-[#1E2E4E] bg-white/90 dark:bg-[#0B132B]/90 backdrop-blur-md px-4 py-2.5 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="flex bg-gray-100 dark:bg-[#16223B] p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('ballot')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'ballot'
                  ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
              }`}
            >
              <VoteIcon className="w-3.5 h-3.5" />
              <span>Ballot Chamber</span>
            </button>

            <button
              onClick={() => setActiveTab('liveMonitor')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'liveMonitor'
                  ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Live Voting Dashboard</span>
              {hasElectionStarted && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
            </button>
          </div>

          {saveFeedback && (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-medium border border-emerald-300 dark:border-emerald-800 animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{saveFeedback.message}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <CountdownTimer compact />
          {!user && (
            <button
              onClick={() => onNavigate('login')}
              className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              Sign In to Vote
            </button>
          )}
        </div>
      </div>

      {activeTab === 'ballot' ? (
        <div className="flex flex-1 h-full overflow-hidden">
          {/* 10% Left Side: positions navigation */}
          <aside
            className="w-[10%] min-w-[85px] max-w-[130px] h-full overflow-y-auto bg-white dark:bg-[#0B132B] border-r border-gray-200 dark:border-[#1E2E4E] py-4 px-2 flex flex-col items-center space-y-4 shrink-0 transition-colors select-none shadow-xs"
            aria-label="Positions selection navigation"
          >
            <div className="text-[9px] uppercase tracking-wider font-extrabold text-gray-400 dark:text-slate-400 text-center">
              Positions
            </div>

            <div className="w-full space-y-3">
              {offices.map((office) => {
                const isSelected = office.id === activeOffice?.id;
                const hasVotedForThis = myVotes.some((v) => v.office_id === office.id);
                const IconComp = iconMap[office.icon] || Crown;

                return (
                  <button
                    key={office.id}
                    onClick={() => setActiveOfficeId(office.id)}
                    title={office.title}
                    className={`w-full flex flex-col items-center p-2 rounded-xl text-center transition-all group focus:outline-none ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-[#16223B] ring-2 ring-blue-500 shadow-xs'
                        : 'hover:bg-gray-100 dark:hover:bg-[#121C30]'
                    }`}
                  >
                    <div className="relative">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-md scale-105'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 group-hover:text-blue-600'
                        }`}
                      >
                        <IconComp className="w-5 h-5" />
                      </div>

                      {hasVotedForThis && (
                        <div
                          className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-sm ring-1 ring-white dark:ring-[#0B132B]"
                          title="Voted"
                        >
                          ✓
                        </div>
                      )}
                    </div>

                    <span className={`text-[10px] mt-1.5 font-semibold leading-tight line-clamp-2 ${
                      isSelected ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-600 dark:text-slate-400'
                    }`}>
                      {office.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* 90% Right Side: ballots */}
          <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 space-y-6">
            <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  <VoteIcon className="w-4 h-4" />
                  <span>Contested Portfolio • Official Ballot</span>
                </div>
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">
                  {activeOffice?.title}
                </h1>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">
                  {activeOffice?.description}
                </p>
              </div>

              <div className="flex flex-col items-start sm:items-end text-xs text-gray-500 dark:text-slate-400 space-y-1">
                <div className="flex items-center space-x-1.5 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Ballots saved securely to the database</span>
                </div>
                <span className="italic text-gray-400">
                  You can change your vote anytime before voting closes
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {activeCandidates.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-2xl">
                  <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No candidates currently registered for this position.</p>
                </div>
              ) : isSingleCandidate ? (
                (() => {
                  const candidate = activeCandidates[0];
                  const isVotedFor = currentVote?.choice === 'for';
                  const isVotedAgainst = currentVote?.choice === 'against';

                  let cardStyle = 'bg-white dark:bg-[#0F172A] border-gray-200 dark:border-[#1E2E4E]';
                  if (isVotedFor) cardStyle = 'voted-material-green border-2';
                  if (isVotedAgainst) cardStyle = 'unvoted-material-red border-2';

                  return (
                    <div key={candidate.id} className={`rounded-3xl p-6 md:p-8 transition-all duration-300 shadow-sm border ${cardStyle}`}>
                      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                        <div className="flex items-start md:items-center space-x-5">
                          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black flex items-center justify-center text-3xl shrink-0 shadow-md ring-4 ring-white/50 dark:ring-slate-700/50 overflow-hidden">
                            {candidate.avatar ? (
                              <img src={candidate.avatar} alt={candidate.full_name} className="w-full h-full object-cover" />
                            ) : (
                              candidate.full_name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-2.5">
                              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {candidate.full_name}
                              </h2>
                              <button
                                onClick={() => setSelectedCandidateForModal(candidate)}
                                className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                title="View candidate profile summary"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>

                            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                              {activeOffice?.title} (Unopposed Candidate)
                            </p>

                            <p className="text-xs text-gray-600 dark:text-slate-300 italic max-w-xl">
                              "{candidate.tagline}"
                            </p>

                            <div className="flex items-center space-x-2 text-xs font-mono text-gray-400">
                              <span>RA-{candidate.ra_number}</span>
                              <span>•</span>
                              <span>Affirmation Referendum</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
                          <button
                            onClick={() => handleVoteSubmit('for', candidate.id)}
                            disabled={submittingVote || !isElectionActive}
                            className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-md ${
                              isVotedFor
                                ? 'bg-emerald-600 text-white ring-4 ring-emerald-300 dark:ring-emerald-800 shadow-emerald-500/30'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            }`}
                          >
                            <Check className="w-4 h-4" />
                            <span>{isVotedFor ? 'Voted FOR ✓' : 'Vote FOR'}</span>
                          </button>

                          <button
                            onClick={() => handleVoteSubmit('against', candidate.id)}
                            disabled={submittingVote || !isElectionActive}
                            className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-md ${
                              isVotedAgainst
                                ? 'bg-red-600 text-white ring-4 ring-red-300 dark:ring-red-800 shadow-red-500/30'
                                : 'bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-300 dark:border-red-800'
                            }`}
                          >
                            <XIcon className="w-4 h-4" />
                            <span>{isVotedAgainst ? 'Voted AGAINST ✗' : 'Vote AGAINST'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                activeCandidates.map((candidate) => {
                  const isVotedThisCandidate = currentVote?.candidate_id === candidate.id && currentVote?.choice === 'candidate';
                  const hasVotedSomeoneElse = Boolean(currentVote && currentVote.choice === 'candidate' && currentVote.candidate_id !== candidate.id);

                  let cardStyle = 'bg-white dark:bg-[#0F172A] border-gray-200 dark:border-[#1E2E4E]';
                  if (isVotedThisCandidate) cardStyle = 'voted-material-green border-2';
                  else if (hasVotedSomeoneElse) cardStyle = 'unvoted-material-red border-2';

                  return (
                    <div key={candidate.id} className={`rounded-3xl p-5 md:p-6 transition-all duration-300 shadow-sm border ${cardStyle}`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black flex items-center justify-center text-xl shrink-0 shadow-sm ring-2 ring-white/60 dark:ring-slate-700 overflow-hidden">
                            {candidate.avatar ? (
                              <img src={candidate.avatar} alt={candidate.full_name} className="w-full h-full object-cover" />
                            ) : (
                              candidate.full_name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">
                                {candidate.full_name}
                              </h3>
                              <button
                                onClick={() => setSelectedCandidateForModal(candidate)}
                                className="p-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-800 transition-colors"
                                title="View candidate profile summary"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>

                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                              {activeOffice?.title}
                            </p>

                            <p className="text-xs text-gray-500 dark:text-slate-300 italic line-clamp-1 max-w-lg">
                              "{candidate.tagline}"
                            </p>

                            <p className="text-[11px] font-mono text-gray-400">RA-{candidate.ra_number}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                          <button
                            onClick={() => handleVoteSubmit('candidate', candidate.id)}
                            disabled={submittingVote || !isElectionActive}
                            className={`w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all shadow-sm ${
                              isVotedThisCandidate
                                ? 'bg-emerald-600 text-white ring-4 ring-emerald-300 dark:ring-emerald-800 shadow-emerald-500/20'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            <VoteIcon className="w-4 h-4" />
                            <span>{isVotedThisCandidate ? 'Selected Choice ✓' : 'Vote for Candidate'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </main>
        </div>
      ) : (
        /* Live Monitor Tab */
        <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-[#1E2E4E] pb-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold uppercase text-red-500 tracking-wider">
                <Radio className="w-4 h-4 animate-pulse" />
                <span>Live Real-time Collation Monitor</span>
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white mt-1">
                Election Tally & Progress Tracker
              </h2>
            </div>
            <CountdownTimer compact />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveResults.map((off) => (
              <div key={off.officeId} className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1E2E4E] pb-3">
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">{off.officeTitle}</h3>
                  <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 font-mono text-xs font-black">
                    <span>{off.totalVotes}</span>
                    <span className="text-[10px] font-normal text-gray-400">total votes</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {off.isSingleCandidate ? (
                    off.candidates.map((cand) => {
                      const forPct = off.totalVotes > 0 ? Math.round((cand.forCount / off.totalVotes) * 100) : 0;
                      const againstPct = off.totalVotes > 0 ? Math.round((cand.againstCount / off.totalVotes) * 100) : 0;

                      return (
                        <div key={cand.candidateId} className="space-y-3">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-[10px] flex items-center justify-center overflow-hidden">
                              {cand.avatar ? (
                                <img src={cand.avatar} alt={cand.candidateName} className="w-full h-full object-cover" />
                              ) : (
                                cand.candidateName.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
                              )}
                            </div>
                            <div className="text-xs font-bold text-gray-900 dark:text-white">{cand.candidateName}</div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">FOR</span>
                              <div className="space-x-2 text-gray-600 dark:text-slate-300">
                                <span className="font-bold text-emerald-600">{forPct}%</span>
                                <span>#{cand.forCount}</span>
                              </div>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${forPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="text-red-600 dark:text-red-400 font-semibold">AGAINST</span>
                              <div className="space-x-2 text-gray-600 dark:text-slate-300">
                                <span className="font-bold text-red-600">{againstPct}%</span>
                                <span>#{cand.againstCount}</span>
                              </div>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-500 rounded-full transition-all duration-500"
                                style={{ width: `${againstPct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    off.candidates.map((cand) => (
                      <div key={cand.candidateId} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-800 dark:text-gray-200 truncate pr-2">
                            {cand.candidateName}
                          </span>
                          <div className="flex items-center space-x-2 font-mono text-gray-600 dark:text-slate-300 shrink-0">
                            <span className="font-bold text-blue-600 dark:text-blue-400">{cand.percentage}%</span>
                            <span className="text-gray-400">#{cand.count}</span>
                          </div>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
                            style={{ width: `${cand.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}

            {liveResults.length === 0 && (
              <div className="col-span-full py-10 text-center text-sm text-gray-400 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl">
                No offices have been published yet by the committee.
              </div>
            )}
          </div>
        </main>
      )}

      {selectedCandidateForModal && (
        <CandidateModal
          candidate={selectedCandidateForModal}
          office={offices.find((o) => o.id === selectedCandidateForModal.office_id)}
          onClose={() => setSelectedCandidateForModal(null)}
          onVote={() => handleVoteSubmit('candidate', selectedCandidateForModal.id)}
          isVoted={currentVote?.candidate_id === selectedCandidateForModal.id}
        />
      )}
    </div>
  );
};