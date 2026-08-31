import React, { useState, useEffect } from 'react';
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
  metadata_json?: any;
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

  const loadData = async () => {
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
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  const handleApprove = async (id: string, name: string) => {
    try {
      await apiClient.patch(`/admin/requests/${id}/approve`);
      toast.success(`Approved ${name}`);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Approval failed.');
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
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Rejection failed.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">National Governance Desk</h1>
            <Badge variant="admin">Admin Authority</Badge>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Review and approve institutional University and Industry onboarding applications
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'requests'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Institutional Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
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
                className={`px-3 py-1 text-xs font-semibold rounded-full capitalize transition-all ${
                  filter === st
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
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
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No {filter} requests found</h3>
              <p className="text-sm text-slate-500">All institutional applications have been reviewed.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requests.map((req) => (
                <Card key={req.id} className="relative flex flex-col justify-between border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${req.org_type === 'university' ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600' : 'bg-amber-100 dark:bg-amber-950 text-amber-600'}`}>
                          {req.org_type === 'university' ? <Landmark className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">{req.org_name}</h4>
                          <span className="text-xs text-slate-500">{req.org_type.toUpperCase()} • ID: {req.registration_identifier || 'N/A'}</span>
                        </div>
                      </div>
                      <Badge variant={req.status as any}>{req.status}</Badge>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg mb-4">
                      <div><strong className="text-slate-900 dark:text-slate-200">Nodal Representative:</strong> {req.nodal_officer_name}</div>
                      <div><strong className="text-slate-900 dark:text-slate-200">Official Email:</strong> {req.official_email}</div>
                      <div><strong className="text-slate-900 dark:text-slate-200">Applied:</strong> {new Date(req.created_at).toLocaleDateString()}</div>
                      {req.rejection_reason && (
                        <div className="text-red-600 dark:text-red-400 pt-1 border-t border-red-100 dark:border-red-900">
                          <strong>Rejection Reason:</strong> {req.rejection_reason}
                        </div>
                      )}
                    </div>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
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
                        className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/50"
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
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Type</th>
                  <th className="py-3 px-4">Target ID</th>
                  <th className="py-3 px-4">Metadata</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{log.action}</td>
                    <td className="py-3 px-4 capitalize">{log.target_type}</td>
                    <td className="py-3 px-4 font-mono text-slate-500 truncate max-w-[120px]">{log.target_id}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {JSON.stringify(log.metadata_json || {})}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle>Reject Request — {rejectionModal.orgName}</CardTitle>
              <CardDescription>Please provide a reason for the institutional rejection</CardDescription>
            </CardHeader>
            <div className="space-y-4">
              <textarea
                className="w-full h-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
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
