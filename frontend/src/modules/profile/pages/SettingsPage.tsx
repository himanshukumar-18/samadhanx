import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { useAuthStore } from '../../../store/authStore';
import { useLanguageStore } from '../../../store/languageStore';
import { getTranslation } from '../../../lib/translations';
import { profileApi, AccountSettingsData } from '../../../api/profile';
import { 
  Bell, 
  ShieldCheck, 
  Eye, 
  Phone, 
  Trash2, 
  AlertTriangle, 
  Loader2, 
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { language } = useLanguageStore();
  const t = (key: string) => getTranslation(language, key);
  const queryClient = useQueryClient();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['my-account-settings'],
    queryFn: () => profileApi.getMySettings(),
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: (updateData: Partial<AccountSettingsData>) => profileApi.updateMySettings(updateData),
    onSuccess: (updated) => {
      queryClient.setQueryData(['my-account-settings'], updated);
      toast.success(language === 'hi' ? 'सेटिंग्स सफलतापूर्वक अपडेट की गईं' : 'Settings updated successfully');
    },
    onError: () => {
      toast.error(language === 'hi' ? 'सेटिंग्स अपडेट करने में विफल' : 'Failed to update settings');
    },
  });

  const handleToggle = (field: keyof AccountSettingsData, currentVal?: boolean) => {
    updateMutation.mutate({ [field]: !currentVal });
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      await profileApi.deleteMyAccount();
      toast.success(language === 'hi' ? 'आपका खाता सफलतापूर्वक हटा दिया गया है।' : 'Your account has been permanently deleted.');
      logout();
      window.location.href = '/register';
    } catch {
      toast.error(language === 'hi' ? 'खाता हटाने में विफल।' : 'Failed to delete account.');
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12 w-full max-w-4xl mx-auto">
      {/* Top Header & Back Button */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <a
            href="/profile"
            className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div>
            <h1 className="text-xl font-black text-foreground">{t('settings_title')}</h1>
            <p className="text-xs text-muted-foreground">
              {language === 'hi' ? 'अपनी खाता प्राथमिकताएं और सुरक्षा प्रबंधित करें' : 'Manage your account preferences, notifications, and privacy'}
            </p>
          </div>
        </div>
      </div>

      {/* 1. Account Summary Card */}
      <Card className="p-5 border-border rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-foreground truncate">{user?.email}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary uppercase bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                {user?.role || 'Citizen'}
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified Account
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => (window.location.href = '/profile')}>
            {t('edit_profile')}
          </Button>
        </div>
      </Card>

      {/* 2. Notification Preferences */}
      <Card className="p-5 border-border rounded-2xl space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-black text-foreground">{t('notifications_settings')}</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-foreground">{t('email_notifications')}</p>
              <p className="text-[11px] text-muted-foreground">{t('email_notifications_desc')}</p>
            </div>
            <button
              onClick={() => handleToggle('email_notifications', settings?.email_notifications)}
              disabled={updateMutation.isPending}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 min-h-[24px] ${
                settings?.email_notifications ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings?.email_notifications ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
            <div>
              <p className="text-xs font-bold text-foreground">{t('push_notifications')}</p>
              <p className="text-[11px] text-muted-foreground">{t('push_notifications_desc')}</p>
            </div>
            <button
              onClick={() => handleToggle('push_notifications', settings?.push_notifications)}
              disabled={updateMutation.isPending}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 min-h-[24px] ${
                settings?.push_notifications ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings?.push_notifications ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </Card>

      {/* 3. Privacy & Visibility Settings */}
      <Card className="p-5 border-border rounded-2xl space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-black text-foreground">{t('privacy_settings')}</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" /> {t('public_profile')}
              </p>
              <p className="text-[11px] text-muted-foreground">{t('public_profile_desc')}</p>
            </div>
            <button
              onClick={() => handleToggle('public_profile', settings?.public_profile)}
              disabled={updateMutation.isPending}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 min-h-[24px] ${
                settings?.public_profile ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings?.public_profile ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
            <div>
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" /> {t('show_contact')}
              </p>
              <p className="text-[11px] text-muted-foreground">{t('show_contact_desc')}</p>
            </div>
            <button
              onClick={() => handleToggle('show_contact', settings?.show_contact)}
              disabled={updateMutation.isPending}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 min-h-[24px] ${
                settings?.show_contact ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings?.show_contact ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </Card>

      {/* 4. Danger Zone: Delete Account */}
      <Card className="p-5 border-destructive/30 rounded-2xl bg-destructive/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-destructive font-black text-sm">
              <AlertTriangle className="w-4 h-4" /> {t('danger_zone')}
            </div>
            <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
              {t('delete_account_warning')}
            </p>
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteModalOpen(true)}
            leftIcon={<Trash2 className="w-4 h-4" />}
            className="font-bold text-xs min-h-[40px] px-4 rounded-xl flex-shrink-0"
          >
            {t('delete_account')}
          </Button>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-destructive/40 space-y-4">
            <div className="flex items-center gap-2.5 text-destructive">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-black">{t('delete_confirm_title')}</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('delete_confirm_desc')}
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                isLoading={isDeleting}
                onClick={handleDeleteAccount}
                className="font-bold"
              >
                {t('confirm_delete')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
