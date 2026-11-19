import { expect, test } from '@playwright/test';
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
  const guide = page.getByRole('region', { name: '开局操作引导' });
  const start = page.getByRole('button', { name: '开始实验', exact: true });
  await expect(guide).toContainText('第 1 步');
  await expect(page.locator('.lab-guidance')).toHaveCount(0);
  await expect(start).toBeInViewport();
  const nav = page.locator('.main-nav');
  await expect(nav).toHaveAttribute('inert', '');
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('.main-nav button:nth-child(2)')?.click());
  await expect(start).toBeVisible();
  await page.clock.runFor(10_000);
  await expect(page.locator('.progress-resource strong')).toContainText('1/54 发现');

  await start.click();
  await page.clock.runFor(400);
  await expect(guide).toContainText('第 1 步');
  await expect(guide).toContainText('仪器开始运行了');
  await expect(page.locator('.control-column')).toHaveAttribute('inert', '');
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-opening-target="start"]')?.click());
  await expect(page.locator('[data-opening-target="start"]')).toContainText('运行中');
  await page.clock.runFor(600);
  await expect(guide).toContainText('第 2 步');
  const buy = page.getByRole('button', { name: '购买补充氢样本' });
  await expect(buy).toBeInViewport();
  await expect(buy).toBeDisabled();
  await page.clock.runFor(10_000);
  await expect(buy).toBeEnabled();
  await expect(page.locator('.progress-resource strong')).toContainText('1/54 发现');
  await buy.click();

  await page.clock.runFor(400);
  await expect(guide).toContainText('已补充一份氢样本');
  await page.clock.runFor(600);
  await expect(guide).toContainText('第 3 步');
  await page.reload();
  await expect(guide).toContainText('第 3 步');
  await page.clock.runFor(10_000);
  await expect(page.locator('.progress-resource strong')).toContainText('1/54 发现');
  await page.getByRole('button', { name: '探索 He' }).click();
  await page.clock.runFor(1000);
  await expect(guide).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.clock.runFor(3750);
  await expect(page.locator('.progress-resource strong')).toContainText('1/54 发现');
  await page.clock.runFor(250);
  const card = page.getByRole('dialog', { name: '新元素发现 · 氦' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: '提交 1 单位至档案' })).toBeEnabled();
  await card.getByRole('button', { name: '关闭弹窗' }).click();
  await expect(page.locator('#target')).toHaveValue('2');
  await expect(page.getByRole('region', { name: '下一步', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '新手实验引导' })).toHaveCount(0);
});

test('skipping the spotlight switches to the single next-step panel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: '欢迎来到《通往118》' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
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
    for(const name of ['实验室','周期表','科研','成就','统计','教程']) {
      await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name,exact:true}).click();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px ${name}`).toBe(true);
      measurements.push({width,tab:name,tinyTargets:await page.locator('button:visible').evaluateAll(buttons=>buttons.map(b=>({text:b.textContent?.trim(),w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})).filter(b=>b.w<32||b.h<32))});
    }
  }
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'实验室',exact:true}).click();
  await page.reload();
  await expect(page.getByRole('button',{name:'已暂停',exact:true})).toBeVisible();
  await expect(page.getByTestId('current-rate')).toHaveText('0 次/秒');
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'artifacts/nexus-playtest-20261118/desktop-paused.png',fullPage:true,animations:'disabled'});
  writeFileSync('artifacts/nexus-playtest-20261118/ui-targets.json',JSON.stringify(measurements,null,2));
});
