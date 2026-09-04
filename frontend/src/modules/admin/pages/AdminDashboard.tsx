import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { institutionsApi, InstitutionVerificationRequestItem, InstitutionMasterItem, InstitutionSyncRunItem } from '../../../api/institutions';
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
  FileSpreadsheet
} from 'lucide-react';
import toast from 'react-hot-toast';

interface RequestItem {
  id: string;
  user_id: string;
  org_type: 'university' | 'industry';
  org_name: string;
  registration_identifier?: string;
  nodal_officer_name: string;
  official_email: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
}

interface AuditItem {
  id: string;
  actor_id?: string;
  action: string;
  target_type: string;
  target_id?: string;
  metadata_json?: Record<string, unknown>;
  created_at: string;
}

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'requests' | 'institution_requests' | 'institution_master' | 'audit'>('requests');
  const [isLoading, setIsLoading] = useState(true);

  // 1. Account Requests State
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
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

  // 4. Audit State
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'requests') {
        const statusQuery = filter === 'all' ? '' : `?status_filter=${filter}`;
        const reqRes = await apiClient.get(`/admin/requests${statusQuery}`);
        setRequests(reqRes.data?.data || []);
      } else if (activeTab === 'institution_requests') {
        const res = await institutionsApi.listAdminRequests(instFilter);
        setInstRequests(res.data || []);
      } else if (activeTab === 'institution_master') {
        const res = await institutionsApi.listAdminInstitutions({ q: masterQuery || undefined });
        setMasterInstitutions(res.data || []);
        const logsRes = await institutionsApi.listSyncLogs(10);
        setSyncLogs(logsRes.data || []);
      } else if (activeTab === 'audit') {
        const auditRes = await apiClient.get('/admin/audit-logs?limit=40');
        setAuditLogs(auditRes.data?.data || []);
      }
    } catch {
      toast.error('Failed to load admin data.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, filter, instFilter, masterQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Account Request Handlers
  const handleApprove = async (id: string, name: string) => {
    try {
      await apiClient.patch(`/admin/requests/${id}/approve`);
      toast.success(`Approved ${name}`);
      loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(errorObj.response?.data?.error?.message || 'Approval failed.');
    }
  };

  const handleReject = async () => {
    if (!rejectionModal.requestId) return;
    try {
      await apiClient.patch(`/admin/requests/${rejectionModal.requestId}/reject`, {
        rejection_reason: rejectionModal.reason || 'Institutional credentials could not be verified.',
      });
      toast.success(`Rejected request for ${rejectionModal.orgName}`);
      setRejectionModal({ open: false, requestId: null, orgName: '', reason: '' });
      loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(errorObj.response?.data?.error?.message || 'Rejection failed.');
    }
  };

  // Institution Verification Request Handlers
  const handleApproveInstRequest = async (id: string, name: string) => {
    try {
      await institutionsApi.approveRequest(id);
      toast.success(`Approved institution '${name}' into Verified Master!`);
      loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      toast.error(errorObj.response?.data?.message || 'Institution approval failed.');
    }
  };

  const handleRejectInstRequest = async () => {
    if (!instRejectModal.requestId) return;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">National Governance Desk</h1>
            <Badge variant="admin">Admin Authority</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage institutional verification requests, higher education master dataset, and security audit trails
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'requests'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Partner Onboarding Requests
        </button>
        <button
          onClick={() => setActiveTab('institution_requests')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'institution_requests'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Institution Verifications
        </button>
        <button
          onClick={() => setActiveTab('institution_master')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'institution_master'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Institution Master & Sync
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'audit'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Security Audit Trail
        </button>
      </div>

      {/* TAB 1: Partner Onboarding Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
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
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : requests.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground border-border rounded-2xl">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold">No {filter} onboarding requests found.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {requests.map((req) => (
                <Card key={req.id} className="p-5 border-border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        {req.org_type === 'university' ? <Landmark className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                      </span>
                      <h3 className="text-base font-black text-foreground">{req.org_name}</h3>
                      <Badge variant={req.status === 'approved' ? 'admin' : req.status === 'pending' ? 'student' : 'faculty'}>
                        {req.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Nodal Officer: <span className="font-bold text-foreground">{req.nodal_officer_name}</span> • Email: {req.official_email}
                    </p>
                    {req.registration_identifier && (
                      <p className="text-xs text-muted-foreground">Identifier: {req.registration_identifier}</p>
                    )}
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button size="sm" variant="outline" onClick={() => setRejectionModal({ open: true, requestId: req.id, orgName: req.org_name, reason: '' })}>
                        <XCircle className="w-4 h-4 mr-1 text-destructive" /> Reject
                      </Button>
                      <Button size="sm" onClick={() => handleApprove(req.id, req.org_name)}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                      </Button>
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
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold">No {instFilter.toLowerCase()} institution verification requests.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {instRequests.map((req) => (
                <Card key={req.id} className="p-5 border-border rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
                      Location: <span className="font-bold text-foreground">{req.district}, {req.state}</span>
                      {req.city ? ` (${req.city})` : ''} • Submitted by: {req.submitted_by_email}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      {req.aishe_code && <span>AISHE: <span className="font-bold text-foreground">{req.aishe_code}</span></span>}
                      {req.ugc_code && <span>UGC: <span className="font-bold text-foreground">{req.ugc_code}</span></span>}
                      {req.official_website && (
                        <a href={req.official_website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          Website
                        </a>
                      )}
                      <span>Requested: {new Date(req.created_at).toLocaleDateString()}</span>
                    </div>

                    {req.additional_notes && (
                      <p className="text-xs text-foreground/80 bg-muted/40 p-2 rounded-lg italic">
                        "{req.additional_notes}"
                      </p>
                    )}

                    {req.rejection_reason && (
                      <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
                        Rejection Reason: {req.rejection_reason}
                      </p>
                    )}
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="flex items-center gap-2 self-end lg:self-center flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
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
                      <Button size="sm" onClick={() => handleApproveInstRequest(req.id, req.requested_name)}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve into Master
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
          {/* Action Bar: Search & Sync Upload */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter master institutions..."
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

          {/* Master Table */}
          <Card className="border-border rounded-2xl overflow-hidden">
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

          {/* Sync Runs History */}
          {syncLogs.length > 0 && (
            <Card className="p-5 border-border rounded-2xl space-y-3">
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

      {/* TAB 4: Security Audit Trail */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : auditLogs.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground border-border rounded-2xl">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold">No security audit logs found.</p>
            </Card>
          ) : (
            <Card className="p-5 border-border rounded-2xl divide-y divide-border space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="pt-3 first:pt-0 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-primary font-mono text-[11px] uppercase mr-2">{log.action}</span>
                    <span className="text-muted-foreground">Target: {log.target_type} ({log.target_id?.slice(0, 8)})</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Rejection Modal for Account Requests */}
      {rejectionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6 border-border space-y-4">
            <h3 className="text-base font-black text-foreground">Reject Onboarding Application</h3>
            <p className="text-xs text-muted-foreground">Provide a reason for rejecting {rejectionModal.orgName}:</p>
            <textarea
              className="w-full rounded-xl border border-border bg-card p-3 text-xs text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none"
              rows={3}
              placeholder="e.g. Incomplete AISHE credentials or unverifiable nodal officer email."
              value={rejectionModal.reason}
              onChange={(e) => setRejectionModal((prev) => ({ ...prev, reason: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setRejectionModal({ open: false, requestId: null, orgName: '', reason: '' })}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleReject}>
                Confirm Rejection
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Rejection Modal for Institution Verification Requests */}
      {instRejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6 border-border space-y-4">
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
              <Button variant="outline" size="sm" onClick={() => setInstRejectModal({ open: false, requestId: null, instName: '', reason: '' })}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleRejectInstRequest}>
                Confirm Rejection
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
