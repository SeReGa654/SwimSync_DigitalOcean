'use client';
import { useState, useEffect, use, useMemo } from 'react';
import { ApiClientError, api } from '@/lib/api';
import { downloadDocxWithRetry } from '@/lib/docx-download';
import { Competition, Event, Entry, Result } from '@/types';
import { msToTime, parseTime } from '@/lib/utils';
import { localizeEventName } from '@/lib/swim-style';
import { Trophy, Clock, CheckCircle2, AlertTriangle, Layers, ListOrdered, ChevronRight, Zap, ArrowLeft, Activity, ShieldCheck, Timer, Download, FileText, Undo2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Link from 'next/link';

const DQ_REASONS = [
  'Фальстарт',
  'Неправильний стиль',
  'Порушення повороту',
  'Перешкода іншому',
  'Неспортивна поведінка',
  'Інше'
];

type HeatStatus = 'OK' | 'DQ' | 'DNS' | 'DNF';
type EntryWithPlacedResult = Entry & { result: Result & { place: number } };

interface HeatResultState {
  timeStr: string;
  status: HeatStatus;
  dqReason?: string | null;
}

interface HeatDraftPayload {
  version: 1;
  updatedAt: string;
  values: Record<string, HeatResultState>;
}

const HEAT_DRAFT_STORAGE_PREFIX = 'swimsync:secretary:heat-draft';

export default function SecretaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const compId = Number.parseInt(id, 10);
  const hasValidCompId = Number.isFinite(compId) && compId > 0;
  const [comp, setComp] = useState<Competition | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [compLoading, setCompLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [finalizing, setFinalizing] = useState(false);
  const [selectedHeat, setSelectedHeat] = useState<number>(1);
  const [heatResults, setHeatResults] = useState<Record<number, HeatResultState>>({});
  const [saving, setSaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [heatDraftAutosaveEnabled, setHeatDraftAutosaveEnabled] = useState(true);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [conflictRequestId, setConflictRequestId] = useState<string | undefined>(undefined);
  const [confirmAction, setConfirmAction] = useState<'finalize' | 'unfinalize' | null>(null);

  const load = async (signal?: AbortSignal) => {
    if (!hasValidCompId) {
      setLoadError('Некоректний ідентифікатор змагання.');
      setCompLoading(false);
      return;
    }
    setCompLoading(true);
    try {
      const c = await api.getCompetition(compId, signal ? { signal } : undefined);
      if (signal?.aborted) return;
      setComp(c);
      const ev = await api.getEvents(compId, signal ? { signal } : undefined);
      if (signal?.aborted) return;
      setEvents(ev);
      setLoadError(null);
      if (ev.length > 0) setSelectedEventId(ev[0].id);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setComp(null);
      setEvents([]);
      setSelectedEventId(null);
      setEntries([]);
      setLoadError(error instanceof Error ? error.message : 'Не вдалося завантажити дані змагання');
    } finally {
      if (!signal?.aborted) {
        setCompLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [compId]);

  useEffect(() => {
    let cancelled = false;
    api.getRuntimeFeatureFlags()
      .then((flags) => {
        if (cancelled) return;
        const autosaveFlag = flags.find((flag) => flag.key === 'ff.secretary.heat-draft-autosave');
        setHeatDraftAutosaveEnabled(autosaveFlag ? autosaveFlag.enabled : true);
      })
      .catch(() => {
        if (cancelled) return;
        setHeatDraftAutosaveEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      const controller = new AbortController();
      api.getEntries(selectedEventId, { signal: controller.signal })
        .then(setEntries)
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === 'AbortError') return;
          setEntries([]);
          toast.error(error instanceof Error ? error.message : 'Не вдалося завантажити запливи');
        });
      setSelectedHeat(1);
      setConflictMessage(null);
      setConflictRequestId(undefined);
      setDraftRestored(false);
      return () => controller.abort();
    }
  }, [selectedEventId]);

  useEffect(() => {
    const initialResults: Record<number, HeatResultState> = {};
    entries.forEach(e => {
        if (e.result) {
            const normalizedStatus: HeatStatus = e.result.status === 'DQ' || e.result.status === 'DNS' || e.result.status === 'DNF'
              ? e.result.status
              : 'OK';
            initialResults[e.id] = {
                timeStr: msToTime(e.result.finishTimeMs),
                status: normalizedStatus,
                dqReason: e.result.dqReason
            };
        } else {
            initialResults[e.id] = { timeStr: '', status: 'OK' };
        }
    });
    if (typeof window !== 'undefined' && selectedEventId && heatDraftAutosaveEnabled) {
      const draftKey = `${HEAT_DRAFT_STORAGE_PREFIX}:${compId}:${selectedEventId}:${selectedHeat}`;
      const rawDraft = window.localStorage.getItem(draftKey);
      if (rawDraft) {
        try {
          const parsed = JSON.parse(rawDraft) as HeatDraftPayload;
          Object.entries(parsed.values || {}).forEach(([entryIdRaw, value]) => {
            const entryId = Number(entryIdRaw);
            if (!Number.isFinite(entryId) || !initialResults[entryId]) return;
            const normalizedStatus: HeatStatus = value.status === 'DQ' || value.status === 'DNS' || value.status === 'DNF' ? value.status : 'OK';
            initialResults[entryId] = {
              timeStr: typeof value.timeStr === 'string' ? value.timeStr : '',
              status: normalizedStatus,
              dqReason: typeof value.dqReason === 'string' ? value.dqReason : null,
            };
          });
          setDraftSavedAt(parsed.updatedAt || null);
          setDraftRestored(true);
        } catch {
          window.localStorage.removeItem(draftKey);
          setDraftSavedAt(null);
          setDraftRestored(false);
        }
      } else {
        setDraftSavedAt(null);
        setDraftRestored(false);
      }
    } else if (!heatDraftAutosaveEnabled) {
      setDraftSavedAt(null);
      setDraftRestored(false);
    }
    setHeatResults(initialResults);
  }, [entries, selectedEventId, selectedHeat, compId, heatDraftAutosaveEnabled]);

  const handleFinalize = async () => {
    setConfirmAction('finalize');
  };

  const confirmFinalize = async () => {
    if (!selectedEventId) return;
    setFinalizing(true);
    const toastId = toast.loading('Фіналізація результатів...');
    try {
      await api.finalizeEvent(selectedEventId);
      const all = await api.getEntries(selectedEventId);
      setEntries(all);
      toast.success('Дистанцію фіналізовано!', { id: toastId });
    } catch (error: unknown) {
      console.error('Secretary handleFinalize error', error);
      toast.error('Помилка фіналізації', { id: toastId });
    } finally {
      setFinalizing(false);
    }
  };

  const handleUnfinalize = async () => {
    setConfirmAction('unfinalize');
  };

  const confirmUnfinalize = async () => {
    if (!selectedEventId) return;
    setFinalizing(true);
    const toastId = toast.loading('Скасування фіналізації...');
    try {
      await api.unfinalizeEvent(selectedEventId);
      const all = await api.getEntries(selectedEventId);
      setEntries(all);
      toast.success('Фіналізацію скасовано!', { id: toastId });
    } catch (error: unknown) {
      console.error('Secretary handleUnfinalize error', error);
      toast.error('Помилка', { id: toastId });
    } finally {
      setFinalizing(false);
    }
  };

  const handleTimeChange = (id: number, val: string) => {
    setConflictMessage(null);
    setConflictRequestId(undefined);
    setHeatResults(prev => ({
      ...prev,
      [id]: { ...prev[id], timeStr: val, status: 'OK' }
    }));
  };

  const handleStatusChange = (id: number, s: HeatStatus) => {
    setConflictMessage(null);
    setConflictRequestId(undefined);
    setHeatResults(prev => ({
      ...prev,
      [id]: { ...prev[id], status: s, timeStr: s === 'OK' ? (prev[id]?.timeStr || '') : '' }
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const inputs = document.querySelectorAll('table input');
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = inputs[idx + 1];
      if (nextInput) (nextInput as HTMLInputElement).focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = inputs[idx - 1];
      if (prevInput) (prevInput as HTMLInputElement).focus();
    }
  };

  const handleSave = async () => {
    if (!selectedEventId) return;
    setSaving(true);
    setConflictMessage(null);
    setConflictRequestId(undefined);
    const toastId = toast.loading('Збереження запливу...');
    
    try {
      const resultsToSave = currentEntries.map(entry => {
        const r = heatResults[entry.id] || { timeStr: '', status: 'OK' };
        return {
          entryId: entry.id,
          finishTimeMs: r.status === 'OK' ? parseTime(r.timeStr) : null,
          status: r.status,
          dqReason: r.dqReason,
          version: entry.result?.version || 1
        };
      });

      await api.saveHeatResults(resultsToSave);
      const all = await api.getEntries(selectedEventId);
      setEntries(all);
      if (typeof window !== 'undefined') {
        const draftKey = `${HEAT_DRAFT_STORAGE_PREFIX}:${compId}:${selectedEventId}:${selectedHeat}`;
        window.localStorage.removeItem(draftKey);
      }
      setDraftSavedAt(null);
      setDraftRestored(false);
      toast.success('Заплив збережено!', { id: toastId });
    } catch (err: unknown) {
      if (err instanceof ApiClientError && (err.statusCode === 409 || err.code === 'CONFLICT')) {
        setConflictMessage(err.message || 'Конфлікт версій: дані вже змінено іншим користувачем.');
        setConflictRequestId(err.requestId);
        toast.error('Конфлікт версій. Оновіть дані запливу перед повторним збереженням.', { id: toastId });
        return;
      }
      const message = err instanceof Error ? err.message : 'Невідома помилка';
      toast.error(`Помилка: ${message}`, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const isSuspiciousTime = (ms: number, dist: number) => {
    if (!ms) return false;
    const worldRecord50m = 20000; // 20.00s
    if (dist === 50 && ms < worldRecord50m) return true;
    if (dist === 100 && ms < 40000) return true;
    return false;
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const isFinalized = entries.some((entry) => entry.result?.placeDisplay != null);
  const heatNumbers = entries
    .map((entry) => entry.heatNumber)
    .filter((heatNumber): heatNumber is number => heatNumber !== null);
  const heatsForEvent = Array.from(new Set(heatNumbers)).sort((a, b) => a - b);
  const currentEntries = useMemo(
    () => entries.filter(e => e.heatNumber === selectedHeat),
    [entries, selectedHeat],
  );
  useEffect(() => {
    if (typeof window === 'undefined' || heatDraftAutosaveEnabled || !selectedEventId) return;
    const draftKey = `${HEAT_DRAFT_STORAGE_PREFIX}:${compId}:${selectedEventId}:${selectedHeat}`;
    window.localStorage.removeItem(draftKey);
    setDraftSavedAt(null);
    setDraftRestored(false);
  }, [heatDraftAutosaveEnabled, selectedEventId, selectedHeat, compId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !selectedEventId || currentEntries.length === 0) return;
    if (!heatDraftAutosaveEnabled) return;
    if (comp?.status === 'completed' || isFinalized) return;
    const draftKey = `${HEAT_DRAFT_STORAGE_PREFIX}:${compId}:${selectedEventId}:${selectedHeat}`;
    const values = currentEntries.reduce<Record<string, HeatResultState>>((acc, entry) => {
      const value = heatResults[entry.id] || { timeStr: '', status: 'OK' as HeatStatus };
      acc[String(entry.id)] = {
        timeStr: value.timeStr || '',
        status: value.status,
        dqReason: value.dqReason || null,
      };
      return acc;
    }, {});
    const payload: HeatDraftPayload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      values,
    };
    window.localStorage.setItem(draftKey, JSON.stringify(payload));
    setDraftSavedAt(payload.updatedAt);
  }, [heatResults, currentEntries, selectedEventId, selectedHeat, compId, comp?.status, isFinalized, heatDraftAutosaveEnabled]);

  useEffect(() => {
    setConflictMessage(null);
    setConflictRequestId(undefined);
  }, [selectedHeat]);

  const handleReloadCurrentHeat = async () => {
    if (!selectedEventId) return;
    if (typeof window !== 'undefined') {
      const draftKey = `${HEAT_DRAFT_STORAGE_PREFIX}:${compId}:${selectedEventId}:${selectedHeat}`;
      window.localStorage.removeItem(draftKey);
    }
    setDraftSavedAt(null);
    setDraftRestored(false);
    const all = await api.getEntries(selectedEventId);
    setEntries(all);
    setConflictMessage(null);
    setConflictRequestId(undefined);
    toast.success('Дані запливу оновлено з сервера');
  };

  const entriesWithPlaces = entries.filter(
    (entry): entry is EntryWithPlacedResult => entry.result?.place != null,
  );
  const top3 = [...entriesWithPlaces]
    .sort((a, b) => a.result.place - b.result.place)
    .slice(0, 3);
  const handleDownloadResultDocx = () => {
    if (!comp) return;
    void downloadDocxWithRetry({
      kind: 'result-protocol',
      competitionId: comp.id,
      filename: `Results_${comp.name}.docx`,
      protocolLabel: 'фінішний протокол',
    });
  };

  if (loadError) return <div className="max-w-6xl mx-auto py-20 text-center text-rose-400">{loadError}</div>;
  if (compLoading || !comp) return <div className="max-w-6xl mx-auto py-20 text-center text-slate-400">Завантаження змагання...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={`/competitions/${compId}`} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10 group" aria-label="Назад до змагання">
            <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white" />
          </Link>
          <div>
            <div className="inline-flex items-center gap-2 text-primary-400 text-[10px] font-black uppercase tracking-widest mb-1">
              <Activity className="w-3.5 h-3.5" /> Панель введення даних
            </div>
            <h2 className="text-3xl font-black text-white leading-tight">Секретаріат: {comp.name}</h2>
          </div>
        </div>
        <div className="flex gap-4">
          {comp.status === 'completed' && (
            <div className="flex items-center gap-4 bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/20">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              <div className="text-xs">
                <div className="text-slate-500 font-bold uppercase tracking-tighter">Статус змагання</div>
                <div className="text-blue-400 font-black">АРХІВ (Тільки читання)</div>
              </div>
            </div>
          )}
          <div className="hidden lg:flex items-center gap-4 bg-primary-500/10 px-4 py-2 rounded-xl border border-primary-500/20">
              <Timer className="w-5 h-5 text-primary-400" />
              <div className="text-xs">
                  <div className="text-slate-500 font-bold uppercase tracking-tighter">Режим введення</div>
                  <div className="text-white font-black">M.SS,ms</div>
              </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-1 space-y-6">
          <div className="glass-card overflow-hidden border-white/5">
            <div className="px-5 py-3 bg-white/5 border-b border-white/5">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Дистанції</h3>
            </div>
            <div className="premium-scrollbar max-h-[40vh] overflow-y-auto">
              {events.map(ev => (
                <button key={ev.id} onClick={() => setSelectedEventId(ev.id)}
                  className={`w-full text-left px-5 py-3 text-sm font-bold transition-all border-l-2 ${
                    selectedEventId === ev.id ? 'bg-primary-500/10 border-primary-500 text-white' : 'border-transparent text-slate-400 hover:bg-white/5'
                  }`}>{localizeEventName(ev.name)}</button>
              ))}
            </div>
          </div>

          {selectedEventId && heatsForEvent.length > 0 && (
            <div className="glass-card overflow-hidden border-white/5">
              <div className="px-5 py-3 bg-white/5 border-b border-white/5">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Запливи</h3>
              </div>
              <div className="p-3 grid grid-cols-4 gap-2">
                {heatsForEvent.map(h => (
                  <button key={h} onClick={() => setSelectedHeat(h)}
                    className={`aspect-square rounded-lg text-xs font-black transition-all flex items-center justify-center border ${
                      selectedHeat === h ? 'bg-primary-500 text-white border-primary-400 shadow-lg shadow-primary-500/20' : 'bg-white/5 text-slate-500 border-white/5 hover:border-white/10 hover:text-white'
                    }`}>З{h}</button>
                ))}
              </div>
            </div>
          )}

          {selectedEventId && heatsForEvent.length > 0 && (() => {
            const heatsWithResults = heatsForEvent.filter(h => {
              const hEntries = entries.filter(e => e.heatNumber === h);
              return hEntries.some(e => e.result);
            }).length;
            const total = heatsForEvent.length;
            const pct = total > 0 ? Math.round((heatsWithResults / total) * 100) : 0;
            return (
              <div className="glass-card p-4 border-white/5 space-y-4">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Прогрес</span>
                    <span className="text-xs font-black text-primary-400">{heatsWithResults}/{total}</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
                    </div>
                    {!isFinalized && pct === 100 && (
                        <button onClick={handleFinalize} disabled={finalizing || comp.status === 'completed'} className="btn-primary w-full py-2 flex items-center justify-center gap-2 text-xs">
                          <Trophy className="w-4 h-4" /> Фіналізувати дистанцію
                        </button>
                    )}
                </div>
                
                {isFinalized && (
                  <div className="pt-4 border-t border-white/5 space-y-3">
                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center justify-center gap-1.5 bg-emerald-500/10 py-1.5 rounded-lg border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ФІНАЛІЗОВАНО
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => api.downloadFile(`/export/finish-protocol/${selectedEventId}`, `Results_${selectedEvent?.name}.xlsx`)} className="btn-secondary py-2 text-xs flex items-center justify-center gap-2 group">
                           <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" /> Excel
                        </button>
                        <button onClick={handleDownloadResultDocx} className="btn-secondary py-2 text-xs flex items-center justify-center gap-2 group">
                           <FileText className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" /> Word
                        </button>
                    </div>
                    {comp.status !== 'completed' && (
                        <button onClick={handleUnfinalize} disabled={finalizing} className="w-full text-[10px] font-black text-slate-500 hover:text-amber-500 uppercase tracking-widest flex items-center justify-center gap-1.5 pt-2 transition-colors">
                           <Undo2 className="w-3 h-3" /> Скасувати фіналізацію
                        </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </aside>

        {/* Main area */}
        <main className="lg:col-span-3 space-y-6">
          {/* Mini-Podium Preview */}
          {isFinalized && top3.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                      <div className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
                         <Trophy className="w-3.5 h-3.5" /> Попередні підсумки
                      </div>
                      <h3 className="text-xl font-black text-white">Топ-3 {selectedEvent?.name}</h3>
                  </div>
                  <div className="flex items-end gap-4 h-full">
                     {/* Place 2 */}
                     {top3[1] && (
                        <div className="flex flex-col items-center gap-2 pb-2">
                           <div className="text-xs font-bold text-slate-300 text-center">{top3[1].athlete?.lastName} <br/><span className="text-[10px] text-slate-500">{msToTime(top3[1].result?.finishTimeMs)}</span></div>
                           <div className="w-16 h-12 bg-slate-400/10 border-t-2 border-slate-300/50 rounded-t-lg flex items-center justify-center font-black text-slate-400">2</div>
                        </div>
                     )}
                     {/* Place 1 */}
                     {top3[0] && (
                        <div className="flex flex-col items-center gap-2">
                           <div className="text-xs font-black text-amber-400 text-center drop-shadow-md">{top3[0].athlete?.lastName} <br/><span className="text-[10px] text-amber-400/50">{msToTime(top3[0].result?.finishTimeMs)}</span></div>
                           <div className="w-20 h-16 bg-amber-500/10 border-t-2 border-amber-400/50 rounded-t-lg flex items-center justify-center font-black text-amber-500/80 text-xl shadow-[0_0_20px_rgba(251,191,36,0.1)]">1</div>
                        </div>
                     )}
                     {/* Place 3 */}
                     {top3[2] && (
                        <div className="flex flex-col items-center gap-2 pb-4">
                           <div className="text-xs font-bold text-amber-700 text-center">{top3[2].athlete?.lastName} <br/><span className="text-[10px] text-amber-700/50">{msToTime(top3[2].result?.finishTimeMs)}</span></div>
                           <div className="w-16 h-8 bg-amber-700/10 border-t-2 border-amber-700/50 rounded-t-lg flex items-center justify-center font-black text-amber-700">3</div>
                        </div>
                     )}
                  </div>
               </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {selectedHeat ? (
              <motion.div
                key={`${selectedEventId}-${selectedHeat}`}
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className={`glass-card overflow-hidden ${isFinalized ? 'border-white/5 opacity-80 cursor-not-allowed' : 'border-primary-500/10'}`}
              >
                <div className="bg-white/5 px-6 py-5 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black text-primary-400 uppercase tracking-[0.2em] mb-1">
                      {selectedEvent?.name} • ЗАПЛИВ {selectedHeat}
                    </div>
                    <h3 className="text-xl font-black text-white">Введення результатів запливу</h3>
                    {heatDraftAutosaveEnabled && draftRestored && (
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-amber-400">
                        Відновлено локальну чернетку запливу
                      </p>
                    )}
                  </div>
                  <button onClick={handleSave} disabled={saving || comp.status === 'completed' || isFinalized} className="btn-primary group !px-6 flex items-center gap-2 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-transparent">
                    <Save className="w-4 h-4 group-hover:scale-110 transition-transform" /> {saving ? 'Збереження...' : (comp.status === 'completed' || isFinalized) ? 'Заблоковано' : 'Зберегти заплив'}
                  </button>
                </div>
                {conflictMessage && (
                  <div className="mx-6 mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-rose-400">Конфлікт версій</p>
                    <p className="mt-2 text-sm text-rose-100">{conflictMessage}</p>
                    {conflictRequestId && (
                      <p className="mt-1 text-[10px] font-mono text-rose-300/80">Request ID: {conflictRequestId}</p>
                    )}
                    <button onClick={() => void handleReloadCurrentHeat()} className="mt-3 btn-secondary !px-4 !py-2 text-xs">
                      Оновити дані запливу
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                    <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-white/5">
                        <tr>
                        <th className="px-6 py-4 w-20 text-center">Дор.</th>
                        <th className="px-6 py-4 text-left">Спортсмен</th>
                        <th className="px-6 py-4 w-56 text-right font-black">Час фінішу</th>
                        <th className="px-6 py-4 w-48 text-center">Статус</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-sans">
                        {currentEntries.map((entry, idx) => {
                        const r = heatResults[entry.id] || { timeStr: '', status: 'OK' };
                        const timeMs = parseTime(r.timeStr);
                        const suspicious = r.status === 'OK' && timeMs && selectedEvent && isSuspiciousTime(timeMs, selectedEvent.distance);
                        const isFilled = r.timeStr.length > 0 || r.status !== 'OK';

                        return (
                            <tr key={entry.id} className={`transition-colors ${isFilled ? 'bg-white/[0.01]' : 'hover:bg-white/[0.02]'}`}>
                            <td className="px-6 py-6 text-center">
                                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mx-auto text-lg font-black italic text-primary-500">
                                    {entry.laneNumber}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-black text-slate-200 text-base">{entry.athlete?.lastName} {entry.athlete?.firstName}</div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                    {entry.athlete?.club} • Заяв: {msToTime(entry.entryTimeMs)}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="relative group">
                                    <input
                                    value={r.status !== 'OK' ? '' : r.timeStr}
                                    onChange={e => handleTimeChange(entry.id, e.target.value)}
                                    onKeyDown={e => handleKeyDown(e, idx)}
                                    disabled={r.status !== 'OK' || comp.status === 'completed' || isFinalized}
                                    className={`w-full text-right font-mono text-xl font-black rounded-2xl border px-5 py-3 focus:outline-none transition-all ${
                                    suspicious ? 'border-red-500 bg-red-500/10 text-red-400' :
                                    (r.status !== 'OK' || comp.status === 'completed' || isFinalized) ? 'bg-white/5 text-slate-600 border-white/5 cursor-not-allowed opacity-50' :
                                    entry.result ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400 focus:border-emerald-500' :
                                    'bg-white/5 border-white/10 text-white focus:border-primary-500 focus:bg-primary-500/5'
                                    }`}
                                    placeholder="0:00,00"
                                    autoComplete="off"
                                />

                                {suspicious && (
                                    <div className="absolute right-0 -bottom-6 flex items-center gap-1 text-red-500 text-[9px] font-black uppercase overflow-hidden whitespace-nowrap">
                                    <AlertTriangle className="w-3 h-3" /> Підозріло швидкий час!
                                    </div>
                                )}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-1">
                                {(['OK', 'DQ', 'DNS', 'DNF'] as HeatStatus[]).map(s => (
                                    <button key={s} 
                                    disabled={comp.status === 'completed' || isFinalized}
                                    onClick={() => handleStatusChange(entry.id, s)}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                                        r.status === s
                                        ? s === 'OK' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' :
                                            s === 'DQ' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-slate-700 text-white'
                                        : (comp.status === 'completed' || isFinalized) ? 'text-slate-700' : 'text-slate-500 hover:text-slate-300'
                                    }`}>{s}</button>
                                ))}

                                </div>
                                {r.status === 'DQ' && (
                                    <div className="mt-2">
                                        <select 
                                            value={r.dqReason || DQ_REASONS[0]} 
                                            onChange={e => setHeatResults(prev => ({ ...prev, [entry.id]: { ...prev[entry.id], dqReason: e.target.value } }))}
                                            disabled={comp.status === 'completed' || isFinalized}
                                            className="w-full text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-md py-1 px-2 focus:outline-none focus:border-red-500 font-bold uppercase tracking-widest cursor-pointer"
                                        >
                                            {DQ_REASONS.map(reason => <option key={reason} value={reason} className="bg-slate-900">{reason}</option>)}
                                        </select>
                                    </div>
                                )}
                            </td>
                            </tr>
                        );
                        })}
                    </tbody>
                    </table>
                </div>
                
                <div className="bg-white/5 px-6 py-4 border-t border-white/5 flex items-center gap-3 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500/50" /> Використовуйте <kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/10 font-mono text-white mx-1">Enter</kbd> або <span className="mx-1">↓</span> для швидкого переходу
                    {heatDraftAutosaveEnabled && draftSavedAt && (
                      <span className="ml-auto text-amber-400">
                        Чернетка: {new Date(draftSavedAt).toLocaleTimeString('uk-UA')}
                      </span>
                    )}
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 glass-card border-dashed">
                <Zap className="w-16 h-16 mb-6 text-slate-700 opacity-20" />
                <p className="text-xl font-bold text-slate-500 uppercase tracking-[0.2em]">Виберіть дистанцію та заплив</p>
                <p className="text-xs text-slate-600 mt-2 italic">Ми автоматично завантажуємо перший заплив при виборі дистанції</p>
              </div>
            )}
          </AnimatePresence>
        </main>
      </div>
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction === 'finalize' ? 'Фіналізувати дистанцію?' : 'Скасувати фіналізацію?'}
        description={
          confirmAction === 'finalize'
            ? 'Результати потраплять у загальний залік, а бали будуть нараховані автоматично.'
            : 'Всі зайняті місця будуть скинуті, і дистанція повернеться в режим редагування.'
        }
        confirmText={confirmAction === 'finalize' ? 'Так, фіналізувати' : 'Так, скасувати'}
        cancelText="Скасувати"
        danger={confirmAction === 'finalize'}
        loading={finalizing}
        onConfirm={() => {
          if (confirmAction === 'finalize') {
            void confirmFinalize();
          } else if (confirmAction === 'unfinalize') {
            void confirmUnfinalize();
          }
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
