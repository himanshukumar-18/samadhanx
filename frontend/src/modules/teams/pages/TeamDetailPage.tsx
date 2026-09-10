import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Users, Rocket, ArrowRight, Plus, Sparkles, UserCheck, CheckCircle2, GraduationCap
} from 'lucide-react';
import { projectsApi } from '../../../api/projects';
import { facultyApi } from '../../../api/faculty';
import { useAuthStore } from '../../../store/authStore';
import { ProjectWorkspacePage } from '../../student/pages/ProjectWorkspacePage';
import { Button } from '../../../shared/components/ui/Button';
import toast from 'react-hot-toast';

export const TeamDetailPage: React.FC = () => {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  const teamId = parts.length > 1 && parts[0] === 'teams' && parts[1] !== 'create' ? parts[1] : null;

  // If specific team/pod ID is in the URL, render that pod's workspace
  if (teamId) {
    return <ProjectWorkspacePage projectId={teamId} />;
  }

  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isFaculty = user?.role === 'faculty';

  const [filterTab, setFilterTab] = useState<'all' | 'supervised' | 'needs_mentor'>('all');
  const [adoptingId, setAdoptingId] = useState<string | null>(null);

  // Innovation Teams directory
  const { data: projects, isLoading } = useQuery({
    queryKey: ['all-teams-directory'],
    queryFn: () => projectsApi.listProjects({ limit: 50 }),
  });

  const handleAdopt = async (projectId: string, title: string) => {
    setAdoptingId(projectId);
    try {
      await facultyApi.adoptPod(projectId);
      toast.success(`Adopted "${title}" for academic mentorship!`);
      await queryClient.invalidateQueries({ queryKey: ['all-teams-directory'] });
      await queryClient.invalidateQueries({ queryKey: ['faculty-dashboard'] });
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { error?: { message?: string }; detail?: { message?: string } | string; message?: string } };
      };
      const detail = errorObj.response?.data?.detail;
      const msg =
        (typeof detail === 'object' ? detail?.message : detail) ||
        errorObj.response?.data?.error?.message ||
        'Failed to adopt pod.';
      toast.error(msg);
    } finally {
      setAdoptingId(null);
    }
  };

  const allProjects = projects || [];
  const supervisedProjects = allProjects.filter((p: any) => p.faculty_mentor_id === user?.id);
  const needsMentorProjects = allProjects.filter((p: any) => !p.faculty_mentor_id);

  let displayedProjects = allProjects;
  if (isFaculty) {
    if (filterTab === 'supervised') displayedProjects = supervisedProjects;
    else if (filterTab === 'needs_mentor') displayedProjects = needsMentorProjects;
  }

  return (
    <div className="space-y-6 pb-16 w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-primary">
              <Rocket className="w-4 h-4" /> {isFaculty ? 'Academic Mentorship' : 'Innovation Hub'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              {isFaculty ? 'Supervised Teams & Campus Pods' : 'Solution Pods & Innovation Teams'}
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {isFaculty
                ? 'Supervise student teams, provide academic feedback on prototypes, and discover pods seeking guidance.'
                : 'Explore multidisciplinary student pods tackling real-world civic challenges across colleges and universities.'}
            </p>
          </div>

          {isFaculty ? (
            <a
              href="/mentoring"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/90 transition-colors shrink-0"
            >
              <GraduationCap className="w-4 h-4" /> Faculty Portal
            </a>
          ) : (
            <a
              href="/explore"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/90 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" /> Start New Solution Pod
            </a>
          )}
        </div>
      </div>

      {/* Role-Aware Filter Tabs for Faculty */}
      {isFaculty && (
        <div className="flex border-b border-border text-sm font-bold gap-2">
          <button
            onClick={() => setFilterTab('all')}
            className={`pb-3 px-4 border-b-2 transition-colors flex items-center gap-2 ${
              filterTab === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>All Innovation Pods</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-foreground font-semibold">
              {allProjects.length}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('supervised')}
            className={`pb-3 px-4 border-b-2 transition-colors flex items-center gap-2 ${
              filterTab === 'supervised'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>My Supervised Teams</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-foreground font-semibold">
              {supervisedProjects.length}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('needs_mentor')}
            className={`pb-3 px-4 border-b-2 transition-colors flex items-center gap-2 ${
              filterTab === 'needs_mentor'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Seeking Faculty Mentor</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-semibold">
              {needsMentorProjects.length}
            </span>
          </button>
        </div>
      )}

      {/* List of Teams / Pods */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-3xl p-6 h-48 animate-pulse" />
          ))}
        </div>
      ) : displayedProjects.length === 0 ? (
        <div className="bg-card border border-border rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            {filterTab === 'supervised'
              ? 'No Teams Supervised Yet'
              : filterTab === 'needs_mentor'
              ? 'All Active Pods Have Mentors'
              : 'No Solution Pods Active Yet'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {filterTab === 'supervised'
              ? 'You have not adopted any student pods yet. Switch to "Seeking Faculty Mentor" to discover campus teams.'
              : 'Be the first team to pick a verified problem from the feed and form an innovation pod.'}
          </p>
          {isFaculty && filterTab === 'supervised' ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setFilterTab('needs_mentor')}
              leftIcon={<Users className="w-4 h-4" />}
            >
              Browse Pods Seeking Mentorship ({needsMentorProjects.length})
            </Button>
          ) : (
            <a
              href="/explore"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 transition-colors mt-2"
            >
              Explore Verified Problems
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedProjects.map((proj: any) => {
            const isSupervising = proj.faculty_mentor_id === user?.id;
            const hasNoMentor = !proj.faculty_mentor_id;

            return (
              <div
                key={proj.id}
                className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold tracking-wide uppercase text-primary">
                      Team {proj.team_name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isSupervising && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Mentoring
                        </span>
                      )}
                      {hasNoMentor && isFaculty && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                          Needs Mentor
                        </span>
                      )}
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                        {proj.status.replace('_', ' ')}
                      </span>
                    </div>
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

                <div className="pt-3 border-t border-border flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    <span>{proj.members?.length || 1} Members</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isFaculty && hasNoMentor && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleAdopt(proj.id, proj.title)}
                        isLoading={adoptingId === proj.id}
                        leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                        className="text-xs py-1 px-3"
                      >
                        Adopt
                      </Button>
                    )}
                    <a
                      href={`/projects/${proj.id}`}
                      className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline"
                    >
                      Workspace <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
