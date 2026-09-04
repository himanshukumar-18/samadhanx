import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Badge } from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import {
  FolderGit2,
  Users,
  PlusCircle,
  ExternalLink,
  ArrowRight,
  GitBranch,
  Clock,
} from 'lucide-react';
import { projectsApi } from '../../../api/projects';

export const ProjectsPage: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: myProjects, isLoading } = useQuery({
    queryKey: ['student-my-projects'],
    queryFn: () => projectsApi.listMyProjects(),
  });

  const filtered = Array.isArray(myProjects)
    ? myProjects.filter((p: any) => (filterStatus === 'all' ? true : p.status === filterStatus))
    : [];

  return (
    <div className="space-y-6 pb-12 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
            <FolderGit2 className="w-6 h-6 text-primary" />
            <span>Projects & Solution Pods</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Track your innovation projects, update prototype milestones, and collaborate with your team.
          </p>
        </div>
        <Button
          size="sm"
          leftIcon={<PlusCircle className="w-4 h-4" />}
          onClick={() => (window.location.href = '/explore')}
        >
          Propose Solution Pod
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {['all', 'planning', 'in_progress', 'submitted', 'completed'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap min-h-[36px] ${
              filterStatus === st
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Project Cards List */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((proj: any) => (
            <Card
              key={proj.id}
              className="p-5 border-border hover:border-primary/50 transition-all flex flex-col justify-between gap-4 group cursor-pointer"
              onClick={() => (window.location.href = `/projects/${proj.id}`)}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10">
                      Team: {proj.team_name}
                    </span>
                    <Badge variant={proj.status === 'in_progress' ? 'approved' : 'pending'} className="capitalize">
                      {proj.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(proj.updated_at || proj.created_at).toLocaleDateString()}</span>
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  {proj.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {proj.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span>{proj.members?.length || 1} Pod Members</span>
                  </span>
                  {proj.repository_url && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>Repo Linked</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/problems/${proj.problem_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary hover:underline font-semibold flex items-center gap-1 text-xs"
                  >
                    <span>Linked Problem</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <Button
                    size="sm"
                    className="group-hover:bg-primary group-hover:text-primary-foreground font-bold text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/projects/${proj.id}`;
                    }}
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderGit2}
          title="No Solution Pods Found"
          description="You haven't formed or joined any solution pods matching this filter."
          actionLabel="Explore Challenges to Solve"
          onAction={() => (window.location.href = '/explore')}
        />
      )}
    </div>
  );
};
