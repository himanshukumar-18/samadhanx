import React, { useState } from 'react';
import { Problem } from '../../../types/problem';
import { ProblemStatusBadge, ImpactBadge } from '../components/ProblemStatusBadge';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { PostComments } from '../components/PostComments';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { 
  Users, 
  Share2, 
  Bookmark, 
  Heart, 
  ArrowLeft,
  CheckCircle2,
  Inbox
} from 'lucide-react';
import toast from 'react-hot-toast';

export const ProblemDetailPage: React.FC<{ problem?: Problem }> = ({ problem }) => {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(problem?.likesCount || 0);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

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

  const handleLike = () => {
    if (liked) {
      setLikes(likes - 1);
      setLiked(false);
    } else {
      setLikes(likes + 1);
      setLiked(true);
      toast('Endorsed problem severity!', { icon: '❤️' });
    }
  };

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
              navigator.clipboard.writeText(window.location.href);
              toast.success('Challenge link copied to clipboard!');
            }}
            className="p-2 bg-card hover:bg-muted border border-border rounded-xl text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Share challenge"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => toast.success('Saved to your challenge library')}
            className="p-2 bg-card hover:bg-muted border border-border rounded-xl text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Save challenge"
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
              <Users className="w-4 h-4" /> 3. Team Forming
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
            <ImpactBadge impact={problem.impactLevel} />
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
          <img src={problem.author.avatar} alt="Author" className="w-10 h-10 rounded-full object-cover border border-border" />
          <div>
            <div className="text-sm font-bold text-foreground flex items-center gap-1">
              {problem.author.name}
              {problem.author.verified && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </div>
            <div className="text-xs text-muted-foreground">
              {problem.author.role} • 📍 {problem.district}, {problem.state} • Reported {problem.createdAt}
            </div>
          </div>
        </div>

        {/* Detailed Description */}
        <div className="text-sm sm:text-base text-foreground/90 space-y-3 leading-relaxed pt-2">
          <p>{problem.description}</p>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <button
            onClick={handleLike}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all min-h-[44px] ${
              liked ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/40' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-rose-600' : ''}`} />
            <span>{likes} Endorsements</span>
          </button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setJoinModalOpen(true)}
            className="font-bold text-sm min-h-[44px] px-5"
            leftIcon={<Users className="w-4 h-4" />}
          >
            Form / Join Solution Pod
          </Button>
        </div>
      </Card>

      {/* Discussion & Collaborative Input */}
      <Card className="p-5 sm:p-6 border-border space-y-4 rounded-2xl">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Community & Mentorship Discussion
        </h3>
        <PostComments comments={problem.comments} />
      </Card>

      {/* Join Pod Modal */}
      {joinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl p-6 border border-border shadow-2xl space-y-4 animate-fade-in text-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Form Solution Pod for this Challenge</h3>
              <button onClick={() => setJoinModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Collaborate with solvers, request faculty mentorship, and deploy prototypes.
            </p>
            <input
              type="text"
              placeholder="Team Name (e.g. CleanWater Innovators)"
              className="w-full bg-background border border-border rounded-xl p-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <textarea
              placeholder="Outline your proposed technical approach..."
              className="w-full h-24 bg-background border border-border rounded-xl p-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setJoinModalOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                className="font-bold"
                onClick={() => {
                  setJoinModalOpen(false);
                  toast.success('Solution Pod created!');
                }}
              >
                Launch Team Pod
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
