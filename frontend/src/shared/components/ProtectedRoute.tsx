import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { ShieldAlert, LogIn } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, role, isVerified, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center mb-4 text-red-600">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Authentication Required</h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-md mb-6">
          You must be signed in to access this section of the SamadhanX platform.
        </p>
        <Button onClick={() => (window.location.href = '/login')} leftIcon={<LogIn className="w-4 h-4" />}>
          Proceed to Login
        </Button>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-950/50 rounded-full flex items-center justify-center mb-4 text-yellow-600">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Email Verification Pending</h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-md mb-6">
          Please verify your email address using the 6-digit OTP dispatched during registration.
        </p>
        <Button onClick={() => (window.location.href = `/verify-otp?email=${encodeURIComponent(user.email)}`)}>
          Enter Verification OTP
        </Button>
      </div>
    );
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/50 rounded-full flex items-center justify-center mb-4 text-rose-600">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Access Restricted (403)</h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-md mb-3">
          Your current active role (<Badge variant={role as any}>{role}</Badge>) does not have authorization to view this module.
        </p>
        <p className="text-xs text-slate-500 mb-6">
          Allowed Roles for this view: {allowedRoles.join(', ')}
        </p>
        <Button variant="outline" onClick={() => (window.location.href = '/')}>
          Return to Platform Home
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};
