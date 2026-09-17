import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  MailCheck,
  Crown,
  KeyRound,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';

type LoginMode = 'request' | 'verify' | 'setup';

const CODE_RESEND_SECONDS = 60;

export const LoginPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { requestLoginCode, verifyLoginCode, setupSuperadmin, user, setupRequired } = useAuth();
  const { settings } = useElection();

  const [mode, setMode] = useState<LoginMode>('request');
  const [raInput, setRaInput] = useState('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [voterName, setVoterName] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Fresh systems open directly on Superadmin setup — the first to
  // register is the Superadmin, and registration closes afterwards.
  useEffect(() => {
    if (setupRequired) {
      setMode('setup');
    } else if (mode === 'setup') {
      setMode('request');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupRequired]);

  // If already logged in, redirect
  useEffect(() => {
    if (user) {
      onNavigate('dashboard');
    }
  }, [user, onNavigate]);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Focus the first digit box on entering verify mode
  useEffect(() => {
    if (mode === 'verify') {
      setTimeout(() => digitRefs.current[0]?.focus(), 50);
    }
  }, [mode]);

  const startVerifyMode = (ra: string, masked: string | null, name: string | null, notice: string | null) => {
    setRaInput(ra);
    setMaskedEmail(masked);
    setVoterName(name);
    setDigits(['', '', '', '', '', '']);
    setErrorMsg(null);
    setSuccessMsg(notice);
    setResendIn(CODE_RESEND_SECONDS);
    setMode('verify');
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanNumber = raInput.replace(/^RA-?/i, '').trim();
    if (!cleanNumber) {
      setErrorMsg('Please enter your numeric RA Number.');
      return;
    }

    setSubmitting(true);
    const res = await requestLoginCode(cleanNumber);
    setSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message);
      return;
    }
    // DEV-ONLY: surfaces the code inline when no email service is configured.
    const notice = res.devCode
      ? `Development mode — no email service configured. Your test code is: ${res.devCode}`
      : res.message;
    startVerifyMode(cleanNumber, res.maskedEmail || null, res.voterName || null, notice);
  };

  const submitCode = async (code: string) => {
    if (!/^\d{6}$/.test(code)) return;
    setVerifying(true);
    setErrorMsg(null);
    const res = await verifyLoginCode(raInput, code);
    setVerifying(false);
    if (!res.success) {
      setErrorMsg(res.message);
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => digitRefs.current[0]?.focus(), 50);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    setErrorMsg(null);
    if (clean && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
    if (next.every(d => d !== '') && next.join('').length === 6) {
      submitCode(next.join(''));
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const filled = ['', '', '', '', '', ''];
    text.split('').forEach((ch, i) => {
      if (i < 6) filled[i] = ch;
    });
    setDigits(filled);
    setErrorMsg(null);
    if (text.length === 6) {
      submitCode(text);
    } else {
      digitRefs.current[Math.min(text.length, 5)]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    const res = await requestLoginCode(raInput);
    setSubmitting(false);
    if (!res.success) {
      setErrorMsg(res.message);
      return;
    }
    setResendIn(CODE_RESEND_SECONDS);
    setSuccessMsg(
      res.devCode
        ? `Development mode — no email service configured. Your test code is: ${res.devCode}`
        : res.message
    );
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    const res = await setupSuperadmin({ email: setupEmail, firstName, lastName });
    setSubmitting(false);
    if (!res.success) {
      setErrorMsg(res.message);
      return;
    }
    // Seat claimed and code dispatched for RA-1001 -> move to code entry.
    const notice = res.devCode
      ? `Superadmin seat claimed. Development mode — your test code is: ${res.devCode}`
      : res.message;
    startVerifyMode('1001', res.maskedEmail || null, res.voterName || null, notice);
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

          {mode === 'request' && (
            <form onSubmit={handleRequestCode} className="space-y-4">
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
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center space-x-2 group disabled:opacity-60"
              >
                <span>{submitting ? 'Sending Secure Code...' : 'Send Login Code'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-relaxed text-center">
                A 6-digit code will be emailed to the address registered to your RA Number.
                Only enrolled voters can sign in.
              </p>
            </form>
          )}

          {mode === 'verify' && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                  <KeyRound className="w-4 h-4 shrink-0" />
                  <span>Enter the 6-digit code</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  {voterName ? <span className="font-bold">{voterName}, </span> : null}
                  sent to <span className="font-mono font-semibold">{maskedEmail || 'your email'}</span>
                </p>
              </div>

              <div className="flex items-center justify-center gap-2" onPaste={handleDigitPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      digitRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={d}
                    disabled={verifying}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    className="w-11 h-14 py-3 text-center font-mono font-extrabold text-xl rounded-2xl border-2 border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/20 transition-all disabled:opacity-60"
                  />
                ))}
              </div>

              {verifying && (
                <p className="text-xs text-center text-blue-600 dark:text-blue-400 font-semibold">
                  Verifying code...
                </p>
              )}

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('request');
                    setDigits(['', '', '', '', '', '']);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                >
                  Use a different RA Number
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendIn > 0 || submitting}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center space-x-1 disabled:opacity-50 disabled:no-underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{resendIn > 0 ? `Resend in ${resendIn}s` : submitting ? 'Sending...' : 'Resend code'}</span>
                </button>
              </div>
            </div>
          )}

          {mode === 'setup' && (
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-900/50 text-purple-800 dark:text-purple-300 flex items-start space-x-3">
                <Crown className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed space-y-1">
                  <p className="font-bold">First-run setup: claim the Superadmin seat.</p>
                  <p>
                    This fresh system has no administrators yet. The first to register becomes the
                    Superadmin — registration closes permanently afterwards. A 6-digit code will be
                    emailed to you to complete sign-in.
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
                  Email Address (your real inbox)
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

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                <Crown className="w-4 h-4" />
                <span>{submitting ? 'Claiming...' : 'Claim Superadmin Seat'}</span>
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
          </div>
        </div>
      </div>
    </div>
  );
};
