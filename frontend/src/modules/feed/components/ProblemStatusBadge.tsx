import React from 'react';
import { ProblemStatus, ImpactLevel } from '../../../types/problem';
import { CheckCircle2, Clock, Users, Rocket, Wrench, ShieldCheck } from 'lucide-react';

export const ProblemStatusBadge: React.FC<{ status: ProblemStatus }> = ({ status }) => {
  const configs: Record<ProblemStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    reported: { label: 'Reported', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', icon: <Clock className="w-3 h-3" /> },
    under_review: { label: 'Under Review', bg: 'bg-yellow-100 dark:bg-yellow-950/60', text: 'text-yellow-800 dark:text-yellow-300', icon: <Clock className="w-3 h-3 text-yellow-600" /> },
    verified: { label: 'Verified Challenge', bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-800 dark:text-emerald-300', icon: <ShieldCheck className="w-3 h-3 text-emerald-600" /> },
    discussion: { label: 'In Discussion', bg: 'bg-blue-100 dark:bg-blue-950/60', text: 'text-blue-800 dark:text-blue-300', icon: <Users className="w-3 h-3 text-blue-600" /> },
    team_forming: { label: 'Team Forming', bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-800 dark:text-indigo-300', icon: <Users className="w-3 h-3 text-indigo-600" /> },
    in_progress: { label: 'Active R&D', bg: 'bg-purple-100 dark:bg-purple-950/60', text: 'text-purple-800 dark:text-purple-300', icon: <Wrench className="w-3 h-3 text-purple-600" /> },
    prototype: { label: 'Prototype Ready', bg: 'bg-teal-100 dark:bg-teal-950/60', text: 'text-teal-800 dark:text-teal-300', icon: <Rocket className="w-3 h-3 text-teal-600" /> },
    pilot: { label: 'Live Field Pilot', bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-800 dark:text-amber-300', icon: <Rocket className="w-3 h-3 text-amber-600" /> },
    solved: { label: 'Solved & Deployed', bg: 'bg-green-100 dark:bg-green-950/60', text: 'text-green-800 dark:text-green-300', icon: <CheckCircle2 className="w-3 h-3 text-green-600" /> },
  };

  const item = configs[status] || configs.reported;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-current/15 ${item.bg} ${item.text}`}>
      {item.icon}
      <span>{item.label}</span>
    </span>
  );
};

export const ImpactBadge: React.FC<{ impact: ImpactLevel }> = ({ impact }) => {
  const configs: Record<ImpactLevel, { label: string; style: string }> = {
    low: { label: 'Low Impact', style: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
    medium: { label: 'Moderate Impact', style: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' },
    high: { label: 'High Priority', style: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' },
    critical: { label: 'Critical Urgency', style: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-black' },
  };

  const item = configs[impact] || configs.medium;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${item.style}`}>
      {item.label}
    </span>
  );
};
