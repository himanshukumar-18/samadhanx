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
        <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4 text-destructive">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-foreground mb-2">Authentication Required</h2>
        <p className="text-muted-foreground max-w-md mb-6">
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
        <div className="w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center mb-4 text-yellow-600 dark:text-yellow-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-foreground mb-2">Email Verification Pending</h2>
        <p className="text-muted-foreground max-w-md mb-6">
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
        <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4 text-destructive">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-foreground mb-2">Access Restricted (403)</h2>
        <p className="text-muted-foreground max-w-md mb-3">
          Your current active role (<Badge variant={role as 'citizen' | 'student' | 'faculty' | 'industry' | 'university' | 'admin'}>{role}</Badge>) does not have authorization to view this module.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
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
