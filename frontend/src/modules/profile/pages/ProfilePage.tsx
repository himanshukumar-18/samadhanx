import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Badge } from '../../../shared/components/ui/Badge';
import { useAuthStore } from '../../../store/authStore';
import { useLanguageStore } from '../../../store/languageStore';
import { getTranslation } from '../../../lib/translations';
import { getRoleConfig } from '../../../config/roles';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import {
  Award,
  CheckCircle2,
  Settings,
  User,
  Inbox,
  Globe,
  Github,
  Linkedin,
  Camera,
  UserPlus,
  UserCheck,
  Loader2,
  FileText,
  Clock,
  CheckCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { profileApi } from '../../../api/profile';
import { problemsApi } from '../../../api/problems';
import { socialApi } from '../../../api/social';
import { mapApiProblem } from '../../../lib/problemMapper';
import { ProblemPost } from '../../feed/components/ProblemPost';
import { useProfile, useUpdateProfile } from '../../../hooks/useProfile';
import toast from 'react-hot-toast';

const DEFAULT_AVATAR_FALLBACK = 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg';

export const ProfilePage: React.FC = () => {
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const t = (key: string) => getTranslation(language, key);

  const queryClient = useQueryClient();
  const pathParts = window.location.pathname.split('/');
  const isPublicView = pathParts.includes('user') && pathParts.length > 3;
  const targetUserId = isPublicView ? pathParts[pathParts.length - 1] : undefined;
  const isSelf = !targetUserId || targetUserId === user?.id;

  const activeRole = isSelf ? (user?.role || 'citizen') : 'citizen';
  const isCitizenRole = (activeRole as string) === 'citizen' || (activeRole as string) === 'community';
  const config = getRoleConfig(activeRole);
  const [activeTab, setActiveTab] = useState<'problems' | 'solutions' | 'badges'>('problems');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const { data: myProfile, refetch: refetchSelf } = useProfile();

  const { data: publicProfile } = useQuery({
    queryKey: ['public-profile', targetUserId],
    queryFn: () => (targetUserId ? profileApi.getPublicProfile(targetUserId) : null),
    enabled: !isSelf && Boolean(targetUserId),
  });

  const { data: socialStats, refetch: refetchSocial } = useQuery({
    queryKey: ['social-stats', targetUserId || user?.id],
    queryFn: () => (targetUserId || user?.id ? socialApi.getConnectionStats(targetUserId || user!.id) : null),
    enabled: Boolean(targetUserId || user?.id),
  });

  const { data: myProblems, isLoading: postsLoading } = useQuery({
    queryKey: ['user-problems', targetUserId || user?.id],
    queryFn: () => (isSelf ? problemsApi.getMyProblems() : problemsApi.listProblems({ created_by_id: targetUserId })),
  });

  const updateProfileMutation = useUpdateProfile();

  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isFollowingPending, setIsFollowingPending] = useState(false);

  const profile = isSelf ? myProfile : publicProfile;

  const openEditModal = () => {
    if (profile) {
      setHeadline(profile.headline || '');
      setBio(profile.bio || '');
      setWebsiteUrl(profile.website_url || profile.website || '');
      setGithubUrl(profile.github_url || '');
      setLinkedinUrl(profile.linkedin_url || '');
    }
    setFieldErrors({});
    setEditModalOpen(true);
  };

  const validateUrls = () => {
    const errors: Record<string, string> = {};
    const urlPattern = /^(https?:\/\/)?([\w.-]+)+[\w\-_~:/?#[\]@!$&'()*+,;=.]+$/i;

    if (headline.length > 120) {
      errors.headline = 'Headline must be 120 characters or less.';
    }
    if (bio.length > 500) {
      errors.bio = 'Bio must be 500 characters or less.';
    }
    if (websiteUrl && !urlPattern.test(websiteUrl)) {
      errors.websiteUrl = 'Invalid website URL format.';
    }
    if (githubUrl && (!urlPattern.test(githubUrl) || !githubUrl.includes('github.com'))) {
      errors.githubUrl = 'GitHub URL must be a valid github.com link.';
    }
    if (linkedinUrl && (!urlPattern.test(linkedinUrl) || !linkedinUrl.includes('linkedin.com'))) {
      errors.linkedinUrl = 'LinkedIn URL must be a valid linkedin.com link.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleToggleFollow = async () => {
    if (!targetUserId) return;
    try {
      setIsFollowingPending(true);
      if (socialStats?.is_following) {
        await socialApi.unfollowUser(targetUserId);
        toast.success(language === 'hi' ? 'फ़ॉलो हटाया गया' : 'Unfollowed user');
      } else {
        await socialApi.followUser(targetUserId);
        toast.success(language === 'hi' ? 'फ़ॉलो किया जा रहा है!' : 'Following user!');
      }
      refetchSocial();
    } catch {
      toast.error('Failed to update follow status.');
    } finally {
      setIsFollowingPending(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUrls()) return;

    try {
      await updateProfileMutation.mutateAsync({
        headline: headline.trim() || undefined,
        bio: bio.trim() || undefined,
        website_url: websiteUrl.trim() || undefined,
        github_url: githubUrl.trim() || undefined,
        linkedin_url: linkedinUrl.trim() || undefined,
      });
      setEditModalOpen(false);
      refetchSelf();
    } catch (err: any) {
      const errCode = err?.response?.data?.error?.code || err?.response?.data?.detail?.code;
      const errMsg = err?.response?.data?.error?.message || err?.response?.data?.detail?.message;

      if (errCode === 'INVALID_PROFILE_URL') {
        toast.error(errMsg || 'Website or profile URL is invalid.');
      } else if (errCode === 'HEADLINE_TOO_LONG') {
        setFieldErrors((prev) => ({ ...prev, headline: 'Headline exceeds 120 chars.' }));
      } else if (errCode === 'BIO_TOO_LONG') {
        setFieldErrors((prev) => ({ ...prev, bio: 'Bio exceeds 500 chars.' }));
      } else {
        toast.error(errMsg || 'Failed to save profile updates.');
      }
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setIsUploadingAvatar(true);
      const res = await profileApi.uploadMedia(file, 'avatar');
      if (res.url) {
        await updateProfileMutation.mutateAsync({ avatar_url: res.url });
      }
      toast.success(language === 'hi' ? 'अवतार चित्र सफलतापूर्वक अपडेट किया गया!' : 'Avatar image updated successfully!');
      await queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      await queryClient.invalidateQueries({ queryKey: ['my-profile-detail'] });
      refetchSelf();
    } catch {
      toast.error('Failed to upload avatar image.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Community Solver';
  const stats = profile?.stats;

  return (
    <div className="space-y-4 pb-12 w-full min-w-0">
      {/* 1. Header Banner & Avatar Card */}
      <Card className="p-0 overflow-hidden border-border rounded-2xl">
        <div className="h-28 bg-gradient-to-r from-indigo-600 to-purple-600 relative border-b border-border" />
        <div className="p-5 sm:p-6 pt-0 space-y-4">
          <div className="flex items-end justify-between -mt-12 mb-2">
            <div className="relative group">
              {isUploadingAvatar ? (
                <div className="w-24 h-24 rounded-2xl ring-4 ring-card shadow-lg bg-muted flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : profile?.avatar_url || profile?.profile_picture_url ? (
                <img
                  src={profile.avatar_url || profile.profile_picture_url!}
                  alt={displayName}
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR_FALLBACK;
                  }}
                  className="w-24 h-24 rounded-2xl ring-4 ring-card shadow-lg object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl ring-4 ring-card shadow-lg bg-primary text-primary-foreground font-black text-2xl flex items-center justify-center uppercase">
                  {displayName.slice(0, 2)}
                </div>
              )}
              {isSelf && !isUploadingAvatar && (
                <label className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white">
                  <Camera className="w-6 h-6" />
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isSelf ? (
                <Button variant="outline" size="sm" onClick={openEditModal}>
                  <Settings className="w-4 h-4 mr-1.5" /> {t('edit_profile')}
                </Button>
              ) : (
                <Button
                  variant={socialStats?.is_following ? 'outline' : 'primary'}
                  size="sm"
                  isLoading={isFollowingPending}
                  onClick={handleToggleFollow}
                  leftIcon={socialStats?.is_following ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                >
                  {socialStats?.is_following ? (language === 'hi' ? 'फ़ॉलो कर रहे हैं' : 'Following') : (language === 'hi' ? 'फ़ॉलो करें' : 'Follow')}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-foreground">{displayName}</h1>
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <Badge variant="student" className="text-xs uppercase">
                {language === 'hi' ? 'नागरिक / समुदाय' : config.displayName}
              </Badge>
            </div>
            {profile?.headline && <p className="text-sm font-semibold text-foreground">{profile.headline}</p>}
            <p className="text-sm text-muted-foreground">{profile?.email || user?.email}</p>
            {profile?.organization_name && (
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{profile.organization_name}</p>
            )}
          </div>

          {/* Bio */}
          {profile?.bio && <p className="text-xs text-foreground leading-relaxed max-w-2xl">{profile.bio}</p>}

          {/* Stats Bar */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-border">
              <div className="p-2.5 bg-muted/40 rounded-xl flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs font-bold text-foreground">{stats.problems_submitted}</p>
                  <p className="text-[10px] text-muted-foreground">{t('stat_submitted')}</p>
                </div>
              </div>
              <div className="p-2.5 bg-muted/40 rounded-xl flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-xs font-bold text-foreground">{stats.problems_pending}</p>
                  <p className="text-[10px] text-muted-foreground">{t('stat_pending')}</p>
                </div>
              </div>
              <div className="p-2.5 bg-muted/40 rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <div>
                  <p className="text-xs font-bold text-foreground">{stats.problems_approved}</p>
                  <p className="text-[10px] text-muted-foreground">{t('stat_approved')}</p>
                </div>
              </div>
              <div className="p-2.5 bg-muted/40 rounded-xl flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-500" />
                <div>
                  <p className="text-xs font-bold text-foreground">{stats.problems_solved}</p>
                  <p className="text-[10px] text-muted-foreground">{t('stat_solved')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Network & Social Links */}
          <div className="flex items-center justify-between flex-wrap gap-4 pt-2 border-t border-border">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <strong className="font-black text-foreground">{socialStats?.followers_count ?? profile?.followers_count ?? 0}</strong>{' '}
                <span className="text-muted-foreground text-xs">{t('followers')}</span>
              </div>
              <div>
                <strong className="font-black text-foreground">{socialStats?.following_count ?? profile?.following_count ?? 0}</strong>{' '}
                <span className="text-muted-foreground text-xs">{t('following')}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-muted-foreground">
              {(profile?.website_url || profile?.website) && (
                <a href={profile.website_url || profile.website!} target="_blank" rel="noreferrer" className="hover:text-foreground">
                  <Globe className="w-4 h-4" />
                </a>
              )}
              {profile?.github_url && (
                <a href={profile.github_url} target="_blank" rel="noreferrer" className="hover:text-foreground">
                  <Github className="w-4 h-4" />
                </a>
              )}
              {profile?.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="hover:text-foreground">
                  <Linkedin className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Profile Tabs - Trimmed specifically for Citizen Role */}
      <div className="flex border-b border-border text-sm font-bold">
        <button
          onClick={() => setActiveTab('problems')}
          className={`pb-3 px-4 border-b-2 transition-colors ${
            activeTab === 'problems' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('my_problems')}
        </button>

        {!isCitizenRole && (
          <button
            onClick={() => setActiveTab('solutions')}
            className={`pb-3 px-4 border-b-2 transition-colors ${
              activeTab === 'solutions' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Solution Pods
          </button>
        )}

        <button
          onClick={() => setActiveTab('badges')}
          className={`pb-3 px-4 border-b-2 transition-colors ${
            activeTab === 'badges' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('badges_recognition')}
        </button>
      </div>

      {/* 3. Dynamic Content */}
      <div className="space-y-4">
        {activeTab === 'problems' && (
          postsLoading ? (
            <p className="text-sm text-muted-foreground">{language === 'hi' ? 'समस्याएँ लोड हो रही हैं…' : 'Loading submitted problems…'}</p>
          ) : Array.isArray(myProblems) && myProblems.length > 0 ? (
            myProblems.map((item: any) => <ProblemPost key={item.id} problem={mapApiProblem(item)} />)
          ) : (
            <EmptyState
              icon={Inbox}
              title={language === 'hi' ? 'अभी तक कोई दर्ज समस्या नहीं' : 'No reported problems yet'}
              description={language === 'hi' ? 'आपके द्वारा दर्ज सामाजिक समस्याएं यहां दिखाई देंगी।' : 'Societal challenges you report in your locality will appear here.'}
              actionLabel={t('report_issue')}
              onAction={() => (window.location.href = '/')}
            />
          )
        )}

        {!isCitizenRole && activeTab === 'solutions' && (
          <EmptyState
            icon={User}
            title="No active solution pods"
            description="Join an interdisciplinary team or start your own pod to solve societal problems."
            actionLabel="Explore Pods"
            onAction={() => (window.location.href = '/explore')}
          />
        )}

        {activeTab === 'badges' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <Card className="p-4 border-border rounded-2xl flex items-start gap-3 bg-card">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold text-foreground">{t('badge_verified_reporter')}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('badge_verified_reporter_desc')}
                </p>
              </div>
            </Card>

            <Card className="p-4 border-border rounded-2xl flex items-start gap-3 bg-card">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold text-foreground">{t('badge_community_contributor')}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('badge_community_contributor_desc')}
                </p>
              </div>
            </Card>

            <Card className="p-4 border-border rounded-2xl flex items-start gap-3 bg-card">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Award className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold text-foreground">{t('badge_impact_maker')}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('badge_impact_maker_desc')}
                </p>
              </div>
            </Card>

            <Card className="p-4 border-border rounded-2xl flex items-start gap-3 bg-card">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold text-foreground">{t('badge_civic_member')}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('badge_civic_member_desc')}
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl border-border space-y-4">
            <h2 className="text-lg font-bold text-foreground">{language === 'hi' ? 'प्रोफ़ाइल जानकारी संपादित करें' : 'Edit Profile Information'}</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Headline (Max 120 chars)</label>
                <input
                  type="text"
                  placeholder="e.g. Active Citizen | Ward 4 Community Advocate"
                  value={headline}
                  maxLength={120}
                  onChange={(e) => setHeadline(e.target.value)}
                  className={`w-full p-2 text-sm bg-background border rounded-xl text-foreground ${
                    fieldErrors.headline ? 'border-destructive' : 'border-border'
                  }`}
                />
                {fieldErrors.headline && <p className="text-[11px] text-destructive mt-0.5">{fieldErrors.headline}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Bio (Max 500 chars)</label>
                <textarea
                  placeholder="Tell the community about your civic focus and local concerns..."
                  value={bio}
                  maxLength={500}
                  onChange={(e) => setBio(e.target.value)}
                  className={`w-full p-2.5 h-20 text-sm bg-background border rounded-xl text-foreground ${
                    fieldErrors.bio ? 'border-destructive' : 'border-border'
                  }`}
                />
                {fieldErrors.bio && <p className="text-[11px] text-destructive mt-0.5">{fieldErrors.bio}</p>}
              </div>

              <div className="space-y-2">
                <div>
                  <input
                    type="url"
                    placeholder="Website URL (e.g. https://mywebsite.com)"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className={`w-full p-2 text-xs bg-background border rounded-xl text-foreground ${
                      fieldErrors.websiteUrl ? 'border-destructive' : 'border-border'
                    }`}
                  />
                  {fieldErrors.websiteUrl && <p className="text-[11px] text-destructive mt-0.5">{fieldErrors.websiteUrl}</p>}
                </div>

                <div>
                  <input
                    type="url"
                    placeholder="GitHub URL (e.g. https://github.com/username)"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    className={`w-full p-2 text-xs bg-background border rounded-xl text-foreground ${
                      fieldErrors.githubUrl ? 'border-destructive' : 'border-border'
                    }`}
                  />
                  {fieldErrors.githubUrl && <p className="text-[11px] text-destructive mt-0.5">{fieldErrors.githubUrl}</p>}
                </div>

                <div>
                  <input
                    type="url"
                    placeholder="LinkedIn URL (e.g. https://linkedin.com/in/username)"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className={`w-full p-2 text-xs bg-background border rounded-xl text-foreground ${
                      fieldErrors.linkedinUrl ? 'border-destructive' : 'border-border'
                    }`}
                  />
                  {fieldErrors.linkedinUrl && <p className="text-[11px] text-destructive mt-0.5">{fieldErrors.linkedinUrl}</p>}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button variant="outline" size="sm" type="button" onClick={() => setEditModalOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button type="submit" size="sm" isLoading={updateProfileMutation.isPending}>
                  {t('save_profile')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
