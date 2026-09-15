import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { ProblemPost } from '../../feed/components/ProblemPost';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { FeedSkeleton } from '../../../shared/components/ui/FeedSkeleton';
import { Search, Sparkles, Inbox, Wrench, Rocket, ShieldCheck, Layers } from 'lucide-react';
import { problemsApi } from '../../../api/problems';
import { mapApiProblem } from '../../../lib/problemMapper';

export const ExplorePage: React.FC = () => {
  const { user } = useAuthStore();
  const isIndustry = user?.role === 'industry';

  const [query, setQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<string>(isIndustry ? 'in_progress' : 'All');

  const sectors = [
    'All',
    'Water & Sanitation',
    'Clean Energy & Solar',
    'Agriculture & Rural Tech',
    'Healthcare & Medical Devices',
    'Waste Management',
  ];

  const statusOptions = [
    { id: 'in_progress', label: 'Active R&D', icon: Wrench, color: 'text-purple-600' },
    { id: 'pilot', label: 'Live Field Pilots', icon: Rocket, color: 'text-amber-600' },
    { id: 'verified', label: 'Verified Challenges', icon: ShieldCheck, color: 'text-emerald-600' },
    { id: 'All', label: 'All Challenges', icon: Layers, color: 'text-primary' },
  ];

  const { data: rawProblems, isLoading } = useQuery({
    queryKey: ['explore-problems', selectedSector, selectedStatus, query],
    queryFn: () =>
      problemsApi.listProblems({
        category: selectedSector === 'All' ? undefined : selectedSector,
        status: selectedStatus === 'All' ? undefined : selectedStatus,
        search: query.trim() || undefined,
      }),
  });

  const backendProblems = Array.isArray(rawProblems) ? rawProblems.map(mapApiProblem) : [];

  return (
    <div className="space-y-4 pb-12 w-full min-w-0">
      <div className="p-4 sm:p-5 bg-card rounded-2xl border border-border space-y-3.5 w-full">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-base sm:text-lg font-black text-foreground">
              {isIndustry ? 'Active R&D Challenges' : 'Explore Societal Challenges'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isIndustry
                ? 'Civic and societal problems currently under active student & university R&D'
                : 'Discover and adopt grassroots challenges from communities across India'}
            </p>
          </div>
          <span className="text-xs text-primary font-bold flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" /> Discovery Engine
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search problems by keyword, district, or state..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-muted/70 hover:bg-muted focus:bg-card rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all h-11"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {statusOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedStatus === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelectedStatus(opt.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all shrink-0 ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-primary-foreground' : opt.color}`} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sector Category Pills */}
        <div className="w-full max-w-full min-w-0 overflow-x-auto no-scrollbar text-sm pt-1 border-t border-border/60">
          <div className="flex items-center gap-2 min-w-max">
            {sectors.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSector(s)}
                className={`px-3 py-1 rounded-full whitespace-nowrap text-xs font-medium transition-all flex-shrink-0 ${
                  selectedSector === s
                    ? 'bg-muted text-foreground font-bold border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 w-full">
        {isLoading ? (
          <FeedSkeleton />
        ) : backendProblems.length > 0 ? (
          backendProblems.map((p) => (
            <ProblemPost key={p.id} problem={p} />
          ))
        ) : (
          <EmptyState
            icon={Inbox}
            title="No matching challenges found"
            description="Try changing your search terms, status filter, or sector."
            actionLabel="Reset Filters"
            onAction={() => {
              setQuery('');
              setSelectedSector('All');
              setSelectedStatus(isIndustry ? 'in_progress' : 'All');
            }}
          />
        )}
      </div>
    </div>
  );
};

