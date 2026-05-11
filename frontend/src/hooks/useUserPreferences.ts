'use client';

import { useEffect, useState } from 'react';
import { readUserPreferences, type UserPreferences } from '@/lib/user-preferences';

export function useUserPreferences(): UserPreferences {
  const [preferences, setPreferences] = useState<UserPreferences>(readUserPreferences());

  useEffect(() => {
    const refresh = () => setPreferences(readUserPreferences());
    window.addEventListener('storage', refresh);
    window.addEventListener('swimsync:user-preferences-changed', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('swimsync:user-preferences-changed', refresh);
    };
  }, []);

  return preferences;
}
