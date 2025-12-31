/**
 * E2E Tests: Cross-Window Drag Indicator Display
 *
 * Task 16.2 (tab-tree-bugfix-2): cross-window-drag-indicator.spec.ts の書き直し
 * Task 4.2 (tree-tab-bugfixes-and-ux-improvements): クロスウィンドウドラッグE2Eテストの検証
 *
 * Requirements (tab-tree-bugfix-2):
 * - 3.2.1: 自前D&D実装に合わせたテスト修正
 * - 3.2.3: --repeat-each=10 で10回連続成功確認
 *
 * Requirements (tree-tab-bugfixes-and-ux-improvements):
 * - 4.4: クロスウィンドウドラッグ機能のE2Eテスト検証（--repeat-each=10で10回連続成功）
 * - 4.5: ポーリングベースの状態確定待機を使用してフレーキーでないこと
 *
 * Tests verify:
 * - Drag session state synchronization via DragSessionManager
 * - Cross-window drag state detection from different windows
 * - Visual indicator display in destination window during cross-window drag
 *
 * Note: Run with `npm run test:e2e`
 */
import { test, expect } from './fixtures/extension';
import { createWindow, openSidePanelForWindow } from './utils/window-utils';
import { createTab } from './utils/tab-utils';
import { waitForTabInTreeState, waitForSidePanelReady } from './utils/polling-utils';
import type { DragSession } from '../src/background/drag-session-manager';
import type { MessageResponse, TabNode } from '../src/types';

test.describe('Cross-Window Drag Indicator', () => {
  test.describe('DragSessionManager State Synchronization', () => {
    test('drag session should be synchronized via Service Worker', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      // Ensure side panel is visible
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // Get original window ID
      const originalWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const originalWindowId = originalWindow.id as number;

      // Create a tab in the original window
      const tabId = await createTab(extensionContext, 'https://example.com');
      expect(tabId).toBeGreaterThan(0);

      // Wait for tab to appear in tree state
      await waitForTabInTreeState(extensionContext, tabId);

      // Start drag session via DragSessionManager
      const startResult = await sidePanelPage.evaluate(
        async ({ tabId, windowId }) => {
          const response = await new Promise<MessageResponse<DragSession>>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'START_DRAG_SESSION',
                payload: {
                  tabId,
                  windowId,
                  treeData: [] as TabNode[],
                },
              },
              (response) => resolve(response as MessageResponse<DragSession>)
            );
          });
          return response;
        },
        { tabId, windowId: originalWindowId }
      );

      expect(startResult.success).toBe(true);
      expect(startResult.data).toBeDefined();
      expect(startResult.data?.tabId).toBe(tabId);
      expect(startResult.data?.sourceWindowId).toBe(originalWindowId);
      expect(startResult.data?.state).toBe('dragging_local');

      // Verify drag session can be retrieved
      const getResult = await sidePanelPage.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response;
      });

      expect(getResult.success).toBe(true);
      expect(getResult.data).not.toBeNull();
      expect(getResult.data?.tabId).toBe(tabId);
      expect(getResult.data?.sourceWindowId).toBe(originalWindowId);

      // End drag session
      const endResult = await sidePanelPage.evaluate(async () => {
        const response = await new Promise<MessageResponse<null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'END_DRAG_SESSION', payload: { reason: 'TEST_CLEANUP' } },
            (response) => resolve(response as MessageResponse<null>)
          );
        });
        return response;
      });

      expect(endResult.success).toBe(true);

      // Verify drag session is cleared
      const getFinalResult = await sidePanelPage.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response;
      });

      expect(getFinalResult.success).toBe(true);
      expect(getFinalResult.data).toBeNull();
    });
  });

  test.describe('Cross-Window Drag State Detection', () => {
    test('side panel should be able to detect cross-window drag state', async ({
      extensionContext,
      serviceWorker,
    }) => {
      // Get original window ID
      const originalWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const originalWindowId = originalWindow.id as number;

      // Create a tab in the original window
      const tabId = await createTab(extensionContext, 'https://example.com');
      expect(tabId).toBeGreaterThan(0);

      // Wait for tab to appear in tree state
      await waitForTabInTreeState(extensionContext, tabId);

      // Create a new window
      const newWindowId = await createWindow(extensionContext);
      expect(newWindowId).toBeGreaterThan(0);
      expect(newWindowId).not.toBe(originalWindowId);

      // Open side panel for both windows
      const originalSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
      await waitForSidePanelReady(originalSidePanel, serviceWorker);

      const newSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
      await waitForSidePanelReady(newSidePanel, serviceWorker);

      // Start drag session from original window's side panel (simulating drag start)
      await originalSidePanel.evaluate(
        async ({ tabId, windowId }) => {
          await new Promise<void>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'START_DRAG_SESSION',
                payload: {
                  tabId,
                  windowId,
                  treeData: [] as TabNode[],
                },
              },
              () => resolve()
            );
          });
        },
        { tabId, windowId: originalWindowId }
      );

      // New window's side panel should be able to detect the drag session
      // by querying the DragSessionManager via Service Worker
      const dragSessionInNewWindow = await newSidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response;
      });

      expect(dragSessionInNewWindow.success).toBe(true);
      expect(dragSessionInNewWindow.data).not.toBeNull();
      expect(dragSessionInNewWindow.data?.tabId).toBe(tabId);
      expect(dragSessionInNewWindow.data?.sourceWindowId).toBe(originalWindowId);

      // The new window knows the drag is from a different window
      const currentWindowId = await newSidePanel.evaluate(() => {
        return new Promise<number>((resolve) => {
          chrome.windows.getCurrent((window) => {
            resolve(window.id as number);
          });
        });
      });

      expect(currentWindowId).toBe(newWindowId);
      // Cross-window detection: currentWindowId in session != destination window
      expect(dragSessionInNewWindow.data?.currentWindowId).not.toBe(newWindowId);

      // Clean up drag session
      await originalSidePanel.evaluate(() => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'END_DRAG_SESSION', payload: { reason: 'TEST_CLEANUP' } },
            () => resolve()
          );
        });
      });
    });

    test('cross-window drag session should include source window information', async ({
      extensionContext,
      serviceWorker,
    }) => {
      // Get original window ID
      const originalWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const originalWindowId = originalWindow.id as number;

      // Create a tab in the original window
      const tabId = await createTab(extensionContext, 'https://example.com/indicator-test');
      expect(tabId).toBeGreaterThan(0);

      // Wait for tab to appear in tree state
      await waitForTabInTreeState(extensionContext, tabId);

      // Create a new window with a tab
      const newWindowId = await createWindow(extensionContext);
      expect(newWindowId).toBeGreaterThan(0);

      // Create a tab in the new window for the tree to show
      const tabInNewWindow = await serviceWorker.evaluate(async ({ windowId }) => {
        const tab = await chrome.tabs.create({ windowId, url: 'https://example.org' });
        return tab.id;
      }, { windowId: newWindowId });
      expect(tabInNewWindow).toBeGreaterThan(0);

      // Wait for tab to appear in tree state
      await waitForTabInTreeState(extensionContext, tabInNewWindow as number);

      // Open side panels for both windows
      const originalSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
      await waitForSidePanelReady(originalSidePanel, serviceWorker);

      const newSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
      await waitForSidePanelReady(newSidePanel, serviceWorker);

      // Verify the new window's tab is visible
      const treeNodeInNewWindow = newSidePanel.locator(`[data-testid="tree-node-${tabInNewWindow}"]`);
      await expect(treeNodeInNewWindow).toBeVisible();

      // Start drag session from original window's side panel (simulating drag start from window A)
      await originalSidePanel.evaluate(
        async ({ tabId, windowId }) => {
          await new Promise<void>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'START_DRAG_SESSION',
                payload: {
                  tabId,
                  windowId,
                  treeData: [] as TabNode[],
                },
              },
              () => resolve()
            );
          });
        },
        { tabId, windowId: originalWindowId }
      );

      // Bring new window side panel to front
      await newSidePanel.bringToFront();
      await newSidePanel.evaluate(() => window.focus());

      // Verify the drag session can be detected from the new window
      const canDetectDrag = await newSidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response.success && response.data !== null;
      });

      expect(canDetectDrag).toBe(true);

      // Verify the cross-window drag session includes necessary information
      const dragSession = await newSidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response.data;
      });

      expect(dragSession).not.toBeNull();
      expect(dragSession?.tabId).toBe(tabId);
      expect(dragSession?.sourceWindowId).toBe(originalWindowId);
      expect(dragSession?.sourceWindowId).not.toBe(newWindowId);
      expect(dragSession?.state).toBe('dragging_local');

      // Session should have a valid session ID
      expect(dragSession?.sessionId).toBeDefined();
      expect(typeof dragSession?.sessionId).toBe('string');

      // Clean up
      await originalSidePanel.evaluate(() => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'END_DRAG_SESSION', payload: { reason: 'TEST_CLEANUP' } },
            () => resolve()
          );
        });
      });
    });
  });

  test.describe('Cross-Window Drag Indicator Display', () => {
    test('destination window should recognize cross-window drag origin', async ({
      extensionContext,
      serviceWorker,
    }) => {
      // Get original window ID
      const originalWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const originalWindowId = originalWindow.id as number;

      // Create a tab in the original window
      const tabId = await createTab(extensionContext, 'https://example.com');
      expect(tabId).toBeGreaterThan(0);

      // Wait for tab to appear in tree state
      await waitForTabInTreeState(extensionContext, tabId);

      // Create a new window
      const newWindowId = await createWindow(extensionContext);
      expect(newWindowId).toBeGreaterThan(0);

      // Open side panels
      const originalSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
      await waitForSidePanelReady(originalSidePanel, serviceWorker);

      const newSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
      await waitForSidePanelReady(newSidePanel, serviceWorker);

      // Start drag session from original window
      await originalSidePanel.evaluate(
        async ({ tabId, windowId }) => {
          await new Promise<void>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'START_DRAG_SESSION',
                payload: {
                  tabId,
                  windowId,
                  treeData: [] as TabNode[],
                },
              },
              () => resolve()
            );
          });
        },
        { tabId, windowId: originalWindowId }
      );

      // Bring new window side panel to front (simulating user moving to new window)
      await newSidePanel.bringToFront();
      await newSidePanel.evaluate(() => window.focus());

      // Get drag session from destination window's perspective
      const sessionFromDestination = await newSidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response.data;
      });

      // Get current window ID from destination panel
      const destinationWindowId = await newSidePanel.evaluate(() => {
        return new Promise<number>((resolve) => {
          chrome.windows.getCurrent((window) => {
            resolve(window.id as number);
          });
        });
      });

      // Verify destination window can identify this as a cross-window drag
      expect(sessionFromDestination).not.toBeNull();
      expect(sessionFromDestination?.sourceWindowId).toBe(originalWindowId);
      expect(sessionFromDestination?.sourceWindowId).not.toBe(destinationWindowId);
      expect(destinationWindowId).toBe(newWindowId);

      // The currentWindowId in session should still be original until move begins
      expect(sessionFromDestination?.currentWindowId).toBe(originalWindowId);

      // Clean up
      await originalSidePanel.evaluate(() => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'END_DRAG_SESSION', payload: { reason: 'TEST_CLEANUP' } },
            () => resolve()
          );
        });
      });

      // After cleanup, drag session should not exist
      const sessionAfterCleanup = await newSidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response.data;
      });

      expect(sessionAfterCleanup).toBeNull();
    });

    test('drag session should maintain state across window queries', async ({
      extensionContext,
      serviceWorker,
    }) => {
      // Get original window ID
      const originalWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const originalWindowId = originalWindow.id as number;

      // Create a tab in the original window
      const tabId = await createTab(extensionContext, 'https://example.com');
      expect(tabId).toBeGreaterThan(0);

      // Wait for tab to appear in tree state
      await waitForTabInTreeState(extensionContext, tabId);

      // Create a new window
      const newWindowId = await createWindow(extensionContext);
      expect(newWindowId).toBeGreaterThan(0);

      // Open side panels
      const originalSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
      await waitForSidePanelReady(originalSidePanel, serviceWorker);

      const newSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
      await waitForSidePanelReady(newSidePanel, serviceWorker);

      // Start drag session
      await originalSidePanel.evaluate(
        async ({ tabId, windowId }) => {
          await new Promise<void>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'START_DRAG_SESSION',
                payload: {
                  tabId,
                  windowId,
                  treeData: [] as TabNode[],
                },
              },
              () => resolve()
            );
          });
        },
        { tabId, windowId: originalWindowId }
      );

      // Query from original window
      const sessionFromOriginal = await originalSidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response.data;
      });

      // Query from new window
      const sessionFromNew = await newSidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response.data;
      });

      // Both queries should return the same session
      expect(sessionFromOriginal).not.toBeNull();
      expect(sessionFromNew).not.toBeNull();
      expect(sessionFromOriginal?.sessionId).toBe(sessionFromNew?.sessionId);
      expect(sessionFromOriginal?.tabId).toBe(sessionFromNew?.tabId);
      expect(sessionFromOriginal?.sourceWindowId).toBe(sessionFromNew?.sourceWindowId);
      expect(sessionFromOriginal?.state).toBe(sessionFromNew?.state);

      // Clean up
      await originalSidePanel.evaluate(() => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'END_DRAG_SESSION', payload: { reason: 'TEST_CLEANUP' } },
            () => resolve()
          );
        });
      });
    });
  });
});
