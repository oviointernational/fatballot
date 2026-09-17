import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  MailCheck,
  Crown,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';

type LoginMode = 'login' | 'setup';

export const LoginPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { login, setupSuperadmin, user, setupRequired } = useAuth();
  const { settings } = useElection();

  const [mode, setMode] = useState<LoginMode>('login');
  const [raInput, setRaInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fresh systems open directly on Superadmin setup — the first to
  // register is the Superadmin, and registration closes afterwards.
  useEffect(() => {
    if (setupRequired) {
      setMode('setup');
    } else if (mode === 'setup') {
      setMode('login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupRequired]);

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

    const cleanNumber = raInput.replace(/^RA-?/i, '').trim();
    if (!cleanNumber) {
      setErrorMsg('Please enter your numeric RA Number.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setSubmitting(true);
    const res = await login(cleanNumber, password);
    setSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    const res = await setupSuperadmin({
      email: setupEmail,
      firstName,
      lastName,
      password: setupPassword
    });
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

          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 flex items-start space-x-3">
              <MailCheck className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <p>{successMsg}</p>
              </div>
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
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
                    type="text"
                    required
                    autoFocus
                    inputMode="numeric"
                    placeholder="e.g. 3001"
                    value={raInput}
                    onChange={(e) => setRaInput(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 px-4 py-3 bg-transparent text-gray-900 dark:text-white font-mono font-bold text-base outline-none placeholder:text-gray-400 placeholder:font-normal"
                  />
                </div>
                <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1.5">
                  Only the numerical characters are required. The "RA-" is already provided.
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
                <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1.5">
                  Forgot your password? Ask your Electoral Committee officer to reset it for you.
                </p>
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
          )}

          {mode === 'setup' && (
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-900/50 text-purple-800 dark:text-purple-300 flex items-start space-x-3">
                <Crown className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed space-y-1">
                  <p className="font-bold">First-run setup: claim the Superadmin seat.</p>
                  <p>
                    This fresh system has no administrators yet. The first to register becomes the
                    Superadmin — registration closes permanently afterwards.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Adaeze"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Okafor"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                  Choose Password (min. 6 characters)
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  className={inputCls}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                <Crown className="w-4 h-4" />
                <span>{submitting ? 'Claiming...' : 'Claim Superadmin Seat & Sign In'}</span>
              </button>
            </form>
          )}

          {/* Security details */}
          <div className="pt-4 border-t border-gray-100 dark:border-[#1E2E4E] space-y-2 text-xs text-gray-500 dark:text-slate-400">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Single Active Device Guarantee</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Sessions stay signed in for 7 days on this device only. Signing in anywhere else
              immediately ends this session.
            </p>
            <p className="text-[11px] leading-relaxed flex items-start space-x-1.5">
              <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>New member? Your committee officer enrolls you and gives you your RA number and first password.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
