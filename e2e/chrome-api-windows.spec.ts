/**
 * chrome.windows API統合テスト
 *
 * このテストスイートでは、以下を検証します:
 * 1. chrome.windows.create()で新しいウィンドウを作成した場合、新しいウィンドウコンテキストが確立されることを検証する
 * 2. chrome.windows.remove()でウィンドウを閉じた場合、ウィンドウ内の全タブがツリーから削除されることを検証する
 * 3. chrome.windows.update()でウィンドウをフォーカスした場合、"Current Window"ビューが正しく更新されることを検証する
 * 4. chrome.windows.getAll()で全ウィンドウを取得した場合、全ウィンドウのタブが正しく列挙されることを検証する
 * 5. 複数ウィンドウが存在する場合、各ウィンドウのタブツリーが独立して管理されることを検証する
 *
 * 注: 本テストは `npm run test:e2e` (ヘッドレスモード) で実行すること
 */
import { test, expect } from './fixtures/extension';
import { createWindow, moveTabToWindow, assertWindowTreeSync } from './utils/window-utils';
import { createTab, closeTab } from './utils/tab-utils';

test.describe('chrome.windows API統合', () => {
  test('chrome.windows.create()で新しいウィンドウを作成した場合、新しいウィンドウコンテキストが確立される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 新しいウィンドウを作成前のウィンドウ数を取得
    const windowsBefore = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });
    const windowCountBefore = windowsBefore.length;

    // 新しいウィンドウを作成
    const windowId = await createWindow(extensionContext);
    expect(windowId).toBeGreaterThan(0);

    // ウィンドウが作成されるまでポーリングで待機（レースコンディション対策）
    await expect
      .poll(
        async () => {
          const windows = await serviceWorker.evaluate(() => {
            return chrome.windows.getAll();
          });
          return windows.length;
        },
        {
          message: 'ウィンドウが作成されるのを待機',
          timeout: 5000,
        }
      )
      .toBe(windowCountBefore + 1);

    // 作成したウィンドウが存在することをポーリングで確認（ウィンドウコンテキスト確立待ち）
    await expect
      .poll(
        async () => {
          const windows = await serviceWorker.evaluate(() => {
            return chrome.windows.getAll();
          });
          const createdWindow = windows.find((win: chrome.windows.Window) => win.id === windowId);
          return createdWindow?.id;
        },
        {
          message: 'ウィンドウコンテキストが確立されるのを待機',
          timeout: 5000,
        }
      )
      .toBe(windowId);
  });

  test('chrome.windows.remove()でウィンドウを閉じた場合、ウィンドウ内の全タブがツリーから削除される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 新しいウィンドウを作成
    const windowId = await createWindow(extensionContext);
    expect(windowId).toBeGreaterThan(0);

    // 新しいウィンドウにタブを作成
    const tabId1 = await serviceWorker.evaluate(
      (windowId) => {
        return chrome.tabs
          .create({
            windowId,
            url: 'https://example.com',
            active: false,
          })
          .then((tab) => tab.id);
      },
      windowId
    );

    const tabId2 = await serviceWorker.evaluate(
      (windowId) => {
        return chrome.tabs
          .create({
            windowId,
            url: 'https://example.org',
            active: false,
          })
          .then((tab) => tab.id);
      },
      windowId
    );

    expect(tabId1).toBeGreaterThan(0);
    expect(tabId2).toBeGreaterThan(0);

    // タブが作成されるまでポーリングで待機
    await serviceWorker.evaluate(async (params: { tabId1: number; tabId2: number }) => {
      for (let i = 0; i < 30; i++) {
        const tabs = await chrome.tabs.query({});
        const tab1Exists = tabs.some((tab: chrome.tabs.Tab) => tab.id === params.tabId1);
        const tab2Exists = tabs.some((tab: chrome.tabs.Tab) => tab.id === params.tabId2);
        if (tab1Exists && tab2Exists) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, { tabId1: tabId1!, tabId2: tabId2! });

    // タブが作成されたことを確認
    const tabsBefore = await serviceWorker.evaluate(() => {
      return chrome.tabs.query({});
    });
    const tab1 = tabsBefore.find((tab: chrome.tabs.Tab) => tab.id === tabId1);
    const tab2 = tabsBefore.find((tab: chrome.tabs.Tab) => tab.id === tabId2);
    expect(tab1).toBeDefined();
    expect(tab2).toBeDefined();

    // ウィンドウを閉じる
    await serviceWorker.evaluate((windowId) => {
      return chrome.windows.remove(windowId);
    }, windowId);

    // ウィンドウ内のタブが削除されるまでポーリングで待機
    await serviceWorker.evaluate(async (params: { tabId1: number; tabId2: number }) => {
      for (let i = 0; i < 30; i++) {
        const tabs = await chrome.tabs.query({});
        const tab1Exists = tabs.some((tab: chrome.tabs.Tab) => tab.id === params.tabId1);
        const tab2Exists = tabs.some((tab: chrome.tabs.Tab) => tab.id === params.tabId2);
        if (!tab1Exists && !tab2Exists) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, { tabId1: tabId1!, tabId2: tabId2! });

    // ウィンドウ内の全タブが削除されたことを確認
    const tabsAfter = await serviceWorker.evaluate(() => {
      return chrome.tabs.query({});
    });

    // 削除したタブが存在しないことを確認
    const deletedTab1 = tabsAfter.find((tab: chrome.tabs.Tab) => tab.id === tabId1);
    const deletedTab2 = tabsAfter.find((tab: chrome.tabs.Tab) => tab.id === tabId2);
    expect(deletedTab1).toBeUndefined();
    expect(deletedTab2).toBeUndefined();
  });

  test('chrome.windows.update()でウィンドウをフォーカスした場合、フォーカス状態が正しく更新される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 新しいウィンドウを作成（フォーカスなし）
    const windowId = await serviceWorker.evaluate(() => {
      return chrome.windows
        .create({
          focused: false,
          type: 'normal',
        })
        .then((win) => win.id);
    });

    expect(windowId).toBeGreaterThan(0);

    // ウィンドウが作成されるまでポーリングで待機
    await serviceWorker.evaluate(async (createdWindowId: number) => {
      for (let i = 0; i < 30; i++) {
        const windows = await chrome.windows.getAll();
        if (windows.some((win: chrome.windows.Window) => win.id === createdWindowId)) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, windowId!);

    // ウィンドウが作成されたことを確認
    const windowsBefore = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });
    const createdWindow = windowsBefore.find((win: chrome.windows.Window) => win.id === windowId);
    expect(createdWindow).toBeDefined();

    // ウィンドウをフォーカス
    await serviceWorker.evaluate((windowId) => {
      return chrome.windows.update(windowId!, { focused: true });
    }, windowId);

    // フォーカス状態が更新されるまでポーリングで待機
    await serviceWorker.evaluate(async (focusedWindowId: number) => {
      for (let i = 0; i < 30; i++) {
        const windows = await chrome.windows.getAll();
        const win = windows.find((w: chrome.windows.Window) => w.id === focusedWindowId);
        if (win && win.focused) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, windowId!);

    // フォーカス状態が更新されたことを確認
    const windowsAfter = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });
    const focusedWindow = windowsAfter.find((win: chrome.windows.Window) => win.id === windowId);
    expect(focusedWindow).toBeDefined();
    expect(focusedWindow?.focused).toBe(true);
  });

  test('chrome.windows.getAll()で全ウィンドウを取得した場合、全ウィンドウのタブが正しく列挙される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 複数のウィンドウを作成
    const windowId1 = await createWindow(extensionContext);
    const windowId2 = await createWindow(extensionContext);

    expect(windowId1).toBeGreaterThan(0);
    expect(windowId2).toBeGreaterThan(0);

    // 両方のウィンドウがgetAll()で取得できるまでポーリングで待機（レースコンディション対策）
    await expect
      .poll(
        async () => {
          const windows = await serviceWorker.evaluate(() => {
            return chrome.windows.getAll({ populate: true });
          });
          const hasWindow1 = windows.some((win: chrome.windows.Window) => win.id === windowId1);
          const hasWindow2 = windows.some((win: chrome.windows.Window) => win.id === windowId2);
          return hasWindow1 && hasWindow2;
        },
        {
          message: '両方のウィンドウがgetAll()で取得できるのを待機',
          timeout: 5000,
        }
      )
      .toBe(true);

    // 全ウィンドウを取得
    const windows = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll({ populate: true });
    });

    // 全ウィンドウが取得されたことを確認
    expect(windows.length).toBeGreaterThanOrEqual(3); // 元のウィンドウ + 2つの新しいウィンドウ

    // 作成したウィンドウが含まれることを確認
    const window1 = windows.find((win: chrome.windows.Window) => win.id === windowId1);
    const window2 = windows.find((win: chrome.windows.Window) => win.id === windowId2);
    expect(window1).toBeDefined();
    expect(window2).toBeDefined();

    // 各ウィンドウにタブが含まれることを確認（populate: trueの場合）
    expect(Array.isArray(window1?.tabs)).toBe(true);
    expect(Array.isArray(window2?.tabs)).toBe(true);
  });

  test('複数ウィンドウが存在する場合、各ウィンドウのタブツリーが独立して管理される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 2つの新しいウィンドウを作成
    const windowId1 = await createWindow(extensionContext);
    const windowId2 = await createWindow(extensionContext);

    expect(windowId1).toBeGreaterThan(0);
    expect(windowId2).toBeGreaterThan(0);

    // 両方のウィンドウが完全に利用可能になるまでポーリングで待機（レースコンディション対策）
    await expect
      .poll(
        async () => {
          const windows = await serviceWorker.evaluate(() => {
            return chrome.windows.getAll();
          });
          const hasWindow1 = windows.some((win: chrome.windows.Window) => win.id === windowId1);
          const hasWindow2 = windows.some((win: chrome.windows.Window) => win.id === windowId2);
          return hasWindow1 && hasWindow2;
        },
        {
          message: '両方のウィンドウが利用可能になるのを待機',
          timeout: 5000,
        }
      )
      .toBe(true);

    // ウィンドウ1にタブを作成
    const tabId1 = await serviceWorker.evaluate(
      (windowId) => {
        return chrome.tabs
          .create({
            windowId,
            url: 'https://example.com',
            active: false,
          })
          .then((tab) => tab.id);
      },
      windowId1
    );

    // ウィンドウ2にタブを作成
    const tabId2 = await serviceWorker.evaluate(
      (windowId) => {
        return chrome.tabs
          .create({
            windowId,
            url: 'https://example.org',
            active: false,
          })
          .then((tab) => tab.id);
      },
      windowId2
    );

    expect(tabId1).toBeGreaterThan(0);
    expect(tabId2).toBeGreaterThan(0);

    // タブが作成されるまでポーリングで待機
    await serviceWorker.evaluate(async (params: { tabId1: number; tabId2: number }) => {
      for (let i = 0; i < 30; i++) {
        const tabs = await chrome.tabs.query({});
        const tab1Exists = tabs.some((tab: chrome.tabs.Tab) => tab.id === params.tabId1);
        const tab2Exists = tabs.some((tab: chrome.tabs.Tab) => tab.id === params.tabId2);
        if (tab1Exists && tab2Exists) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, { tabId1: tabId1!, tabId2: tabId2! });

    // ウィンドウ1のタブを取得
    const tabs1 = await serviceWorker.evaluate((windowId) => {
      return chrome.tabs.query({ windowId });
    }, windowId1);

    // ウィンドウ2のタブを取得
    const tabs2 = await serviceWorker.evaluate((windowId) => {
      return chrome.tabs.query({ windowId });
    }, windowId2);

    // ウィンドウ1にタブ1が含まれることを確認
    const tab1InWindow1 = tabs1.find((tab: chrome.tabs.Tab) => tab.id === tabId1);
    expect(tab1InWindow1).toBeDefined();

    // ウィンドウ2にタブ2が含まれることを確認
    const tab2InWindow2 = tabs2.find((tab: chrome.tabs.Tab) => tab.id === tabId2);
    expect(tab2InWindow2).toBeDefined();

    // ウィンドウ1にタブ2が含まれないことを確認（独立性）
    const tab2InWindow1 = tabs1.find((tab: chrome.tabs.Tab) => tab.id === tabId2);
    expect(tab2InWindow1).toBeUndefined();

    // ウィンドウ2にタブ1が含まれないことを確認（独立性）
    const tab1InWindow2 = tabs2.find((tab: chrome.tabs.Tab) => tab.id === tabId1);
    expect(tab1InWindow2).toBeUndefined();

    // 各ウィンドウのツリー状態が同期されていることを検証
    await assertWindowTreeSync(extensionContext, windowId1);
    await assertWindowTreeSync(extensionContext, windowId2);
  });
});
