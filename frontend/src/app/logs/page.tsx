'use client';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, type AuditLogFilters } from '@/lib/api';
import { Shield } from 'lucide-react';
import type { AuthRole } from 'shared-contracts';
import Link from 'next/link';
import { useUserPreferences } from '@/hooks/useUserPreferences';

export default function LogsPage() {
  const { compactTables, showLiveIndicators } = useUserPreferences();
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<AuthRole | null>(null);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [requestId, setRequestId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filters, setFilters] = useState<AuditLogFilters>({});

  useEffect(() => {
    api.getAuthStatus()
      .then((status) => {
        setAuthenticated(status.authenticated);
        setRole(status.role || null);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  const isAdmin = authenticated && role === 'admin';

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['auditLogs', filters],
    queryFn: () => api.getAuditLogs(filters),
    enabled: authChecked && isAdmin,
  });

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({
      entity: entity.trim() || undefined,
      action: action.trim() || undefined,
      requestId: requestId.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  };

  const resetFilters = () => {
    setEntity('');
    setAction('');
    setRequestId('');
    setDateFrom('');
    setDateTo('');
    setFilters({});
  };

  if (!authChecked) {
    return <div className="max-w-[800px] mx-auto py-20 text-center text-slate-400">Перевірка доступу...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-[520px] mx-auto py-20">
        <div className="glass-card p-8 border-white/10 space-y-6">
          <h2 className="text-2xl font-black text-white">Доступ заборонено</h2>
          <p className="text-sm text-slate-400">Системні логи доступні лише адміністратору.</p>
          <Link href="/admin" className="btn-primary w-full py-3 text-center block">
            Перейти в кабінет адміністратора
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-white/10 pb-6">
        <Shield className="w-8 h-8 text-primary-500" />
        <div>
          <h1 className="text-3xl font-black">Системний Журнал</h1>
          <div className="flex items-center gap-2">
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">Усі журнали дій системи</p>
            {showLiveIndicators && <span className="status-mint text-[10px] font-black uppercase tracking-widest">live</span>}
          </div>
        </div>
      </div>

      <form onSubmit={applyFilters} className="glass-card p-4 border border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <input
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            placeholder="Сутність (entity)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-primary-500 outline-none"
          />
          <input
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="Дія (action)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-primary-500 outline-none"
          />
          <input
            value={requestId}
            onChange={(event) => setRequestId(event.target.value)}
            placeholder="Request ID"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-primary-500 outline-none"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-primary-500 outline-none"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-primary-500 outline-none"
          />
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" onClick={resetFilters} className="btn-secondary !px-4 !py-2 text-xs">
            Скинути
          </button>
          <button type="submit" className="btn-primary !px-4 !py-2 text-xs">
            Застосувати
          </button>
        </div>
      </form>

      {error && (
        <div className="glass-card p-4 border border-rose-500/30 text-rose-300 text-sm">
          Помилка завантаження логів: {error instanceof Error ? error.message : 'невідома помилка'}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 animate-pulse">Завантаження журналів...</div>
        ) : (
          <table className={`w-full ${compactTables ? 'text-xs' : 'text-sm'}`}>
            <thead className="bg-white/5 border-b border-white/5 text-[10px] uppercase font-black tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-6 py-4 text-left">Час</th>
                <th className="px-6 py-4 text-left">Сутність</th>
                <th className="px-6 py-4 text-left">Дія</th>
                <th className="px-6 py-4 text-left">Request ID</th>
                <th className="px-6 py-4 text-left">Деталі</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {logs?.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                    {new Date(log.createdAt).toLocaleString('uk-UA')}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-white/10 px-2 py-1 rounded text-xs font-bold font-mono">
                      {log.entity} #{log.entityId}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-primary-400">
                    {log.action}
                  </td>
                  <td className="px-6 py-4 text-[11px] text-slate-400 font-mono break-all max-w-xs">
                    {log.requestId || '—'}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-500 break-all max-w-md">
                    {log.details || '—'}
                  </td>
                </tr>
              ))}
              {logs?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Журнал порожній
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
