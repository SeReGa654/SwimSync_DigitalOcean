'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AuthRole } from 'shared-contracts';
import Link from 'next/link';

function HeaderLink({ children, className }: { children: React.ReactNode; className: string }) {
  const NextLink = Link as unknown as React.ComponentType<{ href: string; className?: string; children: React.ReactNode }> | undefined;
  if (NextLink) {
    return (
      <NextLink href="/cabinet" className={className}>
        {children}
      </NextLink>
    );
  }
  return (
    <a href="/cabinet" className={className}>
      {children}
    </a>
  );
}

function roleLabel(role: AuthRole | null): string {
  if (role === 'admin') return 'Адмін';
  if (role === 'secretary') return 'Секретар';
  return 'Гість';
}

export default function AuthHeaderBadge() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<AuthRole | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    const loadStatus = () => {
      api.getAuthStatus()
        .then((status) => {
          setAuthenticated(status.authenticated);
          setRole(status.role || null);
          setUsername(status.username || null);
        })
        .finally(() => setAuthChecked(true));
    };

    const handleAuthChanged = () => {
      setAuthChecked(false);
      loadStatus();
    };

    window.addEventListener('swimsync:auth-changed', handleAuthChanged);
    loadStatus();
    return () => {
      window.removeEventListener('swimsync:auth-changed', handleAuthChanged);
    };
  }, []);

  if (!authChecked) {
    return (
      <span className="premium-badge text-slate-500">
        Перевірка...
      </span>
    );
  }

  if (!authenticated) {
    return (
      <HeaderLink className="premium-badge text-slate-400 hover:text-white transition-colors">Увійти</HeaderLink>
    );
  }

  const handleHeaderLogout = async () => {
    setLogoutLoading(true);
    try {
      await api.logoutAdmin();
      setAuthenticated(false);
      setRole(null);
      setUsername(null);
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <HeaderLink className="premium-badge text-slate-200 hover:text-white transition-colors">
        {roleLabel(role)} · {username || 'user'}
      </HeaderLink>
      <button
        type="button"
        onClick={() => void handleHeaderLogout()}
        disabled={logoutLoading}
        className="premium-badge text-slate-300 hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Вийти
      </button>
    </div>
  );
}
