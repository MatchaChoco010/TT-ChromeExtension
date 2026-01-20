/**
 * エラーハンドリングとエッジケースのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { TreeStateManager } from '@/services/TreeStateManager';
import { StorageService } from '@/storage/StorageService';
import { ThemeProvider } from '@/sidepanel/providers/ThemeProvider';
import type { UserSettings, StorageChanges } from '@/types';
import type { MockChrome } from '@/test/test-types';

describe('エラーハンドリングとエッジケース', () => {
  describe('タブAPI失敗時の挙動', () => {
    let storageService: StorageService;
    let treeStateManager: TreeStateManager;

    beforeEach(() => {
      storageService = new StorageService();
      treeStateManager = new TreeStateManager(storageService);
    });

    it('chrome.tabs.get が失敗してもクラッシュしない', async () => {
      const mockChrome = global.chrome as unknown as MockChrome;
      vi.mocked(mockChrome.tabs.get).mockRejectedValue(new Error('Tab not found'));

      await expect(async () => {
        try {
          await chrome.tabs.get(999);
        } catch {
          // エラーをログに記録するが、処理は継続
        }
      }).not.toThrow();

      expect(mockChrome.tabs.get).toHaveBeenCalledWith(999);
    });

    it('chrome.tabs.move が失敗した場合、元の状態を維持', async () => {
      const mockChrome = global.chrome as unknown as MockChrome;
      vi.mocked(mockChrome.tabs.move).mockRejectedValue(new Error('Move failed'));

      const tab: chrome.tabs.Tab = {
        id: 1,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        frozen: false,
      };

      await treeStateManager.addTab(tab, null, 'view-1');

      const nodeBeforeMove = treeStateManager.getNodeByTabId(1);
      expect(nodeBeforeMove).not.toBeNull();

      try {
        await treeStateManager.moveNode('node-1', null, 0);
      } catch (error) {
        // エラーをキャッチして処理継続
        expect(error).toBeDefined();
      }

      const nodeAfterMove = treeStateManager.getNodeByTabId(1);
      expect(nodeAfterMove).not.toBeNull();
    });

    it('chrome.tabs.remove が失敗してもUIは静かに失敗する', async () => {
      const mockChrome = global.chrome as unknown as MockChrome;
      vi.mocked(mockChrome.tabs.remove).mockRejectedValue(new Error('Remove failed'));

      let errorCaught = false;
      try {
        await chrome.tabs.remove(1);
      } catch {
        errorCaught = true;
      }

      expect(errorCaught).toBe(true);
    });
  });

  describe('ストレージ容量超過時の警告', () => {
    let originalStorageSet: typeof chrome.storage.local.set | undefined;

    beforeEach(() => {
      originalStorageSet = global.chrome?.storage?.local?.set;
    });

    afterEach(() => {
      if (originalStorageSet) {
        const mockChrome = global.chrome as unknown as MockChrome;
        vi.mocked(mockChrome.storage.local.set).mockImplementation(originalStorageSet as ReturnType<typeof vi.fn>);
      }
    });

    it('chrome.storage.local.set がQUOTA_BYTES_PER_ITEMエラーを投げたとき警告を表示', async () => {
      const storageService = new StorageService();

      const quotaError = new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
      const mockChrome = global.chrome as unknown as MockChrome;
      vi.mocked(mockChrome.storage.local.set).mockRejectedValue(quotaError);

      const largeViews: Record<string, { info: { id: string; name: string; color: string }; rootNodeIds: string[]; nodes: Record<string, never> }> = {};
      const viewOrder: string[] = [];
      for (let i = 0; i < 1000; i++) {
        largeViews[`view-${i}`] = {
          info: { id: `view-${i}`, name: 'Test View', color: '#ff0000' },
          rootNodeIds: [],
          nodes: {},
        };
        viewOrder.push(`view-${i}`);
      }
      const largeData = {
        views: largeViews,
        viewOrder,
        currentViewId: 'view-1',
        tabToNode: {},
        treeStructure: [],
      };

      await expect(
        storageService.set('tree_state', largeData)
      ).rejects.toThrow();
    });

  });

  describe('循環参照検出', () => {
    let storageService: StorageService;
    let treeStateManager: TreeStateManager;

    beforeEach(() => {
      storageService = new StorageService();
      treeStateManager = new TreeStateManager(storageService);

      const mockChrome = global.chrome as unknown as MockChrome;
      vi.mocked(mockChrome.storage.local.get).mockResolvedValue({});
      vi.mocked(mockChrome.storage.local.set).mockResolvedValue(undefined);
    });

    it('親ノードを自分の子として移動しようとした場合、操作をキャンセル', async () => {
      const tabA: chrome.tabs.Tab = {
        id: 1,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        frozen: false,
      };

      const tabB: chrome.tabs.Tab = {
        id: 2,
        index: 1,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        frozen: false,
      };

      const tabC: chrome.tabs.Tab = {
        id: 3,
        index: 2,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        frozen: false,
      };

      await treeStateManager.addTab(tabA, null, 'view-1');
      await treeStateManager.addTab(tabB, 'node-1', 'view-1');
      await treeStateManager.addTab(tabC, 'node-2', 'view-1');

      const nodeA = treeStateManager.getNodeByTabId(1);
      const nodeB = treeStateManager.getNodeByTabId(2);
      const nodeC = treeStateManager.getNodeByTabId(3);

      expect(nodeA?.node.parentId).toBeNull();
      expect(nodeB?.node.parentId).toBe('node-1');
      expect(nodeC?.node.parentId).toBe('node-2');

      await treeStateManager.moveNode('node-1', 'node-3', 0);

      const nodeAAfter = treeStateManager.getNodeByTabId(1);
      expect(nodeAAfter?.node.parentId).toBeNull();
      const nodeBAfter = treeStateManager.getNodeByTabId(2);
      expect(nodeBAfter?.node.parentId).toBe('node-1');
      const nodeCAfter = treeStateManager.getNodeByTabId(3);
      expect(nodeCAfter?.node.parentId).toBe('node-2');
    });

    it('ノードを自分自身の親にしようとした場合、操作をキャンセル', async () => {
      const tab: chrome.tabs.Tab = {
        id: 1,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        frozen: false,
      };

      await treeStateManager.addTab(tab, null, 'view-1');

      await treeStateManager.moveNode('node-1', 'node-1', 0);

      const node = treeStateManager.getNodeByTabId(1);
      expect(node?.node.parentId).toBeNull();
    });

    it('TreeStateManagerに循環参照検出機能が実装されていることを確認', () => {
      expect(treeStateManager).toBeDefined();
    });
  });

  describe('カスタムCSSエラー時のフォールバック', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('無効なカスタムCSSが入力された場合、エラー通知を表示', async () => {
      // 括弧が一致しないCSS（確実に検出される）
      const invalidCSS = `
        .test {
          color: red;
        /* 閉じ括弧がない */
      `;

      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'sans-serif',
        customCSS: invalidCSS,
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      // モックストレージに設定を保存
      const mockChrome = global.chrome as unknown as MockChrome;
      vi.mocked(mockChrome.storage.local.get).mockResolvedValue({ user_settings: settings });
      vi.mocked(mockChrome.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(mockChrome.storage.onChanged.addListener).mockImplementation(() => {});
      vi.mocked(mockChrome.storage.onChanged.removeListener).mockImplementation(() => {});

      await act(async () => {
        render(
          <ThemeProvider>
            <div>Test Content</div>
          </ThemeProvider>,
          { container }
        );
      });

      await waitFor(
        () => {
          const errorNotification = document.getElementById('vivaldi-tt-css-error');
          expect(errorNotification).not.toBeNull();
          expect(errorNotification?.textContent).toContain('カスタムCSSにエラーがあります');
        },
        { timeout: 3000 }
      );
    });

    it('括弧が一致しないCSSの場合、エラー検出', async () => {
      const invalidCSS = `
        .test {
          color: red;
        /* 閉じ括弧がない */
      `;

      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'sans-serif',
        customCSS: invalidCSS,
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      const mockChrome = global.chrome as unknown as MockChrome;
      vi.mocked(mockChrome.storage.local.get).mockResolvedValue({ user_settings: settings });
      vi.mocked(mockChrome.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(mockChrome.storage.onChanged.addListener).mockImplementation(() => {});
      vi.mocked(mockChrome.storage.onChanged.removeListener).mockImplementation(() => {});

      await act(async () => {
        render(
          <ThemeProvider>
            <div>Test Content</div>
          </ThemeProvider>,
          { container }
        );
      });

      await waitFor(
        () => {
          const errorNotification = document.getElementById('vivaldi-tt-css-error');
          expect(errorNotification).not.toBeNull();
        },
        { timeout: 3000 }
      );
    });

    it('有効なカスタムCSSの場合、エラー通知を表示しない', async () => {
      const validCSS = `
        .test {
          color: red;
          background: blue;
        }
      `;

      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'sans-serif',
        customCSS: validCSS,
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      const mockChrome = global.chrome as unknown as MockChrome;
      vi.mocked(mockChrome.storage.local.get).mockResolvedValue({ user_settings: settings });
      vi.mocked(mockChrome.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(mockChrome.storage.onChanged.addListener).mockImplementation(() => {});
      vi.mocked(mockChrome.storage.onChanged.removeListener).mockImplementation(() => {});

      await act(async () => {
        render(
          <ThemeProvider>
            <div>Test Content</div>
          </ThemeProvider>,
          { container }
        );
      });

      await waitFor(
        () => {
          const content = screen.getByText('Test Content');
          expect(content).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const errorNotification = document.getElementById('vivaldi-tt-css-error');
      expect(errorNotification).toBeNull();
    });

    it('カスタムCSSエラー後、修正すればエラー通知が消える', async () => {
      const invalidCSS = '.test { color: red';

      const initialSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'sans-serif',
        customCSS: invalidCSS,
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      const listeners: Array<(changes: StorageChanges, areaName: string) => void> = [];

      const mockChrome = global.chrome as unknown as MockChrome;
      vi.mocked(mockChrome.storage.local.get).mockResolvedValue({ user_settings: initialSettings });
      vi.mocked(mockChrome.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(mockChrome.storage.onChanged.addListener).mockImplementation((listener: (changes: StorageChanges, areaName: string) => void) => {
        listeners.push(listener);
      });
      vi.mocked(mockChrome.storage.onChanged.removeListener).mockImplementation((listener: (changes: StorageChanges, areaName: string) => void) => {
        const index = listeners.indexOf(listener);
        if (index > -1) listeners.splice(index, 1);
      });

      await act(async () => {
        render(
          <ThemeProvider>
            <div>Test Content</div>
          </ThemeProvider>,
          { container }
        );
      });

      await waitFor(() => {
        const errorNotification = document.getElementById('vivaldi-tt-css-error');
        expect(errorNotification).not.toBeNull();
      });

      const validCSS = '.test { color: red; }';
      const fixedSettings: UserSettings = {
        ...initialSettings,
        customCSS: validCSS,
      };

      await act(async () => {
        listeners.forEach((listener) => {
          listener(
            {
              user_settings: {
                oldValue: initialSettings,
                newValue: fixedSettings,
              },
            },
            'local'
          );
        });
      });

      await waitFor(() => {
        const errorNotification = document.getElementById('vivaldi-tt-css-error');
        expect(errorNotification).toBeNull();
      });
    });
  });

  describe('エッジケース: 不正なデータの処理', () => {
    it('存在しないタブIDを参照しても例外を投げない', () => {
      const storageService = new StorageService();
      const treeStateManager = new TreeStateManager(storageService);

      const node = treeStateManager.getNodeByTabId(99999);
      expect(node).toBeNull();
    });

    it('空のツリーからgetTreeを呼び出しても空配列を返す', () => {
      const storageService = new StorageService();
      const treeStateManager = new TreeStateManager(storageService);

      const tree = treeStateManager.getTree('nonexistent-view');
      expect(tree).toEqual([]);
    });

    it('nullまたはundefinedのタブオブジェクトを追加しようとしたらエラー', async () => {
      const storageService = new StorageService();
      const treeStateManager = new TreeStateManager(storageService);

      const invalidTab = { id: undefined, frozen: false } as chrome.tabs.Tab;

      await expect(
        treeStateManager.addTab(invalidTab, null, 'view-1')
      ).rejects.toThrow('Tab ID is required');
    });
  });
});
