import { expect, test } from '@playwright/test';

test('the collision credit hands off to the tutorial and plays once per tab', async ({ page }) => {
  await page.goto('/');
  const intro = page.getByRole('region', { name: '游戏开场' });
  await expect(intro).toBeVisible();
  await expect(intro.locator('.launch-intro__atom')).toHaveCount(2);
  await expect(intro.getByText('Developed by Qoder', { exact: true })).toHaveCSS('opacity', '1');
  await expect(intro.locator('img')).toHaveJSProperty('naturalWidth', 304);
  await expect(intro).toHaveCount(0);
  const welcome = page.getByRole('dialog', { name: '欢迎来到《通往118》' });
  await expect(welcome).toBeVisible();
  await page.reload();
  await expect(intro).toHaveCount(0);
  await expect(welcome).toBeVisible();
});

test('the mobile intro respects reduced motion and can be skipped', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  const intro = page.getByRole('region', { name: '游戏开场' });
  await expect(intro.getByText('Developed by Qoder', { exact: true })).toBeVisible();
  await expect(intro.locator('.launch-intro__collision')).toBeHidden();
  await intro.getByRole('button', { name: '跳过开场' }).click();
  await expect(intro).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: '欢迎来到《通往118》' })).toBeVisible();
});
