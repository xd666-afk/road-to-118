import { expect, test } from '@playwright/test';
import { createState } from '../../game/engine';
import { D } from '../../game/numbers';
import { serialize } from '../../game/save';
import { closeLabPanel, openLabPanel } from './lab-controls';

const SAVE = 'road-to-118.save.v1';

test('first discovery lights the observation window and offers a three-click helium preview', async ({ page }) => {
  const now = Date.now();
  const s = createState(210, now);
  s.settings.guideDismissed = true;
  s.reactors[0].discoveryHazard = 0;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 1000);
  await page.addInitScript(({ key, text }) => localStorage.setItem(key, text), { key: SAVE, text: serialize(s, now + 1000) });
  await page.goto('/');
  await page.clock.runFor(250);
  await expect(page.locator('.reactor-impact[data-kind="discovery"] strong')).toHaveText('He');
  const discovery = page.getByRole('dialog', { name: '新元素发现 · 氦' });
  await expect(discovery).toHaveCount(0);
  await page.clock.runFor(600);
  await discovery.getByRole('button', { name: '试用氦回波' }).click();
  const trial = page.getByRole('region', { name: '氦回波试用' });
  const hit = page.getByRole('button', { name: '手动碰撞' });
  for (let i = 1; i <= 3; i++) {
    await hit.click({ position: { x: 22, y: 32 } });
    await expect(trial.getByRole('progressbar')).toHaveAttribute('value', String(i));
  }
  await expect(trial).toContainText('试用完成');
  await expect(page.locator('.scene-aperture .reactor-impact')).toHaveAttribute('data-kind', 'echo');
  await expect(page.locator('.mp-fx-group.is-latest')).toContainText('氦回波');
  await trial.getByRole('button', { name: '继续实验' }).click();
  await expect(trial).toHaveCount(0);
  await expect(page.getByRole('progressbar', { name: '氦回波进度' })).toHaveCount(0);
});

test('lithium preview and permanent charge release real samples to different elements', async ({ page }) => {
  const now = Date.now();
  const s = createState(211, now);
  s.settings.guideDismissed = true;
  s.reactors[0].target = 3;
  for (const sample of s.elements.slice(0, 3)) sample.discovered = true;
  s.elements[2].inventory = D(97);
  s.elements[2].totalProduced = D(97);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 1000);
  await page.addInitScript(({ key, text }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, text); }, { key: SAVE, text: serialize(s, now + 1000) });
  await page.goto('/');
  await openLabPanel(page, 'archive');
  await page.locator('[data-z="3"]').click();
  const dialog = page.getByRole('dialog', { name: '锂 · Lithium' });
  await dialog.getByRole('button', { name: '试用锂蓄能' }).click();
  const trial = page.getByRole('region', { name: '锂蓄能试用' });
  const hit = page.getByRole('button', { name: '手动碰撞' });
  const demoRelease = trial.getByRole('button', { name: '释放试用电芯' });
  await expect(demoRelease).toBeDisabled();
  for (let i = 0; i < 4; i++) await hit.click({ position: { x: 12, y: 56 } });
  await demoRelease.click();
  await expect(page.locator('.scene-aperture .reactor-impact')).toHaveAttribute('data-kind', 'release');
  await trial.getByRole('button', { name: '继续实验' }).click();

  await openLabPanel(page, 'archive');
  await page.locator('[data-z="3"]').click();
  await expect(dialog.getByRole('button', { name: '试用锂蓄能' })).toHaveCount(0);
  await dialog.getByRole('button', { name: '提交 100 单位至档案' }).click();
  await dialog.getByRole('button', { name: '关闭弹窗' }).click();
  await closeLabPanel(page);

  const release = page.getByRole('button', { name: '释放锂蓄能' });
  for (let i = 0; i < 8; i++) await hit.click({ position: { x: 12, y: 56 } });
  await expect(release).toBeEnabled();
  await page.reload();
  await expect(release).toBeEnabled();
  await openLabPanel(page, 'instrument');
  await page.locator('#target').selectOption('4');
  await closeLabPanel(page);
  await page.getByRole('button', { name: '选择蓄能样本目标' }).click();
  await page.locator('#target').selectOption('1');
  await closeLabPanel(page);
  await release.click();
  await expect(release).toBeDisabled();
  await expect(page.locator('.toast-stack')).toContainText('+6 份氢');
  await openLabPanel(page, 'archive');
  await page.locator('[data-z="1"]').click();
  await expect(page.getByRole('button', { name: '提交 6 单位至档案' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
