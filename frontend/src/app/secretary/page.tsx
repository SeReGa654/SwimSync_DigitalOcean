'use client';

import { useEffect, useState } from 'react';
import { ApiClientError, api } from '@/lib/api';
import type { AuthRole } from 'shared-contracts';
import { Competition } from '@/types';
import { toast } from 'sonner';
import { Plus, MapPin, Trophy, Waves, ChevronRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

type CompetitionTab = 'overview' | 'management';

const emptyCompetitionForm = {
  name: '',
  categoriesStr: '',
  location: '',
  venue: '',
  poolLength: 50,
  lanes: 8,
  dateFrom: '',
  dateTo: '',
};

export default function CompetitionsPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<AuthRole | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerRole, setRegisterRole] = useState<AuthRole>('secretary');
  const [registerLoading, setRegisterLoading] = useState(false);

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionsLoading, setCompetitionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<CompetitionTab>('overview');

  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyCompetitionForm);

  const canManageCompetitions = role === 'secretary' || role === 'admin';

  const loadCompetitions = async () => {
    setCompetitionsLoading(true);
    try {
      const data = await api.getCompetitions();
      setCompetitions(data);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося завантажити змагання');
    } finally {
      setCompetitionsLoading(false);
    }
  };

  useEffect(() => {
    api.getAuthStatus()
      .then(async (status) => {
        setAuthenticated(status.authenticated);
        setRole(status.role || null);
        if (status.authenticated) {
          await loadCompetitions();
        }
      })
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthLoading(true);
    try {
      const auth = await api.loginWithCredentials(usernameInput, passwordInput);
      setAuthenticated(true);
      setRole(auth.role || null);
      setUsernameInput('');
      setPasswordInput('');
      await loadCompetitions();
      toast.success('Вхід виконано');
    } catch (error: unknown) {
      setAuthenticated(false);
      setRole(null);
      if (error instanceof ApiClientError) {
        toast.error(error.message);
      } else {
        toast.error('Помилка авторизації');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreateCompetition = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageCompetitions) {
      toast.error('Доступ до створення змагань наразі обмежений');
      return;
    }
    try {
      const comp = await api.createCompetition(form);
      setCompetitions((prev) => [comp, ...prev]);
      setIsCreating(false);
      setForm(emptyCompetitionForm);
      toast.success('Змагання створено');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Помилка створення змагання');
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setRegisterLoading(true);
    try {
      const result = await api.registerAccount(registerUsername, registerPassword, registerRole);
      setRegisterUsername('');
      setRegisterPassword('');
      setRegisterRole('secretary');
      toast.success(`Запит на реєстрацію "${result.username}" надіслано. Очікуйте підтвердження адміністратора.`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося надіслати запит на реєстрацію');
    } finally {
      setRegisterLoading(false);
    }
  };

  if (!authChecked) {
    return <div className="max-w-[800px] mx-auto py-20 text-center text-slate-400">Перевірка доступу...</div>;
  }

  if (!authenticated) {
    return (
      <div className="max-w-[960px] mx-auto py-16 space-y-6">
        <div className="glass-card p-8 border-white/10">
          <h2 className="text-3xl font-black text-white">Змагання</h2>
          <p className="text-sm text-slate-400 mt-2">
            Увійдіть у потрібний кабінет і працюйте із змаганнями у захищеному розділі.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
            <Link href="/admin" className="btn-secondary text-center">Адмін-панель</Link>
            <Link href="/cabinet" className="btn-secondary text-center">Особистий кабінет</Link>
            <Link href="/normatives" className="btn-secondary text-center">Нормативи</Link>
          </div>
        </div>

        <div className="glass-card p-8 border-white/10">
          <h3 className="text-xl font-black text-white mb-4">Авторизація</h3>
          <form onSubmit={handleLogin} className="space-y-4 max-w-[520px]">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Логін"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary-500 outline-none"
              required
            />
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Пароль"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary-500 outline-none"
              required
            />
            <button type="submit" disabled={authLoading} className="btn-primary py-3 px-6 disabled:opacity-50">
              {authLoading ? 'Авторизація...' : 'Увійти'}
            </button>
          </form>
        </div>

        <div className="glass-card p-8 border-white/10">
          <h3 className="text-xl font-black text-white mb-4">Запит на реєстрацію кабінету</h3>
          <p className="text-sm text-slate-400 mb-4">
            Після відправки запиту акаунт зможе увійти тільки після підтвердження адміністратором.
          </p>
          <form onSubmit={handleRegister} className="space-y-4 max-w-[560px]">
            <input
              type="text"
              value={registerUsername}
              onChange={(e) => setRegisterUsername(e.target.value)}
              placeholder="Новий логін"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary-500 outline-none"
              required
            />
            <input
              type="password"
              value={registerPassword}
              onChange={(e) => setRegisterPassword(e.target.value)}
              placeholder="Новий пароль (мінімум 8 символів)"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary-500 outline-none"
              minLength={8}
              required
            />
            <select
              value={registerRole}
              onChange={(e) => setRegisterRole(e.target.value as AuthRole)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary-500 outline-none"
            >
              <option value="secretary">Секретар</option>
              <option value="admin">Адміністратор</option>
            </select>
            <button type="submit" disabled={registerLoading} className="btn-secondary py-3 px-6 disabled:opacity-50">
              {registerLoading ? 'Надсилання...' : 'Надіслати запит'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 animate-fade-in">
      <div className="glass-card p-6 border-white/10 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white">Змагання</h2>
          <p className="text-slate-400 text-sm">Робоча зона керування подіями.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/database" className="btn-secondary !px-4 !py-2 text-xs">База даних</Link>
          <Link href="/applications/new" className="btn-primary !px-4 !py-2 text-xs">Іменна заявка</Link>
        </div>
      </div>

      <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5 w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'overview' ? 'bg-primary-500 text-white shadow-xl shadow-primary-500/20' : 'text-slate-500 hover:text-white'
          }`}
        >
          Список
        </button>
        <button
          onClick={() => setActiveTab('management')}
          className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'management' ? 'bg-primary-500 text-white shadow-xl shadow-primary-500/20' : 'text-slate-500 hover:text-white'
          }`}
        >
          Керування
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-4">
          {competitionsLoading ? (
            <p className="text-sm text-slate-500">Завантаження змагань...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {competitions.map((comp) => (
                <Link
                  key={comp.id}
                  href={`/competitions/${comp.id}`}
                  className="glass-card p-5 border-white/10 hover:border-primary-500/30 transition-colors"
                >
                  <p className="text-xs text-slate-500 uppercase font-black tracking-widest">{comp.status}</p>
                  <h3 className="text-lg font-black text-white mt-1">{comp.name}</h3>
                  <p className="text-sm text-slate-400 mt-2">{comp.location} • {comp.poolLength}м</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-card p-6 border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-white">Керування змаганнями</h3>
              <p className="text-sm text-slate-400">Створення нових подій доступне після відповідної авторизації.</p>
            </div>
            <button
              onClick={() => {
                if (!canManageCompetitions) {
                  toast.error('Недостатньо прав для створення змагання');
                  return;
                }
                setIsCreating(true);
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Нове змагання
            </button>
          </div>

          {!canManageCompetitions && (
            <div className="glass-card p-4 border-white/10 text-sm text-amber-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Для створення нових змагань потрібна авторизація секретаря або адміністратора.
            </div>
          )}

          {competitionsLoading ? (
            <p className="text-sm text-slate-500">Завантаження змагань...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {competitions.map((comp) => (
                <a
                  key={comp.id}
                  href={`/competitions/${comp.id}`}
                  className="group relative glass-card p-6 border-white/10 hover:border-primary-500/30 transition-all hover:-translate-y-1"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity">
                    <Trophy className="w-16 h-16" />
                  </div>
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${
                        comp.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : comp.status === 'completed' ? 'bg-slate-500/20 text-slate-400 border border-white/10'
                            : 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                      }`}>
                        {comp.status === 'active' ? '● Live' : comp.status === 'completed' ? 'Архів' : 'Чернетка'}
                      </span>
                      <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-primary-400 transition-colors" />
                    </div>
                    <h4 className="text-xl font-bold mb-6 group-hover:text-primary-400 transition-colors leading-tight">{comp.name}</h4>
                    <div className="mt-auto space-y-3">
                      <div className="flex items-center gap-3 text-slate-500 text-xs">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-300">{comp.location}</div>
                          <div>{comp.venue || 'Плавальний басейн'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 text-xs">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
                          <Waves className="w-4 h-4" />
                        </div>
                        <div className="font-bold text-slate-300">{comp.poolLength}м • {comp.lanes} доріжок</div>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg-dark/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-2xl p-8 border-primary-500/20 shadow-primary-500/10">
            <h3 className="text-2xl font-bold mb-6">Створити змагання</h3>
            <form onSubmit={handleCreateCompetition} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Назва події</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary-500 outline-none transition-all"
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Категорії учасників</label>
                <input
                  value={form.categoriesStr}
                  onChange={(e) => setForm({ ...form, categoriesStr: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Місто</label>
                <input
                  required
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Басейн</label>
                <input
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Параметри</label>
                <select
                  value={form.poolLength}
                  onChange={(e) => setForm({ ...form, poolLength: parseInt(e.target.value, 10) })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
                >
                  <option value={50} className="bg-slate-900">50м (довга вода)</option>
                  <option value={25} className="bg-slate-900">25м (коротка вода)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Доріжки</label>
                <input
                  type="number"
                  min={4}
                  max={10}
                  required
                  value={form.lanes}
                  onChange={(e) => setForm({ ...form, lanes: parseInt(e.target.value, 10) })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Дата початку</label>
                <input
                  type="date"
                  value={form.dateFrom}
                  onChange={(e) => setForm({ ...form, dateFrom: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary-500 outline-none transition-all [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Дата завершення</label>
                <input
                  type="date"
                  value={form.dateTo}
                  onChange={(e) => setForm({ ...form, dateTo: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary-500 outline-none transition-all [color-scheme:dark]"
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsCreating(false)} className="btn-secondary">Скасувати</button>
                <button type="submit" className="btn-primary">Створити змагання</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
