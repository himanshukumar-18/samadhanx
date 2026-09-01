import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProblemPost } from '../components/ProblemPost';
import { CreateProblemCard } from '../components/CreateProblemCard';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { FeedSkeleton } from '../../../shared/components/ui/FeedSkeleton';
import { Sparkles, Flame, MapPin, Clock, Inbox } from 'lucide-react';
import { problemsApi } from '../../../api/problems';
import { mapApiProblem } from '../../../lib/problemMapper';

export const FeedPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'for_you' | 'trending' | 'nearby' | 'latest'>('for_you');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = [
    'All',
    'Water & Sanitation',
    'Agriculture & Rural Tech',
    'Healthcare & Medical Devices',
    'Clean Energy & Solar',
    'Waste Management',
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
            <Sparkles className="w-4 h-4" /> For You
          </button>
          <button
            onClick={() => setActiveTab('trending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all min-h-[40px] flex-shrink-0 ${
              activeTab === 'trending'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Flame className="w-4 h-4" /> Trending
          </button>
          <button
            onClick={() => setActiveTab('nearby')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all min-h-[40px] flex-shrink-0 ${
              activeTab === 'nearby'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <MapPin className="w-4 h-4" /> Nearby
          </button>
          <button
            onClick={() => setActiveTab('latest')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all min-h-[40px] flex-shrink-0 ${
              activeTab === 'latest'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Clock className="w-4 h-4" /> Latest
          </button>
        </div>
      </div>

      {/* 2. Horizontal Sector Filter Pills */}
      <div className="w-full max-w-full min-w-0 overflow-x-auto pb-1 no-scrollbar text-sm">
        <div className="flex items-center gap-2 min-w-max">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-all min-h-[38px] flex items-center flex-shrink-0 ${
                selectedCategory === cat
                  ? 'bg-primary/15 text-primary border border-primary/30 font-bold'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-border/80'
              }`}
            >
              {cat}
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
            title={selectedCategory === 'All' ? 'No societal problems reported yet' : `No problems in ${selectedCategory}`}
            description="Be the first to report a societal challenge in your community and mobilize university innovation pods."
            actionLabel="Report a Challenge"
            onAction={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          />
        )}
      </div>
    </div>
  );
};
