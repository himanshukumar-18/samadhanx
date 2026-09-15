import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { Card } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Button } from '../../../shared/components/ui/Button';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import {
  Building2, Award, HeartHandshake, Search, Clock, CheckCircle2,
  XCircle, Sparkles, AlertCircle, TrendingUp, ArrowRight, Layers,
} from 'lucide-react';
import { industryApi } from '../../../api/industry';

export const IndustryDashboard: React.FC = () => {
  const { user } = useAuthStore();

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['industry-dashboard-stats'],
    queryFn: () => industryApi.getDashboardStats(),
    retry: 1,
  });

  if (error) {
    const errCode = (error as any)?.response?.data?.detail?.code || (error as any)?.response?.data?.error?.code;
    if (errCode === 'ACCOUNT_PENDING_APPROVAL') {
      return (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="p-4 rounded-full bg-amber-500/10 w-20 h-20 mx-auto flex items-center justify-center">
            <Clock className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground">Account Pending Approval</h1>
          <p className="text-muted-foreground">
            Your industry partner account is under review by our admin team. You will receive an email notification once
            approved, after which you can access vetted student solution pods and submit funding offers.
          </p>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400 mt-4">
            <strong>What happens next?</strong> An admin will verify your company details and approve your account within
            1–3 business days.
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <p className="text-destructive font-bold">Failed to load dashboard.</p>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Vetted Pods Available',
      value: stats?.vetted_pods_available ?? 0,
      icon: Sparkles,
      color: 'amber',
      action: () => (window.location.href = '/industry/vetted-projects'),
    },
    {
      label: 'Total Offers Sent',
      value: stats?.total_offers ?? 0,
      icon: HeartHandshake,
      color: 'indigo',
      action: () => (window.location.href = '/industry/offers'),
    },
    {
      label: 'Accepted / Funded Pods',
      value: stats?.accepted_offers ?? 0,
      icon: Award,
      color: 'emerald',
      action: () => (window.location.href = '/industry/funded-projects'),
    },
    {
      label: 'Pending Responses',
      value: stats?.pending_offers ?? 0,
      icon: Clock,
      color: 'yellow',
      action: () => (window.location.href = '/industry/offers'),
    },
  ];

  const colorMap: Record<string, string> = {
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    yellow: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-7 h-7 text-amber-500" />
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Industry Partner Dashboard
          </h1>
          <Badge variant="industry" className="ml-1">Corporate Portal</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? (
            <Skeleton className="h-4 w-64" />
          ) : (
            <>Welcome, <strong>{stats?.company_name || user?.full_name || 'Partner'}</strong>
            {stats?.contact_person && ` · ${stats.contact_person}`}</>
          )}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, action }) => (
          <Card
            key={label}
            className="border-border cursor-pointer hover:border-primary/40 transition-all duration-200 group"
            onClick={action}
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${colorMap[color]}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                {isLoading ? (
                  <Skeleton className="h-7 w-12 mb-1" />
                ) : (
                  <div className="text-2xl font-black text-foreground">{value}</div>
                )}
                <div className="text-xs font-medium text-muted-foreground truncate">{label}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="border-border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-foreground">Discover Vetted Solution Pods</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Browse faculty-approved student innovation pods working on real societal problems. 
            Filter by category, state, or impact area and submit a funding offer.
          </p>
          <Button
            onClick={() => (window.location.href = '/industry/vetted-projects')}
            className="bg-amber-600 hover:bg-amber-700 text-white w-full gap-2"
          >
            <Search className="w-4 h-4" /> Browse Vetted Pods
          </Button>
        </Card>

        <Card className="border-border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-500" />
            <h2 className="font-bold text-foreground">My Funded Projects</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Monitor progress of pods you are funding. View Engineering Log updates,
            societal impact reports, and post comments to the team.
          </p>
          <Button
            onClick={() => (window.location.href = '/industry/funded-projects')}
            variant="outline"
            className="w-full gap-2 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <TrendingUp className="w-4 h-4 text-emerald-500" /> View Funded Pods
          </Button>
        </Card>
      </div>

      {/* Offer Status Summary */}
      {!isLoading && (stats?.total_offers ?? 0) > 0 && (
        <Card className="border-border p-5">
          <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-primary" /> Offer Status Summary
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Pending', value: stats?.pending_offers, icon: Clock, cls: 'text-yellow-600 dark:text-yellow-400' },
              { label: 'Accepted', value: stats?.accepted_offers, icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Withdrawn', value: stats?.withdrawn_offers, icon: XCircle, cls: 'text-muted-foreground' },
              { label: 'Total', value: stats?.total_offers, icon: HeartHandshake, cls: 'text-primary' },
            ].map(({ label, value, icon: Icon, cls }) => (
              <div key={label} className="text-center p-3 rounded-xl bg-muted/40">
                <Icon className={`w-5 h-5 mx-auto mb-1 ${cls}`} />
                <div className={`text-xl font-black ${cls}`}>{value ?? 0}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default IndustryDashboard;
