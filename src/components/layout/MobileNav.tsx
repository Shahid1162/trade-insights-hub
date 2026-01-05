import React from 'react';
import { TrendingUp, Search, BarChart3, Calculator, Newspaper, LineChart, Menu, Sun, Moon, Monitor, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface MobileNavProps {
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

export const MobileNav: React.FC<MobileNavProps> = ({ activeSection, onSectionChange }) => {
  const { isAuthenticated, user, logout, setShowAuthModal, setAuthMode } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);

  const handleLogin = () => {
    setAuthMode('login');
    setShowAuthModal(true);
    setOpen(false);
  };

  const handleNavigation = (id: string) => {
    onSectionChange(id);
    setOpen(false);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light': return <Sun className="w-4 h-4" />;
      case 'dark': return <Moon className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-xl border-b border-border z-50 lg:hidden">
      <div className="flex items-center justify-between h-full px-4">
        {/* Logo */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => handleNavigation('dashboard')}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">T5</span>
          </div>
          <span className="text-lg font-bold gradient-text">TA5</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                {getThemeIcon()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex flex-col h-full">
                {/* Nav Items */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigation(item.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>

                {/* Auth */}
                <div className="p-4 border-t border-border">
                  {isAuthenticated ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 px-3 py-2 bg-accent/50 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user?.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { logout(); setOpen(false); }} className="w-full justify-start gap-3 text-destructive hover:text-destructive">
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
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
