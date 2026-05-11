'use client';
import { useState, useCallback, use, useRef, useEffect, useMemo } from 'react';
import { api, ExtractedEvent, ImportPreview, ParsedAthlete, ParsedEntry } from '@/lib/api';
import { Competition } from '@/types';
import { msToTime } from '@/lib/utils';
import { toStyleShortUa } from '@/lib/swim-style';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle2, AlertCircle, AlertTriangle, ChevronLeft, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StepIndicator } from '@/components/StepIndicator';
import { EventConstructor } from '@/components/EventConstructor';

const RANK_DISPLAY: Record<string, string> = {
  MSMK: 'МСМК', MS: 'МС', KMSU: 'КМСУ', R1: 'І', R2: 'ІІ', R3: 'ІІІ',
  Y1: 'І юн.', Y2: 'ІІ юн.', Y3: 'ІІІ юн.', NONE: '—',
};
const RANK_OPTIONS = ['MSMK', 'MS', 'KMSU', 'R1', 'R2', 'R3', 'Y1', 'Y2', 'Y3', 'NONE'] as const;
type RankCode = typeof RANK_OPTIONS[number];

type PreviewRow = ParsedAthlete & {
  index: number;
  entries: ParsedEntry[];
  warnings: ImportPreview['warnings'];
  errors: ImportPreview['errors'];
};
type GroupedIssue = {
  key: number;
  athlete: string;
  warnings: string[];
  errors: string[];
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Невідома помилка';
}

function resolveAthleteName(athlete: ParsedAthlete): string {
  const lastName = athlete.last_name || athlete.lastName || '';
  const firstName = athlete.first_name || athlete.firstName || '';
  return `${lastName} ${firstName}`.trim();
}

function resolveBirthYear(athlete: ParsedAthlete): number | '' {
  return athlete.birth_year || athlete.birthYear || '';
}

function normalizeRank(rankRaw: string | undefined): RankCode {
  if (!rankRaw) return 'NONE';
  return (RANK_OPTIONS.includes(rankRaw as RankCode) ? rankRaw : 'NONE') as RankCode;
}

export default function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const compId = Number.parseInt(id, 10);
  const hasValidCompId = Number.isFinite(compId) && compId > 0;
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [genders, setGenders] = useState<Record<number, 'M' | 'F'>>({});
  const [ranks, setRanks] = useState<Record<number, RankCode>>({});
  const [comp, setComp] = useState<Competition | null>(null);
  const [compLoading, setCompLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bulkEditEnabled, setBulkEditEnabled] = useState(true);
  const [bulkEditApplied, setBulkEditApplied] = useState(false);
  const [step, setStep] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  const STEPS = [
    { title: 'Підготовка', subtitle: 'Налаштування' },
    { title: 'Завантаження', subtitle: 'Вибір файлу' },
    { title: 'Учасники', subtitle: 'Валідація даних' },
    { title: 'Дистанції', subtitle: 'Конструктор' },
  ];

  useEffect(() => {
    if (!hasValidCompId) {
      setComp(null);
      setLoadError('Некоректний ідентифікатор змагання.');
      setCompLoading(false);
      return;
    }
    let cancelled = false;
    setCompLoading(true);
    api.getCompetition(compId)
      .then((competition) => {
        if (cancelled) return;
        setComp(competition);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setComp(null);
        setLoadError(error instanceof Error ? error.message : 'Не вдалося завантажити змагання');
      })
      .finally(() => {
        if (!cancelled) setCompLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [compId]);

  useEffect(() => {
    let cancelled = false;
    api.getRuntimeFeatureFlags()
      .then((flags) => {
        if (cancelled) return;
        const bulkFlag = flags.find((flag) => flag.key === 'ff.import.bulk-edit');
        const enabled = bulkFlag ? bulkFlag.enabled : true;
        setBulkEditEnabled(enabled);
        if (!enabled) {
          setBulkEditApplied(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setBulkEditEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isLocked = comp ? comp.status !== 'draft' : false;
  const hasAgeGroups = (comp?.ageGroups?.length ?? 0) > 0;

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setParsing(true);
    try {
      const result = await api.parsePreview(file);
      setPreview(result);
      const g: Record<number, 'M' | 'F'> = {};
      const r: Record<number, RankCode> = {};
      result.athletes.forEach((a, i) => {
        g[i] = a.gender === 'F' ? 'F' : 'M';
        r[i] = normalizeRank(a.currentRank || a.rank);
      });
      setGenders(g);
      setRanks(r);
      setBulkEditApplied(false);
      setStep(3); // Move to review
    } catch (err: unknown) {
      setPreview({ athletes: [], entries: [], warnings: [], errors: [{ row: 0, message: getErrorMessage(err) }] });
      setStep(3);
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleConfirm = async (selectedEvents?: ExtractedEvent[]) => {
    if (!preview) return;
    setSaving(true);
    const loadingToast = toast.loading('Збереження даних...');
    try {
      // Filter entries based on selected events if provided
      let entriesToSave = preview.entries;
      if (selectedEvents) {
        entriesToSave = preview.entries.filter((entry) =>
          selectedEvents.some(se => 
            se.distance === entry.distance_m && 
            se.style === entry.style && 
            se.gender === genders[entry.athlete_index]
          )
        );
      }

      const result = await api.confirmImport(compId, {
        athletes: preview.athletes.map((a, i) => ({
          ...a,
          gender: genders[i] || 'M',
          currentRank: ranks[i] || 'NONE',
          rank: ranks[i] || 'NONE',
        })),
        entries: entriesToSave.map((e) => ({ ...e, gender: genders[e.athlete_index] || 'M' })),
        bulkEditApplied: bulkEditEnabled ? bulkEditApplied : false,
      });
      toast.success(`Імпорт завершено! ${result.imported} спортсменів.`, { id: loadingToast });
      router.push(`/competitions/${compId}`);
    } catch (error: unknown) {
      console.error('ImportPage handleConfirm error', error);
      toast.error('Помилка при збереженні', { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const previewRows: PreviewRow[] = preview ? preview.athletes.map((a, i) => {
    const athleteEntries = preview.entries.filter((e) => e.athlete_index === i);
    const rowWarnings = preview.warnings.filter((w) => w.row === i + 1);
    const rowErrors = preview.errors.filter((e) => e.row === i + 1);
    return { ...a, index: i, entries: athleteEntries, warnings: rowWarnings, errors: rowErrors };
  }) : [];
  const groupedIssues = useMemo<GroupedIssue[]>(() => {
    return previewRows
      .filter((row) => row.warnings.length > 0 || row.errors.length > 0)
      .map((row) => ({
        key: row.index,
        athlete: resolveAthleteName(row) || `Учасник #${row.index + 1}`,
        warnings: row.warnings.map((item) => item.message),
        errors: row.errors.map((item) => item.message),
      }));
  }, [previewRows]);

  if (loadError) {
    return <div className="max-w-6xl mx-auto py-20 text-center text-rose-400">{loadError}</div>;
  }

  if (compLoading) {
    return <div className="max-w-6xl mx-auto py-20 text-center text-slate-400">Завантаження конфігурації змагання...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
        <div>
          <div className="inline-flex items-center gap-2 text-primary-400 text-[10px] font-black uppercase tracking-widest mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Мастер налаштування
          </div>
          <h2 className="text-4xl font-black tracking-tight text-white">Підготовка змагання</h2>
        </div>
        <div className="flex gap-3">
          <Link href={`/competitions/${compId}`} className="btn-secondary flex items-center gap-2 !px-4 !py-2 text-xs">
            <ChevronLeft className="w-4 h-4" /> Скасувати
          </Link>
        </div>
      </div>

      <StepIndicator currentStep={step} steps={STEPS} />

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="glass-card p-12 text-center space-y-8 border-primary-500/10 backdrop-blur-xl">
             <div className="max-w-md mx-auto space-y-6">
                <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center border-2 transition-all duration-700 ${
                    hasAgeGroups ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 rotate-12' : 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                }`}>
                    {hasAgeGroups ? <CheckCircle2 className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
                </div>
                <div>
                   <h3 className="text-2xl font-black text-white uppercase tracking-tight">Перевірка конфігурації</h3>
                   <p className="text-slate-500 mt-2 text-sm">
                      {hasAgeGroups
                        ? 'Налаштування змагання готові до імпорту. Вікові групи завантажені.'
                        : 'Увага! У змаганні не вказано жодної вікової групи. Це може завадити автоматичному розрахунку розрядів та місць.'}
                   </p>
                </div>
                <div className="flex flex-col gap-3">
                    <button onClick={() => setStep(2)} className="btn-primary py-4 text-sm !tracking-widest">
                       ПРОДОВЖИТИ ІМПОРТ
                    </button>
                    <Link href={`/competitions/${compId}?tab=settings`} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors">
                       Налаштувати вікові групи
                    </Link>
                </div>
             </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { if (isLocked) return; handleDrop(e); }}
            onClick={() => { if (isLocked) return; fileRef.current?.click(); }}
            className={`relative group border-2 border-dashed rounded-[2rem] p-24 text-center transition-all ${
              isLocked ? 'border-white/5 bg-white/[0.01] cursor-not-allowed opacity-50' :
              dragOver ? 'border-primary-500 bg-primary-500/10' : 'border-white/10 hover:border-primary-500/30 hover:bg-white/[0.02] cursor-pointer'
            }`}
          >
            <input ref={fileRef} type="file" accept=".docx,.csv,.xlsx,.xls" className="hidden"
              disabled={isLocked}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            
            {parsing ? (
              <div className="space-y-6">
                <div className="w-16 h-16 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin mx-auto" />
                <p className="text-2xl font-black text-white">Аналіз файлу...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center mx-auto transition-transform group-hover:scale-110 shadow-lg border border-primary-500/20 text-slate-400">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                   <p className="text-2xl font-black text-white uppercase tracking-tight">Завантажте файл заявок</p>
                   <p className="text-slate-500 mt-2">Ми автоматично розпізнаємо учасників та їх дистанції</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {step === 3 && preview && (
          <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{fileName}</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">
                    Крок 3: Перевірка даних учасників
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setStep(2); setPreview(null); }} className="btn-secondary">Назад</button>
                <button onClick={() => setStep(4)} disabled={preview.errors.length > 0} className="btn-primary">
                  Продовжити до дистанцій
                </button>
              </div>
            </div>

            {/* Notifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {preview.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                  <h4 className="font-bold font-black uppercase text-xs tracking-widest text-red-500 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Критичні помилки
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1 premium-scrollbar pr-2">
                    {preview.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-400/80 font-mono">Рядок {e.row}: {e.message}</p>
                    ))}
                  </div>
                </div>
              )}
              {preview.warnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                  <h4 className="font-bold font-black uppercase text-xs tracking-widest text-amber-500 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Попередження
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1 premium-scrollbar pr-2">
                    {preview.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-400/80 font-mono">Рядок {w.row}: {w.message}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {groupedIssues.length > 0 && (
              <div className="glass-card p-4 border-white/10">
                <h4 className="font-bold font-black uppercase text-xs tracking-widest text-slate-400 mb-3">Групування проблем по спортсмену</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {groupedIssues.map((issue: GroupedIssue) => (
                    <div key={issue.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-sm font-bold text-slate-100">{issue.athlete}</p>
                      {issue.errors.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {issue.errors.map((item: string, idx: number) => (
                            <p key={idx} className="text-xs text-red-400">• {item}</p>
                          ))}
                        </div>
                      )}
                      {issue.warnings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {issue.warnings.map((item: string, idx: number) => (
                            <p key={idx} className="text-xs text-amber-400">• {item}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            {bulkEditEnabled ? (
              <div className="glass-card p-4 border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-primary-500/5">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Масове налаштування статі:</span>
                  <div className="flex gap-2">
                    <button onClick={() => { const g: Record<number, 'M' | 'F'> = {}; preview.athletes.forEach((_, i) => { g[i] = 'M'; }); setGenders(g); setBulkEditApplied(true); }}
                      className="px-4 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all">
                      ♂ Хлопці
                    </button>
                    <button onClick={() => { const g: Record<number, 'M' | 'F'> = {}; preview.athletes.forEach((_, i) => { g[i] = 'F'; }); setGenders(g); setBulkEditApplied(true); }}
                      className="px-4 py-1.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-bold hover:bg-pink-500/20 transition-all">
                      ♀ Дівчата
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Масовий розряд:</span>
                  <select
                    onChange={(event) => {
                      const nextRank = event.target.value as RankCode;
                      const r: Record<number, RankCode> = {};
                      preview.athletes.forEach((_, i) => { r[i] = nextRank; });
                      setRanks(r);
                      setBulkEditApplied(true);
                    }}
                    defaultValue="NONE"
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 focus:border-primary-500 outline-none"
                  >
                    {RANK_OPTIONS.map((rank) => (
                      <option key={rank} value={rank} className="bg-slate-900">
                        {RANK_DISPLAY[rank]}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-slate-500 italic">Стать і розряд можна змінювати по кожному учаснику вручну</p>
              </div>
            ) : (
              <div className="glass-card p-4 border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-300">
                Масове редагування вимкнено адміністратором. Доступне лише індивідуальне редагування по рядках.
              </div>
            )}

            {/* Table */}
            <div className="glass-card overflow-hidden border-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                    <tr>
                      <th className="px-4 py-4 text-center">Стать</th>
                      <th className="px-4 py-4 text-left">Учасник</th>
                      <th className="px-4 py-4 text-center">Рік</th>
                      <th className="px-4 py-4 text-center">Розряд</th>
                      <th className="px-4 py-4 text-left">Клуб / Тренер</th>
                      <th className="px-4 py-4 text-left">Дистанції</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {previewRows.map((row) => {
                       const hasError = row.errors.length > 0;
                       return (
                        <tr key={row.index} className={`hover:bg-white/5 transition-colors ${hasError ? 'bg-red-500/5' : ''}`}>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setGenders(prev => ({ ...prev, [row.index]: prev[row.index] === 'F' ? 'M' : 'F' }))}
                              className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all border ${
                                genders[row.index] === 'F'
                                  ? 'bg-pink-500/20 text-pink-400 border-pink-500/30'
                                  : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                              }`}
                            >
                              {genders[row.index] === 'F' ? 'Ж' : 'Ч'}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-200">
                            <div>{resolveAthleteName(row)}</div>
                            {(row.errors.length > 0 || row.warnings.length > 0) && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {row.errors.map((item, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
                                    {item.message}
                                  </span>
                                ))}
                                {row.warnings.map((item, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400">
                                    {item.message}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-slate-500">{resolveBirthYear(row)}</td>
                          <td className="px-4 py-3 text-center">
                            <select
                              value={ranks[row.index] || 'NONE'}
                              onChange={(event) => setRanks((prev) => ({ ...prev, [row.index]: event.target.value as RankCode }))}
                              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-black text-slate-200 focus:border-primary-500 outline-none"
                            >
                              {RANK_OPTIONS.map((rank) => (
                                <option key={rank} value={rank} className="bg-slate-900">
                                  {RANK_DISPLAY[rank]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-slate-300 font-bold">{row.club}</div>
                            <div className="text-[10px] text-slate-600 italic mt-0.5">{row.coach}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {row.entries.map((e, j) => (
                                <span key={j} className="inline-flex items-center gap-2 bg-primary-500/5 border border-primary-500/10 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                                  {e.distance_m}м {toStyleShortUa(e.style)}
                                  <span className="font-mono text-primary-400">{msToTime(e.entry_time_ms)}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                       );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {step === 4 && preview && (
          <EventConstructor 
            events={preview.extractedEvents || []} 
            onConfirm={(selected) => handleConfirm(selected)}
            onBack={() => setStep(3)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
