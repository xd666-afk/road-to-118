import { expect, test } from '@playwright/test';
import { createState } from '../../game/engine';
import { D } from '../../game/numbers';
import { serialize } from '../../game/save';

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

test('pre-Ne saves stay in the lab even when following an engineering link', async ({ page }) => {
  const state = createState(108);
  state.settings.guideDismissed = true;
  state.elements.slice(0, 9).forEach(row => { row.discovered = true; });
  await page.addInitScript(save => localStorage.setItem('road-to-118.save.v1', save), serialize(state));
  await page.goto('/#projects/spectroscopy');
  await expect(page.getByRole('region', { name: '实验室', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '科研工程', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '加速环工程', exact: true })).toHaveCount(0);
  await page.evaluate(() => { location.hash = '#accelerator'; });
  await expect(page.getByRole('region', { name: '加速大厅' })).toHaveCount(0);
});

test('a device without WebGL uses the Blender image for the actual construction stage', async ({ page }) => {
  const state = createState(109);
  state.settings.guideDismissed = true;
  state.elements.slice(0, 18).forEach(row => { row.discovered = true; });
  state.projects.separation.built = 2;
  await page.addInitScript(save => {
    localStorage.setItem('road-to-118.save.v1', save);
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, options?: unknown) {
      return type === 'webgl2' ? null : Reflect.apply(getContext, this, [type, options]);
    } as typeof getContext;
  }, serialize(state));
  await page.goto('/#projects/separation');
  const campus = page.getByRole('region', { name: '科研园区' });
  await expect(campus.locator('.campus-model')).toHaveAttribute('data-renderer', 'photo');
  const poster = campus.getByRole('img', { name: '样本分离厂的当前施工外观' });
  await expect(poster).toHaveAttribute('src', /campus-separation-2\.webp$/);
  await expect.poll(() => poster.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test('mobile players can preview locked projects, fund a site in stages and resume after refresh', async ({ page }, testInfo) => {
  const state = createState(106);
  state.settings.guideDismissed = true;
  state.settings.reducedMotion = true;
  state.elements.slice(0, 10).forEach(row => { row.discovered = true; });
  state.reactors[0].active = false;
  state.data = D(80);
  await page.addInitScript(save => {
    const key = 'road-to-118.save.v1';
    if (localStorage.getItem(key) === null) localStorage.setItem(key, save);
  }, serialize(state));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  const open = page.getByRole('button', { name: '科研工程', exact: true });
  const panel = page.getByRole('region', { name: '科研工程面板' });
  await open.click();
  await panel.getByRole('button', { name: /样本分离厂/ }).click();
  await expect(panel.getByRole('progressbar', { name: '进料塔科研投入' })).toBeVisible();
  await panel.getByRole('button', { name: /脉冲供能站/ }).click();
  await expect(panel.getByText('发现氩（Ar）后开放')).toBeVisible();
  await panel.getByRole('button', { name: /光谱观测站/ }).click();
  await panel.getByRole('button', { name: '投入 20', exact: true }).click();
  const progress = panel.getByRole('progressbar', { name: '光谱探头科研投入' });
  await expect(progress).toHaveAttribute('value', '20');
  const preview = panel.getByRole('img', { name: /光谱观测站施工外观/ });
  await expect(preview).toHaveAttribute('src', /campus-spectroscopy-0\.webp$/);
  await page.reload();
  await open.click();
  await expect(progress).toHaveAttribute('value', '20');
  await panel.getByRole('button', { name: '投入 60 完工' }).click();
  await expect(panel.getByText('研究数据加成 +5%')).toBeVisible();
  await expect(preview).toHaveAttribute('src', /campus-spectroscopy-1\.webp$/);
  await expect(panel.getByText('发现镁（Mg）后开放')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('research-projects-mobile.png') });
});

test('the campus operates three facilities, including a scan that survives refresh', async ({ page }, testInfo) => {
  const state = createState(107);
  state.settings.guideDismissed = true;
  state.settings.reducedMotion = true;
  state.elements.slice(0, 18).forEach(row => { row.discovered = true; });
  state.elements[1].inventory = state.elements[1].totalProduced = D(10);
  state.reactors[0].active = false;
  state.data = D(100);
  for (const project of Object.values(state.projects)) project.built = 1;
  state.projectOperations.pulseCharge = 15;
  await page.addInitScript(save => {
    const key = 'road-to-118.save.v1';
    if (localStorage.getItem(key) === null) localStorage.setItem(key, save);
  }, serialize(state));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: '科研工程', exact: true }).click();
  await page.getByRole('button', { name: '进入光谱观测站' }).click();
  await expect(page).toHaveURL(/#projects\/spectroscopy$/);
  const campus = page.getByRole('region', { name: '科研园区' });
  const model = campus.locator('.campus-model');
  await expect(model).toHaveAttribute('data-renderer', 'webgl');
  await expect(model).toHaveAttribute('data-built', '1');
  await campus.getByRole('button', { name: '拉近视角' }).click();
  await campus.getByRole('button', { name: '重置视角' }).click();
  const spectrum = campus.getByRole('complementary', { name: '光谱观测站控制台' });
  await spectrum.getByLabel('分析样本').selectOption('2');
  await spectrum.getByRole('button', { name: /分析 8 秒/ }).click();
  await expect(spectrum.getByRole('button', { name: /领取 28 科研点/ })).toBeDisabled();
  await page.clock.runFor(3000);
  await page.reload();
  await expect(spectrum.getByText('氦光谱')).toBeVisible();
  await expect(model).toHaveAttribute('data-renderer', 'webgl');
  await page.clock.runFor(8500);
  await spectrum.getByRole('button', { name: /领取 28 科研点/ }).click();
  await expect(spectrum.getByRole('status')).toContainText('报告已领取');
  await page.screenshot({ path: testInfo.outputPath('project-campus-mobile.png') });

  await campus.getByRole('button', { name: /样本分离厂/ }).click();
  const separation = campus.getByRole('complementary', { name: '样本分离厂控制台' });
  await separation.getByLabel('专线目标').selectOption('2');
  await separation.getByRole('button', { name: /配置专线/ }).click();
  await expect(separation.getByRole('status')).toContainText('氦专线运行中');
  await campus.getByRole('button', { name: /脉冲供能站/ }).click();
  await expect(campus.getByRole('progressbar', { name: '供能站蓄能' })).toHaveAttribute('value', '15');
  await campus.getByRole('button', { name: '返回实验室碰撞' }).click();
  await page.getByRole('button', { name: '已暂停', exact: true }).click();
  const collision = page.getByRole('button', { name: '手动碰撞', exact: true });
  await collision.click();
  await page.getByRole('button', { name: '释放供能站增压' }).click();
  const station = page.getByRole('button', { name: '查看供能站' });
  await expect(station).toContainText('余 8 次');
  await collision.click();
  await expect(station).toContainText('余 7 次');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
});
