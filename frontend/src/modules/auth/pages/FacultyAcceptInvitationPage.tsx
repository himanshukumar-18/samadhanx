import React, { useState, useEffect } from 'react';
import { facultyApi, PublicInvitationInfo } from '../../../api/faculty';
import { Button } from '../../../shared/components/ui/Button';
import { Input } from '../../../shared/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Logo } from '../../../shared/components/Logo';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { GraduationCap, Lock, Mail, AlertCircle, ArrowRight, Landmark, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export const FacultyAcceptInvitationPage: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token') || '';

  const [invitation, setInvitation] = useState<PublicInvitationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [researchAreas, setResearchAreas] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError('No invitation token provided in URL. Please use the link sent to your email.');
      setIsLoading(false);
      return;
    }

    const fetchInvitation = async () => {
      setIsLoading(true);
      try {
        const data = await facultyApi.getInvitationDetails(token);
        setInvitation(data);
        setFullName(data.full_name);
      } catch (err: unknown) {
        const errorObj = err as {
          response?: { data?: { error?: { message?: string }; detail?: { message?: string } | string; message?: string } };
        };
        const detail = errorObj.response?.data?.detail;
        const msg =
          (typeof detail === 'object' ? detail?.message : detail) ||
          errorObj.response?.data?.error?.message ||
          errorObj.response?.data?.message ||
          'Invalid or expired faculty invitation token.';
        setLoadError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await facultyApi.acceptInvitation(token, {
        password,
        full_name: fullName.trim(),
        research_areas: researchAreas ? researchAreas.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      });

      toast.success('Invitation accepted! Please verify email OTP.');
      window.location.href = `/verify-otp?email=${encodeURIComponent(invitation?.email || '')}`;
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { error?: { message?: string }; detail?: { message?: string } | string; message?: string } };
      };
      const detail = errorObj.response?.data?.detail;
      const msg =
        (typeof detail === 'object' ? detail?.message : detail) ||
        errorObj.response?.data?.error?.message ||
        errorObj.response?.data?.message ||
        'Failed to accept invitation. Please try again.';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8 bg-background">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex justify-center">
          <a href="/">
            <Logo size="lg" />
          </a>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
              <GraduationCap className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-black">Faculty Mentorship Onboarding</CardTitle>
            <CardDescription>
              Activate your official university faculty account on SamadhanX
            </CardDescription>
          </CardHeader>

          {isLoading ? (
            <div className="p-6 pt-0 space-y-4">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : loadError ? (
            <div className="p-6 pt-0 space-y-4 text-center">
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3 text-left">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{loadError}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                If you believe this is an error, please contact your university administrator to request a fresh invitation link.
              </p>
              <div className="pt-2">
                <a href="/login">
                  <Button variant="outline" className="w-full font-bold">
                    Return to Login
                  </Button>
                </a>
              </div>
            </div>
          ) : invitation ? (
            <div className="p-6 pt-0 space-y-5">
              {/* Institution and nominator info */}
              <div className="p-4 rounded-xl bg-muted/60 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Inviting Institution</span>
                  <Badge variant="university">Verified Institution</Badge>
                </div>
                <div className="text-base font-black text-foreground flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-primary" />
                  <span>{invitation.university_name}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{invitation.department}</span>
                  </span>
                  <span>•</span>
                  <span className="font-bold text-foreground">{invitation.designation}</span>
                </div>
              </div>

              {submitError && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Official Email Address"
                  type="email"
                  value={invitation.email}
                  disabled
                  leftIcon={<Mail className="w-4 h-4" />}
                />

                <Input
                  label="Your Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Prof. / Dr. Full Name"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Create Password (min 8 chars)"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4" />}
                    required
                  />
                  <Input
                    label="Confirm Password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4" />}
                    required
                  />
                </div>

                <Input
                  label="Research Specializations (comma separated)"
                  placeholder="Machine Learning, Renewable Energy, Smart Cities"
                  value={researchAreas}
                  onChange={(e) => setResearchAreas(e.target.value)}
                />

                <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-xs text-muted-foreground">
                  🛡️ By accepting, you will be linked directly to <strong>{invitation.university_name}</strong> to mentor student innovators and review challenge solutions.
                </div>

                <Button
                  type="submit"
                  className="w-full font-bold"
                  isLoading={isSubmitting}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Accept Invitation & Activate Account
                </Button>
              </form>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
};
