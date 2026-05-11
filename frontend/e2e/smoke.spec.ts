import { test, expect } from '@playwright/test';

test('головна сторінка відкривається', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Автоматизація змагань з плавання')).toBeVisible();
});

test('сторінка адмін входу відкривається', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText('Вхід у систему')).toBeVisible();
});
