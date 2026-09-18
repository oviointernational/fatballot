import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { useElection } from '../../context/ElectionContext';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const CountdownTimer: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { settings, hasElectionStarted, hasElectionEnded, isElectionActive } = useElection();
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const targetTime = !hasElectionStarted
        ? new Date(settings.electionStartTime).getTime()
        : new Date(settings.electionEndTime).getTime();

      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [settings.electionStartTime, settings.electionEndTime, hasElectionStarted]);

  // If election has ended
  if (hasElectionEnded) {
    return (
      <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span className="font-semibold text-sm">Election has officially concluded. Ballots are locked.</span>
      </div>
    );
  }

  const label = !hasElectionStarted 
    ? 'Countdown to Election Start:' 
    : 'Election Ends In:';

  if (compact) {
    return (
      <div className="flex items-center space-x-2 text-xs font-mono font-medium px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-300">
        <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
        <span>{label}</span>
        <span className="font-bold">
          {String(timeLeft.days).padStart(2, '0')}d : {String(timeLeft.hours).padStart(2, '0')}h : {String(timeLeft.minutes).padStart(2, '0')}m : {String(timeLeft.seconds).padStart(2, '0')}s
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/90 via-indigo-900/90 to-slate-900 text-white shadow-lg border border-blue-500/20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-blue-300 font-semibold">
              Live Official Countdown
            </div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              {label}
              {isElectionActive && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Voting Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Time Blocks */}
        <div className="flex items-center space-x-2 font-mono">
          <div className="flex flex-col items-center bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 min-w-[58px]">
            <span className="text-xl font-black text-white">{String(timeLeft.days).padStart(2, '0')}</span>
            <span className="text-[10px] text-blue-300 uppercase">Days</span>
          </div>
          <span className="text-xl font-bold text-blue-400">:</span>
          <div className="flex flex-col items-center bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 min-w-[58px]">
            <span className="text-xl font-black text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
            <span className="text-[10px] text-blue-300 uppercase">Hours</span>
          </div>
          <span className="text-xl font-bold text-blue-400">:</span>
          <div className="flex flex-col items-center bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 min-w-[58px]">
            <span className="text-xl font-black text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
            <span className="text-[10px] text-blue-300 uppercase">Mins</span>
          </div>
          <span className="text-xl font-bold text-blue-400">:</span>
          <div className="flex flex-col items-center bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 min-w-[58px]">
            <span className="text-xl font-black text-emerald-400">{String(timeLeft.seconds).padStart(2, '0')}</span>
            <span className="text-[10px] text-emerald-300 uppercase">Secs</span>
          </div>
        </div>
      </div>
    </div>
  );
};
