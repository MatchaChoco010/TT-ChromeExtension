import { test, expect } from './fixtures/extension';
import { createTab, closeTab, pinTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure, assertPinnedTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('ピン留めタブの並び替え', () => {
  test.setTimeout(120000);

  test.describe('ドラッグ＆ドロップによる並び替え', () => {
    test('ピン留めタブをドラッグ＆ドロップで並び替えできる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }], 0);

      await pinTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      await pinTab(serviceWorker, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      const pinnedTab3 = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId3}"]`);
      const pinnedTab1 = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId1}"]`);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tab3Box = await pinnedTab3.boundingBox();
      const tab1Box = await pinnedTab1.boundingBox();

      if (tab3Box && tab1Box) {
        const startX = tab3Box.x + tab3Box.width / 2;
        const startY = tab3Box.y + tab3Box.height / 2;

        const endX = tab1Box.x + tab1Box.width * 0.2;
        const endY = tab1Box.y + tab1Box.height / 2;

        await sidePanelPage.mouse.move(startX, startY);
        await sidePanelPage.mouse.down();
        await sidePanelPage.mouse.move(startX + 10, startY, { steps: 2 });
        await sidePanelPage.mouse.move(endX, endY, { steps: 1 });
        await sidePanelPage.mouse.up();
      }

      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }, { tabId: tabId1 }, { tabId: tabId2 }], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }, { tabId: tabId2 }], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }], 0);

      await closeTab(serviceWorker, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('ピン留めタブが2行以上に折り返された状態でもドラッグ＆ドロップで並び替えできる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // 1行あたり4個で2行目に折り返される幅に設定（p-2: 16px + 4*28px + 3*4px = 140px）
      await sidePanelPage.setViewportSize({ width: 150, height: 600 });

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabIds: number[] = [];
      for (let i = 1; i <= 6; i++) {
        const tabId = await createTab(serviceWorker, getTestServerUrl(`/multi-pin-${i}`));
        tabIds.push(tabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          ...tabIds.map((id) => ({ tabId: id, depth: 0 })),
        ], 0);
        await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
      }

      const [tab1, tab2, tab3, tab4, tab5, tab6] = tabIds;

      const pinnedSoFar: number[] = [];
      const unpinnedRemaining = [...tabIds];
      for (const tabId of tabIds) {
        await pinTab(serviceWorker, tabId);
        pinnedSoFar.push(tabId);
        unpinnedRemaining.shift();
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          ...unpinnedRemaining.map((id) => ({ tabId: id, depth: 0 })),
        ], 0);
        await assertPinnedTabStructure(
          sidePanelPage,
          windowId,
          pinnedSoFar.map((id) => ({ tabId: id })),
          0
        );
      }

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 2行に折り返されていることを確認（1行目: tab1..tab4, 2行目: tab5, tab6）
      const row1Tab1Box = await sidePanelPage.locator(`[data-testid="pinned-tab-${tab1}"]`).boundingBox();
      const row1Tab4Box = await sidePanelPage.locator(`[data-testid="pinned-tab-${tab4}"]`).boundingBox();
      const row2Tab5Box = await sidePanelPage.locator(`[data-testid="pinned-tab-${tab5}"]`).boundingBox();
      const row2Tab6Box = await sidePanelPage.locator(`[data-testid="pinned-tab-${tab6}"]`).boundingBox();

      expect(row1Tab1Box).not.toBeNull();
      expect(row1Tab4Box).not.toBeNull();
      expect(row2Tab5Box).not.toBeNull();
      expect(row2Tab6Box).not.toBeNull();

      expect(Math.abs(row1Tab1Box!.y - row1Tab4Box!.y)).toBeLessThan(2);
      expect(row2Tab5Box!.y).toBeGreaterThan(row1Tab1Box!.y + row1Tab1Box!.height - 1);
      expect(Math.abs(row2Tab5Box!.y - row2Tab6Box!.y)).toBeLessThan(2);

      // 1. 1行目のtab1を2行目のtab6の左半分（tab5とtab6の間）へドラッグ＆ドロップ
      await sidePanelPage.mouse.move(
        row1Tab1Box!.x + row1Tab1Box!.width / 2,
        row1Tab1Box!.y + row1Tab1Box!.height / 2
      );
      await sidePanelPage.mouse.down();
      await sidePanelPage.mouse.move(
        row2Tab6Box!.x + row2Tab6Box!.width * 0.25,
        row2Tab6Box!.y + row2Tab6Box!.height / 2,
        { steps: 5 }
      );

      // インジケーターが2行目の高さ・位置に表示されていることを確認（トランジション完了後）
      const indicator = sidePanelPage.locator('[data-testid="horizontal-drop-indicator"]');
      await expect(indicator).toBeVisible();
      await expect(async () => {
        const indicatorBox = await indicator.boundingBox();
        expect(indicatorBox).not.toBeNull();
        expect(Math.abs(indicatorBox!.y - row2Tab5Box!.y)).toBeLessThan(2);
        expect(Math.abs(indicatorBox!.height - row2Tab5Box!.height)).toBeLessThan(2);
      }).toPass({ timeout: 2000 });

      await sidePanelPage.mouse.up();

      // 期待順序: [tab2, tab3, tab4, tab5, tab1, tab6]
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [
        { tabId: tab2 },
        { tabId: tab3 },
        { tabId: tab4 },
        { tabId: tab5 },
        { tabId: tab1 },
        { tabId: tab6 },
      ], 0);

      // 2. 2行目が短い状態で、1行目のtab2を1行目末尾（tab5の右半分）へドラッグ＆ドロップ
      const tab2Box = await sidePanelPage.locator(`[data-testid="pinned-tab-${tab2}"]`).boundingBox();
      const tab5Box = await sidePanelPage.locator(`[data-testid="pinned-tab-${tab5}"]`).boundingBox();
      expect(tab2Box).not.toBeNull();
      expect(tab5Box).not.toBeNull();

      await sidePanelPage.mouse.move(tab2Box!.x + tab2Box!.width / 2, tab2Box!.y + tab2Box!.height / 2);
      await sidePanelPage.mouse.down();
      await sidePanelPage.mouse.move(tab5Box!.x + tab5Box!.width * 0.8, tab5Box!.y + tab5Box!.height / 2, { steps: 5 });
      await sidePanelPage.mouse.up();

      // 期待順序: [tab3, tab4, tab5, tab2, tab1, tab6]
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [
        { tabId: tab3 },
        { tabId: tab4 },
        { tabId: tab5 },
        { tabId: tab2 },
        { tabId: tab1 },
        { tabId: tab6 },
      ], 0);

      // 3. 2行目先頭のtab1を真上の1行目先頭（tab3）へ垂直ドラッグ（X移動なし）で移動
      const tab1Box = await sidePanelPage.locator(`[data-testid="pinned-tab-${tab1}"]`).boundingBox();
      const tab3Box = await sidePanelPage.locator(`[data-testid="pinned-tab-${tab3}"]`).boundingBox();
      expect(tab1Box).not.toBeNull();
      expect(tab3Box).not.toBeNull();

      const verticalDragX = tab1Box!.x + tab1Box!.width * 0.25;
      await sidePanelPage.mouse.move(verticalDragX, tab1Box!.y + tab1Box!.height / 2);
      await sidePanelPage.mouse.down();
      await sidePanelPage.mouse.move(verticalDragX, tab3Box!.y + tab3Box!.height / 2, { steps: 5 });
      await sidePanelPage.mouse.up();

      // 期待順序: [tab1, tab3, tab4, tab5, tab2, tab6]
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [
        { tabId: tab1 },
        { tabId: tab3 },
        { tabId: tab4 },
        { tabId: tab5 },
        { tabId: tab2 },
        { tabId: tab6 },
      ], 0);

      // 4. 2行目内での並び替え（tab2をtab6の右半分へドラッグ＆ドロップ）
      const row2FirstBox = await sidePanelPage.locator(`[data-testid="pinned-tab-${tab2}"]`).boundingBox();
      const row2SecondBox = await sidePanelPage.locator(`[data-testid="pinned-tab-${tab6}"]`).boundingBox();
      expect(row2FirstBox).not.toBeNull();
      expect(row2SecondBox).not.toBeNull();

      await sidePanelPage.mouse.move(
        row2FirstBox!.x + row2FirstBox!.width / 2,
        row2FirstBox!.y + row2FirstBox!.height / 2
      );
      await sidePanelPage.mouse.down();
      await sidePanelPage.mouse.move(
        row2SecondBox!.x + row2SecondBox!.width * 0.8,
        row2SecondBox!.y + row2SecondBox!.height / 2,
        { steps: 5 }
      );
      await sidePanelPage.mouse.up();

      // 期待順序: [tab1, tab3, tab4, tab5, tab6, tab2]
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [
        { tabId: tab1 },
        { tabId: tab3 },
        { tabId: tab4 },
        { tabId: tab5 },
        { tabId: tab6 },
        { tabId: tab2 },
      ], 0);

      const closingOrder = [tab1, tab3, tab4, tab5, tab6, tab2];
      while (closingOrder.length > 0) {
        const closingTabId = closingOrder.shift()!;
        await closeTab(serviceWorker, closingTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
        ], 0);
        await assertPinnedTabStructure(
          sidePanelPage,
          windowId,
          closingOrder.map((id) => ({ tabId: id })),
          0
        );
      }
    });
  });

  test.describe('ブラウザとの同期', () => {
    test('Chrome APIでピン留めタブを移動してもTreeStateの順序が維持される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      // TreeStateがSingle Source of Truth: Chrome APIでの移動はTreeStateに反映されず、
      // TreeStateの順序がChromeに再同期される
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/first'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/second'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }], 0);

      await pinTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 0 });
      }, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('包括的な順序同期テスト', () => {
    test('Chrome APIでピン留めタブを移動してもTreeStateの順序が維持される（3つ以上のタブ）', async ({
      extensionContext,
      serviceWorker,
    }) => {
      // TreeStateがSingle Source of Truth: Chrome APIでの移動はTreeStateに反映されない
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/tab1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/tab2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/tab3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }], 0);

      await pinTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      await pinTab(serviceWorker, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 2 });
      }, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 0 });
      }, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 1 });
      }, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }, { tabId: tabId3 }], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }], 0);

      await closeTab(serviceWorker, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('ドロップ制限', () => {
    test('ピン留めタブを通常タブセクションにドロップしても通常タブにならない', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const pinnedTabId = await createTab(serviceWorker, getTestServerUrl('/pinned'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pinnedTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const normalTabId = await createTab(serviceWorker, getTestServerUrl('/normal'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pinnedTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(serviceWorker, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId}"]`);
      const normalTabNode = sidePanelPage.locator(`[data-testid="tree-node-${normalTabId}"]`).first();

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const pinnedBox = await pinnedTab.boundingBox();
      const normalBox = await normalTabNode.boundingBox();

      if (pinnedBox && normalBox) {
        const startX = pinnedBox.x + pinnedBox.width / 2;
        const startY = pinnedBox.y + pinnedBox.height / 2;
        const endX = normalBox.x + normalBox.width / 2;
        const endY = normalBox.y + normalBox.height / 2;

        await sidePanelPage.mouse.move(startX, startY);
        await sidePanelPage.mouse.down();
        await sidePanelPage.mouse.move(startX + 10, startY, { steps: 2 });
        await sidePanelPage.mouse.move(endX, endY, { steps: 1 });
        await sidePanelPage.mouse.up();
      }

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      await closeTab(serviceWorker, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await closeTab(serviceWorker, normalTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('ドラッグ可能性の確認', () => {
    test('ピン留めタブがソート可能として設定されている', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);

      const sortableAttr = await pinnedTab.getAttribute('data-sortable');
      expect(sortableAttr).toBe('true');

      const pinnedIdAttr = await pinnedTab.getAttribute('data-pinned-id');
      expect(pinnedIdAttr).toBe(`pinned-${tabId}`);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });
});
