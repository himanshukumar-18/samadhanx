import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { notificationsApi } from '../../../api/notifications';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import toast from 'react-hot-toast';

export const NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, isError } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.listNotifications(50),
  });

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
      toast.success('All notifications marked as read!');
    },
    onError: () => {
      toast.error('Failed to clear/mark notifications.');
    },
  });

  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((item) => !item.is_read).length
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-4 pb-12">
        <p className="text-sm text-muted-foreground">Loading your notifications inbox…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={Inbox}
        title="Unable to load notifications"
        description="Please check your connection and try again."
      />
    );
  }

  return (
    <div className="space-y-5 pb-12 w-full min-w-0">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" /> Notifications Inbox
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 text-xs font-bold bg-destructive text-white rounded-full">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Activity updates on your submitted challenges, team pods, and mentor approvals.
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => markReadMutation.mutate()}
              isLoading={markReadMutation.isPending}
              leftIcon={<CheckCheck className="w-4 h-4 text-emerald-500" />}
              className="text-xs font-bold min-h-[38px]"
            >
              Clear All / Mark Read
            </Button>
          </div>
        )}
      </div>

      {/* Notifications Listing */}
      {notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((item) => {
            const dateStr = item.created_at
              ? new Date(item.created_at).toLocaleString([], {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : 'Recently';

            return (
              <a
                key={item.id}
                href={item.link || '#'}
                className="block group"
              >
                <Card
                  className={`p-4 transition-all border-border hover:border-primary/50 ${
                    !item.is_read ? 'border-l-4 border-l-primary bg-primary/5 dark:bg-primary/10' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                          {item.title}
                        </h3>
                        {!item.is_read && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.message}</p>
                      <p className="text-[11px] text-muted-foreground pt-1">{dateStr}</p>
                    </div>
                  </div>
                </Card>
              </a>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title="No notifications in your inbox"
          description="Updates about your challenges, team applications, and mentor reviews will appear here."
        />
      )}
    </div>
  );
};
