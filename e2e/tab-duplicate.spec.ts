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

      const newTabId = await serviceWorker.evaluate(async (originalTabId) => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const sortedTabs = tabs.filter(t => t.id && t.id !== originalTabId).sort((a, b) => (b.id || 0) - (a.id || 0));
        return sortedTabs[0]?.id;
      }, tabId);

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

      const duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
        return sortedTabs[0]?.id;
      }, [tabId1, tabId2, tabId3]);

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

      const duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
        return sortedTabs[0]?.id;
      }, [tabId1]);

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

      const duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
        return sortedTabs[0]?.id;
      }, [parentTabId, childTabId]);

      await waitForTabInTreeState(serviceWorker, duplicatedTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
        { tabId: duplicatedTabId!, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, duplicatedTabId!);
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

      const duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
        return sortedTabs[0]?.id;
      }, [tabId1, tabId2]);

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

      const duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
        return sortedTabs[0]?.id;
      }, [tabId1, tabId2]);

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

  test.describe('複数タブ選択時の複製', () => {
    test('連続したタブを複数選択して複製すると、すべてのタブが複製される', async ({
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

      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await tabNode2.click({ modifiers: ['Shift'] });

      await tabNode2.click({ button: 'right' });

      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      await expect.poll(async () => {
        const tabs = await serviceWorker.evaluate(async () => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          return tabs.map(t => t.id).filter((id): id is number => id !== undefined);
        });
        return tabs.length;
      }, { timeout: 5000 }).toBe(7);

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

      await expect.poll(async () => {
        const tabs = await serviceWorker.evaluate(async () => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          return tabs.map(t => t.id).filter((id): id is number => id !== undefined);
        });
        return tabs.length;
      }, { timeout: 5000 }).toBe(7);

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
  });
});
