import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ArrowRight, 
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';

export const LoginPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { requestMagicLink, verifyToken, user } = useAuth();
  const { settings } = useElection();

  const [raInput, setRaInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check URL query parameters for magic link token (e.g. /login?token=xyz)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      verifyToken(token).then((success) => {
        if (success) {
          onNavigate('dashboard');
        }
      });
    }
  }, [verifyToken, onNavigate]);

  // If already logged in, redirect
  useEffect(() => {
    if (user) {
      onNavigate('dashboard');
    }
  }, [user, onNavigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanNumber = raInput.replace(/^RA-?/i, '').trim();
    if (!cleanNumber) {
      setErrorMsg('Please enter your numeric RA Number.');
      return;
    }

    setSubmitting(true);
    const res = await requestMagicLink(cleanNumber);
    setSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 md:p-8 bg-gray-50 dark:bg-[#080C15]">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto text-2xl shadow-lg shadow-blue-500/30">
            🗳️
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Sign In to {settings.siteName || 'FatBallot'}
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
            Official E-Ballot Portal • Single Device Protected
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-900/50 text-xs flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                Enter Your RA Number
              </label>

              {/* Input with pre-filled fixed "RA-" prefix */}
              <div className="flex items-center rounded-2xl border-2 border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] overflow-hidden focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-500/20 transition-all">
                <span className="px-4 py-3 bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-mono font-extrabold text-sm border-r border-gray-300 dark:border-[#1E2E4E] select-none">
                  RA-
                </span>
                <input
                  type="number"
                  required
                  autoFocus
                  placeholder="e.g. 3001"
                  value={raInput}
                  onChange={(e) => setRaInput(e.target.value)}
                  className="flex-1 px-4 py-3 bg-transparent text-gray-900 dark:text-white font-mono font-bold text-base outline-none placeholder:text-gray-400 placeholder:font-normal"
                />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1.5">
                Only the numerical characters are required. The "RA-" is already provided.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center space-x-2 group"
            >
              <span>{submitting ? 'Generating Secure Link...' : 'Request Sign-In Magic Link'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          {/* Security details */}
          <div className="pt-4 border-t border-gray-100 dark:border-[#1E2E4E] space-y-2 text-xs text-gray-500 dark:text-slate-400">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Single Active Device Guarantee</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              When authenticated, an encrypted session token is attached exclusively to this browser. Logging in on any other device automatically terminates prior sessions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
