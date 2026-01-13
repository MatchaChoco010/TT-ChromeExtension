import { test, expect } from './fixtures/extension';
import { waitForCondition } from './utils/polling-utils';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';
import './types';

test.describe('Tree Structure Persistence', () => {
  test.describe('複数階層の親子関係の永続化', () => {
    test('3階層（親→子→孫）の親子関係がtreeStructureに保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      await setupWindow(extensionContext, serviceWorker, windowId);

      // 1. 親タブを作成
      const parentUrl = getTestServerUrl('/page');
      const parentTabId = await createTab(serviceWorker, parentUrl, undefined, { active: false });

      // 2. 子タブを作成（parentTabIdを親として）
      const childUrl = getTestServerUrl('/page2');
      const childTabId = await createTab(serviceWorker, childUrl, parentTabId, { active: false });

      // 3. 孫タブを作成（childTabIdを親として）
      const grandchildUrl = getTestServerUrl('/page3');
      await createTab(serviceWorker, grandchildUrl, childTabId, { active: false });

      // 4. 少し待機してtreeStructureが保存されるのを待つ
      await new Promise(resolve => setTimeout(resolve, 500));

      // 5. treeStructureがストレージに保存されていることを確認
      const treeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: unknown[] };
        return treeState?.treeStructure;
      });

      expect(treeStructure).toBeDefined();
      expect(Array.isArray(treeStructure)).toBe(true);

      // 5. 親子関係（parentIndex）が正しく保存されていることを確認
      interface TreeStructureEntry {
        url: string;
        parentIndex: number | null;
        viewId: string;
        isExpanded: boolean;
      }

      const entries = treeStructure as TreeStructureEntry[];

      // 各タブのURLで検索
      const parentEntry = entries.find(e => e.url.includes('/page') && !e.url.includes('/page2') && !e.url.includes('/page3'));
      const childEntry = entries.find(e => e.url.includes('/page2'));
      const grandchildEntry = entries.find(e => e.url.includes('/page3'));

      expect(parentEntry).toBeDefined();
      expect(childEntry).toBeDefined();
      expect(grandchildEntry).toBeDefined();

      // 親タブはparentIndexがnull
      expect(parentEntry?.parentIndex).toBeNull();

      // 子タブは親タブのインデックスを指す
      const parentIndex = entries.indexOf(parentEntry!);
      expect(childEntry?.parentIndex).toBe(parentIndex);

      // 孫タブは子タブのインデックスを指す
      const childIndex = entries.indexOf(childEntry!);
      expect(grandchildEntry?.parentIndex).toBe(childIndex);

      // クリーンアップ（テストで作成したタブをURLで検索してクローズ）
      await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.id && (tab.url?.includes('/page3') || tab.url?.includes('/page2') || (tab.url?.includes('/page') && !tab.url?.includes('/page2') && !tab.url?.includes('/page3')))) {
            try { await chrome.tabs.remove(tab.id); } catch { /* ignore */ }
          }
        }
      });
    });

    test('4階層（親→子→孫→ひ孫）の親子関係がtreeStructureに保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      await setupWindow(extensionContext, serviceWorker, windowId);

      // 1. 親タブを作成
      const parentUrl = getTestServerUrl('/page');
      const parentTabId = await createTab(serviceWorker, parentUrl, undefined, { active: false });

      // 2. 子タブを作成
      const childUrl = getTestServerUrl('/page2');
      const childTabId = await createTab(serviceWorker, childUrl, parentTabId, { active: false });

      // 3. 孫タブを作成
      const grandchildUrl = getTestServerUrl('/page3');
      const grandchildTabId = await createTab(serviceWorker, grandchildUrl, childTabId, { active: false });

      // 4. ひ孫タブを作成
      const greatGrandchildUrl = getTestServerUrl('/page4');
      const greatGrandchildTabId = await createTab(serviceWorker, greatGrandchildUrl, grandchildTabId, { active: false });

      // 5. 少し待機してtreeStructureが保存されるのを待つ
      await new Promise(resolve => setTimeout(resolve, 500));

      // 6. treeStructureを確認
      interface TreeStructureEntry {
        url: string;
        parentIndex: number | null;
        viewId: string;
        isExpanded: boolean;
      }

      const treeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: unknown[] };
        return treeState?.treeStructure;
      }) as TreeStructureEntry[];

      // 各タブを検索
      const parentEntry = entries(treeStructure, '/page');
      const childEntry = entries(treeStructure, '/page2');
      const grandchildEntry = entries(treeStructure, '/page3');
      const greatGrandchildEntry = entries(treeStructure, '/page4');

      // 親子関係の連鎖を確認
      expect(parentEntry?.parentIndex).toBeNull();

      const parentIdx = treeStructure.indexOf(parentEntry!);
      expect(childEntry?.parentIndex).toBe(parentIdx);

      const childIdx = treeStructure.indexOf(childEntry!);
      expect(grandchildEntry?.parentIndex).toBe(childIdx);

      const grandchildIdx = treeStructure.indexOf(grandchildEntry!);
      expect(greatGrandchildEntry?.parentIndex).toBe(grandchildIdx);

      // クリーンアップ
      await closeTab(serviceWorker, greatGrandchildTabId);
      await closeTab(serviceWorker, grandchildTabId);
      await closeTab(serviceWorker, childTabId);
      await closeTab(serviceWorker, parentTabId);

      function entries(structure: TreeStructureEntry[], urlPart: string): TreeStructureEntry | undefined {
        // 完全一致を優先
        const exactMatch = structure.find(e => {
          const urlPath = new URL(e.url).pathname;
          return urlPath === urlPart;
        });
        if (exactMatch) return exactMatch;
        // 部分一致フォールバック
        return structure.find(e => e.url.includes(urlPart));
      }
    });

    test('viewIdが正しくtreeStructureに保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // 1. タブを作成
      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      // 2. 新しいビューを作成
      const newViewId = 'test-view-' + Date.now();
      await serviceWorker.evaluate(async ({ viewId }) => {
        const result = await chrome.storage.local.get('tree_state');
        interface TreeStateWithViews {
          views?: Array<{ id: string; name: string; color: string }>;
        }
        const treeState = result.tree_state as TreeStateWithViews;
        if (!treeState.views) {
          treeState.views = [];
        }
        treeState.views.push({ id: viewId, name: 'Test View', color: '#ff0000' });
        await chrome.storage.local.set({ tree_state: treeState });
      }, { viewId: newViewId });

      // 3. タブを新しいビューに移動
      await serviceWorker.evaluate(async ({ tabId, viewId }) => {
        const result = await chrome.storage.local.get('tree_state');
        interface TreeNode {
          viewId: string;
        }
        interface TreeState {
          nodes: Record<string, TreeNode>;
          tabToNode: Record<number, string>;
        }
        const treeState = result.tree_state as TreeState;
        const nodeId = treeState.tabToNode[tabId];
        if (nodeId && treeState.nodes[nodeId]) {
          treeState.nodes[nodeId].viewId = viewId;
          await chrome.storage.local.set({ tree_state: treeState });
        }

        // treeStructureを再構築するためにrefreshTreeStructureを呼び出す
        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager) {
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.loadState();
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.refreshTreeStructure();
        }
      }, { tabId, viewId: newViewId });

      // 4. treeStructureのviewIdを確認
      await waitForCondition(
        async () => {
          interface TreeStructureEntry {
            url: string;
            viewId: string;
          }
          const treeStructure = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            const treeState = result.tree_state as { treeStructure?: unknown[] };
            return treeState?.treeStructure;
          }) as TreeStructureEntry[];

          const tabEntry = treeStructure?.find(e => e.url.includes('/page'));
          return tabEntry?.viewId === newViewId;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'viewId was not saved correctly' }
      );

      // クリーンアップ
      await closeTab(serviceWorker, tabId);
    });

    test('isExpandedが正しくtreeStructureに保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // 1. 親タブと子タブを作成
      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      const childTabId = await createTab(serviceWorker, getTestServerUrl('/page2'), parentTabId, { active: false });

      // 2. 親タブを折りたたむ（isExpanded: false）
      await serviceWorker.evaluate(async ({ tabId }) => {
        const result = await chrome.storage.local.get('tree_state');
        interface TreeNode {
          isExpanded: boolean;
        }
        interface TreeState {
          nodes: Record<string, TreeNode>;
          tabToNode: Record<number, string>;
        }
        const treeState = result.tree_state as TreeState;
        const nodeId = treeState.tabToNode[tabId];
        if (nodeId && treeState.nodes[nodeId]) {
          treeState.nodes[nodeId].isExpanded = false;
          await chrome.storage.local.set({ tree_state: treeState });
        }

        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager) {
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.loadState();
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.refreshTreeStructure();
        }
      }, { tabId: parentTabId });

      // 3. treeStructureのisExpandedを確認
      await waitForCondition(
        async () => {
          interface TreeStructureEntry {
            url: string;
            isExpanded: boolean;
          }
          const treeStructure = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            const treeState = result.tree_state as { treeStructure?: unknown[] };
            return treeState?.treeStructure;
          }) as TreeStructureEntry[];

          const parentEntry = treeStructure?.find(e => e.url.includes('/page') && !e.url.includes('/page2'));
          return parentEntry?.isExpanded === false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'isExpanded was not saved correctly' }
      );

      // クリーンアップ
      await closeTab(serviceWorker, childTabId);
      await closeTab(serviceWorker, parentTabId);
    });
  });

  test.describe('ツリー構造のsyncWithChromeTabs復元', () => {
    test('syncWithChromeTabsでURLベースのマッチングが機能すること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      await setupWindow(extensionContext, serviceWorker, windowId);

      // 1. 親タブと子タブを作成
      const parentUrl = getTestServerUrl('/page');
      const parentTabId = await createTab(serviceWorker, parentUrl, undefined, { active: false });

      const childUrl = getTestServerUrl('/page2');
      const childTabId = await createTab(serviceWorker, childUrl, parentTabId, { active: false });

      // 2. 少し待機してtreeStructureが保存されるのを待つ
      await new Promise(resolve => setTimeout(resolve, 300));

      // 3. treeStructureが保存されていることを確認
      interface TreeStructureEntry {
        url: string;
        parentIndex: number | null;
      }

      const treeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: unknown[] };
        return treeState?.treeStructure;
      }) as TreeStructureEntry[];

      expect(treeStructure).toBeDefined();

      // 親子関係が保存されている
      const parentEntry = treeStructure.find(e => e.url.includes('/page') && !e.url.includes('/page2'));
      const childEntry = treeStructure.find(e => e.url.includes('/page2'));

      expect(parentEntry?.parentIndex).toBeNull();
      const parentIdx = treeStructure.indexOf(parentEntry!);
      expect(childEntry?.parentIndex).toBe(parentIdx);

      // 4. syncWithChromeTabsを呼び出してURLベースのマッチングをテスト
      // （実際にはタブIDが変わらないが、同期処理が正しく動作することを確認）
      await serviceWorker.evaluate(async () => {
        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager) {
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.syncWithChromeTabs();
        }
      });

      // 5. syncWithChromeTabs後もtreeStructureの親子関係が維持されていることを確認
      const treeStructureAfter = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: unknown[] };
        return treeState?.treeStructure;
      }) as TreeStructureEntry[];

      const parentEntryAfter = treeStructureAfter.find(e => e.url.includes('/page') && !e.url.includes('/page2'));
      const childEntryAfter = treeStructureAfter.find(e => e.url.includes('/page2'));

      expect(parentEntryAfter?.parentIndex).toBeNull();
      const parentIdxAfter = treeStructureAfter.indexOf(parentEntryAfter!);
      expect(childEntryAfter?.parentIndex).toBe(parentIdxAfter);

      // クリーンアップ
      await closeTab(serviceWorker, childTabId);
      await closeTab(serviceWorker, parentTabId);
    });
  });
});
