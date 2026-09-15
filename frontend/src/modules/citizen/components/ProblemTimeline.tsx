import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import {
  CheckCircle2,
  Clock,
  Users,
  GraduationCap,
  Sparkles,
  Award,
  XCircle,
  FileCheck2,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';
import { problemsApi, CitizenProblemTimelineResponse, TimelineStage } from '../../../api/problems';

interface ProblemTimelineProps {
  problemId: string;
  initialData?: CitizenProblemTimelineResponse;
}

export const ProblemTimeline: React.FC<ProblemTimelineProps> = ({ problemId, initialData }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['problem-timeline', problemId],
    queryFn: () => problemsApi.getProblemTimeline(problemId),
    initialData,
    retry: false,
  });

  if (isLoading) {
    return (
      <Card className="p-5 border-border space-y-4 rounded-2xl">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="space-y-3 pt-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    );
  }

  // If unauthorized or endpoint not accessible for non-author roles, return clean null
  if (error || !data) {
    return null;
  }

  const getStageIcon = (stage: TimelineStage) => {
    if (stage.status === 'rejected') {
      return <XCircle className="w-4 h-4 text-destructive shrink-0" />;
    }
    if (stage.status === 'completed') {
      return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    }
    if (stage.status === 'in_progress') {
      return <Clock className="w-4 h-4 text-primary animate-pulse shrink-0" />;
    }
    return <div className="w-3 h-3 rounded-full bg-muted-foreground/30 border border-border shrink-0" />;
  };

  const getStageBadgeClass = (status: TimelineStage['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
      case 'in_progress':
        return 'bg-primary/10 text-primary border-primary/30 font-bold';
      case 'rejected':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <Card className="p-5 sm:p-6 border-border space-y-6 rounded-2xl bg-card shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Real-Time Problem Tracker
            </h3>
            <Badge variant="citizen" className="text-[10px] uppercase">
              Live Lifecycle
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Transparent real-time visibility into verification, student pod development, and community impact.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {data.is_verified && (
            <Badge variant="approved" className="text-xs flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Verified Challenge
            </Badge>
          )}
        </div>
      </div>

      {/* Active Pod Highlight Card */}
      {data.current_pod && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-primary/5 via-primary/10 to-transparent border border-primary/20 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-primary/20 text-primary">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-primary">
                  Active Solution Pod Assigned
                </div>
                <div className="text-base font-black text-foreground">
                  Team {data.current_pod.team_name}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {data.current_pod.university_name && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-background/80 border border-border text-foreground flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-primary" />
                  {data.current_pod.university_name}
                </span>
              )}
              <Badge variant="default" className="text-xs capitalize font-bold">
                {data.current_pod.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          {/* Live Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-primary" /> Solution Development Progress
              </span>
              <span className="text-primary font-black">{data.current_pod.progress_percent}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(data.current_pod.progress_percent, 5)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Stepper Timeline */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {data.timeline.map((stage, idx) => {
          const isDone = stage.status === 'completed';
          const isCurrent = stage.status === 'in_progress';
          const isFail = stage.status === 'rejected';

          return (
            <div key={stage.stage} className="relative group">
              {/* Timeline Bullet */}
              <div
                className={`absolute -left-6 top-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-card ring-4 ring-card transition-transform ${
                  isDone
                    ? 'ring-emerald-500/20'
                    : isCurrent
                    ? 'ring-primary/30 scale-110'
                    : 'ring-border'
                }`}
              >
                {getStageIcon(stage)}
              </div>

              {/* Stage Content */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-primary/5 border-primary/30 shadow-xs'
                    : isDone
                    ? 'bg-muted/30 border-border/70'
                    : isFail
                    ? 'bg-destructive/5 border-destructive/20'
                    : 'bg-muted/10 border-border/40 opacity-75'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-muted-foreground">Step {idx + 1}</span>
                    <h4 className="text-sm font-bold text-foreground">{stage.label}</h4>
                    {stage.optional && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        Optional
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getStageBadgeClass(
                        stage.status
                      )}`}
                    >
                      {stage.status.replace('_', ' ')}
                    </span>
                    {stage.timestamp && (
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(stage.timestamp).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {stage.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                    {stage.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed Societal Impact Report Inline Viewer */}
      {data.impact_report && (
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-black text-emerald-950 dark:text-emerald-200">
                  🎉 Problem Solved & Verified in Community
                </h4>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                  Official Societal Impact Report submitted by the student innovation team.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 font-extrabold text-xs flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />
                {data.impact_report.beneficiaries_reached.toLocaleString()} Beneficiaries Reached
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-background/80 rounded-xl border border-emerald-500/20 text-xs sm:text-sm text-foreground space-y-2">
            <div className="font-bold text-xs uppercase text-muted-foreground tracking-wider">
              Field Outcome & Resolution
            </div>
            <p className="leading-relaxed">{data.impact_report.outcome_description}</p>
          </div>

          {data.impact_report.proof_image_urls && data.impact_report.proof_image_urls.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-bold text-foreground">Field Verification Photos:</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {data.impact_report.proof_image_urls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 w-24 h-16 rounded-lg overflow-hidden border border-border hover:border-primary transition-all relative group"
                  >
                    <img src={url} alt={`Proof ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default ProblemTimeline;
