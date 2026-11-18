import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('player review: natural opening earns first upgrade, persists it, and exposes tutorial', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  // A real first discovery may happen before the player can afford the first
  // upgrade. Dismiss that knowledge card just as a player would, including when
  // it appears between an enabled assertion and the subsequent purchase click.
  await page.addLocatorHandler(page.getByRole('dialog',{name:/新元素发现/}), async dialog => {
    await dialog.getByRole('button',{name:'关闭弹窗'}).click();
  });
  await page.setViewportSize({width:360,height:800});
  await page.goto('/');
  const coach = page.getByRole('region',{name:'新手实验引导'});
  const buy = coach.getByRole('button',{name:'引导操作：补充第一份氢样本'});
  await expect(buy).toBeDisabled();
  await expect(buy).toBeEnabled({timeout:10000});
  await page.screenshot({path:'artifacts/nexus-playtest-20261118/mobile-natural-opening.png',fullPage:true,animations:'disabled'});
  await buy.click();
  const modal = page.getByRole('dialog');
  if(await modal.count()) await page.keyboard.press('Escape');
  await coach.getByRole('button',{name:'跳过引导'}).click();
  await page.reload();
  await expect(coach).toHaveCount(0);
  await expect(page.getByText('等级 1',{exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'教程'}).click();
  await expect(page.getByRole('heading',{name:'实验室教程',exact:true})).toBeVisible();
  await page.screenshot({path:'artifacts/nexus-playtest-20261118/mobile-tutorial.png',fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'返回实验',exact:true}).click();
  await expect(page.getByText('等级 1',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('player review: all six sections fit phone widths; pause survives reload', async ({page}) => {
  await page.goto('/');
  // Pause as soon as the UI is ready, keeping this natural new run deterministic
  // without altering the economy or injecting a midgame save.
  await page.getByRole('button',{name:'运行中',exact:true}).click();
  await expect(page.getByTestId('current-rate')).toHaveText('0 次/秒');
  await page.getByRole('region',{name:'新手实验引导'}).getByRole('button',{name:'跳过引导'}).click();
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
