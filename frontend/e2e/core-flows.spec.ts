import { test, expect } from '@playwright/test';

test('global 404 renders unified page', async ({ page }) => {
  await page.goto('/route-that-does-not-exist');
  await expect(page.getByRole('heading', { name: 'Сторінку не знайдено' })).toBeVisible();
});

test('header role badge opens cabinet', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Гість' })).toBeVisible();
  await page.getByRole('link', { name: 'Гість' }).click();
  await expect(page).toHaveURL(/\/cabinet$/);
});

test('normatives applies saved user preferences', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('swimsync:user-preferences', JSON.stringify({
      landingPage: '/competitions',
      compactTables: true,
      showLiveIndicators: false,
    }));
  });

  await page.goto('/normatives');
  await expect(page.getByText('Режим перегляду')).toBeVisible();
  await expect(page.getByText(/Live/i)).toHaveCount(0);
});
