import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProblemCategory } from '../../../types/problem';
import { useAuthStore } from '../../../store/authStore';
import { useLanguageStore } from '../../../store/languageStore';
import { getTranslation } from '../../../lib/translations';
import { profileApi } from '../../../api/profile';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { UserAvatar } from '../../../shared/components/ui/UserAvatar';
import { Image as ImageIcon, MapPin, PlusCircle, Loader2, Video, AlertCircle } from 'lucide-react';
import { problemsApi } from '../../../api/problems';
import toast from 'react-hot-toast';

export const CreateProblemCard: React.FC<{ onCreated?: () => void }> = ({ onCreated }) => {
  const { user, isAuthenticated } = useAuthStore();
  const { language } = useLanguageStore();
  const t = (key: string) => getTranslation(language, key);

  const { data: myProfile } = useQuery({
    queryKey: ['my-profile-detail'],
    queryFn: profileApi.getMyProfile,
    enabled: isAuthenticated,
  });

  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProblemCategory>('Water & Sanitation');
  const [district, setDistrict] = useState('New Delhi');
  const [stateName, setStateName] = useState('Delhi');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const avatarUrl = myProfile?.avatar_url || myProfile?.profile_picture_url;
  const displayName = myProfile?.full_name || user?.full_name || user?.email;

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const maxMB = type === 'video' ? 25 : 10;
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(language === 'hi' 
        ? `फ़ाइल का आकार ${maxMB}MB से कम होना चाहिए।` 
        : `File size must be less than ${maxMB}MB.`
      );
      return;
    }

    try {
      setIsUploading(true);
      const res = await problemsApi.uploadMedia(file);
      setMediaUrl(res.url);
      setMediaType(type);
      toast.success(language === 'hi' ? 'मीडिया सफलतापूर्वक अपलोड किया गया।' : `${type === 'video' ? 'Video' : 'Image'} uploaded successfully.`);
    } catch {
      toast.error(language === 'hi' ? 'मीडिया अपलोड विफल रहा।' : `Failed to upload ${type}.`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFetchLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          // OpenStreetMap Nominatim reverse geocoding API for exact location name
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
          );
          const data = await response.json();
          if (data && data.address) {
            const suburb = data.address.suburb || data.address.neighbourhood || data.address.residential || data.address.quarter || '';
            const city = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state_district || 'New Delhi';
            const state = data.address.state || 'Delhi';

            const locationName = suburb ? `${suburb}, ${city}` : city;
            setDistrict(locationName);
            setStateName(state);
            toast.success(language === 'hi' ? `स्थान की पहचान की गई: ${locationName}, ${state}` : `Location identified: ${locationName}, ${state}`);
          } else {
            setDistrict(`GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
            toast.success(`GPS Location tagged: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch {
          setDistrict(`GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
          toast.success(`GPS Location tagged: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        toast.error('Unable to retrieve GPS location.');
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (title.trim().length < 5) {
      toast.error(language === 'hi' ? 'शीर्षक कम से कम 5 अक्षरों का होना चाहिए।' : 'Title must be at least 5 characters long.');
      return;
    }
    if (description.trim().length < 20) {
      toast.error(language === 'hi' ? 'विवरण कम से कम 20 अक्षरों का होना चाहिए।' : 'Description must be at least 20 characters long.');
      return;
    }

    try {
      setIsLoading(true);
      await problemsApi.createProblem({
        title: title.trim(),
        description: description.trim(),
        category,
        district: district.trim(),
        state: stateName.trim(),
        location: `${district.trim()}, ${stateName.trim()}`,
        impact_level: 'high',
        tags: [category.split(' ')[0], 'Community'],
        media_urls: mediaUrl ? [mediaUrl] : [],
      });

      toast.success(language === 'hi' ? 'समस्या सफलतापूर्वक प्रकाशित की गई!' : 'Problem challenge published to community feed!');
      setTitle('');
      setDescription('');
      setMediaUrl(null);
      setMediaType(null);
      setIsOpen(false);
      if (onCreated) onCreated();
    } catch (err: unknown) {
      const errorObj = err as { response?: { status?: number; data?: { error?: { message?: string }; detail?: { message?: string } } } };
      const status = errorObj.response?.status;
      const message = errorObj.response?.data?.error?.message || errorObj.response?.data?.detail?.message;

      if (status === 401) {
        toast.error(language === 'hi' ? 'कृपया पुनः साइन इन करें।' : 'Please sign in again.');
      } else if (status === 403) {
        toast.error(language === 'hi' ? 'आपको समस्या दर्ज करने की अनुमति नहीं है।' : 'You do not have permission to submit this problem.');
      } else if (status === 422) {
        toast.error(message || (language === 'hi' ? 'अमान्य फ़ील्ड इनपुट।' : 'Validation error. Please check your inputs.'));
      } else if (status === 429) {
        toast.error(language === 'hi' ? 'बहुत सारे अनुरोध। कृपया प्रतीक्षा करें।' : 'Too many requests. Please wait a moment.');
      } else {
        toast.error(message || (language === 'hi' ? 'समस्या दर्ज करने में विफल।' : 'Failed to publish problem submission.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5 shadow-sm border border-border/80 rounded-2xl bg-card hover:border-primary/30 transition-all">
      {!isOpen ? (
        <div className="flex items-center gap-3">
          {/* User Avatar with Circled Border Ring */}
          <div className="p-0.5 rounded-full ring-2 ring-primary/40 flex-shrink-0">
            <UserAvatar src={avatarUrl} name={displayName} size="lg" />
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="flex-1 text-left bg-muted/60 hover:bg-muted text-muted-foreground px-4 py-2.5 rounded-full text-sm font-semibold border border-transparent hover:border-border transition-all min-h-[44px] flex items-center"
          >
            {t('what_problem')}
          </button>

          <Button
            variant="primary"
            size="sm"
            className="min-h-[44px] px-4 font-bold text-sm rounded-full shadow-xs"
            onClick={() => setIsOpen(true)}
            leftIcon={<PlusCircle className="w-4 h-4" />}
            aria-label="Report problem"
          >
            {t('report_issue')}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              <span className="text-sm font-extrabold text-foreground">{t('report_challenge')}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-1 rounded-lg hover:bg-muted transition-colors"
            >
              {t('cancel')}
            </button>
          </div>

          <div>
            <input
              type="text"
              placeholder={t('problem_title')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-background rounded-xl px-4 py-2.5 text-sm font-bold border border-border focus:border-primary focus:outline-none min-h-[44px]"
              required
              minLength={5}
              maxLength={255}
            />
            {title.length > 0 && title.length < 5 && (
              <p className="text-[11px] text-amber-500 font-medium mt-1">Title must be at least 5 characters long.</p>
            )}
          </div>

          <div>
            <textarea
              placeholder={t('problem_description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-28 bg-background rounded-xl p-3.5 text-sm border border-border focus:border-primary focus:outline-none leading-relaxed"
              required
              minLength={20}
            />
            {description.length > 0 && description.length < 20 && (
              <p className="text-[11px] text-amber-500 font-medium mt-1">Description must be at least 20 characters long.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-sm">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProblemCategory)}
              className="bg-background border border-border rounded-xl px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:border-primary min-h-[44px]"
            >
              <option value="Water & Sanitation">{t('cat_water')}</option>
              <option value="Clean Energy & Solar">{t('cat_energy')}</option>
              <option value="Waste Management">{t('cat_waste')}</option>
              <option value="Agriculture & Rural Tech">{t('cat_agri')}</option>
              <option value="Healthcare & Medical Devices">{t('cat_health')}</option>
              <option value="Smart Infrastructure & Roads">{t('cat_infra')}</option>
            </select>

            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="District / Exact Location"
              className="bg-background border border-border rounded-xl px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:border-primary min-h-[44px]"
              required
            />

            <input
              type="text"
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              placeholder="State (e.g. Rajasthan)"
              className="bg-background border border-border rounded-xl px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:border-primary min-h-[44px]"
              required
            />
          </div>

          {mediaUrl && (
            <div className="p-2.5 border border-emerald-500/30 rounded-xl bg-emerald-500/10 flex items-center justify-between text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[280px]">
                {mediaType === 'video' 
                  ? (language === 'hi' ? '🎬 वीडियो संलग्न है' : '🎬 Cloudinary Video Attached')
                  : (language === 'hi' ? '🖼️ फोटो संलग्न है' : '🖼️ Cloudinary Photo Attached')
                }
              </span>
              <button
                type="button"
                onClick={() => {
                  setMediaUrl(null);
                  setMediaType(null);
                }}
                className="text-destructive font-bold hover:underline text-[11px]"
              >
                {language === 'hi' ? 'हटाएं' : 'Remove'}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border flex-wrap gap-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <label
                className="px-3 py-2 rounded-xl hover:bg-muted hover:text-foreground min-h-[40px] flex items-center gap-1.5 cursor-pointer border border-border/60 font-semibold transition-all"
                title="Upload Photo"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                )}
                <span>{t('photo')}</span>
                <input type="file" accept="image/*" onChange={(e) => handleMediaUpload(e, 'image')} className="hidden" />
              </label>

              <label
                className="px-3 py-2 rounded-xl hover:bg-muted hover:text-foreground min-h-[40px] flex items-center gap-1.5 cursor-pointer border border-border/60 font-semibold transition-all"
                title="Upload Video"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <Video className="w-4 h-4 text-purple-500" />
                )}
                <span>{t('video')}</span>
                <input type="file" accept="video/*" onChange={(e) => handleMediaUpload(e, 'video')} className="hidden" />
              </label>

              <button
                type="button"
                onClick={handleFetchLocation}
                className="px-3 py-2 rounded-xl hover:bg-muted hover:text-foreground min-h-[40px] flex items-center gap-1.5 cursor-pointer border border-border/60 font-semibold transition-all"
                title="Tag Exact Geolocation Name"
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                ) : (
                  <MapPin className="w-4 h-4 text-rose-500" />
                )}
                <span className="hidden sm:inline">{t('location')}</span>
              </button>
            </div>

            <Button
              type="submit"
              size="sm"
              isLoading={isLoading}
              disabled={isLoading || isUploading || title.trim().length < 5 || description.trim().length < 20}
              className="min-h-[40px] px-5 font-bold text-sm rounded-full shadow-xs"
            >
              {t('publish_challenge')}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
};
