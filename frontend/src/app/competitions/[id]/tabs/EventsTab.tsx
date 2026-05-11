'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { downloadDocxWithRetry } from '@/lib/docx-download';
import { Competition, Event, Entry, Athlete } from '@/types';
import { msToTime, parseTime } from '@/lib/utils';
import { localizeEventName } from '@/lib/swim-style';
import { Trash2, Users, Layers, Download, FileText, Plus, ChevronRight, ListOrdered, Zap, Search, X, UserPlus, CheckCircle2, ArrowUp, ArrowDown, GripVertical, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useUserPreferences } from '@/hooks/useUserPreferences';

const RANK_DISPLAY: Record<string, string> = {
  MSMK: 'МСМК', MS: 'МС', KMSU: 'КМСУ',
  R1: 'І', R2: 'ІІ', R3: 'ІІІ',
  Y1: 'І юн.', Y2: 'ІІ юн.', Y3: 'ІІІ юн.',
  NONE: '—',
};

const STYLE_OPTIONS = [
  { value: 'Freestyle', label: 'Вільний стиль' },
  { value: 'Backstroke', label: 'На спині' },
  { value: 'Breaststroke', label: 'Брас' },
  { value: 'Butterfly', label: 'Батерфляй' },
  { value: 'Medley', label: 'Комплексне плавання' },
];

interface Props {
  comp: Competition;
  compId: number;
  events: Event[];
  selectedEventId: number | null;
  setSelectedEventId: (id: number | null) => void;
  load: () => Promise<void>;
}

type SubView = 'athletes' | 'heats';
type ConfirmAction =
  | { type: 'delete-event'; id: number }
  | { type: 'delete-entry'; id: number }
  | null;

export default function EventsTab({ comp, compId, events, selectedEventId, setSelectedEventId, load }: Props) {
  const { compactTables } = useUserPreferences();
  const [subView, setSubView] = useState<SubView>('athletes');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ distance: 50, style: 'Freestyle', gender: 'M', isRelay: false });

  const [addingEntry, setAddingEntry] = useState(false);
  const [candidates, setCandidates] = useState<Athlete[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newEntryTime, setNewEntryTime] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<Athlete | null>(null);
  const [teamName, setTeamName] = useState('');

  // Reorder mode
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderedEvents, setReorderedEvents] = useState<Event[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const handleDownloadStartDocx = () => {
    if (!selectedEvent) return;
    void downloadDocxWithRetry({
      kind: 'start-protocol',
      competitionId: compId,
      filename: `Start_${localizeEventName(selectedEvent.name)}.docx`,
      protocolLabel: 'стартовий протокол',
    });
  };

  useEffect(() => {
    if (!selectedEventId) { setEntries([]); return; }
    setLoadingEntries(true);
    api.getEntries(selectedEventId).then(setEntries).finally(() => setLoadingEntries(false));
  }, [selectedEventId]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    let name = undefined;
    if (newEvent.isRelay) {
        name = `4x${newEvent.distance}м Естафета ${newEvent.style === 'Medley' ? 'Комбінована' : 'Вільний стиль'} ${newEvent.gender === 'F' ? 'Жін.' : newEvent.gender === 'M' ? 'Чол.' : 'Змішана'}`;
    }
    await api.createEvent({ ...newEvent, name, competitionId: compId });
    setShowAddForm(false);
    load();
    setReorderMode(false);
    toast.success('Дистанцію додано');
  };

  const handleDeleteEvent = async (eventId: number) => {
    setConfirmAction({ type: 'delete-event', id: eventId });
  };

  const confirmDeleteEvent = async (eventId: number) => {
    await api.deleteEvent(eventId);
    if (selectedEventId === eventId) setSelectedEventId(null);
    load();
  };

  const handleGenerateSeeding = async () => {
    if (!selectedEventId) return;
    await api.generateSeeding(selectedEventId);
    const e = await api.getEntries(selectedEventId);
    setEntries(e);
    toast.success('Запливи згенеровано!');
  };

  useEffect(() => {
    if (addingEntry && !selectedEvent?.isRelay && searchQuery.length >= 2) {
        api.getAthletes({ search: searchQuery, limit: 10 }).then(setCandidates);
    }
  }, [searchQuery, addingEntry, selectedEvent]);

  const loadCandidates = async () => {
    setAddingEntry(true);
    if (!selectedEvent?.isRelay) {
        const list = await api.getAthletes({ limit: 20 });
        setCandidates(list);
    }
  };

  const handleCreateEntry = async () => {
    if ((!selectedCandidate && !selectedEvent?.isRelay) || !selectedEventId) return;
    if (selectedEvent?.isRelay && !teamName.trim()) return;

    const toastId = toast.loading('Додавання учасника...');
    try {
        await api.createEntry({
            athleteId: selectedEvent?.isRelay ? undefined : selectedCandidate?.id,
            teamName: selectedEvent?.isRelay ? teamName.trim() : undefined,
            eventId: selectedEventId,
            entryTimeMs: newEntryTime.trim() ? parseTime(newEntryTime) : null
        });
        const e = await api.getEntries(selectedEventId);
        setEntries(e);
        setAddingEntry(false);
        setSelectedCandidate(null);
        setTeamName('');
        setNewEntryTime('');
        setSearchQuery('');
        loadCandidates(); // refresh if they want to add more
        toast.success('Учасника додано', { id: toastId });
    } catch (error: unknown) {
        console.error('EventsTab handleCreateEntry error', error);
        toast.error('Помилка', { id: toastId });
    } 
  };

  const handleDeleteEntry = async (entryId: number) => {
    setConfirmAction({ type: 'delete-entry', id: entryId });
  };

  const confirmDeleteEntry = async (entryId: number) => {
    try {
       await api.deleteEntry(entryId);
       setEntries(entries.filter(e => e.id !== entryId));
       toast.success('Учасника видалено');
    } catch (error: unknown) {
       console.error('EventsTab handleDeleteEntry error', error);
       toast.error('Помилка видалення');
     }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);

    if (action.type === 'delete-event') {
      await confirmDeleteEvent(action.id);
      return;
    }
    await confirmDeleteEntry(action.id);
  };

  const heatEntries = entries.reduce((acc: Record<number, Entry[]>, e: Entry) => {
    if (!e.heatNumber) return acc;
    (acc[e.heatNumber] = acc[e.heatNumber] || []).push(e);
    return acc;
  }, {});
  const hasHeats = Object.keys(heatEntries).length > 0;



  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* ──── Sidebar ──── */}
      <aside className="lg:col-span-1 space-y-4">
        <div className="glass-card overflow-hidden border-white/5">
          <div className="px-5 py-4 bg-white/5 flex items-center justify-between border-b border-white/5">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Дистанції</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-white/5 px-2 py-0.5 rounded text-white/40">{events.length}</span>
              {events.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (reorderMode) {
                      setReorderMode(false);
                      setReorderedEvents([]);
                    } else {
                      setReorderedEvents([...events]);
                      setReorderMode(true);
                      setShowAddForm(false);
                    }
                  }}
                  className={`p-1.5 rounded-lg transition-all ${
                    reorderMode
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                  title={reorderMode ? 'Скасувати зміну порядку' : 'Змінити порядок дистанцій'}
                  aria-label={reorderMode ? 'Скасувати зміну порядку' : 'Змінити порядок дистанцій'}
                >
                  {reorderMode ? <RotateCcw className="w-3.5 h-3.5" /> : <GripVertical className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
          
          <div className="premium-scrollbar max-h-[60vh] overflow-y-auto">
            {reorderMode ? (
              /* ──── Reorder mode ──── */
              <div>
                {reorderedEvents.map((ev, idx) => (
                  <div
                    key={ev.id}
                    draggable
                    onDragStart={(e) => {
                      setDragIndex(idx);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverIndex(idx);
                    }}
                    onDragLeave={() => {
                      if (dragOverIndex === idx) setDragOverIndex(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex === null || dragIndex === idx) {
                        setDragIndex(null);
                        setDragOverIndex(null);
                        return;
                      }
                      const next = [...reorderedEvents];
                      const [moved] = next.splice(dragIndex, 1);
                      next.splice(idx, 0, moved);
                      setReorderedEvents(next);
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    className={`flex items-center gap-2 px-3 py-3 border-b border-white/5 last:border-0 transition-all select-none ${
                      dragIndex === idx
                        ? 'opacity-40 bg-white/[0.02]'
                        : dragOverIndex === idx
                          ? 'bg-primary-500/10 border-l-2 border-l-primary-500'
                          : 'bg-white/[0.02] hover:bg-white/5'
                    }`}
                    style={{ cursor: 'grab' }}
                  >
                    <span className="w-6 text-center text-[10px] font-black text-slate-600">{idx + 1}</span>
                    <GripVertical className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                    <span className="flex-1 text-sm font-bold text-slate-300 truncate">
                      {localizeEventName(ev.name)}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          const next = [...reorderedEvents];
                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                          setReorderedEvents(next);
                        }}
                        className="p-0.5 rounded hover:bg-white/10 text-slate-500 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all"
                        aria-label="Перемістити вгору"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === reorderedEvents.length - 1}
                        onClick={() => {
                          const next = [...reorderedEvents];
                          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                          setReorderedEvents(next);
                        }}
                        className="p-0.5 rounded hover:bg-white/10 text-slate-500 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all"
                        aria-label="Перемістити вниз"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ──── Normal mode ──── */
              <AnimatePresence mode="popLayout">
                {events.map((ev, idx) => (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    key={ev.id}
                    className={`relative flex items-center gap-3 px-5 py-4 cursor-pointer transition-all border-l-2 group ${
                      selectedEventId === ev.id
                        ? 'bg-primary-500/10 border-primary-500 text-white'
                        : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedEventId(ev.id)}
                      className="flex-1 min-w-0 text-left"
                      aria-label={`Відкрити дистанцію ${localizeEventName(ev.name)}`}
                    >
                      <div className="font-bold truncate text-sm">
                        {localizeEventName(ev.name)}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-slate-600 mt-1">
                        {ev._count?.entries || 0} учасників
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }}
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1"
                      aria-label={`Видалити дистанцію ${localizeEventName(ev.name)}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {selectedEventId === ev.id && (
                      <motion.div layoutId="activeInd" className="absolute right-2 w-1 h-1 rounded-full bg-primary-400" />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          <div className="p-4 border-t border-white/5 bg-white/5">
            {reorderMode ? (
              <button
                type="button"
                disabled={savingOrder}
                onClick={async () => {
                  setSavingOrder(true);
                  try {
                    await api.reorderEvents(reorderedEvents.map(e => e.id));
                    toast.success('Порядок дистанцій збережено!');
                    setReorderMode(false);
                    setReorderedEvents([]);
                    await load();
                  } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : 'Помилка збереження порядку');
                  } finally {
                    setSavingOrder(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                <Save className={`w-4 h-4 ${savingOrder ? 'animate-pulse' : ''}`} />
                {savingOrder ? 'Зберігаємо...' : 'Зберегти порядок'}
              </button>
            ) : showAddForm ? (
              <form onSubmit={handleAddEvent} className="space-y-3 animate-fade-in">
                <select value={newEvent.distance} onChange={e => setNewEvent({ ...newEvent, distance: parseInt(e.target.value) })}
                  className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-xs">
                  {[50, 100, 200, 400, 800, 1500].map(d => <option key={d} value={d} className="bg-slate-900">{d}м</option>)}
                </select>
                <select value={newEvent.style} onChange={e => setNewEvent({ ...newEvent, style: e.target.value })}
                  className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-xs">
                  {STYLE_OPTIONS.map(s => <option key={s.value} value={s.value} className="bg-slate-900">{s.label}</option>)}
                </select>
                <select value={newEvent.gender} onChange={e => setNewEvent({ ...newEvent, gender: e.target.value })}
                  className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-xs">
                  <option value="M" className="bg-slate-900">Чоловіки</option>
                  <option value="F" className="bg-slate-900">Жінки</option>
                  <option value="MIXED" className="bg-slate-900">Змішана</option>
                </select>
                <div className="flex items-center gap-2 px-1">
                  <input type="checkbox" id="isRelayAdd" checked={newEvent.isRelay} onChange={e => setNewEvent({ ...newEvent, isRelay: e.target.checked })} className="w-3.5 h-3.5 accent-primary-500 bg-bg-dark" />
                  <label htmlFor="isRelayAdd" className="text-xs font-bold text-slate-400 select-none">Це естафета (Командна)</label>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-primary-500 text-white rounded-lg py-2 text-[10px] font-black uppercase tracking-widest hover:bg-primary-400">
                    Додати
                  </button>
                  <button type="button" onClick={() => setShowAddForm(false)} className="px-3 bg-white/5 border border-white/10 rounded-lg text-xs" aria-label="Закрити форму додавання дистанції">✕</button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setShowAddForm(true)}
                className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest text-primary-400 hover:text-white transition-colors">
                <Plus className="w-4 h-4" /> Додати дистанцію
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ──── Main content ──── */}
      <main className="lg:col-span-3 space-y-6">
        <AnimatePresence mode="wait">
          {selectedEvent ? (
            <motion.div
              key={selectedEvent.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-3xl font-black text-white">{localizeEventName(selectedEvent.name)}</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Керування учасниками та жеребкуванням</p>
                </div>

                <div className="flex bg-white/5 p-1 rounded-xl w-fit">
                  <button type="button" onClick={() => setSubView('athletes')}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                      subView === 'athletes' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                    }`}>
                    <Users className="w-4 h-4" /> Учасники
                  </button>
                  <button type="button" onClick={() => setSubView('heats')}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                      subView === 'heats' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                    }`}>
                    <Layers className="w-4 h-4" /> Запливи
                  </button>
                </div>
              </div>

              {loadingEntries ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-600 animate-pulse">
                  <div className="w-8 h-8 border-2 border-primary-500/20 border-t-primary-500 rounded-full animate-spin mb-4" />
                  Завантаження записів...
                </div>
              ) : subView === 'athletes' ? (
                /* ──── Athletes sub-view ──── */
                <div className="space-y-4">
                  <div className="flex justify-end">
                      <button type="button" onClick={() => { setAddingEntry(!addingEntry); if(!addingEntry) loadCandidates(); }} className="btn-secondary py-2 flex items-center gap-2 text-xs">
                         <UserPlus className="w-4 h-4" /> {addingEntry ? 'Закрити пошук' : 'Додати учасника'}
                     </button>
                  </div>

                  {addingEntry && (
                     <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-card relative z-30 p-5 border-primary-500/20 overflow-visible space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-start">
                           {selectedEvent?.isRelay ? (
                            <div className="flex-1 space-y-3 w-full">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Назва команди (Естафета)</label>
                                <div className="relative">
                                    <Users className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input type="text" placeholder="Назва клубу або регіону..." value={teamName} onChange={e => setTeamName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none transition-all text-white placeholder-slate-600" />
                                </div>
                            </div>
                           ) : (
                               <div className="flex-1 space-y-3 relative w-full">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Пошук атлета</label>
                              <div className="relative">
                                 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                 <input type="text" placeholder="Ім'я або прізвище..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setSelectedCandidate(null); }} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none transition-all text-white placeholder-slate-600" />
                              </div>
                              
                              {searchQuery && !selectedCandidate && (
                                <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                    {candidates.length > 0 ? (
                                        candidates.map(c => (
                                           <button type="button" key={c.id} onClick={() => { setSelectedCandidate(c); setSearchQuery(`${c.lastName} ${c.firstName}`); }} className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors flex justify-between items-center">
                                              <div>
                                                  <div className="font-bold text-slate-200">{c.lastName} {c.firstName}</div>
                                                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{c.birthYear} • {c.club} • {RANK_DISPLAY[c.currentRank || 'NONE']}</div>
                                              </div>
                                              <Plus className="w-4 h-4 text-primary-500" />
                                           </button>
                                        ))
                                    ) : (
                                        <div className="px-4 py-4 text-xs text-slate-500 text-center">Не знайдено серед інших запливів</div>
                                    )}
                                </div>
                              )}

                              {selectedCandidate && (
                                  <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5 mt-2 bg-emerald-500/10 py-1 px-2 rounded-lg border border-emerald-500/20 w-fit">
                                      <CheckCircle2 className="w-3 h-3" /> Атлет знайдений
                                  </div>
                              )}
                           </div>
                           )}
                           
                           <div className="w-full md:w-48 space-y-3">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Заявлений час</label>
                              <input type="text" placeholder="Без часу (NT)" value={newEntryTime} onChange={e => setNewEntryTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none transition-all text-white font-mono text-center" />
                           </div>

                           <div className="w-full md:w-fit pt-7">
                               <button type="button" onClick={handleCreateEntry} disabled={(!selectedCandidate && !selectedEvent?.isRelay) || (selectedEvent?.isRelay && !teamName.trim())} className="w-full md:w-auto btn-primary py-2.5 !px-6 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center">
                                 Додати до дистанції
                              </button>
                           </div>
                        </div>
                     </motion.div>
                  )}

                  <div className="glass-card relative z-0 overflow-hidden">
                    {entries.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className={`w-full ${compactTables ? 'text-xs' : 'text-sm'}`}>

                        <thead className="bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                          <tr>
                            <th className="px-6 py-4 text-left font-black">#</th>
                            <th className="px-6 py-4 text-left font-black">Прізвище та ім&apos;я</th>
                            <th className="px-6 py-4 text-center font-black">Рік</th>
                            <th className="px-6 py-4 text-center font-black">Розряд</th>
                            <th className="px-6 py-4 text-left font-black">Клуб</th>
                            <th className="px-6 py-4 text-right font-black">Заяв. час</th>
                            <th className="px-6 py-4 w-12 text-center"></th>
                          </tr>

                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {entries
                            .sort((a, b) => (a.entryTimeMs || 9999999) - (b.entryTimeMs || 9999999))
                            .map((entry, i) => (
                            <tr key={entry.id} className="hover:bg-white/5 transition-colors group">
                              <td className="px-6 py-4 text-slate-600 font-mono text-xs">{i + 1}</td>
                              <td className="px-6 py-4 font-bold text-slate-200">
                                {selectedEvent?.isRelay ? (
                                    <>Команда: <span className="text-primary-400">{entry.teamName}</span></>
                                ) : (
                                    <>{entry.athlete?.lastName} <span className="text-slate-400 font-medium">{entry.athlete?.firstName}</span></>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center font-mono text-xs text-slate-500">{entry.athlete?.birthYear || '-'}</td>
                              <td className="px-6 py-4 text-center">
                                {entry.athlete ? (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    ['MSMK', 'MS'].includes(entry.athlete?.currentRank || '') 
                                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                                      : 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                                  }`}>
                                    {RANK_DISPLAY[entry.athlete?.currentRank || 'NONE']}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="px-6 py-4 text-slate-500 text-xs italic">{entry.athlete?.club || entry.teamName}</td>
                              <td className="px-6 py-4 text-right font-mono text-slate-300 font-bold">{msToTime(entry.entryTimeMs)}</td>
                              <td className="px-6 py-4 text-center">
                                 <button type="button" onClick={() => handleDeleteEntry(entry.id)} className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100" aria-label="Видалити учасника з дистанції">
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-slate-600 border-2 border-dashed border-white/5 rounded-2xl">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-10" />
                      <p className="font-bold text-lg">Заявок немає</p>
                      <p className="text-xs uppercase tracking-widest mt-1 opacity-50">Використайте імпорт або додайте вручну</p>
                    </div>
                  )}
                </div>
              </div>
              ) : (
                /* ──── Heats sub-view ──── */
                <div className="space-y-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={handleGenerateSeeding} className="btn-primary flex items-center gap-2 py-2.5">
                      <Zap className="w-4 h-4 fill-current" /> Згенерувати запливи
                    </button>
                    {hasHeats && (
                      <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
                        <button type="button" onClick={() => api.downloadFile(`/export/start-protocol/${selectedEventId}`, `Start_${localizeEventName(selectedEvent.name)}.xlsx`)}
                          className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors" title="Excel">
                          <Download className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={handleDownloadStartDocx}
                          className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors" title="Word">
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {hasHeats ? (
                      Object.entries(heatEntries)
                         .sort(([a], [b]) => parseInt(a) - parseInt(b))
                         .map(([heatNum, hEntries], hIdx) => (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: hIdx * 0.05 }}
                          key={heatNum} 
                          className="glass-card group overflow-hidden border-white/10 hover:border-primary-500/30 transition-all hover:shadow-primary-500/5 hover:shadow-xl"
                        >
                          <div className="bg-white/5 px-5 py-3 border-b border-white/5 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary-400">Заплив {heatNum}</span>
                            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded font-black">
                              {hEntries.length} / {comp.lanes}
                            </span>
                          </div>
                          <div className="p-3 space-y-1">
                            {hEntries
                              .sort((a, b) => (a.laneNumber || 0) - (b.laneNumber || 0))
                              .map((entry) => (
                              <div key={entry.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-all">
                                <span className="w-6 text-center font-black text-primary-500 text-xs italic">
                                  {entry.laneNumber}
                                </span>
                                <span className="flex-1 font-bold text-xs truncate text-slate-200">
                                  {entry.athlete?.lastName} {entry.athlete?.firstName}
                                </span>
                                <span className="font-mono text-[10px] text-slate-600">
                                  {msToTime(entry.entryTimeMs)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="col-span-full py-24 glass-card border-dashed flex flex-col items-center justify-center text-slate-600">
                        <Layers className="w-12 h-12 mb-4 opacity-10" />
                        <p className="font-bold">Жеребкування ще не проведено</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 glass-card border-dashed">
              <ListOrdered className="w-16 h-16 mb-6 text-slate-700 opacity-20" />
              <p className="text-xl font-bold text-slate-500">Оберіть дистанцію для початку</p>
            </div>
          )}
        </AnimatePresence>
      </main>
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.type === 'delete-event' ? 'Видалити дистанцію?' : 'Видалити учасника?'}
        description={
          confirmAction?.type === 'delete-event'
            ? 'Дистанція буде повністю видалена разом із заявками та запливами.'
            : 'Учасник буде видалений із цієї дистанції.'
        }
        confirmText="Так, видалити"
        cancelText="Скасувати"
        danger
        onConfirm={() => {
          void handleConfirmAction();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
