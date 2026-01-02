/**
 * UIツリービューのdepth属性検証テスト
 *
 * このテストスイートでは、実際のSide Panel UIの見た目（data-depth属性）を検証します。
 * ストレージの状態ではなく、実際にレンダリングされたDOMを確認します。
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';
import { moveTabToParent } from './utils/drag-drop-utils';
import {
  waitForTabInTreeState,
  waitForTabVisibleInUI,
  waitForTabDepthInUI,
  getAllTabDepthsFromUI,
} from './utils/polling-utils';

test.describe('UIツリービューのdepth属性検証', () => {
  test('ドラッグ&ドロップで作成した親子関係がUIに正しく反映される', async ({
    sidePanelPage,
    extensionContext,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
    await waitForTabInTreeState(extensionContext, parentTabId);
    await waitForTabVisibleInUI(sidePanelPage, parentTabId);

    // 子タブを作成（最初はルートレベル）
    const childTabId = await createTab(extensionContext, 'https://example.com/child');
    await waitForTabInTreeState(extensionContext, childTabId);
    await waitForTabVisibleInUI(sidePanelPage, childTabId);

    // UIで両方のタブがdepth=0であることを確認
    await waitForTabDepthInUI(sidePanelPage, parentTabId, 0);
    await waitForTabDepthInUI(sidePanelPage, childTabId, 0);

    // ドラッグ&ドロップで子タブを親タブの子にする
    await moveTabToParent(sidePanelPage, childTabId, parentTabId);

    // UIで親子関係が反映されていることを確認
    await waitForTabDepthInUI(sidePanelPage, parentTabId, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, childTabId, 1, { timeout: 3000 });
  });

  test('親子関係作成後に新しいタブを開いても親子関係が維持される（UI検証）', async ({
    sidePanelPage,
    extensionContext,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
    await waitForTabInTreeState(extensionContext, parentTabId);
    await waitForTabVisibleInUI(sidePanelPage, parentTabId);

    // 子タブを作成（最初はルートレベル）
    const childTabId = await createTab(extensionContext, 'https://example.com/child');
    await waitForTabInTreeState(extensionContext, childTabId);
    await waitForTabVisibleInUI(sidePanelPage, childTabId);

    // ドラッグ&ドロップで子タブを親タブの子にする
    await moveTabToParent(sidePanelPage, childTabId, parentTabId);

    // UIで親子関係が反映されていることを確認
    await waitForTabDepthInUI(sidePanelPage, parentTabId, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, childTabId, 1, { timeout: 3000 });

    // 新しい独立タブを作成
    const newTabId = await createTab(extensionContext, 'https://example.org/new');
    await waitForTabInTreeState(extensionContext, newTabId);
    await waitForTabVisibleInUI(sidePanelPage, newTabId);

    // 新しいタブはdepth=0
    await waitForTabDepthInUI(sidePanelPage, newTabId, 0, { timeout: 3000 });

    // 既存の親子関係がUI上で維持されていることを確認
    const depthsAfterNewTab = await getAllTabDepthsFromUI(sidePanelPage);

    expect(depthsAfterNewTab.get(parentTabId)).toBe(0);
    expect(depthsAfterNewTab.get(childTabId)).toBe(1);
    expect(depthsAfterNewTab.get(newTabId)).toBe(0);
  });

  test('3階層の親子関係が新しいタブ作成後もUI上で維持される', async ({
    sidePanelPage,
    extensionContext,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 3つのタブを作成
    const tabAId = await createTab(extensionContext, 'https://example.com/A');
    await waitForTabInTreeState(extensionContext, tabAId);
    await waitForTabVisibleInUI(sidePanelPage, tabAId);

    const tabBId = await createTab(extensionContext, 'https://example.com/B');
    await waitForTabInTreeState(extensionContext, tabBId);
    await waitForTabVisibleInUI(sidePanelPage, tabBId);

    const tabCId = await createTab(extensionContext, 'https://example.com/C');
    await waitForTabInTreeState(extensionContext, tabCId);
    await waitForTabVisibleInUI(sidePanelPage, tabCId);

    // すべてdepth=0であることを確認
    await waitForTabDepthInUI(sidePanelPage, tabAId, 0);
    await waitForTabDepthInUI(sidePanelPage, tabBId, 0);
    await waitForTabDepthInUI(sidePanelPage, tabCId, 0);

    // タブBをタブAの子にする
    await moveTabToParent(sidePanelPage, tabBId, tabAId);
    await waitForTabDepthInUI(sidePanelPage, tabBId, 1, { timeout: 3000 });

    // タブCをタブBの子にする
    await moveTabToParent(sidePanelPage, tabCId, tabBId);
    await waitForTabDepthInUI(sidePanelPage, tabCId, 2, { timeout: 3000 });

    // 階層構造を確認
    const depthsBefore = await getAllTabDepthsFromUI(sidePanelPage);

    expect(depthsBefore.get(tabAId)).toBe(0);
    expect(depthsBefore.get(tabBId)).toBe(1);
    expect(depthsBefore.get(tabCId)).toBe(2);

    // 新しいタブを開く
    const newTabId = await createTab(extensionContext, 'https://example.org/new');
    await waitForTabInTreeState(extensionContext, newTabId);
    await waitForTabVisibleInUI(sidePanelPage, newTabId);

    // 階層構造がUI上で維持されていることを確認
    const depthsAfter = await getAllTabDepthsFromUI(sidePanelPage);

    expect(depthsAfter.get(tabAId)).toBe(0);
    expect(depthsAfter.get(tabBId)).toBe(1);
    expect(depthsAfter.get(tabCId)).toBe(2);
    expect(depthsAfter.get(newTabId)).toBe(0);
  });
});
