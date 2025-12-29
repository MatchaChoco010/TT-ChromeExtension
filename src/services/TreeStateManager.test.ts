import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreeStateManager } from './TreeStateManager';
import type { IStorageService } from '@/types';

describe('TreeStateManager', () => {
  let manager: TreeStateManager;
  let mockStorageService: IStorageService;
  const mockStorageData: Record<string, unknown> = {};

  beforeEach(() => {
    // モックストレージデータをリセット
    Object.keys(mockStorageData).forEach((key) => delete mockStorageData[key]);

    // モックストレージサービスを作成
    mockStorageService = {
      get: vi.fn().mockImplementation(async (key: string) => mockStorageData[key] ?? null),
      set: vi.fn().mockImplementation(async (key: string, value: unknown) => {
        mockStorageData[key] = value;
      }),
      remove: vi.fn().mockImplementation(async (key: string) => {
        delete mockStorageData[key];
      }),
      onChange: vi.fn(() => () => {}),
    };

    manager = new TreeStateManager(mockStorageService);
  });

  describe('初期化', () => {
    it('新しいTreeStateManagerインスタンスを作成できる', () => {
      expect(manager).toBeDefined();
    });
  });

  describe('getTree', () => {
    it('指定されたviewIdのタブツリーを取得できる', async () => {
      const viewId = 'view-1';

      // ツリーに初期データを設定
      await manager.addTab(
        { id: 1, url: 'https://example.com', title: 'Example' } as chrome.tabs.Tab,
        null,
        viewId,
      );

      const tree = manager.getTree(viewId);
      expect(tree).toBeDefined();
      expect(tree.length).toBeGreaterThan(0);
      expect(tree[0].viewId).toBe(viewId);
    });

    it('存在しないviewIdに対して空配列を返す', () => {
      const tree = manager.getTree('non-existent-view');
      expect(tree).toEqual([]);
    });
  });

  describe('getNodeByTabId', () => {
    it('tabIdからTabNodeを取得できる', async () => {
      const tabId = 1;
      const viewId = 'view-1';

      await manager.addTab(
        { id: tabId, url: 'https://example.com', title: 'Example' } as chrome.tabs.Tab,
        null,
        viewId,
      );

      const node = manager.getNodeByTabId(tabId);
      expect(node).toBeDefined();
      expect(node?.tabId).toBe(tabId);
    });

    it('存在しないtabIdに対してnullを返す', () => {
      const node = manager.getNodeByTabId(999);
      expect(node).toBeNull();
    });
  });

  describe('addTab', () => {
    it('新しいタブをルートノードとして追加できる', async () => {
      const tab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
      } as chrome.tabs.Tab;
      const viewId = 'view-1';

      await manager.addTab(tab, null, viewId);

      const node = manager.getNodeByTabId(tab.id!);
      expect(node).toBeDefined();
      expect(node?.tabId).toBe(tab.id);
      expect(node?.parentId).toBeNull();
      expect(node?.viewId).toBe(viewId);
    });

    it('親ノードを指定して子タブとして追加できる', async () => {
      const viewId = 'view-1';
      const parentTab = {
        id: 1,
        url: 'https://example.com',
        title: 'Parent',
      } as chrome.tabs.Tab;
      const childTab = {
        id: 2,
        url: 'https://example.com/child',
        title: 'Child',
      } as chrome.tabs.Tab;

      await manager.addTab(parentTab, null, viewId);
      const parentNode = manager.getNodeByTabId(parentTab.id!);
      expect(parentNode).toBeDefined();

      await manager.addTab(childTab, parentNode!.id, viewId);
      const childNode = manager.getNodeByTabId(childTab.id!);

      expect(childNode).toBeDefined();
      expect(childNode?.parentId).toBe(parentNode!.id);
      expect(parentNode!.children).toContainEqual(childNode);
    });

    it('タブ追加後にストレージに永続化される', async () => {
      const tab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
      } as chrome.tabs.Tab;
      const viewId = 'view-1';

      await manager.addTab(tab, null, viewId);

      expect(mockStorageService.set).toHaveBeenCalledWith(
        'tree_state',
        expect.objectContaining({
          nodes: expect.any(Object),
          tabToNode: expect.any(Object),
        }),
      );
    });
  });

  describe('removeTab', () => {
    it('タブを削除できる', async () => {
      const tab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
      } as chrome.tabs.Tab;
      const viewId = 'view-1';

      await manager.addTab(tab, null, viewId);
      expect(manager.getNodeByTabId(tab.id!)).toBeDefined();

      await manager.removeTab(tab.id!);
      expect(manager.getNodeByTabId(tab.id!)).toBeNull();
    });

    it('削除後にストレージに永続化される', async () => {
      const tab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
      } as chrome.tabs.Tab;
      const viewId = 'view-1';

      await manager.addTab(tab, null, viewId);
      await manager.removeTab(tab.id!);

      expect(mockStorageService.set).toHaveBeenCalled();
    });
  });

  describe('moveNode', () => {
    it('ノードを別の親ノードの子として移動できる', async () => {
      const viewId = 'view-1';
      const tab1 = { id: 1, url: 'https://example.com/1', title: 'Tab1' } as chrome.tabs.Tab;
      const tab2 = { id: 2, url: 'https://example.com/2', title: 'Tab2' } as chrome.tabs.Tab;

      await manager.addTab(tab1, null, viewId);
      await manager.addTab(tab2, null, viewId);

      const node1 = manager.getNodeByTabId(tab1.id!);
      const node2 = manager.getNodeByTabId(tab2.id!);

      expect(node2?.parentId).toBeNull();

      await manager.moveNode(node2!.id, node1!.id, 0);

      const updatedNode2 = manager.getNodeByTabId(tab2.id!);
      expect(updatedNode2?.parentId).toBe(node1!.id);
    });

    it('移動後にストレージに永続化される', async () => {
      const viewId = 'view-1';
      const tab1 = { id: 1, url: 'https://example.com/1', title: 'Tab1' } as chrome.tabs.Tab;
      const tab2 = { id: 2, url: 'https://example.com/2', title: 'Tab2' } as chrome.tabs.Tab;

      await manager.addTab(tab1, null, viewId);
      await manager.addTab(tab2, null, viewId);

      const node1 = manager.getNodeByTabId(tab1.id!);
      const node2 = manager.getNodeByTabId(tab2.id!);

      await manager.moveNode(node2!.id, node1!.id, 0);

      expect(mockStorageService.set).toHaveBeenCalled();
    });

    it('子孫を持つノードを移動すると、子孫のdepthも更新される', async () => {
      const viewId = 'view-1';
      const tab1 = { id: 1, url: 'https://example.com/1', title: 'Root1' } as chrome.tabs.Tab;
      const tab2 = { id: 2, url: 'https://example.com/2', title: 'Child' } as chrome.tabs.Tab;
      const tab3 = { id: 3, url: 'https://example.com/3', title: 'Grandchild' } as chrome.tabs.Tab;
      const tab4 = { id: 4, url: 'https://example.com/4', title: 'Root2' } as chrome.tabs.Tab;

      // Create structure: root1 -> child -> grandchild
      await manager.addTab(tab1, null, viewId);
      const root1 = manager.getNodeByTabId(tab1.id!);

      await manager.addTab(tab2, root1!.id, viewId);
      const child = manager.getNodeByTabId(tab2.id!);

      await manager.addTab(tab3, child!.id, viewId);
      const grandchild = manager.getNodeByTabId(tab3.id!);

      // Create root2
      await manager.addTab(tab4, null, viewId);
      const root2 = manager.getNodeByTabId(tab4.id!);

      // Verify initial depths
      expect(child!.depth).toBe(1);
      expect(grandchild!.depth).toBe(2);

      // Move child (with grandchild) to root2
      await manager.moveNode(child!.id, root2!.id, 0);

      // Verify updated depths
      const updatedChild = manager.getNodeByTabId(tab2.id!);
      const updatedGrandchild = manager.getNodeByTabId(tab3.id!);

      expect(updatedChild!.depth).toBe(1);  // child is now child of root2 (depth 0)
      expect(updatedGrandchild!.depth).toBe(2);  // grandchild should be depth 2
    });
  });

  describe('toggleExpand', () => {
    it('ノードの展開状態を切り替えられる', async () => {
      const tab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
      } as chrome.tabs.Tab;
      const viewId = 'view-1';

      await manager.addTab(tab, null, viewId);
      const node = manager.getNodeByTabId(tab.id!);
      const initialExpanded = node!.isExpanded;

      await manager.toggleExpand(node!.id);

      const updatedNode = manager.getNodeByTabId(tab.id!);
      expect(updatedNode!.isExpanded).toBe(!initialExpanded);
    });

    it('展開状態切り替え後にストレージに永続化される', async () => {
      const tab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
      } as chrome.tabs.Tab;
      const viewId = 'view-1';

      await manager.addTab(tab, null, viewId);
      const node = manager.getNodeByTabId(tab.id!);

      await manager.toggleExpand(node!.id);

      expect(mockStorageService.set).toHaveBeenCalled();
    });
  });

  describe('syncWithChromeTabs', () => {
    it('chrome.tabs APIと同期できる', async () => {
      // chrome.tabs.query のモック
      const mockTabs = [
        { id: 1, url: 'https://example.com/1', title: 'Tab1', windowId: 1 },
        { id: 2, url: 'https://example.com/2', title: 'Tab2', windowId: 1 },
      ] as chrome.tabs.Tab[];

      vi.stubGlobal('chrome', {
        tabs: {
          query: vi.fn().mockResolvedValue(mockTabs),
        },
      });

      await manager.syncWithChromeTabs();

      const node1 = manager.getNodeByTabId(1);
      const node2 = manager.getNodeByTabId(2);

      expect(node1).toBeDefined();
      expect(node2).toBeDefined();
    });
  });

  describe('子タブ処理 (Requirement 2.3)', () => {
    describe('childTabBehavior: promote', () => {
      it('親タブを閉じると、子タブが親のレベルに昇格する', async () => {
        const viewId = 'view-1';
        const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent' } as chrome.tabs.Tab;
        const child1Tab = { id: 2, url: 'https://example.com/child1', title: 'Child1' } as chrome.tabs.Tab;
        const child2Tab = { id: 3, url: 'https://example.com/child2', title: 'Child2' } as chrome.tabs.Tab;

        // 親タブと子タブを追加
        await manager.addTab(parentTab, null, viewId);
        const parentNode = manager.getNodeByTabId(parentTab.id!);
        await manager.addTab(child1Tab, parentNode!.id, viewId);
        await manager.addTab(child2Tab, parentNode!.id, viewId);

        // 親ノードに子が2つあることを確認
        const parentBeforeRemove = manager.getNodeByTabId(parentTab.id!);
        expect(parentBeforeRemove?.children.length).toBe(2);

        // 親タブを削除（promote設定）
        await manager.removeTab(parentTab.id!, 'promote');

        // 親タブが削除されていることを確認
        expect(manager.getNodeByTabId(parentTab.id!)).toBeNull();

        // 子タブが昇格してルートノードになっていることを確認
        const child1Node = manager.getNodeByTabId(child1Tab.id!);
        const child2Node = manager.getNodeByTabId(child2Tab.id!);

        expect(child1Node).toBeDefined();
        expect(child2Node).toBeDefined();
        expect(child1Node?.parentId).toBeNull();
        expect(child2Node?.parentId).toBeNull();
        expect(child1Node?.depth).toBe(0);
        expect(child2Node?.depth).toBe(0);
      });

      it('親タブを閉じると、孫タブは子タブの子として維持される', async () => {
        const viewId = 'view-1';
        const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent' } as chrome.tabs.Tab;
        const childTab = { id: 2, url: 'https://example.com/child', title: 'Child' } as chrome.tabs.Tab;
        const grandchildTab = { id: 3, url: 'https://example.com/grandchild', title: 'Grandchild' } as chrome.tabs.Tab;

        // 親→子→孫の階層を作成
        await manager.addTab(parentTab, null, viewId);
        const parentNode = manager.getNodeByTabId(parentTab.id!);
        await manager.addTab(childTab, parentNode!.id, viewId);
        const childNode = manager.getNodeByTabId(childTab.id!);
        await manager.addTab(grandchildTab, childNode!.id, viewId);

        // 親タブを削除（promote設定）
        await manager.removeTab(parentTab.id!, 'promote');

        // 親タブが削除されていることを確認
        expect(manager.getNodeByTabId(parentTab.id!)).toBeNull();

        // 子タブがルートに昇格
        const promotedChild = manager.getNodeByTabId(childTab.id!);
        expect(promotedChild?.parentId).toBeNull();
        expect(promotedChild?.depth).toBe(0);

        // 孫タブは子タブの子として維持される
        const grandchild = manager.getNodeByTabId(grandchildTab.id!);
        expect(grandchild?.parentId).toBe(promotedChild?.id);
        expect(grandchild?.depth).toBe(1);
      });
    });

    describe('childTabBehavior: close_all', () => {
      it('親タブを閉じると、すべての子タブが再帰的に削除される', async () => {
        const viewId = 'view-1';
        const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent' } as chrome.tabs.Tab;
        const child1Tab = { id: 2, url: 'https://example.com/child1', title: 'Child1' } as chrome.tabs.Tab;
        const child2Tab = { id: 3, url: 'https://example.com/child2', title: 'Child2' } as chrome.tabs.Tab;
        const grandchildTab = { id: 4, url: 'https://example.com/grandchild', title: 'Grandchild' } as chrome.tabs.Tab;

        // 親タブと子タブを追加
        await manager.addTab(parentTab, null, viewId);
        const parentNode = manager.getNodeByTabId(parentTab.id!);
        await manager.addTab(child1Tab, parentNode!.id, viewId);
        await manager.addTab(child2Tab, parentNode!.id, viewId);
        const child1Node = manager.getNodeByTabId(child1Tab.id!);
        await manager.addTab(grandchildTab, child1Node!.id, viewId);

        // 削除前の確認
        expect(manager.getNodeByTabId(parentTab.id!)).toBeDefined();
        expect(manager.getNodeByTabId(child1Tab.id!)).toBeDefined();
        expect(manager.getNodeByTabId(child2Tab.id!)).toBeDefined();
        expect(manager.getNodeByTabId(grandchildTab.id!)).toBeDefined();

        // 親タブを削除（close_all設定）
        const closedTabIds = await manager.removeTab(parentTab.id!, 'close_all');

        // すべてのタブが削除されていることを確認
        expect(manager.getNodeByTabId(parentTab.id!)).toBeNull();
        expect(manager.getNodeByTabId(child1Tab.id!)).toBeNull();
        expect(manager.getNodeByTabId(child2Tab.id!)).toBeNull();
        expect(manager.getNodeByTabId(grandchildTab.id!)).toBeNull();

        // 閉じられたタブIDのリストを確認
        expect(closedTabIds).toContain(parentTab.id!);
        expect(closedTabIds).toContain(child1Tab.id!);
        expect(closedTabIds).toContain(child2Tab.id!);
        expect(closedTabIds).toContain(grandchildTab.id!);
        expect(closedTabIds).toHaveLength(4);
      });
    });

    describe('後方互換性', () => {
      it('childTabBehaviorを指定しない場合、デフォルトでpromote動作になる', async () => {
        const viewId = 'view-1';
        const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent' } as chrome.tabs.Tab;
        const childTab = { id: 2, url: 'https://example.com/child', title: 'Child' } as chrome.tabs.Tab;

        await manager.addTab(parentTab, null, viewId);
        const parentNode = manager.getNodeByTabId(parentTab.id!);
        await manager.addTab(childTab, parentNode!.id, viewId);

        // childTabBehaviorを指定せずに削除
        await manager.removeTab(parentTab.id!);

        // 子タブが昇格していることを確認（デフォルト動作）
        const child = manager.getNodeByTabId(childTab.id!);
        expect(child).toBeDefined();
        expect(child?.parentId).toBeNull();
      });
    });
  });

  describe('cleanupStaleNodes (Requirement 2.1, 2.2, 2.3)', () => {
    it('ブラウザに存在しないタブをツリーから削除する', async () => {
      const viewId = 'default';
      // ツリーにタブを追加
      const tab1 = { id: 1, url: 'https://example.com/1', title: 'Tab1' } as chrome.tabs.Tab;
      const tab2 = { id: 2, url: 'https://example.com/2', title: 'Tab2' } as chrome.tabs.Tab;
      const tab3 = { id: 3, url: 'https://example.com/3', title: 'Tab3' } as chrome.tabs.Tab;

      await manager.addTab(tab1, null, viewId);
      await manager.addTab(tab2, null, viewId);
      await manager.addTab(tab3, null, viewId);

      // ブラウザには tab1 と tab3 のみが存在する（tab2 は閉じられた）
      const existingTabIds = [1, 3];

      // クリーンアップを実行
      const removedCount = await manager.cleanupStaleNodes(existingTabIds);

      // 削除されたノード数を確認
      expect(removedCount).toBe(1);

      // tab1 と tab3 は残っている
      expect(manager.getNodeByTabId(1)).toBeDefined();
      expect(manager.getNodeByTabId(3)).toBeDefined();

      // tab2 は削除されている
      expect(manager.getNodeByTabId(2)).toBeNull();
    });

    it('子タブが存在しない場合、子タブのみをクリーンアップする', async () => {
      const viewId = 'default';
      // 親→子の階層を作成
      const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent' } as chrome.tabs.Tab;
      const childTab = { id: 2, url: 'https://example.com/child', title: 'Child' } as chrome.tabs.Tab;

      await manager.addTab(parentTab, null, viewId);
      const parentNode = manager.getNodeByTabId(parentTab.id!);
      await manager.addTab(childTab, parentNode!.id, viewId);

      // ブラウザには親タブのみが存在する（子タブは閉じられた）
      const existingTabIds = [1];

      // クリーンアップを実行
      const removedCount = await manager.cleanupStaleNodes(existingTabIds);

      // 削除されたノード数を確認
      expect(removedCount).toBe(1);

      // 親タブは残っている
      expect(manager.getNodeByTabId(1)).toBeDefined();

      // 子タブは削除されている
      expect(manager.getNodeByTabId(2)).toBeNull();
    });

    it('すべてのタブが存在する場合は何も削除しない', async () => {
      const viewId = 'default';
      const tab1 = { id: 1, url: 'https://example.com/1', title: 'Tab1' } as chrome.tabs.Tab;
      const tab2 = { id: 2, url: 'https://example.com/2', title: 'Tab2' } as chrome.tabs.Tab;

      await manager.addTab(tab1, null, viewId);
      await manager.addTab(tab2, null, viewId);

      // すべてのタブが存在する
      const existingTabIds = [1, 2];

      // クリーンアップを実行
      const removedCount = await manager.cleanupStaleNodes(existingTabIds);

      // 削除されたノード数は0
      expect(removedCount).toBe(0);

      // 両方のタブが残っている
      expect(manager.getNodeByTabId(1)).toBeDefined();
      expect(manager.getNodeByTabId(2)).toBeDefined();
    });

    it('空のツリーに対してクリーンアップを実行しても問題ない', async () => {
      const existingTabIds = [1, 2, 3];

      // 空のツリーに対してクリーンアップを実行
      const removedCount = await manager.cleanupStaleNodes(existingTabIds);

      // 削除されたノード数は0
      expect(removedCount).toBe(0);
    });

    it('クリーンアップ後にストレージに永続化される', async () => {
      const viewId = 'default';
      const tab1 = { id: 1, url: 'https://example.com/1', title: 'Tab1' } as chrome.tabs.Tab;
      const tab2 = { id: 2, url: 'https://example.com/2', title: 'Tab2' } as chrome.tabs.Tab;

      await manager.addTab(tab1, null, viewId);
      await manager.addTab(tab2, null, viewId);

      // ストレージの呼び出し回数をリセット
      vi.clearAllMocks();

      // tab2 が存在しないとしてクリーンアップ
      await manager.cleanupStaleNodes([1]);

      // ストレージに永続化されていることを確認
      expect(mockStorageService.set).toHaveBeenCalledWith(
        'tree_state',
        expect.objectContaining({
          nodes: expect.any(Object),
          tabToNode: expect.any(Object),
        }),
      );
    });

    it('階層構造のあるツリーで、存在しない複数のタブをクリーンアップする', async () => {
      const viewId = 'default';
      // ツリー構造を作成: parent -> child1, child2 -> grandchild
      const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent' } as chrome.tabs.Tab;
      const child1Tab = { id: 2, url: 'https://example.com/child1', title: 'Child1' } as chrome.tabs.Tab;
      const child2Tab = { id: 3, url: 'https://example.com/child2', title: 'Child2' } as chrome.tabs.Tab;
      const grandchildTab = { id: 4, url: 'https://example.com/grandchild', title: 'Grandchild' } as chrome.tabs.Tab;

      await manager.addTab(parentTab, null, viewId);
      const parentNode = manager.getNodeByTabId(parentTab.id!);
      await manager.addTab(child1Tab, parentNode!.id, viewId);
      await manager.addTab(child2Tab, parentNode!.id, viewId);
      const child1Node = manager.getNodeByTabId(child1Tab.id!);
      await manager.addTab(grandchildTab, child1Node!.id, viewId);

      // ブラウザには parent と child2 のみが存在する
      const existingTabIds = [1, 3];

      // クリーンアップを実行
      const removedCount = await manager.cleanupStaleNodes(existingTabIds);

      // 削除されたノード数を確認 (child1 と grandchild)
      expect(removedCount).toBe(2);

      // parent と child2 は残っている
      expect(manager.getNodeByTabId(1)).toBeDefined();
      expect(manager.getNodeByTabId(3)).toBeDefined();

      // child1 と grandchild は削除されている
      expect(manager.getNodeByTabId(2)).toBeNull();
      expect(manager.getNodeByTabId(4)).toBeNull();
    });
  });
});
