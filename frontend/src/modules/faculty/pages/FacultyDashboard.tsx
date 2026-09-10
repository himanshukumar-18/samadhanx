import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Button } from '../../../shared/components/ui/Button';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import {
  GraduationCap,
  Award,
  CheckCircle2,
  Clock,
  Landmark,
  ArrowRight,
  MessageSquare,
  AlertTriangle,
  XCircle,
  Sparkles,
  Users,
  Compass,
  FolderGit2,
  UserCheck,
} from 'lucide-react';
import { facultyApi, FacultyPodItem } from '../../../api/faculty';
import toast from 'react-hot-toast';

export const FacultyDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Active tab state: 'supervised' | 'available' | 'reviews'
  const [activeTab, setActiveTab] = useState<'supervised' | 'available' | 'reviews'>('supervised');

  // Review modal state
  const [reviewModalProject, setReviewModalProject] = useState<{ id: string; title: string; team_name: string } | null>(null);
  const [decision, setDecision] = useState<'approved' | 'changes_requested' | 'rejected'>('approved');
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Adoption state
  const [adoptingId, setAdoptingId] = useState<string | null>(null);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['faculty-dashboard'],
    queryFn: () => facultyApi.getFacultyDashboard(),
  });

  const handleAdoptPod = async (pod: FacultyPodItem) => {
    setAdoptingId(pod.id);
    try {
      await facultyApi.adoptPod(pod.id);
      toast.success(`Successfully adopted "${pod.title}" for academic mentorship!`);
      await queryClient.invalidateQueries({ queryKey: ['faculty-dashboard'] });
      setActiveTab('supervised');
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { error?: { message?: string }; detail?: { message?: string } | string; message?: string } };
      };
      const detail = errorObj.response?.data?.detail;
      const msg =
        (typeof detail === 'object' ? detail?.message : detail) ||
        errorObj.response?.data?.error?.message ||
        'Failed to adopt pod for mentorship.';
      toast.error(msg);
    } finally {
      setAdoptingId(null);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalProject) return;

    if (feedbackText.trim().length < 5) {
      toast.error('Please enter constructive feedback (minimum 5 characters).');
      return;
    }

    setIsSubmittingReview(true);
    try {
      await facultyApi.submitProjectReview(reviewModalProject.id, {
        decision,
        feedback_text: feedbackText.trim(),
      });
      toast.success('Mentorship evaluation dispatched successfully!');
      setReviewModalProject(null);
      setFeedbackText('');
      queryClient.invalidateQueries({ queryKey: ['faculty-dashboard'] });
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { error?: { message?: string }; detail?: { message?: string } | string; message?: string } };
      };
      const detail = errorObj.response?.data?.detail;
      const msg =
        (typeof detail === 'object' ? detail?.message : detail) ||
        errorObj.response?.data?.error?.message ||
        'Failed to submit review.';
      toast.error(msg);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const assignedProjects = dashboard?.assigned_projects || [];
  const availableProjects = dashboard?.available_projects || [];
  const recentReviews = dashboard?.recent_reviews || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">Faculty Academic Mentorship Portal</h1>
            <Badge variant="faculty">Faculty Mentor</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              Welcome, <strong className="text-foreground">{dashboard?.faculty_name || user?.full_name || user?.email}</strong>
            </span>
            {dashboard?.designation && <span>• {dashboard.designation}</span>}
            {dashboard?.department && <span>• {dashboard.department}</span>}
            {dashboard?.university_name && (
              <span className="flex items-center gap-1 text-primary font-bold">
                • <Landmark className="w-3.5 h-3.5" /> {dashboard.university_name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/explore"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 transition-colors"
          >
            <Compass className="w-4 h-4" /> Adopt Problem for Mentorship
          </a>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{dashboard?.assigned_projects_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground">Supervised Pods</div>
            </div>
          </div>
        </Card>

        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{dashboard?.available_pods_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground">Pods Seeking Mentors</div>
            </div>
          </div>
        </Card>

        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{dashboard?.pending_reviews_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground">Pods Awaiting Review</div>
            </div>
          </div>
        </Card>

        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{dashboard?.approved_reviews_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground">Approved Prototypes</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border text-sm font-bold gap-2">
        <button
          onClick={() => setActiveTab('supervised')}
          className={`pb-3 px-4 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'supervised'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>My Supervised Pods</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-foreground font-semibold">
            {assignedProjects.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('available')}
          className={`pb-3 px-4 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'available'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Campus Pods Seeking Mentorship</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-semibold">
            {availableProjects.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`pb-3 px-4 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'reviews'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Guidance & Reviews Log</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-foreground font-semibold">
            {recentReviews.length}
          </span>
        </button>
      </div>

      {/* Tab Content: Supervised Pods */}
      {activeTab === 'supervised' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-44 w-full rounded-2xl" />
              ))}
            </div>
          ) : assignedProjects.length === 0 ? (
            <Card className="text-center py-12 border-border space-y-4">
              <GraduationCap className="w-12 h-12 text-primary mx-auto opacity-80" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">No Student Pods Directly Supervised Yet</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Student teams from {dashboard?.university_name || 'your campus'} are actively developing solutions and seeking experienced faculty mentors.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setActiveTab('available')}
                  leftIcon={<Users className="w-4 h-4" />}
                >
                  Browse Campus Pods Seeking Mentorship ({availableProjects.length})
                </Button>
                <a
                  href="/explore"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted transition-colors"
                >
                  <Compass className="w-4 h-4" /> Explore Civic Challenges
                </a>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedProjects.map((proj) => {
                const isNeedsReview = proj.status === 'review';
                return (
                  <Card key={proj.id} className="border-border p-5 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="text-base font-bold text-foreground">{proj.title}</h4>
                          <span className="text-xs text-primary font-bold">Team {proj.team_name}</span>
                        </div>
                        <Badge variant={isNeedsReview ? 'pending' : 'default'}>
                          {proj.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1 mb-2">
                        <div>
                          <strong className="text-foreground">Problem:</strong> {proj.problem_title}
                        </div>
                        <div>
                          <strong className="text-foreground">Student Lead:</strong> {proj.lead_name}
                        </div>
                        {proj.university_name && (
                          <div className="text-primary font-semibold">
                            📍 {proj.university_name}
                          </div>
                        )}
                      </div>

                      {proj.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {proj.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                      <a
                        href={`/projects/${proj.id}`}
                        className="text-xs text-primary hover:underline font-bold inline-flex items-center gap-1"
                      >
                        <FolderGit2 className="w-3.5 h-3.5" /> Workspace
                      </a>
                      <Button
                        size="sm"
                        variant={isNeedsReview ? 'primary' : 'outline'}
                        onClick={() => setReviewModalProject({ id: proj.id, title: proj.title, team_name: proj.team_name })}
                        leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                      >
                        {isNeedsReview ? 'Submit Review' : 'Add Guidance'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Available Campus Pods Seeking Mentorship */}
      {activeTab === 'available' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Innovation Pods Seeking Faculty Guidance</h2>
              <p className="text-xs text-muted-foreground">
                Adopt a multidisciplinary student team to guide their technical validation, field tests, and academic progress.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{availableProjects.length} open for mentorship</span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-44 w-full rounded-2xl" />
              ))}
            </div>
          ) : availableProjects.length === 0 ? (
            <Card className="text-center py-12 border-border space-y-3">
              <Users className="w-10 h-10 text-muted-foreground mx-auto" />
              <h3 className="text-base font-bold text-foreground">No Unmentored Pods Currently Available</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                All campus innovation teams have currently matched with faculty mentors. Encourage more students to form pods from the civic challenges feed!
              </p>
              <a
                href="/explore"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 transition-colors mt-2"
              >
                <Compass className="w-4 h-4" /> Recommend Verified Problems to Students
              </a>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableProjects.map((pod) => (
                <Card key={pod.id} className="border-border p-5 flex flex-col justify-between space-y-4 group hover:border-primary/40 transition-all">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                          {pod.title}
                        </h4>
                        <span className="text-xs text-primary font-bold">Team {pod.team_name}</span>
                      </div>
                      <Badge variant="pending">Needs Mentor</Badge>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1 mb-2">
                      <div>
                        <strong className="text-foreground">Problem:</strong> {pod.problem_title}
                      </div>
                      <div>
                        <strong className="text-foreground">Student Lead:</strong> {pod.lead_name} {pod.lead_email ? `(${pod.lead_email})` : ''}
                      </div>
                      {pod.university_name && (
                        <div className="text-primary font-semibold">
                          📍 {pod.university_name}
                        </div>
                      )}
                    </div>

                    {pod.description && (
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {pod.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {pod.member_count} Member{pod.member_count !== 1 ? 's' : ''} • Updated {new Date(pod.updated_at).toLocaleDateString()}
                    </span>

                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleAdoptPod(pod)}
                      isLoading={adoptingId === pod.id}
                      leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                    >
                      Adopt as Mentor
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Guidance & Reviews Log */}
      {activeTab === 'reviews' && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-foreground">Dispatched Academic Evaluations & Milestone Reviews</h2>

          {recentReviews.length === 0 ? (
            <Card className="text-center py-10 border-border">
              <Award className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-80" />
              <h3 className="text-base font-bold text-foreground">No Reviews Dispatched Yet</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Once you adopt student pods and evaluate their milestone prototypes, your review logs and guidance decisions will appear here.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentReviews.map((rev) => (
                <Card key={rev.id} className="border-border p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{rev.project_title}</span>
                      {rev.decision === 'approved' && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Approved
                        </span>
                      )}
                      {rev.decision === 'changes_requested' && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Changes Requested
                        </span>
                      )}
                      {rev.decision === 'rejected' && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-destructive/10 text-destructive font-bold flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{rev.feedback_text}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review Submission Modal */}
      {reviewModalProject && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl border-border">
            <CardHeader>
              <CardTitle>Submit Mentorship Review</CardTitle>
              <CardDescription>
                Evaluating <strong>{reviewModalProject.title}</strong> by {reviewModalProject.team_name}
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleReviewSubmit} className="p-6 pt-0 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Academic Evaluation Decision
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecision('approved')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                      decision === 'approved'
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('changes_requested')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                      decision === 'changes_requested'
                        ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Changes Req.
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('rejected')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                      decision === 'rejected'
                        ? 'border-destructive bg-destructive/15 text-destructive'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rejected
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Guidance & Review Notes
                </label>
                <textarea
                  className="w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none min-h-[100px]"
                  placeholder="Provide constructive feedback on methodology, technical architecture, and validation steps..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" type="button" onClick={() => setReviewModalProject(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmittingReview} rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Dispatch Review
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
