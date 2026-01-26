import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';
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
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      let newTabId: number | undefined;
      await expect(async () => {
        newTabId = await serviceWorker.evaluate(async (excludeIds) => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
          return sortedTabs[0]?.id;
        }, [initialBrowserTabId, tabId]);
        expect(newTabId).toBeDefined();
      }).toPass({ timeout: 10000 });

      await waitForTabInTreeState(serviceWorker, newTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
        { tabId: newTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: newTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, newTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('複製されたタブが元のタブの直下（1つ下）に表示される', () => {
    test('複製されたタブは複製元タブの直後（インデックス+1）に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      let duplicatedTabId: number | undefined;
      await expect(async () => {
        duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
          return sortedTabs[0]?.id;
        }, [initialBrowserTabId, tabId1, tabId2, tabId3]);
        expect(duplicatedTabId).toBeDefined();
      }).toPass({ timeout: 10000 });

      await waitForTabInTreeState(serviceWorker, duplicatedTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('複製されたタブは元のタブの直後に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      let duplicatedTabId: number | undefined;
      await expect(async () => {
        duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
          return sortedTabs[0]?.id;
        }, [initialBrowserTabId, tabId1]);
        expect(duplicatedTabId).toBeDefined();
      }).toPass({ timeout: 10000 });

      await waitForTabInTreeState(serviceWorker, duplicatedTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('複製されたタブが元のタブの子タブとして配置されない', () => {
    test('親タブを持つタブを複製しても、複製タブは子タブにならない', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(serviceWorker, getTestServerUrl('/page'), parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      let duplicatedTabId: number | undefined;
      await expect(async () => {
        duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
          return sortedTabs[0]?.id;
        }, [initialBrowserTabId, parentTabId, childTabId]);
        expect(duplicatedTabId).toBeDefined();
      }).toPass({ timeout: 10000 });

      await waitForTabInTreeState(serviceWorker, duplicatedTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
        { tabId: duplicatedTabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, childTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      let duplicatedTabId: number | undefined;
      await expect(async () => {
        duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
          return sortedTabs[0]?.id;
        }, [initialBrowserTabId, tabId1, tabId2]);
        expect(duplicatedTabId).toBeDefined();
      }).toPass({ timeout: 10000 });

      await waitForTabInTreeState(serviceWorker, duplicatedTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('設定が"sibling"の場合、複製されたタブは元のタブの直後に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { duplicateTabPosition: 'sibling' });
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      let duplicatedTabId: number | undefined;
      await expect(async () => {
        duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
          return sortedTabs[0]?.id;
        }, [initialBrowserTabId, tabId1, tabId2]);
        expect(duplicatedTabId).toBeDefined();
      }).toPass({ timeout: 10000 });

      await waitForTabInTreeState(serviceWorker, duplicatedTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page?parent'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const child1TabId = await createTab(serviceWorker, getTestServerUrl('/page?child1'), parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: child1TabId, depth: 1 },
      ], 0);

      const child2TabId = await createTab(serviceWorker, getTestServerUrl('/page?child2'), parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: child1TabId, depth: 1 },
        { tabId: child2TabId, depth: 1 },
      ], 0);

      const grandchildTabId = await createTab(serviceWorker, getTestServerUrl('/page?grandchild'), child2TabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      const knownTabIds = [initialBrowserTabId, parentTabId, child1TabId, child2TabId, grandchildTabId];

      let duplicatedChild2TabId: number | undefined;
      await waitForCondition(
        async () => {
          duplicatedChild2TabId = await serviceWorker.evaluate(async (excludeIds) => {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            const duplicatedChild2 = tabs.find(t => t.id && !excludeIds.includes(t.id) && t.url?.includes('child2'));
            return duplicatedChild2?.id;
          }, knownTabIds);
          return duplicatedChild2TabId !== undefined;
        },
        { timeout: 15000, timeoutMessage: 'Duplicated child2 tab was not found in Chrome tabs within timeout' }
      );

      await waitForTabInTreeState(serviceWorker, duplicatedChild2TabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: child1TabId, depth: 1 },
        { tabId: child2TabId, depth: 1, expanded: false },
        { tabId: duplicatedChild2TabId!, depth: 1, expanded: false },
      ], 0);

      await closeTab(serviceWorker, duplicatedChild2TabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: child1TabId, depth: 1 },
        { tabId: child2TabId, depth: 1, expanded: false },
      ], 0);

      await closeTab(serviceWorker, grandchildTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: child1TabId, depth: 1 },
        { tabId: child2TabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, child2TabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: child1TabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, child1TabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('複数タブ選択時の複製', () => {
    test('連続したタブを複数選択して複製すると、すべてのタブが複製される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      let duplicatedTabIds: number[] = [];
      await waitForCondition(
        async () => {
          const allTabIds = await serviceWorker.evaluate(async () => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const tabs = await chrome.tabs.query({ currentWindow: true });
            return tabs
              .filter(t => {
                const url = t.url || t.pendingUrl || '';
                return !url.startsWith(sidePanelUrlPrefix);
              })
              .map(t => t.id)
              .filter((id): id is number => id !== undefined);
          });
          duplicatedTabIds = allTabIds.filter(id => id !== initialBrowserTabId && id !== tabId1 && id !== tabId2 && id !== tabId3);
          return duplicatedTabIds.length === 2;
        },
        { timeout: 10000, timeoutMessage: 'Duplicated tabs were not created within timeout' }
      );

      for (const tabId of duplicatedTabIds) {
        await waitForTabInTreeState(serviceWorker, tabId);
      }

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: duplicatedTabIds[0], depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabIds[0], depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabIds[0], depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabIds[0], depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabIds[0]);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabIds[1]);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('飛び飛びのタブを複数選択して複製すると、すべてのタブが複製される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      let duplicatedTabIds: number[] = [];
      await waitForCondition(
        async () => {
          const allTabIds = await serviceWorker.evaluate(async () => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const tabs = await chrome.tabs.query({ currentWindow: true });
            return tabs
              .filter(t => {
                const url = t.url || t.pendingUrl || '';
                return !url.startsWith(sidePanelUrlPrefix);
              })
              .map(t => t.id)
              .filter((id): id is number => id !== undefined);
          });
          duplicatedTabIds = allTabIds.filter(id => id !== initialBrowserTabId && id !== tabId1 && id !== tabId2 && id !== tabId3);
          return duplicatedTabIds.length === 2;
        },
        { timeout: 10000, timeoutMessage: 'Duplicated tabs were not created within timeout' }
      );

      for (const tabId of duplicatedTabIds) {
        await waitForTabInTreeState(serviceWorker, tabId);
      }

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: duplicatedTabIds[0], depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabIds[0], depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabIds[0], depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabIds[0], depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabIds[0]);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabIds[1]);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('sibling設定で複数タブを複製すると、各複製タブが元のタブの直後に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { duplicateTabPosition: 'sibling' });
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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
      await tabNode1.click();

      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await tabNode2.click({ modifiers: ['Shift'] });

      await tabNode2.click({ button: 'right' });
      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      let duplicatedTab1: number | undefined;
      let duplicatedTab2: number | undefined;
      await waitForCondition(
        async () => {
          const tabOrder = await serviceWorker.evaluate(async () => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const tabs = await chrome.tabs.query({ currentWindow: true });
            return tabs
              .filter(t => {
                const url = t.url || t.pendingUrl || '';
                return !url.startsWith(sidePanelUrlPrefix);
              })
              .sort((a, b) => a.index - b.index)
              .map(t => t.id)
              .filter((id): id is number => id !== undefined);
          });
          const duplicatedTabIds = tabOrder.filter(
            id => id !== initialBrowserTabId && id !== tabId1 && id !== tabId2
          );
          if (duplicatedTabIds.length !== 2) return false;
          const tabId1Index = tabOrder.indexOf(tabId1);
          duplicatedTab1 = tabOrder[tabId1Index + 1];
          const tabId2Index = tabOrder.indexOf(tabId2);
          duplicatedTab2 = tabOrder[tabId2Index + 1];
          return duplicatedTabIds.includes(duplicatedTab1!) && duplicatedTabIds.includes(duplicatedTab2!) && duplicatedTab1 !== duplicatedTab2;
        },
        { timeout: 10000, timeoutMessage: 'Duplicated tabs were not created in correct positions within timeout' }
      );

      for (const tabId of [duplicatedTab1!, duplicatedTab2!]) {
        await waitForTabInTreeState(serviceWorker, tabId);
      }

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: duplicatedTab1!, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: duplicatedTab2!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTab1!, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: duplicatedTab2!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTab1!, depth: 0 },
        { tabId: duplicatedTab2!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTab1!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTab2!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTab2!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('sibling設定で3タブを複製すると、各複製タブが元のタブの直後に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { duplicateTabPosition: 'sibling' });
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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
      await tabNode3.click({ modifiers: ['Shift'] });

      await tabNode3.click({ button: 'right' });
      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      let duplicatedTab1: number | undefined;
      let duplicatedTab2: number | undefined;
      let duplicatedTab3: number | undefined;
      await waitForCondition(
        async () => {
          const tabOrder = await serviceWorker.evaluate(async () => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const tabs = await chrome.tabs.query({ currentWindow: true });
            return tabs
              .filter(t => {
                const url = t.url || t.pendingUrl || '';
                return !url.startsWith(sidePanelUrlPrefix);
              })
              .sort((a, b) => a.index - b.index)
              .map(t => t.id)
              .filter((id): id is number => id !== undefined);
          });
          const duplicatedTabIds = tabOrder.filter(
            id => id !== initialBrowserTabId && id !== tabId1 && id !== tabId2 && id !== tabId3
          );
          if (duplicatedTabIds.length !== 3) return false;
          const tabId1Index = tabOrder.indexOf(tabId1);
          duplicatedTab1 = tabOrder[tabId1Index + 1];
          const tabId2Index = tabOrder.indexOf(tabId2);
          duplicatedTab2 = tabOrder[tabId2Index + 1];
          const tabId3Index = tabOrder.indexOf(tabId3);
          duplicatedTab3 = tabOrder[tabId3Index + 1];
          return duplicatedTabIds.includes(duplicatedTab1!) &&
                 duplicatedTabIds.includes(duplicatedTab2!) &&
                 duplicatedTabIds.includes(duplicatedTab3!) &&
                 new Set([duplicatedTab1, duplicatedTab2, duplicatedTab3]).size === 3;
        },
        { timeout: 10000, timeoutMessage: 'Duplicated tabs were not created in correct positions within timeout' }
      );

      for (const tabId of [duplicatedTab1!, duplicatedTab2!, duplicatedTab3!]) {
        await waitForTabInTreeState(serviceWorker, tabId);
      }

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: duplicatedTab1!, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: duplicatedTab2!, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: duplicatedTab3!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTab1!, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: duplicatedTab2!, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: duplicatedTab3!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTab1!, depth: 0 },
        { tabId: duplicatedTab2!, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: duplicatedTab3!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTab1!, depth: 0 },
        { tabId: duplicatedTab2!, depth: 0 },
        { tabId: duplicatedTab3!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTab1!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTab2!, depth: 0 },
        { tabId: duplicatedTab3!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTab2!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTab3!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTab3!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('end設定で複数タブを複製すると、全ての複製タブがリストの最後に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { duplicateTabPosition: 'end' });
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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
      await tabNode1.click();

      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await tabNode2.click({ modifiers: ['Shift'] });

      await tabNode2.click({ button: 'right' });
      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      let duplicatedTabIds: number[] = [];
      await waitForCondition(
        async () => {
          const tabOrder = await serviceWorker.evaluate(async () => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const tabs = await chrome.tabs.query({ currentWindow: true });
            return tabs
              .filter(t => {
                const url = t.url || t.pendingUrl || '';
                return !url.startsWith(sidePanelUrlPrefix);
              })
              .sort((a, b) => a.index - b.index)
              .map(t => t.id)
              .filter((id): id is number => id !== undefined);
          });
          duplicatedTabIds = tabOrder.filter(
            id => id !== initialBrowserTabId && id !== tabId1 && id !== tabId2
          );
          return duplicatedTabIds.length === 2;
        },
        { timeout: 10000, timeoutMessage: 'Duplicated tabs were not created within timeout' }
      );

      for (const tabId of duplicatedTabIds) {
        await waitForTabInTreeState(serviceWorker, tabId);
      }

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: duplicatedTabIds[0], depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: duplicatedTabIds[0], depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabIds[0], depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabIds[0]);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: duplicatedTabIds[1], depth: 0 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabIds[1]);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });
});
