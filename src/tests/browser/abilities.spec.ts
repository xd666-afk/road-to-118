import { expect, test } from '@playwright/test';
import { openLabPanel } from './lab-controls';
import { createState, Engine } from '../../game/engine';
import { D } from '../../game/numbers';
import { serialize } from '../../game/save';

test('instrument roles and module scopes can be set independently in the mobile console', async ({ page }) => {
  const e = new Engine(createState(22));
  e.state.settings.guideDismissed = true;
  e.state.coins = D('1e8');
  e.state.data = D('1e8');
  for (const row of e.state.elements.slice(0, 7)) row.discovered = true;
  e.build(2);
  for (const key of ['feed', 'reaction', 'allocation'] as const) e.research(key);
  e.target(2, 4);
  await page.addInitScript(text => {
    const key = 'road-to-118.save.v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, text);
  }, serialize(e.state));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  const openResearch = () => page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '科研' }).click();
  await openResearch();
  const first = page.getByLabel('I 级任务', { exact: true });
  const second = page.getByLabel('II 级任务', { exact: true });
  const preset = page.getByLabel('套用分工预设');
  const feed = page.getByLabel('自动补样范围');
  const allocation = page.getByLabel('自动提交范围');
  const feedModule = page.getByRole('region', { name: '原料补充' });
  const reactionModule = page.getByRole('region', { name: '自动反应' });
  const allocationModule = page.getByRole('region', { name: '元素分配' });
  await feedModule.getByRole('button', { name: '升级至 2 级' }).click();
  await reactionModule.getByRole('button', { name: '升级至 2 级' }).click();
  await allocationModule.getByRole('button', { name: '升级至 2 级' }).click();
  await expect(feedModule.locator('.module-current')).toContainText('自动补样省 15%');
  await expect(reactionModule.locator('.module-current')).toContainText('II 级起 ×40');
  await expect(allocationModule.locator('.module-current')).toContainText('返还 1 倍');
  await preset.selectOption('archive');
  await expect(second).toHaveValue('archive');
  await first.selectOption('produce');
  const target = page.getByLabel('I 级生产目标', { exact: true });
  await target.selectOption('2');
  await feed.selectOption('all');
  await allocation.selectOption('calibration');
  await page.reload();
  await openResearch();
  await expect(feedModule.locator('.module-current strong')).toHaveText('等级 2 / 3');
  await expect(reactionModule.locator('.module-current strong')).toHaveText('等级 2 / 3');
  await expect(allocationModule.locator('.module-current strong')).toHaveText('等级 2 / 3');
  await expect(preset).toHaveValue('custom');
  await expect(first).toHaveValue('produce');
  await expect(second).toHaveValue('archive');
  await expect(target).toHaveValue('2');
  await expect(feed).toHaveValue('all');
  await expect(allocation).toHaveValue('calibration');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('element abilities apply as soon as an archive is complete and survive reload', async ({ page }) => {
  const e = new Engine(createState(19));
  e.state.reactors[0].active = false;
  e.state.settings.guideDismissed = true;
  e.state.elements[1].discovered = true;
  for (const z of [1, 2]) {
    const element = e.state.elements[z - 1];
    element.inventory = D(100);
    element.totalProduced = D(100);
  }
  e.deposit(2);
  await page.addInitScript(text => {
    const key = 'road-to-118.save.v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, text);
  }, serialize(e.state));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');

  const openTable = () => openLabPanel(page, 'archive');
  await openTable();
  await page.locator('.periodic-cell[data-z="1"]').click();
  const card = page.getByRole('dialog');
  await expect(card).toContainText('收录后生效');
  await expect(card.getByRole('button', { name: '激活能力' })).toHaveCount(0);
  await card.getByRole('button', { name: '提交 100 单位至档案' }).click();
  await expect(card).toContainText('已生效');
  await expect(card.getByRole('region', { name: /氢样本回收/ })).toContainText('+3%');
  await page.keyboard.press('Escape');

  const summary = page.getByRole('region', { name: '实验室能力增益' });
  await expect(summary).toContainText('已生效 2 项');
  await expect(summary).toContainText('+5%');
  await page.reload();
  await openTable();
  await expect(summary).toContainText('已生效 2 项');
  await expect(summary).toContainText('+5%');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('archiving the last unit of Xe completes H–Xe and leaves Cs undiscovered', async ({ page }) => {
  const e = new Engine(createState(27));
  e.state.settings.guideDismissed = true;
  e.state.reactors[0].active = false;
  e.state.elements.slice(0,54).forEach(row => { row.discovered = true; row.inventory = D(100); row.totalProduced = D(100); });
  for (let z = 1; z < 54; z++) e.deposit(z, true);
  e.state.elements[53].deposited = 99;
  e.state.elements[53].inventory = D(1);
  await page.addInitScript(text => localStorage.setItem('road-to-118.save.v1', text), serialize(e.state));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await openLabPanel(page, 'archive');
  await page.locator('.periodic-cell[data-z="54"]').click();
  await page.getByRole('dialog').getByRole('button', { name: '提交 1 单位至档案' }).click();
  await expect(page.getByRole('dialog')).toContainText('已生效');
  await expect(page.getByRole('dialog')).toContainText('氙闪远光');
  await page.keyboard.press('Escape');
  const completion = page.getByRole('dialog', { name: 'H–Xe 全收集完成。' });
  await expect(completion).toContainText('54 / 54 已收录');
  await completion.getByRole('button', { name: '继续我的实验室' }).click();
  await openLabPanel(page, 'archive');
  await expect(page.locator('.periodic-cell[data-z="55"]')).toHaveClass(/next/);
});
