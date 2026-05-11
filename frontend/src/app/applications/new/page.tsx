'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiClientError, type AthleteApplicationHistoryItem, type NamedApplicationDocxPayload } from '@/lib/api';
import type { Athlete } from '@/types';
import { msToTime } from '@/lib/utils';
import { toast } from 'sonner';

interface EditableEventRow {
  distanceM: number;
  style: string;
  entryTimeText: string;
}

interface AthleteDraft {
  athlete: Athlete;
  history: AthleteApplicationHistoryItem[];
  selectedHistoryId: number | null;
  events: EditableEventRow[];
}

const EVENT_TEMPLATE_PRESETS: Array<{ key: string; label: string; event: EditableEventRow }> = [
  { key: '50-free', label: '50м Вільний', event: { distanceM: 50, style: 'Freestyle', entryTimeText: 'NT' } },
  { key: '100-free', label: '100м Вільний', event: { distanceM: 100, style: 'Freestyle', entryTimeText: 'NT' } },
  { key: '100-back', label: '100м На спині', event: { distanceM: 100, style: 'Backstroke', entryTimeText: 'NT' } },
];

function parseEntryTimeToMs(raw: string): number | null {
  const value = raw.trim();
  if (!value || value.toUpperCase() === 'NT') return null;
  const normalized = value.replace(',', '.');
  const minuteSplit = normalized.split(':');
  if (minuteSplit.length === 2) {
    const minutes = Number.parseInt(minuteSplit[0], 10);
    const seconds = Number.parseFloat(minuteSplit[1]);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return Math.round((minutes * 60 + seconds) * 1000);
  }
  const seconds = Number.parseFloat(normalized);
  if (!Number.isFinite(seconds)) return null;
  return Math.round(seconds * 1000);
}

function mapHistoryToEvents(historyItem: AthleteApplicationHistoryItem | null): EditableEventRow[] {
  if (!historyItem) return [];
  return historyItem.items.map((item) => ({
    distanceM: item.distanceM,
    style: item.style,
    entryTimeText: item.entryTimeMs != null ? msToTime(item.entryTimeMs) : 'NT',
  }));
}

function NamedApplicationBuilderContent() {
  const searchParams = useSearchParams();
  const initialAthleteIds = useMemo(() => {
    const fromList = (searchParams.get('athleteIds') || '')
      .split(',')
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((id) => Number.isFinite(id) && id > 0);
    const single = Number.parseInt(searchParams.get('athleteId') || '', 10);
    if (Number.isFinite(single) && single > 0) fromList.push(single);
    return Array.from(new Set(fromList));
  }, [searchParams]);

  const [athleteSearch, setAthleteSearch] = useState('');
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [drafts, setDrafts] = useState<AthleteDraft[]>([]);
  const [activeAthleteId, setActiveAthleteId] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [organization, setOrganization] = useState('');
  const [exporting, setExporting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  const activeDraft = useMemo(
    () => drafts.find((draft) => draft.athlete.id === activeAthleteId) || null,
    [drafts, activeAthleteId],
  );

  const loadAthletes = async () => {
    try {
      const list = await api.getAthletes({ search: athleteSearch || undefined, limit: 100 });
      setAthletes(list);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося завантажити спортсменів');
    }
  };

  const buildDraft = async (athlete: Athlete): Promise<AthleteDraft> => {
    const history = await api.getAthleteApplicationHistory(athlete.id);
    const defaultHistory = history[0] || null;
    return {
      athlete,
      history,
      selectedHistoryId: defaultHistory?.id || null,
      events: mapHistoryToEvents(defaultHistory),
    };
  };

  const addAthleteToDraft = async (athlete: Athlete) => {
    if (drafts.some((draft) => draft.athlete.id === athlete.id)) {
      setActiveAthleteId(athlete.id);
      return;
    }
    try {
      const draft = await buildDraft(athlete);
      setDrafts((prev) => [...prev, draft]);
      setActiveAthleteId(athlete.id);
      if (!organization) {
        setOrganization(draft.history[0]?.club || athlete.club || '');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося додати спортсмена в заявку');
    }
  };

  useEffect(() => {
    void loadAthletes();
  }, []);

  useEffect(() => {
    if (initialAthleteIds.length === 0) return;
    setInitialLoading(true);
    Promise.all(initialAthleteIds.map((id) => api.getAthlete(id)))
      .then(async (loadedAthletes) => {
        const builtDrafts = await Promise.all(loadedAthletes.map((athlete) => buildDraft(athlete)));
        setDrafts((prev) => {
          const existingIds = new Set(prev.map((draft) => draft.athlete.id));
          const uniqueNew = builtDrafts.filter((draft) => !existingIds.has(draft.athlete.id));
          return [...prev, ...uniqueNew];
        });
        setActiveAthleteId((current) => current || builtDrafts[0]?.athlete.id || null);
        if (!organization && builtDrafts[0]) {
          setOrganization(builtDrafts[0].history[0]?.club || builtDrafts[0].athlete.club || '');
        }
      })
      .catch((error) => {
        if (error instanceof ApiClientError) {
          toast.error(error.message);
        } else {
          toast.error('Не вдалося ініціалізувати спортсменів для заявки');
        }
      })
      .finally(() => setInitialLoading(false));
  }, [initialAthleteIds]);

  const removeAthleteFromDraft = (athleteId: number) => {
    setDrafts((prev) => prev.filter((draft) => draft.athlete.id !== athleteId));
    setActiveAthleteId((prev) => {
      if (prev !== athleteId) return prev;
      const remain = drafts.filter((draft) => draft.athlete.id !== athleteId);
      return remain[0]?.athlete.id || null;
    });
  };

  const updateActiveDraft = (updater: (draft: AthleteDraft) => AthleteDraft) => {
    if (!activeAthleteId) return;
    setDrafts((prev) => prev.map((draft) => (draft.athlete.id === activeAthleteId ? updater(draft) : draft)));
  };

  const handleSelectHistory = (historyId: number) => {
    if (!activeDraft) return;
    const selectedHistory = activeDraft.history.find((item) => item.id === historyId) || null;
    updateActiveDraft((draft) => ({
      ...draft,
      selectedHistoryId: historyId,
      events: mapHistoryToEvents(selectedHistory),
    }));
  };

  const addEventRow = () => {
    updateActiveDraft((draft) => ({
      ...draft,
      events: [...draft.events, { distanceM: 50, style: 'Freestyle', entryTimeText: 'NT' }],
    }));
  };

  const addTemplateEventToActive = (template: EditableEventRow) => {
    updateActiveDraft((draft) => ({
      ...draft,
      events: [...draft.events, { ...template }],
    }));
  };

  const copyActiveEventsToAll = () => {
    if (!activeDraft) return;
    setDrafts((prev) => prev.map((draft) => (
      draft.athlete.id === activeDraft.athlete.id
        ? draft
        : {
          ...draft,
          events: activeDraft.events.map((event) => ({ ...event })),
        }
    )));
    toast.success('Дистанції активного спортсмена скопійовано для всіх');
  };

  const clearEventsForAll = () => {
    setDrafts((prev) => prev.map((draft) => ({ ...draft, events: [] })));
    toast.success('Усі дистанції у заявці очищено');
  };

  const exportDocx = async () => {
    if (drafts.length === 0) {
      toast.error('Додайте хоча б одного спортсмена');
      return;
    }
    const emptyDraft = drafts.find((draft) => draft.events.length === 0);
    if (emptyDraft) {
      toast.error(`Додайте дистанції для ${emptyDraft.athlete.lastName} ${emptyDraft.athlete.firstName}`);
      return;
    }

    setExporting(true);
    try {
      const payload: NamedApplicationDocxPayload = {
        title: 'Іменна заявка',
        organization: organization || drafts[0].athlete.club || '—',
        region: drafts[0].athlete.region || drafts[0].history[0]?.region || '—',
        generatedAt: new Date().toISOString().slice(0, 10),
        athletes: drafts.map((draft) => ({
          fullName: `${draft.athlete.lastName} ${draft.athlete.firstName}`,
          birthYear: draft.athlete.birthYear,
          gender: draft.athlete.gender || 'M',
          rank: draft.athlete.currentRank,
          coach: draft.athlete.coach || '',
          club: draft.athlete.club || '',
          region: draft.athlete.region || '',
          events: draft.events.map((event) => ({
            distanceM: event.distanceM,
            style: event.style,
            entryTimeMs: parseEntryTimeToMs(event.entryTimeText),
          })),
        })),
      };
      const suffix = drafts.length === 1
        ? `${drafts[0].athlete.lastName}_${drafts[0].athlete.firstName}`
        : `${drafts.length}_athletes`;
      await api.downloadNamedApplicationDocx(payload, `Named_Application_${suffix}.docx`);
      toast.success('DOCX іменної заявки сформовано');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося згенерувати DOCX');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-[1450px] mx-auto space-y-6 animate-fade-in">
      <section className="surface-elevated p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Конструктор</p>
        <h1 className="text-4xl font-black premium-hero-title">Іменна заявка</h1>
        <p className="text-slate-300 mt-3">
          Додайте одного або кількох спортсменів з БД, налаштуйте дистанції, перевірте передогляд і вивантажте DOCX.
        </p>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="glass-card p-5 xl:col-span-1 space-y-3">
          <h2 className="text-xl font-black text-white">1. Спортсмени</h2>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2">
            <input
              value={athleteSearch}
              onChange={(event) => setAthleteSearch(event.target.value)}
              placeholder="Пошук спортсмена"
              className="premium-input w-full min-w-0 h-11"
            />
            <button
              type="button"
              onClick={() => void loadAthletes()}
              className="btn-secondary h-11 !px-4 whitespace-nowrap"
            >
              Знайти
            </button>
          </div>

          <div className="max-h-[560px] overflow-y-auto space-y-2 premium-scrollbar pr-1">
            {athletes.map((athlete) => {
              const alreadyAdded = drafts.some((draft) => draft.athlete.id === athlete.id);
              return (
                <div key={athlete.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="font-bold text-white">{athlete.lastName} {athlete.firstName}</p>
                  <p className="text-xs text-slate-400">{athlete.birthYear} · {athlete.club}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => void addAthleteToDraft(athlete)}
                      className="btn-secondary !px-3 !py-1.5 !text-xs disabled:opacity-50"
                    >
                      {alreadyAdded ? 'Додано' : 'Додати'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card p-5 xl:col-span-3 space-y-4">
          <h2 className="text-xl font-black text-white">2. Налаштування заявки</h2>
          {initialLoading ? (
            <p className="text-slate-300">Ініціалізація даних...</p>
          ) : drafts.length === 0 ? (
            <p className="text-slate-300">Додайте спортсменів зі списку ліворуч.</p>
          ) : (
            <>
              <label className="flex flex-col gap-2 text-sm max-w-[420px]">
                <span className="text-slate-300 font-bold">Організація/школа</span>
                <input
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value)}
                  className="premium-input"
                  placeholder="Назва школи"
                />
              </label>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-widest text-slate-400 font-black mb-2">Склад заявки</p>
                <div className="flex flex-wrap gap-2">
                  {drafts.map((draft) => (
                    <button
                      key={draft.athlete.id}
                      type="button"
                      onClick={() => setActiveAthleteId(draft.athlete.id)}
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        activeAthleteId === draft.athlete.id
                          ? 'border-primary-500/60 bg-primary-500/15 text-white'
                          : 'border-white/15 bg-white/5 text-slate-300'
                      }`}
                    >
                      {draft.athlete.lastName} {draft.athlete.firstName}
                    </button>
                  ))}
                </div>
              </div>

              {activeDraft && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-2 text-sm">
                      <span className="text-slate-300 font-bold">Історія імпортів для спортсмена</span>
                      <select
                        value={activeDraft.selectedHistoryId ?? ''}
                        onChange={(event) => handleSelectHistory(Number.parseInt(event.target.value, 10))}
                        className="premium-input"
                      >
                        {activeDraft.history.length === 0 ? (
                          <option value="">Немає історії — ручне наповнення</option>
                        ) : (
                          activeDraft.history.map((item) => (
                            <option key={item.id} value={item.id}>
                              {new Date(item.createdAt).toLocaleString('uk-UA')} · {item.club}
                            </option>
                          ))
                        )}
                      </select>
                    </label>

                    <div className="flex items-end gap-2">
                      <button type="button" onClick={() => setPreviewMode((prev) => !prev)} className="btn-secondary">
                        {previewMode ? 'Повернутись до редагування' : 'Режим передогляду'}
                      </button>
                      <button type="button" onClick={addEventRow} disabled={previewMode} className="btn-primary disabled:opacity-50">
                        Додати дистанцію
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAthleteFromDraft(activeDraft.athlete.id)}
                        className="btn-secondary !text-rose-200"
                      >
                        Прибрати спортсмена
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
                    <p className="text-xs uppercase tracking-widest text-slate-400 font-black">Масові операції та шаблони</p>
                    <div className="flex flex-wrap gap-2">
                      {EVENT_TEMPLATE_PRESETS.map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          disabled={previewMode}
                          onClick={() => addTemplateEventToActive(preset.event)}
                          className="btn-secondary !px-3 !py-1.5 !text-xs disabled:opacity-50"
                        >
                          Додати: {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={previewMode}
                        onClick={copyActiveEventsToAll}
                        className="btn-secondary !px-3 !py-1.5 !text-xs disabled:opacity-50"
                      >
                        Копіювати дистанції активного до всіх
                      </button>
                      <button
                        type="button"
                        disabled={previewMode}
                        onClick={clearEventsForAll}
                        className="btn-secondary !px-3 !py-1.5 !text-xs disabled:opacity-50"
                      >
                        Очистити дистанції у всіх
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-400 bg-white/5">
                          <th className="px-3 py-2">Дистанція (м)</th>
                          <th className="px-3 py-2">Стиль</th>
                          <th className="px-3 py-2">Заявочний час</th>
                          <th className="px-3 py-2">Дія</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDraft.events.map((event, index) => (
                          <tr key={`event-${index}`} className="border-t border-white/10">
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={event.distanceM}
                                disabled={previewMode}
                                onChange={(e) => {
                                  const value = Number.parseInt(e.target.value, 10) || 0;
                                  updateActiveDraft((draft) => ({
                                    ...draft,
                                    events: draft.events.map((row, rowIndex) => (rowIndex === index ? { ...row, distanceM: value } : row)),
                                  }));
                                }}
                                className="premium-input"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={event.style}
                                disabled={previewMode}
                                onChange={(e) => {
                                  updateActiveDraft((draft) => ({
                                    ...draft,
                                    events: draft.events.map((row, rowIndex) => (rowIndex === index ? { ...row, style: e.target.value } : row)),
                                  }));
                                }}
                                className="premium-input"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={event.entryTimeText}
                                disabled={previewMode}
                                onChange={(e) => {
                                  updateActiveDraft((draft) => ({
                                    ...draft,
                                    events: draft.events.map((row, rowIndex) => (rowIndex === index ? { ...row, entryTimeText: e.target.value } : row)),
                                  }));
                                }}
                                className="premium-input"
                                placeholder="NT або 1:02.30"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                disabled={previewMode}
                                onClick={() => {
                                  updateActiveDraft((draft) => ({
                                    ...draft,
                                    events: draft.events.filter((_, rowIndex) => rowIndex !== index),
                                  }));
                                }}
                                className="btn-secondary !px-3 !py-1.5 !text-xs disabled:opacity-50"
                              >
                                Видалити
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {previewMode && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                  <p className="text-xs uppercase tracking-widest text-emerald-300 font-black">Передогляд заявки</p>
                  {drafts.map((draft) => (
                    <p key={draft.athlete.id} className="text-slate-100">
                      <span className="font-bold">{draft.athlete.lastName} {draft.athlete.firstName}</span> — дистанцій: {draft.events.length}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button type="button" onClick={() => void exportDocx()} disabled={exporting} className="btn-primary">
                  {exporting ? 'Формування DOCX...' : 'Вивантажити DOCX'}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function NamedApplicationBuilderPage() {
  return (
    <Suspense fallback={<div className="max-w-[1200px] mx-auto py-20 text-slate-300">Завантаження конструктора...</div>}>
      <NamedApplicationBuilderContent />
    </Suspense>
  );
}
