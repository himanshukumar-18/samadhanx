import React from 'react';
import { ProblemStatus, ImpactLevel } from '../../../types/problem';
import { CheckCircle2, Clock, Users, Rocket, Wrench, ShieldCheck } from 'lucide-react';

export const ProblemStatusBadge: React.FC<{ status: ProblemStatus }> = ({ status }) => {
  const configs: Record<ProblemStatus, { label: string; style: string; icon: React.ReactNode }> = {
    reported: { label: 'Reported', style: 'bg-muted text-muted-foreground border-border', icon: <Clock className="w-3 h-3" /> },
    under_review: { label: 'Under Review', style: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20', icon: <Clock className="w-3 h-3" /> },
    verified: { label: 'Verified Challenge', style: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: <ShieldCheck className="w-3 h-3" /> },
    discussion: { label: 'In Discussion', style: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20', icon: <Users className="w-3 h-3" /> },
    team_forming: { label: 'Team Forming', style: 'bg-primary/10 text-primary border-primary/20', icon: <Users className="w-3 h-3" /> },
    in_progress: { label: 'Active R&D', style: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', icon: <Wrench className="w-3 h-3" /> },
    prototype: { label: 'Prototype Ready', style: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20', icon: <Rocket className="w-3 h-3" /> },
    pilot: { label: 'Live Field Pilot', style: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: <Rocket className="w-3 h-3" /> },
    solved: { label: 'Solved & Deployed', style: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: <CheckCircle2 className="w-3 h-3" /> },
  };

  const item = configs[status] || configs.reported;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${item.style}`}>
      {item.icon}
      <span>{item.label}</span>
    </span>
  );
};

export const ImpactBadge: React.FC<{ impact: ImpactLevel }> = ({ impact }) => {
  const configs: Record<ImpactLevel, { label: string; style: string }> = {
    low: { label: 'Low Impact', style: 'bg-muted text-muted-foreground border border-border' },
    medium: { label: 'Moderate Impact', style: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20' },
    high: { label: 'High Priority', style: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' },
    critical: { label: 'Critical Urgency', style: 'bg-destructive/10 text-destructive border border-destructive/20 font-black' },
  };

  const item = configs[impact] || configs.medium;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${item.style}`}>
      {item.label}
    </span>
  );
};
