import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect, lazy, Suspense } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { AuthModal } from "@/components/auth/AuthModal";
import { Dashboard } from "@/components/dashboard/Dashboard";

// Lazy load non-critical sections to reduce initial bundle size
const SignalGenerator = lazy(() => import("@/components/signals/SignalGenerator").then(m => ({ default: m.SignalGenerator })));
const LotSizeCalculator = lazy(() => import("@/components/calculator/LotSizeCalculator").then(m => ({ default: m.LotSizeCalculator })));
const NewsCalendar = lazy(() => import("@/components/news/NewsCalendar").then(m => ({ default: m.NewsCalendar })));

const queryClient = new QueryClient();

// Loading fallback component
const SectionLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const MainApp = () => {
  const [activeSection, setActiveSection] = useState('dashboard');

  // Listen for cross-component navigation events
  useEffect(() => {
    const handler = (e: CustomEvent) => setActiveSection(e.detail);
    window.addEventListener('navigate-section', handler as EventListener);
    return () => window.removeEventListener('navigate-section', handler as EventListener);
  }, []);

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard': return <Dashboard />;
      case 'signals': return <Suspense fallback={<SectionLoader />}><SignalGenerator /></Suspense>;
      case 'calculator': return <Suspense fallback={<SectionLoader />}><LotSizeCalculator /></Suspense>;
      case 'news': return <Suspense fallback={<SectionLoader />}><NewsCalendar /></Suspense>;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>
      
      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <MobileNav activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>
      
      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="pt-16 lg:pt-6 pb-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          {renderSection()}
        </div>
      </main>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthModal />
            <Routes>
              <Route path="/" element={<MainApp />} />
              <Route path="*" element={<MainApp />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
