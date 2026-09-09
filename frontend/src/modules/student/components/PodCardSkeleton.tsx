import React from 'react';

/**
 * Skeleton that mirrors the exact PodCard layout to prevent cumulative layout shift.
 */
export const PodCardSkeleton: React.FC = () => (
  <div
    className="bg-card border border-border rounded-3xl p-5 flex flex-col gap-4 animate-pulse"
    aria-hidden="true"
    role="presentation"
  >
    {/* Row 1: category badge + status badge */}
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="h-4 w-20 bg-muted rounded-md" />
        <div className="h-4 w-16 bg-muted rounded-full" />
      </div>
      <div className="w-10 h-10 bg-muted rounded-2xl shrink-0" />
    </div>

    {/* Row 2: problem title */}
    <div className="space-y-1.5">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-5 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-11/12" />
    </div>

    {/* Row 3: progress bar */}
    <div className="space-y-1">
      <div className="flex justify-between">
        <div className="h-3 bg-muted rounded w-12" />
        <div className="h-3 bg-muted rounded w-8" />
      </div>
      <div className="h-1.5 bg-muted rounded-full w-full" />
    </div>

    {/* Row 4: meta */}
    <div className="flex items-center gap-4">
      <div className="flex -space-x-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-7 h-7 rounded-full bg-muted ring-2 ring-card" />
        ))}
      </div>
      <div className="h-3 bg-muted rounded w-16" />
      <div className="h-3 bg-muted rounded w-24 ml-auto" />
    </div>

    {/* Row 5: action buttons */}
    <div className="flex items-center justify-between pt-1 border-t border-border">
      <div className="h-4 bg-muted rounded w-20" />
      <div className="h-8 bg-muted rounded-2xl w-24" />
    </div>
  </div>
);
