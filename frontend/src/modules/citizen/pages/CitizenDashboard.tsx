import React from 'react';
import { useAuthStore } from '../../../store/authStore';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Badge } from '../../../shared/components/ui/Badge';
import { PlusCircle, MapPin, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export const CitizenDashboard: React.FC = () => {
  const { user } = useAuthStore();

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
        <Button leftIcon={<PlusCircle className="w-4 h-4" />}>Report New Local Problem</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">0</div>
              <div className="text-xs text-muted-foreground">Solved Problems</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">0</div>
              <div className="text-xs text-muted-foreground">Active Student Teams</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">0</div>
              <div className="text-xs text-muted-foreground">Pending Review</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="text-center py-12 border-border">
        <MapPin className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-foreground">No community issues reported yet</h3>
        <p className="text-sm text-muted-foreground mb-4">Report road hazards, water quality issues, or local municipal challenges to get matched with student innovators.</p>
        <Button leftIcon={<PlusCircle className="w-4 h-4" />}>Submit First Issue</Button>
      </Card>
    </div>
  );
};
