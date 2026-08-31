import React from 'react';
import { useAuthStore } from '../../../store/authStore';
import { Card } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { GraduationCap } from 'lucide-react';

export const FacultyDashboard: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">Faculty Academic Mentorship Portal</h1>
            <Badge variant="faculty">Faculty Mentor</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Welcome, <strong className="text-foreground">{user?.full_name || user?.email}</strong> {user?.organization_name && `• ${user.organization_name}`}
          </p>
        </div>
      </div>
      <Card className="text-center py-12 border-border">
        <GraduationCap className="w-12 h-12 text-purple-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-foreground">Mentorship Desk Active</h3>
        <p className="text-sm text-muted-foreground">Student teams from your university will submit innovation proposals for your review and guidance.</p>
      </Card>
    </div>
  );
};
