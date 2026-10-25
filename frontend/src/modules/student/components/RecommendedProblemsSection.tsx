import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Check, ArrowRight, RefreshCw, AlertCircle, Compass, Flame } from 'lucide-react';
import { studentApi, ProblemRecommendationItem } from '../../../api/student';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { Button } from '../../../shared/components/ui/Button';

interface RecommendedProblemsSectionProps {
  limit?: number;
  className?: string;
}

export const RecommendedProblemsSection: React.FC<RecommendedProblemsSectionProps> = ({
  limit = 6,
  className = '',
}) => {
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['student-recommendations', limit],
    queryFn: () => studentApi.getRecommendations({ limit }),
    staleTime: 60_000,
  });

  const recommendations: ProblemRecommendationItem[] =
    data?.recommendations?.length ? data.recommendations : data?.items || [];
  const isFallback = data?.is_fallback ?? false;

  return (
    <section aria-label="Problem Recommendations" className={`space-y-4 ${className}`}>
      {/* ── Section Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
              {isFallback ? (
                <>
                  <Flame className="w-5 h-5 text-amber-500" />
                  Popular Civic Challenges
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-primary" />
                  Recommended for You
                </>
              )}
            </h2>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isFallback
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  : 'bg-primary/10 text-primary border-primary/20'
              }`}
            >
              {isFallback ? 'Community Highlights' : 'AI Skill Match'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isFallback
              ? 'Trending community issues across verified districts while you build your profile.'
              : 'Personalized based on your skills, department, and semantic similarity to civic problems.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isFallback && (
            <a
              href="/profile"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              Complete Profile →
            </a>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Refresh recommendations"
            aria-label="Refresh recommendations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Empty Profile Banner (Fallback Mode) ── */}
      {isFallback && data?.hint && (
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-foreground text-xs leading-relaxed">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold text-amber-800 dark:text-amber-400">
              Personalize your recommendations:
            </span>{' '}
            {data.hint}
          </div>
          <a
            href="/profile"
            className="shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors text-[11px]"
          >
            Add Skills
          </a>
        </div>
      )}

      {/* ── Content States ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Loading recommendations">
          <RecommendationSkeletonCard />
          <RecommendationSkeletonCard />
          <RecommendationSkeletonCard />
        </div>
      ) : isError ? (
        <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 text-sm flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-destructive font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Could not load recommendations right now.</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="font-bold text-xs">
            Retry
          </Button>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-border bg-card space-y-3">
          <Compass className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
          <p className="text-sm font-semibold text-foreground">No recommendations available yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Explore active civic problems submitted by citizens across India.
          </p>
          <a
            href="/explore"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition-colors"
          >
            Explore Problems
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendations.map((item) => (
            <RecommendationCard key={item.id || item.problem_id} item={item} isFallback={isFallback} />
          ))}
        </div>
      )}
    </section>
  );
};

interface RecommendationCardProps {
  item: ProblemRecommendationItem;
  isFallback: boolean;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ item, isFallback }) => {
  const problemUrl = `/problems/${item.problem_id || item.id}`;

  const matchBadgeColor =
    item.match_level === 'strong'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
      : item.match_level === 'good'
      ? 'bg-primary/10 text-primary border-primary/20'
      : item.match_level === 'general'
      ? 'bg-muted text-muted-foreground border-border'
      : 'bg-amber-500/10 text-amber-600 border-amber-500/20';

  const matchLabelText =
    item.match_level === 'strong'
      ? 'Strong Match'
      : item.match_level === 'good'
      ? 'Good Match'
      : item.match_level === 'general'
      ? 'Verified Challenge'
      : 'Fair Match';

  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col justify-between hover:border-primary/40 hover:shadow-sm transition-all group">
      <div className="space-y-2.5">
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${matchBadgeColor}`}>
            {matchLabelText}
          </span>
          <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[130px]">
            {item.district || item.location || 'India'}
          </span>
        </div>

        {/* Category */}
        <p className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">
          {item.category}
        </p>

        {/* Title */}
        <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          <a href={problemUrl} className="focus:outline-none focus:underline">
            {item.title}
          </a>
        </h3>

        {/* Description Snippet */}
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {item.description}
        </p>

        {/* Matched Skills Chips */}
        {item.matched_skills && item.matched_skills.length > 0 && (
          <div className="space-y-1 pt-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Matched Skills
            </span>
            <div className="flex flex-wrap gap-1.5">
              {item.matched_skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20"
                >
                  <Check className="w-3 h-3 text-primary stroke-[3]" />
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reason */}
        <p className="text-[11px] text-muted-foreground/90 italic bg-muted/50 p-2 rounded-xl border border-border/50">
          &ldquo;{item.reason}&rdquo;
        </p>
      </div>

      {/* Action Footer */}
      <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between">
        {item.recommendation_score != null && !isFallback && (
          <span className="text-[10px] text-muted-foreground font-semibold">
            {Math.round(item.recommendation_score * 100)}% fit
          </span>
        )}
        <a
          href={problemUrl}
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline ml-auto group-hover:translate-x-0.5 transition-transform"
        >
          View Problem
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};

const RecommendationSkeletonCard: React.FC = () => (
  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
    <div className="flex justify-between items-center">
      <Skeleton className="h-4 w-20 rounded-full" />
      <Skeleton className="h-3 w-16" />
    </div>
    <Skeleton className="h-3 w-24" />
    <Skeleton className="h-5 w-full" />
    <Skeleton className="h-10 w-full" />
    <div className="flex gap-2">
      <Skeleton className="h-5 w-16 rounded-lg" />
      <Skeleton className="h-5 w-16 rounded-lg" />
    </div>
    <Skeleton className="h-8 w-full rounded-xl" />
    <div className="pt-2 border-t border-border flex justify-end">
      <Skeleton className="h-4 w-24" />
    </div>
  </div>
);

