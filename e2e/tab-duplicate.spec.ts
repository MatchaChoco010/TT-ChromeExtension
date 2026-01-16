import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { waitForTabInTreeState } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setUserSettings } from './utils/settings-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('タブ複製時の配置', () => {
  test.describe('複製されたタブが元のタブの兄弟として配置される', () => {
    test('タブを複製すると兄弟タブとして配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await sidePanelPage.waitForFunction(
        (tid) => {
          const node = document.querySelector(`[data-testid="tree-node-${tid}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId,
        { timeout: 5000 }
      );

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await tabNode.click({ button: 'right' });

      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // 複製タブが作成されるまでポーリングで待機
      let newTabId: number | undefined;
      await expect(async () => {
        newTabId = await serviceWorker.evaluate(async (excludeIds) => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
          return sortedTabs[0]?.id;
        }, [initialBrowserTabId, pseudoSidePanelTabId, tabId]);
        expect(newTabId).toBeDefined();
      }).toPass({ timeout: 10000 });

      await waitForTabInTreeState(serviceWorker, newTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
        { tabId: newTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: newTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, newTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('複製されたタブが元のタブの直下（1つ下）に表示される', () => {
    test('複製されたタブは複製元タブの直後（インデックス+1）に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await sidePanelPage.waitForFunction(
        (tid) => {
          const node = document.querySelector(`[data-testid="tree-node-${tid}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId1,
        { timeout: 5000 }
      );

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click({ button: 'right' });

      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // 複製タブが作成されるまでポーリングで待機
      let duplicatedTabId: number | undefined;
      await expect(async () => {
        duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
          return sortedTabs[0]?.id;
        }, [initialBrowserTabId, pseudoSidePanelTabId, tabId1, tabId2, tabId3]);
        expect(duplicatedTabId).toBeDefined();
      }).toPass({ timeout: 10000 });

      await waitForTabInTreeState(serviceWorker, duplicatedTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('複製されたタブは元のタブの直後に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await sidePanelPage.waitForFunction(
        (tid) => {
          const node = document.querySelector(`[data-testid="tree-node-${tid}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId1,
        { timeout: 5000 }
      );

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click({ button: 'right' });

      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // 複製タブが作成されるまでポーリングで待機
      let duplicatedTabId: number | undefined;
      await expect(async () => {
        duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
          return sortedTabs[0]?.id;
        }, [initialBrowserTabId, pseudoSidePanelTabId, tabId1]);
        expect(duplicatedTabId).toBeDefined();
      }).toPass({ timeout: 10000 });

      await waitForTabInTreeState(serviceWorker, duplicatedTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('複製されたタブが元のタブの子タブとして配置されない', () => {
    test('親タブを持つタブを複製しても、複製タブは子タブにならない', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(serviceWorker, getTestServerUrl('/page'), parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await sidePanelPage.waitForFunction(
        (tid) => {
          const node = document.querySelector(`[data-testid="tree-node-${tid}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        childTabId,
        { timeout: 5000 }
      );

      const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTabId}"]`);
      await childNode.click({ button: 'right' });

      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // 複製タブが作成されるまでポーリングで待機
      let duplicatedTabId: number | undefined;
      await expect(async () => {
        duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
          return sortedTabs[0]?.id;
        }, [initialBrowserTabId, pseudoSidePanelTabId, parentTabId, childTabId]);
        expect(duplicatedTabId).toBeDefined();
      }).toPass({ timeout: 10000 });

      await waitForTabInTreeState(serviceWorker, duplicatedTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
        { tabId: duplicatedTabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, childTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('設定によって複製タブの位置が変わる', () => {
    test('設定が"end"の場合、複製されたタブはリストの最後に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { duplicateTabPosition: 'end' });
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await sidePanelPage.waitForFunction(
        (tid) => {
          const node = document.querySelector(`[data-testid="tree-node-${tid}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId1,
        { timeout: 5000 }
      );

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click({ button: 'right' });

      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // 複製タブが作成されるまでポーリングで待機
      let duplicatedTabId: number | undefined;
      await expect(async () => {
        duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
          return sortedTabs[0]?.id;
        }, [initialBrowserTabId, pseudoSidePanelTabId, tabId1, tabId2]);
        expect(duplicatedTabId).toBeDefined();
      }).toPass({ timeout: 10000 });

      await waitForTabInTreeState(serviceWorker, duplicatedTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await closeTab(serviceWorker, tabId2);
      await closeTab(serviceWorker, duplicatedTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('設定が"sibling"の場合、複製されたタブは元のタブの直後に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { duplicateTabPosition: 'sibling' });
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await sidePanelPage.waitForFunction(
        (tid) => {
          const node = document.querySelector(`[data-testid="tree-node-${tid}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId1,
        { timeout: 5000 }
      );

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click({ button: 'right' });

      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // 複製タブが作成されるまでポーリングで待機
      let duplicatedTabId: number | undefined;
      await expect(async () => {
        duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
          return sortedTabs[0]?.id;
        }, [initialBrowserTabId, pseudoSidePanelTabId, tabId1, tabId2]);
        expect(duplicatedTabId).toBeDefined();
      }).toPass({ timeout: 10000 });

      await waitForTabInTreeState(serviceWorker, duplicatedTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await closeTab(serviceWorker, tabId2);
      await closeTab(serviceWorker, duplicatedTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('子タブが孫タブを持ち折りたたまれている場合の複製', () => {
    test('折りたたまれた孫タブを持つ子タブを複製すると、複製は子タブの兄弟として配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { duplicateTabPosition: 'sibling', childTabBehavior: 'close_all' });
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page?parent'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const child1TabId = await createTab(serviceWorker, getTestServerUrl('/page?child1'), parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: child1TabId, depth: 1 },
      ], 0);

      const child2TabId = await createTab(serviceWorker, getTestServerUrl('/page?child2'), parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: child1TabId, depth: 1 },
        { tabId: child2TabId, depth: 1 },
      ], 0);

      const grandchildTabId = await createTab(serviceWorker, getTestServerUrl('/page?grandchild'), child2TabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: child1TabId, depth: 1 },
        { tabId: child2TabId, depth: 1, expanded: true },
        { tabId: grandchildTabId, depth: 2 },
      ], 0);

      const child2Node = sidePanelPage.locator(`[data-testid="tree-node-${child2TabId}"]`);
      const expandButton = child2Node.locator('[data-testid="expand-button"]');
      await expandButton.click();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: child1TabId, depth: 1 },
        { tabId: child2TabId, depth: 1, expanded: false },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await child2Node.click({ button: 'right' });
      await sidePanelPage.waitForSelector('[role="menu"]', { state: 'visible', timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await duplicateItem.click();
      await sidePanelPage.waitForSelector('[role="menu"]', { state: 'hidden', timeout: 3000 });

      const knownTabIds = [initialBrowserTabId, pseudoSidePanelTabId, parentTabId, child1TabId, child2TabId, grandchildTabId];

      // 複製されたタブがChrome APIで見つかるまでポーリング
      let duplicatedChild2TabId: number | undefined;
      const startTime = Date.now();
      const timeout = 15000;
      while (Date.now() - startTime < timeout) {
        duplicatedChild2TabId = await serviceWorker.evaluate(async (excludeIds) => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const duplicatedChild2 = tabs.find(t => t.id && !excludeIds.includes(t.id) && t.url?.includes('child2'));
          return duplicatedChild2?.id;
        }, knownTabIds);
        if (duplicatedChild2TabId !== undefined) break;
        await new Promise(r => setTimeout(r, 100));
      }

      if (duplicatedChild2TabId === undefined) {
        throw new Error('Duplicated child2 tab was not found in Chrome tabs within timeout');
      }

      await waitForTabInTreeState(serviceWorker, duplicatedChild2TabId);

      // handleDuplicateSubtreeのmoveNode操作が完了するのを待つ
      await sidePanelPage.waitForTimeout(500);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: child1TabId, depth: 1 },
        { tabId: child2TabId, depth: 1, expanded: false },
        { tabId: duplicatedChild2TabId!, depth: 1, expanded: false },
      ], 0);

      // duplicated child2とその子（duplicated grandchild）を閉じる
      await closeTab(serviceWorker, duplicatedChild2TabId!);
      // duplicated grandchildもツリーから削除される（子タブの処理による）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: child1TabId, depth: 1 },
        { tabId: child2TabId, depth: 1, expanded: false },
      ], 0);

      await closeTab(serviceWorker, grandchildTabId);
      await closeTab(serviceWorker, child2TabId);
      await closeTab(serviceWorker, child1TabId);
      await closeTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('複数タブ選択時の複製', () => {
    test('連続したタブを複数選択して複製すると、すべてのタブが複製される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await sidePanelPage.waitForFunction(
        (tid) => {
          const node = document.querySelector(`[data-testid="tree-node-${tid}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId1,
        { timeout: 5000 }
      );

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click();

      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await tabNode2.click({ modifiers: ['Shift'] });

      await tabNode2.click({ button: 'right' });

      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // 複製されたタブがツリービューに表示されるまで待機
      await expect.poll(async () => {
        const tabs = await serviceWorker.evaluate(async () => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          return tabs.map(t => t.id).filter((id): id is number => id !== undefined);
        });
        return tabs.length;
      }, { timeout: 10000 }).toBe(7);

      // ツリービューに7つのタブが表示されていることを確認
      await expect.poll(async () => {
        const nodes = await sidePanelPage.locator('[data-testid^="tree-node-"]').all();
        return nodes.length;
      }, { timeout: 10000 }).toBe(7);

      const allTabIds = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        return tabs.map(t => t.id).filter((id): id is number => id !== undefined);
      });

      await closeTab(serviceWorker, tabId1);
      await closeTab(serviceWorker, tabId2);
      await closeTab(serviceWorker, tabId3);
      for (const tabId of allTabIds.filter(id => id !== initialBrowserTabId && id !== pseudoSidePanelTabId && id !== tabId1 && id !== tabId2 && id !== tabId3)) {
        await closeTab(serviceWorker, tabId);
      }
    });

    test('飛び飛びのタブを複数選択して複製すると、すべてのタブが複製される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await sidePanelPage.waitForFunction(
        (tid) => {
          const node = document.querySelector(`[data-testid="tree-node-${tid}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId1,
        { timeout: 5000 }
      );

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click();

      const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);
      await tabNode3.click({ modifiers: ['Control'] });

      await tabNode3.click({ button: 'right' });

      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // 複製されたタブがツリービューに表示されるまで待機
      await expect.poll(async () => {
        const tabs = await serviceWorker.evaluate(async () => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          return tabs.map(t => t.id).filter((id): id is number => id !== undefined);
        });
        return tabs.length;
      }, { timeout: 10000 }).toBe(7);

      // ツリービューに7つのタブが表示されていることを確認
      await expect.poll(async () => {
        const nodes = await sidePanelPage.locator('[data-testid^="tree-node-"]').all();
        return nodes.length;
      }, { timeout: 10000 }).toBe(7);

      const allTabIds = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        return tabs.map(t => t.id).filter((id): id is number => id !== undefined);
      });

      await closeTab(serviceWorker, tabId1);
      await closeTab(serviceWorker, tabId2);
      await closeTab(serviceWorker, tabId3);
      for (const tabId of allTabIds.filter(id => id !== initialBrowserTabId && id !== pseudoSidePanelTabId && id !== tabId1 && id !== tabId2 && id !== tabId3)) {
        await closeTab(serviceWorker, tabId);
      }
    });

    test('sibling設定で複数タブを複製すると、各複製タブが元のタブの直後に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { duplicateTabPosition: 'sibling' });
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page2'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await sidePanelPage.waitForFunction(
        (tid) => {
          const node = document.querySelector(`[data-testid="tree-node-${tid}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId1,
        { timeout: 5000 }
      );

      // tabId1とtabId2を選択
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click();

      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await tabNode2.click({ modifiers: ['Shift'] });

      // コンテキストメニューを開いて複製
      await tabNode2.click({ button: 'right' });
      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // 複製されたタブがツリービューに表示されるまで待機
      await expect.poll(async () => {
        const tabs = await serviceWorker.evaluate(async () => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          return tabs.map(t => t.id).filter((id): id is number => id !== undefined);
        });
        return tabs.length;
      }, { timeout: 10000 }).toBe(6); // 初期2 + 作成2 + 複製2 = 6

      // 複製されたタブのIDを取得
      const allTabIds = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        return tabs.map(t => t.id).filter((id): id is number => id !== undefined);
      });
      const duplicatedTabIds = allTabIds.filter(
        id => id !== initialBrowserTabId && id !== pseudoSidePanelTabId && id !== tabId1 && id !== tabId2
      );

      // 期待される順序:
      // initialBrowserTab, pseudoSidePanelTab, tabId1, 複製1, tabId2, 複製2
      // 各複製タブが対応する元のタブの直後に配置されていることを確認
      const tabOrder = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        return tabs.sort((a, b) => a.index - b.index).map(t => t.id);
      });

      // tabId1の直後に複製タブ1があることを確認
      const tabId1Index = tabOrder.indexOf(tabId1);
      const duplicatedTab1 = tabOrder[tabId1Index + 1];
      expect(duplicatedTabIds).toContain(duplicatedTab1);

      // tabId2の直後に複製タブ2があることを確認
      const tabId2Index = tabOrder.indexOf(tabId2);
      const duplicatedTab2 = tabOrder[tabId2Index + 1];
      expect(duplicatedTabIds).toContain(duplicatedTab2);

      // 2つの複製タブが異なることを確認
      expect(duplicatedTab1).not.toBe(duplicatedTab2);

      // クリーンアップ
      for (const tabId of allTabIds.filter(id => id !== initialBrowserTabId && id !== pseudoSidePanelTabId)) {
        await closeTab(serviceWorker, tabId);
      }
    });

    test('sibling設定で3タブを複製すると、各複製タブが元のタブの直後に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { duplicateTabPosition: 'sibling' });
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // 3タブを作成
      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await sidePanelPage.waitForFunction(
        (tid) => {
          const node = document.querySelector(`[data-testid="tree-node-${tid}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId1,
        { timeout: 5000 }
      );

      // tabId1, tabId2, tabId3を全て選択
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click();

      const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);
      await tabNode3.click({ modifiers: ['Shift'] });

      // コンテキストメニューを開いて複製
      await tabNode3.click({ button: 'right' });
      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // 複製されたタブがツリービューに表示されるまで待機（初期2 + 作成3 + 複製3 = 8）
      await expect.poll(async () => {
        const tabs = await serviceWorker.evaluate(async () => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          return tabs.map(t => t.id).filter((id): id is number => id !== undefined);
        });
        return tabs.length;
      }, { timeout: 10000 }).toBe(8);

      // 複製されたタブのIDを取得
      const allTabIds = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        return tabs.map(t => t.id).filter((id): id is number => id !== undefined);
      });
      const duplicatedTabIds = allTabIds.filter(
        id => id !== initialBrowserTabId && id !== pseudoSidePanelTabId && id !== tabId1 && id !== tabId2 && id !== tabId3
      );

      // Chrome APIのタブ順序を取得
      const tabOrder = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        return tabs.sort((a, b) => a.index - b.index).map(t => t.id);
      });

      // tabId1の直後に複製タブ1があることを確認
      const tabId1Index = tabOrder.indexOf(tabId1);
      const duplicatedTab1 = tabOrder[tabId1Index + 1];
      expect(duplicatedTabIds).toContain(duplicatedTab1);

      // tabId2の直後に複製タブ2があることを確認
      const tabId2Index = tabOrder.indexOf(tabId2);
      const duplicatedTab2 = tabOrder[tabId2Index + 1];
      expect(duplicatedTabIds).toContain(duplicatedTab2);

      // tabId3の直後に複製タブ3があることを確認
      const tabId3Index = tabOrder.indexOf(tabId3);
      const duplicatedTab3 = tabOrder[tabId3Index + 1];
      expect(duplicatedTabIds).toContain(duplicatedTab3);

      // 3つの複製タブが全て異なることを確認
      expect(new Set([duplicatedTab1, duplicatedTab2, duplicatedTab3]).size).toBe(3);

      // DOM上の表示順序も確認（rootNodeIds順序）
      // 期待値: tabId1 → dup1 → tabId2 → dup2 → tabId3 → dup3
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: duplicatedTab1!, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: duplicatedTab2!, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: duplicatedTab3!, depth: 0 },
      ], 0);

      // クリーンアップ
      for (const tabId of allTabIds.filter(id => id !== initialBrowserTabId && id !== pseudoSidePanelTabId)) {
        await closeTab(serviceWorker, tabId);
      }
    });

    test('end設定で複数タブを複製すると、全ての複製タブがリストの最後に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { duplicateTabPosition: 'end' });
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await sidePanelPage.waitForFunction(
        (tid) => {
          const node = document.querySelector(`[data-testid="tree-node-${tid}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId1,
        { timeout: 5000 }
      );

      // tabId1とtabId2を選択
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click();

      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await tabNode2.click({ modifiers: ['Shift'] });

      // コンテキストメニューを開いて複製
      await tabNode2.click({ button: 'right' });
      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // 複製されたタブがツリービューに表示されるまで待機（初期2 + 作成2 + 複製2 = 6）
      await expect.poll(async () => {
        const tabs = await serviceWorker.evaluate(async () => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          return tabs.map(t => t.id).filter((id): id is number => id !== undefined);
        });
        return tabs.length;
      }, { timeout: 10000 }).toBe(6);

      // Chrome APIのタブ順序を取得（インデックス順でソート）
      const tabOrder = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        return tabs.sort((a, b) => a.index - b.index).map(t => t.id).filter((id): id is number => id !== undefined);
      });

      // 複製されたタブのIDを特定（最後の2つ）
      const duplicatedTabIds = tabOrder.filter(
        id => id !== initialBrowserTabId && id !== pseudoSidePanelTabId && id !== tabId1 && id !== tabId2
      );
      expect(duplicatedTabIds.length).toBe(2);

      // ツリー構造を検証: 複製タブが最後に配置されていることを確認
      // "end"設定では、複製タブはリストの最後に順番に配置される
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: duplicatedTabIds[0], depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
      ], 0);

      // クリーンアップ
      for (const tabId of tabOrder.filter(id => id !== initialBrowserTabId && id !== pseudoSidePanelTabId)) {
        await closeTab(serviceWorker, tabId);
      }
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });
});
