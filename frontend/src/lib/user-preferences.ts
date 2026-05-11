export type LandingPage = '/competitions' | '/normatives' | '/cabinet' | '/admin' | '/secretary';

export interface UserPreferences {
  landingPage: LandingPage;
  compactTables: boolean;
  showLiveIndicators: boolean;
}

export const USER_PREFERENCES_STORAGE_KEY = 'swimsync:user-preferences';

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  landingPage: '/competitions',
  compactTables: false,
  showLiveIndicators: true,
};

const ALLOWED_LANDING_PAGES = new Set<LandingPage>([
  '/competitions',
  '/normatives',
  '/cabinet',
  '/admin',
  '/secretary',
]);

function normalizeLandingPage(value: unknown): LandingPage {
  if (typeof value === 'string' && ALLOWED_LANDING_PAGES.has(value as LandingPage)) {
    return value as LandingPage;
  }
  return DEFAULT_USER_PREFERENCES.landingPage;
}

export function readUserPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_USER_PREFERENCES;
  const raw = localStorage.getItem(USER_PREFERENCES_STORAGE_KEY);
  if (!raw) return DEFAULT_USER_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      landingPage: normalizeLandingPage(parsed.landingPage),
      compactTables: parsed.compactTables ?? DEFAULT_USER_PREFERENCES.compactTables,
      showLiveIndicators: parsed.showLiveIndicators ?? DEFAULT_USER_PREFERENCES.showLiveIndicators,
    };
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

export function writeUserPreferences(preferences: UserPreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent('swimsync:user-preferences-changed'));
}
