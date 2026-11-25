import { expect, test } from '@playwright/test';
import { enterLabPage, openLabPanel } from './lab-controls';
import { writeFileSync } from 'node:fs';

test('welcome waits for the player and mobile guide holds each step before advancing', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const now = Date.now();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 1000);
  await page.goto('/');
  const welcome = page.getByRole('dialog', { name: '欢迎来到《通往118》' });
  await expect(welcome).toContainText('我是你的实验助手');
  await expect(page.locator('.lab-guidance')).toHaveCount(0);
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
  await page.clock.runFor(1500);
  await expect(welcome).toBeVisible();
  await welcome.getByRole('button', { name: '开始引导' }).click();
  await page.clock.runFor(1000);
  const guide = page.getByRole('region', { name: '新手实验引导' });
  const start = page.getByRole('button', { name: '开始实验', exact: true });
  await expect(guide).toContainText('第 1 步');
  await expect(page.locator('.lab-guidance')).toHaveCount(0);
  await expect(start).toBeInViewport();
  const nav = page.locator('.scene-dock');
  expect(await nav.evaluate(node => !!node.closest('[inert]'))).toBe(true);
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-guide-target="research"]')?.click());
  await expect(start).toBeVisible();
  await page.clock.runFor(10_000);
  await expect(page.locator('.progress-resource strong')).toContainText('1/56 发现');

  await start.click();
  await page.clock.runFor(400);
  await expect(guide).toContainText('第 1 步');
  await expect(guide).toContainText('仪器开始运行了');
  await expect(page.locator('.scene-actions')).toHaveAttribute('inert', '');
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-opening-target="start"]')?.click());
  await expect(page.locator('[data-opening-target="start"]')).toContainText('运行中');
  await page.clock.runFor(600);
  await expect(guide).toContainText('第 2 步');
  const pulse = page.getByRole('button', { name: '手动碰撞' });
  await expect(pulse).toBeInViewport();
  await expect(page.locator('.scene-instrument')).toHaveAttribute('inert', '');
  await pulse.click();
  await expect(page.locator('.mp-fx-group').last()).toContainText('+2 碰撞能');
  await pulse.click();
  await page.clock.runFor(400);
  await expect(guide).toContainText('碰撞能已就绪');
  await expect(page.locator('.mp-fx-group').last()).toContainText('+2 数据');
  await page.clock.runFor(600);
  await expect(guide).toContainText('第 3 步');
  const buy = page.getByRole('button', { name: '购买补充氢样本' });
  await expect(buy).toBeInViewport();
  await expect(buy).toBeEnabled();
  await expect(page.locator('.progress-resource strong')).toContainText('1/56 发现');
  await buy.click();

  await page.clock.runFor(400);
  await expect(guide).toContainText('已补充一份氢样本');
  await page.clock.runFor(600);
  await expect(guide).toContainText('第 4 步');
  await page.reload();
  await expect(guide).toContainText('第 4 步');
  await page.clock.runFor(10_000);
  await expect(page.locator('.progress-resource strong')).toContainText('1/56 发现');
  await page.getByRole('button', { name: '探索 He' }).click();
  await page.clock.runFor(1000);
  await expect(guide).toContainText('正在合成氦');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.clock.runFor(3750);
  await expect(page.locator('.progress-resource strong')).toContainText('1/56 发现');
  await page.clock.runFor(250);
  await expect(page.locator('.scene-aperture .reactor-impact[data-kind="discovery"]')).toContainText('He');
  await page.clock.runFor(550);
  const card = page.getByRole('dialog', { name: '新元素发现 · 氦' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: '继续引导' })).toBeFocused();
  await card.getByRole('button', { name: '继续引导' }).click();
  await expect(page.locator('.scene-target')).toHaveAttribute('aria-label', '实验目标 氦');
  await expect(page.getByRole('region', { name: '下一步', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '新手实验引导' })).toContainText('认识灵感点');
});

test('skipping the spotlight switches to the single next-step panel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: '欢迎来到《通往118》' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openLabPanel(page, 'next');
  const next = page.getByRole('region', { name: '下一步', exact: true });
  await expect(next.getByRole('button', { name: '补充第一份氢样本' })).toBeVisible();
  await expect(page.getByRole('region', { name: '新手实验引导' })).toHaveCount(0);
});

test('player review: all six sections fit phone widths; pause survives reload', async ({page}) => {
  await page.addLocatorHandler(page.getByRole('dialog',{name:/新元素发现/}), async dialog => {
    await dialog.getByRole('button',{name:'关闭弹窗'}).click();
  });
  await page.goto('/');
  await expect(page.getByRole('dialog',{name:'欢迎来到《通往118》'})).toBeVisible();
  await page.keyboard.press('Escape');
  // Pause the fresh run through the normal control.
  await page.getByRole('button',{name:'运行中',exact:true}).click();
  await expect(page.getByTestId('current-rate')).toHaveText('0 次/秒');
  const measurements: unknown[] = [];
  for(const width of [320,360,768,1440]) {
    await page.setViewportSize({width,height:900});
    for(const name of ['实验室','科研','成就','统计','教程']) {
      await enterLabPage(page, name);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px ${name}`).toBe(true);
      measurements.push({width,tab:name,tinyTargets:await page.locator('button:visible').evaluateAll(buttons=>buttons.map(b=>({text:b.textContent?.trim(),w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})).filter(b=>b.w<32||b.h<32))});
    }
  }
  await enterLabPage(page, '实验室');
  await page.reload();
  await expect(page.getByRole('button',{name:'已暂停',exact:true})).toBeVisible();
  await expect(page.getByTestId('current-rate')).toHaveText('0 次/秒');
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'artifacts/nexus-playtest-20261118/desktop-paused.png',fullPage:true,animations:'disabled'});
  writeFileSync('artifacts/nexus-playtest-20261118/ui-targets.json',JSON.stringify(measurements,null,2));
});
