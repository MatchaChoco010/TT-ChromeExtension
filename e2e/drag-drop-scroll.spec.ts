/**
 * ドラッグ＆ドロップ中のスクロール制限テスト
 */
import { test, expect } from './fixtures/extension';
import type { Locator } from '@playwright/test';
import { createTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { startDrag, dropTab } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { waitForCondition } from './utils/polling-utils';
import { setupWindow } from './utils/setup-utils';

/**
 * スクロール位置が変化するまで待機（polling-utilsを使用）
 *
 * @param container - スクロールコンテナのLocator
 * @param initialScrollTop - 初期スクロール位置
 * @param direction - 期待するスクロール方向（'down'または'up'）
 * @param maxWait - 最大待機時間（ミリ秒）
 * @returns 最終スクロール位置
 */
async function waitForScrollChange(
  container: Locator,
  initialScrollTop: number,
  direction: 'down' | 'up',
  maxWait: number = 1000
): Promise<number> {
  let currentScrollTop = initialScrollTop;

  await waitForCondition(
    async () => {
      currentScrollTop = await container.evaluate((el) => el.scrollTop);
      if (direction === 'down') {
        return currentScrollTop > initialScrollTop;
      }
      return currentScrollTop < initialScrollTop;
    },
    { timeout: maxWait, interval: 16, timeoutMessage: `Scroll did not change ${direction} from ${initialScrollTop} within ${maxWait}ms` }
  );

  return currentScrollTop;
}

/**
 * スクロール位置が安定するまで待機（polling-utilsを使用）
 *
 * @param container - スクロールコンテナのLocator
 * @param maxWait - 最大待機時間（ミリ秒）
 * @returns 最終スクロール位置
 */
async function waitForScrollStabilize(
  container: Locator,
  maxWait: number = 500
): Promise<number> {
  let lastScrollTop = await container.evaluate((el) => el.scrollTop);
  let stableCount = 0;

  await waitForCondition(
    async () => {
      const currentScrollTop = await container.evaluate((el) => el.scrollTop);
      if (currentScrollTop === lastScrollTop) {
        stableCount++;
        if (stableCount >= 3) {
          return true;
        }
      } else {
        stableCount = 0;
        lastScrollTop = currentScrollTop;
      }
      return false;
    },
    { timeout: maxWait, interval: 16, timeoutMessage: `Scroll position did not stabilize within ${maxWait}ms` }
  );

  return lastScrollTop;
}

test.describe('ドラッグ＆ドロップ中のスクロール制限', () => {
  test.setTimeout(120000);

  test('ドラッグ中に横スクロールが発生しないことを検証する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tab1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
    ], 0);

    const tab2 = await createTab(serviceWorker, getTestServerUrl('/page2'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    const tab3 = await createTab(serviceWorker, getTestServerUrl('/page3'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
    ], 0);

    const container = sidePanelPage.locator('[data-testid="tab-tree-view"]');
    await expect(container).toBeVisible();

    const initialScrollLeft = await container.evaluate((el) => el.scrollLeft);

    await startDrag(sidePanelPage, tab2);

    const box = await container.boundingBox();
    if (box) {
      await sidePanelPage.mouse.move(box.x + box.width + 100, box.y + box.height / 2, { steps: 1 });
      await waitForScrollStabilize(container);
    }

    const finalScrollLeft = await container.evaluate((el) => el.scrollLeft);
    expect(finalScrollLeft).toBe(initialScrollLeft);

    // マウスをコンテナ内に戻してからドロップ（ドラッグアウトを防ぐ）
    if (box) {
      await sidePanelPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 1 });
    }

    await dropTab(sidePanelPage);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
    ], 0);
  });

  test('ドラッグ中にツリービューが必要以上に縦スクロールしないことを検証する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tab1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
    ], 0);

    const tab2 = await createTab(serviceWorker, getTestServerUrl('/page2'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    const tab3 = await createTab(serviceWorker, getTestServerUrl('/page3'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
    ], 0);

    const container = sidePanelPage.locator('[data-testid="tab-tree-view"]');
    await expect(container).toBeVisible();

    const initialScrollTop = await container.evaluate((el) => el.scrollTop);

    await startDrag(sidePanelPage, tab2);

    const box = await container.boundingBox();
    if (box) {
      await sidePanelPage.mouse.move(box.x + box.width / 2, box.y + box.height + 200, { steps: 1 });
      await waitForScrollStabilize(container);
    }

    const finalScrollTop = await container.evaluate((el) => el.scrollTop);

    const { scrollHeight, clientHeight } = await container.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    if (scrollHeight <= clientHeight) {
      expect(finalScrollTop).toBe(initialScrollTop);
    } else {
      const maxScroll = scrollHeight - clientHeight;
      expect(finalScrollTop).toBeLessThanOrEqual(maxScroll);
    }

    // マウスをコンテナ内に戻してからドロップ（ドラッグアウトを防ぐ）
    if (box) {
      await sidePanelPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 1 });
    }

    await dropTab(sidePanelPage);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
    ], 0);
  });

  test('コンテンツがビューポートを超えている場合のみスクロールが許可されることを検証する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabs: number[] = [];
    for (let i = 1; i <= 12; i++) {
      const tab = await createTab(serviceWorker, getTestServerUrl(`/page${i}`));
      tabs.push(tab);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        ...tabs.map(t => ({ tabId: t, depth: 0 })),
      ], 0);
    }

    const container = sidePanelPage.locator('[data-testid="tab-tree-view"]');
    await expect(container).toBeVisible();

    const { scrollHeight, clientHeight } = await container.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    if (scrollHeight > clientHeight) {
      const maxScroll = scrollHeight - clientHeight;

      const initialScrollTop = await container.evaluate((el) => el.scrollTop);

      await startDrag(sidePanelPage, tabs[0]);

      const box = await container.boundingBox();
      if (box) {
        await sidePanelPage.mouse.move(box.x + box.width / 2, box.y + box.height + 100, { steps: 1 });
        await waitForScrollChange(container, initialScrollTop, 'down');
      }

      const scrolledTop = await container.evaluate((el) => el.scrollTop);

      expect(scrolledTop).toBeLessThanOrEqual(maxScroll);
      expect(scrolledTop).toBeGreaterThanOrEqual(0);

      await dropTab(sidePanelPage);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        ...tabs.map(t => ({ tabId: t, depth: 0 })),
      ], 0);
    } else {
      test.info().annotations.push({
        type: 'limitation',
        description: 'Content does not exceed viewport. Skipping scroll test.',
      });
    }
  });

  test('ドラッグ中のスクロール加速度が制限されていることを検証する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabs: number[] = [];
    for (let i = 1; i <= 8; i++) {
      const tab = await createTab(serviceWorker, getTestServerUrl(`/page${i}`));
      tabs.push(tab);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        ...tabs.map(t => ({ tabId: t, depth: 0 })),
      ], 0);
    }

    const container = sidePanelPage.locator('[data-testid="tab-tree-view"]');
    await expect(container).toBeVisible();

    const { scrollHeight, clientHeight } = await container.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    if (scrollHeight > clientHeight) {
      await startDrag(sidePanelPage, tabs[0]);

      const scrollPositions: number[] = [];
      const box = await container.boundingBox();

      if (box) {
        for (let i = 0; i < 5; i++) {
          await sidePanelPage.mouse.move(
            box.x + box.width / 2,
            box.y + box.height + (i * 20),
            { steps: 2 }
          );
          await sidePanelPage.evaluate(() =>
            new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          );
          const scrollTop = await container.evaluate((el) => el.scrollTop);
          scrollPositions.push(scrollTop);
        }
      }

      for (let i = 1; i < scrollPositions.length; i++) {
        const diff = scrollPositions[i] - scrollPositions[i - 1];
        expect(diff).toBeLessThan(200);
      }

      await dropTab(sidePanelPage);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        ...tabs.map(t => ({ tabId: t, depth: 0 })),
      ], 0);
    } else {
      test.info().annotations.push({
        type: 'limitation',
        description: 'Content does not exceed viewport. Skipping acceleration test.',
      });
    }
  });
});
