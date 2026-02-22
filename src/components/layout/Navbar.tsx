import React from 'react';
import { TrendingUp, Search, BarChart3, Calculator, Newspaper, LineChart, Menu, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavbarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
  { id: 'explore', label: 'Explore', icon: Search },
  { id: 'signals', label: 'Signals', icon: BarChart3 },
  { id: 'calculator', label: 'Lot Size', icon: Calculator },
  { id: 'demo', label: 'Demo Trading', icon: LineChart },
  { id: 'news', label: 'News', icon: Newspaper },
];

export const Navbar: React.FC<NavbarProps> = ({ activeSection, onSectionChange }) => {
  const { isAuthenticated, user, logout, setShowAuthModal, setAuthMode } = useAuth();

  const handleLogin = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onSectionChange('dashboard')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">TA5</span>
            </div>
            <span className="text-xl font-bold gradient-text">ta5pro</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Auth Section */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="glass" size="sm" className="gap-2">
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline">{user?.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border">
                  <DropdownMenuItem onClick={logout} className="text-destructive cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="gradient" size="sm" onClick={handleLogin}>
                Login
              </Button>
            )}

            {/* Mobile Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border w-48">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => onSectionChange(item.id)}
                      className="cursor-pointer"
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
};
