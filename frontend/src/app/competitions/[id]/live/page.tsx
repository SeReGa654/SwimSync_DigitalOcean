'use client';
import { useEffect, useState, use, useCallback } from 'react';
import { api } from '@/lib/api';
import { Competition, Entry, Event, Result } from '@/types';
import { msToTime } from '@/lib/utils';
import { localizeEventName } from '@/lib/swim-style';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

const RANK_DISPLAY: Record<string, string> = {
  MSMK: 'МСМК', MS: 'МС', KMSU: 'КМСУ',
  R1: 'І', R2: 'ІІ', R3: 'ІІІ',
  Y1: 'І юн.', Y2: 'ІІ юн.', Y3: 'ІІІ юн.',
  NONE: '—',
};

type LiveEntry = Entry & { result: Result };

export default function LiveResults({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const compId = parseInt(id);
  const [comp, setComp] = useState<Competition | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [results, setResults] = useState<LiveEntry[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadResults = useCallback(async (eventId: number) => {
    const entries = await api.getEntries(eventId);
    const withResults = entries.filter((e): e is LiveEntry => Boolean(e.result));
    withResults.sort((a, b) => {
      if (a.result.status !== 'OK' && b.result.status !== 'OK') return 0;
      if (a.result.status !== 'OK') return 1;
      if (b.result.status !== 'OK') return -1;
      return (a.result.place || 999) - (b.result.place || 999);
    });
    setResults(withResults);
    setLastUpdate(new Date());
  }, []);

  useEffect(() => {
    (async () => {
      const c = await api.getCompetition(compId);
      setComp(c);
      const ev = await api.getEvents(compId);
      setEvents(ev);
      if (ev.length > 0) {
        setSelectedEventId(ev[0].id);
        loadResults(ev[0].id);
      }
    })();
  }, [compId, loadResults]);

  // Socket.io connection for live updates
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    const socket = io(`${wsUrl}/live`, { transports: ['websocket'] });
    socket.on('connect', () => {
      socket.emit('join-competition', compId);
    });
    socket.on('results:updated', () => {
      if (selectedEventId) loadResults(selectedEventId);
    });
    return () => { socket.disconnect(); };
  }, [compId, selectedEventId, loadResults]);

  useEffect(() => {
    if (selectedEventId) loadResults(selectedEventId);
  }, [selectedEventId, loadResults]);

  if (!comp) return <div className="min-h-screen bg-bg-dark flex items-center justify-center text-white">Завантаження...</div>;

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="min-h-screen mesh-bg font-sans bg-bg-dark text-slate-50 premium-scrollbar overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-10 animate-fade-in relative z-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black tracking-[0.2em] uppercase rounded-full shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            LIVE RESULT
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase text-white drop-shadow-lg">{comp.name}</h1>
          <p className="text-slate-400 font-mono flex items-center justify-center gap-3 text-lg">
            {comp.location} • {comp.poolLength}м
            <button onClick={() => selectedEventId && loadResults(selectedEventId)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all text-primary-400 hover:text-primary-300 hover:rotate-180 duration-500 hover:shadow-lg hover:shadow-primary-500/20" title="Оновити">
              <RefreshCw className="w-5 h-5" />
            </button>
          </p>
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-white/5 inline-block px-3 py-1 rounded-lg">
            Оновлено: {lastUpdate.toLocaleTimeString('uk-UA')}
          </p>
        </div>

        {/* Event selector */}
        <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
          {events.map((ev) => (
            <button key={ev.id} onClick={() => setSelectedEventId(ev.id)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                selectedEventId === ev.id
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20 scale-105 border border-primary-400/50'
                  : 'glass-card border-white/5 text-slate-400 hover:bg-white/10 hover:text-white hover:border-white/20 hover:scale-105'
               }`}>{localizeEventName(ev.name)}</button>
          ))}
        </div>

        {/* Results table */}
        {selectedEvent && (
          <div className="glass-card overflow-hidden border-white/10 shadow-2xl">
            <div className="bg-gradient-to-r from-primary-500/20 to-transparent px-8 py-6 border-b border-white/5">
              <h2 className="text-3xl font-black text-white tracking-tight">{localizeEventName(selectedEvent.name)}</h2>
              <p className="text-sm font-bold text-primary-400 uppercase tracking-widest mt-1">Офіційні результати</p>
            </div>

            {results.length > 0 ? (
              <div className="overflow-x-auto premium-scrollbar">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/5">
                      <th className="px-8 py-5 w-20 text-center">Місце</th>
                      <th className="px-8 py-5">Прізвище та ім'я</th>
                      <th className="px-8 py-5">Клуб</th>
                      <th className="px-8 py-5 text-right">Час</th>
                      <th className="px-8 py-5 text-center">Розряд</th>
                      <th className="px-8 py-5 text-right w-28">Очки WA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <AnimatePresence>
                      {results.map((item, idx) => {
                        const r = item.result;
                        const isTop3 = r.status === 'OK' && r.place && r.place <= 3;
                        return (
                          <motion.tr key={item.id}
                            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.4, delay: idx * 0.05, ease: "easeOut" }}
                            className="hover:bg-white/5 transition-colors group">
                            <td className={`px-8 py-5 text-center font-mono text-xl ${
                              isTop3 ? 'text-amber-400 font-black drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-slate-400 font-bold'
                            } group-hover:text-white transition-colors`}>
                              {r.status === 'OK' ? (r.place || '-') : r.status}
                              {r.place === 1 && ' 🥇'}
                              {r.place === 2 && ' 🥈'}
                              {r.place === 3 && ' 🥉'}
                            </td>
                            <td className="px-8 py-5">
                              <div className="font-bold text-lg text-white group-hover:text-primary-300 transition-colors">
                                {item.athlete?.lastName} <span className="font-medium text-slate-300">{item.athlete?.firstName}</span>
                              </div>
                              <div className="text-xs font-mono text-slate-500 mt-0.5">{item.athlete?.birthYear} р.н.</div>
                            </td>
                            <td className="px-8 py-5 text-slate-400 text-sm font-medium">{item.athlete?.club}</td>
                            <td className={`px-8 py-5 text-right font-mono text-2xl font-black tracking-tight ${
                              r.status !== 'OK' ? 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]' : isTop3 ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-slate-200'
                            }`}>
                              {r.status === 'OK' ? msToTime(r.finishTimeMs) : r.status}
                            </td>
                            <td className="px-8 py-5 text-center">
                              {r.achievedRank && (
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                  ['MSMK', 'MS'].includes(r.achievedRank)
                                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                                    : 'bg-primary-500/10 text-primary-400 border border-primary-500/30'
                                }`}>
                                  {RANK_DISPLAY[r.achievedRank] || r.achievedRank}
                                </span>
                              )}
                            </td>
                            <td className="px-8 py-5 text-right font-mono text-slate-500 font-bold">{r.pointsWa || '-'}</td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-24 text-center border-t border-white/5 border-dashed m-8 rounded-2xl bg-white/5 text-slate-500">
                <div className="text-6xl mb-6 opacity-20 hover:opacity-50 transition-opacity">⏱️</div>
                <p className="text-xl font-bold text-white mb-2">Очікування результатів...</p>
                <p className="text-sm">Результати з'являться автоматично після збереження секретарем</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
