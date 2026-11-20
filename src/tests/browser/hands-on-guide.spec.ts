import { expect, test } from '@playwright/test';
import { createState } from '../../game/engine';
import { D } from '../../game/numbers';
import { serialize } from '../../game/save';

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
  await expect(coach.getByRole('heading')).toHaveText('拾取灵感点');
  await coach.getByRole('button', { name: '引导操作：放出练习灵感点' }).click();
  const drop = page.getByRole('button', { name: '拾取灵感点' });
  await expect(drop).toBeInViewport();
  await drop.click();
  await expect(page.getByRole('complementary', { name: '手动碰撞增益' })).toContainText('60 秒');
  await expect(coach.getByRole('heading')).toHaveText('用灵感触发碰撞');
  await coach.getByRole('button', { name: '引导操作：查看反应容器' }).click();
  await page.getByRole('button', { name: '手动碰撞' }).click();
  await expect(page.locator('.mp-fx-group.is-latest')).toContainText('+4 碰撞能');

  await expect(coach.getByRole('heading')).toHaveText('研发原料补充');
  await coach.getByRole('button', { name: '引导操作：前往工业自动化' }).click();
  const feed = page.getByRole('region', { name: '原料补充' });
  await expect(feed).toHaveClass(/guide-target/);
  await feed.getByRole('button', { name: '研发模块' }).click();
  await expect(coach.getByRole('heading')).toHaveText('建造 II 级反应容器');
  await coach.getByRole('button', { name: '引导操作：查看建造按钮' }).click();
  const vessel = page.locator('#research-reactor-2');
  await expect(vessel).toHaveClass(/guide-target/);
  await vessel.getByRole('button', { name: '研发并建造' }).click();
  await expect(page.getByLabel('切换反应容器')).toHaveValue('2');

  await expect(coach.getByRole('heading')).toHaveText('研发自动反应');
  await coach.getByRole('button', { name: '引导操作：前往工业自动化' }).click();
  const reaction = page.getByRole('region', { name: '自动反应' });
  await reaction.getByRole('button', { name: '研发模块' }).click();
  await expect(coach.getByRole('heading')).toHaveText('把自动反应升到 2 级');
  await reaction.getByRole('button', { name: '升级至 2 级' }).click();
  await expect(reaction).toContainText('等级 2 / 3');
  await page.getByRole('button', { name: '回实验室继续引导', exact: true }).click();
  await coach.getByRole('button', { name: '引导操作：提交并点亮 H' }).click();
  await coach.getByRole('button', { name: '引导操作：完成引导' }).click();
  await expect(coach).toHaveCount(0);
  await expect(page.getByRole('region', { name: '下一步', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
