import { expect, test } from '@playwright/test';
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
  await page.locator('#periodic-table').scrollIntoViewIfNeeded();
  await page.locator('[data-z="2"]').click();

  const region = page.getByRole('region', { name: '元素收录操作' });
  const submit = region.getByRole('button', { name: '提交 4 单位至档案' });
  await expect(submit).toBeInViewport();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(submit).toBeInViewport();
  await submit.click();

  await expect(region).toContainText('档案累计提交');
  await expect(region).toContainText('4 / 50');
  await expect(region).toContainText('可提交库存');
  await expect(region).toContainText('0 单位');
  await expect(region.getByRole('button', { name: '提交 0 单位至档案' })).toBeDisabled();
});

test('fixed batches stay disabled when unaffordable while MAX spends only what it can', async ({ page }) => {
  const s = pausedLab(712);
  s.coins = D(200);
  await page.addInitScript(({ key, text }) => localStorage.setItem(key, text), { key: KEY, text: serialize(s) });
  await page.goto('/');

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

test('stage copy reports H–Xe archive checkpoints and accessible opening checks keep completed He', async ({ page }) => {
  const s = pausedLab(713);
  s.elements[1].discovered = true;
  await page.addInitScript(({ key, text }) => localStorage.setItem(key, text), { key: KEY, text: serialize(s) });
  await page.goto('/');

  await expect(page.locator('.journey-stage').first()).toContainText('氖档案');
  await expect(page.locator('.journey-stage').first()).toContainText('已提交 0/50 份');
  await expect(page.locator('.journey-stage').nth(1)).toContainText('钙档案 · 第20号');
  await expect(page.locator('.progress-resource strong')).toContainText('2/54 发现');
  const checklist = page.getByRole('list', { name: '开局检查清单' });
  await expect(checklist).toBeVisible();
  await expect(checklist.getByRole('listitem', { name: '发现 He：已完成' })).toBeVisible();
  await expect(checklist.getByRole('listitem', { name: '新容器：待完成' })).toBeVisible();
});

test('Be discovery card stays open while background discovery queues B, then opens the next card', async ({ page }) => {
  const clock = new Date('2026-11-19T00:00:00.000Z').getTime();
  const s = createState(23);
  s.settings.guideDismissed = true;
  s.elements[1].discovered = true;
  s.elements[2].discovered = true;
  s.reactors.forEach(r => { r.active = false; });
  const first = s.reactors[0];
  first.active = true; first.target = 4; first.exploring = true; first.discoveryHazard = 0;
  first.upgrades.atoms = 300; first.upgrades.speed = 200;
  await page.clock.install({ time: new Date(clock) });
  await page.clock.pauseAt(new Date(clock + 1000));
  await page.addInitScript(({ key, text }) => localStorage.setItem(key, text), { key: KEY, text: serialize(s, clock + 1000) });
  await page.goto('/');

  const beDialog = page.getByRole('dialog', { name: '新元素发现 · 铍' });
  await page.clock.runFor(500);
  await expect(beDialog).toBeVisible();

  const next = page.getByRole('button', { name: '查看下一个发现' });
  // Seed 23 crosses the second discovery threshold after about three virtual seconds.
  await page.clock.runFor(3500);
  await expect(next).toBeVisible();
  await expect(beDialog).toBeVisible();
  await expect(beDialog).toContainText('还有 1 项新发现待查看');
  await expect(page.locator('.progress-resource strong')).toContainText('5/54 发现');

  await next.click();
  await expect(page.getByRole('dialog', { name: '新元素发现 · 硼' })).toBeVisible();
  await expect(page.locator('.progress-resource strong')).toContainText('5/54 发现');
  await expect(page.getByRole('button', { name: '查看下一个发现' })).toHaveCount(0);
});
