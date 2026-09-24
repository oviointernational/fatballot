import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Search,
  CheckCircle2,
  RefreshCw,
  Activity,
  FileText,
  Filter
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useElection } from "../context/ElectionContext";
import { supabase } from "../lib/supabase";
import { mapAuditRow } from "../lib/mappers";
import { AuditBlock } from "../types";

function formatEventTitle(block: AuditBlock): string {
  switch (block.eventType) {
    case "VOTE_CAST":
      return "Ballot: Status → Cast";
    case "VOTER_ACCREDITED":
      return "Accreditation: Status → Accredited";
    case "VOTER_UNACCREDITED":
      return "Accreditation: Status → Pending";
    case "VOTER_REGISTERED":
      return "Registration: Status → Enrolled";
    case "OFFICE_ASSIGNED":
      return "Office: Status → Contestant Assigned";
    case "OFFICE_UNASSIGNED":
      return "Office: Status → Unassigned";
    case "CANDIDATE_SCREENED":
      return `Screening: Status → ${block.details?.passed ? "Passed" : "Pending"}`;
    case "AGENT_ASSIGNED":
      return "Agent: Status → Commissioned";
    case "OBSERVER_CREATED":
      return "Observer: Status → Pass Issued";
    case "SETTINGS_UPDATED":
      return "Governance: Status → Settings Updated";
    case "PASSWORD_CHANGED_BY_ADMIN":
      return "Security: Status → Password Changed by Admin";
    case "ELECTION_RESET":
      return "Governance: Status → Election Reset (Ballots Wiped)";
    case "ELECTION_VOIDED":
      return "Governance: Status → Election Voided (No Election)";
    case "GENESIS_BLOCK":
      return "Ledger: Status → Genesis Initialized";
    default:
      return `${block.eventType}: Status → Recorded`;
  }
}

function formatOptionalDetail(block: AuditBlock): string | null {
  if (block.details?.officeTitle) {
    return `Office: ${block.details.officeTitle}${block.details?.candidateName ? ` · Contestant: ${block.details.candidateName}` : ""}`;
  }
  if (block.details?.candidateName) {
    return `Contestant: ${block.details.candidateName}`;
  }
  if (block.details?.votesCleared != null) {
    return `Ballots wiped: ${block.details.votesCleared}`;
  }
  if (block.details?.note) {
    return String(block.details.note);
  }
  if (block.details?.raNumber) {
    return `Electoral RA: RA-${block.details.raNumber}`;
  }
  return null;
}

export const LogPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { settings } = useElection();

  const isAgent = user?.isAgent === true;

  const [logs, setLogs] = useState<AuditBlock[]>([]);
  const [verification, setVerification] = useState<{ valid: boolean; totalBlocks: number; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventType, setSelectedEventType] = useState("ALL");
  const [expandedBlockIndex, setExpandedBlockIndex] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<"sitewide" | "agent">("sitewide");
  const [agentLogs, setAgentLogs] = useState<AuditBlock[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const canViewAll =
        (user?.role === 'commissioner' || user?.role === 'superadmin') ||
        settings.publicAuditLog;

      const [logsRes, verifyRes] = await Promise.all([
        canViewAll
          ? supabase.from('audit_log').select('*').order('id', { ascending: false })
          : supabase.from('my_audit').select('*'),
        supabase.rpc('verify_audit_chain')
      ]);

      if (logsRes.error) console.error(logsRes.error);
      else setLogs((logsRes.data || []).map((row: any, i: number) => mapAuditRow(row, i)));
      if (!verifyRes.error) setVerification({
        valid: Boolean(verifyRes.data),
        totalBlocks: logsRes.data?.length || 0
      });
    } catch (e) {
      console.error("Failed to load audit ledger", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentLogs = async () => {
    if (!user?.agentCandidateId) return;
    setAgentLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .in('event_type', ['VOTE_CAST', 'VOTE_CHANGED', 'CANDIDATE_SCREENED', 'AGENT_ASSIGNED'])
        .eq('details->>candidateId', user.agentCandidateId)
        .order('id', { ascending: false });
      if (error) console.error(error);
      else setAgentLogs((data || []).map((row: any, i: number) => mapAuditRow(row, i)));
    } catch (e) {
      console.error("Failed to load agent monitor logs", e);
    } finally {
      setAgentLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.raNumber, settings.publicAuditLog]);

  useEffect(() => {
    if (isAgent && activeTab === "agent") fetchAgentLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAgent, activeTab, user?.agentCandidateId]);

  const currentList = activeTab === "sitewide" ? logs : agentLogs;

  const filteredLogs = currentList.filter((log) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      log.eventType.toLowerCase().includes(q) ||
      (log.actor?.name?.toLowerCase().includes(q) ?? false) ||
      (log.actor?.raNumber?.toLowerCase().includes(q) ?? false) ||
      log.hash.toLowerCase().includes(q);
    const matchesType = selectedEventType === "ALL" || log.eventType === selectedEventType;
    return matchesSearch && matchesType;
  });

  const eventTypes = ["ALL", ...Array.from(new Set(currentList.map((l) => l.eventType)))];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header matching the reference image: back arrow + Activity Log — Identifier */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigate("dashboard")}
            className="p-2 -ml-2 rounded-xl text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Activity Log — SHA256-LE/26
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Cryptographic tamper-evident chain · Click any row to inspect hashes & JSON
            </p>
          </div>
        </div>

        {/* Verification & Refresh Status */}
        <div className="flex items-center space-x-3">
          {verification?.valid ? (
            <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Chain Verified ({verification.totalBlocks} Blocks Valid)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Chain Verification Pending</span>
            </div>
          )}

          <button
            onClick={activeTab === "sitewide" ? fetchLogs : fetchAgentLogs}
            className="p-2 rounded-xl bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 transition-colors shadow-xs"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading || agentLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs & Search Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Tab switch if user has agent monitor capability */}
        {isAgent ? (
          <div className="flex bg-gray-100 dark:bg-[#16223B] p-1 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab("sitewide")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "sitewide"
                  ? "bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white shadow-xs"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-700"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Sitewide Audit Log</span>
            </button>
            <button
              onClick={() => setActiveTab("agent")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "agent"
                  ? "bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white shadow-xs"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-700"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Agent Monitor</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-xs font-semibold text-gray-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Official Electoral Public Ledger</span>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search activity log..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
          >
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Activity Log Container - Styled exactly as the reference image */}
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl shadow-sm overflow-hidden">
        {loading || agentLoading ? (
          <div className="py-16 text-center text-xs text-gray-400">Loading activity ledger...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-xs text-gray-400">No activity events recorded yet.</div>
        ) : (
          filteredLogs
            .slice()
            .reverse()
            .map((block) => {
              const isExpanded = expandedBlockIndex === block.index;
              const formattedDate = new Date(block.timestamp).toLocaleString("en-US", {
                year: "numeric",
                month: "numeric",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
              });
              const actorName = block.actor?.name || (block.actor?.role ? `System [${block.actor.role}]` : "System");

              return (
                <div
                  key={block.index}
                  className="border-b border-gray-100 dark:border-[#1E2E4E] last:border-b-0 transition-colors"
                >
                  {/* Single Row Item exactly like the reference image */}
                  <div
                    onClick={() => setExpandedBlockIndex(isExpanded ? null : block.index)}
                    className="px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-[#16223B]/50 transition-colors cursor-pointer flex items-start space-x-3.5"
                  >
                    {/* Teal / Green dot */}
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500 dark:bg-teal-400 shrink-0 mt-1.5" />

                    {/* Content Block */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                          {formatEventTitle(block)}
                        </p>
                        <span className="text-[11px] font-mono text-gray-400 shrink-0">
                          {isExpanded ? "▲ Hide JSON" : "▼ Inspect JSON"}
                        </span>
                      </div>

                      {/* Subtitle: Date · Actor Name */}
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        {formattedDate} · {actorName}
                        {block.actor?.raNumber && (
                          <span className="font-mono text-blue-600 dark:text-blue-400 ml-1">
                            (RA-{block.actor.raNumber})
                          </span>
                        )}
                      </p>

                      {/* Optional note line */}
                      {formatOptionalDetail(block) && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 font-medium">
                          {formatOptionalDetail(block)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Expanded Code & JSON stuff revealed on click */}
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 bg-gray-50/80 dark:bg-[#121B2E] border-t border-gray-100 dark:border-[#1E2E4E] space-y-3 text-xs animate-fadeIn">
                      {/* Cryptographic SHA-256 Hashes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                        <div className="p-3 rounded-2xl bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] break-all">
                          <span className="text-gray-400 block mb-1 font-sans font-semibold text-[10px] uppercase tracking-wider">
                            Previous Block Hash
                          </span>
                          <span className="text-gray-700 dark:text-slate-300">{block.previousHash}</span>
                        </div>

                        <div className="p-3 rounded-2xl bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] break-all">
                          <span className="text-gray-400 block mb-1 font-sans font-semibold text-[10px] uppercase tracking-wider">
                            Current Block Hash (SHA-256)
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{block.hash}</span>
                        </div>
                      </div>

                      {/* Code / JSON Display */}
                      <div>
                        <div className="flex items-center justify-between pb-1.5 text-[11px] font-mono text-gray-400">
                          <span>Payload JSON — Block #{block.index}</span>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-sans font-bold">
                            Cryptographically Signed
                          </span>
                        </div>
                        <pre className="p-4 rounded-2xl bg-gray-900 text-emerald-400 font-mono text-xs overflow-x-auto border border-gray-800 shadow-inner leading-relaxed">
                          {JSON.stringify(block.details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
};
