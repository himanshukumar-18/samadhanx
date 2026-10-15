import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  RefreshCw,
  Edit3,
  CheckCircle2,
  MapPin,
  Clock,
  X,
  ExternalLink,
  ShieldAlert,
  Check,
  Image as ImageIcon,
  Video,
  Loader2,
  Trash2,
} from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Badge } from '../../../shared/components/ui/Badge';
import { Input } from '../../../shared/components/ui/Input';
import {
  citizenAssistantApi,
  AssistantTurnResponse,
  GeneratedProblemDraft,
} from '../../../api/ai';
import { problemsApi } from '../../../api/problems';
import { ProblemCategory, ImpactLevel } from '../../../types/problem';
import { useLanguageStore } from '../../../store/languageStore';
import toast from 'react-hot-toast';

interface MessageItem {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

interface SmartProblemAssistantProps {
  onSuccess?: () => void;
  onClose?: () => void;
  districtHint?: string;
}

const CANONICAL_CATEGORIES: ProblemCategory[] = [
  'Smart Infrastructure & Roads',
  'Water & Sanitation',
  'Waste Management',
  'Clean Energy & Solar',
  'Healthcare & Medical Devices',
  'Education & Skill Development',
  'Agriculture & Rural Tech',
  'Disaster Management & Safety',
];

export const SmartProblemAssistant: React.FC<SmartProblemAssistantProps> = ({
  onSuccess,
  onClose,
  districtHint,
}) => {
  const { language } = useLanguageStore();

  // Assistant session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(15);
  const [suggestedAnswers, setSuggestedAnswers] = useState<string[]>([]);
  const [currentField, setCurrentField] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(0);

  // Completed draft state
  const [isComplete, setIsComplete] = useState(false);
  const [draft, setDraft] = useState<GeneratedProblemDraft | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasDismissedDuplicates, setHasDismissedDuplicates] = useState(false);
  const [similarProblems, setSimilarProblems] = useState<NonNullable<AssistantTurnResponse['similar_problems']>>([]);

  // Editable draft fields
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<ProblemCategory>('Smart Infrastructure & Roads');
  const [editLocation, setEditLocation] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editSeverity, setEditSeverity] = useState<ImpactLevel>('medium');

  // Media & GPS Location attachments
  interface AttachedMedia {
    url: string;
    type: 'image' | 'video';
    name: string;
  }
  const [mediaItems, setMediaItems] = useState<AttachedMedia[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Media upload handler (images up to 10MB, videos up to 25MB)
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const maxMB = type === 'video' ? 25 : 10;
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(
        language === 'hi'
          ? `फ़ाइल का आकार ${maxMB}MB से कम होना चाहिए।`
          : `File size must be less than ${maxMB}MB.`
      );
      return;
    }

    try {
      setIsUploading(true);
      const res = await problemsApi.uploadMedia(file);
      setMediaItems((prev) => [
        ...prev,
        {
          url: res.url,
          type,
          name: file.name,
        },
      ]);
      toast.success(
        language === 'hi'
          ? `${type === 'video' ? 'वीडियो' : 'फोटो'} सफलतापूर्वक अपलोड किया गया!`
          : `${type === 'video' ? 'Video' : 'Photo'} uploaded successfully!`
      );
    } catch {
      toast.error(language === 'hi' ? 'अपलोड विफल रहा।' : `Failed to upload ${type}.`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  // High-accuracy device GPS with robust IP geolocation fallbacks
  const handleFetchLocation = async () => {
    setIsLocating(true);

    interface GeoLocResult {
      latitude: number;
      longitude: number;
      district: string;
      state: string;
      source: 'gps' | 'ip';
    }

    const fetchIpLocation = async (): Promise<GeoLocResult | null> => {
      // 1. BigDataCloud IP Geo
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
        // Fallback
      }

      // 2. ipwho.is fallback
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
        // Fallback
      }

      return null;
    };

    try {
      let geoResult: GeoLocResult | null = null;

      // 1. Device GPS / Browser Geolocation
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
            pos = await getDevicePos(false);
          }

          if (pos && pos.coords) {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            let resolvedDistrict = '';
            let resolvedState = '';

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
              // Ignore
            }

            if (!resolvedDistrict) {
              try {
                const osmRes = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
                );
                if (osmRes.ok) {
                  const data = await osmRes.json();
                  if (data && data.address) {
                    const suburb = data.address.suburb || data.address.neighbourhood || '';
                    const city = data.address.city || data.address.town || data.address.village || data.address.county || '';
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
          // Device GPS unavailable, fall through
        }
      }

      // 2. IP Geolocation fallback
      if (!geoResult) {
        geoResult = await fetchIpLocation();
      }

      if (geoResult) {
        setLatitude(geoResult.latitude);
        setLongitude(geoResult.longitude);

        if (!editDistrict || editDistrict === 'Ranchi' || editDistrict === 'New Delhi') {
          setEditDistrict(geoResult.district);
        }
        if (!editLocation) {
          setEditLocation(geoResult.district);
        }

        toast.success(
          language === 'hi'
            ? `📍 स्थान प्राप्त: ${geoResult.district} (${geoResult.source.toUpperCase()})`
            : `📍 Location detected: ${geoResult.district} (${geoResult.source.toUpperCase()})`
        );
      } else {
        toast.error(
          language === 'hi'
            ? 'स्थान प्राप्त करने में असमर्थ। कृपया मैन्युअल रूप से दर्ज करें।'
            : 'Could not detect location. Please type your area or district manually.'
        );
      }
    } catch {
      toast.error('Location detection failed.');
    } finally {
      setIsLocating(false);
    }
  };

  // Initialize session on mount
  useEffect(() => {
    startNewSession();
  }, []);

  const startNewSession = async () => {
    try {
      setIsLoading(true);
      setIsComplete(false);
      setDraft(null);
      setIsEditingDraft(false);
      setHasDismissedDuplicates(false);
      setSimilarProblems([]);
      setMessages([]);
      setMediaItems([]);
      setLatitude(null);
      setLongitude(null);

      const res = await citizenAssistantApi.createSession(undefined, districtHint);
      const data = res.data;

      setSessionId(data.session_id);
      setProgress(data.progress || 15);
      setTurnCount(data.turn_count || 0);
      setSuggestedAnswers(data.suggested_answers || []);
      setCurrentField(data.field || 'description');

      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: data.message,
        },
      ]);
    } catch {
      toast.error(
        language === 'hi'
          ? 'स्मार्ट सहायक लोड करने में असमर्थ। आप मानक फॉर्म का उपयोग कर सकते हैं।'
          : 'Smart Assistant is temporarily unavailable. You can continue with the standard form.'
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputMessage).trim();
    if (!text || !sessionId || isLoading) return;

    setInputMessage('');
    setSuggestedAnswers([]);

    // Add user message to UI immediately
    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', content: text }]);

    try {
      setIsLoading(true);
      const res = await citizenAssistantApi.sendMessage(sessionId, text);
      const data = res.data;

      setProgress(data.progress);
      setTurnCount(data.turn_count);
      setSuggestedAnswers(data.suggested_answers || []);
      setCurrentField(data.field || null);

      // Add AI reply
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.message,
        },
      ]);

      // If finished, load draft into review view
      if (data.complete && data.problem) {
        setDraft(data.problem);
        setEditTitle(data.problem.title);
        setEditDescription(data.problem.description);
        setEditCategory(data.problem.category as ProblemCategory);
        setEditLocation(data.problem.location);
        setEditDistrict(data.problem.district);
        setEditSeverity(data.problem.severity);
        setSimilarProblems(data.similar_problems || []);
        setIsComplete(true);
      }
    } catch {
      toast.error(
        language === 'hi'
          ? 'संदेश भेजने में त्रुटि हुई। कृपया पुनः प्रयास करें।'
          : 'Failed to process message. Please try again.'
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  const handleForceFinalize = async () => {
    if (!sessionId || isLoading) return;
    try {
      setIsLoading(true);
      const res = await citizenAssistantApi.finalizeSession(sessionId);
      const data = res.data;

      if (data.problem) {
        setDraft(data.problem);
        setEditTitle(data.problem.title);
        setEditDescription(data.problem.description);
        setEditCategory(data.problem.category as ProblemCategory);
        setEditLocation(data.problem.location);
        setEditDistrict(data.problem.district);
        setEditSeverity(data.problem.severity);
        setSimilarProblems(data.similar_problems || []);
        setProgress(100);
        setIsComplete(true);

        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: data.message,
          },
        ]);
      }
    } catch {
      toast.error('Failed to finalize problem draft. Please continue answering.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!draft) return;

    if (editTitle.trim().length < 5) {
      toast.error('Title must be at least 5 characters long.');
      return;
    }
    if (editDescription.trim().length < 20) {
      toast.error('Description must be at least 20 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      await problemsApi.createProblem({
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory,
        district: editDistrict.trim() || 'Ranchi',
        state: draft.state || 'Jharkhand',
        location: `${editLocation.trim()}, ${editDistrict.trim()}`,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        impact_level: editSeverity,
        tags: [editCategory.split(' ')[0], 'CivicAssistant', 'CommunityReport'],
        media_urls: mediaItems.map((m) => m.url),
      });

      toast.success(
        language === 'hi'
          ? 'आपकी समस्या सफलतापूर्वक प्रकाशित कर दी गई!'
          : 'Your problem report has been submitted successfully!'
      );

      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message || err?.response?.data?.error?.message || 'Failed to submit problem.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="flex flex-col h-[650px] max-h-[85vh] w-full max-w-2xl mx-auto rounded-3xl border border-primary/20 shadow-xl overflow-hidden bg-card/95 backdrop-blur-md">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border/80 bg-primary/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm text-foreground tracking-tight">Smart Problem Assistant</h2>
              <Badge variant="student" className="text-[10px] px-1.5 py-0.2">
                Civic Guide
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Guiding you step-by-step to report your community issue clearly
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={startNewSession}
            disabled={isLoading}
            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
            title="Start over"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Restart
          </Button>
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-muted/60 h-1.5 overflow-hidden">
        <div
          className="bg-primary h-full transition-all duration-500 ease-out rounded-r-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
        {!isComplete ? (
          <>
            {/* Messages Stream */}
            {messages.map((m) => {
              const isAi = m.role === 'assistant';
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2.5 text-xs sm:text-sm ${
                    isAi ? 'justify-start' : 'justify-end'
                  }`}
                >
                  {isAi && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                      isAi
                        ? 'bg-muted/70 text-foreground border border-border/60 rounded-tl-xs shadow-xs'
                        : 'bg-primary text-primary-foreground rounded-tr-xs shadow-xs font-medium'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}

            {/* AI Typing Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pl-8">
                <div className="flex items-center gap-1 bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                  <span className="text-[11px] font-medium ml-1">Analyzing details...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        ) : (
          /* Generated Problem Review & Edit View */
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Success Banner */}
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-[11px]">
                  Problem report prepared! Review below before publishing to community feed.
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingDraft(!isEditingDraft)}
                className="h-6 px-2 text-[10px] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              >
                <Edit3 className="w-3 h-3 mr-1" />
                {isEditingDraft ? 'Done Editing' : 'Edit Details'}
              </Button>
            </div>

            {/* Duplicate Problems Warning Section */}
            {similarProblems.length > 0 && !hasDismissedDuplicates && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-[11px]">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      Notice: Similar problems already reported in your area ({similarProblems.length})
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setHasDismissedDuplicates(true)}
                    className="h-6 text-[10px] text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                  >
                    Continue Anyway
                  </Button>
                </div>

                <div className="space-y-1.5">
                  {similarProblems.slice(0, 2).map((sim) => (
                    <div
                      key={sim.id}
                      className="p-2 rounded-lg bg-card/80 border border-border/80 flex items-center justify-between gap-2 text-[11px]"
                    >
                      <div className="truncate flex-1">
                        <span className="font-bold text-foreground">{sim.title}</span>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>📍 {sim.district}</span>
                          <span>•</span>
                          <span className="capitalize">{sim.status}</span>
                        </div>
                      </div>
                      <a
                        href={`/problems/${sim.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-primary hover:underline shrink-0 flex items-center gap-0.5 font-semibold"
                      >
                        View <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Editable or Display Card */}
            {!isEditingDraft ? (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-3 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase text-primary tracking-wider">Title</div>
                  <h3 className="font-extrabold text-sm text-foreground mt-0.5">{editTitle}</h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="default" className="text-[10px]">
                    {editCategory}
                  </Badge>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-primary" />
                    {editLocation}, {editDistrict}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold uppercase">
                    Severity: {editSeverity}
                  </span>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1">
                    Description
                  </div>
                  <p className="text-foreground leading-relaxed text-xs bg-card p-3 rounded-xl border border-border/60">
                    {editDescription}
                  </p>
                </div>

                {draft?.duration && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>
                      <strong>Reported Duration:</strong> {draft.duration}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                    Problem Title
                  </label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="h-8 text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Category
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as ProblemCategory)}
                      className="w-full h-8 px-2 rounded-lg border border-border bg-card text-xs font-medium"
                    >
                      {CANONICAL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Severity Level
                    </label>
                    <select
                      value={editSeverity}
                      onChange={(e) => setEditSeverity(e.target.value as ImpactLevel)}
                      className="w-full h-8 px-2 rounded-lg border border-border bg-card text-xs font-medium"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Village / Locality
                    </label>
                    <Input
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      District
                    </label>
                    <Input
                      value={editDistrict}
                      onChange={(e) => setEditDistrict(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-border bg-card text-xs leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* Evidence & Location Verification Card */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span>Attachments & GPS Verification</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <label className="h-7 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs">
                    {isUploading ? (
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    ) : (
                      <ImageIcon className="w-3 h-3 text-emerald-500" />
                    )}
                    <span>{language === 'hi' ? 'फोटो' : 'Photo'}</span>
                    <input type="file" accept="image/*" onChange={(e) => handleMediaUpload(e, 'image')} className="hidden" />
                  </label>

                  <label className="h-7 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs">
                    {isUploading ? (
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    ) : (
                      <Video className="w-3 h-3 text-purple-500" />
                    )}
                    <span>{language === 'hi' ? 'वीडियो' : 'Video'}</span>
                    <input type="file" accept="video/*" onChange={(e) => handleMediaUpload(e, 'video')} className="hidden" />
                  </label>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleFetchLocation}
                    disabled={isLocating}
                    className="h-7 px-2.5 text-[11px] font-semibold gap-1 shadow-2xs border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                  >
                    {isLocating ? (
                      <Loader2 className="w-3 h-3 animate-spin text-rose-500" />
                    ) : (
                      <MapPin className="w-3 h-3 text-rose-500 fill-rose-500/20" />
                    )}
                    <span>{latitude !== null ? (language === 'hi' ? 'GPS अपडेट' : 'Update GPS') : (language === 'hi' ? 'GPS स्थान' : 'Auto GPS')}</span>
                  </Button>
                </div>
              </div>

              {/* Attached GPS badge */}
              {latitude !== null && longitude !== null && (
                <div className="p-2.5 border border-rose-500/30 rounded-xl bg-rose-500/10 flex items-center justify-between text-xs">
                  <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5 truncate">
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

              {/* Uploaded media previews */}
              {mediaItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {mediaItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 border border-emerald-500/30 rounded-xl bg-emerald-500/10 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {item.type === 'image' ? (
                          <img src={item.url} alt="Evidence" className="w-8 h-8 rounded-lg object-cover border border-emerald-500/30" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-600 flex items-center justify-center shrink-0">
                            <Video className="w-4 h-4" />
                          </div>
                        )}
                        <div className="truncate">
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300 block truncate text-[11px]">
                            {item.name || (item.type === 'video' ? 'Video Evidence' : 'Photo Evidence')}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">
                            {item.type === 'video' ? 'Video Attached' : 'Photo Attached'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMedia(idx)}
                        className="text-destructive hover:opacity-80 p-1 shrink-0"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground italic">
                  {language === 'hi'
                    ? 'कोई फोटो, वीडियो या GPS स्थान संलग्न नहीं है। आप ऊपर दिए गए बटनों से जोड़ सकते हैं।'
                    : 'No photos, videos, or GPS coordinates attached yet. You can attach evidence using the buttons above.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Suggested Quick Answer Chips (When asking questions) */}
      {!isComplete && suggestedAnswers.length > 0 && (
        <div className="px-4 py-2 border-t border-border/50 bg-muted/20 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">Suggestions:</span>
          {suggestedAnswers.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(chip)}
              disabled={isLoading}
              className="text-[11px] px-2.5 py-1 rounded-full bg-card border border-border/80 text-foreground hover:bg-primary/10 hover:border-primary/40 transition-colors whitespace-nowrap shrink-0 shadow-2xs font-medium"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Live Attachment Chips in Chat */}
      {!isComplete && (mediaItems.length > 0 || latitude !== null || isUploading || isLocating) && (
        <div className="px-4 py-1.5 border-t border-border/40 bg-muted/10 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">Attachments:</span>
          {latitude !== null && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20 shrink-0">
              <MapPin className="w-3 h-3 text-rose-500" />
              GPS: {latitude.toFixed(2)}°, {longitude?.toFixed(2)}°
              <button
                type="button"
                onClick={() => {
                  setLatitude(null);
                  setLongitude(null);
                }}
                className="hover:opacity-75 ml-0.5"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
          {mediaItems.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20 shrink-0"
            >
              {item.type === 'image' ? <ImageIcon className="w-3 h-3" /> : <Video className="w-3 h-3" />}
              <span className="truncate max-w-[100px]">{item.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveMedia(idx)}
                className="hover:opacity-75 ml-0.5"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          {isUploading && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] shrink-0">
              <Loader2 className="w-3 h-3 animate-spin text-primary" /> Uploading...
            </span>
          )}
          {isLocating && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[10px] shrink-0">
              <Loader2 className="w-3 h-3 animate-spin text-rose-500" /> Locating...
            </span>
          )}
        </div>
      )}

      {/* Footer Controls */}
      <div className="p-3.5 border-t border-border/80 bg-card flex items-center justify-between gap-2">
        {!isComplete ? (
          <>
            <div className="flex-1 flex items-center gap-1.5">
              {/* Media & GPS Attachment Quick Buttons */}
              <div className="flex items-center gap-0.5 shrink-0">
                <label
                  title="Upload Photo"
                  className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-emerald-500 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleMediaUpload(e, 'image')}
                    className="hidden"
                  />
                </label>
                <label
                  title="Upload Video"
                  className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-purple-500 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Video className="w-4 h-4 text-purple-500" />
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => handleMediaUpload(e, 'video')}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  title="Attach GPS Location"
                  onClick={handleFetchLocation}
                  disabled={isLocating}
                  className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-rose-500 flex items-center justify-center transition-colors"
                >
                  {isLocating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                  ) : (
                    <MapPin className={`w-4 h-4 ${latitude ? 'text-rose-500 fill-rose-500/20' : 'text-rose-500'}`} />
                  )}
                </button>
              </div>

              <Input
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
                placeholder={
                  currentField === 'location'
                    ? 'Type village or area name...'
                    : currentField === 'duration'
                    ? 'How long has this issue lasted?...'
                    : 'Describe your community problem...'
                }
                className="h-9 text-xs"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputMessage.trim()}
                className="h-9 px-3 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>

            {turnCount >= 2 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleForceFinalize}
                disabled={isLoading}
                className="h-9 text-[11px] shrink-0 font-semibold"
                title="Generate draft report immediately"
              >
                Finish & Review
              </Button>
            )}
          </>
        ) : (
          <div className="w-full flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsComplete(false)}
              className="h-9 text-xs"
            >
              Back to Chat
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="h-9 px-4 text-xs font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Submit Problem Report
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
