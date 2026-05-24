'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, LogIn, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ApiClientError, api } from '@/lib/api';

const TARGET_ROUTES: Record<string, string> = {
  cabinet: '/cabinet',
  admin: '/admin',
  competitions: '/competitions',
};

const LOGIN_TARGETS = [
  { key: 'cabinet', title: 'Особистий кабінет', description: 'Сесії, профіль, налаштування.' },
  { key: 'admin', title: 'Адмін-панель', description: 'Користувачі, логи, флаги.' },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [target, setTarget] = useState<'cabinet' | 'admin' | 'competitions'>('cabinet');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const loadingToast = toast.loading('Вхід у систему...');
    try {
      const auth = await api.loginWithCredentials(username, password);
      const nextRoute = TARGET_ROUTES[target] || (auth.role === 'admin' ? '/admin' : '/cabinet');
      toast.success('Вхід виконано', { id: loadingToast });
      router.push(nextRoute);
    } catch (error: unknown) {
      if (error instanceof ApiClientError) {
        toast.error(error.message, { id: loadingToast });
      } else {
        toast.error('Помилка авторизації', { id: loadingToast });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[960px] mx-auto space-y-6 animate-fade-in">
      <section className="surface-elevated p-8 space-y-4">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Вхід</p>
        <h1 className="text-4xl font-black premium-hero-title">Єдина точка входу в SwimSync</h1>
        <p className="text-slate-300">
          Увійдіть один раз і перейдіть у потрібний розділ залежно від ролі або задачі.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {LOGIN_TARGETS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTarget(item.key)}
            className={`glass-card p-5 text-left border transition-all ${target === item.key ? 'border-primary-500/40 bg-primary-500/10' : 'border-white/10 hover:border-white/20'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">{item.title}</h2>
              {target === item.key && <ShieldCheck className="w-4 h-4 text-primary-400" />}
            </div>
            <p className="mt-2 text-sm text-slate-400">{item.description}</p>
          </button>
        ))}
      </section>

      <section className="glass-card p-6 space-y-4">
        <h2 className="text-2xl font-black text-white">Авторизація</h2>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-[520px]">
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Логін"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary-500 outline-none"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Пароль"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary-500 outline-none"
            required
          />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={loading} className="btn-primary py-3 px-6 disabled:opacity-50 inline-flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              {loading ? 'Авторизація...' : 'Увійти'}
            </button>
            <Link href="/cabinet" className="btn-secondary py-3 px-6 inline-flex items-center gap-2">
              До кабінету
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
