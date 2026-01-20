import React from 'react';
import { TrendingUp, BarChart3, Calculator, Newspaper, Sun, Moon, Monitor, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
  { id: 'signals', label: 'Signals', icon: BarChart3 },
  { id: 'calculator', label: 'Lot Size', icon: Calculator },
  { id: 'news', label: 'News', icon: Newspaper },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSectionChange }) => {
  const { isAuthenticated, user, logout, setShowAuthModal, setAuthMode } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleLogin = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light': return <Sun className="w-4 h-4" />;
      case 'dark': return <Moon className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar-background border-r border-sidebar-border flex flex-col z-50">
      {/* Logo */}
      <div
        className="flex items-center gap-3 p-5 cursor-pointer hover:opacity-80 transition-opacity border-b border-sidebar-border"
        onClick={() => onSectionChange('dashboard')}
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center shadow-lg">
          <span className="text-primary-foreground font-bold text-lg">T5</span>
        </div>
        <span className="text-xl font-bold gradient-text">TA5</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
              {getThemeIcon()}
              <span className="capitalize">{theme} Theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => setTheme('light')} className="cursor-pointer">
              <Sun className="w-4 h-4 mr-2" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')} className="cursor-pointer">
              <Moon className="w-4 h-4 mr-2" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')} className="cursor-pointer">
              <Monitor className="w-4 h-4 mr-2" />
              System Default
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Auth */}
        {isAuthenticated ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-3 py-2 bg-accent/50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start gap-3 text-destructive hover:text-destructive">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        ) : (
          <Button variant="gradient" size="sm" onClick={handleLogin} className="w-full">
            Login / Register
          </Button>
        )}
      </div>
    </aside>
  );
};
