import React, { useState } from 'react';
import {
  Briefcase,
  Users,
  UserCheck,
  UserSquare2,
  Vote as VoteIcon,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  Search,
  ChevronRight,
  Building2,
  Crown,
  Shield,
  FileText,
  Coins,
  Megaphone,
  Radio
} from 'lucide-react';
import { useElection } from '../context/ElectionContext';
import { useAuth } from '../context/AuthContext';
import { CountdownTimer } from '../components/common/CountdownTimer';
import { CandidateModal } from '../components/common/CandidateModal';

const iconMap: Record<string, React.ComponentType<any>> = {
  Crown,
  Shield,
  FileText,
  Coins,
  Sparkles,
  Megaphone
};

type RegistryType = 'offices' | 'contestants';

export const DashboardPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { settings, offices, candidates, liveResults, stats } = useElection();
  const { user } = useAuth();

  const [activeRegistry, setActiveRegistry] = useState<RegistryType | null>(null);
  const [registrySearch, setRegistrySearch] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

  const isCommittee = user?.role === 'admin' || user?.role === 'superadmin';

  const selectedCandidateObj = selectedCandidate ? candidates.find((c) => c.id === selectedCandidate) || null : null;

  if (activeRegistry) {
    const registryTitles: Record<RegistryType, string> = {
      offices: 'Contested Positions & Offices',
      contestants: 'Certified Contestant Directory'
    };

    const query = registrySearch.toLowerCase();
    const filteredOffices = offices.filter((o) =>
      o.title.toLowerCase().includes(query) || o.description.toLowerCase().includes(query)
    );
    const filteredContestants = candidates.filter((c) =>
      c.full_name.toLowerCase().includes(query) ||
      c.ra_number.toLowerCase().includes(query) ||
      c.tagline.toLowerCase().includes(query)
    );

    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-[#1E2E4E] pb-5">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveRegistry(null)}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-[#16223B] dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white">
                {registryTitles[activeRegistry]}
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Official electoral directory
              </p>
            </div>
          </div>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder={`Search ${registryTitles[activeRegistry]}...`}
            value={registrySearch}
            onChange={(e) => setRegistrySearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
        </div>

        {activeRegistry === 'contestants' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredContestants.map((candidate) => {
              const office = offices.find((o) => o.id === candidate.office_id);
              return (
                <div
                  key={candidate.id}
                  onClick={() => setSelectedCandidate(candidate.id)}
                  className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3.5">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-lg shadow-sm shrink-0 ring-2 ring-blue-500/20 overflow-hidden">
                        {candidate.avatar ? (
                          <img src={candidate.avatar} alt={candidate.full_name} className="w-full h-full object-cover" />
                        ) : (
                          candidate.full_name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">
                          {candidate.full_name}
                        </h4>
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                          {office?.title || 'Executive Office'}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-slate-400 italic line-clamp-2">
                      "{candidate.tagline}"
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#1E2E4E] flex items-center justify-between text-[11px]">
                    <span className="font-mono text-gray-400 font-bold">RA-{candidate.ra_number}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold group-hover:underline flex items-center gap-1">
                      <span>View Profile</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeRegistry === 'offices' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {filteredOffices.map((office) => {
              const count = candidates.filter((c) => c.office_id === office.id).length;
              const IconComp = iconMap[office.icon] || Crown;
              return (
                <div
                  key={office.id}
                  onClick={() => setActiveRegistry('contestants')}
                  className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-5 shadow-sm space-y-3 hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <IconComp className="w-5 h-5" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                      {count} {count === 1 ? 'Candidate' : 'Candidates'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-gray-900 dark:text-white">{office.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {office.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedCandidateObj && (
          <CandidateModal
            candidate={selectedCandidateObj}
            office={offices.find((o) => o.id === selectedCandidateObj.office_id)}
            onClose={() => setSelectedCandidate(null)}
            onVote={() => { setSelectedCandidate(null); onNavigate('vote'); }}
          />
        )}
      </div>
    );
  }

  const statCards = [
    {
      label: 'Registered Voters',
      value: stats?.registered_voters ?? 0,
      icon: Users,
      color: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400',
      onClick: () => setActiveRegistry('contestants')
    },
    {
      label: 'Active Voters',
      value: stats?.active_voters ?? 0,
      icon: UserCheck,
      color: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',
      onClick: () => setActiveRegistry('contestants')
    },
    {
      label: 'Votes Cast',
      value: stats?.votes_count ?? 0,
      icon: VoteIcon,
      color: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
      onClick: () => onNavigate('vote')
    },
    {
      label: 'Offices',
      value: stats?.offices_count ?? offices.length,
      icon: Briefcase,
      color: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
      onClick: () => setActiveRegistry('offices')
    },
    {
      label: 'Contestants',
      value: stats?.candidates_count ?? candidates.length,
      icon: UserSquare2,
      color: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400',
      onClick: () => setActiveRegistry('contestants')
    }
  ];

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto">
      <CountdownTimer />

      {/* About Section */}
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm transition-all overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 justify-between">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Official Election Mandate</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {settings?.about_title || 'About the Election'}
            </h1>

            <p className="text-sm md:text-base text-gray-600 dark:text-slate-300 leading-relaxed">
              {settings?.about_content || 'Welcome to the official FatBallot election platform.'}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-medium text-gray-500 dark:text-slate-400">
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Secure ballots</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>One vote per position</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Change votes anytime before closing</span>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-72 h-44 rounded-2xl overflow-hidden shadow-md border-2 border-blue-500/20 shrink-0 relative flex items-center justify-center">
            {settings?.about_image_url ? (
              <img
                src={settings.about_image_url}
                alt="Election Logo"
                className="w-full h-full object-contain p-4"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 p-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl mb-3">
                  <VoteIcon className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white text-center">
                  {settings?.site_name || 'FatBallot'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 text-center mt-1">
                  Official Election Platform
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Metric Cards */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span>Election At a Glance</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((card) => {
            const IconComponent = card.icon;
            return (
              <div
                key={card.label}
                onClick={card.onClick}
                className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className={`w-10 h-10 rounded-full ${card.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="my-3">
                  <div className="text-3xl font-extrabold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                    {card.value}
                  </div>
                  <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mt-1">
                    {card.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Live Results Preview */}
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold uppercase text-red-500 tracking-wider">
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Live Real-time Collation Monitor</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-1">
              Election Tally & Progress Tracker
            </h2>
          </div>
          <button
            onClick={() => onNavigate('vote')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center space-x-2 shrink-0"
          >
            <VoteIcon className="w-4 h-4" />
            <span>{isCommittee ? 'Open Voting Monitor' : 'Vote / Monitor'}</span>
          </button>
        </div>

        {liveResults.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400 flex flex-col items-center space-y-2">
            <Building2 className="w-8 h-8 text-gray-300" />
            <p>No offices or candidates have been published yet by the committee.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveResults.map((off) => (
              <div key={off.officeId} className="border border-gray-200 dark:border-[#1E2E4E] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1E2E4E] pb-3">
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">{off.officeTitle}</h3>
                  <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 font-mono text-xs font-black">
                    <span>{off.totalVotes}</span>
                    <span className="text-[10px] font-normal text-gray-400">votes</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {off.candidates.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">No votes cast yet.</p>
                  )}
                  {off.candidates.map((cand, index) => (
                    <div key={cand.candidateId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-300 font-mono text-[10px] flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <span className="truncate">{cand.candidateName}</span>
                        </span>
                        <span className="flex items-center space-x-2 font-mono text-gray-600 dark:text-slate-300 shrink-0">
                          <span className="font-bold text-blue-600 dark:text-blue-400">{cand.percentage}%</span>
                          <span className="text-gray-400">#{cand.count}</span>
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${cand.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};