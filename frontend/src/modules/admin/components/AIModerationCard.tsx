import React, { useState } from 'react';
import {
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Tag,
  HelpCircle,
  FileText,
  Clock,
  Cpu,
  Info,
  ExternalLink,
  Check,
  ChevronDown,
} from 'lucide-react';
import { AIAnalysisData } from '../../../api/admin';
import { useAIAnalysis } from '../hooks/useAIAnalysis';
import { Badge } from '../../../shared/components/ui/Badge';
import { Button } from '../../../shared/components/ui/Button';

interface AIModerationCardProps {
  problemId: string;
  currentCategory?: string;
  onCategoryAccepted?: (category: string) => void;
  initialAnalysis?: AIAnalysisData | null;
  onAnalysisUpdated?: (updated: AIAnalysisData) => void;
}

const CANONICAL_CATEGORIES = [
  'Water & Sanitation',
  'Clean Energy & Solar',
  'Waste Management',
  'Agriculture & Rural Tech',
  'Healthcare & Medical Devices',
  'Education & Skill Development',
  'Smart Infrastructure & Roads',
  'Disaster Management & Safety',
  'Public Safety',
  'Digital Services',
  'Environment',
  'Housing',
  'Employment',
  'Women & Child Welfare',
  'Senior Citizens',
  'Other',
];

export const AIModerationCard: React.FC<AIModerationCardProps> = ({
  problemId,
  currentCategory,
  onCategoryAccepted,
  initialAnalysis,
  onAnalysisUpdated,
}) => {
  const {
    analysis,
    isLoading,
    isGenerating,
    error,
    generate,
    regenerate,
  } = useAIAnalysis({
    problemId,
    initialAnalysis,
    onAnalysisUpdated,
  });

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [acceptedCategory, setAcceptedCategory] = useState<string | null>(null);

  const handleAcceptCategory = (category: string) => {
    setAcceptedCategory(category);
    if (onCategoryAccepted) {
      onCategoryAccepted(category);
    }
  };

  // State 1: Initial loading (fetching cached record)
  if (isLoading) {
    return (
      <div className="mt-3 p-3.5 rounded-xl border border-border/60 bg-muted/30 text-xs flex items-center justify-between animate-pulse">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="w-4 h-4 text-primary animate-spin" />
          <span className="font-medium text-[11px]">Checking AI moderation records...</span>
        </div>
      </div>
    );
  }

  // State 2: Generating in-flight (synchronous execution)
  if (isGenerating) {
    return (
      <div className="mt-3 p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-950/20 text-xs space-y-2.5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>AI Moderation Assistant Analyzing...</span>
          </div>
          <Badge variant="student">Running Pipeline</Badge>
        </div>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          The LangGraph AI engine is validating category taxonomy, sanitizing content, scoring spam heuristics, and checking policy compliance.
        </p>
      </div>
    );
  }

  // State 3: Active Error during user action or failed persisted analysis
  const isFailedAnalysis = analysis?.status === 'failed';
  const effectiveError = error || (isFailedAnalysis ? {
    code: analysis?.error_code || 'AI_ANALYSIS_FAILED',
    message: analysis?.error_message || 'AI analysis could not be completed. Please verify AI provider configuration and retry.',
  } : null);

  if (effectiveError) {
    return (
      <div className="mt-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 dark:bg-destructive/10 text-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive font-bold">
            <AlertTriangle className="w-4 h-4" />
            <span>AI Analysis Notice ({effectiveError.code})</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generate(true)}
            disabled={isGenerating}
            className="h-7 text-[11px] border-destructive/30 hover:bg-destructive/10"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </div>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          {effectiveError.message}
        </p>
      </div>
    );
  }

  // State 4: Not yet generated (latest === null or status === 'not_started')
  if (!analysis || analysis.status === 'not_started') {
    return (
      <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl border border-border/80 bg-muted/25 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-medium text-[11px]">AI Moderation insights ready to evaluate.</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => generate(true)}
          disabled={isGenerating}
          className="h-7 text-[11px] font-semibold hover:bg-primary/10 hover:border-primary/40 transition-colors"
        >
          <Sparkles className="w-3 h-3 mr-1.5 text-primary" />
          Generate AI Insight
        </Button>
      </div>
    );
  }

  // State 5: Completed result view
  const spamProb = Math.round((analysis.spam_probability ?? 0) * 100);
  const confidenceScore = Math.round((analysis.confidence ?? 0) * 100);
  const qualityScore = Math.round((analysis.quality_score ?? 0) * 100);
  const isLowConfidence = confidenceScore < 70;
  const isSpamFlagged = spamProb >= 70;
  const hasRiskFlags = Boolean(analysis.risk_flags && analysis.risk_flags.length > 0);
  const suggestedCategory = analysis.category || 'Other';
  const isCategoryDifferent = currentCategory && currentCategory !== suggestedCategory;
  const duplicateSignal = analysis.duplicate_signal;
  const hasSimilarProblems = Boolean(
    duplicateSignal?.potential_duplicate && duplicateSignal.similar_problem_ids?.length
  );

  const getRecommendationBadge = (rec?: string | null) => {
    switch (rec) {
      case 'normal_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" /> Normal Admin Review
          </span>
        );
      case 'spam_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-[11px]">
            <ShieldAlert className="w-3.5 h-3.5" /> Likely Spam / Advertisement
          </span>
        );
      case 'high_risk_escalation':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-600/20 text-red-600 dark:text-red-400 font-bold text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5" /> High-Risk Escalation
          </span>
        );
      case 'human_review_required':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold text-[11px]">
            <HelpCircle className="w-3.5 h-3.5" /> Deep Human Review Required
          </span>
        );
    }
  };

  return (
    <div className="mt-3 p-4 rounded-2xl border border-primary/20 bg-primary/5 dark:bg-primary/5 space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-primary/10 text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-foreground text-xs tracking-tight">AI Moderation Insight</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">Advisory Signal</span>
              {analysis.provider && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-mono inline-flex items-center gap-1">
                  <Cpu className="w-2.5 h-2.5" />
                  {analysis.provider.toUpperCase()} ({analysis.model_name || 'default'})
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">Run #{analysis.analysis_version}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={regenerate}
            disabled={isGenerating}
            className="h-6 px-2 text-[10px]"
            title="Re-run AI Analysis"
          >
            <RefreshCw className={`w-2.5 h-2.5 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        </div>
      </div>

      {/* Low Confidence Warning Banner */}
      {isLowConfidence && (
        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-[11px] font-medium">
            <strong>Low Confidence Signal ({confidenceScore}%):</strong> AI suggestion is uncertain. Please manually verify the details.
          </span>
        </div>
      )}

      {/* Factual Summary */}
      {analysis.summary && (
        <div className="p-2.5 rounded-xl bg-card border border-border/80 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
            <FileText className="w-3 h-3 text-primary" />
            <span>Factual Summary:</span>
          </div>
          <p className="text-foreground text-[11px] leading-relaxed italic">
            "{analysis.summary}"
          </p>
        </div>
      )}

      {/* Suggested Category with Actions */}
      <div className="p-2.5 rounded-xl bg-card border border-border/80 text-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground font-semibold text-[11px]">Suggested Category:</span>
            <Badge variant="default" className="text-[11px] font-bold">
              {suggestedCategory}
            </Badge>
            {analysis.subcategory && (
              <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium text-[11px]">
                ↳ {analysis.subcategory}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground font-semibold">
              Confidence: {confidenceScore}%
            </span>
          </div>

          {/* Accept / Override Actions */}
          <div className="flex items-center gap-1.5 relative">
            {acceptedCategory === suggestedCategory ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-1 rounded bg-emerald-500/10">
                <Check className="w-3 h-3" /> Category Accepted
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAcceptCategory(suggestedCategory)}
                className="h-6 px-2 text-[10px] font-semibold hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30"
              >
                <Check className="w-2.5 h-2.5 mr-1 text-emerald-600" />
                Accept Category
              </Button>
            )}

            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                className="h-6 px-2 text-[10px]"
              >
                Change Category <ChevronDown className="w-2.5 h-2.5 ml-1" />
              </Button>

              {categoryDropdownOpen && (
                <div className="absolute right-0 mt-1 w-48 max-h-48 overflow-y-auto bg-card border border-border rounded-xl shadow-lg z-50 p-1 text-[11px]">
                  {CANONICAL_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        handleAcceptCategory(cat);
                        setCategoryDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1 rounded hover:bg-primary/10 transition-colors ${
                        cat === suggestedCategory ? 'font-bold text-primary' : 'text-foreground'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {isCategoryDifferent && !acceptedCategory && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            Current submission is tagged as <strong>"{currentCategory}"</strong>. AI suggests <strong>"{suggestedCategory}"</strong>.
          </p>
        )}
      </div>

      {/* Key Metrics Grid & Quality Check */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className={`p-2 rounded-xl bg-card border ${isSpamFlagged ? 'border-destructive/50 bg-destructive/5' : 'border-border/80'}`}>
          <span className="text-[10px] text-muted-foreground block font-semibold uppercase">Spam Probability</span>
          <span className={`text-sm font-black ${
            spamProb > 50 ? 'text-destructive' : spamProb > 20 ? 'text-amber-500' : 'text-emerald-500'
          }`}>
            {spamProb}%
          </span>
          <span className="text-[9px] text-muted-foreground block mt-0.5">
            {spamProb < 30 ? '✅ Looks genuine' : '⚠️ Potential spam'}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-card border border-border/80">
          <span className="text-[10px] text-muted-foreground block font-semibold uppercase">Confidence</span>
          <span className={`text-sm font-black ${
            confidenceScore >= 75 ? 'text-emerald-500' : 'text-amber-500'
          }`}>
            {confidenceScore}%
          </span>
          <span className="text-[9px] text-muted-foreground block mt-0.5">
            {confidenceScore >= 75 ? 'Strong alignment' : 'Review needed'}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-card border border-border/80">
          <span className="text-[10px] text-muted-foreground block font-semibold uppercase">Clarity Score</span>
          <span className="text-sm font-black text-foreground">
            {qualityScore}%
          </span>
          <span className="text-[9px] text-muted-foreground block mt-0.5">
            {qualityScore >= 70 ? 'Detailed problem' : 'Sparse detail'}
          </span>
        </div>
      </div>

      {/* Discovery Keywords */}
      {analysis.keywords && analysis.keywords.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
          <Tag className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          {analysis.keywords.map((kw, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground text-[10px] font-medium">
              #{kw}
            </span>
          ))}
        </div>
      )}

      {/* Risk / Policy Flags */}
      {hasRiskFlags && (
        <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-destructive font-bold text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Policy Flags Identified:</span>
          </div>
          <div className="space-y-1">
            {analysis.risk_flags!.map((flag, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-[11px] text-foreground">
                <span className={`px-1.5 py-0.2 rounded uppercase text-[9px] font-extrabold ${
                  flag.severity === 'critical' || flag.severity === 'high'
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                }`}>
                  {flag.type} ({flag.severity})
                </span>
                <span className="text-muted-foreground text-[10px]">{flag.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Similar Problems Found Section (if duplicate signal present) */}
      {hasSimilarProblems && (
        <div className="p-2.5 rounded-xl bg-card border border-border/80 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-primary font-bold text-[11px]">
            <ExternalLink className="w-3 h-3" />
            <span>Similar Problem(s) Detected ({Math.round((duplicateSignal?.similarity_score ?? 0) * 100)}% match):</span>
          </div>
          <div className="space-y-1 text-[11px] text-muted-foreground">
            {duplicateSignal?.rationale && <p className="italic">{duplicateSignal.rationale}</p>}
            <div className="flex flex-wrap gap-1.5">
              {duplicateSignal?.similar_problem_ids.map((id) => (
                <a
                  key={id}
                  href={`/problems/${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-primary font-mono text-[10px] inline-flex items-center gap-1"
                >
                  {id.slice(0, 8)}... <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recommendation & Reason Banner */}
      <div className="p-2.5 rounded-xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="text-[10px] text-muted-foreground font-semibold uppercase">AI Recommendation:</div>
          <div>{getRecommendationBadge(analysis.recommendation)}</div>
          {analysis.reason && (
            <p className="text-[10px] text-muted-foreground mt-1 max-w-xl">
              {analysis.reason}
            </p>
          )}
        </div>

        {analysis.completed_at && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground self-end sm:self-center flex-shrink-0">
            <Clock className="w-3 h-3" />
            <span>{new Date(analysis.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>

      {/* Advisory Notice */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 italic">
        <Info className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
        <span>Advisory only: Human Administrator retains sole authority to approve, reject, or escalate submissions.</span>
      </div>
    </div>
  );
};
