import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ElectionProvider } from './context/ElectionContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { VotingPage } from './pages/VotingPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { UpdatePasswordPage } from './pages/UpdatePasswordPage';

function initialPageFromPath(): string {
  try {
    return window.location.pathname.startsWith('/update-password') ? 'update-password' : 'login';
  } catch {
    return 'login';
  }
}

const AppContent: React.FC = () => {
  const { user, isLoading, isRecovery } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>(initialPageFromPath);

  useEffect(() => {
    if (isLoading) return;
    // Password-reset link opened this page: show the recovery view.
    if (isRecovery) setCurrentPage('update-password');
  }, [user, isLoading, isRecovery]);

  useEffect(() => {
    if (isLoading) return;
    if (isRecovery) return;
    if (!user) setCurrentPage((prev) => (prev === 'update-password' ? 'login' : prev));
  }, [user, isLoading, isRecovery]);

  const isSignedIn = Boolean(user);

  const handleNavigate = (page: string) => {
    if (!isSignedIn) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleSidebar = () => {
    // Sidebar collapsibility is handled by the Sidebar's own state.
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-gray-50 dark:bg-[#080C15] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl shadow-lg animate-pulse">
            🗳️
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Loading secure ballot...</p>
        </div>
      </div>
    );
  }

  if (isRecovery) {
    return (
      <div className="h-screen w-screen bg-gray-50 dark:bg-[#080C15] flex flex-col overflow-hidden">
        <main className="flex-1 h-full overflow-y-auto min-w-0">
          <UpdatePasswordPage onNavigate={handleNavigate} />
        </main>
      </div>
    );
  }

  const isSignedInView = isSignedIn && currentPage !== 'login' && currentPage !== 'register' && currentPage !== 'forgot';

  return (
    <div className="h-screen w-screen bg-gray-50 text-gray-900 dark:bg-[#080C15] dark:text-slate-100 transition-colors flex flex-col overflow-hidden">
      {isSignedInView ? (
        <>
          <Header
            onToggleSidebar={toggleSidebar}
            onNavigate={handleNavigate}
            currentPage={currentPage}
          />
          <div className="flex flex-1 overflow-hidden relative">
            <Sidebar
              isOpen
              currentPage={currentPage}
              onNavigate={handleNavigate}
            />
            <main className="flex-1 h-full overflow-y-auto min-w-0">
              {currentPage === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
              {currentPage === 'vote' && <VotingPage onNavigate={handleNavigate} />}
              {currentPage === 'profile' && <ProfilePage onNavigate={handleNavigate} />}
              {currentPage === 'admin' && <AdminPage onNavigate={handleNavigate} />}
            </main>
          </div>
        </>
      ) : (
        <main className="flex-1 h-full overflow-y-auto min-w-0">
          {currentPage === 'login' && <LoginPage onNavigate={handleNavigate} />}
          {currentPage === 'register' && <RegisterPage onNavigate={handleNavigate} />}
          {currentPage === 'forgot' && <ForgotPasswordPage onNavigate={handleNavigate} />}
          {currentPage === 'update-password' && <UpdatePasswordPage onNavigate={handleNavigate} />}
        </main>
      )}
    </div>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ElectionProvider>
          <AppContent />
        </ElectionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;