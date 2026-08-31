import React from 'react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Badge } from '../../../shared/components/ui/Badge';
import { Users, GraduationCap, Github, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export const TeamDetailPage: React.FC = () => {
  return (
    <div className="space-y-4 pb-12">
      <a href="/" className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Feed
      </a>

      <Card className="p-5 sm:p-6 border-border space-y-4 rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Solution Pod</span>
            <h1 className="text-xl sm:text-2xl font-black text-foreground">Team JalShuddhi</h1>
          </div>
          <Badge variant="approved" className="text-xs">
            Hardware Prototype Alpha
          </Badge>
        </div>

        <p className="text-sm sm:text-base text-foreground/85 leading-relaxed">
          Developing an affordable, gravity-fed biochar adsorption filtration unit for groundwater fluoride removal.
        </p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
          <span className="flex items-center gap-1.5"><GraduationCap className="w-4 h-4 text-purple-500" /> Engineering Mentors</span>
          <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-primary" /> Active Pod</span>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" className="font-semibold text-sm" onClick={() => toast.success('Prototype repository opened')}>
            <Github className="w-4 h-4 mr-1.5" /> Repository
          </Button>
          <Button variant="primary" size="sm" className="font-bold text-sm" onClick={() => toast.success('Application sent to join team!')}>
            Request to Join Team
          </Button>
        </div>
      </Card>
    </div>
  );
};
