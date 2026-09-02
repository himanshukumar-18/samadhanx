import React from 'react';
import { ProblemStatus, ImpactLevel } from '../../../types/problem';
import { CheckCircle2, Clock, Users, Rocket, Wrench, ShieldCheck } from 'lucide-react';
import { useLanguageStore } from '../../../store/languageStore';

export const ProblemStatusBadge: React.FC<{ status: ProblemStatus }> = ({ status }) => {
  const { language } = useLanguageStore();

  const configs: Record<ProblemStatus, { label: { en: string; hi: string }; style: string; icon: React.ReactNode }> = {
    reported: { label: { en: 'Reported', hi: 'दर्ज की गई' }, style: 'bg-muted text-muted-foreground border-border', icon: <Clock className="w-3 h-3" /> },
    under_review: { label: { en: 'Under Review', hi: 'समीक्षाधीन' }, style: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20', icon: <Clock className="w-3 h-3" /> },
    verified: { label: { en: 'Verified Challenge', hi: 'सत्यापित समस्या' }, style: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: <ShieldCheck className="w-3 h-3" /> },
    discussion: { label: { en: 'In Discussion', hi: 'चर्चा में' }, style: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20', icon: <Users className="w-3 h-3" /> },
    team_forming: { label: { en: 'Team Forming', hi: 'टीम बन रही है' }, style: 'bg-primary/10 text-primary border-primary/20', icon: <Users className="w-3 h-3" /> },
    in_progress: { label: { en: 'Active R&D', hi: 'समाधान सक्रिय' }, style: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', icon: <Wrench className="w-3 h-3" /> },
    prototype: { label: { en: 'Prototype Ready', hi: 'प्रोटोटाइप तैयार' }, style: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20', icon: <Rocket className="w-3 h-3" /> },
    pilot: { label: { en: 'Live Field Pilot', hi: 'फील्ड पायलट' }, style: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: <Rocket className="w-3 h-3" /> },
    solved: { label: { en: 'Solved & Deployed', hi: 'हल किया गया' }, style: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: <CheckCircle2 className="w-3 h-3" /> },
  };

  const item = configs[status] || configs.reported;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${item.style}`}>
      {item.icon}
      <span>{item.label[language] || item.label.en}</span>
    </span>
  );
};

export const ImpactBadge: React.FC<{ impact: ImpactLevel }> = ({ impact }) => {
  const { language } = useLanguageStore();

  const configs: Record<ImpactLevel, { label: { en: string; hi: string }; style: string }> = {
    low: { label: { en: 'Low Impact', hi: 'निम्न प्रभाव' }, style: 'bg-muted text-muted-foreground border border-border' },
    medium: { label: { en: 'Moderate Impact', hi: 'मध्यम प्रभाव' }, style: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20' },
    high: { label: { en: 'High Priority', hi: 'उच्च प्राथमिकता' }, style: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' },
    critical: { label: { en: 'Critical Urgency', hi: 'गंभीर आपातकाल' }, style: 'bg-destructive/10 text-destructive border border-destructive/20 font-black' },
  };

  const item = configs[impact] || configs.medium;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${item.style}`}>
      {item.label[language] || item.label.en}
    </span>
  );
};
