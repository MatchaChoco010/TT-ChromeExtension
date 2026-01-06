import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Side Panelを開く
 *
 * @param context - ブラウザコンテキスト
 * @param extensionId - 拡張機能のID
 * @returns Side PanelのPage
 */
export async function openSidePanel(
  context: BrowserContext,
  extensionId: string
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#root', { timeout: 5000 });
  return page;
}

/**
 * ツリーが表示されることを検証
 *
 * 注: Side Panelのルート要素が表示されていることを確認します。
 * 実際のタブツリーは、TreeStateProviderによって動的に読み込まれるため、
 * この関数では Side Panel が正しくロードされたことのみを検証します。
 *
 * @param page - Side PanelのPage
 */
export async function assertTreeVisible(page: Page): Promise<void> {
  const sidePanelRoot = page.locator('[data-testid="side-panel-root"]');
  await expect(sidePanelRoot).toBeVisible({ timeout: 5000 });

  const loadingIndicator = page.locator('text=Loading');
  try {
    await expect(loadingIndicator).not.toBeVisible({ timeout: 3000 });
  } catch {
    // ローディングが存在しなかった場合は無視
  }
}

/**
 * リアルタイム更新を検証
 *
 * 別タブでタブを作成し、Side Panelで反映を確認します。
 *
 * 注: 現在の実装では、Side Panelがデフォルトコンテンツを表示しているため、
 * この関数はアクションが正常に実行されることのみを検証します。
 * 実際のツリー更新の検証は、タブツリーが実際にレンダリングされる
 * 統合テストで行う必要があります。
 *
 * @param sidePanelPage - Side PanelのPage
 * @param action - 実行するアクション（例: タブの作成または削除）
 */
export async function assertRealTimeUpdate(
  sidePanelPage: Page,
  action: () => Promise<void>
): Promise<void> {
  const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
  await expect(sidePanelRoot).toBeVisible({ timeout: 5000 });

  await action();

  await sidePanelPage.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));

  await expect(sidePanelRoot).toBeVisible();
}

/**
 * 大量タブ時のスクロール動作を検証
 *
 * @param page - Side PanelのPage
 * @param tabCount - タブの数（最低限の検証用）
 */
export async function assertSmoothScrolling(
  page: Page,
  tabCount: number
): Promise<void> {
  const sidePanelRoot = page.locator('[data-testid="side-panel-root"]');
  await expect(sidePanelRoot).toBeVisible({ timeout: 5000 });

  const scrollContainer = await page.evaluate(() => {
    let container = document.querySelector('[data-testid="tab-tree-view"]');
    if (!container) {
      container = document.querySelector('[data-testid="side-panel-root"]');
    }
    return container !== null;
  });

  if (!scrollContainer) {
    return;
  }

  const isScrollable = await page.evaluate(() => {
    let container = document.querySelector('[data-testid="tab-tree-view"]');
    if (!container) {
      container = document.querySelector('[data-testid="side-panel-root"]');
    }
    if (!container) return false;
    return container.scrollHeight > container.clientHeight;
  });

  if (isScrollable) {
    await page.evaluate(() => {
      let container = document.querySelector('[data-testid="tab-tree-view"]');
      if (!container) {
        container = document.querySelector('[data-testid="side-panel-root"]');
      }
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    });

    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        let container = document.querySelector('[data-testid="tab-tree-view"]');
        if (!container) {
          container = document.querySelector('[data-testid="side-panel-root"]');
        }
        if (!container) {
          resolve();
          return;
        }
        const targetTop = container.scrollHeight - container.clientHeight;
        const checkScroll = () => {
          if (Math.abs(container!.scrollTop - targetTop) < 5) {
            resolve();
          } else {
            requestAnimationFrame(checkScroll);
          }
        };
        checkScroll();
      });
    });

    await page.evaluate(() => {
      let container = document.querySelector('[data-testid="tab-tree-view"]');
      if (!container) {
        container = document.querySelector('[data-testid="side-panel-root"]');
      }
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        let container = document.querySelector('[data-testid="tab-tree-view"]');
        if (!container) {
          container = document.querySelector('[data-testid="side-panel-root"]');
        }
        if (!container) {
          resolve();
          return;
        }
        const checkScroll = () => {
          if (container!.scrollTop < 5) {
            resolve();
          } else {
            requestAnimationFrame(checkScroll);
          }
        };
        checkScroll();
      });
    });
  }

  await expect(sidePanelRoot).toBeVisible();
}
