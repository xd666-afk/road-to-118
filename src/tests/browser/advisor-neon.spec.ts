import { expect, test } from '@playwright/test';
import { closeLabPanel, openLabPanel } from './lab-controls';
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
  const collection = page.getByRole('progressbar', { name: '元素收集进度' });
  await expect(collection).toHaveAttribute('value', '2');
  await openLabPanel(page, 'next');
  await expect(page.locator('.mission-card')).toContainText('88/100');
  await page.locator('.mission-card').getByRole('button', { name: '提交氖的记录' }).click();
  await openLabPanel(page, 'archive');
  await expect(page.locator('.periodic-cell[data-z="10"]')).toHaveClass(/archived/);
  await closeLabPanel(page);
  await expect(collection).toHaveAttribute('value', '3');
  await openLabPanel(page, 'next');

  await page.locator('.mission-card').getByRole('button', { name: '开始研究 · Ca' }).click();
  await openLabPanel(page, 'instrument');
  await expect(page.locator('#reactor-selector')).toHaveValue('5');
  await expect(page.locator('#target')).toHaveValue('20');
});

test('mobile lab controls meet the 44px touch target without overflowing 320px', async ({ page }) => {
  const s = createState(705); s.settings.guideDismissed = true;
  await page.addInitScript(({ key, text }) => localStorage.setItem(key, text), { key: KEY, text: serialize(s) });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');

  const checkTouchTargets = async (selectors: string[]) => {
    for (const selector of selectors) {
      const controls = page.locator(selector);
      expect(await controls.count(), selector).toBeGreaterThan(0);
      for (let i = 0; i < await controls.count(); i++) {
        const box = await controls.nth(i).boundingBox();
        expect(box?.height ?? 0, selector).toBeGreaterThanOrEqual(44);
      }
    }
  };
  await checkTouchTargets(['.status-pill', '.scene-explore', '.scene-dock button']);
  await expect(page.getByRole('progressbar', { name: '元素收集进度' })).toBeVisible();
  await openLabPanel(page, 'instrument');
  await checkTouchTargets(['.reactor-switch > button', '#reactor-selector', '#target']);
  await openLabPanel(page, 'upgrades');
  await checkTouchTargets(['.bulk-control button']);
  await closeLabPanel(page);

  await page.getByRole('button', { name: '存档与设置' }).click();
  const close = page.getByRole('dialog').getByRole('button', { name: '关闭弹窗' });
  expect((await close.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');

  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
