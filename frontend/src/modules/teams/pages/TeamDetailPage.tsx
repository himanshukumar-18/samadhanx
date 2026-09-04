import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, Rocket, ArrowRight, Plus
} from 'lucide-react';
import { projectsApi } from '../../../api/projects';
import { ProjectWorkspacePage } from '../../student/pages/ProjectWorkspacePage';

export const TeamDetailPage: React.FC = () => {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  const teamId = parts.length > 1 && parts[0] === 'teams' && parts[1] !== 'create' ? parts[1] : null;

  // If specific team/pod ID is in the URL, render that pod's workspace
  if (teamId) {
    return <ProjectWorkspacePage projectId={teamId} />;
  }

  // Otherwise, render platform Innovation Teams directory
  const { data: projects, isLoading } = useQuery({
    queryKey: ['all-teams-directory'],
    queryFn: () => projectsApi.listProjects({ limit: 50 }),
  });

  return (
    <div className="space-y-6 pb-16 w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-primary">
              <Rocket className="w-4 h-4" /> Innovation Hub
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Solution Pods & Innovation Teams
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Explore multidisciplinary student pods tackling real-world civic challenges across colleges and universities.
            </p>
          </div>

          <a
            href="/explore"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Start New Solution Pod
          </a>
        </div>
      </div>

      {/* List of Teams / Pods */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-3xl p-6 h-48 animate-pulse" />
          ))}
        </div>
      ) : !projects || projects.length === 0 ? (
        <div className="bg-card border border-border rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">No Solution Pods Active Yet</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Be the first team to pick a verified problem from the feed and form an innovation pod.
          </p>
          <a
            href="/explore"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 transition-colors mt-2"
          >
            Explore Verified Problems
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((proj: any) => (
            <div
              key={proj.id}
              className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold tracking-wide uppercase text-primary">
                    Team {proj.team_name}
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                    {proj.status.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                  {proj.title}
                </h3>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {proj.description}
                </p>

                {proj.problem_title && (
                  <div className="text-xs text-muted-foreground pt-1 flex items-center gap-1 truncate">
                    <span className="font-semibold text-foreground">Solving:</span> {proj.problem_title}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span>{proj.members?.length || 1} Members</span>
                </div>

                <a
                  href={`/projects/${proj.id}`}
                  className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline"
                >
                  Enter Workspace <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
