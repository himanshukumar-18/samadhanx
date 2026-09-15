import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Button } from '../../../shared/components/ui/Button';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import {
  HeartHandshake, Clock, CheckCircle2, XCircle, AlertCircle, Layers,
  Building2, RotateCcw,
} from 'lucide-react';
import { industryApi, FundingOfferResponse } from '../../../api/industry';

const TABS = ['all', 'pending', 'approved', 'rejected', 'withdrawn'] as const;
type Tab = typeof TABS[number];

const STATUS_STYLES: Record<string, { badge: string; icon: React.FC<{className?: string}> }> = {
  pending:   { badge: 'pending',   icon: Clock },
  approved:  { badge: 'approved',  icon: CheckCircle2 },
  rejected:  { badge: 'rejected',  icon: XCircle },
  withdrawn: { badge: 'default',   icon: RotateCcw },
};

export const MyFundingOffersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const queryClient = useQueryClient();

  const { data: offers = [], isLoading, error } = useQuery({
    queryKey: ['industry-my-offers'],
    queryFn: () => industryApi.listMyOffers(),
  });

  const withdrawMutation = useMutation({
    mutationFn: (offerId: string) => industryApi.withdrawOffer(offerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industry-my-offers'] });
      queryClient.invalidateQueries({ queryKey: ['industry-dashboard-stats'] });
    },
  });

  const filtered = activeTab === 'all' ? offers : offers.filter((o) => o.status === activeTab);
  const counts = TABS.reduce((acc, tab) => {
    acc[tab] = tab === 'all' ? offers.length : offers.filter((o) => o.status === tab).length;
    return acc;
  }, {} as Record<Tab, number>);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <HeartHandshake className="w-7 h-7 text-amber-500" />
          My Funding Offers
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track all the funding offers you have submitted to student innovation pods.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === tab
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {error ? (
        <Card className="text-center py-12 border-destructive/20 bg-destructive/5">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive font-bold">Failed to load your offers.</p>
        </Card>
      ) : isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16 border-border">
          <HeartHandshake className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-foreground">No {activeTab !== 'all' ? activeTab : ''} offers</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {activeTab === 'all'
              ? "You haven't submitted any funding offers yet. Browse vetted pods to get started."
              : `No offers with status '${activeTab}'.`}
          </p>
          {activeTab === 'all' && (
            <Button onClick={() => (window.location.href = '/industry/vetted-projects')} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
              Browse Vetted Pods
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((offer: FundingOfferResponse) => {
            const { badge, icon: StatusIcon } = STATUS_STYLES[offer.status] || { badge: 'outline', icon: Clock };
            return (
              <Card key={offer.id} className="p-5 border-border hover:border-primary/30 transition-all duration-200">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-foreground flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-500" />
                        {offer.company_name}
                      </span>
                      <Badge variant={badge as any} className="capitalize">
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {offer.status}
                      </Badge>
                      <Badge variant="default" className="capitalize text-xs bg-muted text-muted-foreground border border-border">
                        {offer.support_type.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="bg-muted/40 p-3 rounded-xl border border-border/60">
                      <div className="text-xs text-muted-foreground font-medium mb-0.5">Student Pod:</div>
                      <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-primary" />
                        {offer.project_title || 'Solution Pod'}
                      </div>
                      {offer.problem_title && (
                        <div className="text-xs text-muted-foreground mt-1">{offer.problem_title}</div>
                      )}
                      {offer.university_name && (
                        <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">{offer.university_name}</div>
                      )}
                    </div>

                    <div className="text-sm text-foreground/90">
                      <strong className="text-xs text-muted-foreground uppercase tracking-wider block mb-0.5">Offer Terms:</strong>
                      <p className="whitespace-pre-wrap line-clamp-3">{offer.amount_or_terms}</p>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Submitted {new Date(offer.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 md:items-end">
                    {offer.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => (window.location.href = `/industry/funded-projects/${offer.project_id}`)}
                        className="text-xs gap-1 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> View Funded Pod
                      </Button>
                    )}
                    {offer.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => withdrawMutation.mutate(offer.id)}
                        disabled={withdrawMutation.isPending}
                        className="text-xs gap-1 border-destructive/30 hover:bg-destructive/10 text-destructive"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {withdrawMutation.isPending ? 'Withdrawing...' : 'Withdraw'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyFundingOffersPage;
