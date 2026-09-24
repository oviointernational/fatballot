import React from 'react';
import { ArrowLeft, UserPlus, MailCheck } from 'lucide-react';
import { useElection } from '../context/ElectionContext';

export const RegisterPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { settings } = useElection();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 md:p-8 bg-gray-50 dark:bg-[#080C15]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center mx-auto text-2xl shadow-lg shadow-emerald-500/30">
            🗳️
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Register to Vote
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
            Accounts are created by the electoral body, not by self-registration.
          </p>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-xl space-y-5">
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 flex items-start space-x-3">
            <MailCheck className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed space-y-1.5">
              <p className="font-bold">Registration is handled by the electoral committee.</p>
              <p>
                Please contact your Electoral Body or an Admin to register you. They will create
                your account and give you a sign-in password.
              </p>
              <p className="text-emerald-700 dark:text-emerald-400 font-semibold">
                Have your RA Number ready.
              </p>
            </div>
          </div>

          {!settings?.registrationOpen && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-900/50 text-xs text-center font-semibold">
              Registration is currently closed. Check back with the electoral committee.
            </div>
          )}

          <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] p-4 text-center space-y-1">
            <UserPlus className="w-5 h-5 mx-auto text-gray-400" />
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              Once registered, sign in below with your <span className="font-mono font-bold">RA-Number</span> and the
              password given to you. You can change your password from your profile afterwards.
            </p>
          </div>

          <button
            onClick={() => onNavigate('login')}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Sign in with your RA Number</span>
          </button>
        </div>
      </div>
    </div>
  );
};