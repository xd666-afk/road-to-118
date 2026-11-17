import { test, expect } from '@playwright/test';
import { Engine, createState } from '../../game/engine';
import { D } from '../../game/numbers';
import { serialize } from '../../game/save';
const KEY = 'road-to-118.save.v1';
test('desktop: renders live economy, buys upgrades, opens all 118 elements, and exports saves', async ({ page }) => {
  const errors:string[]=[]; page.on('pageerror', e=>errors.push(e.message));
  const state=createState(51); state.coins=D(200); state.reactors[0].discoveryHazard=100;
  await page.addInitScript(({ key, text })=>localStorage.setItem(key,text), {key:KEY,text:serialize(state)});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/自由碰撞容器/})).toBeVisible();
  await expect(page.getByTestId('coins')).toBeVisible();
  await page.getByRole('button',{name:'购买补充氢样本',exact:true}).click();
  await expect(page.getByText('等级 1',{exact:true})).toBeVisible();
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
  const state=createState(52);state.reactors[0].discoveryHazard=100;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(state)});
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
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'科研'}).click();
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
  const state=createState(53);state.reactors[0].discoveryHazard=100;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(state)});
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

test('opening hints lead from Be to a new reactor, parallel production and a real 50-unit archive', async ({page})=>{
  const e=new Engine(createState(61));e.state.coins=D(100000);
  e.buy(1,'atoms',20);
  for(let z=2;z<=4;z++){e.target(1,z);e.state.reactors[0].discoveryHazard=0;e.step(.1);}
  e.state.coins=D(2000);e.state.data=D(2000);e.state.notices=[];
  for(const r of e.state.reactors)r.discoveryHazard=100;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(e.state)});
  await page.goto('/');
  await expect(page.getByRole('button',{name:'购买粒子加速',exact:true})).toBeDisabled();
  await page.locator('.mission-card').getByRole('button',{name:'研发原料补充'}).click();
  await page.locator('.mission-card').getByRole('button',{name:'建造 II 型容器'}).click();
  await expect(page.getByRole('heading',{name:/受控反应容器/})).toBeVisible();
  await page.locator('.mission-card').getByRole('button',{name:'研发自动反应'}).click();
  await page.locator('.mission-card').getByRole('button',{name:'让 I 型生产氢样本'}).click();
  await page.locator('.mission-card').getByRole('button',{name:'提交并点亮 H'}).click({timeout:10000});
  await expect(page.locator('.route-cell').first()).toContainText('已收录');
});

test('mobile first upgrade is reachable without scrolling',async({page})=>{
  const state=createState(62);state.coins=D(10);state.reactors[0].discoveryHazard=100;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(state)});
  await page.setViewportSize({width:360,height:800});await page.goto('/');
  const action=page.locator('.opening-quick-action').getByRole('button',{name:'补充第一份氢样本'});
  await expect(action).toBeInViewport();await action.click();
  await expect(page.getByText('等级 1',{exact:true})).toBeVisible();
});

test('III displays newly discovered heavier elements while I retains its chosen mixture',async({page})=>{
  const e=new Engine(createState(63));e.state.coins=D(1000000);e.state.data=D(1000000);
  for(let z=2;z<=9;z++){e.target(1,z);e.state.reactors[0].discoveryHazard=0;e.step(.1);}
  e.build(2);e.build(3);e.target(3,9);e.state.settings.mix=[1,2,3,4,5];e.state.notices=[];
  for(const r of e.state.reactors)r.discoveryHazard=100;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(e.state)});
  await page.goto('/');await page.getByRole('button',{name:/III 先进核反应装置/}).click();
  await expect(page.locator('.mix-control .element-sample-chip')).toHaveText(['N','O','F']);
  await expect(page.locator('canvas')).toHaveAttribute('aria-label',/展示元素：N、O、F。/);
  await page.getByRole('button',{name:'I 自由碰撞容器',exact:true}).click();
  await expect(page.locator('canvas')).toHaveAttribute('aria-label',/展示元素：H、He、Li、Be、B。/);
});

test('income and speed use distinct units; full explanation is in the separate tutorial', async ({page}) => {
  const state=createState(64);state.coins=D(305);
  Object.assign(state.reactors[0].upgrades,{atoms:23,speed:7,yield:1});state.reactors[0].discoveryHazard=1000000;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(state)});
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');
  await expect(page.locator('.resource-income')).toHaveText('收入 +18.9 /秒');
  await expect(page.locator('.capacity-values')).toContainText('本机速度14 次/秒');
  await expect(page.locator('.capacity-values')).toContainText('速度上限14 次/秒');
  await expect(page.locator('.capacity-meter>p')).toHaveText('满负荷');
  await expect(page.locator('.metric-help, .income-breakdown, .upgrade-hint, .waiting-note')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/解释：/})).toHaveCount(0);
  await page.screenshot({path:'artifacts/simple-laboratory-desktop.png',fullPage:true,animations:'disabled'});
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'教程'}).click();
  await expect(page.getByRole('article')).toContainText('14 次/秒 × 1.35 碰撞能/次');
  await expect(page.getByRole('article')).toContainText('= 18.9 碰撞能/秒');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.resource-bar')).toHaveCount(0);
  await page.screenshot({path:'artifacts/simple-tutorial-desktop.png',animations:'disabled'});
  await page.getByRole('button',{name:'返回实验',exact:true}).click();
  await page.getByRole('button',{name:'运行中'}).click();
  await expect(page.getByTestId('current-rate')).toHaveText('0 次/秒');
  await expect(page.locator('.capacity-meter>p')).toHaveText('已暂停');
  await expect(page.locator('.capacity-meter .progress i')).toHaveCSS('width','0px');
});

test('total speed sums devices; switching the device only changes its own speed and upgrade effects',async({page})=>{
  const state=createState(65);state.coins=D(100000);
  for(let z=0;z<7;z++)state.elements[z].discovered=true;
  Object.assign(state.reactors[0].upgrades,{atoms:23,speed:7,yield:1});
  state.reactors[1].built=true;state.reactors[1].target=4;
  state.modules.feed=true;state.modules.reaction=true;state.automation.reaction=true;
  for(const r of state.reactors)r.discoveryHazard=1000000;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(state)});
  await page.goto('/');
  await expect(page.locator('.resource-bar .resource-item').first()).toContainText('56次/秒');
  await expect(page.locator('.resource-income')).toContainText('+270');
  await page.getByRole('button',{name:'II 受控反应容器',exact:true}).click();
  await expect(page.getByTestId('current-rate')).toHaveText('42 次/秒');
  await expect(page.locator('.upgrade').filter({hasText:'单次收益'})).toContainText('每次 6 → 8.1 碰撞能');
  await expect(page.locator('.chamber-footer')).toContainText('批量生产 ×32');
  await expect(page.locator('.target-copy')).toContainText('平均约');
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'科研',exact:true}).click();
  await expect(page.locator('#production-target')).toHaveCount(0);
  await page.locator('#work-mode').selectOption('produce');
  await expect(page.locator('#production-target')).toBeVisible();
});

test('mobile has six usable tabs and one readable tutorial document, including direct links',async({page})=>{
  const state=createState(66);state.reactors[0].discoveryHazard=1000000;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(state)});
  await page.setViewportSize({width:360,height:800});await page.goto('/');
  await expect(page.getByRole('navigation',{name:'主导航'}).getByRole('button')).toHaveCount(6);
  await page.screenshot({path:'artifacts/simple-laboratory-mobile.png',fullPage:true,animations:'disabled'});
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'教程'}).click();
  await expect(page.getByRole('article').getByRole('heading',{level:2})).toHaveText(['开始实验','资源与速度','选择升级','发现与收录','自动化','存档与其他']);
  await page.getByRole('navigation',{name:'教程目录'}).getByRole('link',{name:/发现与收录/}).click();
  await expect(page.locator('#guide-archive')).toBeInViewport();
  await page.reload();
  await expect(page.getByRole('heading',{name:'实验室教程',exact:true})).toBeVisible();
  for(const width of [320,360,768]){
    await page.setViewportSize({width,height:800});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:360,height:800});
  await page.screenshot({path:'artifacts/simple-tutorial-mobile.png',fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'返回实验',exact:true}).click();
  await expect(page.getByRole('heading',{name:/自由碰撞容器/})).toBeVisible();
  await expect(page.locator('.resource-bar')).toBeVisible();
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'科研',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('tutorial keeps experiments running and defers discovery popups until returning to play',async({page})=>{
  const state=createState(67);state.reactors[0].discoveryHazard=0;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(state)});
  await page.goto('/#guide');
  await expect(page.getByRole('article')).toBeVisible();
  await page.waitForTimeout(700);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'返回实验',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('新元素发现 · 氦');
});
