import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Button } from '../../../shared/components/ui/Button';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Copy,
  Check,
  RotateCw,
  X,
  FileText,
  Lightbulb,
  TrendingUp,
} from 'lucide-react';
import { facultyApi, FacultyAIReviewData } from '../../../api/faculty';
import toast from 'react-hot-toast';

interface AIReviewAssistantModalProps {
  projectId: string;
  projectTitle: string;
  teamName: string;
  isOpen: boolean;
  onClose: () => void;
  onApplyFeedback?: (feedbackText: string, suggestedDecision?: 'approved' | 'changes_requested' | 'rejected') => void;
}

export const AIReviewAssistantModal: React.FC<AIReviewAssistantModalProps> = ({
  projectId,
  projectTitle,
  teamName,
  isOpen,
  onClose,
  onApplyFeedback,
}) => {
  const [data, setData] = useState<FacultyAIReviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'feedback'>('overview');

  const fetchAIReview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const review = await facultyApi.getAIReview(projectId);
      setData(review);
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { error?: { message?: string }; detail?: { message?: string } | string; message?: string } };
      };
      const detail = errorObj.response?.data?.detail;
      const msg =
        (typeof detail === 'object' ? detail?.message : detail) ||
        errorObj.response?.data?.error?.message ||
        'Failed to generate AI review analysis.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && projectId) {
      fetchAIReview();
    } else {
      setData(null);
      setError(null);
      setCopied(false);
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleCopyFeedback = () => {
    if (!data) return;
    const text = [
      `AI Evaluation Summary:\n${data.summary}\n`,
      `Suggested Mentorship Feedback:`,
      ...data.suggested_feedback.map((f, i) => `${i + 1}. ${f}`),
      `\nRecommended Next Steps:`,
      ...data.next_steps.map((s, i) => `${i + 1}. ${s}`),
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Feedback copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleApplyToForm = () => {
    if (!data || !onApplyFeedback) return;
    const formatted = data.suggested_feedback.join('\n\n');
    let suggestedDecision: 'approved' | 'changes_requested' | 'rejected' = 'changes_requested';
    if (data.overall_assessment === 'on_track') {
      suggestedDecision = 'approved';
    } else if (data.overall_assessment === 'behind') {
      suggestedDecision = 'changes_requested';
    }

    onApplyFeedback(formatted, suggestedDecision);
    toast.success('Suggested feedback inserted into review draft!');
    onClose();
  };

  const getAssessmentBadge = (assessment: FacultyAIReviewData['overall_assessment']) => {
    switch (assessment) {
      case 'on_track':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold px-2.5 py-1">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> On Track
          </Badge>
        );
      case 'needs_attention':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-bold px-2.5 py-1">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Needs Attention
          </Badge>
        );
      case 'behind':
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold px-2.5 py-1">
            <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Behind Schedule
          </Badge>
        );
      case 'insufficient_data':
      default:
        return (
          <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 font-bold px-2.5 py-1">
            <Clock className="w-3.5 h-3.5 mr-1" /> Insufficient Data
          </Badge>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <Card className="w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border-border bg-card overflow-hidden">
        {/* Header */}
        <CardHeader className="flex flex-row items-start justify-between border-b border-border pb-4 bg-muted/20">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-primary/10 text-primary">
                <Sparkles className="w-5 h-5" />
              </span>
              <CardTitle className="text-lg font-black text-foreground">AI Review Assistant</CardTitle>
              {data && getAssessmentBadge(data.overall_assessment)}
            </div>
            <CardDescription className="text-xs">
              Evidence-based academic assessment for <strong>{projectTitle}</strong> (Team {teamName})
            </CardDescription>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </CardHeader>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {isLoading ? (
            <div className="py-16 text-center space-y-4">
              <div className="inline-block p-4 rounded-full bg-primary/10 text-primary animate-spin">
                <RotateCw className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Analyzing Project Evidence...</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Inspecting civic problem alignment, submitted milestones, repository commits, and testing logs.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="py-12 text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
              <h4 className="text-sm font-bold text-foreground">Could not generate review</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
              <Button size="sm" variant="outline" onClick={fetchAIReview} leftIcon={<RotateCw className="w-3.5 h-3.5" />}>
                Try Again
              </Button>
            </div>
          ) : data ? (
            <>
              {/* Progress & Summary Bar */}
              <div className="p-4 rounded-2xl border border-border bg-muted/30 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span className="flex items-center gap-1.5 text-primary">
                    <TrendingUp className="w-4 h-4" /> Evaluated Progress
                  </span>
                  <span>{data.progress_percentage}% Derived Completion</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, data.progress_percentage)}%` }}
                  />
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed font-medium pt-1">
                  {data.summary}
                </p>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <button
                  type="button"
                  onClick={() => setActiveView('overview')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                    activeView === 'overview'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Work Analysis & Risks
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('feedback')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                    activeView === 'feedback'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Suggested Feedback & Next Steps
                </button>
              </div>

              {activeView === 'overview' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Completed Work */}
                  <div className="p-4 rounded-2xl border border-border bg-card space-y-2.5">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Completed Work ({data.completed_work.length})
                    </h5>
                    {data.completed_work.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No completed milestones recorded.</p>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        {data.completed_work.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-emerald-500 font-bold mt-0.5">•</span>
                            <span className="text-foreground/90">{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Pending Work */}
                  <div className="p-4 rounded-2xl border border-border bg-card space-y-2.5">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> Pending Work ({data.pending_work.length})
                    </h5>
                    {data.pending_work.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No pending items detected.</p>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        {data.pending_work.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-amber-500 font-bold mt-0.5">•</span>
                            <span className="text-foreground/90">{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Strengths */}
                  <div className="p-4 rounded-2xl border border-border bg-card space-y-2.5">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4" /> Strengths ({data.strengths.length})
                    </h5>
                    {data.strengths.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Insufficient evidence to identify strengths.</p>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        {data.strengths.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary font-bold mt-0.5">•</span>
                            <span className="text-foreground/90">{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Potential Issues / Risks */}
                  <div className="p-4 rounded-2xl border border-border bg-card space-y-2.5">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Potential Risks & Issues ({data.risks.length})
                    </h5>
                    {data.risks.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No immediate risks detected.</p>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        {data.risks.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-destructive font-bold mt-0.5">•</span>
                            <span className="text-foreground/90">{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Suggested Feedback */}
                  <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-primary" /> Suggested Faculty Feedback
                      </h5>
                      <span className="text-[11px] text-muted-foreground">Actionable notes for students</span>
                    </div>

                    <div className="space-y-2">
                      {data.suggested_feedback.map((item, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-muted/30 border border-border/60 text-xs text-foreground/90 leading-relaxed flex items-start gap-2.5">
                          <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-black text-[10px] mt-0.5">
                            #{idx + 1}
                          </span>
                          <span className="flex-1">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Next Steps */}
                  <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <ArrowRight className="w-4 h-4 text-primary" /> Recommended Next Engineering Steps
                    </h5>

                    <ul className="space-y-2 text-xs text-muted-foreground">
                      {data.next_steps.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                          <span className="text-foreground/90">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-muted/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyFeedback}
              disabled={!data || isLoading}
              leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copied ? 'Copied' : 'Copy All'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchAIReview}
              disabled={isLoading}
              leftIcon={<RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Re-analyze
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Dismiss
            </Button>
            {onApplyFeedback && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleApplyToForm}
                disabled={!data || isLoading}
                leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              >
                Insert into Review Form
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

