'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { api, type UaSportRankCreateInput, type UaSportRankRow, type WaBaseTimeRow, type WaBaseTimeUpsertInput } from '@/lib/api';
import { toStyleUa } from '@/lib/swim-style';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { Filter, Globe, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const GENDER_ORDER: Record<string, number> = { M: 0, F: 1, X: 2 };
const RANK_ORDER: Record<string, number> = {
  MSMK: 0, 'МСМК': 0,
  MS: 1, 'МС': 1,
  KMSU: 2, KMS: 2, 'КМСУ': 2, 'КМС': 2,
  R1: 3, 'І': 3, I: 3,
  R2: 4, 'ІІ': 4, II: 4,
  R3: 5, 'ІІІ': 5, III: 5,
  Y1: 6, 'І ЮН.': 6,
  Y2: 7, 'ІІ ЮН.': 7,
  Y3: 8, 'ІІІ ЮН.': 8,
};
const STYLE_ORDER: Record<string, number> = {
  FREE: 0,
  BACK: 1,
  BREAST: 2,
  FLY: 3,
  MEDLEY: 4,
};
const FORM_STYLE_OPTIONS = ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Medley'];
const FORM_RANK_OPTIONS = ['МСМК', 'МС', 'КМСУ', 'І', 'ІІ', 'ІІІ', 'І юн.', 'ІІ юн.', 'ІІІ юн.'];
const SELECT_CLASS = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 appearance-none';
const OPTION_CLASS = 'bg-slate-900 text-slate-100';

const defaultWaForm: WaBaseTimeUpsertInput = {
  year: new Date().getFullYear(),
  gender: 'M',
  distance: 50,
  style: 'Freestyle',
  poolLength: 50,
  baseTimeMs: 30000,
};

const defaultUaForm: UaSportRankCreateInput = {
  poolLength: 50,
  gender: 'M',
  distance: 50,
  style: 'Freestyle',
  rank: 'І',
  normTimeMs: 30000,
};

type ActiveTab = 'wa' | 'ua';
type DisplayMode = 'table' | 'cards';
type SortDirection = 'asc' | 'desc';
type WaSortKey = 'poolLength' | 'gender' | 'style' | 'distance' | 'year' | 'baseTimeMs';
type UaSortKey = 'poolLength' | 'gender' | 'style' | 'distance' | 'rank' | 'normTimeMs';

function normalizeStyle(style: string): keyof typeof STYLE_ORDER | 'OTHER' {
  const normalized = style.trim().toUpperCase();
  if (normalized === 'FREE' || normalized === 'FREESTYLE') return 'FREE';
  if (normalized === 'BACK' || normalized === 'BACKSTROKE') return 'BACK';
  if (normalized === 'BREAST' || normalized === 'BREASTSTROKE') return 'BREAST';
  if (normalized === 'FLY' || normalized === 'BUTTERFLY') return 'FLY';
  if (normalized === 'MEDLEY') return 'MEDLEY';
  return 'OTHER';
}

function styleSortValue(style: string): number {
  const key = normalizeStyle(style);
  return key === 'OTHER' ? 999 : STYLE_ORDER[key];
}

function genderLabel(gender: string): string {
  if (gender === 'M') return 'Чоловіки';
  if (gender === 'F') return 'Жінки';
  return 'Змішані';
}

function rankSortValue(rank: string): number {
  const normalized = rank.trim().toUpperCase();
  return RANK_ORDER[normalized] ?? 999;
}

function compareNumber(a: number, b: number, direction: SortDirection): number {
  return direction === 'asc' ? a - b : b - a;
}

function compareString(a: string, b: string, direction: SortDirection): number {
  const result = a.localeCompare(b, 'uk');
  return direction === 'asc' ? result : -result;
}

function applySearch(text: string, query: string): boolean {
  if (!query) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}

function SortHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 transition-colors ${active ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
    >
      {label}
    </button>
  );
}

export default function NormativesPage() {
  const [waBaseTimes, setWaBaseTimes] = useState<WaBaseTimeRow[]>([]);
  const [uaRanks, setUaRanks] = useState<UaSportRankRow[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('wa');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('table');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEditMode, setAdminEditMode] = useState(false);
  const { compactTables, showLiveIndicators } = useUserPreferences();

  const [poolFilter, setPoolFilter] = useState<'all' | '50' | '25'>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'M' | 'F' | 'X'>('all');
  const [styleFilter, setStyleFilter] = useState<'all' | 'FREE' | 'BACK' | 'BREAST' | 'FLY' | 'MEDLEY'>('all');
  const [distanceFilter, setDistanceFilter] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [waForm, setWaForm] = useState<WaBaseTimeUpsertInput>(defaultWaForm);
  const [uaForm, setUaForm] = useState<UaSportRankCreateInput>(defaultUaForm);
  const [editingWaId, setEditingWaId] = useState<number | null>(null);
  const [editingUaId, setEditingUaId] = useState<number | null>(null);
  const [waSort, setWaSort] = useState<{ key: WaSortKey; direction: SortDirection }>({ key: 'poolLength', direction: 'desc' });
  const [uaSort, setUaSort] = useState<{ key: UaSortKey; direction: SortDirection }>({ key: 'poolLength', direction: 'desc' });

  const reloadWa = async () => {
    const data = await api.getWaBaseTimes();
    setWaBaseTimes(data);
  };

  const reloadUa = async () => {
    const data = await api.getUaSportRanks();
    setUaRanks(data);
  };

  useEffect(() => {
    api.getAuthStatus()
      .then((status) => {
        const admin = status.authenticated && status.role === 'admin';
        setIsAdmin(admin);
        setAdminEditMode(admin ? adminEditMode : false);
      })
      .catch(() => setIsAdmin(false));

    void reloadWa().catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Не вдалося завантажити WA нормативи');
    });
    void reloadUa().catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Не вдалося завантажити нормативи ФПУ');
    });

  }, []);

  const distanceOptions = useMemo(() => {
    const source = activeTab === 'wa' ? waBaseTimes.map((row) => row.distance) : uaRanks.map((row) => row.distance);
    return Array.from(new Set(source)).sort((a, b) => a - b);
  }, [activeTab, uaRanks, waBaseTimes]);

  const commonDistanceChips = useMemo(() => {
    const common = [50, 100, 200, 400, 800, 1500];
    const present = new Set(distanceOptions);
    return common.filter((distance) => present.has(distance));
  }, [distanceOptions]);

  const filteredWa = useMemo(() => {
    return waBaseTimes.filter((row) => {
      if (poolFilter !== 'all' && row.poolLength !== Number(poolFilter)) return false;
      if (genderFilter !== 'all' && row.gender !== genderFilter) return false;
      if (styleFilter !== 'all' && normalizeStyle(row.style) !== styleFilter) return false;
      if (distanceFilter !== 'all' && row.distance !== distanceFilter) return false;
      const rowSearch = `${row.year} ${row.poolLength} ${row.gender} ${row.distance} ${toStyleUa(row.style)} ${row.baseTimeMs}`;
      return applySearch(rowSearch, searchQuery);
    });
  }, [distanceFilter, genderFilter, poolFilter, searchQuery, styleFilter, waBaseTimes]);

  const filteredUa = useMemo(() => {
    return uaRanks.filter((row) => {
      if (poolFilter !== 'all' && row.poolLength !== Number(poolFilter)) return false;
      if (genderFilter !== 'all' && row.gender !== genderFilter) return false;
      if (styleFilter !== 'all' && normalizeStyle(row.style) !== styleFilter) return false;
      if (distanceFilter !== 'all' && row.distance !== distanceFilter) return false;
      const rowSearch = `${row.poolLength} ${row.gender} ${row.distance} ${toStyleUa(row.style)} ${row.rank}`;
      return applySearch(rowSearch, searchQuery);
    });
  }, [distanceFilter, genderFilter, poolFilter, searchQuery, styleFilter, uaRanks]);

  const sortedWa = useMemo(() => {
    return [...filteredWa].sort((a, b) => {
      switch (waSort.key) {
        case 'poolLength':
          return compareNumber(a.poolLength, b.poolLength, waSort.direction);
        case 'gender':
          return compareNumber(GENDER_ORDER[a.gender] ?? 9, GENDER_ORDER[b.gender] ?? 9, waSort.direction);
        case 'style':
          return compareNumber(styleSortValue(a.style), styleSortValue(b.style), waSort.direction)
            || compareString(a.style, b.style, waSort.direction);
        case 'distance':
          return compareNumber(a.distance, b.distance, waSort.direction);
        case 'year':
          return compareNumber(a.year, b.year, waSort.direction);
        case 'baseTimeMs':
          return compareNumber(a.baseTimeMs, b.baseTimeMs, waSort.direction);
        default:
          return 0;
      }
    });
  }, [filteredWa, waSort.direction, waSort.key]);

  const sortedUa = useMemo(() => {
    return [...filteredUa].sort((a, b) => {
      switch (uaSort.key) {
        case 'poolLength':
          return compareNumber(a.poolLength, b.poolLength, uaSort.direction);
        case 'gender':
          return compareNumber(GENDER_ORDER[a.gender] ?? 9, GENDER_ORDER[b.gender] ?? 9, uaSort.direction);
        case 'style':
          return compareNumber(styleSortValue(a.style), styleSortValue(b.style), uaSort.direction)
            || compareString(a.style, b.style, uaSort.direction);
        case 'distance':
          return compareNumber(a.distance, b.distance, uaSort.direction);
        case 'rank':
          return compareNumber(rankSortValue(a.rank), rankSortValue(b.rank), uaSort.direction);
        case 'normTimeMs':
          return compareNumber(a.normTimeMs, b.normTimeMs, uaSort.direction);
        default:
          return 0;
      }
    });
  }, [filteredUa, uaSort.direction, uaSort.key]);

  const waCardGroups = useMemo(() => {
    const grouped = new Map<string, { style: string; distance: number; rows: WaBaseTimeRow[] }>();
    const rows = [...filteredWa].sort((a, b) =>
      compareNumber(styleSortValue(a.style), styleSortValue(b.style), 'asc')
      || compareNumber(a.distance, b.distance, 'asc')
      || compareNumber(a.poolLength, b.poolLength, 'desc')
      || compareNumber(GENDER_ORDER[a.gender] ?? 9, GENDER_ORDER[b.gender] ?? 9, 'asc')
      || compareNumber(a.year, b.year, 'desc')
      || compareNumber(a.baseTimeMs, b.baseTimeMs, 'asc'));

    for (const row of rows) {
      const key = `${normalizeStyle(row.style)}-${row.distance}`;
      if (!grouped.has(key)) {
        grouped.set(key, { style: row.style, distance: row.distance, rows: [] });
      }
      grouped.get(key)?.rows.push(row);
    }
    return Array.from(grouped.entries()).map(([key, value]) => ({ key, ...value }));
  }, [filteredWa]);

  const uaCardGroups = useMemo(() => {
    const grouped = new Map<string, { style: string; distance: number; rows: UaSportRankRow[] }>();
    const rows = [...filteredUa].sort((a, b) =>
      compareNumber(styleSortValue(a.style), styleSortValue(b.style), 'asc')
      || compareNumber(a.distance, b.distance, 'asc')
      || compareNumber(a.poolLength, b.poolLength, 'desc')
      || compareNumber(GENDER_ORDER[a.gender] ?? 9, GENDER_ORDER[b.gender] ?? 9, 'asc')
      || compareNumber(rankSortValue(a.rank), rankSortValue(b.rank), 'asc')
      || compareNumber(a.normTimeMs, b.normTimeMs, 'asc'));

    for (const row of rows) {
      const key = `${normalizeStyle(row.style)}-${row.distance}`;
      if (!grouped.has(key)) {
        grouped.set(key, { style: row.style, distance: row.distance, rows: [] });
      }
      grouped.get(key)?.rows.push(row);
    }
    return Array.from(grouped.entries()).map(([key, value]) => ({ key, ...value }));
  }, [filteredUa]);

  const handleWaSort = (key: WaSortKey) => {
    setWaSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleUaSort = (key: UaSortKey) => {
    setUaSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const resetFilters = () => {
    setPoolFilter('all');
    setGenderFilter('all');
    setStyleFilter('all');
    setDistanceFilter('all');
    setSearchQuery('');
  };

  const handleSaveWa = async (event: FormEvent) => {
    event.preventDefault();
    const loadingToast = toast.loading('Збереження WA нормативу...');
    try {
      if (editingWaId) {
        await api.updateWaBaseTime(editingWaId, waForm);
      } else {
        await api.upsertWaBaseTime(waForm);
      }
      await reloadWa();
      setWaForm(defaultWaForm);
      setEditingWaId(null);
      toast.success('WA норматив збережено', { id: loadingToast });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося зберегти WA норматив', { id: loadingToast });
    }
  };

  const handleDeleteWa = async (id: number) => {
    if (!window.confirm('Видалити WA норматив?')) return;
    const loadingToast = toast.loading('Видалення WA нормативу...');
    try {
      await api.deleteWaBaseTime(id);
      await reloadWa();
      if (editingWaId === id) {
        setEditingWaId(null);
        setWaForm(defaultWaForm);
      }
      toast.success('WA норматив видалено', { id: loadingToast });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося видалити WA норматив', { id: loadingToast });
    }
  };

  const handleSaveUa = async (event: FormEvent) => {
    event.preventDefault();
    const loadingToast = toast.loading('Збереження нормативу ФПУ...');
    try {
      if (editingUaId) {
        await api.updateUaSportRank(editingUaId, uaForm);
      } else {
        await api.createUaSportRank(uaForm);
      }
      await reloadUa();
      setUaForm(defaultUaForm);
      setEditingUaId(null);
      toast.success('Норматив ФПУ збережено', { id: loadingToast });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося зберегти норматив ФПУ', { id: loadingToast });
    }
  };

  const handleEditWa = (row: WaBaseTimeRow) => {
    setEditingWaId(row.id);
    setWaForm({
      year: row.year,
      gender: row.gender,
      distance: row.distance,
      style: row.style,
      poolLength: row.poolLength,
      baseTimeMs: row.baseTimeMs,
    });
  };

  const handleDeleteUa = async (id: number) => {
    if (!window.confirm('Видалити норматив ФПУ?')) return;
    const loadingToast = toast.loading('Видалення нормативу ФПУ...');
    try {
      await api.deleteUaSportRank(id);
      await reloadUa();
      if (editingUaId === id) {
        setEditingUaId(null);
        setUaForm(defaultUaForm);
      }
      toast.success('Норматив ФПУ видалено', { id: loadingToast });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося видалити норматив ФПУ', { id: loadingToast });
    }
  };

  const handleEditUa = (row: UaSportRankRow) => {
    setEditingUaId(row.id);
    setUaForm({
      poolLength: row.poolLength,
      gender: row.gender,
      distance: row.distance,
      style: row.style,
      rank: row.rank,
      normTimeMs: row.normTimeMs,
    });
  };

  const totalRows = activeTab === 'wa' ? waBaseTimes.length : uaRanks.length;
  const filteredRows = activeTab === 'wa' ? sortedWa.length : sortedUa.length;
  const selectedPool = poolFilter === 'all' ? 'Усі' : `${poolFilter}м`;

  return (
    <div className="max-w-[1480px] mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-500/10 flex items-center justify-center border border-primary-500/20">
            {activeTab === 'wa' ? <Globe className="w-8 h-8 text-primary-400" /> : <ShieldCheck className="w-8 h-8 text-primary-400" />}
          </div>
          <div>
            <h2 className="text-4xl font-black text-white leading-none mb-2">Нормативи</h2>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">
                {isAdmin && adminEditMode ? 'Режим редагування' : 'Режим перегляду'}
              </p>
              {showLiveIndicators && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" /> Live
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5 w-fit">
            <button
              onClick={() => setActiveTab('wa')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'wa' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4" /> WA Base Times
            </button>
            <button
              onClick={() => setActiveTab('ua')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'ua' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> Нормативи ФПУ
            </button>
          </div>

          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5 w-fit">
            <button
              type="button"
              onClick={() => setDisplayMode('table')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                displayMode === 'table' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:text-white'
              }`}
            >
              Таблиця
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('cards')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                displayMode === 'cards' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:text-white'
              }`}
            >
              Картки
            </button>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setAdminEditMode((prev) => !prev)}
              className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-colors ${
                adminEditMode
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:text-white'
              }`}
            >
              {adminEditMode ? 'Редагування: Увімкнено' : 'Увімкнути редагування'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="glass-card border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Розділ</p>
          <p className="mt-1 text-white font-black">{activeTab === 'wa' ? 'WA Base Times' : 'Нормативи ФПУ'}</p>
        </div>
        <div className="glass-card border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Записи</p>
          <p className="mt-1 text-white font-black">{filteredRows} / {totalRows}</p>
        </div>
        <div className="glass-card border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Басейн</p>
          <p className="mt-1 text-white font-black">{selectedPool}</p>
        </div>
        <div className="glass-card border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Фільтр</p>
          <p className="mt-1 text-white font-black">{searchQuery ? `"${searchQuery}"` : 'Не задано'}</p>
        </div>
        <div className="glass-card border-white/10 p-4 md:col-span-2 xl:col-span-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Вигляд</p>
          <p className="mt-1 text-white font-black">{displayMode === 'table' ? 'Табличний' : 'Картковий'}</p>
        </div>
      </div>

      <div className="glass-card border-white/10 p-4 space-y-4">
        <div className="flex items-center gap-2 text-slate-300 font-semibold">
          <Filter className="w-4 h-4" />
          Фільтри і пошук
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <select
            value={poolFilter}
            onChange={(event) => setPoolFilter(event.target.value as typeof poolFilter)}
            className={SELECT_CLASS}
          >
            <option className={OPTION_CLASS} value="all">Усі басейни</option>
            <option className={OPTION_CLASS} value="50">50м (LCM)</option>
            <option className={OPTION_CLASS} value="25">25м (SCM)</option>
          </select>

          <select
            value={genderFilter}
            onChange={(event) => setGenderFilter(event.target.value as typeof genderFilter)}
            className={SELECT_CLASS}
          >
            <option className={OPTION_CLASS} value="all">Усі статі</option>
            <option className={OPTION_CLASS} value="M">Чоловіки</option>
            <option className={OPTION_CLASS} value="F">Жінки</option>
            <option className={OPTION_CLASS} value="X">Змішані</option>
          </select>

          <select
            value={styleFilter}
            onChange={(event) => setStyleFilter(event.target.value as typeof styleFilter)}
            className={SELECT_CLASS}
          >
            <option className={OPTION_CLASS} value="all">Усі стилі</option>
            <option className={OPTION_CLASS} value="FREE">{toStyleUa('Freestyle')}</option>
            <option className={OPTION_CLASS} value="BACK">{toStyleUa('Backstroke')}</option>
            <option className={OPTION_CLASS} value="BREAST">{toStyleUa('Breaststroke')}</option>
            <option className={OPTION_CLASS} value="FLY">{toStyleUa('Butterfly')}</option>
            <option className={OPTION_CLASS} value="MEDLEY">{toStyleUa('Medley')}</option>
          </select>

          <select
            value={distanceFilter === 'all' ? 'all' : String(distanceFilter)}
            onChange={(event) => setDistanceFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))}
            className={SELECT_CLASS}
          >
            <option className={OPTION_CLASS} value="all">Усі дистанції</option>
            {distanceOptions.map((distance) => (
              <option className={OPTION_CLASS} key={distance} value={distance}>{distance}м</option>
            ))}
          </select>

          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Пошук: стиль, дистанція, розряд..."
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {commonDistanceChips.map((distance) => (
            <button
              key={distance}
              type="button"
              onClick={() => setDistanceFilter((prev) => (prev === distance ? 'all' : distance))}
              className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-colors ${
                distanceFilter === distance
                  ? 'bg-primary-500/20 text-primary-300 border-primary-500/40'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:text-white'
              }`}
            >
              {distance}м
            </button>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-black border bg-white/5 text-slate-300 border-white/10 hover:text-white transition-colors"
          >
            Скинути фільтри
          </button>
        </div>
      </div>

      {isAdmin && adminEditMode && activeTab === 'wa' && (
        <form onSubmit={handleSaveWa} className="glass-card p-4 border-white/10 grid grid-cols-1 md:grid-cols-6 gap-3">
          <input type="number" value={waForm.year} onChange={(event) => setWaForm((prev) => ({ ...prev, year: Number.parseInt(event.target.value, 10) || prev.year }))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Рік" />
          <select value={waForm.gender} onChange={(event) => setWaForm((prev) => ({ ...prev, gender: event.target.value }))} className={SELECT_CLASS}>
            <option className={OPTION_CLASS} value="M">Чоловіки</option>
            <option className={OPTION_CLASS} value="F">Жінки</option>
            <option className={OPTION_CLASS} value="X">Змішані</option>
          </select>
          <input type="number" value={waForm.distance} onChange={(event) => setWaForm((prev) => ({ ...prev, distance: Number.parseInt(event.target.value, 10) || prev.distance }))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Дистанція" />
          <select value={waForm.style} onChange={(event) => setWaForm((prev) => ({ ...prev, style: event.target.value }))} className={SELECT_CLASS}>
            {FORM_STYLE_OPTIONS.map((style) => (
              <option className={OPTION_CLASS} key={style} value={style}>{toStyleUa(style)}</option>
            ))}
          </select>
          <select value={waForm.poolLength} onChange={(event) => setWaForm((prev) => ({ ...prev, poolLength: Number.parseInt(event.target.value, 10) || prev.poolLength }))} className={SELECT_CLASS}>
            <option className={OPTION_CLASS} value={50}>50м</option>
            <option className={OPTION_CLASS} value={25}>25м</option>
          </select>
          <input type="number" value={waForm.baseTimeMs} onChange={(event) => setWaForm((prev) => ({ ...prev, baseTimeMs: Number.parseInt(event.target.value, 10) || prev.baseTimeMs }))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Час (мс)" />
          <div className="md:col-span-6 flex justify-end gap-2">
            {editingWaId && (
              <button
                type="button"
                onClick={() => {
                  setEditingWaId(null);
                  setWaForm(defaultWaForm);
                }}
                className="btn-secondary !px-4 !py-2 text-xs"
              >
                Скасувати редагування
              </button>
            )}
            <button type="submit" className="btn-primary !px-4 !py-2 text-xs">
              {editingWaId ? 'Оновити WA норматив' : 'Зберегти WA норматив'}
            </button>
          </div>
        </form>
      )}

      {isAdmin && adminEditMode && activeTab === 'ua' && (
        <form onSubmit={handleSaveUa} className="glass-card p-4 border-white/10 grid grid-cols-1 md:grid-cols-6 gap-3">
          <select value={uaForm.poolLength} onChange={(event) => setUaForm((prev) => ({ ...prev, poolLength: Number.parseInt(event.target.value, 10) || prev.poolLength }))} className={SELECT_CLASS}>
            <option className={OPTION_CLASS} value={50}>50м</option>
            <option className={OPTION_CLASS} value={25}>25м</option>
          </select>
          <select value={uaForm.gender} onChange={(event) => setUaForm((prev) => ({ ...prev, gender: event.target.value }))} className={SELECT_CLASS}>
            <option className={OPTION_CLASS} value="M">Чоловіки</option>
            <option className={OPTION_CLASS} value="F">Жінки</option>
            <option className={OPTION_CLASS} value="X">Змішані</option>
          </select>
          <input type="number" value={uaForm.distance} onChange={(event) => setUaForm((prev) => ({ ...prev, distance: Number.parseInt(event.target.value, 10) || prev.distance }))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Дистанція" />
          <select value={uaForm.style} onChange={(event) => setUaForm((prev) => ({ ...prev, style: event.target.value }))} className={SELECT_CLASS}>
            {FORM_STYLE_OPTIONS.map((style) => (
              <option className={OPTION_CLASS} key={style} value={style}>{toStyleUa(style)}</option>
            ))}
          </select>
          <select value={uaForm.rank} onChange={(event) => setUaForm((prev) => ({ ...prev, rank: event.target.value }))} className={SELECT_CLASS}>
            {FORM_RANK_OPTIONS.map((rank) => (
              <option className={OPTION_CLASS} key={rank} value={rank}>{rank}</option>
            ))}
          </select>
          <input type="number" value={uaForm.normTimeMs} onChange={(event) => setUaForm((prev) => ({ ...prev, normTimeMs: Number.parseInt(event.target.value, 10) || prev.normTimeMs }))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Час (мс)" />
          <div className="md:col-span-6 flex justify-end gap-2">
            {editingUaId && (
              <button type="button" onClick={() => { setEditingUaId(null); setUaForm(defaultUaForm); }} className="btn-secondary !px-4 !py-2 text-xs">
                Скасувати редагування
              </button>
            )}
            <button type="submit" className="btn-primary !px-4 !py-2 text-xs">
              {editingUaId ? 'Оновити норматив ФПУ' : 'Додати норматив ФПУ'}
            </button>
          </div>
        </form>
      )}

      {displayMode === 'table' ? (
        <div className="glass-card overflow-hidden border-white/5">
          <div className="overflow-x-auto max-h-[68vh]">
            {activeTab === 'wa' ? (
              <table className={`w-full ${compactTables ? 'text-xs' : 'text-sm'}`}>
                <thead className="sticky top-0 z-10 bg-[#0B1220] text-[10px] font-black uppercase tracking-[0.18em] border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left"><SortHeader label="Басейн" active={waSort.key === 'poolLength'} onClick={() => handleWaSort('poolLength')} /></th>
                    <th className="px-4 py-3 text-left"><SortHeader label="Стать" active={waSort.key === 'gender'} onClick={() => handleWaSort('gender')} /></th>
                    <th className="px-4 py-3 text-left"><SortHeader label="Стиль" active={waSort.key === 'style'} onClick={() => handleWaSort('style')} /></th>
                    <th className="px-4 py-3 text-left"><SortHeader label="Дистанція" active={waSort.key === 'distance'} onClick={() => handleWaSort('distance')} /></th>
                    <th className="px-4 py-3 text-left"><SortHeader label="Рік" active={waSort.key === 'year'} onClick={() => handleWaSort('year')} /></th>
                    <th className="px-4 py-3 text-right"><SortHeader label="Час" active={waSort.key === 'baseTimeMs'} onClick={() => handleWaSort('baseTimeMs')} /></th>
                    {isAdmin && adminEditMode && <th className="px-4 py-3 text-right">Дії</th>}
                  </tr>
                </thead>
                <tbody className="font-medium">
                  {sortedWa.map((row, index) => (
                    <tr key={row.id} className={`${index % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'} hover:bg-white/[0.05] transition-colors`}>
                      <td className="px-4 py-3 text-slate-300">{row.poolLength}м</td>
                      <td className="px-4 py-3 text-slate-300">{genderLabel(row.gender)}</td>
                      <td className="px-4 py-3 text-slate-200 font-semibold">{toStyleUa(row.style)}</td>
                      <td className="px-4 py-3 text-slate-200 font-semibold">{row.distance}м</td>
                      <td className="px-4 py-3 text-slate-400">{row.year}</td>
                      <td className="px-4 py-3 text-right font-mono text-white">{apiMsToTime(row.baseTimeMs)}</td>
                      {isAdmin && adminEditMode && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditWa(row)}
                              className="text-slate-300 hover:text-white transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => void handleDeleteWa(row.id)} className="text-rose-400 hover:text-rose-300 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className={`w-full ${compactTables ? 'text-xs' : 'text-sm'}`}>
                <thead className="sticky top-0 z-10 bg-[#0B1220] text-[10px] font-black uppercase tracking-[0.18em] border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left"><SortHeader label="Басейн" active={uaSort.key === 'poolLength'} onClick={() => handleUaSort('poolLength')} /></th>
                    <th className="px-4 py-3 text-left"><SortHeader label="Стать" active={uaSort.key === 'gender'} onClick={() => handleUaSort('gender')} /></th>
                    <th className="px-4 py-3 text-left"><SortHeader label="Стиль" active={uaSort.key === 'style'} onClick={() => handleUaSort('style')} /></th>
                    <th className="px-4 py-3 text-left"><SortHeader label="Дистанція" active={uaSort.key === 'distance'} onClick={() => handleUaSort('distance')} /></th>
                    <th className="px-4 py-3 text-left"><SortHeader label="Розряд" active={uaSort.key === 'rank'} onClick={() => handleUaSort('rank')} /></th>
                    <th className="px-4 py-3 text-right"><SortHeader label="Час" active={uaSort.key === 'normTimeMs'} onClick={() => handleUaSort('normTimeMs')} /></th>
                    {isAdmin && adminEditMode && <th className="px-4 py-3 text-right">Дії</th>}
                  </tr>
                </thead>
                <tbody className="font-medium">
                  {sortedUa.map((row, index) => (
                    <tr key={row.id} className={`${index % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'} hover:bg-white/[0.05] transition-colors`}>
                      <td className="px-4 py-3 text-slate-300">{row.poolLength}м</td>
                      <td className="px-4 py-3 text-slate-300">{genderLabel(row.gender)}</td>
                      <td className="px-4 py-3 text-slate-200 font-semibold">{toStyleUa(row.style)}</td>
                      <td className="px-4 py-3 text-slate-200 font-semibold">{row.distance}м</td>
                      <td className="px-4 py-3 text-slate-300 font-semibold">{row.rank}</td>
                      <td className="px-4 py-3 text-right font-mono text-white">{apiMsToTime(row.normTimeMs)}</td>
                      {isAdmin && adminEditMode && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button type="button" onClick={() => handleEditUa(row)} className="text-slate-300 hover:text-white transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => void handleDeleteUa(row.id)} className="text-rose-400 hover:text-rose-300 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className={`grid grid-cols-1 xl:grid-cols-2 ${compactTables ? 'gap-3' : 'gap-4'}`}>
          {activeTab === 'wa' ? waCardGroups.map((group) => (
            <section key={group.key} className="glass-card border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="text-lg font-black text-white">{group.distance}м {toStyleUa(group.style)}</h3>
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">{group.rows.length} записів</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {group.rows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <span className="px-2 py-1 rounded bg-white/10 text-slate-200">{row.poolLength}м</span>
                        <span className="px-2 py-1 rounded bg-white/10 text-slate-200">{genderLabel(row.gender)}</span>
                        <span className="text-slate-400">{row.year}</span>
                      </div>
                      <span className="font-mono text-base font-black text-white">{apiMsToTime(row.baseTimeMs)}</span>
                    </div>
                    {isAdmin && adminEditMode && (
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setWaForm({
                            year: row.year,
                            gender: row.gender,
                            distance: row.distance,
                            style: row.style,
                            poolLength: row.poolLength,
                            baseTimeMs: row.baseTimeMs,
                          })}
                          className="text-slate-300 hover:text-white transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => void handleDeleteWa(row.id)} className="text-rose-400 hover:text-rose-300 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )) : uaCardGroups.map((group) => (
            <section key={group.key} className="glass-card border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="text-lg font-black text-white">{group.distance}м {toStyleUa(group.style)}</h3>
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">{group.rows.length} нормативів</span>
              </div>
              <div className="space-y-2">
                {group.rows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span className="px-2 py-1 rounded bg-white/10 text-slate-200">{row.poolLength}м</span>
                      <span className="px-2 py-1 rounded bg-white/10 text-slate-200">{genderLabel(row.gender)}</span>
                      <span className="px-2 py-1 rounded bg-primary-500/20 text-primary-300">{row.rank}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-base font-black text-white">{apiMsToTime(row.normTimeMs)}</span>
                      {isAdmin && adminEditMode && (
                        <div className="inline-flex items-center gap-2">
                          <button type="button" onClick={() => handleEditUa(row)} className="text-slate-300 hover:text-white transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => void handleDeleteUa(row.id)} className="text-rose-400 hover:text-rose-300 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function apiMsToTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}
