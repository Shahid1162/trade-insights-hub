import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { WatchlistProvider } from "@/contexts/WatchlistContext";
import { Navbar } from "@/components/layout/Navbar";
import { AuthModal } from "@/components/auth/AuthModal";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { Explore } from "@/components/explore/Explore";
import { SignalGenerator } from "@/components/signals/SignalGenerator";
import { LotSizeCalculator } from "@/components/calculator/LotSizeCalculator";
import { DemoTrading } from "@/components/demo/DemoTrading";
import { NewsCalendar } from "@/components/news/NewsCalendar";

const queryClient = new QueryClient();

const MainApp = () => {
  const [activeSection, setActiveSection] = useState('dashboard');

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard': return <Dashboard />;
      case 'explore': return <Explore />;
      case 'signals': return <SignalGenerator />;
      case 'calculator': return <LotSizeCalculator />;
      case 'demo': return <DemoTrading />;
      case 'news': return <NewsCalendar />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar activeSection={activeSection} onSectionChange={setActiveSection} />
      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {renderSection()}
      </main>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WatchlistProvider>
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
      </WatchlistProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
