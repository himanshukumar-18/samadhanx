import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProblemStatusBadge, ImpactBadge } from '../components/ProblemStatusBadge';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { PostComments } from '../components/PostComments';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../store/authStore';
import { 
  Users, 
  Share2, 
  Bookmark, 
  Heart, 
  ArrowLeft,
  CheckCircle2,
  Inbox,
  PlusCircle
} from 'lucide-react';
import { problemsApi } from '../../../api/problems';
import { projectsApi } from '../../../api/projects';
import { socialApi } from '../../../api/social';
import toast from 'react-hot-toast';

export const ProblemDetailPage: React.FC<{ problemId?: string }> = ({ problemId: propId }) => {
  const { user } = useAuthStore();
  const isCitizenRole = !user || (user.role as string) === 'citizen' || (user.role as string) === 'community';

  const pathParts = window.location.pathname.split('/');
  const urlId = pathParts[pathParts.length - 1];
  const id = propId || (urlId !== 'problems' ? urlId : undefined);

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [solutionTitle, setSolutionTitle] = useState('');
  const [solutionDesc, setSolutionDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: problem, isLoading, refetch } = useQuery({
    queryKey: ['problem-detail', id],
    queryFn: () => (id ? problemsApi.getProblemDetail(id) : null),
    enabled: !!id,
  });

  const handleLike = async () => {
    if (!id) return;
    try {
      await problemsApi.toggleEndorsement(id);
      refetch();
      toast('Toggled endorsement!', { icon: '❤️' });
    } catch {
      toast.error('Failed to toggle endorsement.');
    }
  };

  const handleFormPod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !teamName.trim() || !solutionTitle.trim()) return;

    try {
      setIsSubmitting(true);
      await projectsApi.pickProject({
        problem_id: id,
        team_name: teamName,
        title: solutionTitle,
        description: solutionDesc || solutionTitle,
      });
      toast.success('Solution Pod created & problem assigned to your team!');
      setJoinModalOpen(false);
      setTeamName('');
      setSolutionTitle('');
      setSolutionDesc('');
      refetch();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(errorObj.response?.data?.error?.message || 'Failed to form solution pod.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 pb-12">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="space-y-4 pb-12">
        <a href="/" className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Feed
        </a>
        <EmptyState
          icon={Inbox}
          title="Challenge Not Found"
          description="This societal problem may have been resolved or does not exist."
          actionLabel="Back to Feed"
          onAction={() => (window.location.href = '/')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      {/* Top Back Nav */}
      <div className="flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Feed
        </a>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (id) socialApi.shareProblem(id, 'link').catch(() => undefined);
              navigator.clipboard.writeText(window.location.href);
              toast.success('Challenge link copied to clipboard!');
            }}
            className="p-2 bg-card hover:bg-muted border border-border rounded-xl text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Share challenge"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={async () => { if (!id) return; try { const result = await socialApi.toggleSaveProblem(id); toast.success(result.saved ? 'Saved to your problem library' : 'Removed from saved problems'); refetch(); } catch { toast.error('Failed to update saved problems.'); } }}
            className="p-2 bg-card hover:bg-muted border border-border rounded-xl text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Save problem"
          >
            <Bookmark className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Problem Header Card */}
      <Card className="p-5 sm:p-6 border-border space-y-4 rounded-2xl">
        {/* Status Lifecycle Stepper */}
        <div className="p-3.5 bg-muted/40 rounded-2xl border border-border">
          <div className="text-xs uppercase font-bold text-muted-foreground mb-2 tracking-wider">
            Problem-to-Impact Lifecycle
          </div>
          <div className="flex items-center justify-between text-xs sm:text-sm overflow-x-auto no-scrollbar gap-2">
            <span className="font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> 1. Reported
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> 2. Verified
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="font-bold text-primary flex items-center gap-1 ring-2 ring-primary/20 px-2.5 py-1 rounded-full bg-primary/10">
              <Users className="w-4 h-4" /> 3. Solution Active
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="text-muted-foreground">4. Prototype</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-muted-foreground">5. Solved</span>
          </div>
        </div>

        {/* Badges & Title */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <ProblemStatusBadge status={problem.status} />
            <ImpactBadge impact={problem.impact_level || 'high'} />
            <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-md">
              {problem.category}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground leading-tight">
            {problem.title}
          </h1>
        </div>

        {/* Submitter Author Info */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm uppercase">
            {problem.author?.full_name ? problem.author.full_name.slice(0, 2) : 'SX'}
          </div>
          <div>
            <div className="text-sm font-bold text-foreground flex items-center gap-1">
              {problem.author?.full_name || problem.author?.email || 'Citizen Reporter'}
              <CheckCircle2 className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xs text-muted-foreground">
              📍 {problem.district}, {problem.state} • Reported {new Date(problem.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Detailed Description */}
        <div className="text-sm sm:text-base text-foreground/90 space-y-3 leading-relaxed pt-2">
          <p>{problem.description}</p>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-3 border-t border-border flex-wrap gap-2">
          <button
            onClick={handleLike}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all min-h-[44px] text-muted-foreground hover:bg-muted"
          >
            <Heart className="w-4 h-4 fill-rose-600 text-rose-600" />
            <span>{problem.endorsements?.length || 0} Endorsements</span>
          </button>

          {!isCitizenRole ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setJoinModalOpen(true)}
              className="font-bold text-sm min-h-[44px] px-5"
              leftIcon={<Users className="w-4 h-4" />}
            >
              Form / Join Solution Pod
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => (window.location.href = '/')}
              className="font-bold text-sm min-h-[44px] px-5"
              leftIcon={<PlusCircle className="w-4 h-4" />}
            >
              Report Another Problem
            </Button>
          )}
        </div>
      </Card>

      {/* Discussion & Collaborative Input */}
      <Card className="p-5 sm:p-6 border-border space-y-4 rounded-2xl">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Community & Mentorship Discussion
        </h3>
        <PostComments problemId={id} comments={problem.comments} />
      </Card>

      {/* Join Pod Modal (Available for Solvers) */}
      {!isCitizenRole && joinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Form Solution Pod for this Challenge</h3>
              <button onClick={() => setJoinModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Collaborate with solvers, request faculty mentorship, and deploy prototypes.
            </p>
            <form onSubmit={handleFormPod} className="space-y-3">
              <input
                type="text"
                placeholder="Team Name (e.g. CleanWater Innovators)"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full bg-background border border-border rounded-xl p-3 text-sm text-foreground focus:border-primary focus:outline-none"
                required
              />
              <input
                type="text"
                placeholder="Solution Project Title"
                value={solutionTitle}
                onChange={(e) => setSolutionTitle(e.target.value)}
                className="w-full bg-background border border-border rounded-xl p-3 text-sm text-foreground focus:border-primary focus:outline-none"
                required
              />
              <textarea
                placeholder="Outline your proposed technical methodology..."
                value={solutionDesc}
                onChange={(e) => setSolutionDesc(e.target.value)}
                className="w-full h-24 bg-background border border-border rounded-xl p-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setJoinModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting} className="font-bold">
                  Launch Team Pod
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
