import { expect, test } from '@playwright/test';

test('перехід до сторінки змагання працює з моканим API', async ({ page }) => {
  await page.route('**/api/auth/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        role: 'secretary',
        username: 'tester',
      }),
    });
  });

  await page.route('**/api/competitions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          name: 'Тестовий чемпіонат',
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
        },
      ]),
    });
  });

  await page.route('**/api/competitions/1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        name: 'Тестовий чемпіонат',
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
      }),
    });
  });

  await page.route('**/api/events?competitionId=1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.goto('/competitions');
  await expect(page.getByText('Тестовий чемпіонат')).toBeVisible();
  await page.click('a[href="/competitions/1"]');
  await expect(page.getByText('Тестовий чемпіонат')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Дистанції' })).toBeVisible();
});

test('візуальний smoke snapshot головної', async ({ page }) => {
  await page.route('**/api/competitions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.goto('/');
  const screenshot = await page.screenshot({ fullPage: true });
  expect(screenshot.byteLength).toBeGreaterThan(50_000);
});
