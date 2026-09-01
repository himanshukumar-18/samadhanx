import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { Card } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { Building2, Award, HeartHandshake } from 'lucide-react';
import { industryApi } from '../../../api/industry';

interface IndustrySupportItem {
  id: string;
  company_name: string;
  amount_or_terms: string;
  status: 'approved' | 'rejected' | 'pending';
}

export const IndustryDashboard: React.FC = () => {
  const { user } = useAuthStore();

  const { data: dashboard, isLoading: loadingDash } = useQuery({
    queryKey: ['industry-dashboard'],
    queryFn: () => industryApi.getIndustryDashboard(),
  });

  const { data: mySupports, isLoading: loadingSupports } = useQuery({
    queryKey: ['industry-my-supports'],
    queryFn: () => industryApi.listMySupports(),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">Industry Partner & CSR Hub</h1>
            <Badge variant="industry">Corporate Partner</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Welcome, <strong className="text-foreground">{user?.organization_name || user?.full_name || user?.email}</strong>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              {loadingDash ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{dashboard?.supported_projects_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground">Supported Projects</div>
            </div>
          </div>
        </Card>
        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              {loadingDash ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{dashboard?.pending_intents_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground">Active CSR Intents</div>
            </div>
          </div>
        </Card>
        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              {loadingDash ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{dashboard?.total_grants_disbursed ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground">Bounties / Grants Pledged</div>
            </div>
          </div>
        </Card>
      </div>

      {/* List of CSR Supports */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <HeartHandshake className="w-5 h-5 text-amber-500" /> My CSR Support Intents
        </h2>

        {loadingSupports ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : Array.isArray(mySupports) && mySupports.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {mySupports.map((sup: IndustrySupportItem) => (
              <Card key={sup.id} className="p-4 border-border flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-foreground">{sup.company_name}</h3>
                  <p className="text-xs text-muted-foreground">{sup.amount_or_terms}</p>
                </div>
                <Badge variant={sup.status === 'approved' ? 'approved' : 'pending'}>{sup.status}</Badge>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12 border-border">
            <Building2 className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground">Industry Challenge Sponsorship</h3>
            <p className="text-sm text-muted-foreground">
              Sponsor real societal problem bounties and scout top student innovators across Indian universities.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};
