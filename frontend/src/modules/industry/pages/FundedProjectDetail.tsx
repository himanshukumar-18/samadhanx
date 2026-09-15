import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import {
  ChevronLeft, BookOpen, BarChart2, MessageCircle, AlertCircle,
  CheckCircle2, Send, Building2, Clock,
} from 'lucide-react';
import { industryApi } from '../../../api/industry';

type Tab = 'updates' | 'impact' | 'comments';

export const FundedProjectDetail: React.FC = () => {
  const podId = window.location.pathname.replace('/industry/funded-projects/', '').split('/')[0] || undefined;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('updates');
  const [comment, setComment] = useState('');

  const updatesQ = useQuery({
    queryKey: ['funder-pod-updates', podId],
    queryFn: () => industryApi.getPodUpdatesAsFunder(podId!),
    enabled: !!podId && activeTab === 'updates',
  });

  const impactQ = useQuery({
    queryKey: ['funder-impact-report', podId],
    queryFn: () => industryApi.getImpactReportAsFunder(podId!),
    enabled: !!podId && activeTab === 'impact',
    retry: 0,
  });

  const commentsQ = useQuery({
    queryKey: ['funder-pod-comments', podId],
    queryFn: () => industryApi.listPodComments(podId!),
    enabled: !!podId && (activeTab === 'comments'),
  });

  const addCommentMutation = useMutation({
    mutationFn: (text: string) => industryApi.addPodComment(podId!, text),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['funder-pod-comments', podId] });
    },
  });

  const tabs: { key: Tab; label: string; icon: React.FC<{className?: string}> }[] = [
    { key: 'updates', label: 'Engineering Log', icon: BookOpen },
    { key: 'impact', label: 'Impact Report', icon: BarChart2 },
    { key: 'comments', label: 'Comments', icon: MessageCircle },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <button
        onClick={() => (window.history.back())}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Funded Projects
      </button>

      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-black text-foreground">Funded Pod Monitor</h1>
        <p className="text-xs text-muted-foreground mt-1">Full access granted as a funding partner.</p>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Updates Tab */}
      {activeTab === 'updates' && (
        <div className="space-y-4">
          {updatesQ.isLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : updatesQ.error ? (
            <Card className="text-center py-8 border-destructive/20 bg-destructive/5">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
              <p className="text-destructive font-bold text-sm">Failed to load engineering log.</p>
            </Card>
          ) : (updatesQ.data ?? []).length === 0 ? (
            <Card className="text-center py-12 border-border">
              <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-bold text-foreground">No engineering updates yet</p>
              <p className="text-sm text-muted-foreground mt-1">The team hasn't posted any milestone updates yet.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {(updatesQ.data ?? []).map((u: any) => (
                <Card key={u.id} className="p-5 border-border">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <BookOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      {u.milestone && <div className="font-bold text-foreground text-sm mb-1">{u.milestone}</div>}
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{u.content}</p>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(u.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Impact Tab */}
      {activeTab === 'impact' && (
        <div>
          {impactQ.isLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : impactQ.error ? (
            <Card className="text-center py-12 border-border">
              <BarChart2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-bold text-foreground">No Impact Report Yet</p>
              <p className="text-sm text-muted-foreground mt-1">The team hasn't submitted a societal impact report yet.</p>
            </Card>
          ) : impactQ.data ? (
            <Card className="p-6 border-border space-y-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-emerald-500" />
                <h2 className="font-bold text-foreground">Societal Impact Report</h2>
                {impactQ.data.is_verified && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold ml-auto">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-muted/40 p-4 rounded-xl text-center border border-border">
                  <div className="text-3xl font-black text-primary">{impactQ.data.beneficiaries_reached?.toLocaleString() ?? '—'}</div>
                  <div className="text-xs text-muted-foreground mt-1">Beneficiaries Reached</div>
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Outcome Description</div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{impactQ.data.outcome_description}</p>
              </div>
              {impactQ.data.proof_image_urls?.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Evidence</div>
                  <div className="flex flex-wrap gap-2">
                    {impactQ.data.proof_image_urls.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline">
                        View Proof {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ) : null}
        </div>
      )}

      {/* Comments Tab */}
      {activeTab === 'comments' && (
        <div className="space-y-4">
          {/* New Comment */}
          <Card className="p-4 border-border">
            <div className="flex gap-3">
              <div className="p-2 rounded-full bg-amber-500/10 shrink-0 h-9 w-9 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1 space-y-2">
                <textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Post a comment or progress note to the team..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{comment.length}/500</span>
                  <Button
                    size="sm"
                    onClick={() => { if (comment.trim()) addCommentMutation.mutate(comment.trim()); }}
                    disabled={!comment.trim() || addCommentMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {addCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Comments List */}
          {commentsQ.isLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : (commentsQ.data ?? []).length === 0 ? (
            <Card className="text-center py-10 border-border">
              <MessageCircle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No comments yet. Be the first to post a note.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {(commentsQ.data ?? []).map((c: any) => (
                <Card key={c.id} className="p-4 border-border">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-full bg-amber-500/10 shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{c.company_name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap">{c.comment}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FundedProjectDetail;
