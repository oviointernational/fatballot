import React, { useState, useRef, useEffect } from 'react';
import { PanelLeftClose, PanelLeftOpen, Sun, Moon, User, LogOut, Shield, ChevronDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useElection } from '../../context/ElectionContext';

interface HeaderProps {
  isSidebarOpen?: boolean;
  onToggleSidebar: () => void;
  onNavigate: (page: string) => void;
  currentPage: string;
}

export const Header: React.FC<HeaderProps> = ({ isSidebarOpen = true, onToggleSidebar, onNavigate, currentPage }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, supersededError, clearSupersededError } = useAuth();
  const { settings } = useElection();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      {/* Session Superseded Banner Alert if another device logged in */}
      {supersededError && (
        <div className="bg-red-600 text-white px-4 py-2 text-xs flex items-center justify-between font-medium z-50">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{supersededError}</span>
          </div>
          <button
            onClick={clearSupersededError}
            className="underline hover:text-red-200 ml-4 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      <header className="sticky top-0 z-40 h-16 bg-white/95 dark:bg-[#0B132B]/95 backdrop-blur-md transition-colors flex items-center justify-between px-4 lg:px-6">
        {/* Left: Collapsible toggle icon + Brand Header text */}
        <div className="flex items-center space-x-3">
          {/* Collapsible toggle icon with modern panel icon */}
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-gray-700 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-300 dark:hover:text-blue-400 dark:hover:bg-[#16223B] transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            aria-label="Toggle navigation menu"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-5 h-5 text-gray-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400" />
            ) : (
              <PanelLeftOpen className="w-5 h-5 text-gray-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400" />
            )}
          </button>

          {/* Header Text: Acts as homepage when clicked */}
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center space-x-2.5 text-left group transition-transform focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-base shadow-md group-hover:scale-105 transition-transform">
              🗳️
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {settings.siteName || 'FatBallot'}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-slate-400 -mt-1 font-medium tracking-wider uppercase">
                Sovereign Voting Core
              </span>
            </div>
          </button>
        </div>

        {/* Right: Theme toggle button before User Icon Dropdown */}
        <div className="flex items-center space-x-3">
          {/* Theme Changer (White light theme vs Blue-Black dark theme) */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#16223B] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            title={`Switch to ${theme === 'light' ? 'Blue-Black Dark' : 'White Light'} Theme`}
            aria-label="Toggle visual theme"
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5 text-indigo-700" />
            ) : (
              <Sun className="w-5 h-5 text-amber-400" />
            )}
          </button>

          {/* User Profile Avatar Dropdown */}
          <div className="relative" ref={dropdownRef}>
            {user ? (
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2.5 p-1.5 pl-2 pr-3 rounded-xl hover:bg-gray-100 dark:hover:bg-[#16223B] border border-transparent hover:border-gray-200 dark:hover:border-[#1E2E4E] transition-all focus:outline-none"
              >
                <div className="relative">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.firstName}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/40"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                      {user.firstName[0]}
                      {user.lastName[0]}
                    </div>
                  )}
                  {user.isAccredited && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#0B132B] rounded-full" title="Accredited Voter" />
                  )}
                </div>

                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400 font-mono">
                    RA-{user.raNumber} • <span className="capitalize">{user.role}</span>
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            ) : (
              <button
                onClick={() => onNavigate('login')}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
              >
                <User className="w-4 h-4" />
                <span>Sign In (RA No.)</span>
              </button>
            )}

            {/* Dropdown Menu */}
            {dropdownOpen && user && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#10192D] border border-gray-200 dark:border-[#1E2E4E] rounded-2xl shadow-xl py-2 z-50 animate-fadeIn">
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-[#1E2E4E]">
                  <p className="text-xs font-bold text-gray-900 dark:text-white">
                    {user.firstName} {user.middleName ? user.middleName + ' ' : ''}{user.lastName}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 font-mono">
                    RA-{user.raNumber}
                  </p>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 truncate mt-0.5">
                    {user.email}
                  </p>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      onNavigate('profile');
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-xs flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-[#16223B] transition-colors ${
                      currentPage === 'profile' ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-700 dark:text-slate-200'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>View Profile</span>
                  </button>

                  {user.role === 'superadmin' && (
                    <button
                      onClick={() => {
                        onNavigate('admin');
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-purple-600 dark:text-purple-400 hover:bg-gray-100 dark:hover:bg-[#16223B] flex items-center space-x-2 transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Admin Settings</span>
                    </button>
                  )}
                </div>

                <div className="border-t border-gray-100 dark:border-[#1E2E4E] pt-1">
                  <button
                    onClick={async () => {
                      setDropdownOpen(false);
                      await logout();
                      onNavigate('dashboard');
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center space-x-2 transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
};
