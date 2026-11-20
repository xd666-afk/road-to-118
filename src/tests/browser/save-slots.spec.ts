import { expect, test } from '@playwright/test';
import { createState } from '../../game/engine';
import { D } from '../../game/numbers';
import { serialize } from '../../game/save';

const SAVE_KEY = 'road-to-118.save.v1';
const DIRECTORY_KEY = 'road-to-118.saves.v1';

test('new saves start the actual tutorial and can be switched or deleted independently', async ({ page }) => {
  const original = createState(712);
  original.coins = D(4321);
  original.reactors[0].active = false;
  original.settings.guideDismissed = true;
  await page.addInitScript(({ key, text }) => {
    if (!sessionStorage.getItem('seeded-original')) {
      localStorage.setItem(key, text);
      sessionStorage.setItem('seeded-original', 'yes');
    }
  }, { key: SAVE_KEY, text: serialize(original) });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');

  const settings = page.getByRole('dialog', { name: '存档与实验室设置' });
  const welcome = page.getByRole('dialog', { name: '欢迎来到《通往118》' });
  const openSettings = () => page.getByRole('button', { name: '存档与设置' }).click();
  const confirm = settings.getByRole('group', { name: '确认删除存档' });
  const coins = page.getByTestId('coins');

  await openSettings();
  await settings.getByRole('button', { name: '新建存档' }).click();
  await expect(welcome.getByRole('button', { name: '开始引导' })).toBeFocused();
  await expect(coins).toHaveText('0');
  await page.reload();
  await expect(welcome).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(welcome.getByRole('button', { name: '管理存档' })).toBeFocused();
  await page.keyboard.press('Enter');
  await settings.getByRole('button', { name: '切换到存档 1' }).click();
  await expect(coins).toHaveText('4321');
  await expect(welcome).toHaveCount(0);

  await openSettings();
  await settings.getByRole('button', { name: '删除存档 2' }).click();
  await confirm.getByRole('button', { name: '取消' }).click();
  await expect(settings.getByRole('button', { name: '切换到存档 2' })).toBeVisible();
  await settings.getByRole('button', { name: '删除存档 2' }).click();
  await confirm.getByRole('button', { name: '确认删除' }).click();
  await expect(settings.getByRole('button', { name: '删除存档 2' })).toHaveCount(0);
  await expect(coins).toHaveText('4321');
  expect(await page.evaluate(key => Object.keys(localStorage).filter(k => k.startsWith(key + '.slot.')), SAVE_KEY)).toEqual([]);

  await settings.getByRole('button', { name: '新建存档' }).click();
  await welcome.getByRole('button', { name: '管理存档' }).click();
  await settings.getByRole('button', { name: '删除存档 2' }).click();
  await confirm.getByRole('button', { name: '确认删除' }).click();
  await expect(coins).toHaveText('4321');
  await expect(settings).toHaveCount(0);

  await openSettings();
  await settings.getByRole('button', { name: '删除存档 1' }).click();
  await expect(confirm).toContainText('新的空白存档');
  await confirm.getByRole('button', { name: '确认删除' }).click();
  await expect(welcome).toBeVisible();
  await expect(coins).toHaveText('0');
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBeNull();
});

test('a failed save-directory write preserves the current game and removes the unused slot', async ({ page }) => {
  const s = createState(796);
  s.coins = D(1234);
  s.reactors[0].active = false;
  await page.addInitScript(({ key, directory, text }) => {
    localStorage.setItem(key, text);
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, content) {
      if (name === directory) throw new DOMException('Save directory rejected', 'QuotaExceededError');
      return set.call(this, name, content);
    };
  }, { key: SAVE_KEY, directory: DIRECTORY_KEY, text: serialize(s) });
  await page.goto('/');
  await page.getByRole('button', { name: '存档与设置' }).click();
  const settings = page.getByRole('dialog', { name: '存档与实验室设置' });
  await settings.getByRole('button', { name: '新建存档' }).click();
  await expect(settings.getByRole('alert')).toContainText('浏览器存储不可用');
  await expect(page.getByTestId('coins')).toHaveText('1234');
  expect(await page.evaluate(key => Object.keys(localStorage).filter(k => k.startsWith(key + '.slot.')), SAVE_KEY)).toEqual([]);
});

test('the handbook shows the actual calibration requirements on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/#guide-calibration');
  const table = page.getByRole('table', { name: '分段校准' });
  await expect(table.getByRole('row')).toHaveCount(10);
  await expect(table.getByRole('row', { name: /钪–锰/ })).toContainText('VI 级');
  await expect(table.getByRole('row', { name: /钪–锰/ }).getByRole('cell')).toHaveText(['1 级', '4 级', '钙 Ca']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
