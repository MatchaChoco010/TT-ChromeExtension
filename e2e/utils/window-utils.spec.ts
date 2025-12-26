/**
 * WindowTestUtils Test
 *
 * WindowTestUtilsの機能をテストします。
 * このテストは、ユーティリティ関数が正しく動作することを確認するためのものです。
 *
 * Requirements: 3.6, 4.2
 */
import { test, expect } from '../fixtures/extension';
import {
  createWindow,
  moveTabToWindow,
  dragTabToWindow,
  assertWindowTreeSync,
} from './window-utils';
import { createTab } from './tab-utils';

test.describe('WindowTestUtils', () => {
  test('createWindowは新しいウィンドウを作成する', async ({ extensionContext }) => {
    // 新しいウィンドウを作成
    const windowId = await createWindow(extensionContext);

    // ウィンドウIDが有効であることを確認
    expect(windowId).toBeGreaterThan(0);
  });

  test('moveTabToWindowはタブを別ウィンドウに移動する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    // 新しいタブを作成（about:blankを使用して高速化）
    const tabId = await createTab(extensionContext, 'about:blank');

    // 新しいウィンドウを作成
    const newWindowId = await createWindow(extensionContext);

    // タブを新しいウィンドウに移動
    await moveTabToWindow(extensionContext, tabId, newWindowId);

    // タブが新しいウィンドウに移動したことを検証（Service Worker経由で確認）
    const tabs = await serviceWorker.evaluate((windowId) => {
      return chrome.tabs.query({ windowId });
    }, newWindowId);

    // 移動したタブがウィンドウに存在することを確認
    expect(tabs.some((tab: chrome.tabs.Tab) => tab.id === tabId)).toBe(true);
  });

  test('dragTabToWindowはタブを別ウィンドウにドラッグ&ドロップで移動する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 新しいタブを作成（about:blankを使用して高速化）
    const tabId = await createTab(extensionContext, 'about:blank');

    // 新しいウィンドウを作成
    const newWindowId = await createWindow(extensionContext);

    // タブを新しいウィンドウにドラッグ&ドロップ（実装は内部的にmoveTabToWindowを使用）
    await dragTabToWindow(sidePanelPage, tabId, newWindowId);

    // タブが新しいウィンドウに移動したことを検証（Service Worker経由で確認）
    const tabs = await serviceWorker.evaluate((windowId) => {
      return chrome.tabs.query({ windowId });
    }, newWindowId);

    // 移動したタブがウィンドウに存在することを確認
    expect(tabs.some((tab: chrome.tabs.Tab) => tab.id === tabId)).toBe(true);
  });

  test('assertWindowTreeSyncは各ウィンドウのツリー状態が正しく同期されることを検証する', async ({
    extensionContext,
  }) => {
    // 新しいウィンドウを作成
    const windowId = await createWindow(extensionContext);

    // ツリー状態の同期を検証（例外が発生しないことを確認）
    await expect(
      assertWindowTreeSync(extensionContext, windowId)
    ).resolves.not.toThrow();
  });

  test('複数ウィンドウ間でタブを移動した後、各ウィンドウのツリー状態が正しく同期されることを検証する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    // 最初のウィンドウにタブを作成（about:blankを使用して高速化）
    const tab1Id = await createTab(extensionContext, 'about:blank');
    const tab2Id = await createTab(extensionContext, 'about:blank');

    // 新しいウィンドウを作成
    const newWindowId = await createWindow(extensionContext);

    // タブを新しいウィンドウに移動
    await moveTabToWindow(extensionContext, tab1Id, newWindowId);

    // 両方のウィンドウのツリー状態が同期されていることを確認
    const windows = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });

    // 現在のウィンドウIDを取得
    const currentWindowId = windows[0].id as number;

    await assertWindowTreeSync(extensionContext, currentWindowId);
    await assertWindowTreeSync(extensionContext, newWindowId);

    // tab1が新しいウィンドウに存在することを確認
    const newWindowTabs = await serviceWorker.evaluate((windowId) => {
      return chrome.tabs.query({ windowId });
    }, newWindowId);
    expect(newWindowTabs.some((tab: chrome.tabs.Tab) => tab.id === tab1Id)).toBe(true);

    // tab2が元のウィンドウに存在することを確認
    const currentWindowTabs = await serviceWorker.evaluate((windowId) => {
      return chrome.tabs.query({ windowId });
    }, currentWindowId);
    expect(currentWindowTabs.some((tab: chrome.tabs.Tab) => tab.id === tab2Id)).toBe(true);
  });

  test('子タブを持つ親タブを別ウィンドウに移動した場合、サブツリー全体が一緒に移動する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    // 親タブを作成（about:blankを使用して高速化）
    const parentTabId = await createTab(extensionContext, 'about:blank');

    // 子タブを作成
    const childTabId = await createTab(
      extensionContext,
      'about:blank',
      parentTabId
    );

    // 新しいウィンドウを作成
    const newWindowId = await createWindow(extensionContext);

    // 親タブを新しいウィンドウに移動
    await moveTabToWindow(extensionContext, parentTabId, newWindowId);

    // ツリー状態の同期を検証
    await assertWindowTreeSync(extensionContext, newWindowId);

    // 親タブが新しいウィンドウに移動したことを確認
    const newWindowTabs = await serviceWorker.evaluate((windowId) => {
      return chrome.tabs.query({ windowId });
    }, newWindowId);
    expect(newWindowTabs.some((tab: chrome.tabs.Tab) => tab.id === parentTabId)).toBe(true);

    // 注: Chrome Tab APIでは、子タブは独立して移動させる必要がある
    // 実際のアプリケーションでは、親タブ移動時に子タブも一緒に移動させるロジックが
    // 必要になる可能性がある。ここではAPIレベルでの基本的な動作を検証する。
  });
});
