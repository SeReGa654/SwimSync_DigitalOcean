import { expect, type Page, test } from '@playwright/test';

type ResultProtocolConfig = {
  format: 'SEPARATE' | 'COMBINED' | 'MIXED';
  mixedFormatPrimaryAgeGroupId?: number | null;
  mixedFormatSecondaryAgeGroupIds?: number[];
  advancedGrouping?: {
    enabled: boolean;
    includeUnmatched: boolean;
    unmatchedGroupName?: string;
    groups: Array<{
      name: string;
      operator: 'AND' | 'OR';
      conditions: Array<{ field: string; operator: string; value: unknown }>;
      subgroups?: Array<{
        operator: 'AND' | 'OR';
        conditions: Array<{ field: string; operator: string; value: unknown }>;
      }>;
    }>;
  } | null;
};

type MockState = {
  competitions: Array<Record<string, unknown>>;
  configs: Record<number, ResultProtocolConfig>;
  legacyConfigs: Record<number, ResultProtocolConfig>;
  defaults: ResultProtocolConfig | null;
  presetsByCompetition: Record<number, Array<Record<string, unknown>>>;
  nextCompetitionId: number;
  nextPresetId: number;
};

const defaultConfig = (): ResultProtocolConfig => ({
  format: 'SEPARATE',
  mixedFormatPrimaryAgeGroupId: null,
  mixedFormatSecondaryAgeGroupIds: [],
  advancedGrouping: null,
});

const createCompetition = (id: number, name: string) => ({
  id,
  name,
  categoriesStr: 'Юнаки',
  location: 'Київ',
  venue: 'ДЮСШ',
  poolLength: 50,
  lanes: 8,
  dateFrom: '2026-06-01',
  dateTo: '2026-06-02',
  status: 'draft',
  circularSeeding: false,
  createdAt: '2026-06-01T00:00:00.000Z',
  ageGroups: [
    { id: 11, name: 'A', birthYearFrom: 2010, birthYearTo: 2011 },
    { id: 12, name: 'B', birthYearFrom: 2012, birthYearTo: 2013 },
  ],
});

async function setupProtocolApi(page: Page, partial?: Partial<MockState>) {
  const state: MockState = {
    competitions: [createCompetition(1, 'Тестовий чемпіонат')],
    configs: { 1: defaultConfig() },
    legacyConfigs: {},
    defaults: null,
    presetsByCompetition: { 1: [] },
    nextCompetitionId: 2,
    nextPresetId: 100,
    ...partial,
  };

  await page.context().route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (payload: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });

    const readBody = (): Record<string, unknown> => {
      const raw = request.postData() || '{}';
      return JSON.parse(raw) as Record<string, unknown>;
    };

    if (path === '/api/auth/status' && method === 'GET') {
      return json({ authenticated: true, role: 'secretary', username: 'tester' });
    }

    if (path === '/api/competitions/protocol-defaults/me') {
      if (method === 'GET') return json(state.defaults);
      if (method === 'PATCH') {
        const body = readBody();
        state.defaults = body.config as ResultProtocolConfig;
        return json({ id: 1, userId: 7, configJson: state.defaults });
      }
    }

    if (path === '/api/competitions' && method === 'GET') {
      return json(state.competitions);
    }

    if (path === '/api/competitions' && method === 'POST') {
      const body = readBody();
      const newCompId = state.nextCompetitionId++;
      const created = createCompetition(newCompId, String(body.name || `Нове змагання ${newCompId}`));
      created.location = String(body.location || 'Львів');
      created.venue = String(body.venue || 'Басейн');
      created.poolLength = Number(body.poolLength || 50);
      created.lanes = Number(body.lanes || 8);
      state.competitions.unshift(created);
      state.presetsByCompetition[newCompId] = [];
      state.configs[newCompId] = state.defaults ? structuredClone(state.defaults) : defaultConfig();
      return json(created, 201);
    }

    const compMatch = path.match(/^\/api\/competitions\/(\d+)$/);
    if (compMatch && method === 'GET') {
      const competitionId = Number(compMatch[1]);
      const found = state.competitions.find((comp) => comp.id === competitionId);
      return json(found ?? { message: 'Not found' }, found ? 200 : 404);
    }

    const cfgMatch = path.match(/^\/api\/competitions\/(\d+)\/result-protocol-config$/);
    if (cfgMatch) {
      const competitionId = Number(cfgMatch[1]);
      if (method === 'GET') {
        return json(state.configs[competitionId] ?? state.legacyConfigs[competitionId] ?? defaultConfig());
      }
      if (method === 'PATCH') {
        state.configs[competitionId] = readBody() as ResultProtocolConfig;
        const competition = state.competitions.find((item) => item.id === competitionId);
        return json(competition ?? { id: competitionId });
      }
    }

    const presetsMatch = path.match(/^\/api\/competitions\/(\d+)\/result-protocol-presets$/);
    if (presetsMatch) {
      const competitionId = Number(presetsMatch[1]);
      state.presetsByCompetition[competitionId] ||= [];
      if (method === 'GET') return json(state.presetsByCompetition[competitionId]);
      if (method === 'POST') {
        const body = readBody();
        const preset = {
          id: state.nextPresetId++,
          competitionId,
          ownerUserId: 7,
          name: String(body.name || 'Preset'),
          isShared: Boolean(body.isShared),
          configJson: body.config,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        state.presetsByCompetition[competitionId].push(preset);
        return json(preset, 201);
      }
    }

    const applyPresetMatch = path.match(/^\/api\/competitions\/(\d+)\/result-protocol-presets\/(\d+)\/apply$/);
    if (applyPresetMatch && method === 'POST') {
      const competitionId = Number(applyPresetMatch[1]);
      const presetId = Number(applyPresetMatch[2]);
      const preset = (state.presetsByCompetition[competitionId] || []).find((item) => item.id === presetId);
      if (!preset) return json({ message: 'Preset not found' }, 404);
      state.configs[competitionId] = structuredClone(preset.configJson as ResultProtocolConfig);
      const competition = state.competitions.find((item) => item.id === competitionId);
      return json(competition ?? { id: competitionId });
    }

    const deletePresetMatch = path.match(/^\/api\/competitions\/(\d+)\/result-protocol-presets\/(\d+)$/);
    if (deletePresetMatch && method === 'DELETE') {
      const competitionId = Number(deletePresetMatch[1]);
      const presetId = Number(deletePresetMatch[2]);
      state.presetsByCompetition[competitionId] =
        (state.presetsByCompetition[competitionId] || []).filter((item) => item.id !== presetId);
      return json({ id: presetId });
    }

    if (path === '/api/events' && method === 'GET') {
      return json([]);
    }

    const resultPreviewMatch = path.match(/^\/api\/export\/result-protocol-preview\/(\d+)$/);
    if (resultPreviewMatch && method === 'GET') {
      const competitionId = Number(resultPreviewMatch[1]);
      const cfg = state.configs[competitionId] ?? state.legacyConfigs[competitionId] ?? defaultConfig();
      const groups = cfg.advancedGrouping?.groups || [];
      return json({
        competitionId,
        groups: groups.map((group, index) => ({ order: index + 1, name: group.name })),
      });
    }

    return json({ message: `Unexpected API call: ${method} ${path}` }, 404);
  });
}

async function openSettings(page: Page, competitionId: number) {
  try {
    await page.goto(`/competitions/${competitionId}`, { waitUntil: 'domcontentloaded' });
  } catch {
    await page.goto(`/competitions/${competitionId}`, { waitUntil: 'domcontentloaded' });
  }
  const settingsTabButton = page.getByRole('button', { name: 'Налаштування' });
  try {
    await expect(settingsTabButton).toBeVisible({ timeout: 10_000 });
  } catch {
    await page.reload();
    await expect(settingsTabButton).toBeVisible({ timeout: 10_000 });
  }
  await settingsTabButton.click();
  await expect(page.getByRole('heading', { name: 'Формат фінішних протоколів' })).toBeVisible();
}

function protocolCard(page: Page) {
  return page.locator('div.glass-card').filter({
    has: page.getByRole('heading', { name: 'Формат фінішних протоколів' }),
  }).first();
}

test('створення та застосування пресета відтворює конфігурацію у формі налаштувань', async ({ page }) => {
  await setupProtocolApi(page);
  await openSettings(page, 1);

  const card = protocolCard(page);
  const formatSelect = card.locator('select').first();
  await formatSelect.selectOption('COMBINED');

  await card.getByPlaceholder('Назва нового пресета').fill('Preset Combined');
  await card.getByRole('button', { name: 'Зберегти як пресет' }).click();

  await formatSelect.selectOption('SEPARATE');
  const presetRow = card.locator('div').filter({ hasText: 'Preset Combined' }).first();
  await presetRow.getByRole('button', { name: 'Застосувати', exact: true }).click();

  await expect(formatSelect).toHaveValue('COMBINED');
  await expect(card.getByText('Усі вікові категорії будуть об\'єднані в один рейтинг')).toBeVisible();
});

test('після збереження user defaults нове змагання отримує ці налаштування автоматично', async ({ page }) => {
  await setupProtocolApi(page);
  await openSettings(page, 1);

  const card = protocolCard(page);
  const formatSelect = card.locator('select').first();
  await formatSelect.selectOption('COMBINED');
  await card.getByRole('button', { name: 'Оновити мої дефолти' }).click();

  await page.goto('/competitions');
  await page.getByRole('button', { name: 'Керування' }).click();
  await page.getByRole('button', { name: 'Нове змагання' }).click();

  const createDialog = page.locator('div.glass-card').filter({
    has: page.getByRole('heading', { name: 'Створити змагання' }),
  }).first();
  await createDialog.locator('input').nth(0).fill('Нове змагання з дефолтами');
  await createDialog.locator('input').nth(2).fill('Львів');
  await page.getByRole('button', { name: 'Створити змагання' }).click();

  await page.locator('a[href="/competitions/2"]').first().click();
  await page.getByRole('button', { name: 'Налаштування' }).click();

  const newCard = protocolCard(page);
  const newFormatSelect = newCard.locator('select').first();
  await expect(newFormatSelect).toHaveValue('COMBINED');
});

test('advanced grouping зберігається та потрапляє в preview в правильному порядку груп', async ({ page }) => {
  await setupProtocolApi(page);
  await openSettings(page, 1);

  const card = protocolCard(page);
  await card.getByLabel('Розширене групування (конструктор умов)').check();
  await card.getByRole('button', { name: '+ Додати групу' }).click();
  await card.getByRole('button', { name: '+ Додати групу' }).click();
  await card.getByPlaceholder('Назва групи').nth(0).fill('Alpha');
  await card.getByPlaceholder('Назва групи').nth(1).fill('Beta');
  await card.getByPlaceholder('value').nth(0).fill('kyiv');
  await card.getByPlaceholder('value').nth(1).fill('lviv');

  await card.getByRole('button', { name: 'Зберегти налаштування протокол' }).click();

  const preview = await page.evaluate(async () => {
    const response = await fetch('/api/export/result-protocol-preview/1', { credentials: 'include' });
    return response.json() as Promise<{ groups: Array<{ name: string; order: number }> }>;
  });

  expect(preview.groups.map((group) => group.name)).toEqual(['Alpha', 'Beta']);
  expect(preview.groups.map((group) => group.order)).toEqual([1, 2]);
});

test('fallback з legacy competition config має пріоритет над creator defaults', async ({ page }) => {
  await setupProtocolApi(page, {
    competitions: [createCompetition(3, 'Legacy Cup')],
    configs: {},
    defaults: { ...defaultConfig(), format: 'COMBINED' },
    legacyConfigs: {
      3: {
        format: 'MIXED',
        mixedFormatPrimaryAgeGroupId: 11,
        mixedFormatSecondaryAgeGroupIds: [12],
        advancedGrouping: {
          enabled: true,
          includeUnmatched: true,
          unmatchedGroupName: 'Інші',
          groups: [
            {
              name: 'Legacy Group',
              operator: 'AND',
              conditions: [{ field: 'region', operator: 'CONTAINS', value: 'Київ' }],
              subgroups: [],
            },
          ],
        },
      },
    },
    presetsByCompetition: { 3: [] },
    nextCompetitionId: 4,
  });

  await page.goto('/');
  const config = await page.evaluate(async () => {
    const response = await fetch('/api/competitions/3/result-protocol-config', { credentials: 'include' });
    return response.json() as Promise<ResultProtocolConfig>;
  });

  expect(config.format).toBe('MIXED');
  expect(config.advancedGrouping?.enabled).toBe(true);
  expect(config.advancedGrouping?.groups.map((group) => group.name)).toEqual(['Legacy Group']);
});
