import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Users, Layers, Flame, MapPin } from 'lucide-react';
import { problemsApi } from '../../../api/problems';

interface ProblemSidebarItem {
  id: string;
  title: string;
  category: string;
  district?: string;
}

export const RightSidebar: React.FC = () => {
  const { data: recentProblems } = useQuery({
    queryKey: ['right-sidebar-recent-problems'],
    queryFn: () => problemsApi.listProblems({ limit: 4 }),
  });

  return (
    <aside className="w-full space-y-4 py-2 px-1 select-none">
      {/* 1. Community Mission Card */}
      <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-2.5">
        <div className="flex items-center gap-1.5 text-primary text-xs font-black">
          <Layers className="w-4 h-4 text-primary" /> SamadhanX Network
        </div>
        <p className="text-sm text-foreground font-bold leading-snug">
          Real Problems. Right People. Real Solutions.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Connect with innovators, faculty mentors, and community leaders to turn societal challenges into scalable solutions.
        </p>
        <Button variant="primary" size="sm" className="w-full text-xs min-h-[38px] rounded-xl font-bold mt-1" onClick={() => (window.location.href = '/explore')}>
          Explore Challenges
        </Button>
      </div>

      {/* 2. Live Recent Challenges from Backend */}
      <Card className="p-4 space-y-3 rounded-2xl">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Flame className="w-4 h-4 text-amber-500" /> Recent Challenges
          </div>
          <a href="/explore" className="text-xs text-primary hover:underline font-semibold">Browse</a>
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
                    <MapPin className="w-3 h-3 text-rose-500" /> {prob.district || 'National'}
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Browse verified community issues categorized across water, agriculture, clean energy, and healthcare.
          </p>
        )}
      </Card>

      {/* 3. Community Solution Pods */}
      <Card className="p-4 space-y-3 rounded-2xl">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Users className="w-4 h-4 text-emerald-500" /> Solution Pods
          </div>
          <a href="/explore" className="text-xs text-primary hover:underline font-semibold">Explore</a>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Collaborate in interdisciplinary teams to build prototypes and scale impactful solutions.
        </p>
      </Card>
    </aside>
  );
};
