import React, { useState } from 'react';
import { Problem } from '../../../types/problem';
import { ProblemPost } from '../../feed/components/ProblemPost';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { Search, Sparkles, Inbox } from 'lucide-react';

export const ExplorePage: React.FC<{ initialProblems?: Problem[] }> = ({ initialProblems = [] }) => {
  const [query, setQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('All');
  const [problems] = useState<Problem[]>(initialProblems);

  const sectors = ['All', 'Water & Sanitation', 'Clean Energy & Solar', 'Agriculture & Rural Tech', 'Healthcare & Medical Devices', 'Waste Management'];

  const filtered = problems.filter((p) => {
    if (selectedSector !== 'All' && p.category !== selectedSector) return false;
    if (query && !p.title.toLowerCase().includes(query.toLowerCase()) && !p.description.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4 pb-12">
      <div className="p-4 sm:p-5 bg-card rounded-2xl border border-border space-y-3.5">
        <div className="flex items-center justify-between">
          <h1 className="text-base sm:text-lg font-black text-foreground">Explore Societal Challenges</h1>
          <span className="text-xs text-primary font-semibold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Discovery
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search problems by keyword, district, or university..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-muted/60 focus:bg-background rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground border border-border focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-sm">
          {sectors.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSector(s)}
              className={`px-3.5 py-1.5 rounded-full whitespace-nowrap font-medium transition-all min-h-[36px] ${
                selectedSector === s
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map((p) => (
            <ProblemPost key={p.id} problem={p} />
          ))
        ) : (
          <EmptyState
            icon={Inbox}
            title="No matching challenges found"
            description="Try changing your search terms or selecting a different sector."
            actionLabel="Reset Filters"
            onAction={() => {
              setQuery('');
              setSelectedSector('All');
            }}
          />
        )}
      </div>
    </div>
  );
};
