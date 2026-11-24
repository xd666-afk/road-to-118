import type { Page } from '@playwright/test';

const panels = {
  upgrades: ['升级', '实验控制面板'],
  tasks: ['委托', '试验委托面板'],
  archive: ['周期表', '元素周期表面板'],
  instrument: ['仪器设置', '仪器控制面板'],
  next: ['下一步', '下一步面板'],
  more: ['更多', '更多面板'],
} as const;

export async function openLabPanel(page: Page, panel: keyof typeof panels) {
  const [button, name] = panels[panel];
  if (await page.getByRole('region', { name, exact: true }).isVisible()) return;
  if (panel === 'next' || panel === 'instrument') await closeLabPanel(page);
  await page.getByRole('button', { name: button, exact: true }).click();
}

export async function closeLabPanel(page: Page) {
  const close = page.getByRole('button', { name: '关闭面板', exact: true });
  if (await close.isVisible()) await close.click();
}

export async function enterLabPage(page: Page, name: string) {
  if (await page.locator('.lab-scene').isVisible()) {
    if (name === '实验室') return closeLabPanel(page);
    if (name !== '科研') {
      await openLabPanel(page, 'more');
      return page.getByRole('region', { name: '更多面板' }).getByRole('button', { name, exact: true }).click();
    }
  }
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }).click();
}
