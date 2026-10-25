import React, { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { apiClient } from '../../api/client';

export const AIFeedback: React.FC<{ feature: string; entityId: string }> = ({ feature, entityId }) => {
  const [sent, setSent] = useState(false);
  const send = async (rating: 'up' | 'down') => {
    try {
      await apiClient.post('/admin/ai/feedback', { feature, entity_id: entityId, rating });
      setSent(true);
    } catch {
      // Optional feedback must never block a human workflow.
    }
  };
  if (sent) return <span className="text-[10px] text-muted-foreground">Thanks for the feedback</span>;
  return <span className="inline-flex items-center gap-1 text-muted-foreground" aria-label="AI feedback">
    <button type="button" className="p-1 hover:text-primary" onClick={() => send('up')} aria-label="Helpful"><ThumbsUp className="h-3 w-3" /></button>
    <button type="button" className="p-1 hover:text-primary" onClick={() => send('down')} aria-label="Not helpful"><ThumbsDown className="h-3 w-3" /></button>
  </span>;
};
