import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Button } from '../../../shared/components/ui/Button';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import {
  Sparkles, Search, GraduationCap, Users, ExternalLink, ChevronLeft, ChevronRight,
  Filter, Layers, MapPin, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { industryApi, VettedProjectListItem } from '../../../api/industry';

const CATEGORIES = [
  'All', 'Agriculture Tech', 'CleanTech', 'HealthTech', 'EdTech',
  'WaterSanitation', 'Urban Mobility', 'Renewable Energy', 'Waste Management', 'Other',
];

const STATUS_COLORS: Record<string, string> = {
  pilot: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  completed: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
};

export const VettedProjectsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const { data: pods = [], isLoading, error } = useQuery({
    queryKey: ['industry-vetted-projects', category, state, offset],
    queryFn: () => industryApi.listVettedProjects({
      category: category || undefined,
      state: state || undefined,
      offset,
      limit: LIMIT,
    }),
    placeholderData: (prev) => prev,
  });

  const filtered = search
    ? pods.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.problem_title?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (p.university_name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        p.team_name.toLowerCase().includes(search.toLowerCase())
      )
    : pods;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-7 h-7 text-amber-500" />
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Vetted Solution Pods
          </h1>
          <Badge variant="approved" className="ml-1">Faculty Approved</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          All pods displayed here have passed faculty review. Every listing is verified at the database level.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search pods, problems, teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setOffset(0); }}
            className="px-3 py-2 text-sm rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Categories</option>
            {CATEGORIES.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="text"
            placeholder="State (e.g. Maharashtra)"
            value={state}
            onChange={(e) => { setState(e.target.value); setOffset(0); }}
            className="px-3 py-2 text-sm rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 w-44"
          />
        </div>
      </div>

      {/* Content */}
      {error ? (
        <Card className="text-center py-12 border-destructive/20 bg-destructive/5">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive font-bold">Failed to load vetted projects.</p>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16 border-border">
          <Layers className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-foreground">No vetted pods found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {search || category || state
              ? 'No pods match your current filters. Try broadening your search.'
              : 'No faculty-approved pods are available yet. Check back soon.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((pod: VettedProjectListItem) => (
            <Card
              key={pod.id}
              className="p-5 border-border hover:border-amber-500/30 transition-all duration-200 flex flex-col justify-between cursor-pointer"
              onClick={() => (window.location.href = `/industry/vetted-projects/${pod.id}`)}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground line-clamp-1">{pod.title}</h3>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span className="truncate">{pod.team_name}</span>
                      <span className="mx-1">·</span>
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{pod.member_count} member{pod.member_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border capitalize shrink-0 ${STATUS_COLORS[pod.status] || 'text-muted-foreground bg-muted border-border'}`}>
                    {pod.status === 'pilot' ? '🧪 Pilot' : pod.status === 'completed' ? '✅ Completed' : pod.status}
                  </span>
                </div>

                {pod.problem_title && (
                  <div className="text-xs bg-muted/60 p-2.5 rounded-lg border border-border/60">
                    <span className="text-muted-foreground font-semibold">Societal Problem: </span>
                    <span className="text-foreground font-medium line-clamp-2">{pod.problem_title}</span>
                  </div>
                )}

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{pod.description}</p>

                <div className="flex flex-wrap gap-2 text-xs">
                  {pod.problem_category && (
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{pod.problem_category}</span>
                  )}
                  {pod.problem_state && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="w-3 h-3" />{pod.problem_district && `${pod.problem_district}, `}{pod.problem_state}
                    </span>
                  )}
                  {pod.university_name && (
                    <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                      <GraduationCap className="w-3.5 h-3.5" />{pod.university_name}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-border mt-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Faculty Verified
                </div>
                <Button
                  size="sm"
                  className="text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                  onClick={(e) => { e.stopPropagation(); (window.location.href = `/industry/vetted-projects/${pod.id}`); }}
                >
                  View Pod <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && pods.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Showing {offset + 1}–{offset + Math.min(LIMIT, pods.length)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pods.length < LIMIT}
            onClick={() => setOffset(offset + LIMIT)}
            className="gap-1"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default VettedProjectsPage;
