'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { AuthRole } from 'shared-contracts';
import { ApiClientError, api, readLastRequestId } from '@/lib/api';

type FaqCategory = 'auth' | 'competitions' | 'normatives' | 'technical';
type CategoryFilter = 'all' | FaqCategory;
type TicketPriority = 'low' | 'normal' | 'high';

interface FaqItem {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'auth-1',
    category: 'auth',
    question: 'Як увійти в систему, якщо я секретар?',
    answer: 'Відкрийте сторінку Вхід або Кабінет, введіть логін/пароль, після входу перевірте роль у профілі.',
  },
  {
    id: 'auth-2',
    category: 'auth',
    question: 'Що робити, якщо не підходить пароль?',
    answer: 'Перевірте розкладку та регістр. Якщо доступ втрачено, зверніться до адміністратора для скидання пароля.',
  },
  {
    id: 'auth-3',
    category: 'auth',
    question: 'Чому мене автоматично розлогінює?',
    answer: 'Сесія могла завершитися через таймаут або зміну пароля. Увійдіть повторно та перевірте активні сесії в Кабінеті.',
  },
  {
    id: 'comp-1',
    category: 'competitions',
    question: 'Як створити нові змагання?',
    answer: 'Перейдіть у розділ Змагання та використайте кнопку створення. Після цього заповніть базові параметри турніру.',
  },
  {
    id: 'comp-2',
    category: 'competitions',
    question: 'Де знайти стартові протоколи?',
    answer: 'Відкрийте конкретне змагання та перейдіть у вкладку стартового протоколу або експорту документів.',
  },
  {
    id: 'comp-3',
    category: 'competitions',
    question: 'Чому недоступний кабінет секретаря для змагання?',
    answer: 'Для статусу чернетки частина секретарських дій блокується. Активуйте змагання, щоб відкрити повний функціонал.',
  },
  {
    id: 'norm-1',
    category: 'normatives',
    question: 'Як знайти потрібний норматив?',
    answer: 'На сторінці Нормативи використайте пошук за стилем, дистанцією або розрядом.',
  },
  {
    id: 'norm-2',
    category: 'normatives',
    question: 'Чи можна редагувати нормативи?',
    answer: 'Так, для користувачів із відповідними правами доступні операції створення, редагування та видалення записів.',
  },
  {
    id: 'norm-3',
    category: 'normatives',
    question: 'Чому не збігаються результати з нормативами?',
    answer: 'Перевірте довжину басейну, стиль і дистанцію. Нормативи чутливі до цих параметрів.',
  },
  {
    id: 'tech-1',
    category: 'technical',
    question: 'Сторінка не завантажується або показує помилку.',
    answer: 'Оновіть сторінку, перевірте мережу та спробуйте інший браузер. Якщо проблема лишилась — створіть звернення.',
  },
  {
    id: 'tech-2',
    category: 'technical',
    question: 'Як передати технічні дані для підтримки?',
    answer: 'На цій сторінці натисніть кнопку "Скопіювати технічні дані" і додайте їх до звернення.',
  },
  {
    id: 'tech-3',
    category: 'technical',
    question: 'Чи можу я імпортувати результати з Excel?',
    answer: 'Так, імпорт підтримує файли .xlsx. Якщо є .xls — збережіть його у форматі .xlsx і повторіть імпорт.',
  },
];

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'Усі категорії',
  auth: 'Авторизація та ролі',
  competitions: 'Змагання та протоколи',
  normatives: 'Нормативи',
  technical: 'Технічні проблеми',
};

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [openFaqId, setOpenFaqId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [role, setRole] = useState<AuthRole | null>(null);
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [submitting, setSubmitting] = useState(false);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  useEffect(() => {
    const loadAuth = async () => {
      setAuthLoading(true);
      setLastRequestId(readLastRequestId());
      try {
        const status = await api.getAuthStatus();
        setAuthenticated(status.authenticated);
        setRole(status.role ?? null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Не вдалося перевірити авторизацію');
        setAuthenticated(false);
        setRole(null);
      } finally {
        setAuthLoading(false);
      }
    };
    void loadAuth();
  }, []);

  const filteredFaq = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return FAQ_ITEMS.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!normalized) return true;
      return `${item.question} ${item.answer}`.toLowerCase().includes(normalized);
    });
  }, [category, query]);

  const handleCopySupportPayload = async () => {
    const payload = [
      `Route: /help`,
      `Timestamp: ${new Date().toISOString()}`,
      `Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'}`,
      `Locale: ${navigator.language || 'unknown'}`,
      `Role: ${role || 'guest'}`,
      `Priority: ${priority}`,
      `LastRequestId: ${readLastRequestId() || 'n/a'}`,
      `UserAgent: ${navigator.userAgent}`,
      `Subject: ${subject || '—'}`,
      `Note: ${note || '—'}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(payload);
      toast.success('Технічні дані скопійовано');
    } catch {
      toast.error('Не вдалося скопіювати технічні дані');
    }
  };

  const handleCreateTicket = async () => {
    if (!authenticated) {
      toast.error('Для створення звернення необхідно увійти в кабінет');
      return;
    }
    if (!subject.trim() || !note.trim()) {
      toast.error('Заповніть тему та опис проблеми');
      return;
    }

    setSubmitting(true);
    const loadingToast = toast.loading('Створення звернення...');
    try {
      const created = await api.createSupportTicket({
        message: `[priority:${priority}] ${subject.trim()}\n\n${note.trim()}`,
        page: '/help',
        userAgent: navigator.userAgent,
        requestId: readLastRequestId() || undefined,
      });
      toast.success(`Тікет #${created.ticketId} створено`, { id: loadingToast });
      setSubject('');
      setNote('');
      setPriority('normal');
      setLastRequestId(readLastRequestId());
    } catch (error) {
      if (error instanceof ApiClientError) {
        toast.error(error.message, { id: loadingToast });
      } else {
        toast.error('Не вдалося створити звернення', { id: loadingToast });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-6 animate-fade-in">
      <section className="surface-elevated p-8 space-y-4">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Центр допомоги</p>
        <h1 className="text-4xl font-black premium-hero-title">Допомога та підтримка</h1>
        <p className="text-slate-300">
          База знань SwimSync: відповіді на типові питання, швидкі переходи та форма звернення до підтримки.
        </p>
        <a href="#support-form" className="btn-primary inline-flex">Створити звернення</a>
      </section>

      <section className="glass-card p-6 space-y-4">
        <h2 className="text-2xl font-black text-white">Швидкі дії</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/competitions" className="btn-primary">Перейти до змагань</Link>
          <Link href="/login" className="btn-secondary">Увійти в систему</Link>
          <Link href="/normatives" className="btn-secondary">Відкрити нормативи</Link>
        </div>
      </section>

      <section className="glass-card p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-black text-white">Пошук у FAQ</h2>
          <span className="premium-chip">{filteredFaq.length} результат(ів)</span>
        </div>

        <label className="block text-sm text-slate-300">
          <span className="block mb-2 font-bold">Пошуковий запит</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Введіть ключове слово..."
            className="premium-input w-full"
            aria-label="Пошук по FAQ"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={key === category ? 'btn-primary !px-3 !py-2 !text-xs' : 'btn-secondary !px-3 !py-2 !text-xs'}
              aria-pressed={key === category}
            >
              {CATEGORY_LABELS[key]}
            </button>
          ))}
        </div>

        {filteredFaq.length === 0 ? (
          <p className="text-slate-400">За цим запитом нічого не знайдено. Спробуйте інші ключові слова.</p>
        ) : (
          <div className="space-y-3">
            {filteredFaq.map((item) => {
              const opened = openFaqId === item.id;
              const contentId = `faq-content-${item.id}`;
              return (
                <article key={item.id} className="rounded-xl border border-white/10 bg-white/5">
                  <h3>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 rounded-xl"
                      onClick={() => setOpenFaqId((prev) => (prev === item.id ? null : item.id))}
                      aria-expanded={opened}
                      aria-controls={contentId}
                    >
                      {item.question}
                    </button>
                  </h3>
                  {opened && (
                    <p id={contentId} className="px-4 pb-4 text-sm text-slate-300">
                      {item.answer}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section id="support-form" className="glass-card p-6 space-y-4">
        <h2 className="text-2xl font-black text-white">Не знайшли відповідь?</h2>
        <p className="text-sm text-slate-300">
          Опишіть проблему, додайте контекст і надішліть звернення до команди підтримки.
        </p>
        {!authLoading && !authenticated && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Створення звернення доступне після входу.{' '}
            <Link href="/cabinet" className="underline font-bold hover:text-white">
              Увійти в кабінет
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-slate-300">
            <span className="block mb-2 font-bold">Тема</span>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="premium-input w-full"
              placeholder="Коротко: у чому проблема"
              aria-label="Тема звернення"
              required
            />
          </label>

          <label className="text-sm text-slate-300">
            <span className="block mb-2 font-bold">Пріоритет</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TicketPriority)}
              className="premium-input w-full"
              aria-label="Пріоритет звернення"
            >
              <option value="low" className="bg-surface-dark text-slate-100">Низький</option>
              <option value="normal" className="bg-surface-dark text-slate-100">Звичайний</option>
              <option value="high" className="bg-surface-dark text-slate-100">Високий</option>
            </select>
          </label>
        </div>

        <label className="text-sm text-slate-300 block">
          <span className="block mb-2 font-bold">Опис проблеми</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="premium-input min-h-28 w-full"
            placeholder="Опишіть кроки відтворення та очікуваний результат..."
            aria-label="Опис проблеми"
            required
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void handleCopySupportPayload()} className="btn-secondary" aria-label="Скопіювати технічні дані">
            Скопіювати технічні дані
          </button>
          <button
            type="button"
            onClick={() => void handleCreateTicket()}
            disabled={submitting || authLoading || !authenticated}
            className="btn-primary"
            aria-label="Надіслати звернення в підтримку"
          >
            {submitting ? 'Надсилання...' : 'Надіслати'}
          </button>
          {lastRequestId && <span className="premium-chip">RequestId: {lastRequestId}</span>}
        </div>
      </section>
    </div>
  );
}

