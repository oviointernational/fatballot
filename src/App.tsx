import React, { useState, useEffect } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ElectionProvider } from "./context/ElectionContext";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { VotingPage } from "./pages/VotingPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminPage } from "./pages/AdminPage";
import { LogPage } from "./pages/LogPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { UpdatePasswordPage } from "./pages/UpdatePasswordPage";
import { ObserverPortal } from "./pages/ObserverPortal";

// Detect observer token from URL query string
function getObserverToken(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("observerToken");
  } catch {
    return null;
  }
}

const AUTH_PAGES = ["login", "register", "forgot-password", "update-password"];

function initialPage(): string {
  try {
    const hash = window.location.hash;
    const path = window.location.pathname.toLowerCase();
    if (hash.includes("access_token") || path.includes("update-password")) {
      return "update-password";
    }
  } catch {
    /* ignore */
  }
  return "login";
}

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>(initialPage);
  const [viewport, setViewport] = useState<{ isMobile: boolean; sidebarOpen: boolean }>(() => {
    const wide = typeof window !== 'undefined' && window.innerWidth >= 1024;
    return { isMobile: !wide, sidebarOpen: wide };
  });

  // Desktop keeps the sidebar open by default; mobile (and below) collapses
  // it by default so the app content gets full screen width.
  useEffect(() => {
    const onResize = () => {
      const wide = window.innerWidth >= 1024;
      setViewport({ isMobile: !wide, sidebarOpen: wide });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    setViewport(v => (v.isMobile && v.sidebarOpen ? { ...v, sidebarOpen: false } : v));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleSidebar = () => {
    setViewport(v => ({ ...v, sidebarOpen: !v.sidebarOpen }));
  };

  // Signed-in users are never parked on an auth screen; signed-out users
  // are never parked inside the app shell.
  useEffect(() => {
    if (user && AUTH_PAGES.includes(currentPage)) {
      setCurrentPage("dashboard");
    } else if (!user && !isLoading && !AUTH_PAGES.includes(currentPage)) {
      setCurrentPage("login");
    }
  }, [user, isLoading, currentPage]);

  if (!user && !isLoading) {
    return (
      <div className="h-screen w-screen overflow-y-auto bg-gray-50 text-gray-900 dark:bg-[#080C15] dark:text-slate-100 transition-colors">
        {currentPage === "register" && <RegisterPage onNavigate={handleNavigate} />}
        {currentPage === "forgot-password" && <ForgotPasswordPage onNavigate={handleNavigate} />}
        {currentPage === "update-password" && <UpdatePasswordPage onNavigate={handleNavigate} />}
        {currentPage === "login" && <LoginPage onNavigate={handleNavigate} />}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-50 text-gray-900 dark:bg-[#080C15] dark:text-slate-100 transition-colors flex flex-col overflow-hidden">
      {/* Header - borderless */}
      <Header
        isSidebarOpen={viewport.sidebarOpen}
        onToggleSidebar={toggleSidebar}
        onNavigate={handleNavigate}
        currentPage={currentPage}
      />

      {/* Body Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile drawer backdrop */}
        {viewport.isMobile && viewport.sidebarOpen && (
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
            onClick={toggleSidebar}
            aria-hidden="true"
          />
        )}

        {/* 20% width independently scrollable and collapsible side menu (overlay drawer on mobile) */}
        <Sidebar
          isOpen={viewport.sidebarOpen}
          mobile={viewport.isMobile}
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onCloseMobile={viewport.isMobile ? toggleSidebar : undefined}
        />

        {/* Dynamic Main Workspace Container with its own independent scroll */}
        <main className="flex-1 h-full overflow-y-auto min-w-0">
          {currentPage === "dashboard" && <DashboardPage onNavigate={handleNavigate} />}
          {currentPage === "vote" && <VotingPage onNavigate={handleNavigate} />}
          {currentPage === "profile" && <ProfilePage onNavigate={handleNavigate} />}
          {currentPage === "admin" && <AdminPage onNavigate={handleNavigate} />}
          {currentPage === "log" && <LogPage onNavigate={handleNavigate} />}
        </main>
      </div>
    </div>
  );
};

export function App() {
  // Check for observer token before rendering the normal app
  const observerToken = getObserverToken();
  if (observerToken) {
    return (
      <ThemeProvider>
        <ObserverPortal token={observerToken} />
      </ThemeProvider>
    );
  }

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