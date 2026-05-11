'use client';

import { useEffect, useState } from 'react';
import { ApiClientError, api } from '@/lib/api';
import OperatorDashboard from '@/components/operator/OperatorDashboard';
import type { AuthManagedUser, AuthRole, AuthSessionInfo, FeatureFlagDto } from 'shared-contracts';
import { Crown } from 'lucide-react';
import { toast } from 'sonner';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import Link from 'next/link';

const systemLinks = [
  {
    title: 'Керування змаганнями (повний CRUD)',
    description: 'Створення, редагування та видалення змагань, дистанцій, заявок і результатів',
    href: '/competitions',
    external: false,
  },
  {
    title: 'Логи системи',
    description: 'Повний журнал дій і подій системи',
    href: '/logs',
    external: false,
  },
  {
    title: 'Swagger Backend API',
    description: 'Документація REST API бекенда',
    href: 'http://localhost:3001/docs',
    external: true,
  },
  {
    title: 'OpenAPI JSON (Backend)',
    description: 'Машинний опис API (docs-json)',
    href: 'http://localhost:3001/docs-json',
    external: true,
  },
  {
    title: 'Swagger DOCX Service',
    description: 'Документація документового сервісу',
    href: 'http://localhost:3002/docs',
    external: true,
  },
  {
    title: 'Health Check',
    description: 'Базова перевірка доступності бекенда',
    href: '/api/health',
    external: true,
  },
  {
    title: 'Readiness Check',
    description: 'Готовність бекенда та БД',
    href: '/api/health/ready',
    external: true,
  },
  {
    title: 'Dependencies Check',
    description: 'Стан залежностей (DOCX/Redis/Postgres)',
    href: '/api/health/dependencies',
    external: true,
  },
  {
    title: 'Prisma Studio',
    description: 'Огляд даних БД для адміністрування',
    href: 'http://localhost:5555',
    external: true,
  },
];

export default function AdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<AuthRole | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authSessions, setAuthSessions] = useState<AuthSessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [users, setUsers] = useState<AuthManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserSessions, setSelectedUserSessions] = useState<AuthSessionInfo[]>([]);
  const [selectedUserSessionsLoading, setSelectedUserSessionsLoading] = useState(false);
  const [passwordResetValues, setPasswordResetValues] = useState<Record<number, string>>({});
  const [updatingFlagKey, setUpdatingFlagKey] = useState<string | null>(null);
  const {
    flags: featureFlags,
    loading: flagsLoading,
    error: flagsError,
    reload: reloadFeatureFlags,
    updateFlag,
  } = useFeatureFlags(authenticated && role === 'admin');

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const sessions = await api.getAuthSessions();
      setAuthSessions(sessions);
    } catch (error: unknown) {
      if (error instanceof ApiClientError && error.statusCode === 404) {
        setAuthSessions([]);
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Не вдалося завантажити сесії');
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await api.getAuthUsers();
      setUsers(data);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося завантажити користувачів');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    api.getAuthStatus()
      .then((status) => {
        setAuthenticated(status.authenticated);
        setRole(status.role || null);
        if (status.authenticated && status.role === 'admin') {
          void loadSessions();
          void loadUsers();
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
      if (auth.role === 'admin') {
        await loadSessions();
        await loadUsers();
      }
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

  const handleLogout = async (allDevices = false) => {
    setAuthLoading(true);
    try {
      if (allDevices) {
        try {
          await api.logoutAllSessions();
          toast.success('Сесії завершено на всіх пристроях');
        } catch (error: unknown) {
          if (error instanceof ApiClientError && error.statusCode === 404) {
            await api.logoutAdmin();
          } else {
            throw error;
          }
        }
      } else {
        await api.logoutAdmin();
      }
      setAuthenticated(false);
      setRole(null);
      setAuthSessions([]);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося завершити сесію');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: number) => {
    setSessionsLoading(true);
    try {
      const result = await api.revokeAuthSession(sessionId);
      if (result.revoked) {
        toast.success('Сесію відкликано');
        await loadSessions();
      } else {
        toast.error('Не вдалося відкликати сесію');
      }
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleToggleFlag = async (flag: FeatureFlagDto) => {
    setUpdatingFlagKey(flag.key);
    try {
      const updated = await updateFlag(flag.key, !flag.enabled);
      toast.success(`Флаг ${updated.enabled ? 'увімкнено' : 'вимкнено'}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося оновити флаг');
    } finally {
      setUpdatingFlagKey(null);
    }
  };

  const handleApproveUser = async (userId: number) => {
    setUsersLoading(true);
    try {
      await api.approveAuthUser(userId);
      toast.success('Акаунт підтверджено');
      await loadUsers();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося підтвердити акаунт');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleToggleUserActive = async (userId: number, nextActive: boolean) => {
    setUsersLoading(true);
    try {
      if (nextActive) {
        await api.activateAuthUser(userId);
        toast.success('Користувача активовано');
      } else {
        await api.deactivateAuthUser(userId);
        toast.success('Користувача деактивовано');
      }
      await loadUsers();
      if (selectedUserId === userId && !nextActive) {
        setSelectedUserSessions([]);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося змінити статус користувача');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleResetUserPassword = async (userId: number) => {
    const password = (passwordResetValues[userId] || '').trim();
    if (password.length < 8) {
      toast.error('Новий пароль має містити мінімум 8 символів');
      return;
    }
    setUsersLoading(true);
    try {
      await api.resetAuthUserPassword(userId, { password });
      setPasswordResetValues((prev) => ({ ...prev, [userId]: '' }));
      toast.success('Пароль оновлено, активні сесії відкликано');
      await loadUsers();
      if (selectedUserId === userId) {
        await handleLoadUserSessions(userId);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося скинути пароль');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleLoadUserSessions = async (userId: number) => {
    setSelectedUserSessionsLoading(true);
    setSelectedUserId(userId);
    try {
      const sessions = await api.getAuthUserSessions(userId);
      setSelectedUserSessions(sessions);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося завантажити сесії користувача');
    } finally {
      setSelectedUserSessionsLoading(false);
    }
  };

  const handleRevokeUserSession = async (userId: number, sessionId: number) => {
    setSelectedUserSessionsLoading(true);
    try {
      const result = await api.revokeAuthUserSession(userId, sessionId);
      if (result.revoked) {
        toast.success('Сесію користувача відкликано');
        await handleLoadUserSessions(userId);
        await loadUsers();
      } else {
        toast.error('Не вдалося відкликати сесію');
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося відкликати сесію користувача');
    } finally {
      setSelectedUserSessionsLoading(false);
    }
  };

  if (!authChecked) {
    return <div className="max-w-[800px] mx-auto py-20 text-center text-slate-400">Перевірка доступу...</div>;
  }

  if (!authenticated) {
    return (
      <div className="max-w-[520px] mx-auto py-20">
        <div className="glass-card p-8 border-white/10 space-y-6">
          <h2 className="text-2xl font-black text-white">Вхід у систему</h2>
          <p className="text-sm text-slate-400">Використайте обліковий запис адміністратора.</p>
          <form onSubmit={handleLogin} className="space-y-4">
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
            <button
              type="submit"
              disabled={authLoading}
              className="btn-primary w-full py-3 disabled:opacity-50"
            >
              {authLoading ? 'Авторизація...' : 'Увійти'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div className="max-w-[520px] mx-auto py-20">
        <div className="glass-card p-8 border-white/10 space-y-6">
          <h2 className="text-2xl font-black text-white">Недостатньо прав</h2>
          <p className="text-sm text-slate-400">Для доступу потрібна роль адміністратора.</p>
          <Link href="/competitions" className="btn-primary w-full py-3 text-center block">
            Перейти до змагань
          </Link>
          <button
            onClick={() => handleLogout()}
            disabled={authLoading}
            className="btn-secondary w-full py-3 disabled:opacity-50"
          >
            Вийти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-500/10 flex items-center justify-center border border-primary-500/20 shadow-lg shadow-primary-500/5">
            <Crown className="w-8 h-8 text-primary-400" />
          </div>
          <div>
            <h2 className="text-4xl font-black text-white leading-none mb-2">Адміністрування</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">Операційний контроль та сесії</p>
          </div>
        </div>
        <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5 w-fit">
          <Link
            href="/logs"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-500 hover:text-white"
          >
            Логи системи
          </Link>
          <button
            onClick={() => handleLogout()}
            disabled={authLoading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-500 hover:text-white disabled:opacity-50"
          >
            Вийти
          </button>
          <button
            onClick={() => handleLogout(true)}
            disabled={authLoading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-500 hover:text-white disabled:opacity-50"
          >
            Вийти всюди
          </button>
        </div>
      </div>

      <OperatorDashboard />

      <div className="glass-card p-6 border-white/10 space-y-4">
        <h3 className="text-lg font-black text-white">Операції з даними</h3>
        <p className="text-sm text-slate-400">
          Адміністратор має повний доступ до всіх даних: створення, редагування та видалення.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <Link href="/competitions" className="btn-primary py-3 text-center">
            Відкрити повне керування змаганнями
          </Link>
          <Link href="/normatives" className="btn-secondary py-3 text-center">
            Керування нормативами
          </Link>
        </div>
      </div>

      <div className="glass-card p-6 border-white/10 space-y-4">
        <h3 className="text-lg font-black text-white">Система та документація</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {systemLinks.map((item) => (
            item.external ? (
              <a
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:border-primary-500/40 hover:bg-primary-500/10"
              >
                <p className="text-sm font-bold text-white">{item.title}</p>
                <p className="text-xs text-slate-400 mt-1">{item.description}</p>
              </a>
            ) : (
              <Link
                key={item.title}
                href={item.href}
                className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:border-primary-500/40 hover:bg-primary-500/10"
              >
                <p className="text-sm font-bold text-white">{item.title}</p>
                <p className="text-xs text-slate-400 mt-1">{item.description}</p>
              </Link>
            )
          ))}
        </div>
      </div>

      <div className="glass-card p-6 border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Користувачі та доступи</h3>
          <button
            type="button"
            onClick={loadUsers}
            disabled={usersLoading}
            className="text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Оновити
          </button>
        </div>
        {usersLoading ? (
          <p className="text-sm text-slate-500">Завантаження користувачів...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-500">Користувачів не знайдено</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{user.username}</p>
                    <p className="text-xs text-slate-400">
                      {user.role} • {user.isApproved ? 'підтверджено' : 'очікує підтвердження'} • {user.isActive ? 'активний' : 'деактивований'} • сесій: {user.activeSessions}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!user.isApproved && (
                      <button
                        type="button"
                        onClick={() => handleApproveUser(user.id)}
                        className="px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                      >
                        Підтвердити
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleToggleUserActive(user.id, !user.isActive)}
                      className="px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-slate-700/20 text-slate-200 border border-slate-500/30"
                    >
                      {user.isActive ? 'Деактивувати' : 'Активувати'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadUserSessions(user.id)}
                      className="px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-primary-500/20 text-primary-200 border border-primary-500/30"
                    >
                      Сесії
                    </button>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-2">
                  <input
                    type="password"
                    value={passwordResetValues[user.id] || ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPasswordResetValues((prev) => ({ ...prev, [user.id]: value }));
                    }}
                    placeholder="Новий пароль (мін. 8)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleResetUserPassword(user.id)}
                    className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-amber-600/20 text-amber-200 border border-amber-500/30"
                  >
                    Скинути пароль
                  </button>
                </div>
                {selectedUserId === user.id && (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-black">Активні сесії</p>
                    {selectedUserSessionsLoading ? (
                      <p className="text-xs text-slate-500">Завантаження...</p>
                    ) : selectedUserSessions.length === 0 ? (
                      <p className="text-xs text-slate-500">Активних сесій немає</p>
                    ) : (
                      selectedUserSessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs text-white truncate">#{session.id} • {session.ip || 'IP невідомий'}</p>
                            <p className="text-[11px] text-slate-400 truncate">до {new Date(session.expiresAt).toLocaleString('uk-UA')}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRevokeUserSession(user.id, session.id)}
                            className="text-xs text-red-300 hover:text-red-200 transition-colors"
                          >
                            Відкликати
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card p-6 border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Feature Flags</h3>
          <button
            type="button"
            onClick={reloadFeatureFlags}
            disabled={flagsLoading}
            className="text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Оновити
          </button>
        </div>
        {flagsError && <p className="text-sm text-rose-400">{flagsError}</p>}
        {flagsLoading ? (
          <p className="text-sm text-slate-500">Завантаження флагів...</p>
        ) : featureFlags.length === 0 ? (
          <p className="text-sm text-slate-500">Флаги ще не ініціалізовано</p>
        ) : (
          <div className="space-y-2">
            {featureFlags.map((flag) => (
              <div key={flag.key} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm text-white font-bold truncate">{flag.name}</p>
                  <p className="text-xs text-slate-400">{flag.description}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{flag.key}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFlag(flag)}
                  disabled={updatingFlagKey === flag.key}
                  className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${
                    flag.enabled ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700/20 text-slate-300 border border-slate-500/30'
                  }`}
                >
                  {updatingFlagKey === flag.key ? 'Оновлення...' : flag.enabled ? 'Увімкнено' : 'Вимкнено'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card p-6 border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Активні сесії</h3>
          <button
            type="button"
            onClick={loadSessions}
            disabled={sessionsLoading}
            className="text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Оновити
          </button>
        </div>
        {sessionsLoading ? (
          <p className="text-sm text-slate-500">Завантаження сесій...</p>
        ) : authSessions.length === 0 ? (
          <p className="text-sm text-slate-500">Немає активних сесій</p>
        ) : (
          <div className="space-y-2">
            {authSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-white font-bold truncate">
                    {session.current ? 'Поточна сесія' : `Сесія #${session.id}`}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {session.ip || 'IP невідомий'} • до {new Date(session.expiresAt).toLocaleString('uk-UA')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevokeSession(session.id)}
                  disabled={sessionsLoading || session.current}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                >
                  Відкликати
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
