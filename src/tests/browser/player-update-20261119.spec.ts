import { expect, test } from '@playwright/test';
import { closeLabPanel, openLabPanel } from './lab-controls';
import { createState } from '../../game/engine';
import { price } from '../../game/economy';
import { D } from '../../game/numbers';
import { serialize } from '../../game/save';

const KEY = 'road-to-118.save.v1';

function pausedLab(seed: number) {
  const s = createState(seed);
  s.settings.guideDismissed = true;
  s.reactors.forEach(r => { r.active = false; r.discoveryHazard = 100000; });
  return s;
}

test('He archive submit is above the fold at 360x800 and 1440x1000 and deposits the real 4 units', async ({ page }) => {
  const s = pausedLab(711);
  const he = s.elements[1];
  he.discovered = true; he.inventory = D(4); he.totalProduced = D(4);
  he.firstDiscoveredAt = 0; he.firstDiscoveredReactor = 1;
  await page.addInitScript(({ key, text }) => localStorage.setItem(key, text), { key: KEY, text: serialize(s) });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await openLabPanel(page, 'archive');
  await page.locator('[data-z="2"]').click();

  const region = page.getByRole('region', { name: '元素收录操作' });
  const submit = region.getByRole('button', { name: '提交 4 单位至档案' });
  await expect(submit).toBeInViewport();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(submit).toBeInViewport();
  await submit.click();

  await expect(region).toContainText('档案累计提交');
  await expect(region).toContainText('4 / 100');
  await expect(region).toContainText('可提交库存');
  await expect(region).toContainText('0 单位');
  await expect(region.getByRole('button', { name: '提交 0 单位至档案' })).toBeDisabled();
});

test('fixed batches stay disabled when unaffordable while MAX spends only what it can', async ({ page }) => {
  const s = pausedLab(712);
  s.coins = D(200);
  await page.addInitScript(({ key, text }) => localStorage.setItem(key, text), { key: KEY, text: serialize(s) });
  await page.goto('/');

  await openLabPanel(page, 'upgrades');
  const yieldCard = page.locator('.upgrade').filter({ hasText: '单次收益' });
  const buy = yieldCard.getByRole('button', { name: '购买单次收益' });
  for (const batch of ['×10', '×100']) {
    await page.getByRole('button', { name: batch, exact: true }).click();
    await expect(buy).toContainText(batch);
    await expect(buy).toBeDisabled();
  }
  await expect(page.getByTestId('coins')).toHaveText('200');

  await page.getByRole('button', { name: 'MAX', exact: true }).click();
  await expect(buy).toContainText('MAX 2');
  await buy.click();
  await expect(yieldCard.getByText('等级 2', { exact: true })).toBeVisible();
  await expect(page.getByTestId('coins')).toHaveText('47');
  await expect(buy).toContainText('MAX 0');
  await expect(buy).toBeDisabled();
});

test('x100 buys exactly 100 even when MAX can buy 102', async ({ page }) => {
  const s = pausedLab(714);
  s.coins = price(s.reactors[0], 'atoms', 102).plus(1);
  await page.addInitScript(({ key, text }) => localStorage.setItem(key, text), { key: KEY, text: serialize(s) });
  await page.goto('/');

  await openLabPanel(page, 'upgrades');
  const atomsCard = page.locator('.upgrade').filter({ hasText: '补充氢样本' });
  const buy = atomsCard.getByRole('button', { name: '购买补充氢样本' });
  await page.getByRole('button', { name: 'MAX', exact: true }).click();
  await expect(buy).toContainText('MAX 102');
  await page.getByRole('button', { name: '×100', exact: true }).click();
  await buy.click();
  await expect(atomsCard.getByText('等级 100', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'MAX', exact: true }).click();
  await expect(buy).toContainText('MAX 2');
  await buy.click();
  await expect(atomsCard.getByText('等级 102', { exact: true })).toBeVisible();
  await expect(page.getByTestId('coins')).toHaveText('1');
});

test('a single collection meter and accessible opening checks keep completed He', async ({ page }) => {
  const s = pausedLab(713);
  s.elements[1].discovered = true;
  await page.addInitScript(({ key, text }) => localStorage.setItem(key, text), { key: KEY, text: serialize(s) });
  await page.goto('/');

  await expect(page.getByRole('progressbar', { name: '元素收集进度' })).toHaveCount(1);
  await expect(page.getByRole('progressbar', { name: '元素收集进度' })).toHaveAttribute('value', '0');
  await expect(page.getByRole('button', { name: /钙档案/ })).toHaveCount(0);
  await expect(page.locator('.progress-resource strong')).toContainText('2/55 发现');
  await openLabPanel(page, 'next');
  const checklist = page.getByRole('list', { name: '开局检查清单' });
  await expect(checklist).toBeVisible();
  await expect(checklist.getByRole('listitem', { name: '发现 He：已完成' })).toBeVisible();
  await expect(checklist.getByRole('listitem', { name: '新容器：待完成' })).toBeVisible();
});

test('oxygen stays the only discovery while its card is open and fluorine waits after reading', async ({ page }) => {
  test.setTimeout(75000);
  const clock = new Date('2026-11-19T00:00:00.000Z').getTime();
  const s = createState(23);
  s.settings.guideDismissed = true;
  s.settings.reducedMotion = true;
  for (const row of s.elements.slice(0, 7)) row.discovered = true;
  s.reactors.forEach(r => { r.active = false; });
  const first = s.reactors[0], advanced = s.reactors[2];
  first.active = true;
  first.target = 1;
  advanced.built = advanced.active = advanced.exploring = true;
  advanced.target = 8;
  advanced.discoveryHazard = 0;
  Object.assign(advanced.upgrades, { atoms: 100_000, speed: 100, capacity: 60 });
  await page.clock.install({ time: new Date(clock) });
  await page.clock.pauseAt(new Date(clock + 1000));
  await page.addInitScript(({ key, text }) => localStorage.setItem(key, text), { key: KEY, text: serialize(s, clock + 1000) });
  await page.goto('/');
  await openLabPanel(page, 'instrument');
  await page.getByLabel('切换反应容器').selectOption('3');
  await closeLabPanel(page);

  const oxygen = page.getByRole('dialog', { name: '新元素发现 · 氧' });
  await page.clock.runFor(500);
  await expect(oxygen).toBeVisible();
  const coinsBefore = await page.getByTestId('coins').textContent();
  await page.clock.runFor(45_000);
  await expect(oxygen).toBeVisible();
  await expect(page.getByTestId('coins')).not.toHaveText(coinsBefore!);
  await expect(page.locator('.progress-resource strong')).toContainText('8/55 发现');

  await oxygen.getByRole('button', { name: '知道了，继续探索' }).click();
  await expect(page.getByRole('button', { name: '实验目标 氟' })).toContainText('40 秒');
  await expect(page.getByRole('progressbar', { name: '样本准备进度' })).toHaveAttribute('value', '0');
  const fluorine = page.getByRole('dialog', { name: '新元素发现 · 氟' });
  await page.clock.runFor(39_000);
  await expect(fluorine).toHaveCount(0);
  await expect(page.locator('.progress-resource strong')).toContainText('8/55 发现');
  await page.clock.runFor(5_000);
  await expect(fluorine).toBeVisible();
});
