'use client';
import { useEffect, useState, use } from 'react';
import { downloadDocxWithRetry } from '@/lib/docx-download';
import { ListOrdered, Trophy, Settings, Upload, Play, Eye, Zap, Waves, MapPin, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Link from 'next/link';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { ApiClientError, api } from '@/lib/api';

import { Competition, Event } from '@/types';
import EventsTab from './tabs/EventsTab';
import ResultsTab from './tabs/ResultsTab';
import SettingsTab from './tabs/SettingsTab';
import StandingsTab from './tabs/StandingsTab';

type Tab = 'events' | 'results' | 'standings' | 'settings';

export default function CompetitionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { compactTables, showLiveIndicators } = useUserPreferences();
  const { id } = use(params);
  const compId = Number.parseInt(id, 10);
  const hasValidCompId = Number.isFinite(compId) && compId > 0;
  const [comp, setComp] = useState<Competition | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [tab, setTab] = useState<Tab>('events');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorStatus, setLoadErrorStatus] = useState<number | null>(null);

  const load = async (signal?: AbortSignal) => {
    if (!hasValidCompId) {
      setLoadError('Некоректний ідентифікатор змагання.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const c = await api.getCompetition(compId, signal ? { signal } : undefined);
      if (signal?.aborted) return;
      setComp(c);
      const ev = await api.getEvents(compId, signal ? { signal } : undefined);
      if (signal?.aborted) return;
      setEvents(ev);
      setLoadError(null);
      setLoadErrorStatus(null);
      if (!selectedEventId && ev.length > 0) {
        setSelectedEventId(ev[0].id);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setComp(null);
      setEvents([]);
      setLoadErrorStatus(error instanceof ApiClientError ? error.statusCode : null);
      setLoadError(error instanceof Error ? error.message : 'Не вдалося завантажити змагання');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [compId]);

  useEffect(() => {
    if (!comp) return;
    localStorage.setItem('swimsync:last-competition-context', JSON.stringify({
      id: comp.id,
      name: comp.name,
      viewedAt: new Date().toISOString(),
    }));
  }, [comp]);

  if (loadError) {
    const isAccessError = loadErrorStatus === 401 || loadErrorStatus === 403;
    return (
      <div className="max-w-[760px] mx-auto py-20">
        <div className="glass-card p-8 border-white/10 space-y-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            {isAccessError ? 'Потрібен вхід' : 'Помилка завантаження'}
          </p>
          <h1 className="text-3xl font-black text-white">
            {isAccessError ? 'Це змагання доступне лише після авторизації' : 'Не вдалося відкрити змагання'}
          </h1>
          <p className="text-sm text-slate-400">{loadError}</p>
          <div className="flex flex-wrap gap-3">
            {isAccessError ? (
              <>
                <Link href="/login" className="btn-primary">Увійти в систему</Link>
                <Link href="/competitions" className="btn-secondary">До списку змагань</Link>
              </>
            ) : (
              <>
                <Link href="/competitions" className="btn-primary">До списку змагань</Link>
                <Link href="/login" className="btn-secondary">Увійти</Link>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
  if (loading || !comp) return <div className="text-center py-24 text-slate-500 animate-pulse">Завантаження...</div>;

  const tabs = [
    { key: 'events', label: 'Дистанції', icon: ListOrdered },
    { key: 'results', label: 'Результати', icon: Trophy },
    { key: 'standings', label: 'Залік', icon: Layers },
    { key: 'settings', label: 'Налаштування', icon: Settings },
  ] as const;
  const canImport = comp.status !== 'completed';
  const canRunSecretary = comp.status !== 'draft';
  const canGenerateSeeding = comp.status !== 'completed' && events.length > 0;
  const blockedImportReason = 'Імпорт заблоковано: змагання в архіві (completed).';
  const blockedSecretaryReason = 'Керування недоступне у чернетці. Переведіть змагання в статус active.';
  const blockedSeedingReason = comp.status === 'completed'
    ? 'Генерація запливів заблокована: змагання в архіві.'
    : 'Немає дистанцій для жеребкування.';
  const blockedActions = [
    !canImport ? blockedImportReason : null,
    !canRunSecretary ? blockedSecretaryReason : null,
    !canGenerateSeeding ? blockedSeedingReason : null,
  ].filter((message): message is string => Boolean(message));
  const statusLabel = comp.status === 'active'
    ? (showLiveIndicators ? '● Live' : 'Активне')
    : comp.status === 'completed'
      ? 'Завершене'
      : 'Чернетка';
  const nextStep =
    comp.status === 'draft'
      ? { type: 'link' as const, title: 'Наступний крок: імпорт заявок', description: 'Після заповнення даних відкрийте імпорт і завантажте файл учасників.', href: `/competitions/${compId}/import`, label: 'Відкрити імпорт' }
      : comp.status === 'active'
        ? { type: 'link' as const, title: 'Наступний крок: секретар і live-табло', description: 'Вносьте результати у секретарі та діліться public live-посиланням.', href: `/competitions/${compId}/live`, label: 'Відкрити live' }
        : { type: 'action' as const, title: 'Наступний крок: перевірка результатів', description: 'Перегляньте підсумки та експортуйте офіційні протоколи.', label: 'Показати результати' };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Header card */}
      <div className="glass-card p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-primary-500/10 shadow-primary-500/5">
        <div className="space-y-3">
          <div className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
            comp.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            comp.status === 'completed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
            'bg-slate-500/10 text-slate-400 border-white/10'
          }`}>
            {statusLabel}
          </div>
          <h2 className="text-4xl font-black tracking-tight">{comp.name}</h2>
          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary-400" /> {comp.location}
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary-400" /> {comp.poolLength}м • {comp.lanes} доріжок
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 flex-wrap">
          {canImport ? (
            <Link href={`/competitions/${compId}/import`} className="btn-secondary flex items-center gap-2 !px-4 !py-2 text-xs">
              <Upload className="w-4 h-4" /> Імпорт
            </Link>
          ) : (
            <button disabled title={blockedImportReason} className="btn-secondary flex items-center gap-2 !px-4 !py-2 text-xs opacity-50 cursor-not-allowed">
              <Upload className="w-4 h-4" /> Імпорт
            </button>
          )}
          {canRunSecretary ? (
            <Link href={`/competitions/${compId}/secretary`} className="btn-primary flex items-center gap-2 !px-4 !py-2 text-xs">
              <Play className="w-4 h-4" /> Керування
            </Link>
          ) : (
            <button disabled title={blockedSecretaryReason} className="btn-primary flex items-center gap-2 !px-4 !py-2 text-xs opacity-50 cursor-not-allowed">
              <Play className="w-4 h-4" /> Керування
            </button>
          )}
          <button
            disabled={generating || !canGenerateSeeding}
            title={!canGenerateSeeding ? blockedSeedingReason : undefined}
            onClick={async () => {
              setGenerating(true);
              try {
                await api.generateAllSeeding(compId);
                toast.success('Запливи згенеровано!');
                await downloadDocxWithRetry({
                  kind: 'start-protocol',
                  competitionId: compId,
                  filename: `Стартовий_протокол_${comp.name.replace(/\s+/g, '_')}.docx`,
                  protocolLabel: 'стартовий протокол',
                });
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : 'Помилка');
              } finally {
                setGenerating(false);
              }
            }}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-violet-600/20"
          >
            <Zap className={`w-4 h-4 ${generating ? 'animate-bounce' : ''}`} /> 
            {generating ? 'Генеруємо...' : 'Запливи + Протокол'}
          </button>
          <Link href={`/competitions/${compId}/live`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-slate-400 hover:text-white"
            title="Live Табло"
            aria-label="Відкрити live-табло">
            <Eye className="w-5 h-5" />
          </Link>
        </div>
      </div>
      <div className="glass-card p-5 border-white/10 bg-white/[0.03] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{nextStep.title}</p>
          <p className="text-sm text-slate-300 mt-1">{nextStep.description}</p>
        </div>
        {nextStep.type === 'action' ? (
          <button type="button" onClick={() => setTab('results')} className="btn-primary w-fit">
            {nextStep.label}
          </button>
        ) : (
          <Link href={nextStep.href} className="btn-primary w-fit">
            {nextStep.label}
          </Link>
        )}
      </div>
      {blockedActions.length > 0 && (
        <div className={`glass-card ${compactTables ? 'p-4' : 'p-5'} border-amber-500/20 bg-amber-500/5`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            Обмеження для поточного статусу
          </p>
          <div className="mt-3 space-y-1.5">
            {blockedActions.map((message) => (
              <p key={message} className="text-sm text-slate-200">• {message}</p>
            ))}
          </div>
        </div>
      )}

      {/* Tabs list */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-2xl w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
              tab === t.key 
                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={tab} 
          initial={{ opacity: 0, y: 5 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: -5 }} 
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {tab === 'events' && (
            <EventsTab 
              comp={comp} 
              compId={compId} 
              events={events} 
              selectedEventId={selectedEventId} 
              setSelectedEventId={setSelectedEventId} 
              load={load} 
            />
          )}
          {tab === 'results' && (
            <ResultsTab 
              comp={comp} 
              events={events} 
              selectedEventId={selectedEventId} 
              setSelectedEventId={setSelectedEventId} 
            />
          )}
          {tab === 'settings' && (
            <SettingsTab 
              comp={comp} 
              load={load} 
            />
          )}
          {tab === 'standings' && (
            <StandingsTab compId={compId} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
