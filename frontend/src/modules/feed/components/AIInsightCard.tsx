import React from 'react';
import { AIInsight } from '../../../types/problem';
import { Sparkles, Users, Cpu, ArrowRight } from 'lucide-react';

export const AIInsightCard: React.FC<{ insight: AIInsight; problemId: string }> = ({ insight, problemId }) => {
  return (
    <div className="my-3 p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-black text-primary">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>AI Problem Match & Skill Breakdown</span>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
          {(insight.confidenceScore * 100).toFixed(0)}% Match
        </span>
      </div>

      <p className="text-xs text-foreground/90 leading-relaxed">
        {insight.summary}
      </p>

      {/* Required Skills */}
      <div className="space-y-1.5 pt-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Cpu className="w-3 h-3" /> Recommended Skill Pods:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {insight.requiredSkills.map((skill, idx) => (
            <span
              key={idx}
              className="text-[11px] font-semibold bg-card px-2.5 py-0.5 rounded-md border border-border text-foreground shadow-2xs"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2 border-t border-primary/15 flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium text-[11px] flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-primary" /> {insight.matchedPeopleCount} innovators match this challenge
        </span>
        <a
          href={`/problems/${problemId}`}
          className="text-primary font-bold text-xs hover:underline flex items-center gap-0.5"
        >
          Form Team <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
