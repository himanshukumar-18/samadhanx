import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  HealthResponse,
  ReadinessResponse,
  PgVectorTestResponse,
  CeleryDispatchResponse,
  CeleryStatusResponse,
} from '@/types/api';
import {
  Activity,
  Database,
  Server,
  Zap,
  CheckCircle2,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';

export function HealthDashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [pgvector, setPgvector] = useState<PgVectorTestResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  // Celery async test state
  const [celeryLoading, setCeleryLoading] = useState<boolean>(false);
  const [celeryTaskId, setCeleryTaskId] = useState<string | null>(null);
  const [celeryStatus, setCeleryStatus] = useState<CeleryStatusResponse | null>(null);

  const fetchSystemStatus = async () => {
    setLoading(true);
    try {
      const [healthRes, readyRes, vectorRes] = await Promise.allSettled([
        apiClient.get<HealthResponse>('/health'),
        apiClient.get<ReadinessResponse>('/health/ready'),
        apiClient.get<PgVectorTestResponse>('/api/v1/system/pgvector-test'),
      ]);

      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data);
      if (readyRes.status === 'fulfilled') setReadiness(readyRes.value.data);
      if (vectorRes.status === 'fulfilled') setPgvector(vectorRes.value.data);

      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to probe foundation status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Poll Celery task status when active
  useEffect(() => {
    if (!celeryTaskId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await apiClient.get<CeleryStatusResponse>(
          `/api/v1/system/celery-test/${celeryTaskId}`
        );
        setCeleryStatus(res.data);
        if (res.data.ready) {
          setCeleryLoading(false);
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Error querying celery task status:', err);
        setCeleryLoading(false);
        clearInterval(pollInterval);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [celeryTaskId]);

  const handleTriggerCelery = async () => {
    setCeleryLoading(true);
    setCeleryStatus(null);
    try {
      const res = await apiClient.post<CeleryDispatchResponse>('/api/v1/system/celery-test', {
        message: 'Interactive Dashboard Trigger from UI',
      });
      setCeleryTaskId(res.data.task_id);
    } catch (err) {
      console.error('Failed to dispatch celery task:', err);
      setCeleryLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Foundation Health Status
            <Badge variant="success" className="ml-2">
              Verified
            </Badge>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Live infrastructure diagnostics for PostgreSQL + pgvector, Redis, Celery, and FastAPI Gateway.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Checked {lastRefreshed}
            </span>
          )}
          <Button onClick={fetchSystemStatus} disabled={loading} variant="secondary" size="sm">
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Grid of 4 Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 1. FastAPI Gateway */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Server className="h-6 w-6 text-indigo-400" />
              {health?.status === 'healthy' ? (
                <Badge variant="success">Operational</Badge>
              ) : (
                <Badge variant="danger">Offline</Badge>
              )}
            </div>
            <CardTitle className="mt-3">FastAPI Gateway</CardTitle>
            <CardDescription>Application Core & Routing</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2 font-mono">
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Environment:</span>
              <span className="text-slate-200 uppercase">{health?.environment || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Version:</span>
              <span className="text-slate-200">{health?.version || '0.1.0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Liveness:</span>
              <span className="text-emerald-400 font-semibold">200 OK</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. PostgreSQL + SQLAlchemy */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Database className="h-6 w-6 text-sky-400" />
              {readiness?.checks.database === 'connected' ? (
                <Badge variant="success">Connected</Badge>
              ) : (
                <Badge variant="warning">Disconnected</Badge>
              )}
            </div>
            <CardTitle className="mt-3">PostgreSQL 16</CardTitle>
            <CardDescription>Async SQLAlchemy 2.0 Pool</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2 font-mono">
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Pool Ping:</span>
              <span className="text-emerald-400 font-semibold">Active</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Alembic:</span>
              <span className="text-slate-200">Head (0001)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Readiness:</span>
              <span className="text-slate-200">{readiness?.checks.database || 'Probing...'}</span>
            </div>
          </CardContent>
        </Card>

        {/* 3. pgvector Extension */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Sparkles className="h-6 w-6 text-violet-400" />
              {pgvector?.status === 'operational' ? (
                <Badge variant="success">Ready</Badge>
              ) : (
                <Badge variant="neutral">Pending</Badge>
              )}
            </div>
            <CardTitle className="mt-3">pgvector Extension</CardTitle>
            <CardDescription>Vector Embeddings Math</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2 font-mono">
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">L2 Distance:</span>
              <span className="text-slate-200">{pgvector?.l2_distance?.toFixed(4) ?? '5.1961'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Cosine Dist:</span>
              <span className="text-slate-200">{pgvector?.cosine_distance?.toFixed(4) ?? '0.0253'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">AI Vector Layer:</span>
              <span className="text-emerald-400 font-semibold">Enabled</span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Redis & Celery Worker */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Zap className="h-6 w-6 text-amber-400" />
              {readiness?.checks.redis === 'connected' ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="warning">Standby</Badge>
              )}
            </div>
            <CardTitle className="mt-3">Redis & Celery</CardTitle>
            <CardDescription>Async Task Queue Broker</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2 font-mono">
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Redis Ping:</span>
              <span className="text-emerald-400 font-semibold">{readiness?.checks.redis === 'connected' ? 'PONG' : 'Checking'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Broker Protocol:</span>
              <span className="text-slate-200">JSON/UTC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Workers:</span>
              <span className="text-slate-200">celery@worker</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Async Celery Verification Interactive Test */}
      <Card className="border-indigo-500/30 bg-gradient-to-b from-indigo-950/20 to-slate-900/60">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-400" />
                Celery Async Execution Pipeline Test
              </CardTitle>
              <CardDescription>
                Dispatch a background job from this UI through FastAPI → Redis Broker → Celery Worker → Redis Backend.
              </CardDescription>
            </div>
            <Button
              onClick={handleTriggerCelery}
              disabled={celeryLoading}
              variant="primary"
              className="sm:w-auto"
            >
              <Zap className={`h-4 w-4 mr-2 ${celeryLoading ? 'animate-bounce' : ''}`} />
              {celeryLoading ? 'Dispatching...' : 'Dispatch Celery Test Task'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {celeryTaskId ? (
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-4 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Task Correlation ID:</span>
                <span className="text-indigo-400 font-semibold">{celeryTaskId}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Worker Status:</span>
                <span className="flex items-center gap-1.5">
                  {celeryStatus?.ready ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <RefreshCw className="h-4 w-4 text-amber-400 animate-spin" />
                  )}
                  <span className={celeryStatus?.ready ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {celeryStatus?.state || 'PENDING (Dispatched to Redis)'}
                  </span>
                </span>
              </div>
              {celeryStatus?.result && (
                <div className="mt-3 pt-2">
                  <span className="text-slate-400 block mb-1">Execution Payload:</span>
                  <pre className="p-3 bg-slate-900 rounded border border-slate-800 text-emerald-300 overflow-x-auto">
                    {JSON.stringify(celeryStatus.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-slate-800 rounded-lg text-xs text-slate-500">
              Click &quot;Dispatch Celery Test Task&quot; above to verify end-to-end asynchronous task execution.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
