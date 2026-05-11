'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { FeatureFlagDto } from 'shared-contracts';

const CACHE_TTL_MS = 30_000;

let flagsCache: { expiresAt: number; flags: FeatureFlagDto[] } | null = null;

export function useFeatureFlags(enabled: boolean) {
  const [flags, setFlags] = useState<FeatureFlagDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!enabled) return;
    if (!force && flagsCache && flagsCache.expiresAt > Date.now()) {
      setFlags(flagsCache.flags);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const list = await api.getFeatureFlags();
      flagsCache = {
        flags: list,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      setFlags(list);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не вдалося завантажити feature flags');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const updateFlag = useCallback(async (key: string, enabledState: boolean) => {
    const updated = await api.updateFeatureFlag(key, { enabled: enabledState });
    setFlags((prev) => prev.map((flag) => (flag.key === updated.key ? updated : flag)));
    if (flagsCache) {
      flagsCache = {
        ...flagsCache,
        flags: flagsCache.flags.map((flag) => (flag.key === updated.key ? updated : flag)),
      };
    }
    return updated;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    flags,
    loading,
    error,
    reload: () => load(true),
    updateFlag,
  };
}
