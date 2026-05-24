'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type AnchorHTMLAttributes, type ComponentType, type ReactNode } from 'react';
import { api, ApiClientError, readLastRequestId, type AuditLogItem } from '@/lib/api';
import {
  DEFAULT_USER_PREFERENCES,
  type LandingPage,
  readUserPreferences,
  type UserPreferences,
  writeUserPreferences,
} from '@/lib/user-preferences';
import type { AuthRole } from 'shared-contracts';
import { toast } from 'sonner';

type SessionItem = Awaited<ReturnType<typeof api.getMyAuthSessions>>[number];

interface LastWorkContext {
  id: number;
  name: string;
  viewedAt: string;
}

const LAST_WORK_CONTEXT_STORAGE_KEY = 'swimsync:last-competition-context';
type NextLinkLike = ComponentType<{ href: string; children: ReactNode; className?: string } & Record<string, unknown>>;
type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; children: ReactNode };

function AppLink({ href, children, ...props }: AppLinkProps) {
  const NextLink = Link as unknown as NextLinkLike | undefined;
  if (NextLink) {
    return <NextLink href={href} {...props}>{children}</NextLink>;
  }
  return <a href={href} {...props}>{children}</a>;
}

function roleLabel(role: AuthRole | null): string {
  if (role === 'admin') return 'Адміністратор';
  if (role === 'secretary') return 'Секретар';
  return 'Гість';
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('uk-UA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CabinetPage() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<AuthRole | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<number | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [supportNote, setSupportNote] = useState('');
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [lastWorkContext, setLastWorkContext] = useState<LastWorkContext | null>(null);
  const [recentEvents, setRecentEvents] = useState<AuditLogItem[]>([]);

  const loadCabinetData = async () => {
    setLoading(true);
    try {
      const status = await api.getAuthStatus();
      setAuthenticated(status.authenticated);
      setRole(status.role || null);
      setUsername(status.username || null);
      setLastRequestId(readLastRequestId());

      if (status.authenticated) {
        const currentSessions = await api.getMyAuthSessions();
        setSessions(currentSessions);
        if (status.role === 'admin') {
          const events = await api.getAuditLogs({ dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() });
          setRecentEvents(events.slice(0, 8));
        } else {
          setRecentEvents([]);
        }
      } else {
        setSessions([]);
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        toast.error(error.message);
      } else {
        toast.error('Не вдалося завантажити кабінет');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCabinetData();
    setPreferences(readUserPreferences());
    const rawContext = localStorage.getItem(LAST_WORK_CONTEXT_STORAGE_KEY);
    if (rawContext) {
      try {
        const parsed = JSON.parse(rawContext) as LastWorkContext;
        if (typeof parsed.id === 'number' && typeof parsed.name === 'string' && typeof parsed.viewedAt === 'string') {
          setLastWorkContext(parsed);
        }
      } catch {
        setLastWorkContext(null);
      }
    }
  }, []);

  const currentSession = useMemo(() => sessions.find((item) => item.current) || null, [sessions]);
  const activeSessionsCount = sessions.length;

  const availableLandingPages = useMemo(() => {
    const pages: Array<{ value: LandingPage; label: string }> = [
      { value: '/cabinet', label: 'Кабінет' },
      { value: '/competitions', label: 'Змагання' },
      { value: '/normatives', label: 'Нормативи' },
    ];
    if (role === 'admin') pages.push({ value: '/admin', label: 'Адмін-панель' });
    return pages;
  }, [role]);

  const otherSessions = useMemo(() => sessions.filter((item) => !item.current), [sessions]);
  const uniqueIps = useMemo(
    () => new Set(sessions.map((item) => item.ip).filter((ip): ip is string => Boolean(ip && ip !== 'unknown'))),
    [sessions],
  );

  const securityAlerts = useMemo(() => {
    const alerts: string[] = [];
    if (uniqueIps.size > 2) alerts.push('Виявлено активність з декількох IP-адрес.');
    if (otherSessions.length > 3) alerts.push('Багато паралельних сесій. Рекомендується завершити зайві.');
    if (sessions.some((item) => !item.userAgent)) alerts.push('Є сесії без user-agent. Перевірте безпечність входів.');
    return alerts;
  }, [otherSessions.length, sessions, uniqueIps.size]);

  const handleLogoutCurrent = async () => {
    setLoggingOut(true);
    const loadingToast = toast.loading('Вихід з поточної сесії...');
    try {
      await api.logoutAdmin();
      toast.success('Ви вийшли з системи', { id: loadingToast });
      await loadCabinetData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося виконати вихід', { id: loadingToast });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleLogoutAll = async () => {
    setLoggingOut(true);
    const loadingToast = toast.loading('Завершення всіх сесій...');
    try {
      await api.logoutAllSessions();
      toast.success('Усі сесії завершено', { id: loadingToast });
      await loadCabinetData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося завершити всі сесії', { id: loadingToast });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleRevokeOtherSession = async (sessionId: number) => {
    setRevokingSessionId(sessionId);
    const loadingToast = toast.loading(`Завершення сесії #${sessionId}...`);
    try {
      await api.revokeMyAuthSession(sessionId);
      toast.success('Сесію завершено', { id: loadingToast });
      await loadCabinetData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося завершити сесію', { id: loadingToast });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setChangingPassword(true);
    const loadingToast = toast.loading('Зміна пароля...');
    try {
      await api.changeMyPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Пароль змінено. Інші сесії завершено.', { id: loadingToast });
      await loadCabinetData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося змінити пароль', { id: loadingToast });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSavePreferences = () => {
    writeUserPreferences(preferences);
    toast.success('Налаштування профілю збережено');
  };

  const handleResetPreferences = () => {
    setPreferences(DEFAULT_USER_PREFERENCES);
    writeUserPreferences(DEFAULT_USER_PREFERENCES);
    toast.success('Налаштування скинуто до стандартних');
  };

  const handleCreateSupportTicket = async () => {
    const loadingToast = toast.loading('Створення тікета підтримки...');
    try {
      const payload = {
        message: supportNote.trim() || 'Проблема без додаткового опису',
        page: '/cabinet',
        userAgent: navigator.userAgent,
        requestId: readLastRequestId() || undefined,
      };
      const created = await api.createSupportTicket(payload);
      toast.success(`Тікет #${created.ticketId} створено`, { id: loadingToast });
      setSupportNote('');
      await loadCabinetData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося створити тікет', { id: loadingToast });
    }
  };

  const handleCopySupportPayload = async () => {
    const payload = [
      `User: ${username || 'guest'}`,
      `Role: ${role || 'guest'}`,
      `Route: /cabinet`,
      `Timestamp: ${new Date().toISOString()}`,
      `LastRequestId: ${lastRequestId || 'n/a'}`,
      `UserAgent: ${navigator.userAgent}`,
      `Note: ${supportNote || '—'}`,
    ].join('\n');
    await navigator.clipboard.writeText(payload);
    toast.success('Технічний звіт скопійовано');
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-6 animate-fade-in">
      <section className="surface-elevated p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Особистий кабінет</p>
        <h1 className="text-4xl font-black premium-hero-title">Профіль користувача</h1>
        <p className="text-slate-300 mt-3">Тут зібрані дані профілю, безпека сесій, персональні налаштування і підтримка.</p>
      </section>

      {loading ? (
        <section className="glass-card p-6 text-slate-300">Завантаження...</section>
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-5">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Роль</p>
              <p className="mt-2 text-xl font-black text-white">{roleLabel(role)}</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Користувач</p>
              <p className="mt-2 text-xl font-black text-white">{username || 'Гість'}</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Активні сесії</p>
              <p className="mt-2 text-xl font-black text-white">{authenticated ? activeSessionsCount : '—'}</p>
            </div>
          </section>

          {!authenticated ? (
            <section className="glass-card p-6 space-y-4">
              <p className="text-slate-300">Ви не авторизовані. Увійдіть, щоб бачити персональні дані і функції кабінету.</p>
              <div className="flex flex-wrap gap-3">
                <AppLink href="/login" className="btn-primary">Увійти</AppLink>
                <AppLink href="/secretary#register" className="btn-secondary">Зареєструватись</AppLink>
                <AppLink href="/competitions" className="btn-secondary">До змагань</AppLink>
              </div>
            </section>
          ) : (
            <>
              {lastWorkContext && (
                <section className="glass-card p-6 space-y-3">
                  <h2 className="text-2xl font-black text-white">Продовжити роботу</h2>
                  <p className="text-slate-300">
                    Останнє відкриття: <span className="font-bold text-white">{lastWorkContext.name}</span> ({formatDate(lastWorkContext.viewedAt)})
                  </p>
                  <AppLink href={`/competitions/${lastWorkContext.id}`} className="btn-primary">
                    Продовжити в змаганні
                  </AppLink>
                </section>
              )}

              <section className="glass-card p-6 space-y-4">
                <h2 className="text-2xl font-black text-white">Безпека</h2>
                <div className="space-y-2">
                  {securityAlerts.length === 0 ? (
                    <p className="text-sm text-emerald-300">Підозрілих ознак у поточних сесіях не виявлено.</p>
                  ) : (
                    securityAlerts.map((alert) => (
                      <p key={alert} className="text-sm text-rose-300">{alert}</p>
                    ))
                  )}
                </div>

                {currentSession ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="premium-chip justify-between"><span>Поточна сесія створена</span><span>{formatDate(currentSession.createdAt)}</span></div>
                    <div className="premium-chip justify-between"><span>Діє до</span><span>{formatDate(currentSession.expiresAt)}</span></div>
                    <div className="premium-chip justify-between"><span>IP</span><span>{currentSession.ip || '—'}</span></div>
                    <div className="premium-chip justify-between"><span>Пристрій</span><span className="truncate max-w-[220px]">{currentSession.userAgent || '—'}</span></div>
                  </div>
                ) : (
                  <p className="text-slate-400">Інформація про поточну сесію недоступна.</p>
                )}

                {otherSessions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-200">Інші активні сесії</p>
                    {otherSessions.map((session) => (
                      <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-sm text-slate-300">
                          <p>#{session.id} · {session.ip || 'unknown'} · {formatDate(session.createdAt)}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[520px]">{session.userAgent || '—'}</p>
                        </div>
                        <button
                          type="button"
                          disabled={revokingSessionId === session.id}
                          onClick={() => void handleRevokeOtherSession(session.id)}
                          className="btn-secondary !px-3 !py-2 !text-xs"
                        >
                          Завершити
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-bold text-slate-200">Зміна пароля</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      className="premium-input"
                      placeholder="Поточний пароль"
                      required
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="premium-input"
                      placeholder="Новий пароль (мін. 8 символів)"
                      minLength={8}
                      required
                    />
                  </div>
                  <button type="submit" disabled={changingPassword} className="btn-secondary">
                    Оновити пароль
                  </button>
                </form>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => void handleLogoutCurrent()} disabled={loggingOut} className="btn-secondary">
                    Вийти з поточної сесії
                  </button>
                  <button type="button" onClick={() => void handleLogoutAll()} disabled={loggingOut} className="btn-secondary">
                    Вийти з усіх сесій
                  </button>
                </div>
              </section>

              <section className="glass-card p-6 space-y-4">
                <h2 className="text-2xl font-black text-white">Персональні налаштування</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-slate-300 font-bold">Стартова сторінка</span>
                    <select
                      value={preferences.landingPage}
                      onChange={(event) => setPreferences((prev) => ({ ...prev, landingPage: event.target.value as LandingPage }))}
                      className="premium-input"
                    >
                      {availableLandingPages.map((page) => (
                        <option key={page.value} value={page.value} className="bg-surface-dark text-slate-100">
                          {page.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-slate-300 font-bold">Компактний режим таблиць</span>
                    <input
                      type="checkbox"
                      checked={preferences.compactTables}
                      onChange={(event) => setPreferences((prev) => ({ ...prev, compactTables: event.target.checked }))}
                      className="h-4 w-4 accent-primary-500"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 md:col-span-2">
                    <span className="text-slate-300 font-bold">Показувати live-індикатори та підказки</span>
                    <input
                      type="checkbox"
                      checked={preferences.showLiveIndicators}
                      onChange={(event) => setPreferences((prev) => ({ ...prev, showLiveIndicators: event.target.checked }))}
                      className="h-4 w-4 accent-primary-500"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={handleSavePreferences} className="btn-primary">Зберегти налаштування</button>
                  <button type="button" onClick={handleResetPreferences} className="btn-secondary">Скинути</button>
                </div>
              </section>

              <section className="glass-card p-6 space-y-4">
                <h2 className="text-2xl font-black text-white">Підтримка і репорт проблеми</h2>
                <p className="text-slate-300 text-sm">
                  Опишіть проблему, за потреби скопіюйте технічний звіт або створіть тікет прямо з кабінету.
                </p>
                <textarea
                  value={supportNote}
                  onChange={(event) => setSupportNote(event.target.value)}
                  className="premium-input min-h-28 w-full"
                  placeholder="Коротко опишіть проблему..."
                />
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => void handleCopySupportPayload()} className="btn-secondary">
                    Скопіювати техзвіт
                  </button>
                  <button type="button" onClick={() => void handleCreateSupportTicket()} className="btn-primary">
                    Створити тікет підтримки
                  </button>
                  {lastRequestId && <span className="premium-chip">RequestId: {lastRequestId}</span>}
                </div>
              </section>

              {role === 'admin' && (
                <section className="glass-card p-6 space-y-3">
                  <h2 className="text-2xl font-black text-white">Останні системні події</h2>
                  {recentEvents.length === 0 ? (
                    <p className="text-slate-400 text-sm">Події за останню добу відсутні або недоступні.</p>
                  ) : (
                    <div className="space-y-2">
                      {recentEvents.map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs text-slate-400">{formatDate(item.createdAt)}</p>
                          <p className="text-sm text-white font-bold">{item.action}</p>
                          <p className="text-xs text-slate-400 truncate">{item.details || `${item.entity} #${item.entityId ?? '—'}`}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section className="glass-card p-6 space-y-4">
                <h2 className="text-2xl font-black text-white">Швидкі переходи</h2>
                <div className="flex flex-wrap gap-3">
                  <AppLink href={preferences.landingPage} className="btn-primary">Моя стартова сторінка</AppLink>
                  <AppLink href="/competitions" className="btn-secondary">Змагання</AppLink>
                  <AppLink href="/normatives" className="btn-secondary">Нормативи</AppLink>
                  {role === 'admin' && <AppLink href="/admin" className="btn-primary">Адмін-панель</AppLink>}
                  {role === 'admin' && <AppLink href="/logs" className="btn-secondary">Журнал аудиту</AppLink>}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
