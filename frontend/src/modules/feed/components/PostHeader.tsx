import React from 'react';
import { ProblemAuthor } from '../../../types/problem';
import { MapPin, CheckCircle2, MoreHorizontal } from 'lucide-react';

export const PostHeader: React.FC<{
  author: ProblemAuthor;
  createdAt: string;
  location: string;
}> = ({ author, createdAt, location }) => {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <a href={`/people/${author.id}`}>
          <img
            src={author.avatar}
            alt={author.name}
            className="w-10 h-10 rounded-full object-cover border border-border shadow-xs flex-shrink-0"
          />
        </a>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <a href={`/people/${author.id}`} className="text-xs font-bold text-foreground hover:underline truncate">
              {author.name}
            </a>
            {author.verified && <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
            <span className="text-[11px] text-muted-foreground">•</span>
            <span className="text-[11px] text-muted-foreground truncate">{author.role}</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-muted-foreground/80" />
              <span>{location}</span>
            </span>
            <span>•</span>
            <span>{createdAt}</span>
          </div>
        </div>
      </div>

      <button className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
        <MoreHorizontal className="w-4 h-4" />
      </button>
    </div>
  );
};
