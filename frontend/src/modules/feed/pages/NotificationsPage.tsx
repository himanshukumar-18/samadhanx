import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Inbox } from 'lucide-react';
import { notificationsApi } from '../../../api/notifications';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { EmptyState } from '../../../shared/components/ui/EmptyState';

export const NotificationsPage: React.FC = () => {
  const client = useQueryClient();
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['notifications'], queryFn: () => notificationsApi.listNotifications(50) });
  const markRead = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: () => { client.invalidateQueries({ queryKey: ['notifications'] }); client.invalidateQueries({ queryKey: ['unread-notifications-count'] }); } });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading notifications…</p>;
  if (isError) return <EmptyState icon={Inbox} title="Unable to load notifications" description="Please try again." />;
  return <div className="space-y-4 pb-12">
    <div className="flex justify-between items-center"><h1 className="text-lg font-black flex gap-2 items-center"><Bell className="w-5 h-5 text-primary" /> Notifications</h1><Button size="sm" variant="outline" onClick={() => markRead.mutate()} isLoading={markRead.isPending}>Mark all read</Button></div>
    {data.length ? data.map((item) => <a key={item.id} href={item.link || '#'} className="block"><Card className={`p-4 ${item.is_read ? '' : 'border-primary/40 bg-primary/5'}`}><p className="font-bold text-sm">{item.title}</p><p className="text-sm text-muted-foreground mt-1">{item.message}</p><p className="text-xs text-muted-foreground mt-2">{new Date(item.created_at).toLocaleString()}</p></Card></a>) : <EmptyState icon={Bell} title="No notifications yet" description="Updates about your challenges and collaborations will appear here." />}
  </div>;
};
