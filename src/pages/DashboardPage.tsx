import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Users, 
  UserCheck, 
  UserSquare2, 
  Shield, 
  Download, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  ArrowLeft,
  Search,
  LayoutGrid,
  List,
  Eye,
  Building2,
  ChevronRight,
  Layers,
  Phone,
  Mail,
  Vote as VoteIcon
} from 'lucide-react';
import { useElection } from '../context/ElectionContext';
import { useAuth } from '../context/AuthContext';
import { CountdownTimer } from '../components/common/CountdownTimer';
import { 
  exportOfficesPdf, 
  exportVotersPdf, 
  exportContestantsPdf, 
  exportYCECPdf 
} from '../utils/pdfGenerator';
import { CandidateModal } from '../components/common/CandidateModal';
import { VoterModal } from '../components/common/VoterModal';
import { CandidateProfile, TimelineItem, Voter, YCECMember, Office } from '../types';
import { supabase } from '../lib/supabase';
import { mapVoterRow, mapTimelineRow, mapYCECRow } from '../lib/mappers';

type RegistryType = 'offices' | 'registered' | 'accredited' | 'contestants' | 'ycec';

export const DashboardPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { 
    settings, 
    offices, 
    candidates, 
    stats 
  } = useElection();
  const { sessionToken } = useAuth();

  const [votersList, setVotersList] = useState<Voter[]>([]);
  const [ycecList, setYcecList] = useState<YCECMember[]>([]);
  const [timelineList, setTimelineList] = useState<TimelineItem[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile | null>(null);
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // Selected Registry Detail View state
  const [activeRegistry, setActiveRegistry] = useState<RegistryType | null>(null);
  const [registryViewMode, setRegistryViewMode] = useState<'cards' | 'list'>('cards');
  const [registrySearch, setRegistrySearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data: voters } = await supabase.from('voters').select('*').order('ra_number');
        if (voters) setVotersList(voters.map(mapVoterRow));
        const { data: ycec } = await supabase.from('ycec_members').select('*').order('role');
        if (ycec) setYcecList(ycec.map(mapYCECRow));
        const { data: timeline } = await supabase.from('timeline').select('*').order('order');
        if (timeline) setTimelineList(timeline.map(mapTimelineRow));
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const handleExport = async (type: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExporting(type);
    try {
      if (type === 'offices') {
        await exportOfficesPdf(offices, sessionToken);
      } else if (type === 'registered') {
        await exportVotersPdf(votersList, false, sessionToken);
      } else if (type === 'accredited') {
        await exportVotersPdf(votersList, true, sessionToken);
      } else if (type === 'contestants') {
        await exportContestantsPdf(candidates, offices, sessionToken);
      } else if (type === 'ycec') {
        await exportYCECPdf(ycecList, sessionToken);
      }
    } catch (err) {
      console.error('PDF export failed', err);
    } finally {
      setExporting(null);
    }
  };

  // ----------------------------------------------------
  // REGISTRY DETAIL PAGE VIEW (When a metric card is clicked)
  // ----------------------------------------------------
  if (activeRegistry) {
    const registryTitles: Record<RegistryType, string> = {
      offices: 'Contested Positions & Offices Registry',
      registered: 'Official Registered Voters Registry',
      accredited: 'Certified Accredited Voters Register',
      contestants: 'Certified Contestant Directory',
      ycec: 'Youth & Electoral Committee (YCEC) Commissioners'
    };

    // Filter items based on search query
    const query = registrySearch.toLowerCase();

    const filteredOffices = offices.filter(o => 
      o.title.toLowerCase().includes(query) || o.description.toLowerCase().includes(query)
    );

    const filteredRegistered = votersList.filter(v => 
      v.firstName.toLowerCase().includes(query) || 
      v.lastName.toLowerCase().includes(query) || 
      v.raNumber.toLowerCase().includes(query) ||
      (v.department && v.department.toLowerCase().includes(query))
    );

    const filteredAccredited = votersList.filter(v => v.isAccredited).filter(v => 
      v.firstName.toLowerCase().includes(query) || 
      v.lastName.toLowerCase().includes(query) || 
      v.raNumber.toLowerCase().includes(query) ||
      (v.department && v.department.toLowerCase().includes(query))
    );

    const filteredContestants = candidates.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.raNumber.toLowerCase().includes(query) ||
      c.tagline.toLowerCase().includes(query)
    );

    const filteredYcec = ycecList.filter(m => 
      m.name.toLowerCase().includes(query) || 
      m.role.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query)
    );

    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
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
                Detailed constituent directory with real-time electoral credentials
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* View Mode Toggle: Cards vs List */}
            <div className="flex bg-gray-100 dark:bg-[#16223B] p-1 rounded-xl">
              <button
                onClick={() => setRegistryViewMode('cards')}
                className={`p-2 rounded-lg text-xs font-semibold transition-all ${
                  registryViewMode === 'cards'
                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900'
                }`}
                title="Profile Cards Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRegistryViewMode('list')}
                className={`p-2 rounded-lg text-xs font-semibold transition-all ${
                  registryViewMode === 'list'
                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900'
                }`}
                title="Table List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Export PDF */}
            <button
              onClick={() => handleExport(activeRegistry)}
              disabled={Boolean(exporting)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center space-x-2 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{exporting === activeRegistry ? 'Exporting...' : 'Export Certified PDF'}</span>
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
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

        {/* CONTENT DISPLAY: CONTESTANTS */}
        {activeRegistry === 'contestants' && (
          registryViewMode === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {filteredContestants.map((candidate) => {
                const office = offices.find(o => o.id === candidate.officeId);
                return (
                  <div
                    key={candidate.id}
                    onClick={() => setSelectedCandidate(candidate)}
                    className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3.5">
                        <img
                          src={candidate.avatar}
                          alt={candidate.name}
                          className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-500/20 group-hover:scale-105 transition-transform"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">
                            {candidate.name}
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
                      <span className="font-mono text-gray-400 font-bold">RA-{candidate.raNumber}</span>
                      <span className="text-blue-600 dark:text-blue-400 font-semibold group-hover:underline flex items-center gap-1">
                        <span>View Profile</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-[#16223B]/60 text-gray-400 uppercase font-bold">
                  <tr>
                    <th className="py-3 px-4">RA No.</th>
                    <th className="py-3 px-4">Candidate Name</th>
                    <th className="py-3 px-4">Contested Office</th>
                    <th className="py-3 px-4">Vision Headline</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1E2E4E]">
                  {filteredContestants.map(candidate => (
                    <tr key={candidate.id} className="hover:bg-gray-50 dark:hover:bg-[#16223B]/30">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">RA-{candidate.raNumber}</td>
                      <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">{candidate.name}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-slate-300">{offices.find(o => o.id === candidate.officeId)?.title}</td>
                      <td className="py-3 px-4 text-gray-500 italic truncate max-w-xs">"{candidate.tagline}"</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedCandidate(candidate)}
                          className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg font-semibold hover:bg-blue-100"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* CONTENT DISPLAY: REGISTERED OR ACCREDITED VOTERS */}
        {(activeRegistry === 'registered' || activeRegistry === 'accredited') && (
          (() => {
            const list = activeRegistry === 'accredited' ? filteredAccredited : filteredRegistered;
            return registryViewMode === 'cards' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {list.map((voter) => {
                  // Requirement: for normal voters, remove quote, replace office with status of voter or agent and when profile is clicked it will minimal unlike contestant
                  const statusLabel = voter.isAgent 
                    ? 'Electoral Agent' 
                    : voter.role === 'contestant' 
                    ? 'Contestant' 
                    : voter.role === 'committee' 
                    ? 'Electoral Official' 
                    : voter.isAccredited 
                    ? 'Accredited Voter' 
                    : 'Registered Voter';

                  return (
                    <div
                      key={voter.id}
                      onClick={() => setSelectedVoter(voter)}
                      className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer group flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3.5">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                            {voter.avatar ? (
                              <img src={voter.avatar} alt={voter.firstName} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              `${voter.firstName[0]}${voter.lastName[0]}`
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                              {voter.firstName} {voter.middleName ? voter.middleName + ' ' : ''}{voter.lastName}
                            </h4>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                              {statusLabel}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          <div className="flex items-center space-x-1.5 truncate">
                            <Building2 className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                            <span className="truncate">{voter.department || 'General Constituent'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#1E2E4E] flex items-center justify-between text-[11px]">
                        <span className="font-mono text-gray-500 font-bold">RA-{voter.raNumber}</span>
                        <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 font-semibold group-hover:underline">
                          {voter.isAccredited ? (
                            <span className="flex items-center text-blue-600 dark:text-blue-400">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              <span>Accredited</span>
                            </span>
                          ) : (
                            <span className="text-gray-400">Pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-[#16223B]/60 text-gray-400 uppercase font-bold">
                    <tr>
                      <th className="py-3 px-4">RA No.</th>
                      <th className="py-3 px-4">Full Name</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4 text-center">Accreditation</th>
                      <th className="py-3 px-4 text-right">Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#1E2E4E]">
                    {list.map(voter => (
                      <tr key={voter.id} className="hover:bg-gray-50 dark:hover:bg-[#16223B]/30 cursor-pointer" onClick={() => setSelectedVoter(voter)}>
                        <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">RA-{voter.raNumber}</td>
                        <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                          {voter.firstName} {voter.middleName ? voter.middleName + ' ' : ''}{voter.lastName}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                            {voter.isAgent ? 'Agent' : voter.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500">{voter.email}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-300">{voter.department || 'N/A'}</td>
                        <td className="py-3 px-4 text-center">
                          {voter.isAccredited ? (
                            <span className="inline-flex items-center text-blue-600 dark:text-blue-400 font-semibold text-[11px]">
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Accredited
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[11px]">Pending</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedVoter(voter); }}
                            className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg font-semibold hover:bg-blue-100"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()
        )}

        {/* CONTENT DISPLAY: OFFICES */}
        {activeRegistry === 'offices' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {filteredOffices.map((office) => {
              const count = candidates.filter(c => c.officeId === office.id).length;
              return (
                <div
                  key={office.id}
                  className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                      #{office.order}
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

        {/* CONTENT DISPLAY: YCEC */}
        {activeRegistry === 'ycec' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {filteredYcec.map((member) => (
              <div
                key={member.id}
                className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-5 shadow-sm space-y-3"
              >
                <div className="flex items-center space-x-3.5">
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-500/20"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">{member.name}</h4>
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold">{member.role}</p>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-gray-500 dark:text-slate-400 pt-2 border-t border-gray-100 dark:border-[#1E2E4E]">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{member.email}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{member.phone}</span>
                  </div>
                  <div className="text-[11px] font-mono text-gray-400 pt-1">Tenure: {member.tenure}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Candidate Profile Modal (Tabs: Vision, Antecedent, Offices, Achievements) */}
        {selectedCandidate && (
          <CandidateModal
            candidate={selectedCandidate}
            office={offices.find(o => o.id === selectedCandidate.officeId)}
            onClose={() => setSelectedCandidate(null)}
            onVote={() => onNavigate('vote')}
          />
        )}

        {/* Minimal Voter Profile Modal */}
        {selectedVoter && (
          <VoterModal
            voter={selectedVoter}
            onClose={() => setSelectedVoter(null)}
          />
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // DEFAULT DASHBOARD VIEW
  // ----------------------------------------------------
  return (
    <div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Top Banner / Countdown */}
      <CountdownTimer />

      {/* 1. About Section (Configurable by admin) */}
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm transition-all overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 justify-between">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Official Election Mandate</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {settings.aboutTitle || 'About the Election'}
            </h1>

            <p className="text-sm md:text-base text-gray-600 dark:text-slate-300 leading-relaxed">
              {settings.aboutContent}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-medium text-gray-500 dark:text-slate-400">
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Zero-Tampering Ledger</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Single Device Protection</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Instant Ballot Modification</span>
              </div>
            </div>
          </div>

          {/* Election Logo/Branding */}
          <div className="w-full lg:w-72 h-44 rounded-2xl overflow-hidden shadow-md border-2 border-blue-500/20 shrink-0 relative group flex items-center justify-center">
            {settings.aboutImageUrl ? (
              <>
                <img
                  src={settings.aboutImageUrl}
                  alt="Election Logo"
                  className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3">
                  <span className="text-[11px] font-semibold text-white">Constituent Democracy 2026</span>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 p-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl mb-4">
                  <VoteIcon className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white text-center">
                  {settings.siteName || 'FatBallot'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 text-center mt-1">
                  Official Election Platform
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Key Metrics Cards (REQUIREMENTS: Centralized numbers & click to view list) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Official Electoral Registers & Metric Summaries</span>
          </h2>
          <span className="text-xs text-gray-500 dark:text-slate-400">Click any card to inspect directory & lists</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. Offices Card */}
          <div 
            onClick={() => setActiveRegistry('offices')}
            className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-transform group-hover:scale-110">
                <Briefcase className="w-5 h-5" />
              </div>
              <button
                onClick={(e) => handleExport('offices', e)}
                disabled={exporting === 'offices'}
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                title="Export Certified PDF"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Centralized Number */}
            <div className="my-4 text-center">
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                {stats?.officesCount || offices.length}
              </div>
              <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mt-1">
                Positions / Offices
              </div>
            </div>

            <div className="text-center text-[11px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center justify-center space-x-1">
              <span>View Certified List</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* 2. Registered Voters Card */}
          <div 
            onClick={() => setActiveRegistry('registered')}
            className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-500 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center transition-transform group-hover:scale-110">
                <Users className="w-5 h-5" />
              </div>
              <button
                onClick={(e) => handleExport('registered', e)}
                disabled={exporting === 'registered'}
                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors"
                title="Export Certified PDF"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Centralized Number */}
            <div className="my-4 text-center">
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                {stats?.registeredVotersCount || votersList.length}
              </div>
              <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mt-1">
                Registered Voters
              </div>
            </div>

            <div className="text-center text-[11px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center justify-center space-x-1">
              <span>View Electorate Register</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* 3. Accredited Voters Card */}
          <div 
            onClick={() => setActiveRegistry('accredited')}
            className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-transform group-hover:scale-110">
                <UserCheck className="w-5 h-5" />
              </div>
              <button
                onClick={(e) => handleExport('accredited', e)}
                disabled={exporting === 'accredited'}
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                title="Export Certified PDF"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Centralized Number */}
            <div className="my-4 text-center">
              <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                {stats?.accreditedVotersCount || votersList.filter(v => v.isAccredited).length}
              </div>
              <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mt-1">
                Accredited Voters
              </div>
            </div>

            <div className="text-center text-[11px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center justify-center space-x-1">
              <span>View Accredited List</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* 4. Contestants Card */}
          <div 
            onClick={() => setActiveRegistry('contestants')}
            className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-amber-500 dark:hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center transition-transform group-hover:scale-110">
                <UserSquare2 className="w-5 h-5" />
              </div>
              <button
                onClick={(e) => handleExport('contestants', e)}
                disabled={exporting === 'contestants'}
                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors"
                title="Export Certified PDF"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Centralized Number */}
            <div className="my-4 text-center">
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors">
                {stats?.contestantsCount || candidates.length}
              </div>
              <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mt-1">
                Contestants
              </div>
            </div>

            <div className="text-center text-[11px] font-bold text-amber-600 dark:text-amber-400 group-hover:underline flex items-center justify-center space-x-1">
              <span>View Candidate Directory</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* 5. YCEC Members Card */}
          <div 
            onClick={() => setActiveRegistry('ycec')}
            className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-purple-500 dark:hover:border-purple-500 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center transition-transform group-hover:scale-110">
                <Shield className="w-5 h-5" />
              </div>
              <button
                onClick={(e) => handleExport('ycec', e)}
                disabled={exporting === 'ycec'}
                className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors"
                title="Export Certified PDF"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Centralized Number */}
            <div className="my-4 text-center">
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">
                {stats?.ycecCount || ycecList.length}
              </div>
              <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mt-1">
                YCEC Commissioners
              </div>
            </div>

            <div className="text-center text-[11px] font-bold text-purple-600 dark:text-purple-400 group-hover:underline flex items-center justify-center space-x-1">
              <span>View Commissioners List</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Interactive Vertical Timeline */}
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Official Election Milestones & Schedule</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Tracking the procedural phases from registration through collation
            </p>
          </div>
        </div>

        {/* Vertical Progress Bar with circular icons & horizontal text */}
        <div className="relative pl-6 md:pl-10 space-y-8 before:absolute before:left-3 md:before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-blue-600 before:via-indigo-500 before:to-gray-300 dark:before:to-slate-700">
          {timelineList.map((item, idx) => {
            const isDone = item.status === 'completed';
            const isActive = item.status === 'active';

            return (
              <div key={item.id} className="relative flex items-start space-x-4 md:space-x-6 group">
                {/* Circular Icon node on vertical line */}
                <div
                  className={`-ml-6 md:-ml-10 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-transform group-hover:scale-110 shadow-md ${
                    isDone
                      ? 'bg-emerald-500 text-white ring-4 ring-emerald-100 dark:ring-emerald-950'
                      : isActive
                      ? 'bg-blue-600 text-white ring-4 ring-blue-200 dark:ring-blue-900 animate-pulse'
                      : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400'
                  }`}
                >
                  {isDone ? '✓' : idx + 1}
                </div>

                {/* Horizontal details card */}
                <div className="flex-1 p-4 rounded-2xl bg-gray-50/70 dark:bg-[#16223B]/60 border border-gray-200/80 dark:border-[#1E2E4E] hover:border-blue-300 dark:hover:border-blue-700 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      {item.title}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono text-gray-500 dark:text-slate-400">
                        {item.date}
                      </span>
                      <span
                        className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${
                          isDone
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : isActive
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Candidate Profile Modal */}
      {selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          office={offices.find(o => o.id === selectedCandidate.officeId)}
          onClose={() => setSelectedCandidate(null)}
          onVote={() => onNavigate('vote')}
        />
      )}

      {/* Minimal Voter Profile Modal */}
      {selectedVoter && (
        <VoterModal
          voter={selectedVoter}
          onClose={() => setSelectedVoter(null)}
        />
      )}
    </div>
  );
};
