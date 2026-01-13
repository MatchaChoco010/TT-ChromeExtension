import { test, expect } from './fixtures/extension';
import {
  createTab,
  activateTab,
  getTestServerUrl,
  getCurrentWindowId,
  pinTab,
} from './utils/tab-utils';
import { assertTabStructure, assertPinnedTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('ピン留めタブと通常タブのアクティブ状態のハイライト', () => {
  test('ピン留めタブをアクティブにすると通常タブのハイライトが消える', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const normalTabId = await createTab(serviceWorker, getTestServerUrl('/page?normal'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: normalTabId, depth: 0 },
    ], 0);

    await activateTab(serviceWorker, normalTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: normalTabId, depth: 0 },
    ], 0);

    const normalTabNode = sidePanelPage.locator(`[data-testid="tree-node-${normalTabId}"]`);
    await expect(normalTabNode).toHaveClass(/bg-gray-600/);

    await pinTab(serviceWorker, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: normalTabId, depth: 0 },
    ], 0);
    await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: initialBrowserTabId }], 0);

    await activateTab(serviceWorker, initialBrowserTabId);

    const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${initialBrowserTabId}"]`);
    await expect(pinnedTab).toHaveClass(/bg-gray-600/);

    await expect(normalTabNode).not.toHaveClass(/bg-gray-600/);
  });

  test('通常タブをアクティブにするとピン留めタブのハイライトが消える', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const normalTabId = await createTab(serviceWorker, getTestServerUrl('/page?normal'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: normalTabId, depth: 0 },
    ], 0);

    await pinTab(serviceWorker, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: normalTabId, depth: 0 },
    ], 0);
    await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: initialBrowserTabId }], 0);

    await activateTab(serviceWorker, initialBrowserTabId);

    const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${initialBrowserTabId}"]`);
    await expect(pinnedTab).toHaveClass(/bg-gray-600/);

    await activateTab(serviceWorker, normalTabId);

    const normalTabNode = sidePanelPage.locator(`[data-testid="tree-node-${normalTabId}"]`);
    await expect(normalTabNode).toHaveClass(/bg-gray-600/);

    await expect(pinnedTab).not.toHaveClass(/bg-gray-600/);
  });
});
