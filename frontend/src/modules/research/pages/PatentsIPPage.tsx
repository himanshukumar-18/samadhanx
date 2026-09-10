import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { Card, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Button } from '../../../shared/components/ui/Button';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import {
  Award,
  BookOpen,
  FileCheck,
  Search,
  PlusCircle,
  ExternalLink,
  GraduationCap,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  RefreshCw,
  FileText,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  researchApi,
  PatentItem,
  EligibleProject,
  PatentCreatePayload,
  PatentUpdateStatusPayload,
} from '../../../api/research';

export const PatentsIPPage: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'portfolio' | 'pods' | 'guidelines'>('portfolio');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal: File Patent
  const [isFilingModalOpen, setIsFilingModalOpen] = useState(false);
  const [filingTitle, setFilingTitle] = useState('');
  const [filingAppNumber, setFilingAppNumber] = useState('');
  const [filingDate, setFilingDate] = useState(new Date().toISOString().split('T')[0]);
  const [filingOffice, setFilingOffice] = useState('Indian Patent Office (IPO)');
  const [filingField, setFilingField] = useState('CleanTech & Sustainability');
  const [filingTRL, setFilingTRL] = useState('TRL-4 (Lab Validation)');
  const [filingStatus, setFilingStatus] = useState('PROVISIONAL_FILED');
  const [filingProjectId, setFilingProjectId] = useState<string>('');
  const [filingAbstract, setFilingAbstract] = useState('');
  const [filingError, setFilingError] = useState<string | null>(null);

  // Modal: Update Status
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedPatent, setSelectedPatent] = useState<PatentItem | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('EXAMINATION');
  const [updateGrantNumber, setUpdateGrantNumber] = useState('');
  const [updateGrantDate, setUpdateGrantDate] = useState(new Date().toISOString().split('T')[0]);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Queries
  const { data: overview, isLoading, error } = useQuery({
    queryKey: ['research-patents-overview'],
    queryFn: () => researchApi.getPatentsOverview(),
  });

  // Mutations
  const filePatentMutation = useMutation({
    mutationFn: (payload: PatentCreatePayload) => researchApi.filePatent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-patents-overview'] });
      setIsFilingModalOpen(false);
      resetFilingForm();
    },
    onError: (err: any) => {
      setFilingError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.detail?.message ||
          err?.message ||
          'Failed to record patent filing.'
      );
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ patentId, payload }: { patentId: string; payload: PatentUpdateStatusPayload }) =>
      researchApi.updatePatentStatus(patentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-patents-overview'] });
      setIsUpdateModalOpen(false);
      setSelectedPatent(null);
      setUpdateError(null);
    },
    onError: (err: any) => {
      setUpdateError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.detail?.message ||
          err?.message ||
          'Failed to update patent status.'
      );
    },
  });

  const resetFilingForm = () => {
    setFilingTitle('');
    setFilingAppNumber('');
    setFilingDate(new Date().toISOString().split('T')[0]);
    setFilingOffice('Indian Patent Office (IPO)');
    setFilingField('CleanTech & Sustainability');
    setFilingTRL('TRL-4 (Lab Validation)');
    setFilingStatus('PROVISIONAL_FILED');
    setFilingProjectId('');
    setFilingAbstract('');
    setFilingError(null);
  };

  const handleOpenFileModal = (pod?: EligibleProject) => {
    resetFilingForm();
    if (pod) {
      setFilingProjectId(pod.id);
      setFilingTitle(`Invention Disclosure: ${pod.title}`);
      setFilingAbstract(`Patent specification derived from solution pod: "${pod.title}" developed by team ${pod.team_name}. ${pod.description}`);
    }
    setIsFilingModalOpen(true);
  };

  const handleOpenUpdateModal = (patent: PatentItem) => {
    setSelectedPatent(patent);
    setUpdateStatus(patent.status);
    setUpdateGrantNumber(patent.grant_number || '');
    setUpdateGrantDate(patent.grant_date || new Date().toISOString().split('T')[0]);
    setUpdateError(null);
    setIsUpdateModalOpen(true);
  };

  const handleFilingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!filingTitle.trim()) {
      setFilingError('Patent title is required.');
      return;
    }
    if (!filingAppNumber.trim()) {
      setFilingError('Application or Temporary Filing Number is required.');
      return;
    }
    if (!filingAbstract.trim() || filingAbstract.trim().length < 10) {
      setFilingError('Please provide a technical abstract/disclosure (at least 10 characters).');
      return;
    }

    filePatentMutation.mutate({
      title: filingTitle.trim(),
      application_number: filingAppNumber.trim(),
      filing_date: filingDate,
      patent_office: filingOffice,
      field_of_invention: filingField,
      commercial_readiness: filingTRL,
      status: filingStatus,
      project_id: filingProjectId || null,
      abstract: filingAbstract.trim(),
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatent) return;

    if (updateStatus === 'GRANTED' && !updateGrantNumber.trim()) {
      setUpdateError('Official Patent Grant Number is required when marking as GRANTED.');
      return;
    }

    updateStatusMutation.mutate({
      patentId: selectedPatent.id,
      payload: {
        status: updateStatus,
        grant_number: updateStatus === 'GRANTED' ? updateGrantNumber.trim() : null,
        grant_date: updateStatus === 'GRANTED' ? updateGrantDate : null,
      },
    });
  };

  // Filtered patents
  const patentsList = overview?.patents || [];
  const filteredPatents = patentsList.filter((p) => {
    const matchesSearch =
      searchQuery === '' ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.field_of_invention.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.project_title && p.project_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.inventor_name && p.inventor_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PROVISIONAL_FILED':
        return <Badge variant="pending" className="flex items-center gap-1"><Clock className="w-3 h-3" /> Provisional Filed</Badge>;
      case 'COMPLETE_SPECIFICATION':
        return <Badge variant="student" className="flex items-center gap-1"><FileText className="w-3 h-3" /> Complete Spec</Badge>;
      case 'EXAMINATION':
        return <Badge variant="faculty" className="flex items-center gap-1"><Search className="w-3 h-3" /> Examination (FER)</Badge>;
      case 'PUBLISHED':
        return <Badge variant="university" className="flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Published Gazette</Badge>;
      case 'GRANTED':
        return <Badge variant="approved" className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Patent Granted</Badge>;
      case 'COMMERCIALIZED':
        return <Badge variant="industry" className="flex items-center gap-1"><Zap className="w-3 h-3" /> Commercialized</Badge>;
      case 'ABANDONED':
        return <Badge variant="rejected">Abandoned</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getTRLBadgeColor = (trl: string) => {
    if (trl.includes('TRL-7') || trl.includes('TRL-8') || trl.includes('TRL-9')) {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    }
    if (trl.includes('TRL-5') || trl.includes('TRL-6')) {
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    }
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-linear-to-r from-indigo-900/10 via-purple-900/10 to-primary/10 border border-border p-6 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Award className="w-6 h-6" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Patents & Intellectual Property Desk
            </h1>
            {user?.role && (
              <Badge variant="university" className="text-[10px]">
                {user.role}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Institutional patent portfolio, technology transfer, KAPILA scheme enablement, and commercialization readiness (TRL 1-9) for campus inventions.
            {overview?.university_name && (
              <span className="font-semibold text-foreground ml-1">
                — {overview.university_name}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            className="flex items-center gap-2 shadow-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            onClick={() => handleOpenFileModal()}
          >
            <PlusCircle className="w-4 h-4" />
            File Patent / IP Disclosure
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Failed to load patent portfolio overview.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="p-4 border border-border bg-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Filings</p>
              <Award className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-foreground">{overview?.total_patents_count || 0}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Institutional filings</p>
          </Card>

          <Card className="p-4 border border-border bg-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Granted Patents</p>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-emerald-600 dark:text-emerald-400">
              {overview?.granted_patents_count || 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Fully granted & gazetted</p>
          </Card>

          <Card className="p-4 border border-border bg-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Provisional Filed</p>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-amber-600 dark:text-amber-400">
              {overview?.provisional_filed_count || 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">12 mo. window for complete</p>
          </Card>

          <Card className="p-4 border border-border bg-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Under Exam</p>
              <FileCheck className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-purple-600 dark:text-purple-400">
              {overview?.under_examination_count || 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">FER / Controller review</p>
          </Card>

          <Card className="p-4 border border-border bg-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">High TRL (6+)</p>
              <Sparkles className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-blue-600 dark:text-blue-400">
              {overview?.commercial_ready_count || 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Industry pilot ready</p>
          </Card>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-border flex items-center gap-6">
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'portfolio'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Award className="w-4 h-4" />
          Institutional IP Portfolio ({overview?.patents?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('pods')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'pods'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-4 h-4" />
          High-TRL Solution Pods ({overview?.eligible_projects?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('guidelines')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'guidelines'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          KAPILA & IP Legal Framework
        </button>
      </div>

      {/* TAB 1: Institutional IP Portfolio */}
      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          {/* Controls: Search & Status Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by title, patent number, field, inventor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">Status:</span>
              {[
                { id: 'all', label: 'All' },
                { id: 'PROVISIONAL_FILED', label: 'Provisional' },
                { id: 'COMPLETE_SPECIFICATION', label: 'Complete Spec' },
                { id: 'EXAMINATION', label: 'Exam' },
                { id: 'GRANTED', label: 'Granted' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    statusFilter === filter.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-card text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Patents List */}
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
          ) : filteredPatents.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-2xl p-8 space-y-4">
              <Award className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
              <div className="space-y-1">
                <p className="text-base font-bold text-foreground">No Patent Disclosures Found</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {searchQuery || statusFilter !== 'all'
                    ? 'No patents match the current search filters. Try clearing your search.'
                    : 'Your institution has not filed any patent applications yet. You can file disclosures for student solution pods.'}
                </p>
              </div>
              <Button
                variant="outline"
                className="text-xs"
                onClick={() => handleOpenFileModal()}
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" />
                File First Patent Application
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredPatents.map((patent) => (
                <Card key={patent.id} className="p-6 border border-border bg-card hover:border-indigo-500/30 transition-all">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(patent.status)}
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border tracking-wide uppercase ${getTRLBadgeColor(
                            patent.commercial_readiness
                          )}`}
                        >
                          {patent.commercial_readiness}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2 py-0.5 rounded-md border border-border">
                          App #: {patent.application_number}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-foreground hover:text-indigo-600 transition-colors">
                        {patent.title}
                      </h3>

                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {patent.abstract}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap pt-2 border-t border-border">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                          {patent.patent_office}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          Filing: {patent.filing_date}
                        </span>
                        <span className="flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-purple-500" />
                          Field: {patent.field_of_invention}
                        </span>
                        {patent.project_title && (
                          <span className="flex items-center gap-1 text-primary font-medium">
                            <Layers className="w-3.5 h-3.5" />
                            Pod: {patent.project_title}
                          </span>
                        )}
                        {patent.inventor_name && (
                          <span className="text-xs text-muted-foreground">
                            Lead: <strong className="text-foreground">{patent.inventor_name}</strong>
                          </span>
                        )}
                      </div>

                      {patent.status === 'GRANTED' && patent.grant_number && (
                        <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
                          <span className="flex items-center gap-2 font-bold">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            Patent Granted Certificate No: {patent.grant_number}
                          </span>
                          {patent.grant_date && (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Date of Grant: {patent.grant_date}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex md:flex-col items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs w-full flex items-center gap-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 border-border"
                        onClick={() => handleOpenUpdateModal(patent)}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Update Lifecycle
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Patent-Eligible Solution Pods */}
      {activeTab === 'pods' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-bold text-foreground">KAPILA Pre-Patent Scouting Engine</p>
              <p>
                These student and faculty solution pods have developed validated working prototypes. Your Technology Transfer Office (TTO) can initiate formal patent disclosures for these innovations directly.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-2xl" />
              ))}
            </div>
          ) : (overview?.eligible_projects?.length || 0) === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-2xl p-8 space-y-3">
              <Layers className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
              <p className="text-base font-bold text-foreground">No Campus Solution Pods Found</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Student innovation teams working on civic problem solutions will appear here once registered on SamadhanX.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overview?.eligible_projects.map((pod) => (
                <Card key={pod.id} className="p-5 border border-border bg-card flex flex-col justify-between hover:border-indigo-500/40 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="student" className="text-[10px]">
                        Team {pod.team_name}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(pod.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-foreground">{pod.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {pod.description}
                    </p>

                    {pod.problem_title && (
                      <div className="text-xs text-muted-foreground bg-muted/40 p-2 rounded-lg border border-border/50">
                        <span className="font-semibold text-foreground">Civic Challenge:</span> {pod.problem_title}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Status: <strong className="capitalize text-foreground">{pod.status.toLowerCase()}</strong>
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1"
                      onClick={() => handleOpenFileModal(pod)}
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      File Patent for Pod
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: KAPILA & IP Legal Framework */}
      {activeTab === 'guidelines' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 border border-border bg-card space-y-3">
              <div className="p-3 w-fit rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Award className="w-6 h-6" />
              </div>
              <CardTitle>KAPILA Scheme</CardTitle>
              <CardDescription>
                Kalam Program for IP Literacy and Awareness (Ministry of Education, Govt. of India). Provides 100% financial reimbursement of patent filing fees for higher educational institutions (HEIs).
              </CardDescription>
              <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold pt-2">
                Eligible for AICTE & UGC recognized universities.
              </div>
            </Card>

            <Card className="p-6 border border-border bg-card space-y-3">
              <div className="p-3 w-fit rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <FileText className="w-6 h-6" />
              </div>
              <CardTitle>Indian Patents Act, 1970</CardTitle>
              <CardDescription>
                <strong>Form 1:</strong> Application for Grant of Patent.<br />
                <strong>Form 2:</strong> Provisional / Complete Specification (12-month statutory deadline to file complete spec).<br />
                <strong>Form 18:</strong> Request for Examination (FER within 48 months).
              </CardDescription>
            </Card>

            <Card className="p-6 border border-border bg-card space-y-3">
              <div className="p-3 w-fit rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Zap className="w-6 h-6" />
              </div>
              <CardTitle>TRL Commercial Scale</CardTitle>
              <CardDescription>
                Technology Readiness Level (1-9). SamadhanX benchmarks civic prototypes from TRL-3 (analytical proof-of-concept) up to TRL-7 (operational field pilot with municipal bodies and CSR corporate sponsors).
              </CardDescription>
            </Card>
          </div>

          <Card className="p-6 border border-border bg-card space-y-4">
            <h4 className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              IP Ownership & Student-Faculty Revenue Sharing Framework
            </h4>
            <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>
                Under standard Indian HEI IPR policies (and SamadhanX Open Innovation Governance), intellectual property developed by student solution teams with faculty mentorship is jointly owned:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Student Innovators (Inventors):</strong> Hold 70% commercial royalty rights upon industry licensing or startup spin-off.</li>
                <li><strong>Faculty Mentors:</strong> 15% academic recognition and research royalty pool.</li>
                <li><strong>University TTO:</strong> 15% reinvested in institutional incubation and patent maintenance funds.</li>
              </ul>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 1: File Patent / IP Disclosure */}
      {isFilingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card text-card-foreground border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-foreground">File Patent / IP Disclosure</h3>
              </div>
              <button
                onClick={() => setIsFilingModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold px-2 py-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFilingSubmit} className="p-6 space-y-4">
              {filingError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl">
                  {filingError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Title of Invention / Patent <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Biodegradable Electrostatic PM2.5 Filtration System"
                  value={filingTitle}
                  onChange={(e) => setFilingTitle(e.target.value)}
                  className="w-full text-xs p-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-foreground"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Application / Filing Number <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 202611099881 (or IPO Temp Ref)"
                    value={filingAppNumber}
                    onChange={(e) => setFilingAppNumber(e.target.value)}
                    className="w-full text-xs p-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-foreground font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Filing Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={filingDate}
                    onChange={(e) => setFilingDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Patent Office</label>
                  <select
                    value={filingOffice}
                    onChange={(e) => setFilingOffice(e.target.value)}
                    className="w-full text-xs p-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-foreground"
                  >
                    <option value="Indian Patent Office (IPO)">Indian Patent Office (IPO - Delhi / Mumbai / Chennai / Kolkata)</option>
                    <option value="PCT / WIPO (International)">PCT / WIPO (International Patent System)</option>
                    <option value="USPTO (United States)">USPTO (United States)</option>
                    <option value="EPO (European Patent Office)">EPO (European Patent Office)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Initial Lifecycle Status</label>
                  <select
                    value={filingStatus}
                    onChange={(e) => setFilingStatus(e.target.value)}
                    className="w-full text-xs p-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-foreground"
                  >
                    <option value="PROVISIONAL_FILED">Provisional Specification Filed</option>
                    <option value="COMPLETE_SPECIFICATION">Complete Specification Filed</option>
                    <option value="EXAMINATION">Under Examination (FER)</option>
                    <option value="GRANTED">Granted</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Field of Invention</label>
                  <select
                    value={filingField}
                    onChange={(e) => setFilingField(e.target.value)}
                    className="w-full text-xs p-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-foreground"
                  >
                    <option value="CleanTech & Sustainability">CleanTech & Sustainability</option>
                    <option value="MedTech & Healthcare">MedTech & Healthcare Devices</option>
                    <option value="AgriTech & Food Tech">AgriTech & Food Processing</option>
                    <option value="AI, Robotics & IoT">AI, Robotics & Autonomous Systems</option>
                    <option value="Materials Science & Nanotech">Materials Science & Nanotech</option>
                    <option value="Smart Mobility & EV">Smart Mobility & EV Technology</option>
                    <option value="Water & Sanitation">Water Purification & Waste Tech</option>
                    <option value="Other DeepTech">Other DeepTech</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Commercial Readiness (TRL)</label>
                  <select
                    value={filingTRL}
                    onChange={(e) => setFilingTRL(e.target.value)}
                    className="w-full text-xs p-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-foreground"
                  >
                    <option value="TRL-3 (Proof of Concept)">TRL-3 (Proof of Concept Validated)</option>
                    <option value="TRL-4 (Lab Validation)">TRL-4 (Laboratory Component Validation)</option>
                    <option value="TRL-5 (Integrated Validation)">TRL-5 (Simulated Field Testing)</option>
                    <option value="TRL-6 (Prototype Demo)">TRL-6 (Operational Environment Prototype)</option>
                    <option value="TRL-7 (Field Pilot)">TRL-7 (Real-world Deployment Pilot)</option>
                    <option value="TRL-8 (Commercial Qualified)">TRL-8 (Manufacture Ready / Qualified)</option>
                    <option value="TRL-9 (Market Proven)">TRL-9 (Commercial Market Operations)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Link Solution Pod (Optional)</label>
                <select
                  value={filingProjectId}
                  onChange={(e) => setFilingProjectId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-foreground"
                >
                  <option value="">-- Independent University / Faculty Research --</option>
                  {overview?.eligible_projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} (Team {p.team_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Patent Abstract / Technical Disclosure <span className="text-destructive">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Summarize the core novelty, inventive step, claims scope, and technical efficacy of the invention..."
                  value={filingAbstract}
                  onChange={(e) => setFilingAbstract(e.target.value)}
                  className="w-full text-xs p-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-foreground"
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFilingModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={filePatentMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  {filePatentMutation.isPending ? 'Recording Filing...' : 'Submit Patent Filing'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Update Lifecycle Status */}
      {isUpdateModalOpen && selectedPatent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card text-card-foreground border border-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-foreground">Update Patent Lifecycle</h3>
              </div>
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold px-2 py-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4">
              {updateError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl">
                  {updateError}
                </div>
              )}

              <div className="p-3 bg-muted/50 rounded-xl border border-border space-y-1">
                <p className="text-xs font-bold text-foreground">{selectedPatent.title}</p>
                <p className="text-[11px] text-muted-foreground font-mono">App #: {selectedPatent.application_number}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Lifecycle Status</label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="w-full text-xs p-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-foreground"
                >
                  <option value="PROVISIONAL_FILED">Provisional Filed</option>
                  <option value="COMPLETE_SPECIFICATION">Complete Specification Filed</option>
                  <option value="EXAMINATION">Under Examination (FER Issued)</option>
                  <option value="PUBLISHED">Published in Official Patent Gazette</option>
                  <option value="GRANTED">Granted (Official Patent Issued)</option>
                  <option value="COMMERCIALIZED">Commercialized / Tech Transfer Licensed</option>
                  <option value="ABANDONED">Abandoned / Lapsed</option>
                </select>
              </div>

              {updateStatus === 'GRANTED' && (
                <div className="space-y-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      Official Patent Grant Number <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. IN-PAT-445892"
                      value={updateGrantNumber}
                      onChange={(e) => setUpdateGrantNumber(e.target.value)}
                      className="w-full text-xs p-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-foreground font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      Date of Grant <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={updateGrantDate}
                      onChange={(e) => setUpdateGrantDate(e.target.value)}
                      className="w-full text-xs p-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-foreground"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUpdateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={updateStatusMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  {updateStatusMutation.isPending ? 'Updating...' : 'Save Lifecycle Status'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
