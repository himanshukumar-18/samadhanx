import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProblemPost } from '../components/ProblemPost';
import { CreateProblemCard } from '../components/CreateProblemCard';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { FeedSkeleton } from '../../../shared/components/ui/FeedSkeleton';
import { Sparkles, Flame, MapPin, Clock, Inbox } from 'lucide-react';
import { problemsApi } from '../../../api/problems';
import { mapApiProblem } from '../../../lib/problemMapper';
import { useLanguageStore } from '../../../store/languageStore';
import { getTranslation } from '../../../lib/translations';

export const FeedPage: React.FC = () => {
  const { language } = useLanguageStore();
  const t = (key: string) => getTranslation(language, key);

  const [activeTab, setActiveTab] = useState<'for_you' | 'trending' | 'nearby' | 'latest'>('for_you');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = [
    { key: 'All', label: t('tab_all') },
    { key: 'Water & Sanitation', label: t('cat_water') },
    { key: 'Agriculture & Rural Tech', label: t('cat_agri') },
    { key: 'Healthcare & Medical Devices', label: t('cat_health') },
    { key: 'Clean Energy & Solar', label: t('cat_energy') },
    { key: 'Waste Management', label: t('cat_waste') },
  ];

  const { data: rawProblems, isLoading, refetch } = useQuery({
    queryKey: ['problems', selectedCategory, activeTab],
    queryFn: () =>
      problemsApi.listProblems({
        category: selectedCategory === 'All' ? undefined : selectedCategory,
        feed_type: activeTab,
      }),
  });

  const backendProblems = Array.isArray(rawProblems) ? rawProblems.map(mapApiProblem) : [];

  return (
    <div className="space-y-4 sm:space-y-5 min-w-0 w-full">
      {/* 1. Feed Tabs */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm p-1.5 rounded-2xl w-full max-w-full min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full min-w-0">
          <button
            onClick={() => setActiveTab('for_you')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all min-h-[40px] flex-shrink-0 ${
              activeTab === 'for_you'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Sparkles className="w-4 h-4" /> {t('tab_for_you')}
          </button>
          <button
            onClick={() => setActiveTab('trending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all min-h-[40px] flex-shrink-0 ${
              activeTab === 'trending'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Flame className="w-4 h-4" /> {t('tab_trending')}
          </button>
          <button
            onClick={() => setActiveTab('nearby')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all min-h-[40px] flex-shrink-0 ${
              activeTab === 'nearby'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <MapPin className="w-4 h-4" /> {t('tab_nearby')}
          </button>
          <button
            onClick={() => setActiveTab('latest')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all min-h-[40px] flex-shrink-0 ${
              activeTab === 'latest'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Clock className="w-4 h-4" /> {t('tab_latest')}
          </button>
        </div>
      </div>

      {/* 2. Horizontal Sector Filter Pills */}
      <div className="w-full max-w-full min-w-0 overflow-x-auto pb-1 no-scrollbar text-sm">
        <div className="flex items-center gap-2 min-w-max">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-all min-h-[38px] flex items-center flex-shrink-0 ${
                selectedCategory === cat.key
                  ? 'bg-primary/15 text-primary border border-primary/30 font-bold'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-border/80'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Inline Problem Creator Card */}
      <CreateProblemCard onCreated={refetch} />

      {/* 4. Stream of Problem Posts, Skeleton, or Empty State */}
      <div className="space-y-4 sm:space-y-5 w-full">
        {isLoading ? (
          <FeedSkeleton />
        ) : backendProblems.length > 0 ? (
          backendProblems.map((problem) => (
            <ProblemPost key={problem.id} problem={problem} />
          ))
        ) : (
          <EmptyState
            icon={Inbox}
            title={selectedCategory === 'All' ? (language === 'hi' ? 'अभी तक कोई समस्या दर्ज नहीं की गई है' : 'No societal problems reported yet') : `No problems in ${selectedCategory}`}
            description={language === 'hi' ? 'अपने समुदाय में सामाजिक चुनौती की रिपोर्ट करने वाले पहले व्यक्ति बनें।' : 'Be the first to report a societal challenge in your community.'}
            actionLabel={t('report_issue')}
            onAction={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          />
        )}
      </div>
    </div>
  );
};
