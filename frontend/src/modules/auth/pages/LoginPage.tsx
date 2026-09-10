import React, { useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { apiClient } from '../../../api/client';
import { Button } from '../../../shared/components/ui/Button';
import { Input } from '../../../shared/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { Logo } from '../../../shared/components/Logo';
import { Mail, Lock, AlertCircle, ArrowRight, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingApprovalInfo, setPendingApprovalInfo] = useState<{ message: string } | null>(null);

  const { setAuth } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setPendingApprovalInfo(null);

    try {
      const response = await apiClient.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      const data = response.data?.data;

      if (data && data.access_token) {
        const meResponse = await apiClient.get('/auth/me', {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        const userProfile = meResponse.data?.data;

        setAuth({
          user: userProfile || {
            id: data.user_id,
            email: data.email,
            role: data.role,
            is_verified: data.is_verified,
            is_approved: data.is_approved,
            is_active: true,
          },
          tokens: {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          },
        });

        toast.success('Signed in successfully!');

        switch (data.role) {
          case 'admin':
            window.location.href = '/admin';
            break;
          case 'university':
            window.location.href = '/university/faculty';
            break;
          case 'faculty':
            window.location.href = '/faculty';
            break;
          case 'student':
            window.location.href = '/student';
            break;
          case 'citizen':
            window.location.href = '/citizen';
            break;
          case 'industry':
            window.location.href = '/industry';
            break;
          default:
            window.location.href = '/';
        }
      }
    } catch (err: unknown) {
      const errorObj = err as {
        response?: {
          data?: {
            error?: { code?: string; message?: string };
            detail?: { code?: string; message?: string } | string;
            message?: string;
          };
        };
      };

      const detail = errorObj.response?.data?.detail;
      const detailObj = typeof detail === 'object' ? detail : null;
      const errCode = detailObj?.code || errorObj.response?.data?.error?.code;
      const message =
        detailObj?.message ||
        (typeof detail === 'string' ? detail : null) ||
        errorObj.response?.data?.error?.message ||
        errorObj.response?.data?.message ||
        'Login failed. Please check your credentials.';

      if (errCode === 'EMAIL_NOT_VERIFIED') {
        setErrorMsg('Your email is not verified. Please enter the OTP to continue.');
        toast.error('Email verification required.');
        setTimeout(() => {
          window.location.href = `/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}`;
        }, 1500);
      } else if (errCode === 'ACCOUNT_PENDING_APPROVAL') {
        setPendingApprovalInfo({
          message:
            message ||
            'Your institutional account application is currently under administrative verification by the National Governance Desk.',
        });
      } else if (errCode === 'ACCOUNT_REJECTED') {
        setErrorMsg(message || 'Your institutional application was not approved by the governance desk.');
      } else {
        setErrorMsg(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <a href="/">
            <Logo size="lg" />
          </a>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-black">Welcome Back</CardTitle>
            <CardDescription>Sign in to access your SamadhanX role workspace</CardDescription>
          </CardHeader>

          {pendingApprovalInfo ? (
            <div className="p-6 pt-0 space-y-4">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-sm text-amber-900 dark:text-amber-100">
                  <Clock className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>Institutional Review in Progress</span>
                </div>
                <p className="leading-relaxed text-xs">
                  {pendingApprovalInfo.message}
                </p>
                <div className="pt-2 border-t border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300">
                  🛡️ Colleges, universities, and industry partners undergo mandatory national governance verification to prevent impersonation. Once approved, you will receive an activation email.
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setPendingApprovalInfo(null)}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold"
                >
                  ← Try different account
                </button>
                <a
                  href="/request-access"
                  className="text-xs text-primary hover:underline font-bold"
                >
                  Institutional Desk Info →
                </a>
              </div>
            </div>
          ) : (
            <div className="p-6 pt-0">
              {errorMsg && (
                <div className="mb-5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5 font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>{errorMsg}</div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  required
                />

                <div className="flex items-center justify-between text-xs pt-1">
                  <a href="/register" className="text-primary hover:underline font-semibold">
                    Need an account? Sign up
                  </a>
                  <a href="/request-access" className="text-muted-foreground hover:text-foreground font-medium">
                    Institutional Access Request →
                  </a>
                </div>

                <Button
                  type="submit"
                  className="w-full mt-2 font-bold"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Sign In
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
