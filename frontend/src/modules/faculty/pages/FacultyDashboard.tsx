import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { Card } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { GraduationCap, Award, CheckCircle } from 'lucide-react';
import { facultyApi } from '../../../api/faculty';

export const FacultyDashboard: React.FC = () => {
  const { user } = useAuthStore();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['faculty-dashboard'],
    queryFn: () => facultyApi.getFacultyDashboard(),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">Faculty Academic Mentorship Portal</h1>
            <Badge variant="faculty">Faculty Mentor</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Welcome, <strong className="text-foreground">{user?.full_name || user?.email}</strong> {user?.organization_name && `• ${user.organization_name}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{dashboard?.assigned_projects_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground">Assigned Student Pods</div>
            </div>
          </div>
        </Card>
        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{dashboard?.pending_reviews_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground">Pending Mentorship Reviews</div>
            </div>
          </div>
        </Card>
        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{dashboard?.approved_reviews_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground">Approved Prototypes</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="text-center py-12 border-border">
        <GraduationCap className="w-12 h-12 text-purple-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-foreground">Mentorship Desk Active</h3>
        <p className="text-sm text-muted-foreground">
          Student teams from your university will submit innovation proposals for your review and guidance.
        </p>
      </Card>
    </div>
  );
};
