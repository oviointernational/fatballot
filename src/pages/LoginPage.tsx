import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowRight, AlertCircle, MailCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';

export const LoginPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { login, user } = useAuth();
  const { settings } = useElection();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // If already logged in, redirect
  useEffect(() => {
    if (user) {
      onNavigate('dashboard');
    }
  }, [user, onNavigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const clean = identifier.trim();
    if (!clean) {
      setErrorMsg('Please enter your RA number.');
      return;
    }
    if (!/^\d+$/.test(clean)) {
      setErrorMsg('RA number must contain only digits.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setSubmitting(true);
    const res = await login(clean, password);
    setSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message);
    } else {
      setSuccessMsg(res.message);
    }
  };

  const inputCls =
    'w-full px-4 py-3 rounded-2xl border-2 border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:text-gray-400';

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
            Official E-Ballot Portal • Secure RA & Password Sign-In
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

          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 flex items-start space-x-3">
              <MailCheck className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <p>{successMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                RA Number
              </label>
              <input
                type="text"
                required
                autoFocus
                inputMode="numeric"
                maxLength={10}
                placeholder="e.g. 3001"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value.replace(/[^0-9]/g, ''))}
                className={`${inputCls} font-mono tracking-wider`}
              />
              <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1.5">
                Enter the RA number from your voter registration. Only numeric characters are accepted.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputCls} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('forgot-password')}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-1.5 font-medium"
              >
                Forgot your password?
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center space-x-2 group disabled:opacity-60"
            >
              <span>{submitting ? 'Verifying...' : 'Sign In Securely'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="pt-4 border-t border-gray-100 dark:border-[#1E2E4E] space-y-3 text-xs text-gray-500 dark:text-slate-400">
            <button
              onClick={() => onNavigate('register')}
              className="w-full flex items-center justify-center space-x-1.5 font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
            >
              <KeyRound className="w-4 h-4 shrink-0" />
              <span>
                {settings.registrationOpen === false
                  ? 'Registration is currently closed.'
                  : 'New voter? Register with your RA Number'}
              </span>
            </button>
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Secure, Verified Voting</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Every ballot is cryptographically signed into a tamper-evident, SHA-256 chained
              audit ledger. Your registration must match the commissioners' registration bank.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};