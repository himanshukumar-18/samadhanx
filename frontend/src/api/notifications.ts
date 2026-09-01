import { apiClient } from './client';

export interface NotificationItem {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export const notificationsApi = {
  listNotifications: async (limit = 30): Promise<NotificationItem[]> => {
    const res = await apiClient.get('/notifications', { params: { limit } });
    return res.data;
  },

  markAllRead: async () => {
    const res = await apiClient.post('/notifications/read-all');
    return res.data;
  },
};
