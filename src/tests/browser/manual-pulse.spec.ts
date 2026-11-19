import { expect, test, type Page } from '@playwright/test';
import { createState } from '../../game/engine';
import { serialize } from '../../game/save';

async function openLab(page: Page) {
  const now = Date.parse('2026-11-19T00:00:00Z');
  const state = createState(712, now);
  state.settings.guideDismissed = true;
  state.reactors[0].discoveryHazard = 100_000;
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 1000);
  await page.addInitScript(save => {
    const key = 'road-to-118.save.v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, save);
  }, serialize(state, now + 1000));
  await page.goto('/');
}

test('mouse and keyboard pulses pay exactly once, show feedback and survive reload', async ({ page }) => {
  await openLab(page);
  const pulse = page.getByRole('button', { name: '手动碰撞' });
  const coins = page.getByTestId('coins');
  await pulse.scrollIntoViewIfNeeded();
  await pulse.click();
  const effects = page.locator('.mp-fx-group');
  await expect(coins).toHaveText('2');
  await expect(effects).toHaveCount(1);
  await expect(effects.last()).toContainText('+2 碰撞能');
  await expect(effects.last()).toContainText('+2 数据');
  await expect(effects.last().locator('.mp-ring').first()).toBeAttached();
  await expect(effects.last().locator('.mp-sparks i')).toHaveCount(8);
  await pulse.press('Space');
  await expect(coins).toHaveText('4');
  await expect(page.locator('.mp-combo')).toHaveText('2 连击');
  const box = (await pulse.boundingBox())!;
  for (let i = 0; i < 15; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(coins).toHaveText('34');
  await expect(effects).toHaveCount(12);
  await expect(page.locator('.mp-gains:visible')).toHaveCount(1);
  await page.getByRole('button', { name: '运行中', exact: true }).click();
  await expect(pulse).toBeDisabled();
  await expect(coins).toHaveText('34');
  await page.reload();
  await expect(coins).toHaveText('34');
  await expect(pulse).toBeDisabled();
});

test.describe('mobile pulse', () => {
  test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, reducedMotion: 'reduce' });

  test('a tap yields resources with reduced effects and without shifting the viewport', async ({ page }) => {
    await openLab(page);
    const pulse = page.getByRole('button', { name: '手动碰撞' });
    await pulse.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await pulse.tap();
    await expect(page.getByTestId('coins')).toHaveText('2');
    const feedback = page.locator('.manual-pulse[data-reduced-motion="true"] .mp-fx-group');
    await expect(feedback).toHaveCount(1);
    await expect(feedback).toContainText('+2 碰撞能');
    await expect(feedback.locator('.mp-sparks')).toHaveCSS('display', 'none');
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });
});
