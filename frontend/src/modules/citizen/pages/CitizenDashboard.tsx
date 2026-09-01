import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Badge } from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { PlusCircle, MapPin, CheckCircle, Clock, AlertTriangle, FileText } from 'lucide-react';
import { problemsApi } from '../../../api/problems';

interface ProblemItem {
  id: string;
  category: string;
  district: string;
  state: string;
  title: string;
  description: string;
  status: string;
}

export const CitizenDashboard: React.FC = () => {
  const { user } = useAuthStore();

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['citizen-dashboard-metrics'],
    queryFn: () => problemsApi.getCitizenDashboard(),
  });

  const { data: myProblems, isLoading: loadingProblems } = useQuery({
    queryKey: ['my-submitted-problems'],
    queryFn: () => problemsApi.getMyProblems(),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">Citizen Collaboration Hub</h1>
            <Badge variant="citizen">Citizen Submitter</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Welcome, <strong className="text-foreground">{user?.full_name || user?.email}</strong>. Report societal problems in your area for university & student innovation.
          </p>
        </div>
        <Button onClick={() => (window.location.href = '/')} leftIcon={<PlusCircle className="w-4 h-4" />}>
          Report New Local Problem
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              {loadingMetrics ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{metrics?.solved_problems_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground">Solved Problems</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              {loadingMetrics ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{metrics?.active_teams_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground">Active Student Pods</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              {loadingMetrics ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{metrics?.pending_review_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground">Pending Moderation</div>
            </div>
          </div>
        </Card>
      </div>

      {/* My Submitted Problems List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-500" /> My Submitted Challenges
        </h2>

        {loadingProblems ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : Array.isArray(myProblems) && myProblems.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {myProblems.map((prob: ProblemItem) => (
              <Card key={prob.id} className="p-4 hover:border-indigo-500/50 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      {prob.category}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-rose-500" /> {prob.district}, {prob.state}
                    </span>
                  </div>
                  <h3 className="font-bold text-foreground text-base">{prob.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-1">{prob.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={prob.status === 'verified' ? 'approved' : 'pending'}>
                    {prob.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12 border-border">
            <MapPin className="w-12 h-12 text-indigo-500 mx-auto mb-3 opacity-60" />
            <h3 className="text-lg font-bold text-foreground">No community issues reported yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Report road hazards, water quality issues, or local municipal challenges to get matched with student innovators.
            </p>
            <Button onClick={() => (window.location.href = '/')} leftIcon={<PlusCircle className="w-4 h-4" />}>
              Submit First Issue
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};
