import { expect, test } from '@playwright/test';
import { createState, Engine } from '../../game/engine';
import { D } from '../../game/numbers';
import { serialize } from '../../game/save';

test('element abilities unlock on archive, apply individually and in bulk, and survive reload', async ({ page }) => {
  const e = new Engine(createState(19));
  e.state.reactors[0].active = false;
  e.state.settings.guideDismissed = true;
  e.state.elements[1].discovered = true;
  for (const z of [1, 2]) {
    const element = e.state.elements[z - 1];
    element.inventory = D(50);
    element.totalProduced = D(50);
  }
  e.deposit(2);
  await page.addInitScript(text => {
    const key = 'road-to-118.save.v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, text);
  }, serialize(e.state));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');

  const openTable = () => page.locator('#periodic-table').scrollIntoViewIfNeeded();
  await openTable();
  await page.locator('.periodic-cell[data-z="1"]').click();
  const card = page.getByRole('dialog');
  await expect(card).toContainText('收录后可激活');
  await expect(card.getByRole('button', { name: '激活能力' })).toHaveCount(0);
  await card.getByRole('button', { name: '提交 50 单位至档案' }).click();
  const activate = card.getByRole('button', { name: '激活能力' });
  await expect(activate).toBeEnabled();
  await activate.click();
  await expect(card.getByRole('region', { name: /氢样本回收/ })).toContainText('+3%');
  await page.keyboard.press('Escape');

  const summary = page.getByRole('region', { name: '实验室能力增益' });
  await summary.getByRole('button', { name: /激活已收录能力/ }).click();
  await expect(summary).toContainText('已激活 2/2 项');
  await expect(summary).toContainText('+5%');
  await page.reload();
  await openTable();
  await expect(summary).toContainText('已激活 2/2 项');
  await expect(summary).toContainText('+5%');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('archiving the last unit of Xe completes H–Xe and leaves 55 locked', async ({ page }) => {
  const e = new Engine(createState(27));
  e.state.settings.guideDismissed = true;
  e.state.reactors[0].active = false;
  e.state.elements.forEach(row => { row.discovered = true; row.inventory = D(50); row.totalProduced = D(50); });
  for (let z = 1; z < 54; z++) e.deposit(z, true);
  e.state.elements[53].deposited = 49;
  e.state.elements[53].inventory = D(1);
  await page.addInitScript(text => localStorage.setItem('road-to-118.save.v1', text), serialize(e.state));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: /氙档案/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '提交 1 单位至档案' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '激活能力' }).click();
  await expect(page.getByRole('dialog')).toContainText('氙闪远光');
  await page.keyboard.press('Escape');
  const completion = page.getByRole('dialog', { name: 'H–Xe 全收集完成。' });
  await expect(completion).toContainText('54 / 54 已收录');
  await completion.getByRole('button', { name: '继续我的实验室' }).click();
  await page.locator('#periodic-table').scrollIntoViewIfNeeded();
  await expect(page.locator('.periodic-cell[data-z="55"]')).toHaveClass(/version-locked/);
});
