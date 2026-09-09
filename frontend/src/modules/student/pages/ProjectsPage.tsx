/**
 * My Problem Pods page — the student's portfolio of active solution pods.
 *
 * This page is the single source of truth for a student's pod activity.
 * All data comes from the backend; nothing is hardcoded or mocked.
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, PlusCircle, RefreshCw, FolderGit2, Compass } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { podsApi, POD_STATUS_LABEL } from '../../../api/pods';
import type { PodStatus } from '../../../api/pods';
import { PodCard } from '../components/PodCard';
import { PodCardSkeleton } from '../components/PodCardSkeleton';

// ---------------------------------------------------------------------------
// Filter configuration
// ---------------------------------------------------------------------------

type FilterKey = 'all' | PodStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All Pods' },
  { key: 'planning', label: POD_STATUS_LABEL.planning },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: POD_STATUS_LABEL.review },
  { key: 'completed', label: POD_STATUS_LABEL.completed },
  { key: 'rejected', label: POD_STATUS_LABEL.rejected },
];

// Statuses that map to the "In Progress" display filter
const IN_PROGRESS_STATUSES: PodStatus[] = ['in_progress', 'prototype'];

// Statuses that map to the "Submitted" display filter
const SUBMITTED_STATUSES: PodStatus[] = ['review', 'pilot'];

// ---------------------------------------------------------------------------
// MyPodsPage
// ---------------------------------------------------------------------------

export const ProjectsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: pods,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['my-problem-pods'],
    queryFn: () => podsApi.listMyPods(),
    staleTime: 30_000,
  });

  // Client-side filter (data set is small per user, no need for server-side filter on search)
  const filteredPods = useMemo(() => {
    if (!pods) return [];

    let result = pods;

    // Status filter
    if (activeFilter !== 'all') {
      result = result.filter((pod) => {
        if (activeFilter === 'in_progress') return IN_PROGRESS_STATUSES.includes(pod.status);
        if (activeFilter === 'review') return SUBMITTED_STATUSES.includes(pod.status);
        return pod.status === activeFilter;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (pod) =>
          pod.title.toLowerCase().includes(q) ||
          (pod.problem_title ?? '').toLowerCase().includes(q) ||
          (pod.team_name ?? '').toLowerCase().includes(q) ||
          (pod.problem_category ?? '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [pods, activeFilter, searchQuery]);

  // Summary counts (from unfiltered data)
  const counts = useMemo(() => {
    if (!pods) return { active: 0, submitted: 0, completed: 0 };
    return {
      active: pods.filter((p) => ['planning', 'in_progress', 'prototype'].includes(p.status)).length,
      submitted: pods.filter((p) => ['review', 'pilot'].includes(p.status)).length,
      completed: pods.filter((p) => p.status === 'completed').length,
    };
  }, [pods]);

  return (
    <div className="space-y-6 pb-16 w-full min-w-0">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
            <FolderGit2 className="w-6 h-6 text-primary" aria-hidden="true" />
            My Problem Pods
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Every pod is a real team solving a verified societal problem. Track your progress, post
            updates, and collaborate with your team.
          </p>

          {/* Summary pills */}
          {!isLoading && pods && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <Pill label="Active" count={counts.active} color="text-amber-600" />
              <Pill label="Submitted" count={counts.submitted} color="text-purple-600" />
              <Pill label="Completed" count={counts.completed} color="text-emerald-600" />
            </div>
          )}
        </div>

        <a
          href="/explore"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/90 transition-colors shrink-0 min-h-[44px]"
          aria-label="Explore problems to start a new pod"
        >
          <PlusCircle className="w-4 h-4" aria-hidden="true" />
          New Solution Pod
        </a>
      </div>

      {/* ── Filters + Search ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Filter tabs */}
        <div
          className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 flex-1"
          role="tablist"
          aria-label="Filter pods by status"
        >
          {FILTERS.map(({ key, label }) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveFilter(key)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap min-h-[36px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative sm:w-64 flex-shrink-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search pods..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-2xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground min-h-[36px]"
            aria-label="Search pods by title, problem, or team name"
          />
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        // Skeleton loading state
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-live="polite" aria-label="Loading pods">
          {[1, 2, 3, 4].map((i) => (
            <PodCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        // Error state
        <div
          className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-card border border-border rounded-3xl p-8"
          role="alert"
          aria-live="assertive"
        >
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
            <RefreshCw className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-foreground">Unable to load your Problem Pods</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Check your connection and try again. Your pods are not lost.
          </p>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[44px]"
            aria-label="Retry loading pods"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            {isFetching ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      ) : filteredPods.length > 0 ? (
        // Pod cards grid
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          role="list"
          aria-label={`${filteredPods.length} problem pod${filteredPods.length !== 1 ? 's' : ''}`}
        >
          {filteredPods.map((pod) => (
            <div key={pod.id} role="listitem">
              <PodCard pod={pod} currentUserId={user?.id} />
            </div>
          ))}
        </div>
      ) : pods && pods.length === 0 ? (
        // Empty state — no pods at all
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-5 bg-card border border-border rounded-3xl p-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <FolderGit2 className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-foreground">No Problem Pods yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Find a verified societal problem, assemble a student team, and launch your first solution pod.
            </p>
          </div>
          <a
            href="/explore"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/90 transition-colors min-h-[44px]"
            aria-label="Explore problems to start your first pod"
          >
            <Compass className="w-4 h-4" aria-hidden="true" />
            Explore Problems
          </a>
        </div>
      ) : (
        // Empty state — filter returned no pods
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 bg-card/50 border border-dashed border-border rounded-3xl p-8">
          <Search className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-base font-bold text-foreground">No pods match this filter</h3>
          <p className="text-sm text-muted-foreground">
            {searchQuery ? `No pods match "${searchQuery}".` : 'No pods with this status.'}
          </p>
          <button
            onClick={() => { setActiveFilter('all'); setSearchQuery(''); }}
            className="text-sm font-bold text-primary hover:underline focus:outline-none focus-visible:underline min-h-[44px]"
            aria-label="Clear filters"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helper component
// ---------------------------------------------------------------------------

function Pill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
      <span className={`font-black text-sm ${color}`}>{count}</span>
      {label}
    </span>
  );
}
