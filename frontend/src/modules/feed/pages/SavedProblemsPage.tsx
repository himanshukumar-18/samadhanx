import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, Inbox } from 'lucide-react';
import { socialApi } from '../../../api/social';
import { mapApiProblem } from '../../../lib/problemMapper';
import { ProblemPost } from '../components/ProblemPost';
import { FeedSkeleton } from '../../../shared/components/ui/FeedSkeleton';
import { EmptyState } from '../../../shared/components/ui/EmptyState';

export const SavedProblemsPage: React.FC = () => {
  const { data, isLoading, isError } = useQuery({ queryKey: ['saved-problems'], queryFn: socialApi.listSavedProblems });
  if (isLoading) return <FeedSkeleton />;
  if (isError) return <EmptyState icon={Inbox} title="Unable to load saved challenges" description="Please try again." />;
  const problems = Array.isArray(data) ? data.map(mapApiProblem) : [];
  return <div className="space-y-4 pb-12">
    <div className="flex items-center gap-2 text-lg font-black text-foreground"><Bookmark className="w-5 h-5 text-primary" /> Saved Challenges</div>
    {problems.length ? problems.map((problem) => <ProblemPost key={problem.id} problem={problem} />) : <EmptyState icon={Bookmark} title="No saved challenges" description="Challenges you save appear here and remain tied to your account." actionLabel="Explore Challenges" onAction={() => { window.location.href = '/explore'; }} />}
  </div>;
};
