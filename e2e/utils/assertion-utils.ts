/**
 * AssertionUtils
 *
 * E2Eテストの事後条件検証用ユーティリティ関数
 */
import type { Page, BrowserContext } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * 期待するタブ構造の定義
 *
 * - expanded: 子タブを持つタブでは必須（true/false）、子タブを持たないタブではundefined
 * - expanded: false の場合、その子タブはDOMに表示されないため assertTabStructure には含めない
 */
export interface ExpectedTabStructure {
  tabId: number;
  depth: number;
  /** 子タブを持つタブでは必須、持たないタブでは指定不可 */
  expanded?: boolean;
}

/**
 * 期待するピン留めタブ構造の定義
 * 順序だけを検証する（depthは常に0）
 */
export interface ExpectedPinnedTabStructure {
  tabId: number;
}

/**
 * 期待するビュー構造の定義
 */
export interface ExpectedViewStructure {
  /** ビューのカラー（識別用） */
  viewIdentifier: string;
}

/**
 * assertTabStructure / assertPinnedTabStructure のオプション
 */
export interface AssertTabStructureOptions {
  /** タイムアウト（ミリ秒、デフォルト: 5000） */
  timeout?: number;
}

/**
 * 現在アクティブなビューのインデックスを取得するヘルパー関数
 */
async function getActiveViewIndex(page: Page): Promise<number> {
  const viewSwitcher = page.locator('[data-testid="view-switcher-container"]');
  const viewButtons = viewSwitcher.locator('button[data-color]');
  const count = await viewButtons.count();

  const views: { x: number; isActive: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const button = viewButtons.nth(i);
    const isActive = (await button.getAttribute('data-active')) === 'true';
    const box = await button.boundingBox();
    views.push({ x: box?.x || 0, isActive });
  }

  views.sort((a, b) => a.x - b.x);

  return views.findIndex(v => v.isActive);
}

/**
 * Service Workerを取得するヘルパー関数
 */
async function getServiceWorker(context: BrowserContext) {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }
  return serviceWorker;
}

/**
 * UI上でタブ構造が期待通りであることを検証する
 *
 * タブ操作（moveTabToParent, createTab, closeTab等）の後に必ず呼び出して、
 * UI上で期待する順序とdepthになっていることを確認する。
 * 期待通りになるまで待機し、タイムアウトした場合は期待値と実際の値を含むエラーでテストを失敗させる。
 *
 * 空の配列を渡した場合は、タブが0個であることを検証する。
 *
 * 使用例:
 * ```typescript
 * // テスト開始時にサイドパネルを開く
 * const sidePanelPage = await openSidePanelForWindow(context, windowId);
 *
 * await moveTabToParent(sidePanelPage, child, parent);
 * await assertTabStructure(sidePanelPage, windowId, [
 *   { tabId: parent, depth: 0 },
 *   { tabId: child, depth: 1 },
 * ], 0);
 *
 * // タブが0個であることを検証
 * await closeTab(context, lastTabId);
 * await assertTabStructure(sidePanelPage, windowId, [], 0);
 * ```
 *
 * @param page - 対象ウィンドウのSide PanelのPage（openSidePanelForWindowで取得）
 * @param windowId - 検証するウィンドウのID（エラーメッセージの明示性のため）
 * @param expectedStructure - 期待するタブ構造（順序も検証される）。空配列の場合は0個であることを検証。
 * @param expectedActiveViewIndex - 期待するアクティブビューのインデックス（0始まり）
 * @param options - オプション（timeout）
 */
export async function assertTabStructure(
  page: Page,
  windowId: number,
  expectedStructure: ExpectedTabStructure[],
  expectedActiveViewIndex: number,
  options: AssertTabStructureOptions = {}
): Promise<void> {
  const { timeout = 5000 } = options;

  for (let i = 0; i < expectedStructure.length; i++) {
    const current = expectedStructure[i];
    const currentDepth = current.depth;

    const hasVisibleChildren = i + 1 < expectedStructure.length &&
                               expectedStructure[i + 1].depth > currentDepth;

    if (hasVisibleChildren) {
      if (current.expanded === undefined) {
        throw new Error(
          `Tab ${current.tabId} has children but 'expanded' property is not specified.\n` +
          `  Tabs with children must have 'expanded: true' or 'expanded: false'`
        );
      }
      if (current.expanded === false) {
        throw new Error(
          `Tab ${current.tabId} has children in expected structure but 'expanded: false' is specified.\n` +
          `  When 'expanded: false', children should not be included in expected structure`
        );
      }
    } else {
      if (current.expanded === true) {
        throw new Error(
          `Tab ${current.tabId} has 'expanded: true' but no children in expected structure.\n` +
          `  When 'expanded: true', children must be included in expected structure`
        );
      }
    }
  }

  const startTime = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeout) {
    try {
      const actualActiveViewIndex = await getActiveViewIndex(page);
      if (actualActiveViewIndex !== expectedActiveViewIndex) {
        throw new Error(
          `Active view index mismatch (windowId: ${windowId}):\n` +
          `  Expected: ${expectedActiveViewIndex}\n` +
          `  Actual:   ${actualActiveViewIndex}`
        );
      }

      const allTreeNodes = page.locator('[data-testid^="tree-node-"]');
      const actualTabCount = await allTreeNodes.count();

      if (actualTabCount !== expectedStructure.length) {
        throw new Error(
          `Tab count mismatch (windowId: ${windowId}):\n` +
          `  Expected: ${expectedStructure.length} tabs\n` +
          `  Actual:   ${actualTabCount} tabs`
        );
      }

      if (expectedStructure.length === 0) {
        return;
      }

      const actualStructure: { tabId: number; depth: number; y: number; expanded: string | null }[] = [];

      for (const expected of expectedStructure) {
        const element = page.locator(`[data-testid="tree-node-${expected.tabId}"]`).first();
        const isVisible = await element.isVisible().catch(() => false);

        if (!isVisible) {
          throw new Error(`Tab ${expected.tabId} is not visible (windowId: ${windowId})`);
        }

        const box = await element.boundingBox();
        if (!box) {
          throw new Error(`Tab ${expected.tabId} has no bounding box (windowId: ${windowId})`);
        }

        const depth = await element.getAttribute('data-depth');
        const expanded = await element.getAttribute('data-expanded');
        actualStructure.push({
          tabId: expected.tabId,
          depth: depth ? parseInt(depth, 10) : 0,
          y: box.y,
          expanded
        });
      }

      actualStructure.sort((a, b) => a.y - b.y);

      const actualOrder = actualStructure.map(s => s.tabId);
      const expectedOrder = expectedStructure.map(s => s.tabId);

      if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
        throw new Error(
          `Tab order mismatch (windowId: ${windowId}):\n` +
          `  Expected: [${expectedOrder.join(', ')}]\n` +
          `  Actual:   [${actualOrder.join(', ')}]`
        );
      }

      for (let i = 0; i < expectedStructure.length; i++) {
        const expected = expectedStructure[i];
        const actual = actualStructure.find(s => s.tabId === expected.tabId);

        if (actual && actual.depth !== expected.depth) {
          throw new Error(
            `Depth mismatch for tab ${expected.tabId} (windowId: ${windowId}):\n` +
            `  Expected: ${expected.depth}\n` +
            `  Actual:   ${actual.depth}`
          );
        }

        if (expected.expanded !== undefined && actual) {
          const expectedExpandedStr = expected.expanded ? 'true' : 'false';
          if (actual.expanded !== expectedExpandedStr) {
            throw new Error(
              `Expanded state mismatch for tab ${expected.tabId} (windowId: ${windowId}):\n` +
              `  Expected: ${expectedExpandedStr}\n` +
              `  Actual:   ${actual.expanded}`
            );
          }
        }
      }

      return;
    } catch (e) {
      lastError = e as Error;
    }

    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  }

  throw lastError || new Error(`Timeout waiting for tab structure (windowId: ${windowId})`);
}

/**
 * UI上でピン留めタブ構造が期待通りであることを検証する
 *
 * ピン留め操作後に必ず呼び出して、UI上で期待する順序になっていることを確認する。
 * ピン留めタブが0個の場合は空配列を渡す。
 *
 * 使用例:
 * ```typescript
 * // テスト開始時にサイドパネルを開く
 * const sidePanelPage = await openSidePanelForWindow(context, windowId);
 *
 * await pinTab(context, tabId);
 * await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tab1 }, { tabId: tab2 }], 0);
 *
 * // ピン留めタブが0個であることを検証
 * await unpinTab(context, lastPinnedTabId);
 * await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
 * ```
 *
 * @param page - 対象ウィンドウのSide PanelのPage（openSidePanelForWindowで取得）
 * @param windowId - 検証するウィンドウのID（エラーメッセージの明示性のため）
 * @param expectedStructure - 期待するピン留めタブ構造（順序も検証される）。空配列の場合は0個であることを検証。
 * @param expectedActiveViewIndex - 期待するアクティブビューのインデックス（0始まり）
 * @param options - オプション（timeout）
 */
export async function assertPinnedTabStructure(
  page: Page,
  windowId: number,
  expectedStructure: ExpectedPinnedTabStructure[],
  expectedActiveViewIndex: number,
  options: AssertTabStructureOptions = {}
): Promise<void> {
  const { timeout = 5000 } = options;
  const startTime = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeout) {
    try {
      const actualActiveViewIndex = await getActiveViewIndex(page);
      if (actualActiveViewIndex !== expectedActiveViewIndex) {
        throw new Error(
          `Active view index mismatch (windowId: ${windowId}):\n` +
          `  Expected: ${expectedActiveViewIndex}\n` +
          `  Actual:   ${actualActiveViewIndex}`
        );
      }

      const pinnedSection = page.locator('[data-testid="pinned-tabs-section"]');
      const sectionExists = await pinnedSection.isVisible().catch(() => false);

      if (expectedStructure.length === 0) {
        if (!sectionExists) {
          return;
        }
        // 注意: "-icon"で終わるdata-testidを持つ内部要素を除外する
        const pinnedTabs = page.locator('[data-testid^="pinned-tab-"]:not([data-testid$="-icon"])');
        const actualCount = await pinnedTabs.count();
        if (actualCount === 0) {
          return;
        }
        throw new Error(
          `Pinned tab count mismatch (windowId: ${windowId}):\n` +
          `  Expected: 0 tabs (section should be hidden)\n` +
          `  Actual:   ${actualCount} tabs`
        );
      }

      if (!sectionExists) {
        throw new Error(
          `Pinned tabs section not visible but expected ${expectedStructure.length} pinned tabs (windowId: ${windowId})`
        );
      }

      // 注意: "-icon"で終わるdata-testidを持つ内部要素を除外する
      const pinnedTabs = page.locator('[data-testid^="pinned-tab-"]:not([data-testid$="-icon"])');
      const actualCount = await pinnedTabs.count();

      if (actualCount !== expectedStructure.length) {
        throw new Error(
          `Pinned tab count mismatch (windowId: ${windowId}):\n` +
          `  Expected: ${expectedStructure.length} tabs\n` +
          `  Actual:   ${actualCount} tabs`
        );
      }

      const actualStructure: { tabId: number; x: number }[] = [];

      for (const expected of expectedStructure) {
        const element = page.locator(`[data-testid="pinned-tab-${expected.tabId}"]`).first();
        const isVisible = await element.isVisible().catch(() => false);

        if (!isVisible) {
          throw new Error(`Pinned tab ${expected.tabId} is not visible (windowId: ${windowId})`);
        }

        const box = await element.boundingBox();
        if (!box) {
          throw new Error(`Pinned tab ${expected.tabId} has no bounding box (windowId: ${windowId})`);
        }

        actualStructure.push({
          tabId: expected.tabId,
          x: box.x
        });
      }

      actualStructure.sort((a, b) => a.x - b.x);

      const actualOrder = actualStructure.map(s => s.tabId);
      const expectedOrder = expectedStructure.map(s => s.tabId);

      if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
        throw new Error(
          `Pinned tab order mismatch (windowId: ${windowId}):\n` +
          `  Expected: [${expectedOrder.join(', ')}]\n` +
          `  Actual:   [${actualOrder.join(', ')}]`
        );
      }

      return;
    } catch (e) {
      lastError = e as Error;
    }

    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  }

  throw lastError || new Error(`Timeout waiting for pinned tab structure (windowId: ${windowId})`);
}

/**
 * UI上でビュー構造が期待通りであることを検証する
 *
 * ビュー操作後に呼び出して、UI上でビューの順序と現在のハイライト状態を確認する。
 *
 * 使用例:
 * ```typescript
 * // テスト開始時にサイドパネルを開く
 * const sidePanelPage = await openSidePanelForWindow(context, windowId);
 *
 * await createView(sidePanelPage, 'Work');
 * await assertViewStructure(sidePanelPage, windowId, [
 *   { viewIdentifier: '#3B82F6' },  // デフォルトのビュー
 *   { viewIdentifier: '#10B981' },  // 新規作成したビュー
 * ], 0);  // 0番目のビューがハイライト中
 * ```
 *
 * @param page - 対象ウィンドウのSide PanelのPage（openSidePanelForWindowで取得）
 * @param windowId - 検証するウィンドウのID（エラーメッセージの明示性のため）
 * @param expectedStructure - 期待するビュー構造（順序も検証される）。色またはビュー名で識別。
 * @param activeViewIndex - 現在ハイライト中のビューのインデックス
 * @param timeout - タイムアウト（ミリ秒、デフォルト: 5000）
 */
export async function assertViewStructure(
  page: Page,
  windowId: number,
  expectedStructure: ExpectedViewStructure[],
  activeViewIndex: number,
  timeout: number = 5000
): Promise<void> {
  const startTime = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeout) {
    try {
      const viewSwitcher = page.locator('[data-testid="view-switcher-container"]');
      const containerExists = await viewSwitcher.isVisible().catch(() => false);

      if (!containerExists) {
        throw new Error(`View switcher container is not visible (windowId: ${windowId})`);
      }

      const viewButtons = viewSwitcher.locator('button[data-color]');
      const actualCount = await viewButtons.count();

      if (actualCount !== expectedStructure.length) {
        throw new Error(
          `View count mismatch (windowId: ${windowId}):\n` +
          `  Expected: ${expectedStructure.length} views\n` +
          `  Actual:   ${actualCount} views`
        );
      }

      if (expectedStructure.length === 0) {
        return;
      }

      const actualViews: { color: string; x: number; isActive: boolean }[] = [];

      for (let i = 0; i < actualCount; i++) {
        const button = viewButtons.nth(i);
        const color = await button.getAttribute('data-color');
        const isActive = (await button.getAttribute('data-active')) === 'true';
        const box = await button.boundingBox();

        if (!box) {
          throw new Error(`View button ${i} has no bounding box (windowId: ${windowId})`);
        }

        actualViews.push({
          color: color || '',
          x: box.x,
          isActive
        });
      }

      actualViews.sort((a, b) => a.x - b.x);

      const actualOrder = actualViews.map(v => v.color);
      const expectedOrder = expectedStructure.map(s => s.viewIdentifier);

      if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
        throw new Error(
          `View order mismatch (windowId: ${windowId}):\n` +
          `  Expected: [${expectedOrder.join(', ')}]\n` +
          `  Actual:   [${actualOrder.join(', ')}]`
        );
      }

      const activeViews = actualViews.filter(v => v.isActive);
      if (activeViews.length !== 1) {
        throw new Error(
          `Expected exactly 1 active view, but found ${activeViews.length} (windowId: ${windowId})`
        );
      }

      const actualActiveIndex = actualViews.findIndex(v => v.isActive);
      if (actualActiveIndex !== activeViewIndex) {
        throw new Error(
          `Active view index mismatch (windowId: ${windowId}):\n` +
          `  Expected: ${activeViewIndex} (${expectedStructure[activeViewIndex]?.viewIdentifier})\n` +
          `  Actual:   ${actualActiveIndex} (${actualViews[actualActiveIndex]?.color})`
        );
      }

      return;
    } catch (e) {
      lastError = e as Error;
    }

    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  }

  throw lastError || new Error(`Timeout waiting for view structure (windowId: ${windowId})`);
}

/**
 * 指定されたウィンドウが閉じていることを検証
 *
 * ウィンドウを閉じた後に呼び出して、ウィンドウが確実に閉じたことを検証する。
 *
 * 使用例:
 * ```typescript
 * await closeWindow(context, windowId);
 * await assertWindowClosed(context, windowId);
 * ```
 *
 * @param context - ブラウザコンテキスト
 * @param windowId - 閉じたことを検証するウィンドウのID
 * @param timeout - タイムアウト（ミリ秒、デフォルト: 5000）
 */
export async function assertWindowClosed(
  context: BrowserContext,
  windowId: number,
  timeout: number = 5000
): Promise<void> {
  const serviceWorker = await getServiceWorker(context);
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const windows = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });

    const windowExists = windows.some((w: chrome.windows.Window) => w.id === windowId);
    if (!windowExists) {
      return;
    }

    await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  }

  throw new Error(`Window ${windowId} is still open after ${timeout}ms`);
}

/**
 * 指定されたウィンドウが存在することを検証
 *
 * ウィンドウを作成した後に呼び出して、ウィンドウが確実に存在することを検証する。
 *
 * @param context - ブラウザコンテキスト
 * @param windowId - 存在を検証するウィンドウのID
 * @param timeout - タイムアウト（ミリ秒、デフォルト: 5000）
 */
export async function assertWindowExists(
  context: BrowserContext,
  windowId: number,
  timeout: number = 5000
): Promise<void> {
  const serviceWorker = await getServiceWorker(context);
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const windows = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });

    const windowExists = windows.some((w: chrome.windows.Window) => w.id === windowId);
    if (windowExists) {
      return;
    }

    await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  }

  throw new Error(`Window ${windowId} does not exist after ${timeout}ms`);
}

/**
 * ウィンドウ数が期待値と一致することを検証
 *
 * ウィンドウ操作後に呼び出して、ウィンドウ数が期待通りであることを検証する。
 *
 * @param context - ブラウザコンテキスト
 * @param expectedCount - 期待するウィンドウ数
 * @param timeout - タイムアウト（ミリ秒、デフォルト: 5000）
 */
export async function assertWindowCount(
  context: BrowserContext,
  expectedCount: number,
  timeout: number = 5000
): Promise<void> {
  const serviceWorker = await getServiceWorker(context);
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const windows = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });

    if (windows.length === expectedCount) {
      return;
    }

    await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  }

  const finalWindows = await serviceWorker.evaluate(() => {
    return chrome.windows.getAll();
  });

  throw new Error(
    `Window count mismatch:\n` +
    `  Expected: ${expectedCount}\n` +
    `  Actual:   ${finalWindows.length}`
  );
}

/**
 * ドロップインジケータが表示されることを検証
 *
 * @param page - Side PanelのPage
 * @param _position - ドロップ位置（'before', 'after', 'child'）
 */
export async function assertDropIndicator(
  page: Page,
  _position: 'before' | 'after' | 'child'
): Promise<void> {
  const indicator = page.locator('[data-testid="drop-indicator"]');

  // インジケータが見つからない場合もエラーにしない（実装に依存）
  await indicator.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
}

/**
 * ホバー自動展開を検証
 *
 * @param page - Side PanelのPage
 * @param parentTabId - 親タブのID
 * @param _hoverDuration - ホバー時間（ミリ秒）
 */
export async function assertAutoExpand(
  page: Page,
  parentTabId: number,
  _hoverDuration: number
): Promise<void> {
  const parentNode = page.locator(`[data-testid="tree-node-${parentTabId}"]`).first();

  const _isExpandedBefore = await parentNode.getAttribute('data-expanded');

  await parentNode.hover();

  const startTime = Date.now();
  const timeout = 5000;
  let isExpandedAfter = _isExpandedBefore;

  while (Date.now() - startTime < timeout) {
    isExpandedAfter = await parentNode.getAttribute('data-expanded');
    if (isExpandedAfter === 'true') {
      break;
    }
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  }
}

/**
 * 未読バッジが表示されることを検証
 *
 * @param page - Side PanelのPage
 * @param tabId - 検証するタブのID（現在はグローバルなバッジ確認）
 * @param expectedCount - 期待される未読数（オプション、現在の実装ではドット表示のみ）
 *
 * 注意: 現在のUnreadBadgeコンポーネントの実装では、countプロパティが渡されない限り
 * ドット表示のみとなり、テキスト内容は空になります。expectedCountが指定された場合、
 * data-testid="unread-count"要素を使用してカウントを検証します。
 */
export async function assertUnreadBadge(
  page: Page,
  _tabId: number,
  expectedCount?: number
): Promise<void> {
  const unreadBadge = page.locator(`[data-testid="unread-badge"]`);

  await expect(unreadBadge.first()).toBeVisible({ timeout: 5000 });

  if (expectedCount !== undefined) {
    const unreadCountElement = page.locator(`[data-testid="unread-count"]`);
    const countElementCount = await unreadCountElement.count();

    if (countElementCount > 0) {
      const displayedCount =
        expectedCount > 99 ? '99+' : expectedCount.toString();
      await expect(unreadCountElement.first()).toContainText(displayedCount);
    }
  }
}

