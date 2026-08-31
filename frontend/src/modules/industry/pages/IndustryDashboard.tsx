import React from 'react';
import { useAuthStore } from '../../../store/authStore';
import { Card } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Building2 } from 'lucide-react';

export const IndustryDashboard: React.FC = () => {
  const { user } = useAuthStore();

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
      <Card className="text-center py-12 border-border">
        <Building2 className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-foreground">Industry Challenge Sponsorship</h3>
        <p className="text-sm text-muted-foreground">Sponsor real societal problem bounties and scout top student innovators across Indian universities.</p>
      </Card>
    </div>
  );
};
