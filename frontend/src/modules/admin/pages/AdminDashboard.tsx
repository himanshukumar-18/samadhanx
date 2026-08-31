import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { Button } from '../../../shared/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Building2, 
  Landmark, 
  RefreshCw
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
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'requests' | 'audit'>('requests');
  const [rejectionModal, setRejectionModal] = useState<{ open: boolean; requestId: string | null; orgName: string; reason: string }>({
    open: false,
    requestId: null,
    orgName: '',
    reason: '',
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const statusQuery = filter === 'all' ? '' : `?status_filter=${filter}`;
      const reqRes = await apiClient.get(`/admin/requests${statusQuery}`);
      setRequests(reqRes.data?.data || []);

      const auditRes = await apiClient.get('/admin/audit-logs?limit=30');
      setAuditLogs(auditRes.data?.data || []);
    } catch {
      toast.error('Failed to load admin data.');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">National Governance Desk</h1>
            <Badge variant="admin">Admin Authority</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Review and approve institutional University and Industry onboarding applications
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'requests'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Institutional Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'audit'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Security Audit Trail
        </button>
      </div>

      {activeTab === 'requests' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilter(st)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full capitalize transition-all min-h-[32px] ${
                  filter === st
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-44 w-full" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <Card className="text-center py-12">
              <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground">No {filter} requests found</h3>
              <p className="text-sm text-muted-foreground">All institutional applications have been reviewed.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requests.map((req) => (
                <Card key={req.id} className="relative flex flex-col justify-between border-border">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl ${req.org_type === 'university' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600'}`}>
                          {req.org_type === 'university' ? <Landmark className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-foreground">{req.org_name}</h4>
                          <span className="text-xs text-muted-foreground">{req.org_type.toUpperCase()} • ID: {req.registration_identifier || 'N/A'}</span>
                        </div>
                      </div>
                      <Badge variant={req.status}>{req.status}</Badge>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground bg-muted/60 p-3.5 rounded-xl mb-4 border border-border">
                      <div><strong className="text-foreground">Nodal Representative:</strong> {req.nodal_officer_name}</div>
                      <div><strong className="text-foreground">Official Email:</strong> {req.official_email}</div>
                      <div><strong className="text-foreground">Applied:</strong> {new Date(req.created_at).toLocaleDateString()}</div>
                      {req.rejection_reason && (
                        <div className="text-destructive pt-1 border-t border-destructive/20">
                          <strong>Rejection Reason:</strong> {req.rejection_reason}
                        </div>
                      )}
                    </div>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <Button
                        variant="accent"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleApprove(req.id, req.org_name)}
                        leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      >
                        Approve Access
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => setRejectionModal({ open: true, requestId: req.id, orgName: req.org_name, reason: '' })}
                        leftIcon={<XCircle className="w-4 h-4" />}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Card className="overflow-hidden p-0 border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-foreground font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Target Type</th>
                  <th className="py-3.5 px-4">Target ID</th>
                  <th className="py-3.5 px-4">Metadata</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">{log.action}</td>
                    <td className="py-3.5 px-4 capitalize">{log.target_type}</td>
                    <td className="py-3.5 px-4 font-mono text-muted-foreground truncate max-w-[120px]">{log.target_id}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                      {JSON.stringify(log.metadata_json || {})}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {rejectionModal.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-border space-y-4">
            <CardHeader>
              <CardTitle>Reject Request — {rejectionModal.orgName}</CardTitle>
              <CardDescription>Please provide a reason for the institutional rejection</CardDescription>
            </CardHeader>
            <div className="space-y-4">
              <textarea
                className="w-full h-24 rounded-xl border border-border bg-card p-3 text-sm text-foreground focus:ring-2 focus:ring-destructive/40 focus:border-destructive focus:outline-none"
                placeholder="e.g. AISHE code could not be verified in the national database."
                value={rejectionModal.reason}
                onChange={(e) => setRejectionModal({ ...rejectionModal, reason: e.target.value })}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setRejectionModal({ open: false, requestId: null, orgName: '', reason: '' })}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" onClick={handleReject}>
                  Confirm Rejection
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
