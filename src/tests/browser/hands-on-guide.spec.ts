import { expect, test } from '@playwright/test';
import { openLabPanel } from './lab-controls';
import { createState } from '../../game/engine';
import { D } from '../../game/numbers';
import { serialize } from '../../game/save';
import { PULSE_DROP_MS, PULSE_DROP_RETRACT_MS, PULSE_DROP_WARNING_MS } from '../../game/pulseBoosts';

for (const reduced of [false, true]) {
  test(`uncollected pickups warn and retract before removal${reduced ? ' with reduced motion' : ''}`, async ({ page }) => {
    const now = Date.now();
    const state = createState(92, now);
    state.settings.handsOnGuide = true;
    state.elements[1].discovered = true;
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await page.clock.install({ time: now });
    await page.clock.pauseAt(now + 1000);
    await page.addInitScript(text => localStorage.setItem('road-to-118.save.v1', text), serialize(state, now + 1000));
    await page.goto('/');

    const practice = page.getByRole('button', { name: '放出练习灵感点' });
    const flight = page.locator('.pulse-drop-flight');
    const pickup = page.getByRole('button', { name: '拾取灵感点' });
    await practice.click();
    await expect(flight).toHaveAttribute('data-phase', 'available');
    await page.clock.runFor(900);
    await page.clock.runFor(PULSE_DROP_MS - PULSE_DROP_WARNING_MS - 900);
    await expect(flight).toHaveAttribute('data-phase', 'warning');
    await expect(flight.locator('.pulse-drop-visual')).toHaveCSS('animation-name', reduced ? 'none' : 'pulse-drop-shake');
    await expect(pickup).toBeEnabled();

    await page.clock.runFor(PULSE_DROP_WARNING_MS);
    await expect(flight).toHaveAttribute('data-phase', 'retracting');
    await expect(flight).toHaveCSS('animation-name', reduced ? 'pulse-drop-fade' : 'pulse-drop-retract');
    await expect(pickup).toBeDisabled();
    await page.clock.runFor(PULSE_DROP_RETRACT_MS + 1200);
    await expect(flight).toHaveCount(0);
    await expect(practice).toBeEnabled();
    await expect(page.getByRole('complementary', { name: '手动碰撞增益' })).toHaveCount(0);
    if (!reduced) {
      await practice.click();
      await page.clock.runFor(PULSE_DROP_MS - PULSE_DROP_WARNING_MS + 250);
      await expect(flight).toHaveAttribute('data-phase', 'warning');
      await pickup.click({ position: { x: 16, y: 24 } });
      await expect(page.getByRole('complementary', { name: '手动碰撞增益' })).toContainText('×2');
      await expect(flight).toHaveCount(0);
    }
  });
}

test('a pickup remains under the pointer when pressed with reduced motion', async ({ page }) => {
  const state = createState(91);
  state.settings.handsOnGuide = true;
  state.elements[1].discovered = true;
  await page.addInitScript(text => localStorage.setItem('road-to-118.save.v1', text), serialize(state));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '放出练习灵感点' }).click();
  await expect(page.locator('.opening-spotlight')).toHaveAttribute('data-step', 'drop');
  await page.getByRole('button', { name: '拾取灵感点' }).click({ position: { x: 16, y: 24 } });
  await expect(page.getByRole('complementary', { name: '手动碰撞增益' })).toContainText('×2');
});

test('new-player practice uses a real drop, collision, reactor construction and module upgrade', async ({ page }) => {
  const now = Date.now();
  const s = createState(79, now);
  s.settings.handsOnGuide = true;
  s.settings.reducedMotion = true;
  s.coins = D(10_000);
  s.data = D(3000);
  for (const row of s.elements.slice(0, 4)) row.discovered = true;
  s.elements[0].inventory = D(100);
  s.elements[0].totalProduced = D(100);
  await page.addInitScript(text => {
    const key = 'road-to-118.save.v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, text);
  }, serialize(s, now));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 1000);
  await page.goto('/');

  const coach = page.getByRole('region', { name: '新手实验引导' });
  const spotlight = page.locator('.opening-spotlight');
  const advance = async (step: string) => {
    await page.clock.runFor(1000);
    await expect(spotlight).toHaveAttribute('data-step', step);
  };
  await expect(coach.getByRole('heading')).toHaveText('认识灵感点');
  await page.getByRole('button', { name: '放出练习灵感点' }).click();
  await advance('drop');
  const drop = page.getByRole('button', { name: '拾取灵感点' });
  await expect(drop).toBeInViewport();
  await drop.click();
  await expect(page.getByRole('complementary', { name: '手动碰撞增益' })).toContainText('60 秒');
  await advance('pulse');
  await expect(coach.getByRole('heading')).toHaveText('用灵感触发碰撞');
  await page.getByRole('button', { name: '手动碰撞' }).click();
  await expect(page.locator('.mp-fx-group.is-latest')).toContainText('+4 碰撞能');

  await advance('feed-research');
  await page.getByRole('button', { name: '科研', exact: true }).click();
  await advance('feed');
  const feed = page.locator('[data-guide-target="module-feed"]');
  await expect(feed).toBeFocused();
  await feed.click();
  await advance('build');
  const vessel = page.locator('[data-guide-target="build"]');
  await expect(vessel).toBeInViewport();
  await vessel.click();
  await advance('reaction-research');
  await expect(page.locator('.scene-tier')).toHaveText('II');
  await page.getByRole('button', { name: '科研', exact: true }).click();
  await advance('reaction');
  const reaction = page.locator('[data-guide-target="module-reaction"]');
  await reaction.click();
  await advance('upgrade');
  await expect(reaction).toHaveText('升级至 2 级');
  await reaction.click();
  await advance('archive-lab');
  await page.getByRole('button', { name: '实验室', exact: true }).click();
  await advance('archive');
  const hydrogen = page.getByRole('button', { name: /^1号 氢 H/ });
  await expect(hydrogen).toBeInViewport();
  await hydrogen.click();
  const record = page.getByRole('dialog', { name: '收录氢（H）' });
  const deposit = record.getByRole('button', { name: '提交 100 单位至档案' });
  await expect(deposit).toBeFocused();
  await deposit.click();
  const completion = page.getByRole('dialog', { name: '新手引导完成' });
  await completion.getByRole('button', { name: '完成引导' }).click();
  await page.clock.runFor(1000);
  await expect(spotlight).toHaveCount(0);
  await openLabPanel(page, 'next');
  await expect(page.getByRole('region', { name: '下一步', exact: true })).toBeVisible();
  await openLabPanel(page, 'archive');
  await expect(page.locator('[data-z="1"]')).toContainText('已收录');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.reload();
  await expect(spotlight).toHaveCount(0);
  await expect(page.locator('[data-z="1"]')).toContainText('已收录');
});

test('the guide waits for earned resources and then highlights the research control', async ({ page }) => {
  const now = Date.now();
  const s = createState(98, now);
  s.settings.handsOnGuide = true;
  s.settings.reducedMotion = true;
  s.stats.milestones.pulsePickup = 0;
  s.stats.milestones.boostedPulse = 0;
  s.elements[1].discovered = true;
  s.reactors[0].target = 1;
  s.coins = D(58);
  s.data = D(28);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 1000);
  await page.addInitScript(text => localStorage.setItem('road-to-118.save.v1', text), serialize(s, now + 1000));
  await page.goto('/');
  const overlay = page.locator('.opening-spotlight');
  await expect(overlay).toHaveAttribute('data-step', 'feed-funds');
  await expect(overlay).toContainText('还差');
  const collision = page.getByRole('button', { name: '手动碰撞' });
  await expect(collision).toBeFocused();
  const hint = await overlay.getByRole('region', { name: '新手实验引导' }).boundingBox();
  const button = await collision.boundingBox();
  expect(hint!.y + hint!.height).toBeLessThan(button!.y);
  // An activation anywhere outside the highlighted control must leave the game in place.
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-guide-target="research"]')?.click());
  await expect(page.locator('[data-guide-target="module-feed"]')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await page.clock.runFor(1000);
  await expect(overlay).toHaveAttribute('data-step', 'feed-research');
  await expect(page.getByRole('button', { name: '科研', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.clock.runFor(1000);
  await expect(overlay).toHaveAttribute('data-step', 'feed');
  await expect(page.locator('[data-guide-target="module-feed"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '跳过引导' })).toBeFocused();
  await page.keyboard.press('Escape');
  await page.clock.runFor(1000);
  await expect(overlay).toHaveCount(0);
});
