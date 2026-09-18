import React, { useState } from 'react';
import { CandidateProfile, Office } from '../../types';
import { X, Award, Briefcase, Compass, History, Mail, UserCheck } from 'lucide-react';

interface CandidateModalProps {
  candidate: CandidateProfile | null;
  office?: Office;
  onClose: () => void;
  onVote?: () => void;
  isVoted?: boolean;
}

export const CandidateModal: React.FC<CandidateModalProps> = ({
  candidate,
  office,
  onClose,
  onVote,
  isVoted
}) => {
  const [activeTab, setActiveTab] = useState<'vision' | 'antecedent' | 'offices' | 'achievements'>('vision');

  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white dark:bg-[#10192D] border border-gray-200 dark:border-[#1E2E4E] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Candidate Banner */}
        <div className="relative p-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <img
              src={candidate.avatar}
              alt={candidate.name}
              className="w-20 h-20 rounded-full object-cover border-4 border-white/30 shadow-md ring-2 ring-white/10"
            />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold tracking-tight">{candidate.name}</h2>
                <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full font-mono">
                  RA-{candidate.raNumber}
                </span>
              </div>
              <p className="text-blue-100 text-sm font-medium mt-0.5">
                Contesting for {office?.title || 'Executive Office'}
              </p>
              <p className="text-xs text-blue-200/80 italic mt-1 max-w-md line-clamp-1">
                "{candidate.tagline}"
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-[#1E2E4E] bg-gray-50/75 dark:bg-[#0C1322] px-6">
          <button
            onClick={() => setActiveTab('vision')}
            className={`flex items-center space-x-2 py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'vision'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Vision & Manifesto</span>
          </button>

          <button
            onClick={() => setActiveTab('antecedent')}
            className={`flex items-center space-x-2 py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'antecedent'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Antecedents</span>
          </button>

          <button
            onClick={() => setActiveTab('offices')}
            className={`flex items-center space-x-2 py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'offices'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Current Offices</span>
          </button>

          <button
            onClick={() => setActiveTab('achievements')}
            className={`flex items-center space-x-2 py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'achievements'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Achievements</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 text-sm text-gray-700 dark:text-gray-300 space-y-4">
          {activeTab === 'vision' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                <h4 className="font-semibold text-blue-950 dark:text-blue-300 mb-1 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-blue-600" />
                  Official Manifesto Statement
                </h4>
                <p className="leading-relaxed text-gray-800 dark:text-gray-200">
                  {candidate.vision}
                </p>
              </div>

              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 pt-2 gap-2">
                <Mail className="w-3.5 h-3.5" />
                <span>Candidate Contact:</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">{candidate.contactEmail}</span>
              </div>
            </div>
          )}

          {activeTab === 'antecedent' && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <History className="w-4 h-4 text-indigo-500" />
                Track Record & Prior Leadership Engagements
              </h4>
              <ul className="space-y-2">
                {(candidate.antecedent || []).map((item, i) => (
                  <li key={i} className="flex items-start space-x-2.5 p-3 rounded-lg bg-gray-50 dark:bg-[#16223B] border border-gray-100 dark:border-[#1E2E4E]">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'offices' && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-emerald-500" />
                Current Portfolios & Administrative Responsibilities
              </h4>
              <div className="grid grid-cols-1 gap-2.5">
                {(candidate.currentOffices || []).map((off, i) => (
                  <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-[#16223B] border border-gray-100 dark:border-[#1E2E4E] flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <span className="font-medium">{off}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'achievements' && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                Recognized Honors & Measurable Contributions
              </h4>
              <ul className="space-y-2.5">
                {(candidate.achievements || []).map((ach, i) => (
                  <li key={i} className="flex items-start space-x-2.5 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                    <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <span className="text-gray-800 dark:text-gray-200">{ach}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer with Vote Action */}
        <div className="p-4 border-t border-gray-200 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#0C1322] flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Certified Candidate • Electoral Directory
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Close
            </button>
            {onVote && (
              <button
                onClick={() => {
                  onVote();
                  onClose();
                }}
                className={`flex items-center space-x-2 px-5 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all ${
                  isVoted
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-400'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>{isVoted ? 'Currently Selected' : 'Vote for Candidate'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
