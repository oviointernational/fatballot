import React, { useState } from "react";
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
import { ObserverPortal } from "./pages/ObserverPortal";
import { SimulatedEmailModal } from "./components/common/SimulatedEmailModal";

// Detect observer token from URL query string
function getObserverToken(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("observerToken");
  } catch {
    return null;
  }
}

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  return (
    <div className="h-screen w-screen bg-gray-50 text-gray-900 dark:bg-[#080C15] dark:text-slate-100 transition-colors flex flex-col overflow-hidden">
      {/* Header - borderless */}
      <Header
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={toggleSidebar}
        onNavigate={handleNavigate}
        currentPage={currentPage}
      />

      {/* Body Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* 20% width independently scrollable and collapsible side menu (Fixed in place) */}
        <Sidebar
          isOpen={isSidebarOpen}
          currentPage={currentPage}
          onNavigate={handleNavigate}
        />

        {/* Dynamic Main Workspace Container with its own independent scroll */}
        <main className="flex-1 h-full overflow-y-auto min-w-0">
          {currentPage === "dashboard" && <DashboardPage onNavigate={handleNavigate} />}
          {currentPage === "vote" && <VotingPage onNavigate={handleNavigate} />}
          {currentPage === "profile" && <ProfilePage onNavigate={handleNavigate} />}
          {currentPage === "admin" && <AdminPage onNavigate={handleNavigate} />}
          {currentPage === "log" && <LogPage onNavigate={handleNavigate} />}
          {currentPage === "login" && <LoginPage onNavigate={handleNavigate} />}
        </main>
      </div>

      {/* Simulated Email Magic Link Modal */}
      <SimulatedEmailModal />
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
