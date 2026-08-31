import React from 'react';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { Users, ArrowLeft } from 'lucide-react';

export const TeamDetailPage: React.FC = () => {
  return (
    <div className="space-y-4 pb-12 w-full min-w-0">
      <a href="/" className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Feed
      </a>

      <EmptyState
        icon={Users}
        title="No Solution Pod Selected"
        description="Select a solution pod from the problem feed or explore active innovation teams."
        actionLabel="Explore Challenges"
        onAction={() => (window.location.href = '/explore')}
      />
    </div>
  );
};
