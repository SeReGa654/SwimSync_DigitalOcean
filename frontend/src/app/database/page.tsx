'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiClientError, type AthleteDatabaseTreeRegion } from '@/lib/api';
import { toGenderUa, toRankUa } from '@/lib/athlete-display';
import { toast } from 'sonner';

type SortField = 'lastName' | 'firstName' | 'birthYear' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function DatabasePage() {
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<AthleteDatabaseTreeRegion[]>([]);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [clubFilter, setClubFilter] = useState('');
  const [sort, setSort] = useState<SortField>('lastName');
  const [direction, setDirection] = useState<SortDirection>('asc');
  const [totalAthletes, setTotalAthletes] = useState(0);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<number[]>([]);
  const requestSeqRef = useRef(0);

  const loadTree = async () => {
    const requestSeq = ++requestSeqRef.current;
    setLoading(true);
    try {
      const response = await api.getAthleteDatabaseTree({
        search: search || undefined,
        region: regionFilter || undefined,
        club: clubFilter || undefined,
        sort,
        direction,
        limit: 1000,
      });
      if (requestSeq !== requestSeqRef.current) return;
      setRegions(response.regions);
      setTotalAthletes(response.totalAthletes);
      const availableIds = new Set(
        response.regions.flatMap((region) =>
          region.schools.flatMap((school) => school.athletes.map((athlete) => athlete.id)),
        ),
      );
      setSelectedAthleteIds((prev) => prev.filter((id) => availableIds.has(id)));
    } catch (error) {
      if (error instanceof ApiClientError) {
        toast.error(error.message);
      } else {
        toast.error('Не вдалося завантажити базу спортсменів');
      }
    } finally {
      if (requestSeq !== requestSeqRef.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadTree();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, regionFilter, clubFilter, sort, direction]);

  const knownRegions = useMemo(
    () => Array.from(new Set(regions.map((item) => item.region))).sort((a, b) => a.localeCompare(b, 'uk')),
    [regions],
  );
  const knownClubs = useMemo(
    () => Array.from(new Set(regions.flatMap((item) => item.schools.map((school) => school.school)))).sort((a, b) => a.localeCompare(b, 'uk')),
    [regions],
  );
  const toggleAthleteSelection = (athleteId: number) => {
    setSelectedAthleteIds((prev) => (
      prev.includes(athleteId) ? prev.filter((id) => id !== athleteId) : [...prev, athleteId]
    ));
  };
  const multiDraftHref = `/applications/new?athleteIds=${selectedAthleteIds.join(',')}`;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in">
      <section className="surface-elevated p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-2">База спортсменів</p>
        <h1 className="text-4xl font-black premium-hero-title">База даних спортсменів</h1>
        <p className="text-slate-300 mt-3">
          Ієрархічне представлення: Регіони → Спортивні школи → Спортсмени. Показуються лише доступні вам записи.
          Всього у вибірці: <span className="font-bold text-white">{totalAthletes}</span>.
        </p>
      </section>

      <section className="glass-card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Пошук (ПІБ, школа, регіон, тренер)"
            className="premium-input md:col-span-2"
          />
          <select value={sort} onChange={(event) => setSort(event.target.value as SortField)} className="premium-input premium-select">
            <option className="bg-slate-900 text-slate-100" value="lastName">Сортування: Прізвище</option>
            <option className="bg-slate-900 text-slate-100" value="firstName">Сортування: Ім'я</option>
            <option className="bg-slate-900 text-slate-100" value="birthYear">Сортування: Рік народження</option>
            <option className="bg-slate-900 text-slate-100" value="createdAt">Сортування: Останнє оновлення</option>
          </select>
          <select value={direction} onChange={(event) => setDirection(event.target.value as SortDirection)} className="premium-input premium-select">
            <option className="bg-slate-900 text-slate-100" value="asc">Напрям: Зростання</option>
            <option className="bg-slate-900 text-slate-100" value="desc">Напрям: Спадання</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)} className="premium-input premium-select">
            <option className="bg-slate-900 text-slate-100" value="">Усі регіони</option>
            {knownRegions.map((region) => (
              <option className="bg-slate-900 text-slate-100" key={region} value={region}>{region}</option>
            ))}
          </select>
          <select value={clubFilter} onChange={(event) => setClubFilter(event.target.value)} className="premium-input premium-select">
            <option className="bg-slate-900 text-slate-100" value="">Усі школи</option>
            {knownClubs.map((club) => (
              <option className="bg-slate-900 text-slate-100" key={club} value={club}>{club}</option>
            ))}
          </select>
          <div className="flex">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setRegionFilter('');
                setClubFilter('');
              }}
              className="btn-secondary"
            >
              Скинути
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-300">
            Обрано спортсменів для групової заявки: <span className="font-bold text-white">{selectedAthleteIds.length}</span>
            {loading && regions.length > 0 && <span className="ml-3 text-xs text-slate-400">Оновлення результатів...</span>}
          </p>
          {selectedAthleteIds.length > 0 ? (
            <Link href={multiDraftHref} className="btn-primary">
              Створити іменну заявку ({selectedAthleteIds.length})
            </Link>
          ) : (
            <button type="button" className="btn-secondary opacity-60 cursor-not-allowed" disabled>
              Створити іменну заявку
            </button>
          )}
        </div>
      </section>

      <section className="space-y-4">
        {loading && regions.length === 0 ? (
          <div className="glass-card p-6 text-slate-300">Завантаження...</div>
        ) : !loading && regions.length === 0 ? (
          <div className="glass-card p-6 text-slate-300">За поточними фільтрами дані не знайдено.</div>
        ) : (
          regions.map((region) => (
            <details key={region.region} className="glass-card p-5" open>
              <summary className="cursor-pointer text-xl font-black text-white">
                {region.region} <span className="text-sm text-slate-400 font-bold">({region.schools.length} шкіл)</span>
              </summary>
              <div className="mt-4 space-y-4">
                {region.schools.map((school) => (
                  <details key={`${region.region}-${school.school}`} className="rounded-xl border border-white/10 bg-white/5 p-4" open>
                    <summary className="cursor-pointer text-lg font-bold text-slate-100">
                      {school.school} <span className="text-xs text-slate-400">({school.athletes.length} спортсменів)</span>
                    </summary>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-400 border-b border-white/10">
                            <th className="py-2 pr-3">Обрати</th>
                            <th className="py-2 pr-3">ПІБ</th>
                            <th className="py-2 pr-3">Рік</th>
                            <th className="py-2 pr-3">Стать</th>
                            <th className="py-2 pr-3">Розряд</th>
                            <th className="py-2 pr-3">Тренер</th>
                            <th className="py-2 pr-3">Заявок</th>
                            <th className="py-2 pr-3">Дія</th>
                          </tr>
                        </thead>
                        <tbody>
                          {school.athletes.map((athlete) => (
                            <tr key={athlete.id} className="border-b border-white/5 text-slate-200">
                              <td className="py-2 pr-3">
                                <input
                                  type="checkbox"
                                  checked={selectedAthleteIds.includes(athlete.id)}
                                  onChange={() => toggleAthleteSelection(athlete.id)}
                                  className="h-4 w-4 accent-primary-500"
                                />
                              </td>
                              <td className="py-2 pr-3 font-semibold">{athlete.lastName} {athlete.firstName}</td>
                              <td className="py-2 pr-3">{athlete.birthYear}</td>
                              <td className="py-2 pr-3">{toGenderUa(athlete.gender)}</td>
                              <td className="py-2 pr-3">{toRankUa(athlete.currentRank)}</td>
                              <td className="py-2 pr-3">{athlete.coach || '—'}</td>
                              <td className="py-2 pr-3">{athlete.applicationCount}</td>
                              <td className="py-2 pr-3">
                                <Link href={`/applications/new?athleteId=${athlete.id}`} className="btn-secondary !px-3 !py-1.5 !text-xs">
                                  Іменна заявка
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))
        )}
      </section>
    </div>
  );
}
