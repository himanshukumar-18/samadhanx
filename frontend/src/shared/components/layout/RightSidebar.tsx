import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Sparkles, Users, Compass } from 'lucide-react';

export const RightSidebar: React.FC = () => {
  return (
    <aside className="w-full space-y-4 py-2 px-1">
      {/* 1. Community Mission Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 space-y-2.5">
        <div className="flex items-center gap-1.5 text-primary text-xs font-black">
          <Sparkles className="w-4 h-4 text-primary" /> SamadhanX Network
        </div>
        <p className="text-sm text-foreground font-bold leading-snug">
          Real Problems. Right People. Real Solutions.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Connect with innovators, faculty mentors, and community leaders to turn societal challenges into scalable solutions.
        </p>
        <Button variant="primary" size="sm" className="w-full text-xs h-9 rounded-xl font-bold mt-1" onClick={() => (window.location.href = '/explore')}>
          Explore Challenges
        </Button>
      </div>

      {/* 2. Quick Problem Discovery */}
      <Card className="p-4 space-y-3 rounded-2xl">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Compass className="w-4 h-4 text-primary" /> Problem Discovery
          </div>
          <a href="/explore" className="text-xs text-primary hover:underline font-semibold">Browse</a>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Browse verified community issues categorized across water, agriculture, clean energy, and healthcare.
        </p>
      </Card>

      {/* 3. Community Pods */}
      <Card className="p-4 space-y-3 rounded-2xl">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Users className="w-4 h-4 text-emerald-500" /> Solution Pods
          </div>
          <a href="/teams" className="text-xs text-primary hover:underline font-semibold">Join</a>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Collaborate in interdisciplinary teams to build prototypes and scale impactful solutions.
        </p>
      </Card>
    </aside>
  );
};
