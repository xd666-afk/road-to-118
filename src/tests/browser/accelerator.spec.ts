import { expect, test } from '@playwright/test';
import { acceleratorSegments } from '../../game/accelerator';
import { createState, Engine } from '../../game/engine';
import { D } from '../../game/numbers';
import { deserialize, serialize } from '../../game/save';

test.use({launchOptions: {args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']}});
const SAVE_KEY = 'road-to-118.save.v1';

test('construction charges its resources once and rejects invalid ordering', () => {
  const engine = new Engine(createState(101));
  const { state } = engine;
  const first = acceleratorSegments[0];
  state.coins = D(10);
  state.data = D(first.data);
  const sample = state.elements[first.z - 1];
  sample.inventory = sample.totalProduced = D(3);
  expect(engine.fundAcceleratorSegment(0)).toBe(0);
  state.elements.slice(0, first.z).forEach(element => { element.discovered = true; });
  expect(engine.fundAcceleratorSegment(1)).toBe(0);
  expect(engine.commissionAccelerator()).toBe(false);
  expect(state.data.eq(first.data)).toBe(true);
  expect(engine.fundAcceleratorSegment(0, 1500)).toBe(1500);
  expect(state.accelerator).toMatchObject({ built: 0, funded: 1500 });
  expect(engine.fundAcceleratorSegment(0)).toBe(first.data - 1500);
  expect(engine.fundAcceleratorSegment(0)).toBe(0);
  expect(state.coins.eq(10) && state.data.isZero() && sample.inventory.eq(3)).toBe(true);
  expect(deserialize(serialize(state)).accelerator).toEqual({ built: 1, commissioned: false });
});

test('use game resources to build four visibly different sections, then commission and reload', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const state = createState(102);
  state.settings.guideDismissed = true;
  state.reactors[0].target = 1;
  state.reactors[0].active = false;
  state.coins = D(1e11);
  state.data = D(2.5e6);
  state.elements.slice(0, 54).forEach(element => { element.discovered = true; });
  for (const stage of acceleratorSegments) {
    const element = state.elements[stage.z - 1];
    element.inventory = element.totalProduced = D(5);
  }
  const legacy = JSON.parse(serialize(state));
  delete legacy.accelerator;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ key, save }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, save);
  }, { key: SAVE_KEY, save: JSON.stringify(legacy) });

  await page.setViewportSize({ width: 1366, height: 850 });
  await page.goto('/');
  await page.getByRole('button', { name: '加速环工程', exact: true }).click();
  await expect(page).toHaveURL(/#accelerator$/);
  const progress = page.getByRole('progressbar', { name: '加速环工程进度' });
  const hall = page.getByRole('region', { name: '加速大厅' });
  const world = page.locator('canvas.accelerator-world');
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  await expect(hall).toHaveAttribute('data-renderer', 'webgl', { timeout: 15_000 });
  await expect(page.locator('.site-header')).toHaveCount(0);
  await expect(progress).toHaveAttribute('value', '0');
  expect((await world.boundingBox())?.width).toBe(1366);
  await button('查看南段 · 加速区').click();
  const worksite = page.getByRole('complementary', { name: '工区操作' });
  await expect(worksite.getByText('先完成前一段')).toBeVisible();
  const east = button('查看东段 · 探测区');
  const anchor = await east.boundingBox();
  await world.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await east.boundingBox())?.x).not.toBe(anchor?.x);
  await button('全环俯瞰').click();
  await east.click();

  await worksite.getByRole('button', { name: '投入 1875', exact: true }).click();
  await expect(worksite.getByRole('progressbar')).toHaveAttribute('value', '1875');
  await expect(progress).toHaveAttribute('value', '0');
  for (const index of acceleratorSegments.keys()) {
    await worksite.getByRole('button', { name: /完工$/ }).click();
    await expect(progress).toHaveAttribute('value', String(index + 1));
    if (index === 1) {
      await page.reload();
      await expect(hall).toHaveAttribute('data-renderer', 'webgl');
      await expect(progress).toHaveAttribute('value', '2');
      await button('西段 · 注入区').click();
      await page.screenshot({ path: testInfo.outputPath('accelerator-construction.png') });
    }
  }

  await button('检修通道').click();
  await expect(button('检修通道')).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: testInfo.outputPath('accelerator-aisle.png') });
  await button('启动全环试束').click();
  await expect(page.getByText('试束完成', { exact: true })).toBeVisible();
  await expect(button('全环俯瞰')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(hall).toHaveAttribute('data-renderer', 'webgl');
  await expect(button('重放束流')).toBeVisible();
  await button('查看东段 · 探测区').click();
  await expect(page.getByRole('heading', { name: '东段 · 探测区' })).toBeVisible();
  await button('关闭工区操作').click();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(saved.accelerator).toEqual({ built: 4, commissioned: true });
  expect(D(saved.coins).eq(state.coins)).toBe(true);
  expect(D(saved.data).eq(D(state.data).minus(acceleratorSegments.reduce((sum, stage) => sum + stage.data, 0)))).toBe(true);
  for (const { z } of acceleratorSegments) expect(D(saved.elements[z - 1].inventory).eq(5)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('accelerator-desktop.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(progress).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: testInfo.outputPath('accelerator-mobile.png') });
  await button('返回反应容器').click();
  await expect(page.getByRole('region', { name: '实验室', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('read and archive Cs from the hall after resuming a paid research run', async ({ page }) => {
  const state = createState(103);
  state.settings.guideDismissed = true;
  state.settings.reducedMotion = true;
  state.reactors[0].active = false;
  state.accelerator = { built: 4, commissioned: true };
  state.data = D(45_000);
  state.elements.slice(0, 55).forEach(element => { element.discovered = true; });
  const reference = state.elements[53];
  reference.inventory = reference.totalProduced = D(12);
  const specimen = state.elements[54];
  specimen.inventory = specimen.totalProduced = D(125);
  await page.addInitScript(({ key, save }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, save);
  }, { key: SAVE_KEY, save: serialize(state) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.goto('/#accelerator');
  const lab = page.getByRole('region', { name: '加速大厅' });
  const panel = page.getByRole('complementary', { name: '铯研究控制台' });
  await expect(lab).toBeVisible();
  await lab.getByRole('button', { name: '铯研究', exact: true }).click();
  await panel.getByRole('button', { name: '启动铯实验' }).click();
  const lock = panel.getByRole('button', { name: /锁定信号/ });
  await expect(lock).toBeVisible();
  await page.clock.fastForward(900);
  await lock.click();
  await expect(panel.getByText('+5 份')).toBeVisible();
  await page.reload();
  await expect(panel.getByText('+5 份')).toBeVisible();
  await page.clock.fastForward(3600);
  await page.clock.fastForward(3600);
  await expect(panel.getByRole('progressbar')).toHaveAttribute('value', '10');
  await panel.getByRole('button', { name: '读取探测结果' }).click();
  await panel.getByRole('button', { name: '打开铯档案' }).click();
  const archive = page.getByRole('dialog', { name: '铯 · Caesium' });
  await expect(archive.getByText('加速环探测舱', { exact: false })).toBeVisible();
  await archive.getByRole('button', { name: '提交 150 单位至档案' }).click();
  await expect(archive.getByText('可提交库存').locator('..')).toContainText('5');
  await expect(archive.getByText('铯钟校时')).toBeVisible();
  await archive.getByRole('button', { name: '关闭弹窗' }).click();
  await expect(panel.getByText('铯已收录，铯钟校时能力已生效。')).toBeVisible();
});

test.describe('accelerator touch controls', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 800 }, reducedMotion: 'reduce' });

  test('the east worksite opens when tapped with reduced motion', async ({ page }) => {
    const state = createState(104);
    state.settings.guideDismissed = true;
    state.elements.slice(0, 10).forEach(element => { element.discovered = true; });
    await page.addInitScript(({ key, save }) => localStorage.setItem(key, save), { key: SAVE_KEY, save: serialize(state) });
    await page.goto('/#accelerator');
    await expect(page.getByRole('region', { name: '加速大厅' })).toHaveAttribute('data-renderer', 'webgl');
    const marker = page.getByRole('button', { name: '查看东段 · 探测区' });
    await marker.tap();
    await expect(page.getByRole('complementary', { name: '工区操作' })).toBeVisible();
    await expect(marker).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('complementary', { name: '工区操作' })).toHaveCount(0);
    await expect(marker).toBeFocused();
  });

  test('Ba shows the beam direction, saves a partial adjustment and unlocks production on archive', async ({ page }) => {
    test.setTimeout(45_000);
    const now = Date.now();
    const state = createState(105, now);
    state.settings.guideDismissed = true;
    state.settings.reducedMotion = true;
    state.reactors[0].active = false;
    state.accelerator = { built: 4, commissioned: true };
    state.data = D(75_000);
    state.elements.forEach(row => { row.discovered = true; });
    state.elements[35].inventory = state.elements[35].totalProduced = D(18);
    Object.assign(state.elements[54], { archived: true, deposited: 100, totalProduced: D(100) });
    Object.assign(state.elements[55], { deposited: 140, inventory: D(0), totalProduced: D(140) });
    await page.addInitScript(({ key, save }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, save);
    }, { key: SAVE_KEY, save: serialize(state) });
    await page.clock.setFixedTime(now);
    await page.goto('/#accelerator');
    await page.getByRole('button', { name: '钡研究', exact: true }).tap();
    const panel = page.getByRole('complementary', { name: '钡研究控制台' });
    await panel.getByRole('button', { name: '启动钡实验' }).tap();
    const left = panel.getByRole('button', { name: '向左调校' });
    const right = panel.getByRole('button', { name: '向右调校' });
    await expect(panel.getByText('偏差 +1')).toBeVisible();
    await left.tap();
    await expect(panel.getByText('偏差 -2')).toBeVisible();
    await right.tap();
    await expect(panel.getByText('偏差 -1')).toBeVisible();
    await page.reload();
    await expect(panel.getByText('偏差 -1')).toBeVisible();
    await right.tap();
    await expect(panel.getByText('+10 份')).toBeVisible();
    await left.tap();
    await left.tap();
    await expect(panel.getByText('采样完成，可读取 40 份钡样本。')).toBeVisible();
    await panel.getByRole('button', { name: '读取探测结果' }).tap();
    await panel.getByRole('button', { name: '打开钡档案' }).tap();
    const archive = page.getByRole('dialog', { name: '钡 · Barium' });
    await expect(archive.getByText(/加速环探测舱/)).toBeVisible();
    await archive.getByRole('button', { name: '提交 40 单位至档案' }).tap();
    await expect(archive.getByText('束流校准', { exact: true })).toBeVisible();
    await expect(archive.getByText('元素能力已生效。')).toBeVisible();
    await page.reload();
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
    expect(saved.elements[55]).toMatchObject({ archived: true, deposited: 180, inventory: '0' });
  });
});
