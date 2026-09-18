import React from 'react';
import { X, User, Mail, Hash, Building2, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { Voter } from '../../types';

interface VoterModalProps {
  voter: Voter | null;
  onClose: () => void;
}

export const VoterModal: React.FC<VoterModalProps> = ({ voter, onClose }) => {
  if (!voter) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white dark:bg-[#10192D] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center text-lg font-bold ring-2 ring-white/30">
              {voter.avatar ? (
                <img src={voter.avatar} alt={voter.firstName} className="w-full h-full rounded-full object-cover" />
              ) : (
                `${voter.firstName[0]}${voter.lastName[0]}`
              )}
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {voter.firstName} {voter.middleName ? voter.middleName + ' ' : ''}{voter.lastName}
              </h3>
              <p className="text-xs text-blue-100 font-mono mt-0.5">
                RA-{voter.raNumber}
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

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-gray-700 dark:text-gray-300">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-[#16223B] border border-gray-200 dark:border-[#1E2E4E]">
            <span className="font-semibold text-gray-500 dark:text-slate-400">Electoral Status</span>
            <span className="px-2.5 py-1 rounded-full font-bold uppercase font-mono text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              {voter.isAgent ? 'Electoral Agent' : voter.role}
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-gray-50 dark:bg-[#16223B]">
              <Mail className="w-4 h-4 text-blue-500 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 block">Email Address</span>
                <span className="font-medium text-gray-900 dark:text-white">{voter.email}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-gray-50 dark:bg-[#16223B]">
              <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 block">Department / Faculty</span>
                <span className="font-medium text-gray-900 dark:text-white">{voter.department || 'General Constituent'}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-gray-50 dark:bg-[#16223B]">
              {voter.isAccredited ? (
                <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />
              )}
              <div>
                <span className="text-[10px] text-gray-400 block">Accreditation Status</span>
                <span className={`font-semibold ${voter.isAccredited ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                  {voter.isAccredited ? 'Accredited (Eligible to Vote)' : 'Pending Accreditation'}
                </span>
              </div>
            </div>

            {voter.registeredAt && (
              <div className="text-[10px] text-gray-400 font-mono text-center pt-2">
                Enrolled on {new Date(voter.registeredAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#0C1322] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
