import React from 'react';
import { useAuthStore } from '../../../store/authStore';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Badge } from '../../../shared/components/ui/Badge';
import { Search } from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Student Innovation Workspace</h1>
            <Badge variant="student">Innovator</Badge>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Welcome, <strong>{user?.full_name || user?.email}</strong> {user?.organization_name && `• ${user.organization_name}`}
          </p>
        </div>
        <Button leftIcon={<Search className="w-4 h-4" />}>Explore Real-World Problems</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <div className="text-xs font-semibold text-slate-500 uppercase">My Solution Pods</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">0 Active</div>
        </Card>
        <Card>
          <div className="text-xs font-semibold text-slate-500 uppercase">Faculty Mentorship</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">Ready to Connect</div>
        </Card>
        <Card>
          <div className="text-xs font-semibold text-slate-500 uppercase">Industry Hackathon Bounties</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">Available</div>
        </Card>
      </div>
    </div>
  );
};
