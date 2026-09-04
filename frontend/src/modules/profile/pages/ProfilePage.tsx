import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Badge } from '../../../shared/components/ui/Badge';
import { useAuthStore } from '../../../store/authStore';
import { useLanguageStore } from '../../../store/languageStore';
import { getTranslation } from '../../../lib/translations';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import {
  Award,
  Camera,
  CheckCircle,
  CheckCircle2,
  Clock,
  FileText,
  Inbox,
  Loader2,
  MapPin,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { profileApi } from '../../../api/profile';
import { problemsApi } from '../../../api/problems';
import { mapApiProblem } from '../../../lib/problemMapper';
import { ProblemPost } from '../../feed/components/ProblemPost';
import { useCitizenProfile, useUpdateCitizenProfile, useProfile, useUpdateProfile } from '../../../hooks/useProfile';
import { CIVIC_INTEREST_CATEGORIES, GENDER_OPTIONS, LANGUAGE_OPTIONS } from '../../../config/categories';
import { CitizenProfileUpdatePayload } from '../../../api/profile';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_AVATAR_FALLBACK =
  'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Citizen Profile — Clean Civic Layout
// ---------------------------------------------------------------------------

const CitizenProfileView: React.FC = () => {
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const t = (key: string) => getTranslation(language, key);
  const queryClient = useQueryClient();

  const { data: profile, isLoading, isError } = useCitizenProfile();
  const updateMutation = useUpdateCitizenProfile();
  const [editOpen, setEditOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<'problems' | 'badges'>('problems');

  const { data: myProblems, isLoading: postsLoading } = useQuery({
    queryKey: ['user-problems', user?.id],
    queryFn: () => problemsApi.getMyProblems(),
    enabled: !!user?.id,
  });

  // Edit form state
  const [form, setForm] = useState<CitizenProfileUpdatePayload>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const openEdit = () => {
    if (profile) {
      setForm({
        full_name: profile.full_name,
        phone_number: profile.phone_number || '',
        date_of_birth: profile.date_of_birth || '',
        gender: profile.gender || '',
        state: profile.state || '',
        district: profile.district || '',
        city: profile.city || '',
        pincode: profile.pincode || '',
        bio: profile.bio || '',
        preferred_language: profile.preferred_language || '',
        interests: profile.interests || [],
      });
    }
    setFormErrors({});
    setEditOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (form.full_name !== undefined && form.full_name.trim().length < 2) {
      errors.full_name = 'Full name must be at least 2 characters.';
    }
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) {
      errors.pincode = 'Pincode must be exactly 6 digits.';
    }
    if (form.date_of_birth) {
      const dob = new Date(form.date_of_birth);
      if (isNaN(dob.getTime()) || dob >= new Date()) {
        errors.date_of_birth = 'Date of birth must be a valid past date.';
      }
    }
    if (form.bio && form.bio.length > 500) {
      errors.bio = 'Bio must be 500 characters or less.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload: CitizenProfileUpdatePayload = {};
    (Object.keys(form) as Array<keyof CitizenProfileUpdatePayload>).forEach((k) => {
      const v = form[k];
      if (v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) {
        (payload as any)[k] = v;
      } else if (v === '' || (Array.isArray(v) && v.length === 0)) {
        // send null-ish values to clear them
        if (['phone_number', 'date_of_birth', 'gender', 'city', 'pincode', 'bio', 'preferred_language'].includes(k)) {
          (payload as any)[k] = v || undefined;
        }
      }
    });
    if (form.interests !== undefined) payload.interests = form.interests;

    await updateMutation.mutateAsync(payload);
    setEditOpen(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];

    // Client-side size guard (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5 MB.');
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPEG, PNG, WebP, or GIF images are accepted.');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const res = await profileApi.uploadMedia(file, 'avatar');
      if (res.url) {
        await updateMutation.mutateAsync({ profile_picture_url: res.url });
      }
      toast.success(language === 'hi' ? 'प्रोफ़ाइल फ़ोटो अपडेट की गई!' : 'Profile photo updated!');
      queryClient.invalidateQueries({ queryKey: ['citizen', 'profile'] });
    } catch {
      toast.error('Failed to upload profile photo.');
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const toggleInterest = (cat: string) => {
    const current = form.interests || [];
    if (current.includes(cat)) {
      setForm((f) => ({ ...f, interests: current.filter((c) => c !== cat) }));
    } else if (current.length < 10) {
      setForm((f) => ({ ...f, interests: [...current, cat] }));
    } else {
      toast.error('You can select up to 10 areas of interest.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        {language === 'hi' ? 'प्रोफ़ाइल लोड नहीं हो सकी।' : 'Unable to load profile. Please refresh.'}
      </div>
    );
  }

  const displayName = profile.full_name || user?.email?.split('@')[0] || 'Citizen';
  const { activity } = profile;

  return (
    <div className="space-y-4 pb-16 w-full min-w-0">

      {/* ── Header Card ─────────────────────────────────────── */}
      <Card className="p-5 sm:p-6 space-y-4 border-border rounded-2xl">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative group flex-shrink-0">
            {isUploadingAvatar ? (
              <div className="w-20 h-20 rounded-2xl ring-4 ring-border bg-muted flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : profile.profile_picture_url ? (
              <img
                src={profile.profile_picture_url}
                alt={displayName}
                onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR_FALLBACK; }}
                className="w-20 h-20 rounded-2xl ring-4 ring-border object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl ring-4 ring-border bg-primary text-primary-foreground font-black text-xl flex items-center justify-center uppercase">
                {getInitials(displayName)}
              </div>
            )}
            {!isUploadingAvatar && (
              <label className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white" aria-label="Change profile photo">
                <Camera className="w-5 h-5" />
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarUpload} className="hidden" />
              </label>
            )}
          </div>

          {/* Name / Role / Status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black text-foreground truncate">{displayName}</h1>
              {profile.email_verified && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <Badge variant="student" className="text-xs uppercase">{language === 'hi' ? 'नागरिक' : 'Citizen'}</Badge>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${profile.account_status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                }`}>
                {profile.account_status.charAt(0).toUpperCase() + profile.account_status.slice(1)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {language === 'hi' ? 'सदस्य ' : 'Member since '}{profile.member_since}
            </p>
          </div>

          {/* Edit button */}
          <Button variant="outline" size="sm" onClick={openEdit} className="flex-shrink-0">
            <Settings className="w-4 h-4 mr-1.5" />
            {t('edit_profile')}
          </Button>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-foreground leading-relaxed">{profile.bio}</p>
        )}

        {/* Location preview */}
        {(profile.state || profile.district || profile.city) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span>
              {[profile.city, profile.district, profile.state].filter(Boolean).join(', ')}
              {profile.pincode ? ` — ${profile.pincode}` : ''}
            </span>
          </div>
        )}
      </Card>

      {/* ── Civic Activity ──────────────────────────────────── */}
      <Card className="p-5 border-border rounded-2xl space-y-3">
        <h2 className="text-sm font-black text-foreground">{language === 'hi' ? 'नागरिक गतिविधि' : 'Civic Activity'}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: language === 'hi' ? 'दर्ज' : 'Submitted', value: activity.submitted, icon: <FileText className="w-4 h-4 text-primary" />, color: 'bg-blue-100' },
            { label: language === 'hi' ? 'स्वीकृत' : 'Approved', value: activity.approved, icon: <CheckCircle className="w-4 h-4 text-emerald-500" />, color: 'bg-emerald-500/10' },
            { label: language === 'hi' ? 'लंबित' : 'Pending', value: activity.pending, icon: <Clock className="w-4 h-4 text-amber-500" />, color: 'bg-amber-500/10' },
            { label: language === 'hi' ? 'अस्वीकृत' : 'Rejected', value: activity.rejected, icon: <X className="w-4 h-4 text-destructive" />, color: 'bg-red-100' },
            { label: language === 'hi' ? 'हल' : 'Solved', value: activity.solved, icon: <Award className="w-4 h-4 text-purple-500" />, color: 'bg-purple-500/10' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className={`flex flex-col items-center p-3 rounded-xl ${color} gap-1`}>
              {icon}
              <span className="text-lg font-black text-foreground">{value}</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Basic Information ───────────────────────────────── */}
      <Card className="p-5 border-border rounded-2xl space-y-3">
        <h2 className="text-sm font-black text-foreground">{language === 'hi' ? 'मूल जानकारी' : 'Basic Information'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <InfoRow label={language === 'hi' ? 'पूरा नाम' : 'Full Name'} value={profile.full_name} />
          <InfoRow
            label={language === 'hi' ? 'ईमेल' : 'Email'}
            value={
              <span className="flex items-center gap-1">
                {profile.email}
                {profile.email_verified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              </span>
            }
          />
          <InfoRow label={language === 'hi' ? 'फ़ोन' : 'Phone'} value={profile.phone_number || '—'} />
          <InfoRow label={language === 'hi' ? 'जन्म तिथि' : 'Date of Birth'} value={profile.date_of_birth || '—'} />
          <InfoRow
            label={language === 'hi' ? 'लिंग' : 'Gender'}
            value={GENDER_OPTIONS.find((g) => g.value === profile.gender)?.label || '—'}
          />
          <InfoRow
            label={language === 'hi' ? 'भाषा' : 'Preferred Language'}
            value={LANGUAGE_OPTIONS.find((l) => l.value === profile.preferred_language)?.label || '—'}
          />
        </div>
      </Card>

      {/* ── Location ────────────────────────────────────────── */}
      <Card className="p-5 border-border rounded-2xl space-y-3">
        <h2 className="text-sm font-black text-foreground">{language === 'hi' ? 'स्थान' : 'Location'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <InfoRow label={language === 'hi' ? 'राज्य' : 'State'} value={profile.state || '—'} />
          <InfoRow label={language === 'hi' ? 'जिला' : 'District'} value={profile.district || '—'} />
          <InfoRow label={language === 'hi' ? 'शहर / गाँव' : 'City / Village / Town'} value={profile.city || '—'} />
          <InfoRow label={language === 'hi' ? 'पिनकोड' : 'Pincode'} value={profile.pincode || '—'} />
          <div className="sm:col-span-2">
            <InfoRow label={language === 'hi' ? 'पूरा पता' : 'Full Address'} value={
              <span className="italic text-muted-foreground text-xs">{language === 'hi' ? 'निजी — संपादन फ़ॉर्म में उपलब्ध' : 'Private — available in edit form'}</span>
            } />
          </div>
        </div>
      </Card>

      {/* ── Community Interests ─────────────────────────────── */}
      {profile.interests.length > 0 && (
        <Card className="p-5 border-border rounded-2xl space-y-3">
          <h2 className="text-sm font-black text-foreground">{language === 'hi' ? 'सामुदायिक रुचियाँ' : 'Community Interests'}</h2>
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((cat) => (
              <span key={cat} className="px-3 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
                {cat}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* ── Account Info ────────────────────────────────────── */}
      <Card className="p-5 border-border rounded-2xl space-y-3">
        <h2 className="text-sm font-black text-foreground">{language === 'hi' ? 'खाता जानकारी' : 'Account'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <InfoRow label={language === 'hi' ? 'भूमिका' : 'Role'} value="Citizen" />
          <InfoRow label={language === 'hi' ? 'सदस्यता से' : 'Member Since'} value={profile.member_since} />
          <InfoRow label={language === 'hi' ? 'खाता स्थिति' : 'Account Status'} value={
            <span className={profile.account_status === 'active' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-bold'}>
              {profile.account_status.charAt(0).toUpperCase() + profile.account_status.slice(1)}
            </span>
          } />
        </div>
      </Card>

      {/* ── Tabs: Problems / Badges ──────────────────────────── */}
      <div className="flex border-b border-border text-sm font-bold">
        {[
          { key: 'problems' as const, label: language === 'hi' ? 'मेरी समस्याएँ' : 'My Problems' },
          { key: 'badges' as const, label: language === 'hi' ? 'बैज' : 'Badges' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`pb-3 px-4 border-b-2 transition-colors ${activeTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeTab === 'problems' && (
          postsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : Array.isArray(myProblems) && myProblems.length > 0 ? (
            myProblems.map((item: any) => <ProblemPost key={item.id} problem={mapApiProblem(item)} />)
          ) : (
            <EmptyState
              icon={Inbox}
              title={language === 'hi' ? 'अभी तक कोई दर्ज समस्या नहीं' : 'No reported problems yet'}
              description={language === 'hi' ? 'आपके द्वारा दर्ज सामाजिक समस्याएं यहां दिखाई देंगी।' : 'Civic issues you report will appear here.'}
              actionLabel={t('report_issue')}
              onAction={() => (window.location.href = '/')}
            />
          )
        )}

        {activeTab === 'badges' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            {[
              { icon: <ShieldCheck className="w-5 h-5" />, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', title: t('badge_verified_reporter'), desc: t('badge_verified_reporter_desc') },
              { icon: <FileText className="w-5 h-5" />, color: 'bg-primary/10 text-primary', title: t('badge_community_contributor'), desc: t('badge_community_contributor_desc') },
              { icon: <Award className="w-5 h-5" />, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', title: t('badge_impact_maker'), desc: t('badge_impact_maker_desc') },
              { icon: <Sparkles className="w-5 h-5" />, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', title: t('badge_civic_member'), desc: t('badge_civic_member_desc') },
            ].map(({ icon, color, title, desc }) => (
              <Card key={title} className="p-4 border-border rounded-2xl flex items-start gap-3 bg-card">
                <div className={`p-2.5 rounded-xl ${color}`}>{icon}</div>
                <div className="space-y-0.5">
                  <h3 className="text-sm font-extrabold text-foreground">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Edit Profile Modal ───────────────────────────────── */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit Citizen Profile"
        >
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border-border space-y-0 p-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-base font-black text-foreground">
                {language === 'hi' ? 'प्रोफ़ाइल संपादित करें' : 'Edit Profile'}
              </h2>
              <button onClick={() => setEditOpen(false)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-6">

              {/* Section: Profile Photo */}
              <Section title={language === 'hi' ? 'प्रोफ़ाइल फ़ोटो' : 'Profile Photo'}>
                <div className="flex items-center gap-4">
                  {profile.profile_picture_url ? (
                    <img src={profile.profile_picture_url} alt={displayName} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-border" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground font-black text-lg flex items-center justify-center uppercase">
                      {getInitials(displayName)}
                    </div>
                  )}
                  <label className="cursor-pointer flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-border rounded-xl hover:bg-muted text-foreground transition-colors min-h-[40px]">
                    <Camera className="w-4 h-4" />
                    {isUploadingAvatar ? (language === 'hi' ? 'अपलोड हो रहा है…' : 'Uploading…') : (language === 'hi' ? 'फ़ोटो बदलें' : 'Change Photo')}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarUpload} className="hidden" disabled={isUploadingAvatar} />
                  </label>
                  <p className="text-[11px] text-muted-foreground">JPEG, PNG, WebP · max 5 MB</p>
                </div>
              </Section>

              {/* Section: Basic Information */}
              <Section title={language === 'hi' ? 'मूल जानकारी' : 'Basic Information'}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    label={language === 'hi' ? 'पूरा नाम *' : 'Full Name *'}
                    error={formErrors.full_name}
                  >
                    <input
                      type="text"
                      value={form.full_name || ''}
                      maxLength={100}
                      onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                      className={inputCls(!!formErrors.full_name)}
                      placeholder="Himanshu Kumar"
                    />
                  </FormField>

                  <FormField label={language === 'hi' ? 'ईमेल' : 'Email'}>
                    <div className="flex items-center gap-2 p-2.5 bg-muted/50 border border-border rounded-xl">
                      <span className="text-sm text-foreground truncate flex-1">{profile.email}</span>
                      {profile.email_verified && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{language === 'hi' ? 'ईमेल संपादन योग्य नहीं है।' : 'Email cannot be changed here.'}</p>
                  </FormField>

                  <FormField label={language === 'hi' ? 'फ़ोन नंबर' : 'Phone Number'}>
                    <input
                      type="tel"
                      value={form.phone_number || ''}
                      maxLength={20}
                      onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
                      className={inputCls(false)}
                      placeholder="+91 98765 43210"
                    />
                  </FormField>

                  <FormField label={language === 'hi' ? 'जन्म तिथि' : 'Date of Birth'} error={formErrors.date_of_birth}>
                    <input
                      type="date"
                      value={form.date_of_birth || ''}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                      className={inputCls(!!formErrors.date_of_birth)}
                    />
                  </FormField>

                  <FormField label={language === 'hi' ? 'लिंग' : 'Gender'}>
                    <select
                      value={form.gender || ''}
                      onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                      className={inputCls(false)}
                    >
                      <option value="">{language === 'hi' ? '— चुनें —' : '— Select —'}</option>
                      {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </FormField>

                  <FormField label={language === 'hi' ? 'पसंदीदा भाषा' : 'Preferred Language'}>
                    <select
                      value={form.preferred_language || ''}
                      onChange={(e) => setForm((f) => ({ ...f, preferred_language: e.target.value }))}
                      className={inputCls(false)}
                    >
                      <option value="">{language === 'hi' ? '— चुनें —' : '— Select —'}</option>
                      {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </FormField>
                </div>
              </Section>

              {/* Section: Location */}
              <Section title={language === 'hi' ? 'स्थान' : 'Location'}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label={language === 'hi' ? 'राज्य' : 'State'}>
                    <input
                      type="text"
                      value={form.state || ''}
                      maxLength={100}
                      onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                      className={inputCls(false)}
                      placeholder="Jharkhand"
                    />
                  </FormField>

                  <FormField label={language === 'hi' ? 'जिला' : 'District'}>
                    <input
                      type="text"
                      value={form.district || ''}
                      maxLength={100}
                      onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                      className={inputCls(false)}
                      placeholder="Ranchi"
                    />
                  </FormField>

                  <FormField label={language === 'hi' ? 'शहर / गाँव / कस्बा' : 'City / Village / Town'}>
                    <input
                      type="text"
                      value={form.city || ''}
                      maxLength={100}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      className={inputCls(false)}
                      placeholder="Ranchi"
                    />
                  </FormField>

                  <FormField label={language === 'hi' ? 'पिनकोड' : 'Pincode'} error={formErrors.pincode}>
                    <input
                      type="text"
                      value={form.pincode || ''}
                      maxLength={6}
                      onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '') }))}
                      className={inputCls(!!formErrors.pincode)}
                      placeholder="834001"
                    />
                  </FormField>

                  <div className="sm:col-span-2">
                    <FormField label={`${language === 'hi' ? 'पूरा पता' : 'Full Address'} (${language === 'hi' ? 'निजी' : 'Private'})`}>
                      <textarea
                        value={form.full_address || ''}
                        maxLength={500}
                        onChange={(e) => setForm((f) => ({ ...f, full_address: e.target.value }))}
                        className={`${inputCls(false)} h-16 resize-none`}
                        placeholder={language === 'hi' ? 'आपका पूरा पता (कभी सार्वजनिक नहीं किया जाएगा)' : 'Your complete address (never shown publicly)'}
                      />
                    </FormField>
                  </div>
                </div>
              </Section>

              {/* Section: About You */}
              <Section title={language === 'hi' ? 'अपने बारे में' : 'About You'}>
                <FormField label={`${language === 'hi' ? 'परिचय / बायो' : 'Bio'} (${language === 'hi' ? 'अधिकतम 500 वर्ण' : 'max 500 chars'})`} error={formErrors.bio}>
                  <textarea
                    value={form.bio || ''}
                    maxLength={500}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    className={`${inputCls(!!formErrors.bio)} h-20 resize-none`}
                    placeholder={language === 'hi' ? 'अपने स्थानीय मुद्दों और सामुदायिक कार्य के बारे में बताएं…' : 'Tell the community about your local concerns and civic focus…'}
                  />
                  <p className="text-[11px] text-muted-foreground text-right">{(form.bio || '').length}/500</p>
                </FormField>

                {/* Interests multi-select */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-muted-foreground">
                    {language === 'hi' ? 'चिंता के क्षेत्र' : 'Areas of Concern'} ({(form.interests || []).length}/10)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CIVIC_INTEREST_CATEGORIES.map((cat) => {
                      const selected = (form.interests || []).includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleInterest(cat)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors ${selected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-transparent text-muted-foreground border-border hover:border-primary hover:text-primary'
                            }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Section>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button type="submit" size="sm" isLoading={updateMutation.isPending}>
                  {language === 'hi' ? 'परिवर्तन सहेजें' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Non-citizen shared profile (Student, Faculty, Industry, University)
// Kept intact — no changes to existing layout.
// ---------------------------------------------------------------------------

const SharedProfileView: React.FC = () => {
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const t = (key: string) => getTranslation(language, key);
  const queryClient = useQueryClient();

  const { data: profile, refetch: refetchSelf } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [bio, setBio] = useState('');
  const [activeTab, setActiveTab] = useState<'problems' | 'badges'>('problems');

  const { data: myProblems, isLoading: postsLoading } = useQuery({
    queryKey: ['user-problems', user?.id],
    queryFn: () => problemsApi.getMyProblems(),
    enabled: !!user?.id,
  });

  const openEditModal = () => {
    setBio(profile?.bio || '');
    setEditModalOpen(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfileMutation.mutateAsync({ bio: bio.trim() || undefined });
    setEditModalOpen(false);
    refetchSelf();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    try {
      setIsUploadingAvatar(true);
      const res = await profileApi.uploadMedia(file, 'avatar');
      if (res.url) await updateProfileMutation.mutateAsync({ avatar_url: res.url });
      toast.success('Avatar updated!');
      await queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      refetchSelf();
    } catch {
      toast.error('Failed to upload avatar.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';

  if (!profile) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 pb-12 w-full min-w-0">
      <Card className="p-5 space-y-4 border-border rounded-2xl">
        <div className="flex items-start gap-4">
          <div className="relative group flex-shrink-0">
            {isUploadingAvatar ? (
              <div className="w-20 h-20 rounded-2xl ring-4 ring-border bg-muted flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : profile.avatar_url || profile.profile_picture_url ? (
              <img
                src={profile.avatar_url || profile.profile_picture_url!}
                alt={displayName}
                onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR_FALLBACK; }}
                className="w-20 h-20 rounded-2xl ring-4 ring-border object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl ring-4 ring-border bg-primary text-primary-foreground font-black text-xl flex items-center justify-center uppercase">
                {getInitials(displayName)}
              </div>
            )}
            <label className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white" aria-label="Change avatar">
              <Camera className="w-5 h-5" />
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-foreground">{displayName}</h1>
            <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
            {profile.organization_name && <p className="text-xs font-bold text-primary">{profile.organization_name}</p>}
          </div>

          <Button variant="outline" size="sm" onClick={openEditModal}>
            <Settings className="w-4 h-4 mr-1.5" /> {t('edit_profile')}
          </Button>
        </div>
        {profile.bio && <p className="text-sm text-foreground leading-relaxed">{profile.bio}</p>}
      </Card>

      <div className="flex border-b border-border text-sm font-bold">
        <button onClick={() => setActiveTab('problems')} className={tabCls(activeTab === 'problems')}>
          {t('my_problems')}
        </button>
        <button onClick={() => setActiveTab('badges')} className={tabCls(activeTab === 'badges')}>
          {t('badges_recognition')}
        </button>
      </div>

      <div className="space-y-4">
        {activeTab === 'problems' && (
          postsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : Array.isArray(myProblems) && myProblems.length > 0 ? (
            myProblems.map((item: any) => <ProblemPost key={item.id} problem={mapApiProblem(item)} />)
          ) : (
            <EmptyState icon={Inbox} title="No problems yet" description="Your submitted problems will appear here." actionLabel={t('report_issue')} onAction={() => (window.location.href = '/')} />
          )
        )}
        {activeTab === 'badges' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            {[
              { icon: <ShieldCheck className="w-5 h-5" />, color: 'bg-emerald-500/10 text-emerald-600', title: t('badge_verified_reporter'), desc: t('badge_verified_reporter_desc') },
              { icon: <Sparkles className="w-5 h-5" />, color: 'bg-amber-500/10 text-amber-600', title: t('badge_civic_member'), desc: t('badge_civic_member_desc') },
            ].map(({ icon, color, title, desc }) => (
              <Card key={title} className="p-4 border-border rounded-2xl flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${color}`}>{icon}</div>
                <div><h3 className="text-sm font-extrabold text-foreground">{title}</h3><p className="text-xs text-muted-foreground">{desc}</p></div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-border space-y-4">
            <h2 className="text-base font-bold text-foreground">{t('edit_profile')}</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Bio</label>
                <textarea
                  value={bio}
                  maxLength={500}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full p-2.5 h-20 text-sm bg-background border border-border rounded-xl text-foreground resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setEditModalOpen(false)}>{t('cancel')}</Button>
                <Button type="submit" size="sm" isLoading={updateProfileMutation.isPending}>{t('save_profile')}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="space-y-0.5">
    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">{label}</p>
    <p className="text-sm text-foreground font-medium">{value}</p>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-wide border-b border-border pb-1">{title}</h3>
    {children}
  </div>
);

const FormField: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
  <div className="space-y-1">
    <label className="block text-xs font-bold text-muted-foreground">{label}</label>
    {children}
    {error && <p className="text-[11px] text-destructive">{error}</p>}
  </div>
);

const inputCls = (hasError: boolean) =>
  `w-full p-2.5 text-sm bg-background border rounded-xl text-foreground min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/50 ${hasError ? 'border-destructive' : 'border-border'
  }`;

const tabCls = (active: boolean) =>
  `pb-3 px-4 border-b-2 transition-colors ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`;

// ---------------------------------------------------------------------------
// Main export — routes by role
// ---------------------------------------------------------------------------

export const ProfilePage: React.FC = () => {
  const { user } = useAuthStore();
  const isCitizen = user?.role === 'citizen';

  return isCitizen ? <CitizenProfileView /> : <SharedProfileView />;
};
