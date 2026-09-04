import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Badge } from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import {
  Search,
  Rocket,
  Users,
  Award,
  PlusCircle,
  FolderGit2,
  GraduationCap,
  ArrowRight,
} from 'lucide-react';
import { projectsApi } from '../../../api/projects';

interface ProjectItem {
  id: string;
  problem_id: string;
  team_name: string;
  title: string;
  description: string;
  status: string;
  repository_url?: string | null;
  members?: any[];
  updated_at?: string;
  created_at?: string;
}

export const StudentDashboard: React.FC = () => {
  const { user } = useAuthStore();

  const { data: dashboardData, isLoading: loadingDash } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => projectsApi.getStudentDashboard(),
  });

  const { data: myProjects, isLoading: loadingProjects } = useQuery({
    queryKey: ['student-my-projects'],
    queryFn: () => projectsApi.listMyProjects(),
  });

  return (
    <div className="space-y-6 pb-12 w-full min-w-0">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-foreground">Student Innovation Workspace</h1>
            <Badge variant="student" className="text-[11px] font-bold">Innovator Pod Lead</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Welcome, <strong className="text-foreground">{user?.full_name || user?.email}</strong>{' '}
            {dashboardData?.university_name && (
              <span className="text-xs text-primary font-semibold">
                • {dashboardData.university_name} {dashboardData?.department ? `(${dashboardData.department})` : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Search className="w-4 h-4 text-primary" />}
            onClick={() => (window.location.href = '/explore')}
          >
            Explore Problems
          </Button>
          <Button
            size="sm"
            leftIcon={<PlusCircle className="w-4 h-4" />}
            onClick={() => (window.location.href = '/explore')}
          >
            Propose Solution Pod
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="border-border hover:border-primary/40 transition-all cursor-pointer p-4"
          onClick={() => (window.location.href = '/projects')}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">My Solution Pods</div>
            <FolderGit2 className="w-4 h-4 text-primary" />
          </div>
          {loadingDash || loadingProjects ? (
            <Skeleton className="h-8 w-20 mt-2" />
          ) : (
            <div className="text-2xl font-black text-foreground mt-1 flex items-baseline gap-2">
              <span>{Array.isArray(myProjects) ? myProjects.length : (dashboardData?.active_projects_count || 0)}</span>
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Active</span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">Manage prototypes & milestones →</p>
        </Card>

        <Card
          className="border-border hover:border-purple-500/40 transition-all cursor-pointer p-4"
          onClick={() => (window.location.href = '/teams')}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Faculty Mentorship</div>
            <GraduationCap className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-foreground mt-1 flex items-baseline gap-2">
            <span>Connected</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">University guide reviews & feedback →</p>
        </Card>

        <Card
          className="border-border hover:border-amber-500/40 transition-all cursor-pointer p-4"
          onClick={() => (window.location.href = '/people')}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Innovator Network</div>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground mt-1 flex items-baseline gap-2">
            <span>Find Teammates</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Discover skills & peer innovators →</p>
        </Card>
      </div>

      {/* Active Projects Roster */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" /> Active Solution Projects & Pods
          </h2>
          <Button variant="ghost" size="sm" onClick={() => (window.location.href = '/projects')}>
            View All ({myProjects?.length || 0}) →
          </Button>
        </div>

        {loadingProjects ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        ) : Array.isArray(myProjects) && myProjects.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {myProjects.map((proj: ProjectItem) => (
              <Card
                key={proj.id}
                className="p-5 border-border hover:border-primary/60 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group cursor-pointer"
                onClick={() => (window.location.href = `/projects/${proj.id}`)}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10">
                      Team: {proj.team_name}
                    </span>
                    <Badge variant={proj.status === 'in_progress' ? 'approved' : 'pending'} className="capitalize">
                      {proj.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {proj.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {proj.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mr-2">
                    <Users className="w-3.5 h-3.5" />
                    <span>{proj.members?.length || 1} Members</span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/projects/${proj.id}`;
                    }}
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12 border-border p-6 rounded-2xl">
            <Award className="w-12 h-12 text-primary mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-bold text-foreground">No active solution projects yet</h3>
            <p className="text-xs text-muted-foreground mb-5 max-w-md mx-auto leading-relaxed">
              Discover real-world civic challenges submitted by citizens, assemble a student team, and launch your solution pod!
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button leftIcon={<Search className="w-4 h-4" />} onClick={() => (window.location.href = '/explore')}>
                Pick Your First Challenge
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
