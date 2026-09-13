import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Rocket,
  GraduationCap,
  ArrowRight,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  X,
} from 'lucide-react';
import type { Pod, PodStatus } from '../../../api/pods';
import { POD_STATUS_LABEL, canSubmitForReview, podsApi } from '../../../api/pods';

// ---------------------------------------------------------------------------
// Status badge colours
// ---------------------------------------------------------------------------

const STATUS_CLASSES: Record<PodStatus, string> = {
  planning: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  prototype: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  review: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  pilot: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const PROGRESS_CLASSES: Record<PodStatus, string> = {
  planning: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  prototype: 'bg-amber-500',
  review: 'bg-purple-500',
  pilot: 'bg-purple-500',
  completed: 'bg-emerald-500',
  rejected: 'bg-red-500',
};

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Member avatar stack
// ---------------------------------------------------------------------------

const MAX_VISIBLE_AVATARS = 4;

function MemberAvatarStack({ members, totalCount }: { members: Pod['members']; totalCount: number }) {
  const visible = members.slice(0, MAX_VISIBLE_AVATARS);
  const extra = totalCount - visible.length;

  return (
    <div className="flex items-center -space-x-2" aria-label={`${totalCount} team member${totalCount !== 1 ? 's' : ''}`}>
      {visible.map((m) => (
        <div
          key={m.id}
          className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center ring-2 ring-card uppercase shrink-0"
          title={m.member_name || m.email || 'Team member'}
          aria-hidden="true"
        >
          {m.member_name ? m.member_name.charAt(0) : '?'}
        </div>
      ))}
      {extra > 0 && (
        <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground font-bold text-[10px] flex items-center justify-center ring-2 ring-card shrink-0">
          +{extra}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PodCard
// ---------------------------------------------------------------------------

interface PodCardProps {
  pod: Pod;
  currentUserId?: string;
}

export const PodCard: React.FC<PodCardProps> = ({ pod, currentUserId }) => {
  const queryClient = useQueryClient();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const isLead = currentUserId === pod.lead_student_id;
  const statusLabel = POD_STATUS_LABEL[pod.status];
  const statusClass = STATUS_CLASSES[pod.status];
  const progressClass = PROGRESS_CLASSES[pod.status];
  const isSubmittable = isLead && canSubmitForReview(pod);
  const isInReview = pod.status === 'review' || pod.status === 'pilot';
  const lastActivity = pod.updates.length > 0
    ? pod.updates[0].created_at
    : pod.updated_at;

  const submitMutation = useMutation({
    mutationFn: () => podsApi.submitForReview(pod.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-problem-pods'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['pod-detail', pod.id] });
      queryClient.invalidateQueries({ queryKey: ['student-projects'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      toast.success(`Solution pod "${pod.title}" successfully submitted for faculty review!`);
      setConfirmModalOpen(false);
    },
    onError: (err: any) => {
      const errorMsg =
        err.response?.data?.detail?.message ||
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to submit pod for review. Please try again.';
      toast.error(errorMsg);
    },
  });

  return (
    <article
      className="bg-card border border-border rounded-3xl p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all flex flex-col gap-4 group focus-within:ring-2 focus-within:ring-primary/50"
      aria-label={`Solution Pod: ${pod.title}`}
    >
      {/* ── Row 1: Problem context ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {pod.problem_category && (
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                {pod.problem_category}
              </span>
            )}
            <span
              className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${statusClass}`}
              aria-label={`Pod status: ${statusLabel}`}
            >
              {statusLabel}
            </span>
          </div>
          {pod.problem_title && (
            <p className="text-xs text-muted-foreground font-medium leading-snug truncate">
              <span className="font-semibold text-foreground">Problem:</span>{' '}
              {pod.problem_title}
            </p>
          )}
        </div>

        {/* Team badge */}
        <div
          className="shrink-0 w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"
          aria-hidden="true"
        >
          <Rocket className="w-5 h-5" />
        </div>
      </div>

      {/* ── Row 2: Pod title + team name ── */}
      <div className="space-y-0.5">
        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
          {pod.title}
        </h3>
        <p className="text-xs font-semibold text-primary truncate">Team: {pod.team_name}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-0.5">
          {pod.description}
        </p>
      </div>

      {/* ── Row 3: Progress bar ── */}
      <div role="progressbar" aria-valuenow={pod.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Pod progress: ${pod.progress}%`}>
        <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground mb-1">
          <span>Progress</span>
          <span>{pod.progress}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressClass}`}
            style={{ width: `${pod.progress}%` }}
          />
        </div>
      </div>

      {/* ── Row 4: Meta — members, faculty, location, time ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {/* Member avatars */}
        <div className="flex items-center gap-2">
          <MemberAvatarStack members={pod.members} totalCount={pod.member_count} />
          <span className="font-medium">{pod.member_count} member{pod.member_count !== 1 ? 's' : ''}</span>
        </div>

        {/* Faculty mentor */}
        {pod.faculty_mentor_name ? (
          <div className="flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 shrink-0 text-purple-500" aria-hidden="true" />
            <span className="truncate max-w-[120px]" title={pod.faculty_mentor_name}>
              {pod.faculty_mentor_name}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-muted-foreground/60 italic">
            <GraduationCap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>No mentor yet</span>
          </div>
        )}

        {/* Location */}
        {pod.problem_district && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate max-w-[80px]">{pod.problem_district}</span>
          </div>
        )}

        {/* Last activity */}
        <div className="flex items-center gap-1 ml-auto">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{relativeTime(lastActivity)}</span>
        </div>
      </div>

      {/* ── Row 5: Review status indicator (if applicable) ── */}
      {pod.reviews.length > 0 && (
        <div className="flex items-center gap-2 text-xs bg-secondary/40 rounded-2xl px-3 py-2">
          {pod.reviews[pod.reviews.length - 1].decision === 'approved' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
          ) : pod.reviews[pod.reviews.length - 1].decision === 'changes_requested' ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
          ) : null}
          <span className="font-semibold text-foreground capitalize">
            Faculty: {pod.reviews[pod.reviews.length - 1].decision.replace('_', ' ')}
          </span>
          {pod.reviews[pod.reviews.length - 1].feedback_text && (
            <span className="text-muted-foreground truncate hidden sm:block">
              — {pod.reviews[pod.reviews.length - 1].feedback_text}
            </span>
          )}
        </div>
      )}

      {/* ── Row 6: Action buttons ── */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
        {/* Problem link */}
        <a
          href={`/problems/${pod.problem_id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors focus:outline-none focus-visible:underline"
          aria-label={`View problem: ${pod.problem_title || 'View problem'}`}
        >
          View Problem ↗
        </a>

        <div className="flex items-center gap-2">
          {/* Submit for review button */}
          {isSubmittable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-xs font-bold hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 min-h-[36px]"
              aria-label={`Submit ${pod.title} for review`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
              Submit for Review
            </button>
          ) : isInReview ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 text-xs font-semibold">
              <Clock className="w-3 h-3 text-purple-500" aria-hidden="true" />
              In Faculty Review
            </span>
          ) : null}

          {/* Open pod workspace */}
          <a
            href={`/projects/${pod.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[36px]"
            aria-label={`Open pod workspace: ${pod.title}`}
          >
            {pod.status === 'completed' ? 'View Results' : 'Open Pod'}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`modal-title-${pod.id}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!submitMutation.isPending) setConfirmModalOpen(false);
          }}
        >
          <div
            className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 id={`modal-title-${pod.id}`} className="text-base font-bold text-foreground">
                    Submit Pod for Faculty Review
                  </h3>
                  <p className="text-xs text-muted-foreground">Ready for academic evaluation?</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={submitMutation.isPending}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-secondary/40 rounded-2xl p-3.5 text-xs space-y-1.5 border border-border/50">
              <p className="font-semibold text-foreground">Pod: <span className="font-normal">{pod.title}</span></p>
              <p className="font-semibold text-foreground">Team: <span className="font-normal">{pod.team_name}</span></p>
              {pod.faculty_mentor_name ? (
                <p className="font-semibold text-foreground">Assigned Mentor: <span className="font-normal">{pod.faculty_mentor_name}</span></p>
              ) : (
                <p className="text-amber-600 dark:text-amber-400 font-medium">No direct mentor assigned yet. Campus faculty mentors will see this in their review queue.</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Submitting transitions your pod to <strong>Under Review</strong>. Your faculty mentor will be notified to review your prototype, code repository, and milestone updates.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={submitMutation.isPending}
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow disabled:opacity-50"
              >
                {submitMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" /> Confirm & Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
