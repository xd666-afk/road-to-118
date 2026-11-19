import { expect, test } from '@playwright/test';
import { createState } from '../../game/engine';
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
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '周期表' }).click();
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

test('an unaffordable batch offers one explicit level without changing the global x10 selection', async ({ page }) => {
  const s = pausedLab(712);
  s.coins = D(200);
  await page.addInitScript(({ key, text }) => localStorage.setItem(key, text), { key: KEY, text: serialize(s) });
  await page.goto('/');

  await page.getByRole('button', { name: '×10', exact: true }).click();
  const yieldCard = page.locator('.upgrade').filter({ hasText: '单次收益' });
  const fallback = yieldCard.getByRole('button', { name: '购买1级单次收益' });
  await expect(fallback).toContainText('×1');
  await expect(fallback).toContainText('60');
  await expect(fallback).toContainText('单级');
  await fallback.click();

  await expect(page.getByTestId('coins')).toHaveText('140');
  await expect(yieldCard.getByText('等级 1', { exact: true })).toBeVisible();
  await expect(page.locator('.bulk-control button.selected')).toHaveText('×10');

  const atomsCard = page.locator('.upgrade').filter({ hasText: '补充氢样本' });
  const atomsBatch = atomsCard.getByRole('button', { name: '购买补充氢样本' });
  await expect(atomsBatch).toContainText('×10');
  await atomsBatch.click();
  await expect(atomsCard.getByText('等级 10', { exact: true })).toBeVisible();
});

test('stage copy reports discovered species and accessible opening checks keep completed He', async ({ page }) => {
  const s = pausedLab(713);
  s.elements[1].discovered = true;
  await page.addInitScript(({ key, text }) => localStorage.setItem(key, text), { key: KEY, text: serialize(s) });
  await page.goto('/');

  await expect(page.locator('.journey-stage').first()).toContainText('已发现 2/10 种');
  await expect(page.locator('.journey-stage').nth(1)).toContainText('已提交 0/50 份');
  const checklist = page.getByRole('list', { name: '开局检查清单' });
  await expect(checklist).toBeVisible();
  await expect(checklist.getByRole('listitem', { name: '发现 He：已完成' })).toBeVisible();
  await expect(checklist.getByRole('listitem', { name: '新容器：待完成' })).toBeVisible();
});

test('Be discovery card stays open while background discovery queues B, then opens the next card', async ({ page }) => {
  const clock = new Date('2026-11-19T00:00:00.000Z').getTime();
  const s = createState(720);
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
  let ticks = 0;
  while (ticks < 240 && (await beDialog.count()) === 0) { await page.clock.runFor(250); ticks++; }
  await expect(beDialog).toBeVisible();

  const next = page.getByRole('button', { name: '查看下一个发现' });
  ticks = 0;
  while (ticks < 400 && (await next.count()) === 0) { await page.clock.runFor(250); ticks++; }
  await expect(next).toBeVisible();
  await expect(beDialog).toBeVisible();
  await expect(beDialog).toContainText('还有 1 项新发现待查看');
  await expect(page.locator('.progress-resource strong')).toContainText('5/20 发现');

  await next.click();
  await expect(page.getByRole('dialog', { name: '新元素发现 · 硼' })).toBeVisible();
  await expect(page.locator('.progress-resource strong')).toContainText('5/20 发现');
  await expect(page.getByRole('button', { name: '查看下一个发现' })).toHaveCount(0);
});
