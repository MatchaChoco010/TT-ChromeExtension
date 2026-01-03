/**
 * 新規タブ作成時の親子関係維持テスト
 *
 * このテストスイートでは、以下を検証します:
 * 1. 既存の親子関係がある状態で新しいタブを開いても、既存の親子関係が維持される
 * 2. 複数のタブが親子関係にある状態で新しいタブを開いても、他のタブの親子関係を解消しない
 * 3. リンクから新しいタブを開いた場合、リンク元タブの子タブとして配置される
 */
import { test, expect } from './fixtures/extension';
import { closeTab, createTab, getCurrentWindowId, getInitialBrowserTabId, getPseudoSidePanelTabId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('新規タブ作成時の親子関係維持', () => {
  test('既存の親子関係がある状態で新しいタブを開いても、既存の親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認（テスト前提条件）
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');

    // 親タブ作成後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    // 子タブを作成（親タブの子として）
    const childTabId = await createTab(extensionContext, 'https://example.com/child', parentTabId);

    // 子タブ作成後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
    ], 0);

    // 新しい独立したタブを作成
    const newTabId = await createTab(extensionContext, 'https://example.org/new');

    // 新規タブ作成後の構造を検証（既存の親子関係が維持されていることを確認）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
      { tabId: newTabId, depth: 0 },
    ], 0);
  });

  test('複数のタブが親子関係にある状態で新しいタブを開いても、他のタブの親子関係を解消しない', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認（テスト前提条件）
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 親タブ1を作成
    const parent1TabId = await createTab(extensionContext, 'https://example.com/parent1');

    // 親タブ1作成後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0 },
    ], 0);

    // 親タブ1の子タブを作成
    const child1TabId = await createTab(extensionContext, 'https://example.com/child1', parent1TabId);

    // 子タブ1作成後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0 },
      { tabId: child1TabId, depth: 1 },
    ], 0);

    // 親タブ2を作成
    const parent2TabId = await createTab(extensionContext, 'https://example.org/parent2');

    // 親タブ2作成後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0 },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0 },
    ], 0);

    // 親タブ2の子タブを作成
    const child2TabId = await createTab(extensionContext, 'https://example.org/child2', parent2TabId);

    // 子タブ2作成後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0 },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0 },
      { tabId: child2TabId, depth: 1 },
    ], 0);

    // 新しい独立したタブを作成
    const newTabId = await createTab(extensionContext, 'https://example.net/new');

    // 新規タブ作成後の構造を検証（両方の親子関係が維持されていることを確認）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0 },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0 },
      { tabId: child2TabId, depth: 1 },
      { tabId: newTabId, depth: 0 },
    ], 0);
  });

  test('孫タブまである親子関係が、新しいタブ作成後も維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認（テスト前提条件）
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');

    // 親タブ作成後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    // 子タブを作成
    const childTabId = await createTab(extensionContext, 'https://example.com/child', parentTabId);

    // 子タブ作成後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
    ], 0);

    // 孫タブを作成（子タブの子として）
    const grandchildTabId = await createTab(extensionContext, 'https://example.com/grandchild', childTabId);

    // 孫タブ作成後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
      { tabId: grandchildTabId, depth: 2 },
    ], 0);

    // 新しい独立したタブを作成
    const newTabId = await createTab(extensionContext, 'https://example.org/new');

    // 新規タブ作成後の構造を検証（すべての親子関係が維持されていることを確認）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
      { tabId: grandchildTabId, depth: 2 },
      { tabId: newTabId, depth: 0 },
    ], 0);
  });
});
