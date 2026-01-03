/**
 * E2E Tests: Cross-Window Drag and Drop Tab Movement
 *
 * cross-window-drag-drop.spec.ts の書き直し
 * クロスウィンドウドラッグE2Eテストの検証
 *
 * Note: Run with `npm run test:e2e`
 */
import { test, expect } from './fixtures/extension';
import { createWindow, moveTabToWindow, openSidePanelForWindow } from './utils/window-utils';
import { createTab } from './utils/tab-utils';
import { assertTabStructure } from './utils/drag-drop-utils';
import {
  waitForTabInTreeState,
  waitForSidePanelReady,
  waitForTabInWindow,
  waitForCondition,
} from './utils/polling-utils';
import type { DragSession } from '../src/background/drag-session-manager';
import type { MessageResponse, TabNode } from '../src/types';

test.describe('Cross-Window Drag and Drop Tab Movement', () => {
  test.describe('DragSessionManager Integration', () => {
    test('should start drag session with correct state', async ({
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

      // Open side panel
      const sidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
      await waitForSidePanelReady(sidePanel, serviceWorker);

      // Start a drag session via message
      const startResult = await sidePanel.evaluate(
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
      expect(startResult.data?.currentWindowId).toBe(originalWindowId);
      expect(startResult.data?.state).toBe('dragging_local');
      expect(startResult.data?.isLocked).toBe(false);

      // Clean up: end the session
      await sidePanel.evaluate(() => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'END_DRAG_SESSION', payload: { reason: 'TEST_CLEANUP' } },
            () => resolve()
          );
        });
      });
    });

    test('should get current drag session', async ({
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

      // Open side panel
      const sidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
      await waitForSidePanelReady(sidePanel, serviceWorker);

      // Start a drag session
      await sidePanel.evaluate(
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

      // Get the session
      const getResult = await sidePanel.evaluate(async () => {
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
      expect(getResult.data?.state).toBe('dragging_local');

      // Clean up
      await sidePanel.evaluate(() => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'END_DRAG_SESSION', payload: { reason: 'TEST_CLEANUP' } },
            () => resolve()
          );
        });
      });
    });

    test('should end drag session and return null on get', async ({
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

      // Open side panel
      const sidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
      await waitForSidePanelReady(sidePanel, serviceWorker);

      // Start a drag session
      await sidePanel.evaluate(
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

      // End the session
      const endResult = await sidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'END_DRAG_SESSION', payload: { reason: 'COMPLETED' } },
            (response) => resolve(response as MessageResponse<null>)
          );
        });
        return response;
      });

      expect(endResult.success).toBe(true);

      // Get the session (should be null)
      const getResult = await sidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response;
      });

      expect(getResult.success).toBe(true);
      expect(getResult.data).toBeNull();
    });
  });

  test.describe('Cross-Window Move Operations', () => {
    test('should move tab to destination window via BEGIN_CROSS_WINDOW_MOVE', async ({
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

      // Open side panels for both windows
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

      // Move tab to new window via BEGIN_CROSS_WINDOW_MOVE
      const moveResult = await newSidePanel.evaluate(
        async ({ targetWindowId }) => {
          const response = await new Promise<MessageResponse<void>>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'BEGIN_CROSS_WINDOW_MOVE',
                payload: { targetWindowId },
              },
              (response) => resolve(response as MessageResponse<void>)
            );
          });
          return response;
        },
        { targetWindowId: newWindowId }
      );

      expect(moveResult.success).toBe(true);

      // Wait for tab to appear in new window
      await waitForTabInWindow(extensionContext, tabId, newWindowId);

      // Verify tab is now in the new window
      const tabAfterMove = await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.get(tabId),
        { tabId }
      );
      expect(tabAfterMove.windowId).toBe(newWindowId);

      // Verify session state updated
      const sessionAfterMove = await newSidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response.data;
      });

      expect(sessionAfterMove).not.toBeNull();
      expect(sessionAfterMove?.currentWindowId).toBe(newWindowId);
      expect(sessionAfterMove?.state).toBe('dragging_cross_window');

      // Clean up
      await newSidePanel.evaluate(() => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'END_DRAG_SESSION', payload: { reason: 'TEST_CLEANUP' } },
            () => resolve()
          );
        });
      });
    });

    test('should detect cross-window drag from different window', async ({
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

      // Open side panels for both windows
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

      // From new window, get session and check if it's from a different window
      const sessionFromNewWindow = await newSidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response.data;
      });

      const currentWindowIdFromNewPanel = await newSidePanel.evaluate(() => {
        return new Promise<number>((resolve) => {
          chrome.windows.getCurrent((window) => {
            resolve(window.id as number);
          });
        });
      });

      expect(sessionFromNewWindow).not.toBeNull();
      expect(sessionFromNewWindow?.tabId).toBe(tabId);
      expect(sessionFromNewWindow?.sourceWindowId).toBe(originalWindowId);

      // Cross-window detection: source window != current window
      const isCrossWindowDrag = sessionFromNewWindow?.currentWindowId !== currentWindowIdFromNewPanel;
      expect(isCrossWindowDrag).toBe(true);

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

    test('tab should belong to destination window after cross-window move', async ({
      extensionContext,
      serviceWorker,
    }) => {
      // Get original window ID
      const originalWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const originalWindowId = originalWindow.id as number;

      // Create multiple tabs in original window
      const tabId1 = await createTab(extensionContext, 'https://example.com/tab1');
      const tabId2 = await createTab(extensionContext, 'https://example.com/tab2');
      expect(tabId1).toBeGreaterThan(0);
      expect(tabId2).toBeGreaterThan(0);

      // Wait for tabs to appear in tree state
      await waitForTabInTreeState(extensionContext, tabId1);
      await waitForTabInTreeState(extensionContext, tabId2);

      // Create a new window
      const newWindowId = await createWindow(extensionContext);
      expect(newWindowId).toBeGreaterThan(0);

      // Verify both tabs belong to original window before move
      const tabsBeforeMove = await serviceWorker.evaluate(({ windowId }) => {
        return chrome.tabs.query({ windowId });
      }, { windowId: originalWindowId });

      const tab1InOriginal = tabsBeforeMove.find((tab: chrome.tabs.Tab) => tab.id === tabId1);
      const tab2InOriginal = tabsBeforeMove.find((tab: chrome.tabs.Tab) => tab.id === tabId2);
      expect(tab1InOriginal).toBeDefined();
      expect(tab2InOriginal).toBeDefined();

      // Open side panels
      const originalSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
      await waitForSidePanelReady(originalSidePanel, serviceWorker);

      const newSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
      await waitForSidePanelReady(newSidePanel, serviceWorker);

      // Start drag session for tab1
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
        { tabId: tabId1, windowId: originalWindowId }
      );

      // Move tab1 to new window
      await newSidePanel.evaluate(
        async ({ targetWindowId }) => {
          await new Promise<void>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'BEGIN_CROSS_WINDOW_MOVE',
                payload: { targetWindowId },
              },
              () => resolve()
            );
          });
        },
        { targetWindowId: newWindowId }
      );

      // Wait for tab to move
      await waitForTabInWindow(extensionContext, tabId1, newWindowId);

      // End the session
      await newSidePanel.evaluate(() => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'END_DRAG_SESSION', payload: { reason: 'COMPLETED' } },
            () => resolve()
          );
        });
      });

      // Verify tab1 belongs to new window
      const tab1AfterMove = await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.get(tabId),
        { tabId: tabId1 }
      );
      expect(tab1AfterMove.windowId).toBe(newWindowId);

      // Verify tab2 still belongs to original window
      const tab2AfterMove = await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.get(tabId),
        { tabId: tabId2 }
      );
      expect(tab2AfterMove.windowId).toBe(originalWindowId);

      // Verify window tab counts
      const tabsInOriginal = await serviceWorker.evaluate(
        ({ windowId }) => chrome.tabs.query({ windowId }),
        { windowId: originalWindowId }
      );
      const tabsInNew = await serviceWorker.evaluate(
        ({ windowId }) => chrome.tabs.query({ windowId }),
        { windowId: newWindowId }
      );

      // tab1 should be in new window
      expect(tabsInNew.find((tab: chrome.tabs.Tab) => tab.id === tabId1)).toBeDefined();
      // tab1 should not be in original window
      expect(tabsInOriginal.find((tab: chrome.tabs.Tab) => tab.id === tabId1)).toBeUndefined();
      // tab2 should still be in original window
      expect(tabsInOriginal.find((tab: chrome.tabs.Tab) => tab.id === tabId2)).toBeDefined();
    });
  });

  test.describe('UI Tree Synchronization', () => {
    test('moved tab should appear in destination window tree and disappear from source', async ({
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

      // Open side panels for both windows
      const originalSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
      await waitForSidePanelReady(originalSidePanel, serviceWorker);

      const newSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
      await waitForSidePanelReady(newSidePanel, serviceWorker);

      // Verify tab is visible in original window's tree
      const treeNodeInOriginal = originalSidePanel.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(treeNodeInOriginal).toBeVisible();

      // Move tab to new window using chrome.tabs.move (simulating completed drop)
      await moveTabToWindow(extensionContext, tabId, newWindowId);

      // Wait for tab to appear in new window
      await waitForTabInWindow(extensionContext, tabId, newWindowId);

      // Reload side panels to reflect the change
      await newSidePanel.reload();
      await waitForSidePanelReady(newSidePanel, serviceWorker);

      await originalSidePanel.reload();
      await waitForSidePanelReady(originalSidePanel, serviceWorker);

      // Tab should appear in new window's tree
      const treeNodeInNew = newSidePanel.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(treeNodeInNew).toBeVisible({ timeout: 10000 });

      // Tab should not appear in original window's tree
      await expect(treeNodeInOriginal).not.toBeVisible();
    });

    test('tab tree should reflect correct window after cross-window move via session', async ({
      extensionContext,
      serviceWorker,
    }) => {
      // Get original window ID
      const originalWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const originalWindowId = originalWindow.id as number;

      // Create a tab with specific URL for identification
      const tabUrl = 'https://example.com/cross-window-test';
      const tabId = await createTab(extensionContext, tabUrl);
      expect(tabId).toBeGreaterThan(0);

      // Wait for tab to appear in tree state
      await waitForTabInTreeState(extensionContext, tabId);

      // Create a new window
      const newWindowId = await createWindow(extensionContext);
      expect(newWindowId).toBeGreaterThan(0);

      // Open side panels for both windows
      const originalSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
      await waitForSidePanelReady(originalSidePanel, serviceWorker);

      const newSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
      await waitForSidePanelReady(newSidePanel, serviceWorker);

      // Get tree node count in original window before move
      const originalTreeNodesBeforeMove = await originalSidePanel
        .locator('[data-testid^="tree-node-"]')
        .count();

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

      // Move via BEGIN_CROSS_WINDOW_MOVE
      await newSidePanel.evaluate(
        async ({ targetWindowId }) => {
          await new Promise<void>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'BEGIN_CROSS_WINDOW_MOVE',
                payload: { targetWindowId },
              },
              () => resolve()
            );
          });
        },
        { targetWindowId: newWindowId }
      );

      // Wait for tab to move
      await waitForTabInWindow(extensionContext, tabId, newWindowId);

      // End the session
      await newSidePanel.evaluate(() => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'END_DRAG_SESSION', payload: { reason: 'COMPLETED' } },
            () => resolve()
          );
        });
      });

      // Reload side panels
      await newSidePanel.reload();
      await waitForSidePanelReady(newSidePanel, serviceWorker);

      await originalSidePanel.reload();
      await waitForSidePanelReady(originalSidePanel, serviceWorker);

      // Tab should be in new window's tree
      const treeNodeInNew = newSidePanel.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(treeNodeInNew).toBeVisible({ timeout: 10000 });

      // Tab should not be in original window's tree
      const treeNodeInOriginal = originalSidePanel.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(treeNodeInOriginal).not.toBeVisible();

      // Original window should have one less tree node
      const originalTreeNodesAfterMove = await originalSidePanel
        .locator('[data-testid^="tree-node-"]')
        .count();

      // The moved tab should be gone from original window
      expect(originalTreeNodesAfterMove).toBeLessThan(originalTreeNodesBeforeMove);
    });
  });

  test.describe('Session Lifecycle', () => {
    test('cross-window drag state should be cleared after session end', async ({
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

      // Verify session exists
      const sessionBefore = await newSidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response.data;
      });

      expect(sessionBefore).not.toBeNull();

      // Move tab and complete the session
      await newSidePanel.evaluate(
        async ({ targetWindowId }) => {
          await new Promise<void>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'BEGIN_CROSS_WINDOW_MOVE',
                payload: { targetWindowId },
              },
              () => resolve()
            );
          });
        },
        { targetWindowId: newWindowId }
      );

      // End the session
      await newSidePanel.evaluate(() => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'END_DRAG_SESSION', payload: { reason: 'COMPLETED' } },
            () => resolve()
          );
        });
      });

      // Verify session is cleared
      const sessionAfter = await newSidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response.data;
      });

      expect(sessionAfter).toBeNull();
    });

    test('should handle session replacement when new session starts', async ({
      extensionContext,
      serviceWorker,
    }) => {
      // Get original window ID
      const originalWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const originalWindowId = originalWindow.id as number;

      // Create two tabs
      const tabId1 = await createTab(extensionContext, 'https://example.com/tab1');
      const tabId2 = await createTab(extensionContext, 'https://example.com/tab2');
      expect(tabId1).toBeGreaterThan(0);
      expect(tabId2).toBeGreaterThan(0);

      // Wait for tabs to appear in tree state
      await waitForTabInTreeState(extensionContext, tabId1);
      await waitForTabInTreeState(extensionContext, tabId2);

      // Open side panel
      const sidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
      await waitForSidePanelReady(sidePanel, serviceWorker);

      // Start first session
      await sidePanel.evaluate(
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
        { tabId: tabId1, windowId: originalWindowId }
      );

      // Verify first session
      const session1 = await sidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response.data;
      });

      expect(session1?.tabId).toBe(tabId1);

      // Start second session (should replace first)
      await sidePanel.evaluate(
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
        { tabId: tabId2, windowId: originalWindowId }
      );

      // Verify second session replaced first
      const session2 = await sidePanel.evaluate(async () => {
        const response = await new Promise<MessageResponse<DragSession | null>>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DRAG_SESSION' },
            (response) => resolve(response as MessageResponse<DragSession | null>)
          );
        });
        return response.data;
      });

      expect(session2?.tabId).toBe(tabId2);
      expect(session2?.sessionId).not.toBe(session1?.sessionId);

      // Clean up
      await sidePanel.evaluate(() => {
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
