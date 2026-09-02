import React, { useState } from 'react';
import { Heart, MessageSquare, Share2, Bookmark, Users, Eye } from 'lucide-react';
import { problemsApi } from '../../../api/problems';
import { socialApi } from '../../../api/social';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { useLanguageStore } from '../../../store/languageStore';
import { getTranslation } from '../../../lib/translations';
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
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const t = (key: string) => getTranslation(language, key);

  const isCitizenRole = !user || (user.role as string) === 'citizen' || (user.role as string) === 'community';

  const queryClient = useQueryClient();
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [isLiking, setIsLiking] = useState(false);

  const handleLike = async () => {
    if (isLiking) return;
    try {
      setIsLiking(true);
      const res = await problemsApi.toggleEndorsement(problemId);
      const nowEndorsed = res.endorsed;
      setLiked(nowEndorsed);
      setLikes((prev) => (nowEndorsed ? prev + 1 : Math.max(0, prev - 1)));
      queryClient.invalidateQueries({ queryKey: ['problems'] });
      queryClient.invalidateQueries({ queryKey: ['problem-detail', problemId] });
      toast(nowEndorsed ? (language === 'hi' ? 'समस्या का समर्थन किया गया!' : 'Endorsed problem severity!') : (language === 'hi' ? 'समर्थन हटाया गया' : 'Removed endorsement'), { icon: '❤️' });
    } catch {
      toast.error(language === 'hi' ? 'समर्थन करने में विफल।' : 'Failed to toggle endorsement.');
    } finally {
      setIsLiking(false);
    }
  };

  const handleSave = async () => {
    try {
      const result = await socialApi.toggleSaveProblem(problemId);
      setSaved(result.saved);
      queryClient.invalidateQueries({ queryKey: ['saved-problems'] });
      queryClient.invalidateQueries({ queryKey: ['problems'] });
      toast.success(result.saved 
        ? (language === 'hi' ? 'सहेजी गई समस्याओं में जोड़ा गया' : 'Saved to your problem library')
        : (language === 'hi' ? 'सहेजी गई समस्याओं से हटाया गया' : 'Removed from saved problems')
      );
    } catch {
      toast.error('Failed to update saved problems.');
    }
  };

  const handleShare = async () => {
    try {
      await socialApi.shareProblem(problemId, 'link');
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    } catch {
      // ignore
    }
    const url = `${window.location.origin}/problems/${problemId}`;
    navigator.clipboard.writeText(url);
    toast.success(language === 'hi' ? 'समस्या लिंक कॉपी किया गया!' : 'Problem link copied to clipboard!');
  };

  return (
    <div className="pt-2 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Like Button */}
        <button
          onClick={handleLike}
          disabled={isLiking}
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
          <span className="hidden sm:inline">{t('share')}</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Action Button: View Details for Citizen vs Join Pod for Solver */}
        {isCitizenRole ? (
          <a
            href={`/problems/${problemId}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted/80 hover:bg-muted text-foreground font-extrabold text-xs sm:text-sm transition-colors min-h-[44px] border border-border"
          >
            <Eye className="w-4 h-4 text-primary" />
            <span>{t('view_details')}</span>
          </a>
        ) : (
          <a
            href={`/problems/${problemId}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs sm:text-sm transition-colors min-h-[44px]"
          >
            <Users className="w-4 h-4" />
            <span>{t('join_pod')}</span>
          </a>
        )}

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
