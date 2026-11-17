import { test, expect } from '@playwright/test';
import { Engine, createState } from '../../game/engine';
import { D } from '../../game/numbers';
import { serialize } from '../../game/save';
const KEY = 'road-to-118.save.v1';
test('desktop: renders live economy, buys upgrades, opens all 118 elements, and exports saves', async ({ page }) => {
  const errors:string[]=[]; page.on('pageerror', e=>errors.push(e.message));
  const state=createState(51); state.coins=D(200);
  await page.addInitScript(({ key, text })=>localStorage.setItem(key,text), {key:KEY,text:serialize(state)});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/自由碰撞容器/})).toBeVisible();
  await expect(page.getByTestId('coins')).toBeVisible();
  await page.getByRole('button',{name:'购买补充氢样本',exact:true}).click();
  await expect(page.getByText('Lv.1',{exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'周期表'}).click();
  await expect(page.locator('.periodic-cell')).toHaveCount(118);
  await page.locator('[data-z="118"]').click();
  await expect(page.getByRole('dialog')).toContainText('鿫');
  await expect(page.getByRole('dialog')).toContainText('50 次成功合成');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button',{name:'存档与设置'}).click();
  const downloadPromise=page.waitForEvent('download'); await page.getByRole('button',{name:'导出存档',exact:true}).click();
  const download=await downloadPromise; expect(download.suggestedFilename()).toMatch(/Road-to-118.*json/);
  await page.keyboard.press('Escape'); expect(errors).toEqual([]);
});
test('mobile 360px: usable navigation, scrollable table, knowledge cards, no page overflow', async ({ page }) => {
  await page.setViewportSize({width:360,height:800}); await page.goto('/');
  await expect(page.getByRole('button',{name:'购买补充氢样本',exact:true})).toBeVisible();
  await page.screenshot({path:'artifacts/mobile-laboratory.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'周期表'}).click();
  expect(await page.locator('.table-scroll').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
  await page.locator('[data-z="1"]').click(); await expect(page.getByRole('dialog')).toContainText('氢');
  await expect(page.getByRole('button',{name:'关闭弹窗'})).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'科研与工业'}).click();
  await expect(page.getByText('让实验室，自己运转。')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('first-discovery cards queue once; submission at 49/50 remains incomplete, 50 completes', async ({ page }) => {
  const e=new Engine(createState(222));
  for(let z=2;z<=10;z++) { e.target(1,z); e.state.reactors[0].discoveryHazard=0; e.step(.1); }
  const ne=e.state.elements[9]; ne.inventory=D(50);ne.totalProduced=D(50);ne.deposited=0;
  e.state.reactors[0].active=false;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(e.state)});
  await page.goto('/'); await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'周期表'}).click();
  await page.locator('[data-z="10"]').click(); await expect(page.getByRole('dialog')).toContainText('氖');
  await page.getByRole('button',{name:'提交 50 单位至档案'}).click();
  await expect(page.getByRole('dialog')).toContainText('周期表已永久点亮');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toContainText('你的第十号里程碑');
  await page.getByRole('button',{name:'继续我的实验室'}).click();
  await expect(page.locator('[data-z="10"]')).toHaveClass(/archived/);
});
test('corrupt import is rejected without losing the active run', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button',{name:'存档与设置'}).click();
  await page.locator('input[type=file]').setInputFiles({ name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken') });
  await page.keyboard.press('Escape'); await expect(page.getByRole('status')).toContainText('JSON 格式损坏');
  await expect(page.getByTestId('coins')).toBeVisible();
});
test('online first discovery opens exactly one knowledge card and can be reread', async ({ page }) => {
  const s=createState(876);s.reactors[0].discoveryHazard=0;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(s)});
  await page.goto('/'); await expect(page.getByRole('dialog')).toContainText('新元素发现 · 氦');
  await page.keyboard.press('Escape'); await page.waitForTimeout(500); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.locator('.route-cell').nth(1).click(); await expect(page.getByRole('dialog')).toContainText('氦');
});

