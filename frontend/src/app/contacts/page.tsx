'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ApiClientError, api, readLastRequestId } from '@/lib/api';

type ContactFormType = 'general' | 'technical' | 'partnership';

interface ContactFormErrors {
  name?: string;
  email?: string;
  message?: string;
  consent?: string;
}

const CONTACTS = [
  {
    id: 'general',
    title: 'Загальна підтримка',
    description: 'Питання по роботі платформи, доступам, навігації та базовому функціоналу.',
    email: 'support@swimsync.app',
  },
  {
    id: 'technical',
    title: 'Технічна підтримка',
    description: 'Інциденти, помилки, нестабільна робота сторінок, питання інтеграцій.',
    email: 'tech@swimsync.app',
  },
  {
    id: 'partnership',
    title: 'Партнерство та організатори',
    description: 'Співпраця та запити від організаторів.',
    email: 'partners@swimsync.app',
  },
] as const;

export default function ContactsPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<ContactFormType>('general');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  useEffect(() => {
    const loadAuth = async () => {
      setAuthLoading(true);
      setLastRequestId(readLastRequestId());
      try {
        const status = await api.getAuthStatus();
        setAuthenticated(status.authenticated);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Не вдалося перевірити авторизацію');
        setAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    };
    void loadAuth();
  }, []);

  const typeLabel = useMemo(() => {
    if (type === 'technical') return 'Технічне питання';
    if (type === 'partnership') return 'Партнерство';
    return 'Загальне питання';
  }, [type]);

  const validate = (): ContactFormErrors => {
    const nextErrors: ContactFormErrors = {};
    if (!name.trim()) nextErrors.name = 'Вкажіть імʼя';
    if (!email.trim()) {
      nextErrors.email = 'Вкажіть email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Вкажіть коректний email';
    }
    if (!message.trim()) nextErrors.message = 'Опишіть звернення';
    if (!consent) nextErrors.consent = 'Потрібна згода на обробку даних';
    return nextErrors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      toast.error('Перевірте заповнення форми');
      return;
    }

    if (!authenticated) {
      toast.error('Для створення звернення потрібно увійти в кабінет');
      return;
    }

    setSubmitting(true);
    const loadingToast = toast.loading('Надсилання звернення...');
    try {
      const payload = [
        `Тип: ${typeLabel}`,
        `Імʼя: ${name.trim()}`,
        `Email: ${email.trim()}`,
        `Повідомлення: ${message.trim()}`,
      ].join('\n');
      const created = await api.createSupportTicket({
        message: payload,
        page: '/contacts',
        userAgent: navigator.userAgent,
        requestId: readLastRequestId() || undefined,
      });
      toast.success(`Тікет #${created.ticketId} створено`, { id: loadingToast });
      setName('');
      setEmail('');
      setType('general');
      setMessage('');
      setConsent(false);
      setErrors({});
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
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Контакти</p>
        <h1 className="text-4xl font-black premium-hero-title">Канали звʼязку SwimSync</h1>
        <p className="text-slate-300">
          Оберіть найзручніший канал для звʼязку або надішліть звернення через форму нижче.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CONTACTS.map((contact) => (
          <article key={contact.id} className="glass-card p-5 space-y-3">
            <h2 className="text-xl font-black text-white">{contact.title}</h2>
            <p className="text-sm text-slate-300">{contact.description}</p>
            <p className="text-sm text-slate-400">Email: <span className="text-slate-200">{contact.email}</span></p>
          </article>
        ))}
      </section>

      <section className="glass-card p-6 space-y-4">
        <h2 className="text-2xl font-black text-white">Форма зворотного звʼязку</h2>
        <p className="text-sm text-slate-300">
          Звернення надходить напряму в службу підтримки SwimSync.
        </p>

        {!authLoading && !authenticated && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Для відправки звернення потрібно увійти.{' '}
            <Link href="/login" className="underline font-bold hover:text-white">
              Увійти в систему
            </Link>
          </div>
        )}

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm text-slate-300">
              <span className="block mb-2 font-bold">Імʼя</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="premium-input w-full"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'contacts-name-error' : undefined}
                placeholder="Ваше імʼя"
              />
              {errors.name && <span id="contacts-name-error" className="mt-1 block text-xs text-rose-300">{errors.name}</span>}
            </label>

            <label className="text-sm text-slate-300">
              <span className="block mb-2 font-bold">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="premium-input w-full"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'contacts-email-error' : undefined}
                placeholder="name@example.com"
              />
              {errors.email && <span id="contacts-email-error" className="mt-1 block text-xs text-rose-300">{errors.email}</span>}
            </label>
          </div>

          <label className="text-sm text-slate-300 block">
            <span className="block mb-2 font-bold">Тип звернення</span>
            <select value={type} onChange={(event) => setType(event.target.value as ContactFormType)} className="premium-input w-full">
              <option value="general" className="bg-surface-dark text-slate-100">Загальне питання</option>
              <option value="technical" className="bg-surface-dark text-slate-100">Технічне питання</option>
              <option value="partnership" className="bg-surface-dark text-slate-100">Партнерство</option>
            </select>
          </label>

          <label className="text-sm text-slate-300 block">
            <span className="block mb-2 font-bold">Повідомлення</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="premium-input min-h-28 w-full"
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? 'contacts-message-error' : undefined}
              placeholder="Опишіть ваш запит..."
            />
            {errors.message && <span id="contacts-message-error" className="mt-1 block text-xs text-rose-300">{errors.message}</span>}
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="h-4 w-4 mt-0.5 accent-primary-500"
              aria-invalid={Boolean(errors.consent)}
              aria-describedby={errors.consent ? 'contacts-consent-error' : undefined}
            />
            <span>Підтверджую згоду на обробку персональних даних для обробки звернення.</span>
          </label>
          {errors.consent && <span id="contacts-consent-error" className="mt-1 block text-xs text-rose-300">{errors.consent}</span>}

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={submitting || authLoading || !authenticated} className="btn-primary">
              {submitting ? 'Надсилання...' : 'Надіслати звернення'}
            </button>
            <Link href="/help" className="btn-secondary">Перейти в Центр допомоги</Link>
            {lastRequestId && <span className="premium-chip">RequestId: {lastRequestId}</span>}
          </div>
        </form>
      </section>
    </div>
  );
}

