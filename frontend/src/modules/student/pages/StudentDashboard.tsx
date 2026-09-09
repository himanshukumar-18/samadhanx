import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import {
  Search,
  Rocket,
  Users,
  FolderGit2,
  GraduationCap,
  PlusCircle,
  ArrowRight,
  CheckCircle2,
  BarChart2,
} from 'lucide-react';
import { podsApi } from '../../../api/pods';
import { projectsApi } from '../../../api/projects';
import { PodCard } from '../components/PodCard';
import { PodCardSkeleton } from '../components/PodCardSkeleton';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuthStore();

  // Dashboard summary (university/department name)
  const { data: dashboardData, isLoading: loadingDash } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => projectsApi.getStudentDashboard(),
    staleTime: 60_000,
  });

  // All pods (used for metrics + recent pods list)
  const { data: pods, isLoading: loadingPods } = useQuery({
    queryKey: ['my-problem-pods'],
    queryFn: () => podsApi.listMyPods(),
    staleTime: 30_000,
  });

  // Derived metrics — all from real backend data
  const metrics = React.useMemo(() => {
    if (!pods) return { active: 0, submitted: 0, completed: 0, total: 0 };
    return {
      active: pods.filter((p) => ['planning', 'in_progress', 'prototype'].includes(p.status)).length,
      submitted: pods.filter((p) => ['review', 'pilot'].includes(p.status)).length,
      completed: pods.filter((p) => p.status === 'completed').length,
      total: pods.length,
    };
  }, [pods]);

  // Show the 3 most recently updated pods on dashboard
  const recentPods = React.useMemo(() => {
    if (!pods) return [];
    return [...pods]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 3);
  }, [pods]);

  const isLoading = loadingDash || loadingPods;

  return (
    <div className="space-y-6 pb-12 w-full min-w-0">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-foreground">Student Innovation Workspace</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Welcome,{' '}
            <strong className="text-foreground">{user?.full_name || user?.email}</strong>
            {dashboardData?.university_name && (
              <span className="text-xs text-primary font-semibold ml-1">
                • {dashboardData.university_name}
                {dashboardData?.department ? ` (${dashboardData.department})` : ''}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/explore"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors min-h-[44px]"
            aria-label="Explore civic problems"
          >
            <Search className="w-4 h-4 text-primary" aria-hidden="true" />
            Explore Problems
          </a>
          <a
            href="/explore"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/90 transition-colors min-h-[44px]"
            aria-label="Start a new solution pod"
          >
            <PlusCircle className="w-4 h-4" aria-hidden="true" />
            New Solution Pod
          </a>
        </div>
      </div>

      {/* ── Metrics Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label="Pod summary metrics">
        <MetricCard
          label="Active Pods"
          value={isLoading ? null : metrics.active}
          sub="Planning + In Progress"
          icon={<Rocket className="w-5 h-5 text-primary" />}
          href="/my-problems"
          accent="text-primary"
        />
        <MetricCard
          label="Submitted"
          value={isLoading ? null : metrics.submitted}
          sub="Awaiting faculty review"
          icon={<BarChart2 className="w-5 h-5 text-purple-500" />}
          href="/my-problems"
          accent="text-purple-500"
        />
        <MetricCard
          label="Completed"
          value={isLoading ? null : metrics.completed}
          sub="Solutions validated"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          href="/my-problems"
          accent="text-emerald-500"
        />
      </div>

      {/* ── Quick action cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <QuickAction
          icon={<Users className="w-5 h-5 text-amber-500" />}
          title="Find Teammates"
          description="Discover engineers, researchers, and designers across verified institutions."
          href="/people"
        />
        <QuickAction
          icon={<GraduationCap className="w-5 h-5 text-purple-500" />}
          title="Faculty Mentorship"
          description="Request a faculty mentor from your university for guidance and review."
          href="/teams"
        />
      </div>

      {/* ── Recent Pods Section ── */}
      <section aria-label="Recent solution pods">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-primary" aria-hidden="true" />
            My Problem Pods
          </h2>
          {pods && pods.length > 0 && (
            <a
              href="/my-problems"
              className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline focus:outline-none focus-visible:underline"
              aria-label={`View all ${pods.length} pods`}
            >
              View All ({pods.length})
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}
        </div>

        {loadingPods ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-live="polite" aria-label="Loading pods">
            <PodCardSkeleton />
            <PodCardSkeleton />
          </div>
        ) : recentPods.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-live="polite">
            {recentPods.map((pod) => (
              <PodCard key={pod.id} pod={pod} currentUserId={user?.id} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-card border border-border rounded-3xl space-y-4 p-6">
            <Rocket className="w-12 h-12 text-primary mx-auto opacity-60" aria-hidden="true" />
            <h3 className="text-base font-bold text-foreground">No active solution pods yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Discover real-world civic challenges submitted by citizens, assemble a student team, and
              launch your first solution pod.
            </p>
            <a
              href="/explore"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/90 transition-colors min-h-[44px]"
              aria-label="Pick your first challenge"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              Pick Your First Challenge
            </a>
          </div>
        )}
      </section>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  sub,
  icon,
  href,
  accent,
}: {
  label: string;
  value: number | null;
  sub: string;
  icon: React.ReactNode;
  href: string;
  accent: string;
}) {
  return (
    <a
      href={href}
      className="bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:shadow-sm transition-all flex flex-col gap-1 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`${label}: ${value ?? 'Loading'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        <span aria-hidden="true">{icon}</span>
      </div>
      {value === null ? (
        <Skeleton className="h-8 w-16 mt-1" />
      ) : (
        <div className={`text-3xl font-black mt-0.5 ${accent}`}>{value}</div>
      )}
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub} →</p>
    </a>
  );
}

function QuickAction({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:shadow-sm transition-all flex items-start gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={title}
    >
      <div className="mt-0.5 shrink-0" aria-hidden="true">{icon}</div>
      <div>
        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors ml-auto shrink-0 mt-0.5" aria-hidden="true" />
    </a>
  );
}
