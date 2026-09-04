import React, { useState } from 'react';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  MapPin,
  ShieldCheck,
  UserX,
} from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { ProblemPost } from '../../feed/components/ProblemPost';
import { usePublicProfile, useUserPublicProblems } from '../../../hooks/usePublicProfile';
import { useAuthStore } from '../../../store/authStore';
import { useLanguageStore } from '../../../store/languageStore';
import { getTranslation } from '../../../lib/translations';
import { LANGUAGE_OPTIONS } from '../../../config/categories';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_AVATAR = 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function roleBadgeLabel(role: string, lang: string): string {
  const map: Record<string, { en: string; hi: string }> = {
    citizen:    { en: 'Citizen',    hi: 'नागरिक' },
    student:    { en: 'Student',    hi: 'छात्र' },
    faculty:    { en: 'Faculty',    hi: 'शिक्षक' },
    industry:   { en: 'Industry',   hi: 'उद्योग' },
    university: { en: 'University', hi: 'विश्वविद्यालय' },
    admin:      { en: 'Admin',      hi: 'प्रशासक' },
  };
  return (map[role.toLowerCase()] ?? { en: role, hi: role })[lang === 'hi' ? 'hi' : 'en'];
}

// ---------------------------------------------------------------------------
// Skeleton loading state
// ---------------------------------------------------------------------------

const ProfileSkeleton: React.FC = () => (
  <div className="space-y-4 pb-12 w-full min-w-0">
    <Skeleton className="h-8 w-24" />
    <Card className="p-5 space-y-4 border-border rounded-2xl">
      <div className="flex items-start gap-4">
        <Skeleton className="w-20 h-20 rounded-2xl flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <Skeleton className="h-12 w-full" />
    </Card>
    <Card className="p-5 border-border rounded-2xl">
      <Skeleton className="h-4 w-32 mb-3" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    </Card>
    <Skeleton className="h-32 w-full rounded-2xl" />
    <Skeleton className="h-32 w-full rounded-2xl" />
  </div>
);

// ---------------------------------------------------------------------------
// Main Public Profile Page
// ---------------------------------------------------------------------------

interface PublicProfilePageProps {
  userId: string | null | undefined;
}

export const PublicProfilePage: React.FC<PublicProfilePageProps> = ({ userId }) => {
  const { user: currentUser } = useAuthStore();
  const { language } = useLanguageStore();
  const t = (key: string) => getTranslation(language, key);

  const [problemOffset, setProblemOffset] = useState(0);
  const LIMIT = 10;

  const { data: profile, isLoading, isError, error } = usePublicProfile(userId);
  const { data: problems = [], isLoading: problemsLoading } = useUserPublicProblems(
    userId,
    problemOffset,
    LIMIT,
  );

  // Back navigation: browser history, fall back to feed
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  // If viewing own profile, redirect to /profile
  if (userId && currentUser?.id === userId) {
    window.location.replace('/profile');
    return null;
  }

  // Invalid UUID or missing param
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return (
      <div className="space-y-4 pb-12">
        <button onClick={handleBack} className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> {t('back')}
        </button>
        <EmptyState
          icon={UserX}
          title="Profile not found"
          description="This profile link is invalid or the user does not exist."
          actionLabel="Back to Feed"
          onAction={() => (window.location.href = '/')}
        />
      </div>
    );
  }

  if (isLoading) return <ProfileSkeleton />;

  // API error — check status
  const httpStatus = (error as any)?.response?.status;
  if (isError || !profile) {
    const is404 = httpStatus === 404;
    return (
      <div className="space-y-4 pb-12">
        <button onClick={handleBack} className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> {t('back')}
        </button>
        <EmptyState
          icon={UserX}
          title={is404 ? 'Profile not found' : 'Unable to load profile'}
          description={
            is404
              ? 'This user does not exist or has been removed.'
              : 'Please check your connection and try again.'
          }
          actionLabel="Back to Feed"
          onAction={() => (window.location.href = '/')}
        />
      </div>
    );
  }

  // Suspended / deactivated profile
  if (!profile.account_available) {
    return (
      <div className="space-y-4 pb-12">
        <button onClick={handleBack} className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> {t('back')}
        </button>
        <Card className="p-8 text-center border-border rounded-2xl space-y-3">
          <UserX className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-base font-black text-foreground">
            {language === 'hi' ? 'यह प्रोफ़ाइल उपलब्ध नहीं है' : 'This profile is currently unavailable'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {language === 'hi'
              ? 'यह खाता अस्थायी रूप से निलंबित या निष्क्रिय हो सकता है।'
              : 'This account may be temporarily suspended or deactivated.'}
          </p>
        </Card>
      </div>
    );
  }

  const displayName = profile.full_name || 'Community Member';
  const { activity } = profile;
  const locationParts = [profile.city, profile.district, profile.state].filter(Boolean);
  const languageLabel = LANGUAGE_OPTIONS.find((l) => l.value === profile.preferred_language)?.label;

  return (
    <div className="space-y-4 pb-16 w-full min-w-0" aria-label="Public user profile">

      {/* ── Back Navigation ─────────────────────────────────── */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors group"
        aria-label="Go back"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        {t('back')}
      </button>

      {/* ── Profile Header Card ─────────────────────────────── */}
      <Card className="p-5 sm:p-6 space-y-4 border-border rounded-2xl" role="region" aria-label="Profile header">
        <div className="flex items-start gap-4">
          {/* Avatar — non-clickable on own page */}
          <div className="flex-shrink-0">
            {profile.profile_picture_url ? (
              <img
                src={profile.profile_picture_url}
                alt={displayName}
                onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                className="w-20 h-20 rounded-2xl ring-4 ring-border object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl ring-4 ring-border bg-primary text-primary-foreground font-black text-xl flex items-center justify-center uppercase select-none">
                {getInitials(displayName)}
              </div>
            )}
          </div>

          {/* Name + Role + Member Since */}
          <div className="flex-1 min-w-0 space-y-1">
            <h1 className="text-lg font-black text-foreground truncate">{displayName}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="student" className="text-xs uppercase">
                {roleBadgeLabel(profile.role, language)}
              </Badge>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {language === 'hi' ? 'सक्रिय सदस्य' : 'Active Member'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {language === 'hi' ? 'सदस्यता से ' : 'Member since '}{profile.member_since}
            </p>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-foreground leading-relaxed">"{profile.bio}"</p>
        )}

        {/* Location + Language */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {locationParts.length > 0 && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              {locationParts.join(', ')}
            </span>
          )}
          {languageLabel && (
            <span className="flex items-center gap-1 font-medium">
              🌐 {languageLabel}
            </span>
          )}
        </div>
      </Card>

      {/* ── Community Interests ─────────────────────────────── */}
      {profile.interests.length > 0 && (
        <Card className="p-5 border-border rounded-2xl space-y-3" role="region" aria-label="Community interests">
          <h2 className="text-sm font-black text-foreground">
            {language === 'hi' ? 'सामुदायिक रुचियाँ' : 'Community Interests'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((cat) => (
              <span
                key={cat}
                className="px-3 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20"
              >
                {cat}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* ── Civic Impact ────────────────────────────────────── */}
      <Card className="p-5 border-border rounded-2xl space-y-3" role="region" aria-label="Civic impact statistics">
        <h2 className="text-sm font-black text-foreground">
          {language === 'hi' ? 'नागरिक प्रभाव' : 'Civic Impact'}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: language === 'hi' ? 'दर्ज समस्याएँ' : 'Reported',
              value: activity.submitted,
              icon: <FileText className="w-4 h-4 text-primary" />,
              bg: 'bg-primary/10',
            },
            {
              label: language === 'hi' ? 'स्वीकृत' : 'Approved',
              value: activity.approved,
              icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
              bg: 'bg-emerald-500/10',
            },
            {
              label: language === 'hi' ? 'हल' : 'Solved',
              value: activity.solved,
              icon: <Award className="w-4 h-4 text-purple-500" />,
              bg: 'bg-purple-500/10',
            },
          ].map(({ label, value, icon, bg }) => (
            <div key={label} className={`flex flex-col items-center p-3 rounded-xl ${bg} gap-1`}>
              {icon}
              <span className="text-2xl font-black text-foreground">{value}</span>
              <span className="text-[11px] text-muted-foreground text-center leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Public Contributions ────────────────────────────── */}
      <div role="region" aria-label="Public contributions">
        <h2 className="text-sm font-black text-foreground mb-3">
          {language === 'hi' ? 'सार्वजनिक समस्याएँ' : 'Public Contributions'}
        </h2>

        {problemsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : problems.length > 0 ? (
          <div className="space-y-4">
            {problems.map((problem: any) => (
              <ProblemPost key={problem.id} problem={problem} />
            ))}

            {/* Load More */}
            {problems.length === LIMIT && (
              <button
                onClick={() => setProblemOffset((o) => o + LIMIT)}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-primary hover:bg-primary/5 rounded-2xl border border-dashed border-primary/40 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
                {language === 'hi' ? 'और समस्याएँ देखें' : 'Load More'}
              </button>
            )}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title={language === 'hi' ? 'कोई सार्वजनिक समस्या नहीं' : 'No public contributions yet'}
            description={
              language === 'hi'
                ? 'इस नागरिक ने अभी तक कोई समस्या दर्ज नहीं की है।'
                : 'This community member has not yet reported any public issues.'
            }
          />
        )}
      </div>
    </div>
  );
};
