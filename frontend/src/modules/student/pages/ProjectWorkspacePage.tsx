import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Rocket, ArrowLeft, ExternalLink, GitBranch, Users, Plus,
  Send, Clock, CheckCircle2, ShieldCheck, Sparkles, MessageSquare,
  AlertCircle, GraduationCap, BarChart2, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { podsApi, POD_STATUS_LABEL, canSubmitForReview } from '../../../api/pods';
import type { PodStatus } from '../../../api/pods';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Status-dependent progress colours
// ---------------------------------------------------------------------------

const PROGRESS_COLOUR: Record<PodStatus, string> = {
  planning: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  prototype: 'bg-amber-500',
  review: 'bg-purple-500',
  pilot: 'bg-purple-500',
  completed: 'bg-emerald-500',
  rejected: 'bg-red-500',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProjectWorkspacePageProps {
  projectId?: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ProjectWorkspacePage: React.FC<ProjectWorkspacePageProps> = ({ projectId }) => {
  const podId = projectId
    || window.location.pathname.replace('/projects/', '').replace('/teams/', '').split('/')[0];

  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // ── Form state ──
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateContent, setUpdateContent] = useState('');
  const [prototypeUrl, setPrototypeUrl] = useState('');
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Core Developer');
  const [showMemberForm, setShowMemberForm] = useState(false);

  // ── Queries ──
  const { data: pod, isLoading, error } = useQuery({
    queryKey: ['pod-detail', podId],
    queryFn: () => podsApi.getPodDetail(podId),
    enabled: Boolean(podId),
    staleTime: 15_000,
  });

  // ── Mutations ──

  const submitReviewMutation = useMutation({
    mutationFn: () => podsApi.submitForReview(podId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['pod-detail', podId], updated);
      queryClient.invalidateQueries({ queryKey: ['my-problem-pods'] });
      toast.success('Pod submitted for faculty review!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail?.message || 'Failed to submit for review.');
    },
  });

  const postUpdateMutation = useMutation({
    mutationFn: (data: { title: string; content: string; prototype_url?: string }) =>
      podsApi.addUpdate(podId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pod-detail', podId] });
      queryClient.invalidateQueries({ queryKey: ['my-problem-pods'] });
      setUpdateTitle('');
      setUpdateContent('');
      setPrototypeUrl('');
      setShowUpdateForm(false);
      toast.success('Milestone update published!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail?.message || 'Failed to publish update.');
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: { user_id: string; role_in_team: string }) =>
      podsApi.addMember(podId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pod-detail', podId] });
      setNewMemberUserId('');
      setShowMemberForm(false);
      toast.success('Team member added!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail?.message || 'Failed to add member.');
    },
  });

  // ── Handlers ──

  const handlePostUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateTitle.trim() || !updateContent.trim()) return;
    postUpdateMutation.mutate({
      title: updateTitle.trim(),
      content: updateContent.trim(),
      prototype_url: prototypeUrl.trim() || undefined,
    });
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberUserId.trim()) return;
    addMemberMutation.mutate({
      user_id: newMemberUserId.trim(),
      role_in_team: newMemberRole.trim() || 'Member',
    });
  };

  // ── Loading ──

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4" aria-live="polite">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        <p className="text-sm font-semibold text-muted-foreground">Loading Solution Pod Workspace...</p>
      </div>
    );
  }

  // ── Error / not found ──

  if (error || !pod) {
    const status = (error as any)?.response?.status;
    const isForbidden = status === 403;

    return (
      <div
        className="max-w-2xl mx-auto p-8 text-center bg-card border border-border rounded-3xl space-y-4 my-8"
        role="alert"
        aria-live="assertive"
      >
        <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {isForbidden ? 'Access Denied' : 'Pod Not Found'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isForbidden
            ? 'You are not a member of this solution pod and cannot view its workspace.'
            : 'This pod does not exist or has been removed.'}
        </p>
        <a
          href="/my-problems"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/90 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to My Pods
        </a>
      </div>
    );
  }

  // ── Derived state ──

  const isLead = user?.id === pod.lead_student_id;
  const isMember =
    isLead || pod.members.some((m) => m.user_id === user?.id);
  const progressColour = PROGRESS_COLOUR[pod.status] ?? 'bg-primary';
  const statusLabel = POD_STATUS_LABEL[pod.status];
  const latestReview = pod.reviews.length > 0 ? pod.reviews[pod.reviews.length - 1] : null;

  return (
    <div className="space-y-6 pb-16 w-full max-w-6xl mx-auto">

      {/* ── Back nav + status ── */}
      <div className="flex items-center justify-between">
        <a
          href="/my-problems"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors group"
          aria-label="Back to My Pods"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" />
          Back to My Pods
        </a>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
          {statusLabel}
        </span>
      </div>

      {/* ── Pod Header Banner ── */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" aria-hidden="true" />

        {/* ── Progress bar ── */}
        <div
          role="progressbar"
          aria-valuenow={pod.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Pod progress: ${pod.progress}%`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1.5">
            <span className="flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5" aria-hidden="true" /> Progress
            </span>
            <span>{pod.progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressColour}`}
              style={{ width: `${pod.progress}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-primary">
              <Rocket className="w-4 h-4" aria-hidden="true" /> Team {pod.team_name}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{pod.title}</h1>
            <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">{pod.description}</p>
          </div>

          {/* Submit for review button */}
          {canSubmitForReview(pod) && isLead && (
            <button
              onClick={() => submitReviewMutation.mutate()}
              disabled={submitReviewMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-purple-600 text-white text-sm font-bold shadow hover:bg-purple-700 transition-colors disabled:opacity-50 shrink-0 min-h-[44px]"
              aria-label="Submit this pod for faculty review"
            >
              {submitReviewMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Submitting...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Submit for Review
                </>
              )}
            </button>
          )}

          {pod.repository_url && (
            <a
              href={pod.repository_url.startsWith('http') ? pod.repository_url : `https://${pod.repository_url}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 transition-colors shrink-0 min-h-[36px]"
              aria-label="Open code repository (opens in new tab)"
            >
              <GitBranch className="w-4 h-4" aria-hidden="true" /> Code Repository{' '}
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}
        </div>

        {/* Linked problem bar */}
        <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
            <span className="font-semibold text-foreground">Solving Challenge:</span>
            <a
              href={`/problems/${pod.problem_id}`}
              className="font-bold text-primary hover:underline inline-flex items-center gap-1"
              aria-label={`View problem: ${pod.problem_title || 'View problem statement'}`}
            >
              {pod.problem_title || 'View Problem Statement'}
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
            {pod.problem_category && (
              <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                {pod.problem_category}
              </span>
            )}
            {pod.problem_district && (
              <span className="text-muted-foreground/70">
                📍 {pod.problem_district}
                {pod.problem_state ? `, ${pod.problem_state}` : ''}
              </span>
            )}
          </div>
          <div className="text-muted-foreground">
            Created: {new Date(pod.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* ── Main layout: updates (left) + sidebar (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Updates feed ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Faculty Review Feedback (shown when review exists) */}
          {latestReview && (
            <div
              className={`rounded-3xl border p-5 space-y-2 ${
                latestReview.decision === 'approved'
                  ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'
                  : latestReview.decision === 'changes_requested'
                  ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                  : 'bg-card border-border'
              }`}
              role="region"
              aria-label="Faculty review feedback"
            >
              <div className="flex items-center gap-2 text-sm font-bold">
                {latestReview.decision === 'approved' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden="true" />
                )}
                <span>
                  Faculty Review:{' '}
                  <span className="capitalize">{latestReview.decision.replace('_', ' ')}</span>
                </span>
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  by {latestReview.reviewer_name || 'Faculty'} •{' '}
                  {new Date(latestReview.created_at).toLocaleDateString()}
                </span>
              </div>
              {latestReview.feedback_text && (
                <p className="text-sm text-foreground/90 leading-relaxed pl-6">
                  {latestReview.feedback_text}
                </p>
              )}
            </div>
          )}

          {/* Post milestone update (members only) */}
          {isMember && (
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" /> Post Milestone Update
                </h2>
                {!showUpdateForm && (
                  <button
                    onClick={() => setShowUpdateForm(true)}
                    className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1 min-h-[36px]"
                    aria-label="Open form to post a new milestone update"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" /> New Update
                  </button>
                )}
              </div>

              {showUpdateForm && (
                <form onSubmit={handlePostUpdate} className="space-y-4 pt-2 border-t border-border" aria-label="Post milestone update form">
                  <div>
                    <label htmlFor="update-title" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Milestone Title *
                    </label>
                    <input
                      id="update-title"
                      type="text"
                      required
                      placeholder="e.g., v1.0 Functional Prototype Deployed"
                      value={updateTitle}
                      onChange={(e) => setUpdateTitle(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-secondary/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label htmlFor="update-content" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Progress Details *
                    </label>
                    <textarea
                      id="update-content"
                      required
                      rows={4}
                      placeholder="What did your pod achieve this sprint? Describe architecture decisions, test results, blockers..."
                      value={updateContent}
                      onChange={(e) => setUpdateContent(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-secondary/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="prototype-url" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Live Demo / Prototype URL (Optional)
                    </label>
                    <input
                      id="prototype-url"
                      type="url"
                      placeholder="https://demo.samadhanx.in or Figma / Vercel URL"
                      value={prototypeUrl}
                      onChange={(e) => setPrototypeUrl(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-secondary/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowUpdateForm(false)}
                      className="px-4 py-2 rounded-2xl text-xs font-bold text-muted-foreground hover:bg-secondary transition-colors min-h-[36px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={postUpdateMutation.isPending}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[36px]"
                    >
                      {postUpdateMutation.isPending ? 'Publishing...' : 'Publish Update'}
                      <Send className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Updates timeline */}
          <section aria-label="Engineering log and milestone history">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-primary" aria-hidden="true" /> Engineering Log
            </h2>

            {pod.updates.length === 0 ? (
              <div className="bg-card border border-border rounded-3xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <MessageSquare className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-bold text-foreground">No Milestone Updates Yet</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Post sprint updates to demonstrate active problem-solving. Faculty reviewers and
                  industry scouts use these to track your pod's progress.
                </p>
              </div>
            ) : (
              <ol className="space-y-4" aria-label="Milestone update timeline">
                {pod.updates.map((update) => (
                  <li
                    key={update.id}
                    className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-3 relative"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-bold text-foreground">{update.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Posted by{' '}
                          <span className="font-semibold text-foreground">
                            {update.author_name || 'Team Member'}
                          </span>{' '}
                          • {new Date(update.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" aria-hidden="true" />
                    </div>

                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {update.content}
                    </p>

                    {update.prototype_url && (
                      <div className="pt-2">
                        <a
                          href={
                            update.prototype_url.startsWith('http')
                              ? update.prototype_url
                              : `https://${update.prototype_url}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/20"
                          aria-label="View live prototype or demo (opens in new tab)"
                        >
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> View Live Demo / Prototype
                        </a>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-6" aria-label="Pod sidebar">

          {/* Team Roster */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" aria-hidden="true" /> Pod Roster
              </h3>
              {isLead && !showMemberForm && (
                <button
                  onClick={() => setShowMemberForm(true)}
                  className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1 min-h-[36px]"
                  aria-label="Add a new team member"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add Member
                </button>
              )}
            </div>

            {showMemberForm && (
              <form onSubmit={handleAddMember} className="space-y-3 p-3 bg-secondary/30 rounded-2xl border border-border" aria-label="Add team member form">
                <div>
                  <label htmlFor="member-user-id" className="block text-xs font-bold text-muted-foreground mb-1">
                    Innovator User ID
                  </label>
                  <input
                    id="member-user-id"
                    type="text"
                    required
                    placeholder="Paste UUID from People directory"
                    value={newMemberUserId}
                    onChange={(e) => setNewMemberUserId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="member-role" className="block text-xs font-bold text-muted-foreground mb-1">
                    Role in Team
                  </label>
                  <input
                    id="member-role"
                    type="text"
                    placeholder="e.g., Frontend Dev, ML Engineer"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMemberForm(false)}
                    className="px-3 py-1 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary min-h-[36px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addMemberMutation.isPending}
                    className="px-3 py-1 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 min-h-[36px]"
                  >
                    {addMemberMutation.isPending ? 'Adding...' : 'Add'}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Find User IDs from the{' '}
                  <a href="/people" className="text-primary hover:underline">People directory</a>.
                </p>
              </form>
            )}

            <ul className="space-y-3 divide-y divide-border" aria-label="Team members">
              {/* Lead */}
              <li className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center uppercase shrink-0"
                    aria-hidden="true"
                  >
                    {pod.lead_student_name?.charAt(0) || 'L'}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{pod.lead_student_name || 'Pod Lead'}</p>
                    <p className="text-muted-foreground">Pod Lead / Creator</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">Lead</span>
              </li>

              {/* Other members */}
              {pod.members
                .filter((m) => m.user_id !== pod.lead_student_id)
                .map((m) => (
                  <li key={m.id} className="pt-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full bg-secondary text-secondary-foreground font-bold text-[10px] flex items-center justify-center uppercase shrink-0"
                        aria-hidden="true"
                      >
                        {m.member_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{m.member_name || m.email || 'Member'}</p>
                        <p className="text-muted-foreground">{m.role_in_team}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-semibold text-[10px]">
                      {m.role_in_team}
                    </span>
                  </li>
                ))}
            </ul>

            <a
              href="/people"
              className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-2xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-bold transition-colors min-h-[36px]"
              aria-label="Find more student innovators in the People directory"
            >
              <Users className="w-3.5 h-3.5" aria-hidden="true" /> Discover Innovators
            </a>
          </div>

          {/* Faculty Mentor Card */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-purple-500" aria-hidden="true" /> Faculty Mentor
            </h3>

            {pod.faculty_mentor_name ? (
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 font-bold text-sm flex items-center justify-center uppercase shrink-0"
                  aria-hidden="true"
                >
                  {pod.faculty_mentor_name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{pod.faculty_mentor_name}</p>
                  {pod.faculty_mentor_department && (
                    <p className="text-xs text-muted-foreground">{pod.faculty_mentor_department}</p>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 mt-1 inline-block">
                    Assigned Mentor
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-muted/50 rounded-2xl border border-border text-center space-y-2">
                <GraduationCap className="w-6 h-6 text-muted-foreground mx-auto" aria-hidden="true" />
                <p className="text-xs text-muted-foreground">No faculty mentor assigned yet.</p>
                <p className="text-[10px] text-muted-foreground">
                  Contact your university desk or include a faculty mentor ID when creating your pod.
                </p>
              </div>
            )}
          </div>

          {/* Review Status Card */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" aria-hidden="true" /> Academic Review Status
            </h3>

            <div className="p-3 bg-secondary/30 rounded-2xl border border-border flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <span className="text-muted-foreground">
                Current Stage:{' '}
                <strong className="text-foreground">{statusLabel}</strong>
              </span>
            </div>

            {pod.reviews.length > 1 && (
              <p className="text-[10px] text-muted-foreground text-center">
                {pod.reviews.length} review{pod.reviews.length !== 1 ? 's' : ''} received
              </p>
            )}

            {!pod.faculty_mentor_id && canSubmitForReview(pod) && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">
                ⚠️ No faculty mentor assigned. Assign one before submitting for formal review.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
