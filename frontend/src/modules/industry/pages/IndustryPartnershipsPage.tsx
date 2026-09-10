import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { Card } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Button } from '../../../shared/components/ui/Button';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import {
  Building2,
  Award,
  HeartHandshake,
  Search,
  PlusCircle,
  ExternalLink,
  GraduationCap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Layers,
  Sparkles,
  Users,
} from 'lucide-react';
import { industryApi, IndustrySupportItem, ProjectSeekingSupport } from '../../../api/industry';

export const IndustryPartnershipsPage: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'partnerships' | 'opportunities'>('partnerships');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');

  // Modal State for Submitting CSR Intent
  const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectSeekingSupport | null>(null);
  const [companyName, setCompanyName] = useState(user?.organization_name || '');
  const [supportType, setSupportType] = useState('csr_grant');
  const [amountOrTerms, setAmountOrTerms] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Queries
  const { data: overview, isLoading: loadingOverview, error } = useQuery({
    queryKey: ['industry-partnerships-overview'],
    queryFn: () => industryApi.getPartnershipsOverview(),
  });

  // Submit CSR Support Intent Mutation
  const submitIntentMutation = useMutation({
    mutationFn: (data: {
      project_id: string;
      company_name: string;
      support_type: string;
      amount_or_terms: string;
    }) => industryApi.submitSupportIntent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industry-partnerships-overview'] });
      setIsSponsorModalOpen(false);
      setSelectedProject(null);
      setAmountOrTerms('');
      setSubmitError(null);
    },
    onError: (err: any) => {
      setSubmitError(err?.response?.data?.error?.message || err?.message || 'Failed to submit CSR intent.');
    },
  });

  // Moderate Status Mutation (Approve / Reject)
  const updateStatusMutation = useMutation({
    mutationFn: ({ supportId, status }: { supportId: string; status: 'approved' | 'rejected' }) =>
      industryApi.updateSupportStatus(supportId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industry-partnerships-overview'] });
    },
  });

  const handleOpenSponsorModal = (project?: ProjectSeekingSupport) => {
    if (project) {
      setSelectedProject(project);
    }
    setCompanyName(user?.organization_name || user?.full_name || '');
    setSubmitError(null);
    setIsSponsorModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) {
      setSubmitError('Please select a student solution project to support.');
      return;
    }
    if (!amountOrTerms.trim()) {
      setSubmitError('Please provide the terms, funding amount, or grant details.');
      return;
    }
    submitIntentMutation.mutate({
      project_id: selectedProject.id,
      company_name: companyName.trim() || 'Corporate Partner',
      support_type: supportType,
      amount_or_terms: amountOrTerms.trim(),
    });
  };

  const isIndustryUser = user?.role === 'industry';
  const isUniversityUser = user?.role === 'university';
  const canModerate = isUniversityUser || user?.role === 'faculty' || user?.role === 'admin' || user?.role === 'student';

  const partnerships = overview?.partnerships || [];
  const availableProjects = overview?.available_projects || [];

  // Filter partnerships
  const filteredPartnerships = partnerships.filter((item: IndustrySupportItem) => {
    const matchesSearch =
      (item.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (item.project_title?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (item.university_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (item.amount_or_terms?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filter projects
  const filteredProjects = availableProjects.filter((p: ProjectSeekingSupport) => {
    return (
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.problem_title?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (p.university_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      p.team_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="w-8 h-8 text-amber-500" />
              Industry Partnerships & CSR Hub
            </h1>
            {isIndustryUser && <Badge variant="industry">Corporate Partner</Badge>}
            {isUniversityUser && <Badge variant="university">University Desk</Badge>}
          </div>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Empowering university innovation through corporate social responsibility (CSR) grants, R&D sponsorships,
            hardware pilot deployments, and executive student mentorship.
          </p>
        </div>

        {isIndustryUser && (
          <Button
            onClick={() => handleOpenSponsorModal()}
            className="flex items-center gap-2 shadow-lg shadow-amber-500/20 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <PlusCircle className="w-4 h-4" /> Pledge CSR Support
          </Button>
        )}
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              {loadingOverview ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{overview?.total_partnerships_count ?? 0}</div>
              )}
              <div className="text-xs font-medium text-muted-foreground">Total CSR Engagements</div>
            </div>
          </div>
        </Card>

        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              {loadingOverview ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{overview?.active_grants_count ?? 0}</div>
              )}
              <div className="text-xs font-medium text-muted-foreground">Approved Grants & Pilots</div>
            </div>
          </div>
        </Card>

        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              {loadingOverview ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{overview?.pending_reviews_count ?? 0}</div>
              )}
              <div className="text-xs font-medium text-muted-foreground">Pending Intent Reviews</div>
            </div>
          </div>
        </Card>

        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              {loadingOverview ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{overview?.available_projects?.length ?? 0}</div>
              )}
              <div className="text-xs font-medium text-muted-foreground">Innovation Pods Available</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setActiveTab('partnerships')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'partnerships'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          {isIndustryUser
            ? 'My CSR Support Intents'
            : isUniversityUser
            ? 'Campus Industry Partnerships'
            : 'Active Industry Engagements'}
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            {partnerships.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('opportunities')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'opportunities'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          Student Innovation Pods Seeking Backing
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            {availableProjects.length}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              activeTab === 'partnerships'
                ? 'Search company, project, university...'
                : 'Search student solution pods...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {activeTab === 'partnerships' && (
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            {(['all', 'approved', 'pending', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                  statusFilter === status
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      {error ? (
        <Card className="p-8 text-center border-destructive/20 bg-destructive/5 text-destructive">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="font-bold">Failed to load industry partnerships data.</p>
          <p className="text-xs opacity-80 mt-1">Please refresh the page or check your connection.</p>
        </Card>
      ) : loadingOverview ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : activeTab === 'partnerships' ? (
        // Partnerships Tab
        filteredPartnerships.length === 0 ? (
          <Card className="text-center py-16 border-border">
            <Building2 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground">No partnerships found</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'No industry engagements match your active filter criteria.'
                : isIndustryUser
                ? 'You have not submitted any CSR sponsorship intents yet. Browse student innovation pods to sponsor.'
                : 'No corporate partnerships have been logged for these projects yet.'}
            </p>
            {isIndustryUser && (
              <Button onClick={() => setActiveTab('opportunities')} variant="outline" className="gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" /> Explore Student Pods
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredPartnerships.map((item: IndustrySupportItem) => (
              <Card
                key={item.id}
                className="p-5 border-border hover:border-amber-500/30 transition-all duration-200"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-amber-500" />
                        {item.company_name}
                      </span>
                      <Badge variant="industry" className="capitalize">
                        {item.support_type.replace('_', ' ')}
                      </Badge>
                      <Badge variant={item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'}>
                        {item.status}
                      </Badge>
                    </div>

                    {/* Associated Project */}
                    <div className="bg-muted/40 p-3 rounded-xl border border-border/60">
                      <div className="text-xs text-muted-foreground font-medium mb-0.5">Assigned Student Solution Pod:</div>
                      <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-primary" />
                        {item.project_title || 'Solution Prototype Pod'}
                        <a
                          href={`/projects/${item.project_id}`}
                          className="text-xs text-primary hover:underline flex items-center gap-0.5 ml-2"
                        >
                          Workspace <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      {item.university_name && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                          {item.university_name}
                        </div>
                      )}
                    </div>

                    {/* Terms */}
                    <div className="text-sm text-foreground/90 pt-1">
                      <strong className="text-xs text-muted-foreground uppercase tracking-wider block mb-0.5">
                        CSR Support Terms & Grant Details:
                      </strong>
                      <p className="whitespace-pre-wrap">{item.amount_or_terms}</p>
                    </div>

                    <div className="text-xs text-muted-foreground pt-1">
                      Submitted on {new Date(item.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>

                  {/* Actions for Authorized Reviewers */}
                  {canModerate && item.status === 'pending' && (
                    <div className="flex items-center gap-2 pt-2 md:pt-0 self-end md:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ supportId: item.id, status: 'rejected' })}
                        disabled={updateStatusMutation.isPending}
                        className="text-xs border-destructive/30 hover:bg-destructive/10 text-destructive gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Decline
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ supportId: item.id, status: 'approved' })}
                        disabled={updateStatusMutation.isPending}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Accept Partnership
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        // Opportunities Tab
        filteredProjects.length === 0 ? (
          <Card className="text-center py-16 border-border">
            <GraduationCap className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground">No available innovation pods</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
              There are currently no student pods matching your search criteria.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredProjects.map((proj: ProjectSeekingSupport) => (
              <Card
                key={proj.id}
                className="p-5 border-border flex flex-col justify-between hover:border-primary/40 transition-all duration-200"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-foreground line-clamp-1">{proj.title}</h3>
                      <div className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                        <Users className="w-3.5 h-3.5 text-primary" /> {proj.team_name}
                      </div>
                    </div>
                    <Badge variant="student">{proj.status}</Badge>
                  </div>

                  {proj.problem_title && (
                    <div className="text-xs bg-muted/60 p-2.5 rounded-lg text-foreground font-medium line-clamp-2">
                      <span className="text-muted-foreground font-semibold">Societal Problem: </span>
                      {proj.problem_title}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {proj.description}
                  </p>

                  {proj.university_name && (
                    <div className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-medium">
                      <GraduationCap className="w-3.5 h-3.5" /> {proj.university_name}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border mt-4 flex items-center justify-between gap-2">
                  <a
                    href={`/projects/${proj.id}`}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    View Pod Details <ExternalLink className="w-3 h-3" />
                  </a>

                  {isIndustryUser ? (
                    <Button
                      size="sm"
                      onClick={() => handleOpenSponsorModal(proj)}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                    >
                      <HeartHandshake className="w-3.5 h-3.5" /> Sponsor Pod
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      Industry Sponsoring Enabled
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* CSR Sponsorship Intent Modal */}
      {isSponsorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-amber-500" />
                Pledge CSR / Industry Support
              </h3>
              <button
                onClick={() => setIsSponsorModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {submitError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {submitError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Target Project Selection */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Target Student Solution Pod <span className="text-destructive">*</span>
                </label>
                {selectedProject ? (
                  <div className="p-3 bg-muted/60 rounded-xl border border-border text-xs flex justify-between items-center">
                    <div>
                      <div className="font-bold text-foreground">{selectedProject.title}</div>
                      <div className="text-muted-foreground text-[11px]">
                        {selectedProject.team_name} • {selectedProject.university_name || 'Verified Institution'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProject(null)}
                      className="text-xs text-primary hover:underline ml-2"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <select
                    className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    onChange={(e) => {
                      const found = availableProjects.find((p) => p.id === e.target.value);
                      if (found) setSelectedProject(found);
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      -- Select an active student project --
                    </option>
                    {availableProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.team_name})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Company / Sponsor Name */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Corporate / Foundation Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Tata Trusts / Infosys Foundation"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              {/* Support Type */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Partnership Support Type <span className="text-destructive">*</span>
                </label>
                <select
                  value={supportType}
                  onChange={(e) => setSupportType(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="csr_grant">CSR Innovation / Prototyping Grant</option>
                  <option value="sponsorship">Direct Team Sponsorship & Cash Bounty</option>
                  <option value="pilot_partner">Field Pilot Deployment & Testing Partner</option>
                  <option value="mentorship">Industry Mentorship & Executive Guidance</option>
                  <option value="equipment">Lab Equipment & Hardware Donation</option>
                </select>
              </div>

              {/* Amount / Terms / Details */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Grant Amount / Terms / Hardware Details <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={4}
                  value={amountOrTerms}
                  onChange={(e) => setAmountOrTerms(e.target.value)}
                  placeholder="e.g. ₹5,00,000 grant towards Phase 1 testing and pilot hardware procurement, accompanied by weekly engineering mentorship sessions."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSponsorModalOpen(false)}
                  disabled={submitIntentMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitIntentMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                >
                  {submitIntentMutation.isPending ? 'Submitting...' : 'Submit CSR Intent'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
