'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Trophy, Medal, Star } from 'lucide-react';
import { useState } from 'react';
import type { StandingsRow } from '@/lib/api';

export default function StandingsTab({ compId }: { compId: number }) {
  const [view, setView] = useState<'medals' | 'points'>('medals');

  const { data, isLoading } = useQuery({
    queryKey: ['standings', compId],
    queryFn: () => api.getStandings(compId),
  });

  if (isLoading) {
    return <div className="text-center py-24 text-slate-500 animate-pulse">Збір результатів...</div>;
  }

  const list: StandingsRow[] = view === 'medals' ? (data?.medalStandings ?? []) : (data?.pointsStandings ?? []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-white">Командний залік</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Офіційний рейтинг клубів</p>
        </div>

        <div className="flex bg-white/5 p-1 rounded-xl w-full sm:w-fit">
          <button onClick={() => setView('medals')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
              view === 'medals' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}>
            <Medal className="w-4 h-4" /> Медалі
          </button>
          <button onClick={() => setView('points')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
              view === 'points' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}>
            <Star className="w-4 h-4" /> Очки FINA
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {list && list.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 text-left w-16">#</th>
                  <th className="px-6 py-4 text-left">Команда / Клуб</th>
                  {view === 'medals' ? (
                    <>
                      <th className="px-6 py-4 text-center text-amber-500">Золото</th>
                      <th className="px-6 py-4 text-center text-slate-300">Срібло</th>
                      <th className="px-6 py-4 text-center text-amber-700">Бронза</th>
                      <th className="px-6 py-4 text-center font-black">Всього</th>
                    </>
                  ) : (
                    <th className="px-6 py-4 text-right font-black">Бали FINA</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {list.map((item, i: number) => (
                  <tr key={item.club} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{i + 1}</td>
                    <td className="px-6 py-4 font-bold text-slate-200">{item.club}</td>
                    {view === 'medals' ? (
                      <>
                        <td className="px-6 py-4 text-center font-bold text-amber-500">{item.gold || '-'}</td>
                        <td className="px-6 py-4 text-center font-bold text-slate-300">{item.silver || '-'}</td>
                        <td className="px-6 py-4 text-center font-bold text-amber-600">{item.bronze || '-'}</td>
                        <td className="px-6 py-4 text-center font-black text-white">{item.gold + item.silver + item.bronze}</td>
                      </>
                    ) : (
                      <td className="px-6 py-4 text-right font-mono font-bold text-primary-400">{item.points}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-600">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p className="font-bold text-lg">Залік ще не сформовано</p>
            <p className="text-xs uppercase tracking-widest mt-1 opacity-50">Фіналізуйте події, щоб з'явилися таблиці</p>
          </div>
        )}
      </div>
    </div>
  );
}
