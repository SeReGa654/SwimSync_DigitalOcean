'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { downloadDocxWithRetry } from '@/lib/docx-download';
import { Competition, Event, Entry } from '@/types';
import { msToTime } from '@/lib/utils';
import { localizeEventName } from '@/lib/swim-style';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { Download, FileText, Trophy, ChevronRight, CheckCircle2, Star, Timer, Target } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const RANK_DISPLAY: Record<string, string> = {
  MSMK: 'МСМК', MS: 'МС', KMSU: 'КМСУ',
  R1: 'І', R2: 'ІІ', R3: 'ІІІ',
  Y1: 'І юн.', Y2: 'ІІ юн.', Y3: 'ІІІ юн.',
  NONE: '—',
};

interface Props {
  comp: Competition;
  events: Event[];
  selectedEventId: number | null;
  setSelectedEventId: (id: number | null) => void;
}

export default function ResultsTab({ comp, events, selectedEventId, setSelectedEventId }: Props) {
  const { compactTables, showLiveIndicators } = useUserPreferences();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedEventId) { setEntries([]); return; }
    setLoading(true);
    api.getEntries(selectedEventId).then(setEntries).finally(() => setLoading(false));
  }, [selectedEventId]);

  const handleFinalizeEvent = async () => {
    if (!selectedEventId) return;
    const loadingToast = toast.loading('Фіналізація результатів...');
    try {
      await api.finalizeEvent(selectedEventId);
      const e = await api.getEntries(selectedEventId);
      setEntries(e);
      toast.success('Результати фіналізовано та розряди нараховано!', { id: loadingToast });
    } catch (err) {
      toast.error('Помилка фіналізації', { id: loadingToast });
    }
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const handleDownloadResultDocx = () => {
    void downloadDocxWithRetry({
      kind: 'result-protocol',
      competitionId: comp.id,
      filename: `Results_${comp.name}.docx`,
      protocolLabel: 'фінішний протокол',
    });
  };

  const resolveStatus = (entry: Entry) => {
    const status = entry.result?.status || 'OK';
    if (status !== 'OK') return status;
    return entry.isOutOfCompetition || entry.status === 'PK' ? 'PK' : 'OK';
  };

  const sortedEntries = [...entries]
    .filter(e => e.result)
    .sort((a, b) => {
      const statusOrder = (s: string) => (s === 'OK' ? 0 : s === 'PK' ? 1 : 2);
      const diff = statusOrder(resolveStatus(a)) - statusOrder(resolveStatus(b));
      if (diff !== 0) return diff;
      return (a.result?.place || 999) - (b.result?.place || 999);
    });

  const hasResults = sortedEntries.length > 0;
  const hasFinalizedResults = sortedEntries.some(e => e.result?.place != null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* ──── Sidebar ──── */}
      <aside className="lg:col-span-1">
        <div className="glass-card overflow-hidden border-white/5">
          <div className="px-5 py-4 bg-white/5 flex items-center justify-between border-b border-white/5">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Дистанції</h3>
            <span className="text-xs font-bold text-white/40">{events.length}</span>
          </div>
          <div className="premium-scrollbar max-h-[60vh] overflow-y-auto">
            {events.map((ev, idx) => (
              <motion.div
                initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }}
                key={ev.id}
                className={`flex items-center gap-3 px-5 py-4 cursor-pointer transition-all border-l-2 ${selectedEventId === ev.id
                    ? 'bg-primary-500/10 border-primary-500 text-white shadow-inner shadow-primary-500/5'
                    : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                onClick={() => setSelectedEventId(ev.id)}
              >
                <div className="font-bold truncate text-sm flex-1">{localizeEventName(ev.name)}</div>
                {selectedEventId === ev.id && <ChevronRight className="w-4 h-4 text-primary-400" />}
              </motion.div>
            ))}
          </div>
        </div>
      </aside>

      {/* ──── Main content ──── */}
      <main className="lg:col-span-3 space-y-6">
        <AnimatePresence mode="wait">
          {selectedEvent ? (
            <motion.div
              key={selectedEvent.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-500/20 rounded-2xl flex items-center justify-center text-primary-400 border border-primary-500/20">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-white">{localizeEventName(selectedEvent.name)}</h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                      Фінішні результати та розряди {showLiveIndicators && comp.status === 'active' ? '• live' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={handleFinalizeEvent} className="btn-primary group !px-6 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 group-hover:scale-125 transition-transform" /> Фіналізувати
                  </button>
                  {hasFinalizedResults && (
                    <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
                      <button onClick={() => api.downloadFile(`/export/finish-protocol/${selectedEventId}`, `Results_${localizeEventName(selectedEvent.name)}.xlsx`)}
                        className="p-2.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all transform hover:scale-110">
                        <Download className="w-4 h-4" />
                      </button>
                      <button onClick={handleDownloadResultDocx}
                        className="p-2.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all transform hover:scale-110">
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="py-24 flex justify-center"><div className="w-10 h-10 border-4 border-primary-500/20 border-t-primary-500 animate-spin rounded-full" /></div>
              ) : hasResults ? (
                <div className="glass-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className={`w-full ${compactTables ? 'text-xs' : 'text-sm'}`}>
                      <thead className="bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                        <tr>
                          <th className="px-6 py-4 text-center">Місце</th>
                          <th className="px-6 py-4 text-left">Учасник</th>
                          <th className="px-6 py-4 text-center">Клуб</th>
                          <th className="px-6 py-4 text-right">Результат</th>
                          <th className="px-6 py-4 text-center">Виконано</th>
                          <th className="px-6 py-4 text-right">Очки WA</th>
                          <th className="px-6 py-4 text-center">Статус</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {sortedEntries.map((entry, idx) => {
                          const place = entry.result?.place;
                          const resolvedStatus = resolveStatus(entry);
                          const isOK = resolvedStatus === 'OK';
                          const isOutOfCompetition = resolvedStatus === 'PK';
                          const isMedal = isOK && place && place <= 3;
                          const placeLabel = entry.result?.placeDisplay
                            || (isOK ? place : (isOutOfCompetition ? 'п/к' : resolvedStatus));

                          return (
                            <motion.tr
                              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                              key={entry.id}
                              className={`group transition-all border-b border-white/5 last:border-0 ${isMedal ? 'bg-primary-500/[0.03]' : 'hover:bg-white/[0.03]'}`}
                            >
                              <td className="px-6 py-6 text-center">
                                <span className={`text-2xl font-black ${place === 1 ? 'medal-gold' :
                                    place === 2 ? 'medal-silver' :
                                      place === 3 ? 'medal-bronze' :
                                        'text-slate-600'
                                  }`}>
                                  {placeLabel}
                                </span>
                              </td>
                              <td className="px-6 py-6">
                                <div className="font-black text-slate-200 text-lg">{entry.athlete?.lastName} {entry.athlete?.firstName}</div>
                                <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1 opacity-60">
                                  Рік: {entry.athlete?.birthYear} • Доріжка: {entry.laneNumber || '—'}
                                </div>
                              </td>
                              <td className="px-6 py-6 text-center text-xs text-slate-500 font-medium italic max-w-[200px] truncate">{entry.athlete?.club}</td>
                              <td className="px-6 py-6 text-right font-mono font-black text-xl text-primary-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.3)]">
                                {isOK || isOutOfCompetition
                                  ? msToTime(entry.result?.finishTimeMs)
                                  : <span className="text-red-500">{resolvedStatus}</span>}
                              </td>
                              <td className="px-6 py-6 text-center">
                                {entry.result?.achievedRank && (
                                  <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-500/10 text-primary-400 border border-primary-500/20 rounded-xl text-[10px] font-black tracking-[0.1em] shadow-[0_0_20px_rgba(14,165,233,0.15)]">
                                    <Star className="w-3.5 h-3.5 fill-current" /> {RANK_DISPLAY[entry.result.achievedRank]}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-6 text-right font-mono text-slate-400 font-black">{entry.result?.pointsWa || '—'}</td>
                              <td className="px-6 py-6 text-center">
                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${isOK ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                    resolvedStatus === 'DQ' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                      'bg-slate-500/10 text-slate-500 border border-white/10'
                                  }`}>
                                  {resolvedStatus}
                                </span>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="py-24 glass-card border-dashed flex flex-col items-center justify-center text-slate-600">
                  <Timer className="w-16 h-16 mb-4 opacity-10" />
                  <p className="font-bold text-lg">
                    {comp.status === 'draft' ? 'Змагання в чернетці' : 'Результатів ще немає'}
                  </p>
                  <p className="text-[10px] uppercase font-bold tracking-widest mt-2 max-w-sm text-center leading-relaxed">
                    {comp.status === 'draft' 
                      ? 'Активуйте змагання в налаштуваннях, щоб розпочати введення результатів' 
                      : 'Використовуйте вкладку секретаря для введення часу'}
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 glass-card border-dashed">
              <Target className="w-16 h-16 mb-6 text-slate-700 opacity-20" />
              <p className="text-xl font-bold text-slate-500 uppercase tracking-widest">Результати по дистанціях</p>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
