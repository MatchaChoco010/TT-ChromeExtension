import { describe, it, expect, beforeEach } from 'vitest';
import { TreeStateManager } from './TreeStateManager';
import { StorageService } from '@/storage/StorageService';

describe('TreeStateManager - Subtree Operations', () => {
  let treeStateManager: TreeStateManager;
  let storageService: StorageService;
  const defaultWindowId = 1;

  beforeEach(() => {
    storageService = new StorageService();
    treeStateManager = new TreeStateManager(storageService);
  });

  describe('getSubtree', () => {
    it('should return a flat list of all descendants including the root node', async () => {
      // Arrange: Create a tree structure
      //   tab1
      //   ├── tab2
      //   │   ├── tab4
      //   │   └── tab5
      //   └── tab3
      const tab1: chrome.tabs.Tab = { id: 1, index: 0, pinned: false, highlighted: false, active: true, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, frozen: false };
      const tab2: chrome.tabs.Tab = { id: 2, index: 1, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 1, frozen: false };
      const tab3: chrome.tabs.Tab = { id: 3, index: 2, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 1, frozen: false };
      const tab4: chrome.tabs.Tab = { id: 4, index: 3, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 2, frozen: false };
      const tab5: chrome.tabs.Tab = { id: 5, index: 4, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 2, frozen: false };

      await treeStateManager.addTab(tab1, null, defaultWindowId);
      await treeStateManager.addTab(tab2, 1, defaultWindowId);
      await treeStateManager.addTab(tab3, 1, defaultWindowId);
      await treeStateManager.addTab(tab4, 2, defaultWindowId);
      await treeStateManager.addTab(tab5, 2, defaultWindowId);

      // Act: Get subtree starting from tab2
      const subtree = treeStateManager.getSubtree(2);

      // Assert: Should include tab2, tab4, and tab5
      expect(subtree).toHaveLength(3);

      const tabIds = subtree.map(node => node.tabId);
      expect(tabIds).toContain(2);
      expect(tabIds).toContain(4);
      expect(tabIds).toContain(5);
    });

    it('should return only the root node if it has no children', async () => {
      // Arrange: Create a single tab with no children
      const tab1: chrome.tabs.Tab = { id: 1, index: 0, pinned: false, highlighted: false, active: true, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, frozen: false };
      await treeStateManager.addTab(tab1, null, defaultWindowId);

      // Act: Get subtree
      const subtree = treeStateManager.getSubtree(1);

      // Assert: Should include only tab1
      expect(subtree).toHaveLength(1);
      expect(subtree[0].tabId).toBe(1);
    });

    it('should return empty array for non-existent tab', () => {
      // Act: Try to get subtree for non-existent tab
      const subtree = treeStateManager.getSubtree(999);

      // Assert: Should return empty array
      expect(subtree).toEqual([]);
    });

    it('should preserve parent-child relationships in the returned subtree', async () => {
      // Arrange: Create a tree structure
      //   tab1
      //   ├── tab2
      //   │   └── tab3
      const tab1: chrome.tabs.Tab = { id: 1, index: 0, pinned: false, highlighted: false, active: true, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, frozen: false };
      const tab2: chrome.tabs.Tab = { id: 2, index: 1, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 1, frozen: false };
      const tab3: chrome.tabs.Tab = { id: 3, index: 2, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 2, frozen: false };

      await treeStateManager.addTab(tab1, null, defaultWindowId);
      await treeStateManager.addTab(tab2, 1, defaultWindowId);
      await treeStateManager.addTab(tab3, 2, defaultWindowId);

      // Act: Get subtree starting from tab1
      const subtree = treeStateManager.getSubtree(1);

      // Assert: Should have 3 nodes with correct parent-child relationships
      expect(subtree).toHaveLength(3);

      const tab1Node = subtree.find(n => n.tabId === 1);
      const tab2Node = subtree.find(n => n.tabId === 2);
      const tab3Node = subtree.find(n => n.tabId === 3);

      expect(tab1Node).toBeDefined();
      expect(tab2Node).toBeDefined();
      expect(tab3Node).toBeDefined();

      expect(tab1Node!.children.some(c => c.tabId === 2)).toBe(true);
      expect(tab2Node!.children.some(c => c.tabId === 3)).toBe(true);
    });
  });

  describe('getSubtreeSize', () => {
    it('should return the total number of nodes in the subtree including the root', async () => {
      // Arrange: Create a tree structure
      //   tab1
      //   ├── tab2
      //   │   ├── tab4
      //   │   └── tab5
      //   └── tab3
      const tab1: chrome.tabs.Tab = { id: 1, index: 0, pinned: false, highlighted: false, active: true, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, frozen: false };
      const tab2: chrome.tabs.Tab = { id: 2, index: 1, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 1, frozen: false };
      const tab3: chrome.tabs.Tab = { id: 3, index: 2, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 1, frozen: false };
      const tab4: chrome.tabs.Tab = { id: 4, index: 3, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 2, frozen: false };
      const tab5: chrome.tabs.Tab = { id: 5, index: 4, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 2, frozen: false };

      await treeStateManager.addTab(tab1, null, defaultWindowId);
      await treeStateManager.addTab(tab2, 1, defaultWindowId);
      await treeStateManager.addTab(tab3, 1, defaultWindowId);
      await treeStateManager.addTab(tab4, 2, defaultWindowId);
      await treeStateManager.addTab(tab5, 2, defaultWindowId);

      // Act & Assert: Check subtree sizes
      expect(treeStateManager.getSubtreeSize(1)).toBe(5);  // tab1 + tab2 + tab3 + tab4 + tab5
      expect(treeStateManager.getSubtreeSize(2)).toBe(3);  // tab2 + tab4 + tab5
      expect(treeStateManager.getSubtreeSize(3)).toBe(1);  // tab3 only
      expect(treeStateManager.getSubtreeSize(4)).toBe(1);  // tab4 only
    });

    it('should return 1 for a node without children', async () => {
      // Arrange: Create a single tab with no children
      const tab1: chrome.tabs.Tab = { id: 1, index: 0, pinned: false, highlighted: false, active: true, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, frozen: false };
      await treeStateManager.addTab(tab1, null, defaultWindowId);

      // Act & Assert: Should return 1
      expect(treeStateManager.getSubtreeSize(1)).toBe(1);
    });

    it('should return 0 for non-existent tab', () => {
      // Act & Assert: Should return 0 for non-existent tab
      expect(treeStateManager.getSubtreeSize(999)).toBe(0);
    });

    it('should correctly count deeply nested subtrees', async () => {
      // Arrange: Create a deep tree structure
      //   tab1
      //   └── tab2
      //       └── tab3
      //           └── tab4
      const tab1: chrome.tabs.Tab = { id: 1, index: 0, pinned: false, highlighted: false, active: true, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, frozen: false };
      const tab2: chrome.tabs.Tab = { id: 2, index: 1, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 1, frozen: false };
      const tab3: chrome.tabs.Tab = { id: 3, index: 2, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 2, frozen: false };
      const tab4: chrome.tabs.Tab = { id: 4, index: 3, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 3, frozen: false };

      await treeStateManager.addTab(tab1, null, defaultWindowId);
      await treeStateManager.addTab(tab2, 1, defaultWindowId);
      await treeStateManager.addTab(tab3, 2, defaultWindowId);
      await treeStateManager.addTab(tab4, 3, defaultWindowId);

      // Act & Assert: Check subtree sizes at each level
      expect(treeStateManager.getSubtreeSize(1)).toBe(4);  // tab1 + tab2 + tab3 + tab4
      expect(treeStateManager.getSubtreeSize(2)).toBe(3);  // tab2 + tab3 + tab4
      expect(treeStateManager.getSubtreeSize(3)).toBe(2);  // tab3 + tab4
      expect(treeStateManager.getSubtreeSize(4)).toBe(1);  // tab4 only
    });
  });

  describe('moveSubtreeToView', () => {
    it('should move an entire subtree to a different view', async () => {
      // Arrange: Create a tree structure in view index 0
      //   tab1
      //   ├── tab2
      //   └── tab3
      const tab1: chrome.tabs.Tab = { id: 1, index: 0, pinned: false, highlighted: false, active: true, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, frozen: false };
      const tab2: chrome.tabs.Tab = { id: 2, index: 1, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 1, frozen: false };
      const tab3: chrome.tabs.Tab = { id: 3, index: 2, pinned: false, highlighted: false, active: false, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, openerTabId: 1, frozen: false };

      await treeStateManager.addTab(tab1, null, defaultWindowId);
      await treeStateManager.addTab(tab2, 1, defaultWindowId);
      await treeStateManager.addTab(tab3, 1, defaultWindowId);

      // Create a second view
      await treeStateManager.createView(defaultWindowId, 'View 2', '#FF0000');

      // Act: Move subtree to view index 1
      await treeStateManager.moveSubtreeToView(1, defaultWindowId, 1);

      // Assert: All nodes should now be in view index 1
      const node1After = treeStateManager.getNodeByTabId(1);
      const node2After = treeStateManager.getNodeByTabId(2);
      const node3After = treeStateManager.getNodeByTabId(3);

      expect(node1After!.viewIndex).toBe(1);
      expect(node2After!.viewIndex).toBe(1);
      expect(node3After!.viewIndex).toBe(1);

      // Parent-child relationships preserved via children array
      expect(node1After!.node.children.some(c => c.tabId === 2)).toBe(true);
      expect(node1After!.node.children.some(c => c.tabId === 3)).toBe(true);
    });

    it('should handle moving a single node without children', async () => {
      // Arrange: Create a single tab
      const tab1: chrome.tabs.Tab = { id: 1, index: 0, pinned: false, highlighted: false, active: true, incognito: false, windowId: defaultWindowId, selected: false, discarded: false, autoDiscardable: false, groupId: -1, frozen: false };
      await treeStateManager.addTab(tab1, null, defaultWindowId);

      // Create a second view
      await treeStateManager.createView(defaultWindowId, 'View 2', '#FF0000');

      // Act: Move to view index 1
      await treeStateManager.moveSubtreeToView(1, defaultWindowId, 1);

      // Assert: Node should be in view index 1
      const node1After = treeStateManager.getNodeByTabId(1);
      expect(node1After!.viewIndex).toBe(1);
    });

    it('should do nothing for non-existent tab', async () => {
      // Act & Assert: Should not throw error
      await expect(
        treeStateManager.moveSubtreeToView(999, defaultWindowId, 1)
      ).resolves.not.toThrow();
    });
  });
});
