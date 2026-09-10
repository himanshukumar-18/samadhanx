import React, { useState, useEffect, useCallback } from 'react';
import { 
  adminApi, 
  RestrictedRequestItem, 
  AuditLogItem, 
  ModerationProblemItem, 
  AdminAnalytics 
} from '../../../api/admin';
import { 
  institutionsApi, 
  InstitutionVerificationRequestItem, 
  InstitutionMasterItem, 
  InstitutionSyncRunItem 
} from '../../../api/institutions';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Building2, 
  Landmark, 
  RefreshCw,
  Search,
  Upload,
  Clock,
  Check,
  FileSpreadsheet,
  AlertTriangle,
  ChevronRight,
  UserCheck,
  Compass,
  BarChart3,
  Users,
  Lightbulb,
  FolderGit2,
  TrendingUp,
  Award,
  Eye
} from 'lucide-react';
import toast from 'react-hot-toast';

type AdminTab = 'requests' | 'institution_requests' | 'institution_master' | 'moderation' | 'audit' | 'analytics';

export const AdminDashboard: React.FC = () => {
  // Read initial tab from URL param or default to 'requests'
  const getInitialTab = (): AdminTab => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (
      tab === 'institution_requests' || 
      tab === 'institution_master' || 
      tab === 'moderation' || 
      tab === 'audit' || 
      tab === 'analytics'
    ) {
      return tab;
    }
    return 'requests';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(getInitialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Sync tab state to URL
  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url.toString());
  };

  // 1. Partner Onboarding Requests State
  const [requests, setRequests] = useState<RestrictedRequestItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [orgTypeFilter, setOrgTypeFilter] = useState<'all' | 'university' | 'industry'>('all');
  const [requestSearch, setRequestSearch] = useState('');
  const [rejectionModal, setRejectionModal] = useState<{ open: boolean; requestId: string | null; orgName: string; reason: string }>({
    open: false,
    requestId: null,
    orgName: '',
    reason: '',
  });

  // 2. Institution Verification Requests State
  const [instRequests, setInstRequests] = useState<InstitutionVerificationRequestItem[]>([]);
  const [instFilter, setInstFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [instRejectModal, setInstRejectModal] = useState<{ open: boolean; requestId: string | null; instName: string; reason: string }>({
    open: false,
    requestId: null,
    instName: '',
    reason: '',
  });

  // 3. Institution Master & Sync State
  const [masterInstitutions, setMasterInstitutions] = useState<InstitutionMasterItem[]>([]);
  const [masterQuery, setMasterQuery] = useState('');
  const [syncLogs, setSyncLogs] = useState<InstitutionSyncRunItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // 4. Moderation Desk State
  const [moderationProblems, setModerationProblems] = useState<ModerationProblemItem[]>([]);
  const [modStatusFilter, setModStatusFilter] = useState<string>('all');
  const [modCategoryFilter, setModCategoryFilter] = useState<string>('all');
  const [modSearch, setModSearch] = useState('');
  const [statusModal, setStatusModal] = useState<{ open: boolean; problemId: string | null; title: string; currentStatus: string; newStatus: string }>({
    open: false,
    problemId: null,
    title: '',
    currentStatus: '',
    newStatus: '',
  });

  // 5. Audit State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditTargetFilter, setAuditTargetFilter] = useState('all');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogItem | null>(null);

  // 6. Analytics State
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'requests') {
        const res = await adminApi.listRestrictedRequests({
          status_filter: filter === 'all' ? undefined : filter,
          org_type: orgTypeFilter === 'all' ? undefined : orgTypeFilter,
          q: requestSearch.trim() || undefined,
        });
        setRequests(res.data || []);
      } else if (activeTab === 'institution_requests') {
        const res = await institutionsApi.listAdminRequests(instFilter);
        setInstRequests(res.data || []);
      } else if (activeTab === 'institution_master') {
        const res = await institutionsApi.listAdminInstitutions({ q: masterQuery || undefined });
        setMasterInstitutions(res.data || []);
        const logsRes = await institutionsApi.listSyncLogs(10);
        setSyncLogs(logsRes.data || []);
      } else if (activeTab === 'moderation') {
        const res = await adminApi.listModerationProblems({
          status_filter: modStatusFilter === 'all' ? undefined : modStatusFilter,
          category: modCategoryFilter === 'all' ? undefined : modCategoryFilter,
          q: modSearch.trim() || undefined,
        });
        setModerationProblems(res.data || []);
      } else if (activeTab === 'audit') {
        const res = await adminApi.listAuditLogs({
          action: auditActionFilter.trim() || undefined,
          target_type: auditTargetFilter === 'all' ? undefined : auditTargetFilter,
          limit: 100,
        });
        setAuditLogs(res.data || []);
      } else if (activeTab === 'analytics') {
        const res = await adminApi.getPlatformAnalytics();
        setAnalytics(res.data || null);
      }
    } catch {
      toast.error('Failed to load administrative governance data.');
    } finally {
      setIsLoading(false);
    }
  }, [
    activeTab, 
    filter, 
    orgTypeFilter, 
    requestSearch, 
    instFilter, 
    masterQuery, 
    modStatusFilter, 
    modCategoryFilter, 
    modSearch, 
    auditActionFilter, 
    auditTargetFilter
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Account Request Handlers
  const handleApprove = async (id: string, name: string) => {
    setProcessingId(id);
    try {
      await adminApi.approveRequest(id);
      toast.success(`Approved ${name} into official ecosystem.`);
      loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(errorObj.response?.data?.error?.message || 'Approval failed.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionModal.requestId) return;
    setProcessingId(rejectionModal.requestId);
    try {
      await adminApi.rejectRequest(
        rejectionModal.requestId,
        rejectionModal.reason || 'Institutional credentials could not be verified.'
      );
      toast.success(`Rejected request for ${rejectionModal.orgName}`);
      setRejectionModal({ open: false, requestId: null, orgName: '', reason: '' });
      loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(errorObj.response?.data?.error?.message || 'Rejection failed.');
    } finally {
      setProcessingId(null);
    }
  };

  // Institution Verification Request Handlers
  const handleApproveInstRequest = async (id: string, name: string) => {
    setProcessingId(id);
    try {
      await institutionsApi.approveRequest(id);
      toast.success(`Approved institution '${name}' into Verified Master!`);
      loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      toast.error(errorObj.response?.data?.message || 'Institution approval failed.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectInstRequest = async () => {
    if (!instRejectModal.requestId) return;
    setProcessingId(instRejectModal.requestId);
    try {
      await institutionsApi.rejectRequest(
        instRejectModal.requestId,
        instRejectModal.reason || 'Institution credentials could not be verified.'
      );
      toast.success(`Rejected verification request for ${instRejectModal.instName}`);
      setInstRejectModal({ open: false, requestId: null, instName: '', reason: '' });
      loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      toast.error(errorObj.response?.data?.message || 'Institution rejection failed.');
    } finally {
      setProcessingId(null);
    }
  };

  // Moderation Handlers
  const handleToggleVerifyProblem = async (problem: ModerationProblemItem) => {
    setProcessingId(problem.id);
    try {
      const newVerified = !problem.is_verified;
      await adminApi.moderateProblem(problem.id, {
        status: problem.status,
        is_verified: newVerified,
      });
      toast.success(newVerified ? 'Marked problem as Official Verified Challenge.' : 'Removed verification badge.');
      loadData();
    } catch {
      toast.error('Failed to update problem verification status.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateProblemStatus = async () => {
    if (!statusModal.problemId || !statusModal.newStatus) return;
    setProcessingId(statusModal.problemId);
    try {
      await adminApi.moderateProblem(statusModal.problemId, {
        status: statusModal.newStatus,
      });
      toast.success(`Problem status updated to ${statusModal.newStatus.replace('_', ' ').toUpperCase()}`);
      setStatusModal({ open: false, problemId: null, title: '', currentStatus: '', newStatus: '' });
      loadData();
    } catch {
      toast.error('Failed to moderate problem status.');
    } finally {
      setProcessingId(null);
    }
  };

  // CSV / JSON Dataset Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const res = await institutionsApi.importCsv(file);
      toast.success(res.message || 'Dataset imported and synchronized successfully!');
      loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      toast.error(errorObj.response?.data?.detail || 'Failed to import dataset.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">National Governance Desk</h1>
            <Badge variant="admin">Admin Authority</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Control Plane for partner onboarding, university master verification, content moderation, audit trails, and national analytics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}>
            Refresh Desk
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex gap-2 border-b border-border overflow-x-auto select-none" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'requests'}
          onClick={() => handleTabChange('requests')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'requests'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Partner Onboarding
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'institution_requests'}
          onClick={() => handleTabChange('institution_requests')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'institution_requests'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Institution Verifications
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'institution_master'}
          onClick={() => handleTabChange('institution_master')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'institution_master'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Institution Master & Sync
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'moderation'}
          onClick={() => handleTabChange('moderation')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'moderation'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Content Moderation
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'audit'}
          onClick={() => handleTabChange('audit')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'audit'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Security Audit Trail
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'analytics'}
          onClick={() => handleTabChange('analytics')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'analytics'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Platform Analytics
        </button>
      </div>

      {/* TAB 1: Partner Onboarding Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {(['pending', 'approved', 'rejected', 'all'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilter(st)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-full capitalize transition-all min-h-[32px] ${
                    filter === st
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st}
                </button>
              ))}

              <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

              {(['all', 'university', 'industry'] as const).map((org) => (
                <button
                  key={org}
                  onClick={() => setOrgTypeFilter(org)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg capitalize transition-all ${
                    orgTypeFilter === org
                      ? 'bg-muted-foreground/20 text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {org === 'all' ? 'All Types' : org === 'university' ? 'Universities' : 'Industry'}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search organization or nodal officer..."
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-card text-xs text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none min-h-[36px]"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ) : requests.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground border-border rounded-2xl space-y-2">
              <ShieldCheck className="w-10 h-10 mx-auto opacity-40 text-primary" />
              <p className="text-base font-bold text-foreground">No {filter} onboarding requests found.</p>
              <p className="text-xs max-w-sm mx-auto">
                {requestSearch ? `No requests matching "${requestSearch}". Try resetting your search.` : `There are currently no partner accounts with ${filter} status.`}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4" role="list">
              {requests.map((req) => (
                <Card key={req.id} className="p-5 border-border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-xs transition-shadow">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="p-1.5 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                        {req.org_type === 'university' ? <Landmark className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                      </span>
                      <h3 className="text-base font-black text-foreground truncate">{req.org_name}</h3>
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {req.org_type}
                      </span>
                      <Badge variant={req.status === 'approved' ? 'admin' : req.status === 'pending' ? 'student' : 'faculty'}>
                        {req.status}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>Nodal Officer: <strong className="text-foreground">{req.nodal_officer_name}</strong></span>
                      <span>Email: <strong className="text-foreground">{req.official_email}</strong></span>
                      {req.registration_identifier && (
                        <span>ID / Reg: <strong className="text-foreground">{req.registration_identifier}</strong></span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>Applied: {new Date(req.created_at).toLocaleDateString()}</span>
                      {req.reviewed_at && (
                        <span>Reviewed: {new Date(req.reviewed_at).toLocaleDateString()}</span>
                      )}
                    </div>

                    {req.rejection_reason && (
                      <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-xl flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span><strong>Rejection Reason:</strong> {req.rejection_reason}</span>
                      </p>
                    )}
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === req.id}
                        onClick={() => setRejectionModal({ open: true, requestId: req.id, orgName: req.org_name, reason: '' })}
                      >
                        <XCircle className="w-4 h-4 mr-1 text-destructive" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={processingId === req.id}
                        onClick={() => handleApprove(req.id, req.org_name)}
                      >
                        {processingId === req.id ? (
                          <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                        )}
                        Approve
                      </Button>
                    </div>
                  )}

                  {req.status === 'approved' && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold self-end sm:self-center">
                      <UserCheck className="w-4 h-4" /> Active Partner
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Institution Verification Requests */}
      {activeTab === 'institution_requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setInstFilter(st)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-full capitalize transition-all min-h-[32px] ${
                    instFilter === st
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ) : instRequests.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground border-border rounded-2xl">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-primary" />
              <p className="text-sm font-bold text-foreground">No {instFilter.toLowerCase()} institution verification requests.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4" role="list">
              {instRequests.map((req) => (
                <Card key={req.id} className="p-5 border-border rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:shadow-xs transition-shadow">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <Building2 className="w-4 h-4" />
                      </span>
                      <h3 className="text-base font-black text-foreground">{req.requested_name}</h3>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {req.institution_type}
                      </span>
                      <Badge variant={req.status === 'APPROVED' ? 'admin' : req.status === 'PENDING' ? 'student' : 'faculty'}>
                        {req.status}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Location: <strong className="text-foreground">{req.district}, {req.state}</strong>
                      {req.city ? ` (${req.city})` : ''} • Submitted by: {req.submitted_by_email}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      {req.aishe_code && <span>AISHE: <strong className="text-foreground">{req.aishe_code}</strong></span>}
                      {req.ugc_code && <span>UGC: <strong className="text-foreground">{req.ugc_code}</strong></span>}
                      {req.official_website && (
                        <a href={req.official_website} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-0.5">
                          Official Website <ChevronRight className="w-3 h-3" />
                        </a>
                      )}
                      <span>Requested: {new Date(req.created_at).toLocaleDateString()}</span>
                    </div>

                    {req.additional_notes && (
                      <p className="text-xs text-foreground/80 bg-muted/40 p-2.5 rounded-xl italic">
                        "{req.additional_notes}"
                      </p>
                    )}

                    {req.rejection_reason && (
                      <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-xl">
                        <strong>Rejection Reason:</strong> {req.rejection_reason}
                      </p>
                    )}
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="flex items-center gap-2 self-end lg:self-center flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === req.id}
                        onClick={() =>
                          setInstRejectModal({
                            open: true,
                            requestId: req.id,
                            instName: req.requested_name,
                            reason: '',
                          })
                        }
                      >
                        <XCircle className="w-4 h-4 mr-1 text-destructive" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={processingId === req.id}
                        onClick={() => handleApproveInstRequest(req.id, req.requested_name)}
                      >
                        {processingId === req.id ? (
                          <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                        )}
                        Approve into Master
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Institution Master & Sync */}
      {activeTab === 'institution_master' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search master by name or AISHE code..."
                value={masterQuery}
                onChange={(e) => setMasterQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-card text-xs sm:text-sm text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none min-h-[40px]"
              />
            </div>

            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv,.json"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
              <span className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors min-h-[40px]">
                {isUploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Ingesting Dataset...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" /> Import UGC / AISHE Dataset (CSV/JSON)
                  </>
                )}
              </span>
            </label>
          </div>

          <Card className="border-border rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-black text-foreground">Verified Institution Master Records</h3>
              <span className="text-xs text-muted-foreground font-bold">{masterInstitutions.length} shown</span>
            </div>

            {isLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : masterInstitutions.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No institutions found. Import a UGC/AISHE dataset to populate master records.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Institution Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">State / District</th>
                      <th className="p-3">AISHE / UGC</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {masterInstitutions.map((inst) => (
                      <tr key={inst.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3 font-bold">
                          <div>{inst.name}</div>
                          {inst.official_name && inst.official_name !== inst.name && (
                            <div className="text-[10px] text-muted-foreground font-normal">{inst.official_name}</div>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">{inst.institution_type || 'University'}</td>
                        <td className="p-3 text-muted-foreground">{inst.district}, {inst.state}</td>
                        <td className="p-3 text-muted-foreground">{inst.aishe_code || inst.ugc_code || '-'}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">
                            <Check className="w-3 h-3" /> {inst.verification_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {syncLogs.length > 0 && (
            <Card className="p-5 border-border rounded-2xl space-y-3 shadow-2xs">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-primary" /> Dataset Synchronization Logs
              </h3>
              <div className="divide-y divide-border text-xs">
                {syncLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-foreground">{log.source_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Added: <span className="font-bold text-emerald-600 dark:text-emerald-400">{log.records_added}</span> • Updated: {log.records_updated} • Failed: {log.records_failed}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={log.status === 'success' ? 'admin' : log.status === 'partial' ? 'student' : 'faculty'}>
                        {log.status}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(log.started_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 4: Content Moderation Desk */}
      {activeTab === 'moderation' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {(['all', 'submitted', 'under_review', 'verified', 'in_progress', 'solved', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setModStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-full uppercase tracking-wider transition-all min-h-[30px] ${
                    modStatusFilter === st
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
              <select
                value={modCategoryFilter}
                onChange={(e) => setModCategoryFilter(e.target.value)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-card border border-border text-foreground focus:ring-2 focus:ring-primary/40 focus:outline-none min-h-[30px]"
              >
                <option value="all">All Categories</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="sanitation">Sanitation</option>
                <option value="water">Water Supply</option>
                <option value="electricity">Electricity</option>
                <option value="education">Education</option>
                <option value="healthcare">Healthcare</option>
                <option value="environment">Environment</option>
                <option value="traffic">Traffic & Transport</option>
                <option value="agriculture">Agriculture</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search problem title or location..."
                value={modSearch}
                onChange={(e) => setModSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-card text-xs text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none min-h-[36px]"
              />
            </div>
          </div>


          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
          ) : moderationProblems.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground border-border rounded-2xl space-y-2">
              <Compass className="w-10 h-10 mx-auto opacity-40 text-primary" />
              <p className="text-base font-bold text-foreground">No problems found for moderation filter.</p>
              <p className="text-xs">All civic challenge submissions in this category are up to date.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4" role="list">
              {moderationProblems.map((prob) => (
                <Card key={prob.id} className="p-5 border-border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-xs transition-shadow">
                  <div className="space-y-2 min-w-0 max-w-3xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {prob.category}
                      </span>
                      <Badge variant={prob.is_verified ? 'admin' : 'student'}>
                        {prob.is_verified ? 'Official Verified' : 'Community Submission'}
                      </Badge>
                      <Badge variant={prob.status === 'solved' ? 'admin' : prob.status === 'in_progress' ? 'student' : 'faculty'}>
                        {prob.status.replace('_', ' ')}
                      </Badge>
                      <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${
                        prob.impact_level === 'critical' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                      }`}>
                        {prob.impact_level} Impact
                      </span>
                    </div>

                    <h3 className="text-base font-black text-foreground">{prob.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{prob.description}</p>

                    <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>Location: <strong className="text-foreground">{prob.district}, {prob.state}</strong></span>
                      <span>Author: <strong className="text-foreground">{prob.author?.full_name || prob.author?.email || 'Citizen'}</strong></span>
                      <span>Teams Formed: <strong className="text-foreground">{prob.active_teams_count}</strong></span>
                      <span>Endorsements: <strong className="text-foreground">{prob.likes_count}</strong></span>
                      <span>Reported: {new Date(prob.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-center gap-2 self-end md:self-center flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={processingId === prob.id}
                      onClick={() => handleToggleVerifyProblem(prob)}
                    >
                      <Award className={`w-3.5 h-3.5 mr-1 ${prob.is_verified ? 'text-primary fill-primary/20' : ''}`} />
                      {prob.is_verified ? 'Unverify' : 'Verify Challenge'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setStatusModal({
                        open: true,
                        problemId: prob.id,
                        title: prob.title,
                        currentStatus: prob.status,
                        newStatus: prob.status,
                      })}
                    >
                      Change Status
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Security Audit Trail */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {(['all', 'request', 'institution_master', 'institution_request', 'problem'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setAuditTargetFilter(t)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg capitalize transition-all ${
                    auditTargetFilter === t
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter by action keyword..."
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-card text-xs text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none min-h-[36px]"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : auditLogs.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground border-border rounded-2xl">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-primary" />
              <p className="text-sm font-bold text-foreground">No security audit logs found.</p>
            </Card>
          ) : (
            <Card className="p-5 border-border rounded-2xl divide-y divide-border space-y-3 shadow-2xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="pt-3 first:pt-0 flex items-center justify-between text-xs gap-4 flex-wrap">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary font-mono text-[11px] uppercase">{log.action}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                        {log.target_type}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Target ID: <strong className="text-foreground">{log.target_id || 'N/A'}</strong>
                      {log.actor_id && <span> • Actor: <strong className="text-foreground">{log.actor_id.slice(0, 8)}</strong></span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                    {log.metadata_json && Object.keys(log.metadata_json).length > 0 && (
                      <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => setSelectedAuditLog(log)}>
                        <Eye className="w-3 h-3 mr-1" /> Inspect
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* TAB 6: Platform Analytics & Scorecard */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          ) : analytics ? (
            <div className="space-y-6">
              {/* Top Level Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-5 border-border rounded-2xl space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-bold uppercase tracking-wider">Total Platform Users</span>
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-3xl font-black text-foreground">{analytics.total_users}</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                    {analytics.verified_users} verified identities
                  </p>
                </Card>

                <Card className="p-5 border-border rounded-2xl space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-bold uppercase tracking-wider">Civic Challenges</span>
                    <Lightbulb className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-3xl font-black text-foreground">{analytics.total_problems}</p>
                  <p className="text-[11px] text-primary font-bold">
                    {analytics.verified_problems} official challenges
                  </p>
                </Card>

                <Card className="p-5 border-border rounded-2xl space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-bold uppercase tracking-wider">Active Problem Pods</span>
                    <FolderGit2 className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-3xl font-black text-foreground">{analytics.total_projects}</p>
                  <p className="text-[11px] text-muted-foreground font-bold">
                    {analytics.completed_projects} completed prototypes
                  </p>
                </Card>

                <Card className="p-5 border-border rounded-2xl space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-bold uppercase tracking-wider">Verified Colleges / Master</span>
                    <Landmark className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-3xl font-black text-foreground">{analytics.verified_institutions}</p>
                  <p className="text-[11px] text-muted-foreground font-bold">
                    {analytics.pending_institution_requests} pending verifications
                  </p>
                </Card>
              </div>

              {/* Roles Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-5 border-border rounded-2xl space-y-4 shadow-2xs">
                  <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> Ecosystem User Distribution
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Citizens</p>
                      <p className="text-xl font-black text-foreground">{analytics.user_roles.citizens}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Students</p>
                      <p className="text-xl font-black text-foreground">{analytics.user_roles.students}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Faculty Mentors</p>
                      <p className="text-xl font-black text-foreground">{analytics.user_roles.faculty}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Universities</p>
                      <p className="text-xl font-black text-foreground">{analytics.user_roles.universities}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Industry Partners</p>
                      <p className="text-xl font-black text-foreground">{analytics.user_roles.industry}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Admins</p>
                      <p className="text-xl font-black text-foreground">{analytics.user_roles.admins}</p>
                    </div>
                  </div>
                </Card>

                {/* Problem Status Breakdown */}
                <Card className="p-5 border-border rounded-2xl space-y-4 shadow-2xs">
                  <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> Problem Lifecycle Stages
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Submitted</p>
                      <p className="text-lg font-black text-foreground">{analytics.problem_statuses.submitted}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">In Review</p>
                      <p className="text-lg font-black text-foreground">{analytics.problem_statuses.under_review}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">In Progress</p>
                      <p className="text-lg font-black text-foreground">{analytics.problem_statuses.in_progress}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Solved</p>
                      <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{analytics.problem_statuses.solved}</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Category Breakdown */}
              {analytics.categories_breakdown.length > 0 && (
                <Card className="p-5 border-border rounded-2xl space-y-4 shadow-2xs">
                  <h3 className="text-sm font-black text-foreground">Top Societal Challenge Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {analytics.categories_breakdown.map((c) => (
                      <div key={c.category} className="px-3.5 py-2 rounded-xl bg-muted border border-border flex items-center gap-2 text-xs">
                        <span className="font-bold text-foreground capitalize">{c.category}</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black">
                          {c.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <Card className="p-8 text-center text-muted-foreground border-border rounded-2xl">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40 text-primary" />
              <p className="text-sm font-bold text-foreground">No analytics data generated yet.</p>
            </Card>
          )}
        </div>
      )}

      {/* Moderation Status Change Modal */}
      {statusModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6 border-border space-y-4 shadow-xl">
            <h3 className="text-base font-black text-foreground">Moderate Civic Problem Status</h3>
            <p className="text-xs text-muted-foreground truncate">{statusModal.title}</p>
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">New Lifecycle Status:</label>
              <select
                value={statusModal.newStatus}
                onChange={(e) => setStatusModal((prev) => ({ ...prev, newStatus: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-border bg-card text-xs text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none"
              >
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="verified">Verified Challenge</option>
                <option value="in_progress">In Progress (Active Pods)</option>
                <option value="solution_submitted">Solution Submitted</option>
                <option value="pilot">Pilot Testing</option>
                <option value="solved">Solved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={processingId === statusModal.problemId}
                onClick={() => setStatusModal({ open: false, problemId: null, title: '', currentStatus: '', newStatus: '' })}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={processingId === statusModal.problemId}
                onClick={handleUpdateProblemStatus}
              >
                {processingId === statusModal.problemId ? 'Saving...' : 'Save Decision'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Audit Log Inspect Modal */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <Card className="w-full max-w-lg p-6 border-border space-y-4 shadow-xl">
            <h3 className="text-base font-black text-foreground">Audit Log Event Payload</h3>
            <p className="text-xs font-mono text-primary font-bold uppercase">{selectedAuditLog.action}</p>
            <div className="bg-muted/60 p-3 rounded-xl border border-border max-h-60 overflow-y-auto">
              <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap">
                {JSON.stringify(selectedAuditLog.metadata_json, null, 2)}
              </pre>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setSelectedAuditLog(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Rejection Modal for Account Requests */}
      {rejectionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6 border-border space-y-4 shadow-xl">
            <h3 className="text-base font-black text-foreground">Reject Onboarding Application</h3>
            <p className="text-xs text-muted-foreground">Provide a formal reason for rejecting {rejectionModal.orgName}:</p>
            <textarea
              className="w-full rounded-xl border border-border bg-card p-3 text-xs text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none"
              rows={3}
              placeholder="e.g. Incomplete AISHE credentials or unverifiable nodal officer email."
              value={rejectionModal.reason}
              onChange={(e) => setRejectionModal((prev) => ({ ...prev, reason: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={processingId === rejectionModal.requestId}
                onClick={() => setRejectionModal({ open: false, requestId: null, orgName: '', reason: '' })}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={processingId === rejectionModal.requestId}
                onClick={handleReject}
              >
                {processingId === rejectionModal.requestId ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Rejection Modal for Institution Verification Requests */}
      {instRejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6 border-border space-y-4 shadow-xl">
            <h3 className="text-base font-black text-foreground">Reject Institution Verification Request</h3>
            <p className="text-xs text-muted-foreground">Reason for rejecting {instRejectModal.instName}:</p>
            <textarea
              className="w-full rounded-xl border border-border bg-card p-3 text-xs text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none"
              rows={3}
              placeholder="e.g. Could not locate institutional records in official AISHE/UGC state gazettes."
              value={instRejectModal.reason}
              onChange={(e) => setInstRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={processingId === instRejectModal.requestId}
                onClick={() => setInstRejectModal({ open: false, requestId: null, instName: '', reason: '' })}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={processingId === instRejectModal.requestId}
                onClick={handleRejectInstRequest}
              >
                {processingId === instRejectModal.requestId ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};


