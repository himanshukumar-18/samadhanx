import React, { useState } from 'react';
import { ProblemAuthor } from '../../../types/problem';
import { UserAvatar } from '../../../shared/components/ui/UserAvatar';
import { MapPin, CheckCircle2, MoreHorizontal } from 'lucide-react';

export const PostHeader: React.FC<{
  author: ProblemAuthor;
  createdAt: string;
  location: string;
  isOwner?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
}> = ({ author, createdAt, location, isOwner, onEdit, onDelete, onReport }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* User Avatar Image or Initials Fallback */}
        <a
          href={author.id ? `/profile/user/${author.id}` : '/profile'}
          className="relative inline-block flex-shrink-0 group"
        >
          <div className="p-0.5 rounded-full ring-2 ring-primary/40 group-hover:ring-primary transition-all">
            <UserAvatar src={author.avatar} name={author.name} size="lg" />
          </div>
        </a>

        {/* User Info & Bordered Name Badge */}
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={author.id ? `/profile/user/${author.id}` : '/profile'}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-card hover:bg-muted/70 transition-all text-xs font-extrabold text-foreground hover:text-primary shadow-2xs"
            >
              <span className="truncate max-w-[160px] sm:max-w-[220px]">{author.name}</span>
              {author.verified && <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
            </a>
            <span className="text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full capitalize flex-shrink-0">
              {author.role || 'Contributor'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-0.5 px-1">
            <span className="flex items-center gap-1 font-medium">
              <MapPin className="w-3 h-3 text-rose-500/80 flex-shrink-0" />
              <span className="truncate max-w-[180px]">{location}</span>
            </span>
            <span>•</span>
            <span className="font-medium">{createdAt}</span>
          </div>
        </div>
      </div>

      {/* Action Menu */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setMenuOpen((open) => !open)}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label="More options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-32 bg-card border border-border rounded-xl shadow-xl z-20 py-1 text-xs">
            {isOwner ? (
              <>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (onEdit) onEdit();
                  }}
                  className="block w-full text-left px-3 py-2 font-semibold hover:bg-muted transition-colors"
                >
                  Edit Post
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (onDelete) onDelete();
                  }}
                  className="block w-full text-left px-3 py-2 font-semibold text-destructive hover:bg-muted transition-colors"
                >
                  Delete Post
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  if (onReport) onReport();
                }}
                className="block w-full text-left px-3 py-2 font-semibold text-destructive hover:bg-muted transition-colors"
              >
                Report Issue
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
