import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Badge } from '../../../shared/components/ui/Badge';
import { useAuthStore } from '../../../store/authStore';
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
  UserCheck
} from 'lucide-react';
import { profileApi } from '../../../api/profile';
import { problemsApi } from '../../../api/problems';
import { socialApi } from '../../../api/social';
import { mapApiProblem } from '../../../lib/problemMapper';
import { ProblemPost } from '../../feed/components/ProblemPost';
import toast from 'react-hot-toast';

export const ProfilePage: React.FC = () => {
  const { user } = useAuthStore();
  const pathParts = window.location.pathname.split('/');
  const isPublicView = pathParts.includes('user') && pathParts.length > 3;
  const targetUserId = isPublicView ? pathParts[pathParts.length - 1] : undefined;
  const isSelf = !targetUserId || targetUserId === user?.id;

  const activeRole = isSelf ? (user?.role || 'citizen') : 'citizen';
  const config = getRoleConfig(activeRole);
  const [activeTab, setActiveTab] = useState<'posts' | 'solutions' | 'badges'>('posts');
  const [editModalOpen, setEditModalOpen] = useState(false);

  const { data: myProfile, refetch: refetchSelf } = useQuery({
    queryKey: ['my-profile-detail'],
    queryFn: () => profileApi.getMyProfile(),
    enabled: isSelf,
  });

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

  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isFollowingPending, setIsFollowingPending] = useState(false);

  const profile = isSelf ? myProfile : publicProfile;

  const openEditModal = () => {
    if (profile) {
      setHeadline(profile.headline || '');
      setBio(profile.bio || '');
      setWebsite(profile.website || '');
      setGithubUrl(profile.github_url || '');
      setLinkedinUrl(profile.linkedin_url || '');
    }
    setEditModalOpen(true);
  };

  const handleToggleFollow = async () => {
    if (!targetUserId) return;
    try {
      setIsFollowingPending(true);
      if (socialStats?.is_following) {
        await socialApi.unfollowUser(targetUserId);
        toast.success('Unfollowed user');
      } else {
        await socialApi.followUser(targetUserId);
        toast.success('Following user!');
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
    try {
      setIsUpdating(true);
      await profileApi.updateMyProfile({
        headline,
        bio,
        website,
        github_url: githubUrl,
        linkedin_url: linkedinUrl,
      });
      toast.success('Profile updated successfully!');
      setEditModalOpen(false);
      refetchSelf();
    } catch {
      toast.error('Failed to update profile.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      const res = await profileApi.uploadMedia(file, 'avatar');
      await profileApi.updateMyProfile({ avatar_url: res.url });
      toast.success('Avatar image uploaded successfully!');
      refetchSelf();
    } catch {
      toast.error('Failed to upload image.');
    }
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Community Solver';

  return (
    <div className="space-y-4 pb-12 w-full min-w-0">
      {/* 1. Header Banner & Avatar Card */}
      <Card className="p-0 overflow-hidden border-border rounded-2xl">
        <div className="h-28 bg-gradient-to-r from-indigo-600 to-purple-600 relative border-b border-border" />
        <div className="p-5 sm:p-6 pt-0 space-y-4">
          <div className="flex items-end justify-between -mt-12 mb-2">
            <div className="relative group">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-24 h-24 rounded-2xl ring-4 ring-card shadow-lg object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl ring-4 ring-card shadow-lg bg-primary text-primary-foreground font-black text-2xl flex items-center justify-center uppercase">
                  {displayName.slice(0, 2)}
                </div>
              )}
              {isSelf && (
                <label className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white">
                  <Camera className="w-6 h-6" />
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isSelf ? (
                <Button variant="outline" size="sm" onClick={openEditModal}>
                  <Settings className="w-4 h-4 mr-1.5" /> Edit Profile
                </Button>
              ) : (
                <Button
                  variant={socialStats?.is_following ? 'outline' : 'primary'}
                  size="sm"
                  isLoading={isFollowingPending}
                  onClick={handleToggleFollow}
                  leftIcon={socialStats?.is_following ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                >
                  {socialStats?.is_following ? 'Following' : 'Follow'}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-foreground">{displayName}</h1>
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <Badge variant="student" className="text-xs uppercase">
                {config.displayName}
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

          {/* Network & Social Links */}
          <div className="flex items-center justify-between flex-wrap gap-4 pt-2 border-t border-border">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <strong className="font-black text-foreground">{socialStats?.followers_count ?? profile?.followers_count ?? 0}</strong>{' '}
                <span className="text-muted-foreground text-xs">Followers</span>
              </div>
              <div>
                <strong className="font-black text-foreground">{socialStats?.following_count ?? profile?.following_count ?? 0}</strong>{' '}
                <span className="text-muted-foreground text-xs">Following</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-muted-foreground">
              {profile?.website && (
                <a href={profile.website} target="_blank" rel="noreferrer" className="hover:text-foreground">
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

      {/* 2. Profile Tabs */}
      <div className="flex border-b border-border text-sm font-bold">
        <button
          onClick={() => setActiveTab('posts')}
          className={`pb-3 px-4 border-b-2 transition-colors ${
            activeTab === 'posts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Activity & Challenges
        </button>
        <button
          onClick={() => setActiveTab('solutions')}
          className={`pb-3 px-4 border-b-2 transition-colors ${
            activeTab === 'solutions' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Solution Pods
        </button>
        <button
          onClick={() => setActiveTab('badges')}
          className={`pb-3 px-4 border-b-2 transition-colors ${
            activeTab === 'badges' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Badges & Credentials
        </button>
      </div>

      {/* 3. Dynamic Content */}
      <div className="space-y-4">
        {activeTab === 'posts' && (
          postsLoading ? (
            <p className="text-sm text-muted-foreground">Loading challenges…</p>
          ) : Array.isArray(myProblems) && myProblems.length > 0 ? (
            myProblems.map((item: any) => <ProblemPost key={item.id} problem={mapApiProblem(item)} />)
          ) : (
            <EmptyState
              icon={Inbox}
              title="No reported challenges yet"
              description="Challenges and issues reported will appear here."
              actionLabel="Report a Challenge"
              onAction={() => (window.location.href = '/')}
            />
          )
        )}

        {activeTab === 'solutions' && (
          <EmptyState
            icon={User}
            title="No active solution pods"
            description="Join an interdisciplinary team or start your own pod to solve societal problems."
            actionLabel="Explore Pods"
            onAction={() => (window.location.href = '/explore')}
          />
        )}

        {activeTab === 'badges' && (
          <EmptyState
            icon={Award}
            title="No badges earned yet"
            description="Earn verified credentials by contributing validated solutions and collaborating with mentors."
          />
        )}
      </div>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl border-border space-y-4">
            <h2 className="text-lg font-bold text-foreground">Edit Professional Profile</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Headline</label>
                <input
                  type="text"
                  placeholder="e.g. AI Researcher | SIH 26043 Innovator"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full p-2 text-sm bg-background border border-border rounded-xl text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Bio</label>
                <textarea
                  placeholder="Tell the community about your expertise and focus..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full p-2.5 h-20 text-sm bg-background border border-border rounded-xl text-foreground"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="url"
                  placeholder="Website URL"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="p-2 text-xs bg-background border border-border rounded-xl text-foreground"
                />
                <input
                  type="url"
                  placeholder="GitHub URL"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className="p-2 text-xs bg-background border border-border rounded-xl text-foreground"
                />
                <input
                  type="url"
                  placeholder="LinkedIn URL"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className="p-2 text-xs bg-background border border-border rounded-xl text-foreground"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <Button variant="outline" size="sm" type="button" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isUpdating}>
                  Save Profile
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
