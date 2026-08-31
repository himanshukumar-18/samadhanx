import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { 
  Building2, 
  GraduationCap, 
  ShieldCheck, 
  LogOut, 
  LogIn, 
  UserPlus, 
  Layers
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, role, logout } = useAuthStore();

  const getRoleDashboardPath = () => {
    switch (role) {
      case 'admin': return '/admin';
      case 'university': return '/university/faculty';
      case 'faculty': return '/faculty';
      case 'student': return '/student';
      case 'citizen': return '/citizen';
      case 'industry': return '/industry';
      default: return '/';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-2.5 font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/20">
              SX
            </div>
            <span>Samadhan<span className="text-indigo-600 dark:text-indigo-400">X</span></span>
          </a>
          
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Home</a>
            {isAuthenticated && (
              <a href={getRoleDashboardPath()} className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
                <Layers className="w-4 h-4" /> My Dashboard
              </a>
            )}
            {role === 'admin' && (
              <a href="/admin" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> Governance Desk
              </a>
            )}
            {role === 'university' && (
              <a href="/university/faculty" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
                <GraduationCap className="w-4 h-4" /> Faculty Portal
              </a>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {user.full_name || user.email}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {user.organization_name && (
                    <span className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">
                      {user.organization_name}
                    </span>
                  )}
                  <Badge variant={user.role as any}>{user.role}</Badge>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  logout();
                  window.location.href = '/login';
                }}
                leftIcon={<LogOut className="w-3.5 h-3.5" />}
              >
                Logout
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (window.location.href = '/login')}
                leftIcon={<LogIn className="w-4 h-4" />}
              >
                Log In
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => (window.location.href = '/register')}
                leftIcon={<UserPlus className="w-4 h-4" />}
              >
                Sign Up
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400"
                onClick={() => (window.location.href = '/request-access')}
                leftIcon={<Building2 className="w-4 h-4" />}
              >
                Institution / Industry
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
