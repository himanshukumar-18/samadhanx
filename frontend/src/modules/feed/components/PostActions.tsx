import React, { useState } from 'react';
import { Heart, MessageSquare, Share2, Bookmark, Users } from 'lucide-react';
import toast from 'react-hot-toast';

interface PostActionsProps {
  problemId: string;
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  onToggleCommentSection?: () => void;
}

export const PostActions: React.FC<PostActionsProps> = ({
  problemId,
  likesCount: initialLikes,
  commentsCount,
  isLiked: initialLiked = false,
  isSaved: initialSaved = false,
  onToggleCommentSection,
}) => {
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);

  const handleLike = () => {
    if (liked) {
      setLikes((prev) => prev - 1);
      setLiked(false);
    } else {
      setLikes((prev) => prev + 1);
      setLiked(true);
      toast('Endorsed problem severity!', { icon: '❤️' });
    }
  };

  const handleSave = () => {
    setSaved(!saved);
    toast.success(saved ? 'Removed from saved challenges' : 'Saved to your challenge library');
  };

  const handleShare = () => {
    const url = `${window.location.origin}/problems/${problemId}`;
    navigator.clipboard.writeText(url);
    toast.success('Challenge link copied to clipboard!');
  };

  return (
    <div className="pt-2 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Like Button */}
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all min-h-[44px] active:scale-95 ${
            liked ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 font-bold' : 'hover:bg-muted hover:text-foreground'
          }`}
          aria-label="Endorse problem"
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-rose-600' : ''}`} />
          <span>{likes}</span>
        </button>

        {/* Comment Button */}
        <button
          onClick={onToggleCommentSection}
          className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted hover:text-foreground transition-colors min-h-[44px]"
          aria-label="View comments"
        >
          <MessageSquare className="w-4 h-4" />
          <span>{commentsCount}</span>
        </button>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted hover:text-foreground transition-colors min-h-[44px]"
          aria-label="Share problem"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Join / Propose Pod Button */}
        <a
          href={`/problems/${problemId}`}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-sm transition-colors min-h-[44px]"
        >
          <Users className="w-4 h-4" />
          <span>Join Pod</span>
        </a>

        {/* Bookmark Button */}
        <button
          onClick={handleSave}
          className={`p-2.5 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
            saved ? 'text-primary bg-primary/10' : 'hover:bg-muted hover:text-foreground'
          }`}
          aria-label="Save problem"
        >
          <Bookmark className={`w-4 h-4 ${saved ? 'fill-primary' : ''}`} />
        </button>
      </div>
    </div>
  );
};
