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
import { Image as ImageIcon, MapPin, PlusCircle, Loader2, Video, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { problemsApi } from '../../../api/problems';
import { SmartProblemAssistant } from '../../citizen/components/SmartProblemAssistant';

import { useDuplicateCheck } from '../hooks/useDuplicateCheck';
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
  const [creationMode, setCreationMode] = useState<'form' | 'assistant'>('form');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProblemCategory>('Water & Sanitation');
  const [district, setDistrict] = useState('New Delhi');
  const [stateName, setStateName] = useState('Delhi');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { candidates, dismissed: isDuplicatesDismissed, dismissCandidates } = useDuplicateCheck({
    title,
    description,
    category,
    district,
  });

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

  const handleFetchLocation = async () => {
    setIsLocating(true);

    interface GeoLocResult {
      latitude: number;
      longitude: number;
      district: string;
      state: string;
      source: 'gps' | 'ip';
    }

    // Helper to fetch IP-based geolocation when device GPS is unavailable or blocked
    const fetchIpLocation = async (): Promise<GeoLocResult | null> => {
      // 1. Primary IP Geo: BigDataCloud (CORS enabled, highly accurate in India)
      try {
        const res = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client');
        if (res.ok) {
          const data = await res.json();
          const lat = typeof data.latitude === 'number' ? data.latitude : parseFloat(data.latitude);
          const lng = typeof data.longitude === 'number' ? data.longitude : parseFloat(data.longitude);
          const locality = data.locality || '';
          const city = data.city || data.principalSubdivision || '';
          const state = data.principalSubdivision || '';
          const districtName = locality && city && locality !== city ? `${locality}, ${city}` : (city || locality);
          if (!isNaN(lat) && !isNaN(lng)) {
            return {
              latitude: lat,
              longitude: lng,
              district: districtName || 'Local Area',
              state: state || 'India',
              source: 'ip',
            };
          }
        }
      } catch {
        // Continue to secondary IP provider
      }

      // 2. Secondary IP Geo: ipwho.is (Free, CORS enabled, reliable global geo)
      try {
        const res = await fetch('https://ipwho.is/');
        if (res.ok) {
          const data = await res.json();
          if (data && data.success !== false) {
            const lat = typeof data.latitude === 'number' ? data.latitude : parseFloat(data.latitude);
            const lng = typeof data.longitude === 'number' ? data.longitude : parseFloat(data.longitude);
            const city = data.city || '';
            const region = data.region || '';
            if (!isNaN(lat) && !isNaN(lng)) {
              return {
                latitude: lat,
                longitude: lng,
                district: city || region || 'Local Area',
                state: region || 'India',
                source: 'ip',
              };
            }
          }
        }
      } catch {
        // Continue to tertiary provider
      }

      // 3. Tertiary IP Geo: ipapi.co
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          const lat = parseFloat(data.latitude);
          const lng = parseFloat(data.longitude);
          if (!isNaN(lat) && !isNaN(lng)) {
            return {
              latitude: lat,
              longitude: lng,
              district: data.city || data.region || 'Local Area',
              state: data.region || 'India',
              source: 'ip',
            };
          }
        }
      } catch {
        // Fallback exhausted
      }

      return null;
    };

    try {
      let geoResult: GeoLocResult | null = null;

      // 1. First, attempt Device GPS / Browser Geolocation if supported
      if (typeof window !== 'undefined' && navigator.geolocation) {
        const getDevicePos = (highAccuracy: boolean): Promise<GeolocationPosition> => {
          return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: highAccuracy,
              timeout: highAccuracy ? 5000 : 7000,
              maximumAge: 60000,
            });
          });
        };

        try {
          let pos: GeolocationPosition | null = null;
          try {
            pos = await getDevicePos(true);
          } catch {
            // High accuracy timed out or unavailable on desktop/PC, try low accuracy
            pos = await getDevicePos(false);
          }

          if (pos && pos.coords) {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            let resolvedDistrict = '';
            let resolvedState = '';

            // Reverse geocode device GPS coords
            try {
              const bdcRes = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
              );
              if (bdcRes.ok) {
                const data = await bdcRes.json();
                const locality = data.locality || '';
                const city = data.city || data.principalSubdivision || '';
                resolvedDistrict = locality && city && locality !== city ? `${locality}, ${city}` : (city || locality);
                resolvedState = data.principalSubdivision || '';
              }
            } catch {
              // Ignore and try OSM Nominatim
            }

            if (!resolvedDistrict) {
              try {
                const osmRes = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
                );
                if (osmRes.ok) {
                  const data = await osmRes.json();
                  if (data && data.address) {
                    const suburb = data.address.suburb || data.address.neighbourhood || data.address.residential || '';
                    const city = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state_district || '';
                    resolvedDistrict = suburb && city ? `${suburb}, ${city}` : (city || suburb);
                    resolvedState = data.address.state || '';
                  }
                }
              } catch {
                // Ignore
              }
            }

            geoResult = {
              latitude: lat,
              longitude: lng,
              district: resolvedDistrict || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              state: resolvedState || 'India',
              source: 'gps',
            };
          }
        } catch {
          // Device GPS unavailable/denied - seamlessly fall through to IP Geolocation below
        }
      }

      // 2. If Device GPS failed or was unavailable, automatically fall back to IP Geolocation
      if (!geoResult) {
        geoResult = await fetchIpLocation();
      }

      // 3. Apply location outcome
      if (geoResult) {
        setLatitude(geoResult.latitude);
        setLongitude(geoResult.longitude);
        if (geoResult.district) setDistrict(geoResult.district);
        if (geoResult.state) setStateName(geoResult.state);

        if (geoResult.source === 'gps') {
          toast.success(
            language === 'hi'
              ? `📍 GPS स्थान टैग किया गया: ${geoResult.district}, ${geoResult.state}`
              : `📍 GPS location tagged: ${geoResult.district}, ${geoResult.state}`
          );
        } else {
          toast.success(
            language === 'hi'
              ? `🌐 नेटवर्क/IP स्थान पहचाना गया: ${geoResult.district}, ${geoResult.state}`
              : `🌐 Location detected via Network/IP: ${geoResult.district}, ${geoResult.state}`
          );
        }
      } else {
        toast.error(
          language === 'hi'
            ? 'स्वचालित स्थान प्राप्त करने में असमर्थ। कृपया नीचे जिला और राज्य मैन्युअल रूप से दर्ज करें।'
            : 'Unable to detect location automatically. Please enter district and state manually below.'
        );
      }
    } catch {
      toast.error(
        language === 'hi'
          ? 'स्थान सेवा अनुपलब्ध है। कृपया नीचे मैन्युअल रूप से दर्ज करें।'
          : 'Location service unavailable. Please enter district manually.'
      );
    } finally {
      setIsLocating(false);
    }
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
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        impact_level: 'high',
        tags: [category.split(' ')[0], 'Community'],
        media_urls: mediaUrl ? [mediaUrl] : [],
      });

      toast.success(language === 'hi' ? 'समस्या सफलतापूर्वक प्रकाशित की गई!' : 'Problem challenge published to community feed!');
      setTitle('');
      setDescription('');
      setMediaUrl(null);
      setMediaType(null);
      setLatitude(null);
      setLongitude(null);
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

  if (isOpen && creationMode === 'assistant') {
    return (
      <SmartProblemAssistant
        districtHint={district}
        onSuccess={() => {
          setIsOpen(false);
          setCreationMode('form');
          if (onCreated) onCreated();
        }}
        onClose={() => {
          setCreationMode('form');
          setIsOpen(false);
        }}
      />
    );
  }

  return (
    <Card className="p-4 sm:p-5 shadow-sm border border-border/80 rounded-2xl bg-card hover:border-primary/30 transition-all">
      {!isOpen ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {/* User Avatar with Circled Border Ring */}
            <div className="p-0.5 rounded-full ring-2 ring-primary/40 flex-shrink-0">
              <UserAvatar src={avatarUrl} name={displayName} size="lg" />
            </div>

            <button
              onClick={() => {
                setCreationMode('form');
                setIsOpen(true);
              }}
              className="flex-1 text-left bg-muted/60 hover:bg-muted text-muted-foreground px-4 py-2.5 rounded-full text-sm font-semibold border border-transparent hover:border-border transition-all min-h-[44px] flex items-center"
            >
              {t('what_problem')}
            </button>

            <Button
              variant="primary"
              size="sm"
              className="min-h-[44px] px-4 font-bold text-sm rounded-full shadow-xs"
              onClick={() => {
                setCreationMode('form');
                setIsOpen(true);
              }}
              leftIcon={<PlusCircle className="w-4 h-4" />}
              aria-label="Report problem"
            >
              {t('report_issue')}
            </Button>
          </div>

          <div className="flex items-center justify-between pt-1 px-1 border-t border-border/40 text-xs">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Need help reporting in simple language?
            </span>
            <button
              type="button"
              onClick={() => {
                setCreationMode('assistant');
                setIsOpen(true);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/90 bg-primary/10 hover:bg-primary/20 px-3 py-1 rounded-full transition-all shadow-2xs"
            >
              <Sparkles className="w-3 h-3 text-primary" />
              Try Smart Assistant
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
          {/* Top Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-muted/70 rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => setCreationMode('form')}
              className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all bg-card text-foreground shadow-xs"
            >
              Standard Form
            </button>
            <button
              type="button"
              onClick={() => setCreationMode('assistant')}
              className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-primary hover:bg-primary/10"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Smart Assistant (AI Guided)
            </button>
          </div>

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

          {/* Citizen Duplicate Pre-Check Non-Blocking Warning */}
          <AnimatePresence>
            {candidates.length > 0 && !isDuplicatesDismissed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>
                        {language === 'hi'
                          ? 'समान समस्या पहले से दर्ज है'
                          : 'Similar problems already reported in your area'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={dismissCandidates}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {language === 'hi' ? 'मेरी समस्या अलग है, जारी रखें' : 'Mine is different, continue'}
                    </button>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    {language === 'hi'
                      ? 'समान समस्या का समर्थन करने से उस पर जल्द कार्रवाई होने की संभावना बढ़ जाती है।'
                      : 'Supporting an existing report increases community traction and speeds up civic resolution.'}
                  </p>

                  <div className="space-y-2">
                    {candidates.slice(0, 3).map((cand) => (
                      <div
                        key={cand.id}
                        className="p-2.5 bg-background border border-border/80 rounded-lg flex items-center justify-between gap-2 hover:border-amber-500/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground text-xs truncate max-w-[260px]">
                              {cand.title}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-full ${
                                cand.similarity_label === 'very_similar'
                                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {cand.similarity_label === 'very_similar'
                                ? (language === 'hi' ? 'अत्यधिक समान' : 'Very Similar')
                                : (language === 'hi' ? 'समान' : 'Similar')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                            <span>📍 {cand.district}</span>
                            <span>•</span>
                            <span>🏷️ {cand.category}</span>
                            <span>•</span>
                            <span>👍 {cand.endorsement_count} {language === 'hi' ? 'समर्थक' : 'supporters'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-[11px] h-7 px-2"
                            onClick={async () => {
                              try {
                                await problemsApi.toggleEndorsement(cand.id);
                                toast.success(
                                  language === 'hi'
                                    ? 'आपने मौजूदा समस्या का समर्थन किया!'
                                    : 'Supported existing problem instead!'
                                );
                                setIsOpen(false);
                                if (onCreated) onCreated();
                              } catch {
                                toast.error('Failed to support problem.');
                              }
                            }}
                          >
                            {language === 'hi' ? 'समर्थन दें' : 'Support instead'}
                          </Button>
                          <a
                            href={`#problem-${cand.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-primary hover:underline px-1 font-semibold"
                          >
                            {language === 'hi' ? 'देखें' : 'View'}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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

          {latitude !== null && longitude !== null && (
            <div className="p-2.5 border border-rose-500/30 rounded-xl bg-rose-500/10 flex items-center justify-between text-xs">
              <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5 truncate max-w-[280px] sm:max-w-none">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-rose-500 fill-rose-500/20" />
                <span>
                  {language === 'hi' ? '📍 GPS स्थान संलग्न:' : '📍 GPS Location Attached:'}{' '}
                  {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setLatitude(null);
                  setLongitude(null);
                }}
                className="text-destructive font-bold hover:underline text-[11px] shrink-0 ml-2"
              >
                {language === 'hi' ? 'हटाएं' : 'Remove'}
              </button>
            </div>
          )}

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
                disabled={isLocating}
                className={`px-3 py-2 rounded-xl hover:bg-muted hover:text-foreground min-h-[40px] flex items-center gap-1.5 cursor-pointer border font-semibold transition-all ${
                  latitude !== null
                    ? 'border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'border-border/60 text-muted-foreground'
                }`}
                title={language === 'hi' ? 'जीपीएस स्थान प्राप्त करें' : 'Tag GPS & Exact Location'}
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                ) : (
                  <MapPin className={`w-4 h-4 ${latitude !== null ? 'text-rose-500 fill-rose-500/20' : 'text-rose-500'}`} />
                )}
                <span className="hidden sm:inline">
                  {isLocating
                    ? (language === 'hi' ? 'स्थान खोज रहे हैं...' : 'Locating...')
                    : latitude !== null && longitude !== null
                      ? `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`
                      : t('location')}
                </span>
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
