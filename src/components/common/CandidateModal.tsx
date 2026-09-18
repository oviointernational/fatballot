import React from 'react';
import { Candidate, Office } from '../../types';
import { X, Compass, UserCheck } from 'lucide-react';

interface CandidateModalProps {
  candidate: Candidate | null;
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
  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#10192D] border border-gray-200 dark:border-[#1E2E4E] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 rounded-full bg-white/15 border-2 border-white/30 flex items-center justify-center text-3xl font-black shrink-0 overflow-hidden">
              {candidate.avatar ? (
                <img src={candidate.avatar} alt={candidate.full_name} className="w-full h-full object-cover" />
              ) : (
                candidate.full_name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold tracking-tight">{candidate.full_name}</h2>
                <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full font-mono">
                  RA-{candidate.ra_number}
                </span>
              </div>
              <p className="text-blue-100 text-sm font-medium mt-0.5">
                Contesting for {office?.title || 'Executive Office'}
              </p>
              {candidate.tagline && (
                <p className="text-xs text-blue-200/80 italic mt-1 max-w-md line-clamp-1">
                  "{candidate.tagline}"
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-sm text-gray-700 dark:text-gray-300 space-y-4">
          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
            <h4 className="font-semibold text-blue-950 dark:text-blue-300 mb-1.5 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-blue-600" />
              Manifesto / Campaign Statement
            </h4>
            <p className="leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-line">
              {candidate.statement || 'No statement provided yet.'}
            </p>
          </div>
        </div>

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