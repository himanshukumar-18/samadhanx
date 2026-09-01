import React, { useState } from 'react';
import { Problem } from '../../../types/problem';
import { Card } from '../../../shared/components/ui/Card';
import { ProblemStatusBadge, ImpactBadge } from './ProblemStatusBadge';
import { PostHeader } from './PostHeader';
import { AIInsightCard } from './AIInsightCard';
import { PostActions } from './PostActions';
import { PostComments } from './PostComments';
import { Users, GraduationCap, Building2 } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { problemsApi } from '../../../api/problems';
import { socialApi } from '../../../api/social';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../shared/components/ui/Button';
import toast from 'react-hot-toast';

export const ProblemPost: React.FC<{ problem: Problem }> = ({ problem }) => {
  const [showComments, setShowComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(problem.description);
  const { user } = useAuthStore();
  const client = useQueryClient();
  const isOwner = user?.id === problem.author.id;
  const saveEdit = async () => { try { await problemsApi.updateProblem(problem.id, { description: editText }); client.invalidateQueries({ queryKey: ['problems'] }); client.invalidateQueries({ queryKey: ['my-problems'] }); setEditing(false); toast.success('Challenge updated.'); } catch { toast.error('Failed to update challenge.'); } };
  const deletePost = async () => { if (!window.confirm('Delete this challenge permanently?')) return; try { await problemsApi.deleteProblem(problem.id); client.invalidateQueries({ queryKey: ['problems'] }); client.invalidateQueries({ queryKey: ['my-problems'] }); toast.success('Challenge deleted.'); } catch { toast.error('Failed to delete challenge.'); } };
  const reportPost = async () => { const reason = window.prompt('Why are you reporting this challenge?'); if (!reason) return; try { const result = await socialApi.reportProblem(problem.id, reason); toast.success(result.reported ? 'Report submitted.' : 'You have already reported this challenge.'); } catch { toast.error('Failed to submit report.'); } };

  return (
    <Card className="p-5 sm:p-6 border-border shadow-xs hover:border-border/80 transition-all space-y-4 rounded-2xl">
      {/* 1. Header (Author, Location, Timestamp) */}
      <PostHeader
        author={problem.author}
        createdAt={problem.createdAt}
        location={`${problem.district}, ${problem.state}`}
        isOwner={isOwner}
        onEdit={() => setEditing(true)} onDelete={deletePost} onReport={reportPost}
      />

      {/* 2. Title & Status Badges */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <ProblemStatusBadge status={problem.status} />
          <ImpactBadge impact={problem.impactLevel} />
          <span className="text-xs uppercase font-bold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-md">
            {problem.category}
          </span>
        </div>

        <a href={`/problems/${problem.id}`} className="block group">
          <h2 className="text-lg sm:text-xl font-extrabold text-foreground group-hover:text-primary transition-colors leading-snug">
            {problem.title}
          </h2>
        </a>
      </div>

      {/* 3. Description Content */}
      <p className="text-sm sm:text-base text-foreground/85 leading-relaxed">{problem.description}</p>

      {/* 4. Problem Media Image (if any) */}
      {problem.images && problem.images.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-border/60 max-h-80">
          <img
            src={problem.images[0]}
            alt={problem.title}
            className="w-full h-full object-cover hover:scale-[1.01] transition-transform duration-300"
            loading="lazy"
          />
        </div>
      )}

      {/* 5. Tags */}
      {problem.tags && problem.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {problem.tags.map((tag, idx) => (
            <span
              key={idx}
              className="text-xs font-semibold text-primary bg-primary/5 px-2.5 py-0.5 rounded-md"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 6. Contextual AI Insight */}
      {problem.aiInsight && (
        <AIInsightCard insight={problem.aiInsight} problemId={problem.id} />
      )}

      {/* 7. Real Collaboration Traction Bar (Rendered only when active) */}
      {(problem.activeTeamsCount > 0 || problem.interestedUniversitiesCount > 0 || problem.industrySponsorsCount > 0) && (
        <div className="flex items-center gap-4 py-2 px-3.5 bg-muted/40 rounded-xl text-xs text-muted-foreground flex-wrap">
          {problem.activeTeamsCount > 0 && (
            <div className="flex items-center gap-1.5 text-primary font-semibold">
              <Users className="w-4 h-4" />
              <span>{problem.activeTeamsCount} Solution Pods Active</span>
            </div>
          )}
          {problem.interestedUniversitiesCount > 0 && (
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <GraduationCap className="w-4 h-4 text-purple-500" />
              <span>{problem.interestedUniversitiesCount} University Mentors</span>
            </div>
          )}
          {problem.industrySponsorsCount > 0 && (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
              <Building2 className="w-4 h-4" />
              <span>{problem.industrySponsorsCount} CSR Sponsor Bounties</span>
            </div>
          )}
        </div>
      )}

      {/* 8. Social Action Buttons */}
      <PostActions
        problemId={problem.id}
        likesCount={problem.likesCount}
        commentsCount={problem.commentsCount}
        isLiked={problem.isLiked}
        isSaved={problem.isSaved}
        onToggleCommentSection={() => setShowComments(!showComments)}
      />

      {/* 9. Inline Comments Thread */}
      {showComments && <PostComments problemId={problem.id} comments={problem.comments} />}
      {editing && <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"><Card className="w-full max-w-lg space-y-3"><h3 className="font-bold">Edit challenge</h3><textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full min-h-28 p-3 bg-background border border-border rounded-xl"/><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button><Button size="sm" onClick={saveEdit}>Save</Button></div></Card></div>}
    </Card>
  );
};
