import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { ThemeSelector } from '../theme/ThemeSelector';
import { Button } from '../ui/Button';
import { Logo } from '../Logo';
import { 
  Search, 
  Bell, 
  LogOut, 
  Menu, 
  X, 
  User as UserIcon,
  Settings,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { notificationsApi } from '../../../api/notifications';

export const TopNavbar: React.FC<{ onToggleMobileSidebar?: () => void; isMobileSidebarOpen?: boolean }> = ({
  onToggleMobileSidebar,
  isMobileSidebarOpen,
}) => {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { data: notifications } = useQuery({
    queryKey: ['unread-notifications-count'],
    queryFn: () => notificationsApi.listNotifications(10),
    enabled: isAuthenticated,
  });

  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((n) => !n.is_read).length
    : 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6">
        
        {/* Left: Mobile Drawer Trigger + Brand Logo Anchor */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 min-w-0">
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none"
            aria-label="Toggle navigation drawer"
          >
            {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <a href="/" className="flex items-center gap-2 focus:outline-none rounded-xl">
            <Logo size="md" />
          </a>
        </div>

        {/* Center: Desktop Global Search Bar */}
        <div className="flex-1 max-w-lg hidden md:block px-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                window.location.href = `/explore?search=${encodeURIComponent(searchQuery)}`;
              }
            }}
            className="relative flex items-center"
          >
            <Search className="absolute left-3.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search problems, skills, locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-muted/70 hover:bg-muted focus:bg-card rounded-full pl-10 pr-12 py-2 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all h-10"
            />
            <kbd className="absolute right-3 hidden lg:inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-mono text-muted-foreground bg-background/80 border border-border rounded">
              ⌘K
            </kbd>
          </form>
        </div>

        {/* Right: Actions, Theme, Notifications & User Menu */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          {/* Mobile Search Toggle Icon */}
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Search challenges"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Theme Selector */}
          <ThemeSelector />

          {/* Notifications Bell */}
          {isAuthenticated && (
            <a
              href="/notifications"
              className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center border border-card">
                  {unreadCount}
                </span>
              )}
            </a>
          )}

          {/* Real User Profile / Auth Actions */}
          {isAuthenticated && user ? (
            <div className="relative pl-1" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-primary/40 transition-all focus:outline-none min-h-[44px] min-w-[44px]"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs uppercase border border-primary/30">
                  {user.email ? user.email.slice(0, 2) : 'SX'}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:inline" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 py-2 bg-card rounded-2xl shadow-2xl border border-border z-50 animate-fade-in text-sm">
                  <div className="px-4 py-2.5 border-b border-border">
                    <p className="font-bold text-foreground truncate">{user.email}</p>
                    <p className="text-xs text-primary font-semibold uppercase tracking-wider capitalize mt-0.5">
                      Role: {user.role}
                    </p>
                  </div>

                  <a
                    href="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-foreground hover:bg-muted transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <span>Your Profile</span>
                  </a>

                  {user.role === 'admin' && (
                    <a
                      href="/admin"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-foreground hover:bg-muted transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <span>Admin Portal</span>
                    </a>
                  )}

                  <a
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-foreground hover:bg-muted transition-colors"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <span>Account Settings</span>
                  </a>

                  <div className="pt-1 mt-1 border-t border-border">
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                        window.location.href = '/login';
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-destructive hover:bg-destructive/10 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex min-h-[38px] px-3.5 text-sm font-semibold" onClick={() => (window.location.href = '/login')}>
                Sign In
              </Button>
              <Button variant="primary" size="sm" className="min-h-[38px] px-4 text-sm font-bold shadow-xs" onClick={() => (window.location.href = '/register')}>
                Sign Up
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Expandable Search Bar */}
      {mobileSearchOpen && (
        <div className="md:hidden px-4 pb-3 pt-1 border-t border-border bg-card animate-fade-in">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                window.location.href = `/explore?search=${encodeURIComponent(searchQuery)}`;
              }
            }}
            className="relative flex items-center"
          >
            <Search className="absolute left-3.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search problems, skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-muted/80 rounded-full pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:outline-none"
            />
          </form>
        </div>
      )}
    </header>
  );
};
