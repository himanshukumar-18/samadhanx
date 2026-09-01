import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Comment } from '../../../types/problem';
import { useAuthStore } from '../../../store/authStore';
import { problemsApi } from '../../../api/problems';
import { Send } from 'lucide-react';
import toast from 'react-hot-toast';

export const PostComments: React.FC<{ problemId?: string; comments?: Comment[] }> = ({
  problemId,
  comments: initialComments = [],
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: apiComments = [], isLoading } = useQuery({
    queryKey: ['problem-comments', problemId],
    queryFn: () => (problemId ? problemsApi.listComments(problemId) : []),
    enabled: Boolean(problemId),
  });
  const [text, setText] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    if (problemId) {
      try {
        setIsPosting(true);
        const res = await problemsApi.addComment(problemId, text);
        const newComm: Comment = {
          id: res.id,
          author: {
            id: user?.id || 'usr-current',
            name: user?.full_name || user?.email || 'You',
            avatar: (user as any)?.avatar_url || '',
            role: user?.role || 'Citizen',
            location: 'India',
            verified: true,
          },
          content: res.content,
          createdAt: res.created_at ? new Date(res.created_at).toLocaleString() : 'Just now',
          likesCount: 0,
        };
        queryClient.setQueryData<Comment[]>(['problem-comments', problemId], (current = []) => [newComm, ...current]);
        queryClient.invalidateQueries({ queryKey: ['problems'] });
        queryClient.invalidateQueries({ queryKey: ['problem-detail', problemId] });
        setText('');
        toast.success('Comment posted successfully!');
      } catch {
        toast.error('Failed to post comment.');
      } finally {
        setIsPosting(false);
      }
    }
  };

  const formattedComments: Comment[] = problemId
    ? apiComments.map((c: any): Comment => {
        const authorName = c.author?.full_name || c.author_name || 'Community Innovator';
        const authorAvatar = c.author?.avatar_url || c.author_avatar || '';
        const authorRole = c.author?.role || c.author_role || 'Contributor';
        let dateStr = 'Recently';
        if (c.created_at) {
          const parsed = new Date(c.created_at);
          if (!isNaN(parsed.getTime())) {
            dateStr = parsed.toLocaleDateString() + ' ' + parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        }

        return {
          id: c.id,
          author: {
            id: c.user_id || c.author?.id || 'user',
            name: authorName,
            avatar: authorAvatar,
            role: authorRole,
            location: 'India',
          },
          content: c.content,
          createdAt: dateStr,
          likesCount: 0,
        };
      })
    : initialComments;

  return (
    <div className="pt-3 border-t border-border space-y-3">
      {/* Input Box */}
      <form onSubmit={handleAddComment} className="flex gap-2 items-center">
        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center uppercase flex-shrink-0">
          {user?.email ? user.email.slice(0, 2) : 'SX'}
        </div>
        <input
          type="text"
          placeholder="Propose an approach or ask a question..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 bg-muted/60 hover:bg-muted focus:bg-background rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground border border-transparent focus:border-primary focus:outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!text.trim() || isPosting}
          className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Comments List */}
      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
        {isLoading && <p className="text-xs text-muted-foreground">Loading discussion…</p>}
        {!isLoading && formattedComments.length === 0 && (
          <p className="text-xs text-muted-foreground italic py-1">No comments yet. Be the first to start the discussion!</p>
        )}
        {formattedComments.map((c: Comment) => (
          <div key={c.id} className="flex items-start gap-2.5 text-xs bg-muted/40 p-2.5 rounded-lg">
            <a href={c.author.id === user?.id ? '/profile' : `/profile/user/${c.author.id}`} className="flex-shrink-0 mt-0.5">
              {c.author.avatar ? (
                <img src={c.author.avatar} alt={c.author.name} className="w-6 h-6 rounded-full object-cover border border-border" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center uppercase">
                  {c.author.name ? c.author.name.slice(0, 2) : 'SX'}
                </div>
              )}
            </a>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <a
                    href={c.author.id === user?.id ? '/profile' : `/profile/user/${c.author.id}`}
                    className="font-bold text-foreground hover:text-primary transition-colors truncate"
                  >
                    {c.author.name}
                  </a>
                  <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded capitalize">
                    {c.author.role}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{c.createdAt}</span>
              </div>
              <p className="text-xs text-foreground/90 mt-1 leading-relaxed">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
