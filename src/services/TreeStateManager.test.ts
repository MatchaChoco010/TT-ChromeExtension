import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreeStateManager } from './TreeStateManager';
import type { IStorageService } from '@/types';

describe('TreeStateManager', () => {
  let manager: TreeStateManager;
  let mockStorageService: IStorageService;
  const mockStorageData: Record<string, unknown> = {};
  const defaultWindowId = 1;

  beforeEach(() => {
    Object.keys(mockStorageData).forEach((key) => delete mockStorageData[key]);

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
    it('指定されたwindowIdのタブツリーを取得できる', async () => {
      await manager.addTab(
        { id: 1, url: 'https://example.com', title: 'Example', windowId: defaultWindowId } as chrome.tabs.Tab,
        null,
        defaultWindowId,
      );

      const tree = manager.getTree(defaultWindowId);
      expect(tree).toBeDefined();
      expect(tree.length).toBeGreaterThan(0);
      const result = manager.getNodeByTabId(1);
      expect(result?.windowId).toBe(defaultWindowId);
    });

    it('存在しないwindowIdに対して空配列を返す', () => {
      const tree = manager.getTree(999);
      expect(tree).toEqual([]);
    });
  });

  describe('getNodeByTabId', () => {
    it('tabIdからTabNodeを取得できる', async () => {
      const tabId = 1;

      await manager.addTab(
        { id: tabId, url: 'https://example.com', title: 'Example', windowId: defaultWindowId } as chrome.tabs.Tab,
        null,
        defaultWindowId,
      );

      const result = manager.getNodeByTabId(tabId);
      expect(result).toBeDefined();
      expect(result?.node.tabId).toBe(tabId);
      expect(result?.windowId).toBe(defaultWindowId);
    });

    it('存在しないtabIdに対してnullを返す', () => {
      const result = manager.getNodeByTabId(999);
      expect(result).toBeNull();
    });
  });

  describe('addTab', () => {
    it('新しいタブをルートノードとして追加できる', async () => {
      const tab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        windowId: defaultWindowId,
      } as chrome.tabs.Tab;

      await manager.addTab(tab, null, defaultWindowId);

      const result = manager.getNodeByTabId(tab.id!);
      expect(result).toBeDefined();
      expect(result?.node.tabId).toBe(tab.id);
      expect(result?.windowId).toBe(defaultWindowId);

      // 親を持たない場合はrootNodesに含まれる
      const tree = manager.getTree(defaultWindowId);
      expect(tree.some(n => n.tabId === tab.id)).toBe(true);
    });

    it('親ノードを指定して子タブとして追加できる', async () => {
      const parentTab = {
        id: 1,
        url: 'https://example.com',
        title: 'Parent',
        windowId: defaultWindowId,
      } as chrome.tabs.Tab;
      const childTab = {
        id: 2,
        url: 'https://example.com/child',
        title: 'Child',
        windowId: defaultWindowId,
      } as chrome.tabs.Tab;

      await manager.addTab(parentTab, null, defaultWindowId);
      const parentResult = manager.getNodeByTabId(parentTab.id!);
      expect(parentResult).toBeDefined();

      // 新構造では親tabIdを渡す
      await manager.addTab(childTab, parentTab.id!, defaultWindowId);
      const childResult = manager.getNodeByTabId(childTab.id!);

      expect(childResult).toBeDefined();
      // 子は親のchildren配列に含まれる
      expect(parentResult!.node.children.some(c => c.tabId === childTab.id)).toBe(true);
    });

    it('タブ追加後にストレージに永続化される', async () => {
      const tab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        windowId: defaultWindowId,
      } as chrome.tabs.Tab;

      await manager.addTab(tab, null, defaultWindowId);

      expect(mockStorageService.set).toHaveBeenCalledWith(
        'tree_state',
        expect.objectContaining({
          windows: expect.any(Array),
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
        windowId: defaultWindowId,
      } as chrome.tabs.Tab;

      await manager.addTab(tab, null, defaultWindowId);
      expect(manager.getNodeByTabId(tab.id!)).toBeDefined();

      await manager.removeTab(tab.id!);
      expect(manager.getNodeByTabId(tab.id!)).toBeNull();
    });

    it('削除後にストレージに永続化される', async () => {
      const tab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        windowId: defaultWindowId,
      } as chrome.tabs.Tab;

      await manager.addTab(tab, null, defaultWindowId);
      await manager.removeTab(tab.id!);

      expect(mockStorageService.set).toHaveBeenCalled();
    });
  });

  describe('moveNode', () => {
    it('ノードを別の親ノードの子として移動できる', async () => {
      const tab1 = { id: 1, url: 'https://example.com/1', title: 'Tab1', windowId: defaultWindowId } as chrome.tabs.Tab;
      const tab2 = { id: 2, url: 'https://example.com/2', title: 'Tab2', windowId: defaultWindowId } as chrome.tabs.Tab;

      await manager.addTab(tab1, null, defaultWindowId);
      await manager.addTab(tab2, null, defaultWindowId);

      // tab2をtab1の子として移動
      await manager.moveNode(tab2.id!, tab1.id!, 0);

      const result1 = manager.getNodeByTabId(tab1.id!);
      expect(result1?.node.children.some(c => c.tabId === tab2.id)).toBe(true);
    });

    it('移動後にストレージに永続化される', async () => {
      const tab1 = { id: 1, url: 'https://example.com/1', title: 'Tab1', windowId: defaultWindowId } as chrome.tabs.Tab;
      const tab2 = { id: 2, url: 'https://example.com/2', title: 'Tab2', windowId: defaultWindowId } as chrome.tabs.Tab;

      await manager.addTab(tab1, null, defaultWindowId);
      await manager.addTab(tab2, null, defaultWindowId);

      await manager.moveNode(tab2.id!, tab1.id!, 0);

      expect(mockStorageService.set).toHaveBeenCalled();
    });

    it('子孫を持つノードを移動できる', async () => {
      const tab1 = { id: 1, url: 'https://example.com/1', title: 'Root1', windowId: defaultWindowId } as chrome.tabs.Tab;
      const tab2 = { id: 2, url: 'https://example.com/2', title: 'Child', windowId: defaultWindowId } as chrome.tabs.Tab;
      const tab3 = { id: 3, url: 'https://example.com/3', title: 'Grandchild', windowId: defaultWindowId } as chrome.tabs.Tab;
      const tab4 = { id: 4, url: 'https://example.com/4', title: 'Root2', windowId: defaultWindowId } as chrome.tabs.Tab;

      await manager.addTab(tab1, null, defaultWindowId);
      await manager.addTab(tab2, tab1.id!, defaultWindowId);
      await manager.addTab(tab3, tab2.id!, defaultWindowId);
      await manager.addTab(tab4, null, defaultWindowId);

      // tab2（とその子孫）をtab4の下に移動
      await manager.moveNode(tab2.id!, tab4.id!, 0);

      const root2 = manager.getNodeByTabId(tab4.id!);
      expect(root2?.node.children.some(c => c.tabId === tab2.id)).toBe(true);

      const child = manager.getNodeByTabId(tab2.id!);
      expect(child?.node.children.some(c => c.tabId === tab3.id)).toBe(true);
    });
  });

  describe('toggleExpand', () => {
    it('ノードの展開状態を切り替えられる', async () => {
      const tab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        windowId: defaultWindowId,
      } as chrome.tabs.Tab;

      await manager.addTab(tab, null, defaultWindowId);
      const result = manager.getNodeByTabId(tab.id!);
      const initialExpanded = result!.node.isExpanded;

      // 新構造ではtabIdを渡す
      await manager.toggleExpand(tab.id!);

      const updatedResult = manager.getNodeByTabId(tab.id!);
      expect(updatedResult!.node.isExpanded).toBe(!initialExpanded);
    });

    it('展開状態切り替え後にストレージに永続化される', async () => {
      const tab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        windowId: defaultWindowId,
      } as chrome.tabs.Tab;

      await manager.addTab(tab, null, defaultWindowId);

      await manager.toggleExpand(tab.id!);

      expect(mockStorageService.set).toHaveBeenCalled();
    });
  });

  describe('restoreStateAfterRestart', () => {
    it('chrome.tabs APIと同期できる', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com/1', title: 'Tab1', windowId: 1 },
        { id: 2, url: 'https://example.com/2', title: 'Tab2', windowId: 1 },
      ] as chrome.tabs.Tab[];

      const originalQuery = chrome.tabs.query;
      chrome.tabs.query = vi.fn().mockResolvedValue(mockTabs) as typeof chrome.tabs.query;

      try {
        await manager.restoreStateAfterRestart();

        const node1 = manager.getNodeByTabId(1);
        const node2 = manager.getNodeByTabId(2);

        expect(node1).toBeDefined();
        expect(node2).toBeDefined();
      } finally {
        chrome.tabs.query = originalQuery;
      }
    });
  });

  describe('子タブ処理', () => {
    describe('childTabBehavior: promote', () => {
      it('親タブを閉じると、子タブが親のレベルに昇格する', async () => {
        const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent', windowId: defaultWindowId } as chrome.tabs.Tab;
        const child1Tab = { id: 2, url: 'https://example.com/child1', title: 'Child1', windowId: defaultWindowId } as chrome.tabs.Tab;
        const child2Tab = { id: 3, url: 'https://example.com/child2', title: 'Child2', windowId: defaultWindowId } as chrome.tabs.Tab;

        await manager.addTab(parentTab, null, defaultWindowId);
        await manager.addTab(child1Tab, parentTab.id!, defaultWindowId);
        await manager.addTab(child2Tab, parentTab.id!, defaultWindowId);

        const parentBeforeRemove = manager.getNodeByTabId(parentTab.id!);
        expect(parentBeforeRemove?.node.children.length).toBe(2);

        await manager.removeTab(parentTab.id!, 'promote');

        expect(manager.getNodeByTabId(parentTab.id!)).toBeNull();

        const child1Result = manager.getNodeByTabId(child1Tab.id!);
        const child2Result = manager.getNodeByTabId(child2Tab.id!);

        expect(child1Result).toBeDefined();
        expect(child2Result).toBeDefined();

        // ルートに昇格していることを確認
        const tree = manager.getTree(defaultWindowId);
        expect(tree.some(n => n.tabId === child1Tab.id)).toBe(true);
        expect(tree.some(n => n.tabId === child2Tab.id)).toBe(true);
      });

      it('親タブを閉じると、孫タブは子タブの子として維持される', async () => {
        const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent', windowId: defaultWindowId } as chrome.tabs.Tab;
        const childTab = { id: 2, url: 'https://example.com/child', title: 'Child', windowId: defaultWindowId } as chrome.tabs.Tab;
        const grandchildTab = { id: 3, url: 'https://example.com/grandchild', title: 'Grandchild', windowId: defaultWindowId } as chrome.tabs.Tab;

        await manager.addTab(parentTab, null, defaultWindowId);
        await manager.addTab(childTab, parentTab.id!, defaultWindowId);
        await manager.addTab(grandchildTab, childTab.id!, defaultWindowId);

        await manager.removeTab(parentTab.id!, 'promote');

        expect(manager.getNodeByTabId(parentTab.id!)).toBeNull();

        const promotedChild = manager.getNodeByTabId(childTab.id!);
        // ルートに昇格
        const tree = manager.getTree(defaultWindowId);
        expect(tree.some(n => n.tabId === childTab.id)).toBe(true);

        // 孫は子の子として維持
        expect(promotedChild?.node.children.some(c => c.tabId === grandchildTab.id)).toBe(true);
      });
    });

    describe('childTabBehavior: close_all', () => {
      it('親タブを閉じると、すべての子タブが再帰的に削除される', async () => {
        const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent', windowId: defaultWindowId } as chrome.tabs.Tab;
        const child1Tab = { id: 2, url: 'https://example.com/child1', title: 'Child1', windowId: defaultWindowId } as chrome.tabs.Tab;
        const child2Tab = { id: 3, url: 'https://example.com/child2', title: 'Child2', windowId: defaultWindowId } as chrome.tabs.Tab;
        const grandchildTab = { id: 4, url: 'https://example.com/grandchild', title: 'Grandchild', windowId: defaultWindowId } as chrome.tabs.Tab;

        await manager.addTab(parentTab, null, defaultWindowId);
        await manager.addTab(child1Tab, parentTab.id!, defaultWindowId);
        await manager.addTab(child2Tab, parentTab.id!, defaultWindowId);
        await manager.addTab(grandchildTab, child1Tab.id!, defaultWindowId);

        expect(manager.getNodeByTabId(parentTab.id!)).toBeDefined();
        expect(manager.getNodeByTabId(child1Tab.id!)).toBeDefined();
        expect(manager.getNodeByTabId(child2Tab.id!)).toBeDefined();
        expect(manager.getNodeByTabId(grandchildTab.id!)).toBeDefined();

        const closedTabIds = await manager.removeTab(parentTab.id!, 'close_all');

        expect(manager.getNodeByTabId(parentTab.id!)).toBeNull();
        expect(manager.getNodeByTabId(child1Tab.id!)).toBeNull();
        expect(manager.getNodeByTabId(child2Tab.id!)).toBeNull();
        expect(manager.getNodeByTabId(grandchildTab.id!)).toBeNull();

        expect(closedTabIds).toContain(parentTab.id!);
        expect(closedTabIds).toContain(child1Tab.id!);
        expect(closedTabIds).toContain(child2Tab.id!);
        expect(closedTabIds).toContain(grandchildTab.id!);
        expect(closedTabIds).toHaveLength(4);
      });
    });

    describe('後方互換性', () => {
      it('childTabBehaviorを指定しない場合、デフォルトでpromote動作になる', async () => {
        const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent', windowId: defaultWindowId } as chrome.tabs.Tab;
        const childTab = { id: 2, url: 'https://example.com/child', title: 'Child', windowId: defaultWindowId } as chrome.tabs.Tab;

        await manager.addTab(parentTab, null, defaultWindowId);
        await manager.addTab(childTab, parentTab.id!, defaultWindowId);

        await manager.removeTab(parentTab.id!);

        const child = manager.getNodeByTabId(childTab.id!);
        expect(child).toBeDefined();

        // ルートに昇格
        const tree = manager.getTree(defaultWindowId);
        expect(tree.some(n => n.tabId === childTab.id)).toBe(true);
      });
    });
  });

  describe('createGroupWithRealTab', () => {
    it('実際のタブIDでグループノードを作成できる', async () => {
      const childTab1 = { id: 1, url: 'https://example.com/1', title: 'Child1', windowId: defaultWindowId } as chrome.tabs.Tab;
      const childTab2 = { id: 2, url: 'https://example.com/2', title: 'Child2', windowId: defaultWindowId } as chrome.tabs.Tab;

      await manager.addTab(childTab1, null, defaultWindowId);
      await manager.addTab(childTab2, null, defaultWindowId);

      const groupTabId = 100;
      await manager.createGroupWithRealTab(groupTabId, [1, 2], 'テストグループ', defaultWindowId);

      const groupResult = manager.getNodeByTabId(groupTabId);
      expect(groupResult).toBeDefined();
      expect(groupResult?.node.tabId).toBe(groupTabId);

      // 子タブがグループの子になっている
      expect(groupResult?.node.children.some(c => c.tabId === 1)).toBe(true);
      expect(groupResult?.node.children.some(c => c.tabId === 2)).toBe(true);
    });

    it('グループノードがルートレベルに作成される', async () => {
      const childTab = { id: 1, url: 'https://example.com/1', title: 'Child', windowId: defaultWindowId } as chrome.tabs.Tab;
      await manager.addTab(childTab, null, defaultWindowId);

      const groupTabId = 100;
      await manager.createGroupWithRealTab(groupTabId, [1], 'グループ', defaultWindowId);

      const tree = manager.getTree(defaultWindowId);
      expect(tree.some(n => n.tabId === groupTabId)).toBe(true);
    });

    it('グループ情報がノードに直接埋め込まれる', async () => {
      const childTab = { id: 1, url: 'https://example.com/1', title: 'Child', windowId: defaultWindowId } as chrome.tabs.Tab;
      await manager.addTab(childTab, null, defaultWindowId);

      const groupTabId = 100;
      await manager.createGroupWithRealTab(groupTabId, [1], 'テストグループ', defaultWindowId);

      const groupNode = manager.getNodeByTabId(groupTabId);
      expect(groupNode).not.toBeNull();
      expect(groupNode!.node.groupInfo).toBeDefined();
      expect(groupNode!.node.groupInfo!.name).toBe('テストグループ');
      expect(groupNode!.node.groupInfo!.color).toBeDefined();
    });

    it('子タブが既に別の親を持つ場合、その親から削除されてグループに移動する', async () => {
      const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent', windowId: defaultWindowId } as chrome.tabs.Tab;
      const childTab = { id: 2, url: 'https://example.com/child', title: 'Child', windowId: defaultWindowId } as chrome.tabs.Tab;

      await manager.addTab(parentTab, null, defaultWindowId);
      await manager.addTab(childTab, parentTab.id!, defaultWindowId);

      const childBefore = manager.getNodeByTabId(2);
      expect(childBefore).toBeDefined();
      // childは親の子になっている
      const parentBefore = manager.getNodeByTabId(1);
      expect(parentBefore?.node.children.some(c => c.tabId === 2)).toBe(true);

      const groupTabId = 100;
      await manager.createGroupWithRealTab(groupTabId, [2], 'グループ', defaultWindowId);

      const parentAfter = manager.getNodeByTabId(1);
      expect(parentAfter?.node.children.some(c => c.tabId === 2)).toBe(false);

      const groupResult = manager.getNodeByTabId(100);
      expect(groupResult?.node.children.some(c => c.tabId === 2)).toBe(true);
    });

    it('タブIDが存在しない場合でもグループが作成される（存在しないタブはスキップされる）', async () => {
      const groupTabId = 100;
      await manager.createGroupWithRealTab(groupTabId, [999], 'グループ', defaultWindowId);

      const groupResult = manager.getNodeByTabId(groupTabId);
      expect(groupResult).toBeDefined();
      expect(groupResult?.node.children.length).toBe(0);
    });

    it('空のタブID配列でエラーをスローする', async () => {
      const groupTabId = 100;
      await expect(
        manager.createGroupWithRealTab(groupTabId, [], 'グループ', defaultWindowId)
      ).rejects.toThrow('No tabs specified for grouping');
    });

    describe('グループタブの階層決定', () => {
      it('すべてのタブが同じ親を持つ場合、コンテキストメニューを開いたタブの位置にグループが配置される', async () => {
        const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent', windowId: defaultWindowId } as chrome.tabs.Tab;
        await manager.addTab(parentTab, null, defaultWindowId);

        const childTab1 = { id: 2, url: 'https://example.com/child1', title: 'Child1', windowId: defaultWindowId } as chrome.tabs.Tab;
        const childTab2 = { id: 3, url: 'https://example.com/child2', title: 'Child2', windowId: defaultWindowId } as chrome.tabs.Tab;
        await manager.addTab(childTab1, parentTab.id!, defaultWindowId);
        await manager.addTab(childTab2, parentTab.id!, defaultWindowId);

        const groupTabId = 100;
        // childTab1（タブID 2）でコンテキストメニューを開いてグループ化
        await manager.createGroupWithRealTab(groupTabId, [2, 3], 'グループ', defaultWindowId, 2);

        // グループタブはchildTab1の位置（親タブの子）として配置される
        const parentResult = manager.getNodeByTabId(parentTab.id!);
        expect(parentResult?.node.children.some(c => c.tabId === groupTabId)).toBe(true);

        const groupResult = manager.getNodeByTabId(groupTabId);
        expect(groupResult?.node.children.some(c => c.tabId === 2)).toBe(true);
        expect(groupResult?.node.children.some(c => c.tabId === 3)).toBe(true);
      });

      it('タブが異なる親を持つ場合、コンテキストメニューを開いたタブの位置にグループが配置される', async () => {
        const parent1Tab = { id: 1, url: 'https://example.com/parent1', title: 'Parent1', windowId: defaultWindowId } as chrome.tabs.Tab;
        const parent2Tab = { id: 2, url: 'https://example.com/parent2', title: 'Parent2', windowId: defaultWindowId } as chrome.tabs.Tab;
        await manager.addTab(parent1Tab, null, defaultWindowId);
        await manager.addTab(parent2Tab, null, defaultWindowId);

        const child1Tab = { id: 3, url: 'https://example.com/child1', title: 'Child1', windowId: defaultWindowId } as chrome.tabs.Tab;
        const child2Tab = { id: 4, url: 'https://example.com/child2', title: 'Child2', windowId: defaultWindowId } as chrome.tabs.Tab;
        await manager.addTab(child1Tab, parent1Tab.id!, defaultWindowId);
        await manager.addTab(child2Tab, parent2Tab.id!, defaultWindowId);

        const groupTabId = 100;
        // child1Tab（タブID 3）でコンテキストメニューを開いてグループ化
        await manager.createGroupWithRealTab(groupTabId, [3, 4], 'グループ', defaultWindowId, 3);

        // グループタブはchild1Tabの位置（parent1Tabの子）として配置される
        const parent1Result = manager.getNodeByTabId(parent1Tab.id!);
        expect(parent1Result?.node.children.some(c => c.tabId === groupTabId)).toBe(true);

        const groupResult = manager.getNodeByTabId(groupTabId);
        expect(groupResult?.node.children.some(c => c.tabId === 3)).toBe(true);
        expect(groupResult?.node.children.some(c => c.tabId === 4)).toBe(true);
      });

      it('コンテキストメニューを開いたタブがルートレベルの場合、グループもルートレベルに配置される', async () => {
        const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent', windowId: defaultWindowId } as chrome.tabs.Tab;
        await manager.addTab(parentTab, null, defaultWindowId);

        const childTab = { id: 2, url: 'https://example.com/child', title: 'Child', windowId: defaultWindowId } as chrome.tabs.Tab;
        await manager.addTab(childTab, parentTab.id!, defaultWindowId);

        const rootTab = { id: 3, url: 'https://example.com/root', title: 'Root', windowId: defaultWindowId } as chrome.tabs.Tab;
        await manager.addTab(rootTab, null, defaultWindowId);

        const groupTabId = 100;
        // rootTab（タブID 3）でコンテキストメニューを開いてグループ化
        await manager.createGroupWithRealTab(groupTabId, [2, 3], 'グループ', defaultWindowId, 3);

        // グループタブはrootTabの位置（ルートレベル）に配置される
        const tree = manager.getTree(defaultWindowId);
        expect(tree.some(n => n.tabId === groupTabId)).toBe(true);
      });

      it('すべてのタブがルートレベルの場合、グループタブもルートレベルに配置される', async () => {
        const tab1 = { id: 1, url: 'https://example.com/1', title: 'Tab1', windowId: defaultWindowId } as chrome.tabs.Tab;
        const tab2 = { id: 2, url: 'https://example.com/2', title: 'Tab2', windowId: defaultWindowId } as chrome.tabs.Tab;
        await manager.addTab(tab1, null, defaultWindowId);
        await manager.addTab(tab2, null, defaultWindowId);

        const groupTabId = 100;
        await manager.createGroupWithRealTab(groupTabId, [1, 2], 'グループ', defaultWindowId);

        const tree = manager.getTree(defaultWindowId);
        expect(tree.some(n => n.tabId === groupTabId)).toBe(true);
      });

      it('サブツリーをグループ化した際に親子関係が維持される', async () => {
        const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent', windowId: defaultWindowId } as chrome.tabs.Tab;
        await manager.addTab(parentTab, null, defaultWindowId);

        const child1Tab = { id: 2, url: 'https://example.com/child1', title: 'Child1', windowId: defaultWindowId } as chrome.tabs.Tab;
        const child2Tab = { id: 3, url: 'https://example.com/child2', title: 'Child2', windowId: defaultWindowId } as chrome.tabs.Tab;
        await manager.addTab(child1Tab, parentTab.id!, defaultWindowId);
        await manager.addTab(child2Tab, parentTab.id!, defaultWindowId);

        const groupTabId = 100;
        await manager.createGroupWithRealTab(groupTabId, [1, 2, 3], 'グループ', defaultWindowId);

        const tree = manager.getTree(defaultWindowId);
        expect(tree.some(n => n.tabId === groupTabId)).toBe(true);

        const groupResult = manager.getNodeByTabId(groupTabId);
        // グループ直下に親（id:1）だけが入り、その子（2,3）は親の下に維持される
        expect(groupResult?.node.children.length).toBe(1);

        const parentAfter = manager.getNodeByTabId(1);
        expect(parentAfter?.node.children.length).toBe(2);
        expect(parentAfter?.node.children.some(c => c.tabId === 2)).toBe(true);
        expect(parentAfter?.node.children.some(c => c.tabId === 3)).toBe(true);
      });
    });
  });

  describe('replaceTabId', () => {
    it('タブIDを正しく置き換える', async () => {
      const oldTabId = 100;
      const newTabId = 200;
      const tab = { id: oldTabId, url: 'https://example.com', title: 'Example', windowId: defaultWindowId } as chrome.tabs.Tab;

      await manager.addTab(tab, null, defaultWindowId);

      expect(manager.getNodeByTabId(oldTabId)).toBeDefined();
      expect(manager.getNodeByTabId(newTabId)).toBeNull();

      await manager.replaceTabId(oldTabId, newTabId);

      expect(manager.getNodeByTabId(oldTabId)).toBeNull();
      const newResult = manager.getNodeByTabId(newTabId);
      expect(newResult).toBeDefined();
      expect(newResult?.node.tabId).toBe(newTabId);
    });

    it('親子関係のあるタブのIDを置き換えてもツリー構造が維持される', async () => {
      const parentTab = { id: 1, url: 'https://example.com/parent', title: 'Parent', windowId: defaultWindowId } as chrome.tabs.Tab;
      const childTab = { id: 2, url: 'https://example.com/child', title: 'Child', windowId: defaultWindowId } as chrome.tabs.Tab;

      await manager.addTab(parentTab, null, defaultWindowId);
      await manager.addTab(childTab, parentTab.id!, defaultWindowId);

      const newChildTabId = 200;
      await manager.replaceTabId(2, newChildTabId);

      const tree = manager.getTree(defaultWindowId);
      expect(tree.length).toBe(1);

      const parentNode = tree.find(n => n.tabId === 1);
      expect(parentNode).toBeDefined();
      expect(parentNode?.children.length).toBe(1);

      const childNode = parentNode?.children.find(n => n.tabId === newChildTabId);
      expect(childNode).toBeDefined();
    });

    it('存在しないタブIDを置き換えようとしても何も起きない', async () => {
      const tab = { id: 1, url: 'https://example.com', title: 'Example', windowId: defaultWindowId } as chrome.tabs.Tab;

      await manager.addTab(tab, null, defaultWindowId);

      await manager.replaceTabId(999, 1000);

      expect(manager.getNodeByTabId(1)).toBeDefined();
      expect(manager.getNodeByTabId(999)).toBeNull();
      expect(manager.getNodeByTabId(1000)).toBeNull();
    });

    it('置き換え後にストレージに永続化される', async () => {
      const tab = { id: 1, url: 'https://example.com', title: 'Example', windowId: defaultWindowId } as chrome.tabs.Tab;

      await manager.addTab(tab, null, defaultWindowId);
      vi.clearAllMocks();

      await manager.replaceTabId(1, 2);

      expect(mockStorageService.set).toHaveBeenCalledWith('tree_state', expect.anything());
    });
  });
});
