import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Rocket, ArrowLeft, ExternalLink, GitBranch, Users, Plus,
  Send, Clock, CheckCircle2, ShieldCheck, Sparkles, MessageSquare,
  AlertCircle, GraduationCap, BarChart2, AlertTriangle, RefreshCw,
  Award, CheckCircle, XCircle,
  HeartHandshake, Edit3
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { podsApi, POD_STATUS_LABEL, canSubmitForReview } from '../../../api/pods';
import { studentApi } from '../../../api/student';
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

  // Impact report form state
  const [showImpactForm, setShowImpactForm] = useState(false);
  const [outcomeDescription, setOutcomeDescription] = useState('');
  const [beneficiariesReached, setBeneficiariesReached] = useState<number | ''>('');
  const [proofImageInput, setProofImageInput] = useState('');
  const [proofImages, setProofImages] = useState<string[]>([]);

  // ── Queries ──
  const { data: pod, isLoading, error } = useQuery({
    queryKey: ['pod-detail', podId],
    queryFn: () => podsApi.getPodDetail(podId),
    enabled: Boolean(podId),
    staleTime: 15_000,
  });

  const isLead = user?.id === pod?.lead_student_id;
  const isMember =
    isLead || (pod?.members.some((m) => m.user_id === user?.id) ?? false);

  // Funding Offers Query
  const { data: fundingOffers, isLoading: offersLoading } = useQuery({
    queryKey: ['pod-funding-offers', podId],
    queryFn: () => studentApi.getFundingOffers(podId),
    enabled: Boolean(podId && isMember),
    staleTime: 30_000,
  });

  // Impact Report Query
  const { data: impactReport } = useQuery({
    queryKey: ['pod-impact-report', podId],
    queryFn: () => studentApi.getImpactReport(podId),
    enabled: Boolean(podId && (pod?.status === 'completed' || pod?.status === 'pilot')),
    retry: false,
  });

  // ── Mutations ──

  const submitReviewMutation = useMutation({
    mutationFn: () => podsApi.submitForReview(podId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['pod-detail', podId], updated);
      queryClient.invalidateQueries({ queryKey: ['my-problem-pods'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      queryClient.invalidateQueries({ queryKey: ['student-projects'] });
      toast.success('Pod submitted for faculty review!');
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail?.message ||
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to submit for review.';
      toast.error(msg);
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

  const respondOfferMutation = useMutation({
    mutationFn: ({ offerId, decision }: { offerId: string; decision: 'accepted' | 'declined' }) =>
      studentApi.respondToOffer(offerId, decision),
    onSuccess: (_, { decision }) => {
      queryClient.invalidateQueries({ queryKey: ['pod-funding-offers', podId] });
      queryClient.invalidateQueries({ queryKey: ['pod-detail', podId] });
      toast.success(`Funding offer ${decision}!`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || err.response?.data?.detail?.message || 'Failed to respond to offer.');
    },
  });

  const submitImpactReportMutation = useMutation({
    mutationFn: (data: { outcome_description: string; beneficiaries_reached?: number; proof_image_urls?: string[] }) =>
      impactReport
        ? studentApi.updateImpactReport(podId, data)
        : studentApi.submitImpactReport(podId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pod-impact-report', podId] });
      queryClient.invalidateQueries({ queryKey: ['pod-detail', podId] });
      setShowImpactForm(false);
      toast.success('Impact report submitted successfully! 🌟');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || err.response?.data?.detail?.message || 'Failed to submit impact report.');
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

  const handleAddProofImage = () => {
    if (proofImageInput.trim() && proofImages.length < 5) {
      setProofImages((prev) => [...prev, proofImageInput.trim()]);
      setProofImageInput('');
    }
  };

  const handleRemoveProofImage = (index: number) => {
    setProofImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitImpact = (e: React.FormEvent) => {
    e.preventDefault();
    if (outcomeDescription.trim().length < 20) {
      toast.error('Outcome description must be at least 20 characters.');
      return;
    }
    submitImpactReportMutation.mutate({
      outcome_description: outcomeDescription.trim(),
      beneficiaries_reached: beneficiariesReached !== '' ? Number(beneficiariesReached) : undefined,
      proof_image_urls: proofImages,
    });
  };

  const openImpactFormWithExisting = () => {
    if (impactReport) {
      setOutcomeDescription(impactReport.outcome_description || '');
      setBeneficiariesReached(impactReport.beneficiaries_reached ?? '');
      setProofImages(impactReport.proof_image_urls || []);
    }
    setShowImpactForm(true);
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

  const progressColour = PROGRESS_COLOUR[pod.status] ?? 'bg-primary';
  const statusLabel = POD_STATUS_LABEL[pod.status];
  const latestReview = pod.reviews.length > 0 ? pod.reviews[0] : null;

  return (
    <div className="space-y-6 pb-16 w-full max-w-6xl mx-auto">

      {/* ── Back nav + status ── */}
      <div className="flex items-center justify-between">
        <a
          href="/my-problems"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors group"
          aria-label="Back to My Pods"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to My Pods
        </a>

        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${progressColour}`} aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {statusLabel}
          </span>
        </div>
      </div>

      {/* ── Workspace Header ── */}
      <header className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-primary">
              <Rocket className="w-4 h-4" /> Solution Pod Workspace
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              {pod.title}
            </h1>
            <p className="text-sm font-semibold text-muted-foreground">
              Team: <span className="text-foreground">{pod.team_name}</span>
            </p>
          </div>

          {/* CTA: Submit for Academic Review */}
          <div className="flex flex-wrap items-center gap-3">
            {pod.repository_url && (
              <a
                href={pod.repository_url.startsWith('http') ? pod.repository_url : `https://${pod.repository_url}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-bold transition-colors min-h-[44px]"
                aria-label="Open solution repository in new tab"
              >
                <GitBranch className="w-4 h-4" aria-hidden="true" /> Repository
              </a>
            )}

            {isLead && canSubmitForReview(pod) && (
              <button
                type="button"
                onClick={() => submitReviewMutation.mutate()}
                disabled={submitReviewMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-wider shadow-lg shadow-primary/20 transition-all disabled:opacity-50 min-h-[44px]"
                aria-label="Submit pod for faculty mentor review"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                {submitReviewMutation.isPending ? 'Submitting...' : 'Submit for Academic Review'}
              </button>
            )}
          </div>
        </div>

        {/* Linked Problem Banner */}
        <div className="p-4 rounded-2xl bg-secondary/40 border border-border flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Linked Civic Problem
            </span>
            <p className="text-sm font-bold text-foreground">
              {pod.problem_title || 'Civic Challenge'}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-primary" /> Engineering Progress
            </span>
            <span className="text-foreground">{pod.progress}%</span>
          </div>
          <div
            className="w-full h-2.5 bg-secondary rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={pod.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Engineering progress: ${pod.progress}%`}
          >
            <div
              className={`h-full ${progressColour} rounded-full transition-all duration-500`}
              style={{ width: `${pod.progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* ── Main Workspace Body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2 Cols: Description, Banners, Offers, Updates, Impact Report */}
        <div className="lg:col-span-2 space-y-6">

          {/* Description */}
          <section className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-3" aria-label="Solution Overview">
            <h2 className="text-base font-bold text-foreground">Solution Overview & Objectives</h2>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {pod.description}
            </p>
          </section>

          {/* Faculty Review Feedback Banner */}
          {latestReview && (
            <div
              className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-3"
              role="region"
              aria-label="Latest faculty review feedback"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <MessageSquare className="w-4 h-4 text-purple-500" aria-hidden="true" />
                {latestReview.decision === 'approved' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
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

          {/* Revision Required Banner */}
          {isLead && latestReview?.decision === 'changes_requested' && pod.status === 'in_progress' && (
            <div
              className="rounded-3xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-5 space-y-3"
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Action Required: Revision Requested
              </div>
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed pl-6">
                Your faculty mentor has requested changes. Address the feedback above, post a milestone update
                describing your revisions, then resubmit for review.
              </p>
              <div className="pl-6 flex items-center gap-3">
                <button
                  onClick={() => setShowUpdateForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-600 text-white text-xs font-bold shadow hover:bg-amber-700 transition-colors min-h-[36px]"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Post Revision Update
                </button>
                <button
                  onClick={() => submitReviewMutation.mutate()}
                  disabled={submitReviewMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-purple-600 text-white text-xs font-bold shadow hover:bg-purple-700 transition-colors disabled:opacity-50 min-h-[36px]"
                >
                  {submitReviewMutation.isPending ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Submitting...</>
                  ) : (
                    <><ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Resubmit for Review</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Approved Pod Banner */}
          {latestReview?.decision === 'approved' && pod.status === 'pilot' && (
            <div
              className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700 p-5 space-y-2"
              role="status"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                🎉 Pod Approved! Now in Pilot Phase
              </div>
              <p className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed pl-6">
                Congratulations! Your faculty mentor has approved this pod. Continue building, document your
                progress, and explore industry collaboration opportunities below.
              </p>
            </div>
          )}

          {/* ── Industry Support & Funding Offers Section ── */}
          <section className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-4" aria-label="Industry Support Offers">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <HeartHandshake className="w-5 h-5 text-primary" />
                <span>Industry Support & CSR Grants</span>
              </div>
              {fundingOffers && fundingOffers.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  {fundingOffers.length} Offer{fundingOffers.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {offersLoading ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Checking for industry offers...</div>
            ) : !fundingOffers || fundingOffers.length === 0 ? (
              <div className="p-4 bg-muted/40 rounded-2xl border border-border text-center space-y-1">
                <p className="text-xs text-muted-foreground">No industry support offers yet.</p>
                <p className="text-[11px] text-muted-foreground">
                  Industry partners scout approved pods in the Pilot phase for CSR funding and mentorship.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {fundingOffers.map((offer: any) => (
                  <div
                    key={offer.id}
                    className="p-4 rounded-2xl bg-secondary/30 border border-border space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{offer.company_name}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {offer.support_type}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Received {new Date(offer.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          offer.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : offer.status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-600'
                            : 'bg-amber-500/10 text-amber-600'
                        }`}
                      >
                        {offer.status === 'approved' ? 'Accepted' : offer.status === 'rejected' ? 'Declined' : 'Pending'}
                      </span>
                    </div>

                    <p className="text-xs text-foreground/90 bg-card p-3 rounded-xl border border-border">
                      {offer.amount_or_terms}
                    </p>

                    {/* Pod Lead Action Buttons for Pending Offers */}
                    {isLead && offer.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => respondOfferMutation.mutate({ offerId: offer.id, decision: 'declined' })}
                          disabled={respondOfferMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground text-xs font-bold transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => respondOfferMutation.mutate({ offerId: offer.id, decision: 'accepted' })}
                          disabled={respondOfferMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Accept Support
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Impact Report Section (Available for Completed Pods) ── */}
          {pod.status === 'completed' && (
            <section className="bg-card border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4" aria-label="Societal Impact Report">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Award className="w-5 h-5 text-emerald-500" />
                  <span>Societal Impact & Outcome Report</span>
                </div>
                {impactReport && (
                  <div className="flex items-center gap-2">
                    {impactReport.is_verified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        <ShieldCheck className="w-3.5 h-3.5" /> Verified by {impactReport.verifier_name || 'Academic Council'}
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                        Pending Verification
                      </span>
                    )}
                    {isLead && !showImpactForm && (
                      <button
                        type="button"
                        onClick={openImpactFormWithExisting}
                        className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {impactReport && !showImpactForm ? (
                <div className="space-y-4 pt-1">
                  {impactReport.beneficiaries_reached !== null && (
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Direct Beneficiaries Reached
                      </span>
                      <span className="text-xl font-black text-emerald-600">
                        {impactReport.beneficiaries_reached.toLocaleString()} citizens
                      </span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Outcome & Societal Deployment
                    </span>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap bg-secondary/30 p-4 rounded-2xl border border-border leading-relaxed">
                      {impactReport.outcome_description}
                    </p>
                  </div>

                  {impactReport.proof_image_urls && impactReport.proof_image_urls.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Field Verification Photos
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {impactReport.proof_image_urls.map((url: string, i: number) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-20 h-20 rounded-2xl overflow-hidden border border-border hover:opacity-90 transition-opacity"
                          >
                            <img src={url} alt={`Proof ${i + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : isLead || showImpactForm ? (
                <form onSubmit={handleSubmitImpact} className="space-y-4 pt-2 border-t border-border">
                  <div>
                    <label htmlFor="impact-beneficiaries" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Beneficiaries Reached (Estimated)
                    </label>
                    <input
                      id="impact-beneficiaries"
                      type="number"
                      min="0"
                      placeholder="e.g. 2500"
                      value={beneficiariesReached}
                      onChange={(e) => setBeneficiariesReached(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-2xl bg-secondary/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label htmlFor="impact-outcome" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Outcome Description * (min 20 characters)
                    </label>
                    <textarea
                      id="impact-outcome"
                      required
                      rows={4}
                      placeholder="Describe the solution impact: what was deployed, community feedback, metric improvements, field measurements..."
                      value={outcomeDescription}
                      onChange={(e) => setOutcomeDescription(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-secondary/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>

                  {/* Proof Images URL input */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Proof / Deployment Photo URLs (Max 5)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://res.cloudinary.com/..."
                        value={proofImageInput}
                        onChange={(e) => setProofImageInput(e.target.value)}
                        className="flex-1 px-4 py-2 rounded-2xl bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={handleAddProofImage}
                        disabled={!proofImageInput.trim() || proofImages.length >= 5}
                        className="px-4 py-2 rounded-2xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 disabled:opacity-40"
                      >
                        Add
                      </button>
                    </div>

                    {proofImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {proofImages.map((img, idx) => (
                          <div key={idx} className="relative group/img">
                            <span className="text-[11px] font-mono bg-secondary px-2.5 py-1 rounded-xl truncate max-w-[200px] inline-block border border-border">
                              {img}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveProofImage(idx)}
                              className="ml-1 text-xs text-rose-500 hover:text-rose-700 font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    {impactReport && (
                      <button
                        type="button"
                        onClick={() => setShowImpactForm(false)}
                        className="px-4 py-2 rounded-2xl text-xs font-bold text-muted-foreground hover:bg-secondary"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={submitImpactReportMutation.isPending}
                      className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
                    >
                      {submitImpactReportMutation.isPending ? 'Saving...' : impactReport ? 'Update Report' : 'Submit Impact Report'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-4 bg-muted/40 rounded-2xl border border-border text-center space-y-1">
                  <p className="text-xs text-muted-foreground">No impact report submitted yet for this completed pod.</p>
                </div>
              )}
            </section>
          )}

          {/* Post Milestone Update */}
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
                      Live Prototype / Demo URL (Optional)
                    </label>
                    <input
                      id="prototype-url"
                      type="url"
                      placeholder="https://demo.myproject.in"
                      value={prototypeUrl}
                      onChange={(e) => setPrototypeUrl(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-secondary/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowUpdateForm(false)}
                      className="px-4 py-2 rounded-2xl text-xs font-semibold text-muted-foreground hover:bg-secondary min-h-[44px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={postUpdateMutation.isPending}
                      className="px-5 py-2 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50 min-h-[44px]"
                    >
                      {postUpdateMutation.isPending ? 'Publishing...' : 'Publish Update'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Milestone Updates Timeline */}
          <section className="space-y-4" aria-label="Engineering updates log">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" aria-hidden="true" /> Engineering Log ({pod.updates.length})
            </h2>

            {pod.updates.length === 0 ? (
              <div className="bg-card border border-border rounded-3xl p-8 text-center space-y-2">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto" aria-hidden="true" />
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
                  Faculty mentors can adopt this pod from their faculty review dashboard.
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
                ⚠️ No faculty mentor assigned. A mentor can adopt this pod to provide guidance and submit evaluations.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
