import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Button } from '../../../shared/components/ui/Button';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import {
  Award, GraduationCap, Layers, AlertCircle, HeartHandshake, ArrowRight, TrendingUp,
} from 'lucide-react';
import { industryApi, FundingOfferResponse } from '../../../api/industry';

export const FundedProjectsPage: React.FC = () => {

  const { data: offers = [], isLoading, error } = useQuery({
    queryKey: ['industry-funded-projects'],
    queryFn: () => industryApi.listFundedProjects(),
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Award className="w-7 h-7 text-emerald-500" />
          My Funded Projects
          <span className="text-sm font-normal text-muted-foreground ml-2">({offers.length} active)</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor progress, view Engineering Logs, read Impact Reports, and post comments on pods you fund.
        </p>
      </div>

      {error ? (
        <Card className="text-center py-12 border-destructive/20 bg-destructive/5">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive font-bold">Failed to load funded projects.</p>
        </Card>
      ) : isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
        </div>
      ) : offers.length === 0 ? (
        <Card className="text-center py-16 border-border">
          <HeartHandshake className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-foreground">No funded pods yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Once a student team accepts your offer, the pod will appear here for monitoring.
          </p>
          <Button onClick={() => (window.location.href = '/industry/vetted-projects')} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
            Browse Vetted Pods
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {offers.map((offer: FundingOfferResponse) => (
            <Card
              key={offer.id}
              className="p-5 border-border hover:border-emerald-500/30 transition-all duration-200 cursor-pointer"
              onClick={() => (window.location.href = `/industry/funded-projects/${offer.project_id}`)}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Layers className="w-5 h-5 text-primary" />
                    <span className="font-bold text-foreground">{offer.project_title || 'Solution Pod'}</span>
                    <Badge variant="approved">Funded</Badge>
                  </div>
                  {offer.problem_title && (
                    <div className="text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg">
                      <span className="font-semibold">Problem: </span>{offer.problem_title}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {offer.university_name && (
                      <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                        <GraduationCap className="w-3.5 h-3.5" /> {offer.university_name}
                      </span>
                    )}
                    <span className="capitalize">{offer.support_type.replace('_', ' ')}</span>
                    <span>Since {new Date(offer.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700"
                    onClick={(e) => { e.stopPropagation(); (window.location.href = `/industry/funded-projects/${offer.project_id}`); }}
                  >
                    Monitor Pod <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FundedProjectsPage;
