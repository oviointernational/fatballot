import React from 'react';
import { 
  LayoutDashboard, 
  UserCircle2, 
  Vote, 
  ShieldAlert, 
  FileText, 
  Lock,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useElection } from '../../context/ElectionContext';

interface SidebarProps {
  isOpen: boolean;
  currentPage: string;
  onNavigate: (page: string) => void;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  currentPage,
  onNavigate,
  onCloseMobile
}) => {
  const { user } = useAuth();
  const { settings } = useElection();

  const isSuperadmin = user?.role === 'superadmin';
  const isCommittee = user?.role === 'committee';
  const canAccessAdmin = isSuperadmin || isCommittee;

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      color: 'bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
      activeColor: 'bg-blue-600 text-white',
      badge: null
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: UserCircle2,
      color: 'bg-indigo-500/15 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
      activeColor: 'bg-indigo-600 text-white',
      badge: user ? `RA-${user.raNumber}` : null
    },
    {
      id: 'vote',
      label: 'Vote',
      icon: Vote,
      color: 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
      activeColor: 'bg-emerald-600 text-white',
      badge: 'Ballot'
    },
    ...(canAccessAdmin ? [{
      id: 'admin',
      label: 'Admin',
      icon: ShieldAlert,
      color: 'bg-purple-500/15 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
      activeColor: 'bg-purple-600 text-white',
      badge: isSuperadmin ? 'SuperAdmin' : 'Committee',
      restricted: false
    }] : []),
    {
      id: 'log',
      label: 'Log',
      icon: FileText,
      color: 'bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
      activeColor: 'bg-amber-600 text-white',
      badge: settings.publicAuditLog ? 'Public' : 'Audited',
      restricted: false
    }
  ];

  if (!isOpen) return null;

  return (
    <aside
      className="w-[20%] min-w-[240px] max-w-[320px] h-full shrink-0 bg-white dark:bg-[#0B132B] border-r border-gray-100 dark:border-[#1E2E4E]/60 overflow-y-auto flex flex-col justify-between p-4 z-30 transition-all duration-300 select-none shadow-xs"
      aria-label="Sidebar Navigation"
    >
      <div className="space-y-6">
        {/* Navigation Category Header */}
        <div>
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">
            Election Systems
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all duration-200 group ${
                    isActive
                      ? 'bg-blue-50 dark:bg-[#16223B] text-blue-700 dark:text-blue-300 font-bold shadow-xs'
                      : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#121C30]'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    {/* 50% round circular icon container - LARGER */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-sm ${
                        isActive ? item.activeColor : item.color
                      }`}
                    >
                      <IconComponent className="w-6 h-6" />
                    </div>

                    <span className="text-sm font-semibold tracking-tight">{item.label}</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {item.badge && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                          item.restricted
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                            : isActive
                            ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {item.restricted && (
                      <Lock className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom info footer in sidebar */}
      <div className="pt-4 border-t border-gray-100 dark:border-[#1E2E4E] px-2 space-y-2">
        <div className="flex items-center space-x-2 text-[11px] text-gray-500 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>SHA-256 Chained Integrity</span>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-slate-400 leading-tight">
          Single active device per registered RA. Tamper-evident ledger.
        </p>
      </div>
    </aside>
  );
};
