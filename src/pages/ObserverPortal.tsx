import React, { useState, useEffect } from "react";
import {
  Eye,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Users,
  Vote,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Lock
} from "lucide-react";
import { OfficeLiveResult, SystemStats, TimelineItem } from "../types";
import { WS_ORIGIN } from "../lib/config";

interface ObserverPortalProps {
  token: string;
}

interface ObserverInfo {
  id: string;
  name: string;
  rank: string;
  office?: string;
}

export const ObserverPortal: React.FC<ObserverPortalProps> = ({ token }) => {
  const [observerInfo, setObserverInfo] = useState<ObserverInfo | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string>("");
  const [liveResults, setLiveResults] = useState<OfficeLiveResult[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Verify token and get observer info
  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch(`/api/observers/verify/${token}`);
        if (res.ok) {
          const data = await res.json();
          setObserverInfo(data.observer);
          setVerified(true);
        } else {
          const data = await res.json();
          setError(data.message || "Invalid or expired observer link.");
          setVerified(false);
        }
      } catch {
        setError("Failed to verify observer token.");
        setVerified(false);
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [token]);

  const fetchData = async () => {
    try {
      const [resultsRes, statsRes, timelineRes] = await Promise.all([
        fetch("/api/live-results"),
        fetch("/api/stats"),
        fetch("/api/timeline")
      ]);
      if (resultsRes.ok) setLiveResults(await resultsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (timelineRes.ok) setTimeline(await timelineRes.json());
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Observer data fetch failed", e);
    }
  };

  useEffect(() => {
    if (verified) {
      fetchData();
// WebSocket for live results
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = WS_ORIGIN
        ? `${WS_ORIGIN}/ws`
        : `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === "LIVE_RESULTS_UPDATE") {
            setLiveResults(data.results);
            setLastUpdated(new Date());
          }
        } catch {}
      };
      return () => ws.close();
    }
  }, [verified]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#080C15]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Verifying observer access...</p>
        </div>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#080C15] p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-8 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 mx-auto flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Observer Access Denied</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">{error}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            This link may have been used on another device or has been regenerated. Please contact the administrator for a new link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080C15] text-gray-900 dark:text-slate-100">
      {/* Observer Header */}
      <div className="bg-white dark:bg-[#0D1526] border-b border-gray-200 dark:border-[#1E2E4E] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
            <Eye className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">FatBallot — Observer Portal</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Read-only view · No actions permitted</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {lastUpdated && (
            <span className="text-xs text-gray-400 dark:text-slate-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-[#16223B] dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        {/* Observer Identity Banner */}
        <div className="flex items-center space-x-4 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-blue-900 dark:text-blue-200">{observerInfo?.name}</p>
            <p className="text-xs text-blue-700 dark:text-blue-400">{observerInfo?.rank}{observerInfo?.office ? ` · ${observerInfo.office}` : ""}</p>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Observer Access Active</span>
          </div>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Offices", value: stats.officesCount, icon: <BarChart3 className="w-5 h-5" />, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/40" },
              { label: "Registered Voters", value: stats.registeredVotersCount, icon: <Users className="w-5 h-5" />, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
              { label: "Accredited Voters", value: stats.accreditedVotersCount, icon: <CheckCircle2 className="w-5 h-5" />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
              { label: "Total Votes Cast", value: stats.totalVotesCount, icon: <Vote className="w-5 h-5" />, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-2xl p-4 shadow-sm">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center mb-3`}>
                  {stat.icon}
                </div>
                <p className="text-2xl font-extrabold text-gray-900 dark:text-white text-center">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 text-center mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Election Timeline</h2>
            </div>
            <div className="space-y-3">
              {timeline.map((item, idx) => (
                <div key={item.id} className="flex items-start space-x-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold border-2 ${
                    item.status === "completed" ? "bg-emerald-500 border-emerald-500 text-white" :
                    item.status === "active" ? "bg-blue-500 border-blue-500 text-white" :
                    "bg-gray-100 dark:bg-[#16223B] border-gray-300 dark:border-[#1E2E4E] text-gray-400"
                  }`}>
                    {item.status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                     item.status === "active" ? <Activity className="w-3.5 h-3.5" /> :
                     <span>{idx + 1}</span>}
                  </div>
                  {idx < timeline.length - 1 && (
                    <div className="absolute mt-7 ml-3 w-0.5 h-3 bg-gray-200 dark:bg-[#1E2E4E]" />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{item.description}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{new Date(item.date).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Results */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Live Election Results</h2>
            <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {liveResults.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-2xl text-xs text-gray-400">
              No results available yet — voting has not started or no votes have been cast.
            </div>
          ) : (
            liveResults.map((office) => (
              <div key={office.officeId} className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{office.officeTitle}</h3>
                  <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-[#16223B] px-2.5 py-1 rounded-full font-mono">
                    {office.totalVotes} vote{office.totalVotes !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="space-y-3">
                  {office.candidates.map((c) => (
                    <div key={c.candidateId}>
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <div className="flex items-center space-x-2">
                          {c.avatar ? (
                            <img src={c.avatar} alt={c.candidateName} className="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-[#1E2E4E]" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400">
                              {c.candidateName.charAt(0)}
                            </div>
                          )}
                          <span className="font-semibold text-gray-900 dark:text-white">{c.candidateName}</span>
                        </div>
                        <span className="font-mono font-bold text-gray-900 dark:text-white">{c.percentage.toFixed(1)}% <span className="text-gray-400 font-normal">({c.count})</span></span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-[#16223B] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${c.percentage}%` }}
                        />
                      </div>
                      {office.isSingleCandidate && (
                        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                          <span className="text-emerald-600 dark:text-emerald-400">For: {c.forCount}</span>
                          <span className="text-red-500">Against: {c.againstCount}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Read-Only Watermark */}
        <div className="flex items-center justify-center space-x-2 py-4 text-xs text-gray-400 dark:text-slate-600">
          <XCircle className="w-3.5 h-3.5" />
          <span>Read-only access — no actions may be performed on this portal</span>
        </div>
      </div>
    </div>
  );
};
