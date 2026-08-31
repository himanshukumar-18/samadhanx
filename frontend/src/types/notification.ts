export interface NotificationItem {
  id: string;
  type: 'comment' | 'match' | 'team_invite' | 'verification' | 'partner_join' | 'milestone' | 'system';
  category: 'problems' | 'teams' | 'projects' | 'system';
  title: string;
  message: string;
  timeAgo: string;
  read: boolean;
  link?: string;
}
