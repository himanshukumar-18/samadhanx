import { apiClient } from './client';

export interface ChatMessageItem {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  media_url?: string | null;
  is_accepted: boolean;
  is_read: boolean;
  created_at: string;
  sender_name?: string | null;
  recipient_name?: string | null;
}

export const chatApi = {
  sendMessage: async (recipientInput: { recipient_id?: string; recipient_email?: string }, content: string, mediaUrl?: string) => {
    const res = await apiClient.post('/chat/send', {
      recipient_id: recipientInput.recipient_id,
      recipient_email: recipientInput.recipient_email,
      content,
      media_url: mediaUrl,
    });
    return res.data;
  },

  listThread: async (otherUserId: string, limit = 50): Promise<ChatMessageItem[]> => {
    const res = await apiClient.get(`/chat/thread/${otherUserId}`, { params: { limit } });
    return res.data;
  },

  listMessageRequests: async (): Promise<ChatMessageItem[]> => {
    const res = await apiClient.get('/chat/requests');
    return res.data;
  },

  acceptMessageRequest: async (messageId: string) => {
    const res = await apiClient.post(`/chat/requests/${messageId}/accept`);
    return res.data;
  },
};
