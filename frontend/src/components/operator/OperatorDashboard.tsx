'use client';

import { useEffect, useMemo, useState } from 'react';
import { ApiClientError, api } from '@/lib/api';
import type { DependenciesReadinessResponse, MetricsResponse } from 'shared-contracts';
import { Activity, RefreshCw, Server } from 'lucide-react';
import { toast } from 'sonner';

type ServiceCheckKey = keyof DependenciesReadinessResponse['checks'];

const SERVICE_LABELS: Record<ServiceCheckKey, string> = {
  database: 'Database (app)',
  docx: 'DOCX service',
  redis: 'Redis',
  postgres: 'PostgreSQL',
};

export default function OperatorDashboard() {
  const [loading, setLoading] = useState(false);
  const [dependencies, setDependencies] = useState<DependenciesReadinessResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [prometheusRaw, setPrometheusRaw] = useState('');

  const loadOperatorData = async () => {
    setLoading(true);
    try {
      const [deps, snapshot, prometheus] = await Promise.all([
        api.getDependenciesStatus(),
        api.getMetricsSnapshot(),
        api.getPrometheusMetrics(),
      ]);
      setDependencies(deps);
      setMetrics(snapshot);
      setPrometheusRaw(prometheus);
    } catch (error: unknown) {
      if (error instanceof ApiClientError && error.statusCode === 401) return;
      toast.error(error instanceof Error ? error.message : 'Не вдалося завантажити операційні метрики');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOperatorData();
  }, []);

  const prometheusPreview = useMemo(() => {
    return prometheusRaw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('swimsync_'))
      .slice(0, 12)
      .join('\n');
  }, [prometheusRaw]);
  const prometheusUrl = process.env.NODE_ENV === 'production' ? null : 'http://localhost:9090';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Server className="w-8 h-8 text-primary-400" />
          <div>
            <h1 className="text-3xl font-black">Операторський екран</h1>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">Health + metrics + Prometheus</p>
          </div>
        </div>
        <button onClick={() => void loadOperatorData()} disabled={loading} className="btn-secondary !px-4 !py-2 text-xs flex items-center gap-2 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Оновити
        </button>
      </div>

      <div className="glass-card p-5 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white">Сервіси інфраструктури</h2>
          <span className={`text-xs font-black uppercase tracking-widest ${dependencies?.status === 'ok' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {dependencies?.status === 'ok' ? 'ok' : 'degraded'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {(Object.keys(SERVICE_LABELS) as ServiceCheckKey[]).map((key) => {
            const state = dependencies?.checks[key];
            return (
              <div key={key} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase font-black tracking-widest text-slate-500">{SERVICE_LABELS[key]}</p>
                <p className={`mt-2 text-sm font-black ${state === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {state === 'up' ? 'UP' : 'DOWN'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5 border border-white/10">
          <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-primary-400" /> Ключові метрики</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase font-black tracking-widest text-slate-500">Uptime</p>
              <p className="mt-2 font-black text-slate-200">{metrics?.processUptimeSec ?? 0}s</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase font-black tracking-widest text-slate-500">Memory RSS</p>
              <p className="mt-2 font-black text-slate-200">{metrics?.memoryRssMb ?? 0} MB</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase font-black tracking-widest text-slate-500">HTTP Requests</p>
              <p className="mt-2 font-black text-slate-200">{metrics?.totalRequests ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase font-black tracking-widest text-slate-500">HTTP Errors</p>
              <p className="mt-2 font-black text-slate-200">{metrics?.totalErrors ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 col-span-2">
              <p className="text-xs uppercase font-black tracking-widest text-slate-500">Avg latency</p>
              <p className="mt-2 font-black text-slate-200">{metrics?.averageLatencyMs ?? 0} ms</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-white">Prometheus (sample)</h2>
            {prometheusUrl ? (
              <a href={prometheusUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-400 hover:text-primary-300">
                Відкрити Prometheus
              </a>
            ) : (
              <span className="text-xs text-slate-500">Prometheus сховано в production</span>
            )}
          </div>
          <pre className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-slate-300 overflow-auto max-h-[340px]">
            {prometheusPreview || 'Немає доступних метрик swimsync_*'}
          </pre>
        </div>
      </div>
    </div>
  );
}
