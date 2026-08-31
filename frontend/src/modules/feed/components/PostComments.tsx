import React, { useState } from 'react';
import { Comment } from '../../../types/problem';
import { Send } from 'lucide-react';
import toast from 'react-hot-toast';

export const PostComments: React.FC<{ comments?: Comment[] }> = ({ comments: initialComments = [] }) => {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [text, setText] = useState('');

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const newComment: Comment = {
      id: `comm-${Date.now()}`,
      author: {
        id: 'usr-current',
        name: 'You (Innovator)',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        role: 'Student Developer',
        location: 'Current Location',
        verified: true,
      },
      content: text,
      createdAt: 'Just now',
      likesCount: 0,
    };

    setComments([newComment, ...comments]);
    setText('');
    toast.success('Comment posted to discussion!');
  };

  return (
    <div className="pt-3 border-t border-border space-y-3">
      {/* Input Box */}
      <form onSubmit={handleAddComment} className="flex gap-2 items-center">
        <img
          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
          alt="Avatar"
          className="w-7 h-7 rounded-full object-cover flex-shrink-0"
        />
        <input
          type="text"
          placeholder="Propose an approach or ask a question..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 bg-muted/60 hover:bg-muted focus:bg-background rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground border border-transparent focus:border-primary focus:outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Comments List */}
      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
        {comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2.5 text-xs bg-muted/40 p-2.5 rounded-lg">
            <img src={c.author.avatar} alt={c.author.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-foreground">{c.author.name}</span>
                  <span className="text-[10px] text-muted-foreground">{c.author.affiliation || c.author.role}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{c.createdAt}</span>
              </div>
              <p className="text-xs text-foreground/90 mt-1 leading-relaxed">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
