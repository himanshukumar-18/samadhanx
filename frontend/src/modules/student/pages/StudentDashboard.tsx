import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Badge } from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { Search, Rocket, Users, Award, ExternalLink } from 'lucide-react';
import { projectsApi } from '../../../api/projects';

interface ProjectItem {
  id: string;
  team_name: string;
  title: string;
  description: string;
  status: string;
  members?: any[];
}

export const StudentDashboard: React.FC = () => {
  const { user } = useAuthStore();

  const { data: dashboardData, isLoading: loadingDash } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => projectsApi.getStudentDashboard(),
  });

  const { data: myProjects, isLoading: loadingProjects } = useQuery({
    queryKey: ['student-projects'],
    queryFn: () => projectsApi.listProjects(),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">Student Innovation Workspace</h1>
            <Badge variant="student">Innovator Pod Lead</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Welcome, <strong className="text-foreground">{user?.full_name || user?.email}</strong> {user?.organization_name && `• ${user.organization_name}`}
          </p>
        </div>
        <Button leftIcon={<Search className="w-4 h-4" />} onClick={() => (window.location.href = '/explore')}>
          Explore Real-World Problems
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="border-border">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">My Solution Pods</div>
          {loadingDash ? (
            <Skeleton className="h-8 w-20 mt-2" />
          ) : (
            <div className="text-2xl font-black text-foreground mt-1">
              {dashboardData?.active_projects_count ?? (Array.isArray(myProjects) ? myProjects.length : 0)} Active
            </div>
          )}
        </Card>
        <Card className="border-border">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Faculty Mentorship</div>
          <div className="text-2xl font-black text-foreground mt-1">Connected</div>
        </Card>
        <Card className="border-border">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Industry Support Grants</div>
          <div className="text-2xl font-black text-foreground mt-1">Eligible</div>
        </Card>
      </div>

      {/* Active Projects Roster */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Rocket className="w-5 h-5 text-indigo-500" /> Active Solution Projects
        </h2>

        {loadingProjects ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : Array.isArray(myProjects) && myProjects.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {myProjects.map((proj: ProjectItem) => (
              <Card key={proj.id} className="p-5 border-border hover:border-indigo-500/50 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full bg-indigo-500/10">
                      Team: {proj.team_name}
                    </span>
                    <Badge variant={proj.status === 'in_progress' ? 'approved' : 'pending'}>
                      {proj.status}
                    </Badge>
                  </div>
                  <h3 className="text-base font-bold text-foreground">{proj.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{proj.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" leftIcon={<Users className="w-3.5 h-3.5" />}>
                    Members ({proj.members?.length || 1})
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12 border-border">
            <Award className="w-12 h-12 text-indigo-500 mx-auto mb-3 opacity-60" />
            <h3 className="text-lg font-bold text-foreground">No active solution projects yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Browse reported societal challenges, assemble a student pod, and claim a problem to solve!
            </p>
            <Button leftIcon={<ExternalLink className="w-4 h-4" />} onClick={() => (window.location.href = '/explore')}>
              Pick Your First Challenge
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};
