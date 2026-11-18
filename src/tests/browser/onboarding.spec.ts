import { expect, test } from '@playwright/test';
import { createState } from '../../game/engine';
import { D } from '../../game/numbers';
import { serialize } from '../../game/save';
const KEY = 'road-to-118.save.v1';

test('new player can buy, skip, reload and replay without losing laboratory progress', async ({ page }) => {
  const s = createState(701); s.coins = D(10); s.reactors[0].discoveryHazard = 100000;
  await page.addInitScript(({key,text}) => { if (!localStorage.getItem(key)) localStorage.setItem(key,text); }, {key:KEY,text:serialize(s)});
  await page.goto('/');
  const coach = page.getByRole('region', {name:'新手实验引导'});
  await expect(coach).toBeVisible();
  await coach.getByRole('button', {name:'引导操作：补充第一份氢样本'}).click();
  await expect(coach.getByRole('heading')).toHaveText('发现第二种元素');
  await coach.getByRole('button', {name:'跳过引导'}).click();
  await expect(coach).toHaveCount(0);
  await page.reload(); await expect(coach).toHaveCount(0);
  await expect(page.getByText('等级 1',{exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'教程'}).click();
  await page.getByRole('button',{name:'重看新手引导'}).click();
  await expect(coach.getByRole('heading')).toHaveText('发现第二种元素');
  await expect(page.getByText('等级 1',{exact:true})).toBeVisible();
});

test('coach fits narrow screens and shows a real resource shortage', async ({page}) => {
  const s = createState(702);s.reactors[0].active=false;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(s)});
  await page.goto('/');
  const coach=page.getByRole('region',{name:'新手实验引导'});
  await coach.getByRole('button',{name:'引导操作：恢复实验'}).click();
  await expect(coach.getByRole('button',{name:'引导操作：补充第一份氢样本'})).toBeDisabled();
  for(const width of [320,360,768,1440]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.screenshot({path:'artifacts/onboarding-desktop.png',fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:360,height:800});
  await page.screenshot({path:'artifacts/onboarding-mobile.png',fullPage:true,animations:'disabled'});
});

test('calcium recommendation switches the top instrument and completes the actual archive', async ({page})=>{
  const s=createState(703);s.elements.forEach(x=>x.discovered=true);
  s.reactors.forEach(r=>{r.built=true;r.target=2;r.discoveryHazard=100000;});
  s.modules.feed=s.modules.reaction=true;s.automation.feed=false;s.automation.reaction=true;
  s.elements[0].archived=true;s.elements[0].deposited=50;s.elements[0].totalProduced=D(50);
  s.elements[19].deposited=49;s.elements[19].inventory=D(0);s.elements[19].totalProduced=D(49);
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(s)});
  await page.goto('/');
  await expect(page.getByRole('region',{name:'新手实验引导'})).toHaveCount(0);
  await page.locator('.mission-card').getByRole('button',{name:'生产钙 · 完成阶段目标'}).click();
  await expect(page.locator('#reactor-selector')).toHaveValue('5');
  await expect(page.locator('#target')).toHaveValue('20');
  await page.locator('.mission-card').getByRole('button',{name:'提交钙的记录'}).click({timeout:20000});
  await expect(page.getByRole('dialog')).toContainText('你的第二十号里程碑');
  await expect(page.getByRole('dialog')).toContainText('50 / 50 已收录');
});
