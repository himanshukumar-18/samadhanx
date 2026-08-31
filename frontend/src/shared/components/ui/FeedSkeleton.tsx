import React from 'react';
import { Card } from './Card';

export const PostSkeleton: React.FC = () => {
  return (
    <Card className="p-5 sm:p-6 border-border rounded-2xl space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-3 w-20 bg-muted rounded" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-5 w-3/4 bg-muted rounded" />
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-5/6 bg-muted rounded" />
      </div>
      <div className="h-48 w-full bg-muted rounded-xl" />
      <div className="pt-2 border-t border-border flex justify-between">
        <div className="h-8 w-20 bg-muted rounded-lg" />
        <div className="h-8 w-20 bg-muted rounded-lg" />
        <div className="h-8 w-20 bg-muted rounded-lg" />
      </div>
    </Card>
  );
};

export const FeedSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-4 sm:space-y-5">
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
};
