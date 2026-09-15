import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Button } from '../../../shared/components/ui/Button';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import {
  GraduationCap, Users, MapPin, ChevronLeft, AlertCircle,
  HeartHandshake, CheckCircle2, Clock, BookOpen, TrendingUp, XCircle,
} from 'lucide-react';
import { industryApi } from '../../../api/industry';

const SUPPORT_TYPES = [
  { value: 'sponsorship', label: 'Direct Sponsorship / Cash Grant' },
  { value: 'mentorship', label: 'Industry Mentorship & Guidance' },
  { value: 'pilot_partner', label: 'Field Pilot Deployment Partner' },
  { value: 'bounty', label: 'Bounty / Prize Award' },
  { value: 'csr_grant', label: 'CSR Innovation Grant' },
  { value: 'equipment', label: 'Equipment / Hardware Donation' },
];

export const VettedProjectDetail: React.FC = () => {
  const podId = window.location.pathname.replace('/industry/vetted-projects/', '').split('/')[0] || undefined;
  const queryClient = useQueryClient();

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [supportType, setSupportType] = useState('sponsorship');
  const [amountOrTerms, setAmountOrTerms] = useState('');
  const [message, setMessage] = useState('');
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerSuccess, setOfferSuccess] = useState(false);

  const { data: pod, isLoading, error } = useQuery({
    queryKey: ['vetted-project-detail', podId],
    queryFn: () => industryApi.getVettedProjectDetail(podId!),
    enabled: !!podId,
  });

  const offerMutation = useMutation({
    mutationFn: (data: { pod_id: string; support_type: string; amount_or_terms: string; message: string }) =>
      industryApi.createFundingOffer(data),
    onSuccess: () => {
      setOfferSuccess(true);
      setShowOfferModal(false);
      setAmountOrTerms('');
      setMessage('');
      setOfferError(null);
      queryClient.invalidateQueries({ queryKey: ['industry-dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['industry-my-offers'] });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.detail?.code || err?.response?.data?.error?.code;
      if (code === 'DUPLICATE_OFFER') {
        setOfferError('You already have a pending offer on this pod. Withdraw it first or wait for a response.');
      } else {
        setOfferError(err?.response?.data?.detail?.message || err?.message || 'Failed to submit offer.');
      }
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !pod) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h3 className="text-lg font-bold text-foreground">Pod not found or not yet faculty-approved</h3>
        <p className="text-sm text-muted-foreground mt-1">
          This pod either doesn't exist or has not received faculty approval yet.
        </p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => (window.history.back())}>
          <ChevronLeft className="w-4 h-4" /> Back to Vetted Pods
        </Button>
      </div>
    );
  }

  const statusStyle = pod.status === 'completed'
    ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
    : 'text-amber-600 bg-amber-500/10 border-amber-500/20';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back */}
      <button
        onClick={() => (window.history.back())}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Vetted Pods
      </button>

      {/* Success Banner */}
      {offerSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <div className="font-bold text-sm">Offer Submitted Successfully!</div>
            <div className="text-xs opacity-80">The pod lead has been notified and will respond soon.</div>
          </div>
        </div>
      )}

      {/* Pod Header */}
      <Card className="p-6 border-border space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-xl font-black text-foreground">{pod.title}</h1>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border capitalize ${statusStyle}`}>
                {pod.status === 'pilot' ? '🧪 Pilot Phase' : '✅ Completed'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-primary" /> {pod.team_name}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {pod.member_count} member{pod.member_count !== 1 ? 's' : ''}
              </span>
              {pod.university_name && (
                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                  <GraduationCap className="w-3.5 h-3.5" /> {pod.university_name}
                </span>
              )}
            </div>
          </div>

          <Button
            onClick={() => { setShowOfferModal(true); setOfferSuccess(false); setOfferError(null); }}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shrink-0"
          >
            <HeartHandshake className="w-4 h-4" /> Make Funding Offer
          </Button>
        </div>

        <p className="text-sm text-foreground/90 leading-relaxed">{pod.description}</p>

        {/* Problem Context */}
        {pod.problem_title && (
          <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-1.5">
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Societal Problem Addressed</div>
            <div className="font-bold text-foreground text-sm">{pod.problem_title}</div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
              {pod.problem_category && <Badge variant="default" className="text-[11px]">{pod.problem_category}</Badge>}
              {pod.problem_state && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {pod.problem_district && `${pod.problem_district}, `}{pod.problem_state}
                </span>
              )}
              {pod.problem_impact_level && (
                <span className="capitalize font-semibold text-primary">{pod.problem_impact_level} Impact</span>
              )}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-primary" /> Progress
            </span>
            <span className="font-bold text-primary">{pod.progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${pod.progress}%` }} />
          </div>
        </div>
      </Card>

      {/* Faculty Review Quality Signal */}
      {pod.latest_faculty_review && (
        <Card className="p-5 border-emerald-500/20 bg-emerald-500/5 space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-bold text-sm">Faculty Academic Review</span>
            <Badge variant="approved" className="ml-auto capitalize">
              {pod.latest_faculty_review.decision}
            </Badge>
          </div>
          {pod.latest_faculty_review.feedback && (
            <p className="text-sm text-foreground/80 leading-relaxed">
              "{pod.latest_faculty_review.feedback}"
            </p>
          )}
          <div className="text-xs text-muted-foreground">
            Reviewed on {new Date(pod.latest_faculty_review.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        </Card>
      )}

      {/* Recent Updates Teaser */}
      {pod.recent_updates.length > 0 && (
        <Card className="p-5 border-border space-y-3">
          <div className="flex items-center gap-2 text-foreground">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">Latest Engineering Updates</span>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full ml-auto">
              Teaser — Fund to see full log
            </span>
          </div>
          <div className="space-y-3">
            {pod.recent_updates.map((u) => (
              <div key={u.id} className="pl-3 border-l-2 border-primary/30">
                {u.milestone && <div className="text-xs font-bold text-primary mb-0.5">{u.milestone}</div>}
                <p className="text-sm text-foreground/80 line-clamp-2">{u.content}</p>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(u.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border text-center">
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            Full Engineering Log & Impact Report available after your funding offer is accepted.
          </div>
        </Card>
      )}

      {/* Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-amber-500" />
                Submit Funding Offer
              </h3>
              <button
                onClick={() => { setShowOfferModal(false); setOfferError(null); }}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {offerError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {offerError}
              </div>
            )}

            <div className="bg-muted/50 rounded-xl p-3 border border-border text-xs">
              <div className="font-bold text-foreground">{pod.title}</div>
              <div className="text-muted-foreground">{pod.team_name}</div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!amountOrTerms.trim()) { setOfferError('Please describe your offer terms.'); return; }
                offerMutation.mutate({ pod_id: pod.id, support_type: supportType, amount_or_terms: amountOrTerms.trim(), message: message.trim() });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Support Type <span className="text-destructive">*</span>
                </label>
                <select
                  value={supportType}
                  onChange={(e) => setSupportType(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {SUPPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Offer Terms / Amount <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={4}
                  value={amountOrTerms}
                  onChange={(e) => setAmountOrTerms(e.target.value)}
                  placeholder="e.g. ₹5,00,000 grant for Phase 1 field testing + weekly mentorship sessions from our CTO."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Cover Message (Optional)
                </label>
                <textarea
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="A brief message introducing your company and why you want to support this pod..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowOfferModal(false)} disabled={offerMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={offerMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                >
                  {offerMutation.isPending ? 'Submitting...' : 'Submit Offer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VettedProjectDetail;
