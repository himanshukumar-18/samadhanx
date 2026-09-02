import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Layers, Flame, MapPin, ShieldCheck, HeartHandshake } from 'lucide-react';
import { problemsApi } from '../../../api/problems';
import { useAuthStore } from '../../../store/authStore';
import { useLanguageStore } from '../../../store/languageStore';
import { getTranslation } from '../../../lib/translations';

interface ProblemSidebarItem {
  id: string;
  title: string;
  category: string;
  district?: string;
}

export const RightSidebar: React.FC = () => {
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const isCitizenRole = !user || (user.role as string) === 'citizen' || (user.role as string) === 'community';

  const t = (key: string) => getTranslation(language, key);

  const { data: recentProblems } = useQuery({
    queryKey: ['right-sidebar-recent-problems'],
    queryFn: () => problemsApi.listProblems({ limit: 4 }),
  });

  return (
    <aside className="w-full space-y-4 py-2 px-1 select-none">
      {/* 1. Community Mission Card */}
      <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-2.5">
        <div className="flex items-center gap-1.5 text-primary text-xs font-black">
          <Layers className="w-4 h-4 text-primary" /> {t('network_title')}
        </div>
        <p className="text-sm text-foreground font-bold leading-snug">
          {t('network_tagline')}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('network_desc')}
        </p>
        <Button variant="primary" size="sm" className="w-full text-xs min-h-[38px] rounded-xl font-bold mt-1" onClick={() => (window.location.href = '/explore')}>
          {t('nav_explore')}
        </Button>
      </div>

      {/* 2. Live Recent Problems from Backend */}
      <Card className="p-4 space-y-3 rounded-2xl">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Flame className="w-4 h-4 text-amber-500" /> {t('recent_problems')}
          </div>
          <a href="/explore" className="text-xs text-primary hover:underline font-semibold">
            {language === 'hi' ? 'सभी देखें' : 'Browse'}
          </a>
        </div>
        {Array.isArray(recentProblems) && recentProblems.length > 0 ? (
          <div className="space-y-2.5">
            {recentProblems.map((prob: ProblemSidebarItem) => (
              <a key={prob.id} href={`/problems/${prob.id}`} className="block group">
                <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {prob.title}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">{prob.category}</span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-3 h-3 text-rose-500" /> {prob.district || (language === 'hi' ? 'राष्ट्रीय' : 'National')}
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {language === 'hi' 
              ? 'जल, कृषि, स्वच्छ ऊर्जा और स्वास्थ्य सेवा में वर्गीकृत सत्यापित सामुदायिक मुद्दों को ब्राउज़ करें।'
              : 'Browse verified community issues categorized across water, agriculture, clean energy, and healthcare.'
            }
          </p>
        )}
      </Card>

      {/* 3. Role-Specific Card: Citizen Impact Card vs Solution Pods Card */}
      {isCitizenRole ? (
        <Card className="p-4 space-y-3 rounded-2xl border-primary/20 bg-muted/30">
          <div className="flex items-center gap-1.5 text-sm font-bold text-foreground pb-2 border-b border-border">
            <HeartHandshake className="w-4 h-4 text-primary" /> {t('community_impact')}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('community_impact_desc')}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold pt-1">
            <ShieldCheck className="w-3.5 h-3.5" /> {language === 'hi' ? 'सत्यापित नागरिक भागीदारी' : 'Verified Civic Participation'}
          </div>
        </Card>
      ) : (
        <Card className="p-4 space-y-3 rounded-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Layers className="w-4 h-4 text-emerald-500" /> {language === 'hi' ? 'समाधान पॉड्स' : 'Solution Pods'}
            </div>
            <a href="/explore" className="text-xs text-primary hover:underline font-semibold">{t('nav_explore')}</a>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {language === 'hi'
              ? 'प्रोटोटाइप बनाने और समाधानों को बढ़ाने के लिए अंतःविषय टीमों में सहयोग करें।'
              : 'Collaborate in interdisciplinary teams to build prototypes and scale impactful solutions.'
            }
          </p>
        </Card>
      )}
    </aside>
  );
};
