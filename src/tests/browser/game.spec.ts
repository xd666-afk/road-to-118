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
  const archive = page.getByRole('region', { name: '元素周期表', exact: true });
  const archiveHeading = archive.getByRole('heading', { name: '元素周期表' });
  await expect(archive.locator('.periodic-cell')).toHaveCount(118);
  await expect(archive.locator('[data-z="2"]')).toContainText('下一发现');
  await archiveHeading.scrollIntoViewIfNeeded();
  await expect(archiveHeading).toBeInViewport();
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '周期表' })).toHaveCount(0);
  await expect(page.getByTestId('current-rate')).toHaveCount(1);
  await page.locator('[data-z="118"]').click();
  await expect(page.getByRole('dialog')).toContainText('鿫');
  await expect(page.getByRole('dialog')).toContainText('100 次成功合成');
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
  await page.locator('#periodic-table').scrollIntoViewIfNeeded();
  expect(await page.locator('.table-scroll').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
  await page.locator('[data-z="1"]').click(); await expect(page.getByRole('dialog')).toContainText('氢');
  await expect(page.getByRole('button',{name:'关闭弹窗'})).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'科研'}).click();
  await expect(page.getByRole('heading', { name: '工业自动化' })).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(() => { location.hash = '#periodic-table'; });
  await expect(page.getByRole('heading',{name:'元素周期表',exact:true})).toBeInViewport();
  await page.reload();
  await expect(page.getByRole('heading',{name:'元素周期表',exact:true})).toBeInViewport();
  await expect(page.getByTestId('current-rate')).toHaveCount(1);
});
test('99 Ca remains incomplete; one more submission preserves the 20th milestone, not the version end', async ({ page }) => {
  const e=new Engine(createState(222));e.state.coins=D('1e30');e.state.data=D('1e30');
  e.state.elements.slice(0, 20).forEach(element => { element.discovered = true; });
  for(let id=2;id<=5;id++)e.build(id);
  e.state.modules.feed=true;e.state.modules.reaction=true;e.state.automation.reaction=true;
  e.state.reactors.forEach(r=>r.active=false);e.target(5,20);
  const ca=e.state.elements[19];ca.inventory=D(99);ca.totalProduced=D(99);e.state.notices=[];
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(e.state)});
  await page.goto('/');await page.locator('#periodic-table').scrollIntoViewIfNeeded();
  await page.locator('[data-z="20"]').click();await page.getByRole('button',{name:'提交 99 单位至档案'}).click();
  await expect(page.getByRole('dialog').locator('.inventory-block')).toContainText('99 / 100');
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'实验室',exact:true}).click();
  await page.getByLabel('切换反应容器').selectOption('5');await page.getByRole('button',{name:'已暂停'}).click();
  await page.locator('[data-z="20"]').click();
  await page.getByRole('button',{name:'提交 1 单位至档案'}).click({timeout:15000});
  await expect(page.getByRole('dialog')).toContainText('周期表已永久点亮');
  await page.keyboard.press('Escape');
  await expect(page.locator('.toast-stack')).toContainText('第二十号里程碑');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-z="20"]')).toHaveClass(/archived/);
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
  await page.locator('[data-z="2"]').click(); await expect(page.getByRole('dialog')).toContainText('氦');
});

test('opening hints lead from Be to a new reactor, parallel production and a real 50-unit archive', async ({page})=>{
  const e=new Engine(createState(61));e.state.coins=D(100000);
  e.state.settings.guideDismissed = true;
  e.buy(1,'atoms',20);
  for(let z=2;z<=4;z++){e.target(1,z);e.state.reactors[0].discoveryHazard=0;e.step(e.state.discoveryWait+.1);}
  e.state.coins=D(2000);e.state.data=D(2000);e.state.notices=[];
  for(const r of e.state.reactors)r.discoveryHazard=100;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(e.state)});
  await page.goto('/');
  await expect(page.getByRole('button',{name:'购买粒子加速',exact:true})).toBeDisabled();
  await page.locator('.mission-card').getByRole('button',{name:'研发原料补充'}).click();
  await page.locator('.mission-card').getByRole('button',{name:'建造 II 级仪器'}).click();
  await expect(page.getByRole('heading',{name:/受控反应容器/})).toBeVisible();
  await page.locator('.mission-card').getByRole('button',{name:'研发自动反应'}).click();
  await page.locator('.mission-card').getByRole('button',{name:'让 I 型生产氢样本'}).click();
  await page.locator('.mission-card').getByRole('button',{name:'提交并点亮 H'}).click({timeout:10000});
  await expect(page.locator('[data-z="1"]')).toContainText('已收录');
});

test('mobile first upgrade is reachable without scrolling',async({page})=>{
  const state=createState(62);state.coins=D(10);state.reactors[0].discoveryHazard=100;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(state)});
  await page.setViewportSize({width:360,height:800});await page.goto('/');
  const coach = page.getByRole('region', { name: '新手实验引导' });
  const action = coach.getByRole('button', { name: '引导操作：补充第一份氢样本' });
  await expect(page.getByRole('region', { name: '下一步', exact: true })).toHaveCount(0);
  await expect(action).toBeInViewport();await action.click();
  await expect(page.getByText('等级 1',{exact:true})).toBeVisible();
});

test('III displays newly discovered heavier elements while I retains its chosen mixture',async({page})=>{
  const e=new Engine(createState(63));e.state.coins=D(1000000);e.state.data=D(1000000);
  for(let z=2;z<=9;z++){e.target(1,z);e.state.reactors[0].discoveryHazard=0;e.step(e.state.discoveryWait+.1);}
  e.build(2);e.build(3);e.target(3,9);e.state.settings.mix=[1,2,3,4,5];e.state.notices=[];
  for(const r of e.state.reactors)r.discoveryHazard=100;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(e.state)});
  await page.goto('/');await page.getByLabel('切换反应容器').selectOption('3');
  await expect(page.locator('.mix-control .element-sample-chip')).toHaveText(['N','O','F']);
  await expect(page.locator('canvas')).toHaveAttribute('aria-label',/展示元素：N、O、F。/);
  await page.getByLabel('切换反应容器').selectOption('1');
  await expect(page.locator('canvas')).toHaveAttribute('aria-label',/展示元素：H、He、Li、Be、B。/);
});

test('income and speed use distinct units; full explanation is in the separate tutorial', async ({page}) => {
  const state=createState(64);state.coins=D(305);
  Object.assign(state.reactors[0].upgrades,{atoms:23,speed:7,yield:1});state.reactors[0].discoveryHazard=1000000;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(state)});
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');
  await expect(page.locator('.resource-income')).toHaveText('收入 +18.9 /秒');
  await expect(page.getByTestId('current-rate')).toHaveText('14 次/秒');
  await expect(page.getByTestId('reactor-energy-rate')).toHaveText('18.9 /秒');
  await expect(page.getByTestId('reactor-data-rate')).toHaveText('14 点/秒');
  await expect(page.getByRole('progressbar', { name: '当前速度占上限' })).toHaveCount(0);
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
  await expect(page.getByTestId('reactor-energy-rate')).toHaveText('0 /秒');
  await expect(page.getByTestId('reactor-data-rate')).toHaveText('0 点/秒');
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
  await page.getByLabel('切换反应容器').selectOption('2');
  await expect(page.getByTestId('current-rate')).toHaveText('42 次/秒');
  await expect(page.locator('.upgrade').filter({hasText:'单次收益'})).toContainText('每次 6 → 8.1 碰撞能');
  await expect(page.locator('.chamber-footer')).toContainText('批量生产 ×32');
  await expect(page.locator('.target-copy')).toContainText('平均等待约');
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'科研',exact:true}).click();
  await expect(page.locator('#production-target')).toHaveCount(0);
  await page.locator('#work-mode').selectOption('produce');
  await expect(page.locator('#production-target')).toBeVisible();
});

test('mobile has five usable tabs and one readable tutorial document, including direct links',async({page})=>{
  const state=createState(66);state.reactors[0].discoveryHazard=1000000;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(state)});
  await page.setViewportSize({width:360,height:800});await page.goto('/');
  await expect(page.getByRole('navigation',{name:'主导航'}).getByRole('button')).toHaveCount(5);
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

test('H–Xe cards show specimen art, neutral electrons and isotope-specific neutrons',async({page})=>{
  const state=createState(68);state.elements.forEach(e=>e.discovered=true);state.reactors[0].active=false;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(state)});
  await page.setViewportSize({width:1280,height:1000});await page.goto('/');
  await page.locator('#periodic-table').scrollIntoViewIfNeeded();
  const dialog=page.getByRole('dialog');
  const value=(label:string)=>dialog.locator('.atomic-facts>div').filter({has:page.getByText(label,{exact:true})}).locator('dd');
  for(let z=1;z<=20;z++){
    await page.locator(`[data-z="${z}"]`).click();
    await expect(value('质子数')).toHaveText(String(z));
    await expect(value('电子数（中性）')).toHaveText(String(z));
    await expect(dialog.locator('.electron-configuration')).toContainText('1s');
    if(z===1)await expect(value('中子数')).toHaveText('0氢-1');
    if(z===6){
      await expect(value('中子数')).toHaveText('6碳-12');
      await expect(dialog.locator('.electron-configuration')).toContainText('1s² 2s² 2p²');
      await dialog.screenshot({path:'artifacts/knowledge-carbon-desktop.png',animations:'disabled'});
      await dialog.locator('summary').click();
      await expect(dialog.locator('.physical-facts')).toContainText('相变特性常压下升华');
      await expect(dialog.locator('.further-science')).toContainText('碳-14');
      await expect(dialog.getByText('沸点',{exact:true})).toHaveCount(0);
    }
    if(z===15){await dialog.locator('summary').click();await expect(dialog.locator('.physical-facts')).toContainText('白磷');await expect(dialog.locator('.specimen')).toHaveAttribute('aria-label',/红磷/);}
    if(z===20){await expect(dialog.locator('.electron-configuration')).toContainText('4s²');await expect(dialog.locator('.electron-shells')).toHaveAttribute('aria-label','电子层由内到外：2、8、8、2');}
    if(z===2){await dialog.locator('summary').click();await expect(dialog.locator('.physical-facts')).toContainText('常压下不凝固');}
    await page.keyboard.press('Escape');
  }
  await page.locator('[data-z="30"]').click();
  await expect(value('质子数')).toHaveText('30');
  await expect(dialog.locator('.electron-configuration')).toContainText('3d¹⁰');
  await expect(dialog.locator('.specimen')).toHaveCSS('background-image', /specimens-sc-ge\.webp/);
  await page.keyboard.press('Escape');
  await page.locator('[data-z="35"]').click();
  await expect(dialog.locator('.specimen')).toHaveCSS('background-image', /specimens-as-ru\.webp/);
  await page.keyboard.press('Escape');
  await page.locator('[data-z="54"]').click();
  await expect(value('质子数')).toHaveText('54');
  await expect(dialog.locator('.electron-configuration')).toContainText('5p⁶');
  await expect(dialog.locator('.specimen')).toHaveCSS('background-image', /specimens-rh-xe\.webp/);
  await expect(dialog.locator('.specimen')).toHaveCSS('background-position', '100% 100%');
  await expect(dialog.locator('.atomic-specimen')).toBeHidden();
  await dialog.locator('summary').click();
  await expect(dialog.locator('.atomic-specimen')).toBeVisible();
  await expect(dialog).toContainText('第五十四号');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-z="55"]')).toHaveClass(/version-locked/);
  await page.locator('[data-z="118"]').click();
  await expect(value('质子数')).toHaveText('118');
  await expect(value('电子数（中性）')).toHaveText('118');
  await expect(dialog.locator('.atomic-facts>div')).toHaveCount(3);
  await expect(dialog.locator('.electron-configuration')).toHaveCount(0);
});

test('VI–VIII each load distinct art and support a manual pulse at the edge of the picture', async ({ page }) => {
  const state = createState(810);
  state.settings.guideDismissed = true;
  state.elements.forEach(element => { element.discovered = true; });
  state.reactors.forEach(reactor => { reactor.built = true; });
  await page.addInitScript(save => localStorage.setItem('road-to-118.save.v1', save), serialize(state));
  await page.goto('/');
  const selector = page.getByRole('combobox', { name: '切换反应容器' });
  const device = page.locator('.device-illustrated');
  for (const [index, roman] of ['vi', 'vii', 'viii'].entries()) {
    await page.setViewportSize({ width: index === 1 ? 360 : 1440, height: 800 });
    await selector.selectOption(String(index + 6));
    const photo = device.locator('.device-photo');
    await expect(photo).toHaveCSS('background-image', new RegExp(`reactor-${roman}\\.webp`));
    const image = await page.request.get(`/assets/reactor-${roman}.webp`);
    expect(image.headers()['content-type']).toContain('image/webp');
    const pulse = device.getByRole('button', { name: '手动碰撞' });
    await pulse.scrollIntoViewIfNeeded();
    const artBox = (await photo.boundingBox())!;
    const area = (await pulse.boundingBox())!;
    expect(artBox.width).toBeCloseTo(artBox.height, 0);
    expect(area).toEqual(await device.boundingBox());
    await pulse.click({ position: { x: artBox.x - area.x + 10, y: 10 } });
    await expect(device.locator('.mp-fx-group.is-latest')).toContainText('碰撞能');
  }
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '科研' }).click();
  await expect(page.locator('.research-device-art.advanced-art')).toHaveCount(3);
});

test('320px and 360px knowledge cards keep atomic data readable and distinguish fluorine from fluoride',async({page})=>{
  const state=createState(69);state.elements.forEach(e=>e.discovered=true);state.reactors[0].active=false;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(state)});
  await page.setViewportSize({width:360,height:800});await page.goto('/');
  await page.locator('#periodic-table').scrollIntoViewIfNeeded();
  await page.locator('[data-z="9"]').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('.atomic-facts>div').filter({has:page.getByText('电子数（中性）',{exact:true})}).locator('dd')).toHaveText('9');
  await expect(dialog.locator('.knowledge-body')).toContainText('F⁻ 后会有 10 个电子');
  for(const width of [320,360]){
    await page.setViewportSize({width,height:800});
    expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await dialog.evaluate(el=>el.scrollTop=0);
  await dialog.screenshot({path:'artifacts/knowledge-fluorine-mobile.png',animations:'disabled'});
  await dialog.locator('summary').click();
  await dialog.locator('.physical-facts').scrollIntoViewIfNeeded();
  await expect(dialog.locator('.further-science')).toContainText('氟唯一的稳定同位素');
  await expect(dialog.getByRole('button',{name:'关闭弹窗'})).toBeInViewport();
  await dialog.screenshot({path:'artifacts/knowledge-fluorine-details-mobile.png',animations:'disabled'});
});

test('shows each missing VI requirement beside Sc exploration and clears it when fulfilled', async ({ page }) => {
  const s = createState(125);
  s.settings.guideDismissed = true;
  s.coins = D('1e12');
  s.data = D('1e8');
  for (const row of s.elements.slice(0, 20)) row.discovered = true;
  const calcium = s.elements[19];
  calcium.deposited = 23;
  calcium.inventory = D(100);
  calcium.totalProduced = D(123);
  await page.addInitScript(({key,text}) => localStorage.setItem(key,text), {key:KEY,text:serialize(s)});
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');

  const requirements = page.locator('#exploration-requirements');
  await expect(requirements).toContainText('探索钪前还需');
  await expect(requirements).toContainText('建造 VI 级同步辐射研究环');
  await expect(requirements).toContainText('收录钙（已提交 23/100 份）');

  await page.getByRole('button', { name: '研发仪器' }).click();
  await page.locator('.research-device').filter({ has: page.getByRole('heading', { name: '同步辐射研究环' }) })
    .getByRole('button', { name: '研发并建造' }).click();
  await expect(requirements).not.toContainText('建造 VI 级');
  await expect(requirements).toContainText('设备扩容 0/1 级');
  await page.getByRole('button', { name: '购买设备扩容' }).click();
  await expect(requirements).not.toContainText('设备扩容 0/1 级');
  await expect(requirements).toContainText('扩容＋单次收益合计 1/4 级');
  for (let level = 0; level < 3; level++) await page.getByRole('button', { name: '购买单次收益' }).click();
  await expect(requirements).not.toContainText('扩容＋单次收益');
  const explore = page.getByRole('button', { name: '探索 Sc' });
  await expect(explore).toBeDisabled();
  await page.locator('.periodic-cell[data-z="20"]').click();
  await page.getByRole('button', { name: '提交 77 单位至档案' }).click();
  await page.keyboard.press('Escape');
  await expect(requirements).toHaveCount(0);
  await expect(explore).toBeEnabled();
});

test('released Ne save upgrades in place and shows a real Na survey after IV tuning',async({page})=>{
  test.setTimeout(45000);
  const start = Date.parse('2026-11-19T00:00:00Z');
  const e=new Engine(createState(801));e.state.coins=D('1e12');e.state.data=D('1e12');
  for(let z=2;z<=10;z++){e.target(1,z);e.state.reactors[0].discoveryHazard=0;e.step(e.state.discoveryWait+.1);}
  e.build(2);e.build(3);e.state.elements[9].inventory=D(100);e.state.elements[9].totalProduced=D(100);e.deposit(10);
  e.state.modules.feed=true;e.state.modules.reaction=true;e.state.automation.reaction=false;
  e.state.reactors.forEach(r=>r.active=false);
  const old=JSON.parse(serialize(e.state, start + 1000));old.saveVersion=1;old.elements=old.elements.slice(0,10);old.reactors=old.reactors.slice(0,3);
  old.elements[9].deposited=50;old.elements[9].totalProduced='50';
  old.stats.completedAt=old.stats.neonCompletedAt;old.stats.milestones.complete=old.stats.milestones.neonArchive;
  delete old.stats.neonCompletedAt;delete old.stats.milestones.neonArchive;
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start + 1000);
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:JSON.stringify(old)});
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');
  await expect(page.locator('[data-z="10"]')).toHaveClass(/archived/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.mission-card').getByRole('button',{name:'建造 IV 级仪器'}).click();
  await expect(page.getByRole('heading',{name:/离子束反应器/})).toBeVisible();
  const requirements = page.locator('#exploration-requirements');
  await expect(requirements).toContainText('探索钠前还需');
  await expect(requirements).toContainText('设备扩容 0/1 级');
  await expect(requirements).toContainText('扩容＋单次收益合计 0/3 级');
  await expect(requirements).not.toContainText('收录氖');
  await page.clock.runFor(6000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const tuning = page.locator('.mission-card').getByRole('button', { name: /培养 IV 级/ });
  for (let level = 0; level < 3; level++) await tuning.click();
  await page.locator('.mission-card').getByRole('button', { name: '开始研究 · Na' }).click();
  await expect(requirements).toHaveCount(0);
  const progress = page.getByRole('progressbar', { name: '首次观测进度' });
  await expect(progress).toHaveAttribute('value', '0');
  await page.clock.runFor(6000);
  expect(Number(await progress.getAttribute('value'))).toBeGreaterThan(.1);
  await expect(page.locator('.target-copy')).toContainText('观测');
  await expect(page.locator('[data-z="10"]')).toHaveClass(/archived/);
  await expect(page.locator('.device-photo')).toHaveCSS('background-image',/reactor-expansion-atlas/);
  await page.screenshot({path:'artifacts/v02-reactor-iv-desktop.png',fullPage:true,animations:'disabled'});
});

test('V opens after Ar and reaches Ca; its graphic and representative samples use the new stage',async({page})=>{
  const e=new Engine(createState(802));e.state.coins=D('1e12');e.state.data=D('1e12');
  e.state.elements.slice(0, 19).forEach(element => { element.discovered = true; });
  for (const z of [10, 18]) {
    const row = e.state.elements[z - 1]; row.inventory = D(100); row.totalProduced = D(100); e.deposit(z);
  }
  for(let id=2;id<=4;id++)e.build(id);
  e.state.modules.feed=true;e.state.modules.reaction=true;e.state.automation.reaction=false;
  e.state.reactors.forEach(r=>r.active=false);e.state.reactors[4].active=true;e.state.reactors[4].discoveryHazard=0;e.state.notices=[];
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(e.state)});
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');
  await page.locator('.lab-guidance').getByRole('button',{name:/建造 V 级仪器/}).click();
  const tune = page.locator('.mission-card').getByRole('button', { name: /培养 V 级/ });
  for (let level = 0; level < 3; level++) await tune.click();
  await page.locator('.mission-card').getByRole('button', { name: '开始研究 · Ca' }).click();
  await expect(page.getByRole('heading',{name:/回旋加速器/})).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('aria-label',/展示元素：K。/);
  await expect(page.getByLabel('切换反应容器').locator('option')).toHaveCount(5);
  await page.screenshot({path:'artifacts/v02-reactor-v-desktop.png',fullPage:true,animations:'disabled'});
});

test('new period fits 320px and 360px screens and reads Ca and P knowledge without overflow',async({page})=>{
  const e=new Engine(createState(803));e.state.coins=D('1e12');e.state.data=D('1e12');
  e.state.elements.slice(0, 20).forEach(element => { element.discovered = true; });
  for(let id=2;id<=5;id++)e.build(id);e.state.reactors.forEach(r=>r.active=false);e.state.notices=[];
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(e.state)});
  await page.setViewportSize({width:360,height:800});await page.goto('/');
  await page.getByLabel('切换反应容器').selectOption('5');
  for(const width of [320,360]){await page.setViewportSize({width,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.screenshot({path:'artifacts/v02-mobile-laboratory.png',fullPage:true,animations:'disabled'});
  await page.locator('[data-z="20"]').click();
  await expect(page.getByRole('dialog').locator('.electron-shells')).toHaveAttribute('aria-label','电子层由内到外：2、8、8、2');
  expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.getByRole('dialog').screenshot({path:'artifacts/v02-calcium-mobile.png',animations:'disabled'});
  await page.keyboard.press('Escape');await page.locator('[data-z="15"]').click();
  await page.getByRole('dialog').locator('summary').click();
  await expect(page.getByRole('dialog').locator('.physical-facts')).toContainText('白磷');
  await page.keyboard.press('Escape');
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'科研',exact:true}).click();
  await expect(page.locator('.research-device')).toHaveCount(8);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
