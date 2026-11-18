import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createState } from '../../game/engine';
import { D } from '../../game/numbers';
import { serialize } from '../../game/save';

const KEY = 'road-to-118.save.v1';

test('same-document tutorial links switch sections without losing laboratory progress', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'运行中',exact:true}).click();
  await page.evaluate(()=>{ location.hash='guide'; });
  await expect(page.getByRole('heading',{name:'实验室教程',exact:true})).toBeVisible();
  await page.locator('.tutorial-contents a').first().click();
  await expect(page.getByRole('heading',{name:'实验室教程',exact:true})).toBeVisible();
  await page.evaluate(()=>{ location.hash=''; });
  await expect(page.getByRole('button',{name:'已暂停',exact:true})).toBeVisible();
});

test('clicking inside dialog padding preserves it, while clicking the outside backdrop closes it', async ({page}) => {
  await page.setViewportSize({width:1280,height:900});
  // Starting on the tutorial defers stochastic discovery cards, so this test
  // inspects the actual settings dialog without changing the game state.
  await page.goto('/#guide');
  await page.getByRole('button',{name:'存档与设置'}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const rect = await dialog.boundingBox();
  expect(rect).not.toBeNull();
  const inside = {x:rect!.x+6, y:rect!.y+Math.min(100,rect!.height/2)};
  // Confirm this really is empty dialog padding, rather than a child button
  // or the backdrop, before reproducing the accidental dismissal.
  expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName,inside)).toBe('DIALOG');
  await page.mouse.click(inside.x,inside.y);
  await expect(dialog).toBeVisible();
  await page.mouse.click(Math.max(1,rect!.x-10),rect!.y+100);
  await expect(dialog).toHaveCount(0);
});

test('damaged local save remains protected until its original text is exported and backed up', async ({page}) => {
  const raw = '{broken JSON\n原始存档文本必须逐字保留';
  await page.addInitScript(({key,text})=>{if(!localStorage.getItem(key))localStorage.setItem(key,text);},{key:KEY,text:raw});
  await page.goto('/#guide');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('当前进度尚未保存');
  await expect(alert.getByRole('button')).toHaveCount(1);
  await expect(alert.getByRole('button',{name:'处理存档'})).toBeVisible();
  await page.getByRole('status').getByRole('button',{name:'关闭',exact:true}).click();
  await expect(alert).toBeVisible();
  expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBe(raw);

  await alert.getByRole('button',{name:'处理存档'}).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button',{name:'导出原始旧档',exact:true}).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/Road-to-118-original-.*\.txt$/);
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  expect(readFileSync(downloadedPath!,'utf8')).toBe(raw);
  expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBe(raw);

  await page.getByRole('dialog').getByRole('checkbox').first().check();
  await page.getByRole('button',{name:'备份旧档并保存当前进度',exact:true}).click();
  const saved = await page.evaluate(key=>({main:JSON.parse(localStorage.getItem(key)!),backups:Object.keys(localStorage).filter(k=>k.startsWith('road-to-118.recovery.')).map(k=>localStorage.getItem(k))}),KEY);
  expect(saved.backups).toEqual([raw]);
  expect(saved.main.saveVersion).toBe(2);
  expect(saved.main.elements).toHaveLength(20);
  expect(saved.main.settings.scientific).toBe(true);
  await page.keyboard.press('Escape');
  await expect(alert).toHaveCount(0);
  await page.reload();
  await expect(alert).toHaveCount(0);
  await page.getByRole('button',{name:'存档与设置'}).click();
  await expect(page.getByRole('dialog').getByRole('checkbox').first()).toBeChecked();
});

test('importing a valid save backs up protected damaged text before replacing it', async ({page}) => {
  const raw = '{damaged original for import';
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:raw});
  await page.goto('/#guide');
  await expect(page.getByRole('alert')).toBeVisible();
  const imported = createState(706); imported.coins=D(123); imported.reactors[0].active=false;
  await page.getByRole('button',{name:'处理存档'}).click();
  await page.locator('input[type=file]').setInputFiles({name:'recovered.json',mimeType:'application/json',buffer:Buffer.from(serialize(imported))});
  await expect(page.getByRole('alert')).toHaveCount(0);
  const stored = await page.evaluate(key=>({main:JSON.parse(localStorage.getItem(key)!),backups:Object.keys(localStorage).filter(k=>k.startsWith('road-to-118.recovery.')).map(k=>localStorage.getItem(k))}),KEY);
  expect(stored.backups).toEqual([raw]);
  expect(stored.main.seed).toBe(706);
  expect(stored.main.coins).toBe('123');
  expect(stored.main.reactors[0].active).toBe(false);
});

test('instrument selector reveals a paused non-selected instrument', async ({page}) => {
  const s = createState(707);
  s.elements.slice(0,4).forEach(e=>e.discovered=true);
  s.reactors[1].built=true; s.reactors[1].target=4; s.reactors[1].active=false;
  s.reactors[0].discoveryHazard=100000;
  await page.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:KEY,text:serialize(s)});
  await page.goto('/');
  const selector = page.locator('#reactor-selector');
  await expect(selector).toHaveValue('1');
  await expect(selector.locator('option[value="2"]')).toContainText('已暂停');
  await expect(selector.locator('option[value="1"]')).not.toContainText('已暂停');
  await selector.selectOption('2');
  await expect(page.getByRole('button',{name:'已暂停',exact:true})).toBeVisible();
});

test('failed persistence after a valid import keeps the unsaved-progress warning', async ({page}) => {
  const raw = '{protected original while storage rejects the active save';
  await page.addInitScript(({key,text}) => {
    localStorage.setItem(key,text);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name,value) {
      if(name===key) throw new DOMException('Active save rejected','QuotaExceededError');
      return original.call(this,name,value);
    };
  },{key:KEY,text:raw});
  await page.goto('/#guide');
  await page.getByRole('button',{name:'处理存档'}).click();
  const imported=createState(708); imported.reactors[0].active=false;
  await page.locator('input[type=file]').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(serialize(imported))});
  await expect(page.getByRole('status')).toContainText('浏览器存储不可用');
  await expect(page.getByRole('alert')).toContainText('当前进度尚未保存');
  const stored=await page.evaluate(key=>({main:localStorage.getItem(key),backups:Object.keys(localStorage).filter(k=>k.startsWith('road-to-118.recovery.')).map(k=>localStorage.getItem(k))}),KEY);
  expect(stored.main).toBe(raw);
  expect(stored.backups).toEqual([raw]);
});
