import { expect, test } from '@playwright/test';
import { createState } from '../../game/engine';
import { D } from '../../game/numbers';
import { serialize } from '../../game/save';
const KEY = 'road-to-118.save.v1';

// Preset mid-game save: nineteen elements are discovered, Ne is partially
// deposited (88/100) with 20 real units in inventory, and Ca is still undiscovered.
test('Ne advice archives with a real deposit, then returns the top instrument to Ca exploration', async ({ page }) => {
  const s = createState(704);
  s.elements.forEach((x, i) => { x.discovered = i < 20; x.archived = false; x.deposited = 0; x.inventory = D(0); x.totalProduced = D(0); });
  s.elements[19].discovered = false;
  const ne = s.elements[9]; ne.discovered = true; ne.archived = false; ne.deposited = 88; ne.inventory = D(20); ne.totalProduced = D(108);
  const h = s.elements[0]; h.archived = true; h.deposited = 50; h.totalProduced = D(50);
  const ar = s.elements[17]; ar.archived = true; ar.deposited = 50; ar.totalProduced = D(50);
  s.reactors.forEach((r, i) => { r.built = i < 5; r.active = true; r.target = 2; r.exploring = false; r.discoveryHazard = 100000; });
  Object.assign(s.reactors[4].upgrades, { capacity: 1, yield: 2 });
  s.modules.feed = s.modules.reaction = s.modules.allocation = true;
  s.automation.feed = s.automation.reaction = s.automation.allocation = false;
  await page.addInitScript(({ key, text }) => localStorage.setItem(key, text), { key: KEY, text: serialize(s) });
  await page.setViewportSize({ width: 360, height: 800 });
  const now = Date.now();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 500);
  await page.goto('/');

  await expect(page.getByRole('region', { name: '新手实验引导' })).toHaveCount(0);
  await expect(page.locator('.journey-stage').nth(0).locator('small')).toHaveText('已提交 88/100 份');
  await page.locator('.mission-card').getByRole('button', { name: '提交氖的记录' }).click();
  await expect(page.locator('.journey-stage').nth(0)).toHaveClass(/done/);
  await expect(page.locator('.journey-stage').nth(0)).toContainText('已完成');

  await page.locator('.mission-card').getByRole('button', { name: '开始研究 · Ca' }).click();
  await expect(page.locator('#reactor-selector')).toHaveValue('5');
  await expect(page.locator('#target')).toHaveValue('20');
});

test('mobile lab controls meet the 44px touch target without overflowing 320px', async ({ page }) => {
  const s = createState(705); s.settings.guideDismissed = true;
  await page.addInitScript(({ key, text }) => localStorage.setItem(key, text), { key: KEY, text: serialize(s) });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');

  for (const selector of ['.status-pill', '.reactor-switch > button', '.target-actions .text-button', '.bulk-control button', '#reactor-selector', '#target']) {
    const controls = page.locator(selector);
    expect(await controls.count(), selector).toBeGreaterThan(0);
    for (let i = 0; i < await controls.count(); i++) {
      const box = await controls.nth(i).boundingBox();
      expect(box?.height ?? 0, selector).toBeGreaterThanOrEqual(44);
    }
  }
  await expect(page.locator('.journey-symbol').first()).toBeVisible();
  expect(await page.locator('.journey-stage small').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(10);

  await page.getByRole('button', { name: '存档与设置' }).click();
  const close = page.getByRole('dialog').getByRole('button', { name: '关闭弹窗' });
  expect((await close.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');

  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
