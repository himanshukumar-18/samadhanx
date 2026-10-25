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
  GitMerge,
  XCircle,
  Eye,
  ArrowRightLeft,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AIAnalysisData } from '../../../api/admin';
import { duplicatesApi, DuplicateLinkResponse } from '../../../api/duplicates';
import { useAIAnalysis } from '../hooks/useAIAnalysis';
import { Badge } from '../../../shared/components/ui/Badge';
import { Button } from '../../../shared/components/ui/Button';
import toast from 'react-hot-toast';


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

  const queryClient = useQueryClient();
  const [isRunningDupCheck, setIsRunningDupCheck] = useState(false);
  const [mergingCandidateId, setMergingCandidateId] = useState<string | null>(null);
  const [dismissingLinkId, setDismissingLinkId] = useState<string | null>(null);
  const [compareCandidate, setCompareCandidate] = useState<DuplicateLinkResponse | null>(null);

  const { data: duplicateLinks = [] } = useQuery({
    queryKey: ['admin-duplicates', problemId],
    queryFn: () => duplicatesApi.getProblemDuplicates(problemId),
    enabled: Boolean(problemId),
  });

  // When there are no saved links, show the nearest candidates (scored but below threshold)
  // by running a lightweight detection in "preview" mode via the same endpoint.
  const { data: nearbyPreview = [] } = useQuery({
    queryKey: ['admin-duplicates-preview', problemId],
    queryFn: () => duplicatesApi.runDuplicateDetection(problemId),
    // Only fetch preview when there are no saved links AND we're not actively scanning
    enabled: Boolean(problemId) && duplicateLinks.length === 0 && !isRunningDupCheck,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: false,
  });


  const handleRunDuplicateCheck = async () => {
    try {
      setIsRunningDupCheck(true);
      const res = await duplicatesApi.runDuplicateDetection(problemId);
      queryClient.setQueryData(['admin-duplicates', problemId], res);
      toast.success(`Duplicate detection completed. Found ${res.length} matches.`);
    } catch {
      toast.error('Failed to run duplicate detection.');
    } finally {
      setIsRunningDupCheck(false);
    }
  };

  const handleMergeProblem = async (targetProblemId: string) => {
    if (!window.confirm('Are you sure you want to merge this problem into the selected canonical report? This action moves all endorsements and marks this report as duplicate.')) {
      return;
    }
    try {
      setMergingCandidateId(targetProblemId);
      const res = await duplicatesApi.mergeProblems(problemId, targetProblemId);
      toast.success(res.message || 'Problem merged successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-duplicates', problemId] });
      queryClient.invalidateQueries({ queryKey: ['admin-problems-moderation'] });
      setCompareCandidate(null);
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message || 'Failed to merge problem.';
      toast.error(msg);
    } finally {
      setMergingCandidateId(null);
    }
  };

  const handleDismissLink = async (linkId: string) => {
    try {
      setDismissingLinkId(linkId);
      await duplicatesApi.dismissDuplicateLink(problemId, linkId);
      toast.success('Dismissed link as not a duplicate.');
      queryClient.invalidateQueries({ queryKey: ['admin-duplicates', problemId] });
      setCompareCandidate(null);
    } catch {
      toast.error('Failed to dismiss duplicate link.');
    } finally {
      setDismissingLinkId(null);
    }
  };

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

      {/* Duplicates & Similar Reports Management Section */}
      <div className="p-3 rounded-xl bg-card border border-border/80 text-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-foreground font-bold text-xs">
            <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
            <span>Duplicate & Similar Problems Detection</span>
            {duplicateLinks.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 border border-border rounded text-muted-foreground font-bold">
                {duplicateLinks.filter((l) => l.status === 'pending').length} pending
              </span>
            )}

          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] px-2 text-primary hover:bg-primary/10"
            disabled={isRunningDupCheck}
            onClick={handleRunDuplicateCheck}
          >
            {isRunningDupCheck ? (
              <>
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3 mr-1" />
                Run Duplicate Check
              </>
            )}
          </Button>
        </div>

        {duplicateLinks.length === 0 ? (
          <div className="space-y-2">
            {nearbyPreview.length === 0 ? (
              <div className="text-[11px] text-muted-foreground italic py-1">
                No potential duplicate links recorded. Click <strong>Run Duplicate Check</strong> to scan.
              </div>
            ) : (
              <>
                <div className="text-[11px] text-muted-foreground font-semibold pb-1 border-b border-border/40">
                  Closest candidates scored (none exceeded the duplicate threshold):
                </div>
                {nearbyPreview.slice(0, 3).map((link) => (
                  <div
                    key={link.id}
                    className="p-2.5 rounded-lg border border-border/60 bg-muted/20 text-xs space-y-1 opacity-80"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground truncate max-w-[260px]">
                        {link.candidate_title || `Problem #${link.candidate_problem_id.slice(0, 8)}`}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-muted text-muted-foreground">
                        {Math.round(link.similarity * 100)}% match
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded uppercase text-[9px] font-extrabold ${
                          link.verdict === 'strong_duplicate'
                            ? 'bg-destructive/15 text-destructive'
                            : link.verdict === 'possible_duplicate'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-blue-500/15 text-blue-500'
                        }`}
                      >
                        {link.verdict.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>📍 {link.candidate_district || 'N/A'}</span>
                      <span>•</span>
                      <span>🏷️ {link.candidate_category}</span>
                    </div>
                    {link.llm_reason && (
                      <p className="text-[10px] text-muted-foreground italic bg-muted/30 p-1.5 rounded">
                        🤖 {link.llm_reason}
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {duplicateLinks.map((link) => {
              const isPending = link.status === 'pending';
              const isConfirmed = link.status === 'confirmed';
              const isDismissed = link.status === 'dismissed';

              return (
                <div
                  key={link.id}
                  className={`p-2.5 rounded-lg border text-xs space-y-1.5 transition-colors ${
                    isConfirmed
                      ? 'bg-purple-500/10 border-purple-500/30'
                      : isDismissed
                      ? 'bg-muted/30 border-border/40 opacity-60'
                      : 'bg-background border-border/80 hover:border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-foreground truncate max-w-[280px]">
                          {link.candidate_title || `Problem #${link.candidate_problem_id.slice(0, 8)}`}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-primary/10 text-primary">
                          {Math.round(link.similarity * 100)}% match
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded uppercase text-[9px] font-extrabold ${
                            link.verdict === 'strong_duplicate'
                              ? 'bg-destructive/15 text-destructive'
                              : link.verdict === 'possible_duplicate'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {link.verdict.replace('_', ' ')}
                        </span>
                        {isConfirmed && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded border border-purple-400 text-purple-600 font-bold">
                            Merged
                          </span>
                        )}
                        {isDismissed && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground font-bold">
                            Dismissed
                          </span>
                        )}
                      </div>


                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span>📍 {link.candidate_district || 'District N/A'}</span>
                        <span>•</span>
                        <span>🏷️ {link.candidate_category}</span>
                        <span>•</span>
                        <span className="capitalize">Status: {link.candidate_status}</span>
                      </div>

                      {link.llm_reason && (
                        <p className="text-[10px] text-muted-foreground italic mt-1 bg-muted/30 p-1.5 rounded">
                          🤖 {link.llm_reason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px] px-1.5"
                        onClick={() => setCompareCandidate(link)}
                        title="Compare Side by Side"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Compare
                      </Button>

                      {isPending && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="h-6 text-[10px] px-2 bg-purple-600 hover:bg-purple-700 text-white"
                            disabled={mergingCandidateId === link.candidate_problem_id}
                            onClick={() => handleMergeProblem(link.candidate_problem_id)}
                          >
                            <GitMerge className="w-3 h-3 mr-1" />
                            {mergingCandidateId === link.candidate_problem_id ? 'Merging...' : 'Merge'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-1 text-muted-foreground hover:text-foreground"
                            disabled={dismissingLinkId === link.id}
                            onClick={() => handleDismissLink(link.id)}
                            title="Not a duplicate"
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Dismiss
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Side-by-Side Comparison Modal */}
      {compareCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Duplicate Problem Comparison</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-primary/10 text-primary">
                  {Math.round(compareCandidate.similarity * 100)}% Semantic Match
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCompareCandidate(null)}
                className="text-muted-foreground hover:text-foreground text-xs font-semibold px-2 py-1 rounded-lg hover:bg-muted"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Current Problem Under Review */}
              <div className="p-3.5 rounded-xl bg-background border border-border space-y-2">
                <div className="text-[10px] font-extrabold uppercase text-primary">Current Problem Under Moderation</div>
                <div className="font-bold text-sm text-foreground">Problem #{problemId.slice(0, 8)}</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div><strong className="text-foreground">Category:</strong> {currentCategory || 'N/A'}</div>
                </div>
              </div>

              {/* Candidate Problem */}
              <div className="p-3.5 rounded-xl bg-background border border-amber-500/30 space-y-2">
                <div className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400">Potential Duplicate Candidate</div>
                <div className="font-bold text-sm text-foreground">{compareCandidate.candidate_title}</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div><strong className="text-foreground">District:</strong> {compareCandidate.candidate_district}</div>
                  <div><strong className="text-foreground">Category:</strong> {compareCandidate.candidate_category}</div>
                  <div><strong className="text-foreground">Status:</strong> <span className="capitalize">{compareCandidate.candidate_status}</span></div>
                </div>
                <a
                  href={`/problems/${compareCandidate.candidate_problem_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold pt-1"
                >
                  Open problem full view <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {compareCandidate.llm_reason && (
              <div className="p-3 bg-muted/40 rounded-xl text-xs space-y-1">
                <span className="font-bold text-foreground">AI Deduplication Analysis:</span>
                <p className="text-muted-foreground leading-relaxed">{compareCandidate.llm_reason}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCompareCandidate(null)}
              >
                Cancel
              </Button>
              {compareCandidate.status === 'pending' && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    disabled={dismissingLinkId === compareCandidate.id}
                    onClick={() => handleDismissLink(compareCandidate.id)}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" />
                    Not a Duplicate
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    disabled={mergingCandidateId === compareCandidate.candidate_problem_id}
                    onClick={() => handleMergeProblem(compareCandidate.candidate_problem_id)}
                  >
                    <GitMerge className="w-3.5 h-3.5 mr-1" />
                    Merge Into Candidate
                  </Button>
                </>
              )}
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
