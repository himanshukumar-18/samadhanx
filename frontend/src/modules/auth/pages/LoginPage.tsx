import React, { useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { apiClient } from '../../../lib/apiClient';
import { Button } from '../../../shared/components/ui/Button';
import { Input } from '../../../shared/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { Mail, Lock, LogIn, AlertCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { setAuth } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await apiClient.post('/auth/login', { email, password });
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
          case 'admin': window.location.href = '/admin'; break;
          case 'university': window.location.href = '/university/faculty'; break;
          case 'faculty': window.location.href = '/faculty'; break;
          case 'student': window.location.href = '/student'; break;
          case 'citizen': window.location.href = '/citizen'; break;
          case 'industry': window.location.href = '/industry'; break;
          default: window.location.href = '/';
        }
      }
    } catch (err: any) {
      const errCode = err.response?.data?.error?.code;
      const message = err.response?.data?.error?.message || 'Login failed. Please check your credentials.';

      if (errCode === 'EMAIL_NOT_VERIFIED') {
        setErrorMsg('Your email is not verified. Please enter the OTP to continue.');
        toast.error('Email verification required.');
        setTimeout(() => {
          window.location.href = `/verify-otp?email=${encodeURIComponent(email)}`;
        }, 1500);
      } else if (errCode === 'ACCOUNT_PENDING_APPROVAL') {
        setErrorMsg('Your institutional account is pending administrative approval by the national governance desk.');
      } else if (errCode === 'ACCOUNT_REJECTED') {
        setErrorMsg(message);
      } else {
        setErrorMsg(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-indigo-500/20">
              <LogIn className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>Sign in to access your SamadhanX role workspace</CardDescription>
          </CardHeader>

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
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
              <a href="/register" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                Need an account? Sign up
              </a>
              <a href="/request-access" className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                Institutional Request →
              </a>
            </div>

            <Button type="submit" className="w-full mt-2" isLoading={isLoading} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Sign In
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
