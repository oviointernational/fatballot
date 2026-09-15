import React from 'react';
import { Mail, CheckCircle2, ArrowRight, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const SimulatedEmailModal: React.FC = () => {
  const { pendingMagicLink, verifyToken, clearPendingMagicLink } = useAuth();

  if (!pendingMagicLink) return null;

  const handleSignInClick = async () => {
    await verifyToken(pendingMagicLink.token);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white dark:bg-[#10192D] border border-blue-200 dark:border-blue-900/60 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Simulated Email Client Bar */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-slate-400 font-mono ml-2">Inbox Preview • Instant Magic Link</span>
          </div>
          <button 
            onClick={clearPendingMagicLink}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Email Message Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center space-x-3 pb-3 border-b border-gray-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div className="text-sm">
              <div className="font-semibold text-gray-900 dark:text-white">
                FatBallot Electoral Commission
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                To: <span className="font-mono text-gray-800 dark:text-gray-200">{pendingMagicLink.email}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Your Secure Magic Login Link
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Hello <strong className="text-gray-900 dark:text-white">{pendingMagicLink.voterName}</strong>,
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              We received a request to access the FatBallot voting portal using your registered RA credentials.
              Click the button below to authenticate your device and continue.
            </p>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Single Device Policy:</strong> Logging in will automatically terminate any other active session on your account.
              </span>
            </div>

            <div className="pt-2">
              <button
                onClick={handleSignInClick}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 transition-all group"
              >
                <span>Authenticate & Enter Ballot Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <p className="text-xs text-center text-gray-400 dark:text-gray-500 pt-2">
              Link expires in 15 minutes • Single-use cryptographic token
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
