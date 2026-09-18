import React, { useState } from 'react';
import { ArrowLeft, AlertCircle, MailCheck, UserPlus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';

export const RegisterPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { register } = useAuth();
  const { settings } = useElection();

  const [raNumber, setRaNumber] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanRA = raNumber.replace(/^RA-?/i, '').trim();
    if (!cleanRA || !email.trim() || !fullName.trim() || !password) {
      setErrorMsg('Please complete every field.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const res = await register({ ra_number: cleanRA, email, full_name: fullName, password });
    setSubmitting(false);
    if (!res.success) {
      setErrorMsg(res.message);
    } else {
      setSuccessMsg(res.message);
      setRaNumber('');
      setEmail('');
      setFullName('');
      setPassword('');
      setConfirmPassword('');
    }
  };

  const inputCls =
    'w-full px-4 py-3 rounded-2xl border-2 border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:text-gray-400';

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
            Your RA Number + email must match the committee's registration bank.
          </p>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-xl space-y-5">
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <p className="font-bold">Invitation-only registration.</p>
              <p>
                Contact your electoral committee if your RA Number is not yet in the system.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-900/50 text-xs flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 flex items-start space-x-3">
              <MailCheck className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{successMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                RA Number
              </label>
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
                  value={raNumber}
                  onChange={(e) => setRaNumber(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 px-4 py-3 bg-transparent text-gray-900 dark:text-white font-mono font-bold text-base outline-none placeholder:text-gray-400 placeholder:font-normal"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Adaeze Okafor"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                Email Address (must match the bank)
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${inputCls} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !settings?.registration_open}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {submitting ? 'Registering...' : settings?.registration_open ? 'Register & Create Account' : 'Registration Closed'}
              </span>
            </button>
          </form>

          <button
            onClick={() => onNavigate('login')}
            className="w-full text-center text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center space-x-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Already registered? Sign in</span>
          </button>
        </div>
      </div>
    </div>
  );
};