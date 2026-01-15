import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ViewManager } from './ViewManager';
import { TreeStateManager } from './TreeStateManager';
import { StorageService } from '@/storage/StorageService';

/**
 * ViewManager と TreeStateManager の統合テスト
 * ユーザーがタブを別のビューに移動する
 */
describe('ViewManager と TreeStateManager の統合テスト', () => {
  let viewManager: ViewManager;
  let treeStateManager: TreeStateManager;
  let storageService: StorageService;

  beforeEach(() => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
          remove: () => Promise.resolve(),
        },
      },
    });

    storageService = new StorageService();
    viewManager = new ViewManager(storageService);
    treeStateManager = new TreeStateManager(storageService);

    viewManager.setTreeStateManager(treeStateManager);
  });

  describe('moveTabToView', () => {
    it('タブを別のビューに移動できる', async () => {
      const view1 = viewManager.createView('Work', '#ff0000');
      const view2 = viewManager.createView('Personal', '#00ff00');

      await treeStateManager.addTab(
        { id: 1, url: 'https://example.com', title: 'Example' } as chrome.tabs.Tab,
        null,
        view1.id,
      );

      const view1Tabs = treeStateManager.getTree(view1.id);
      expect(view1Tabs).toHaveLength(1);
      expect(view1Tabs[0].tabId).toBe(1);

      const view2TabsBefore = treeStateManager.getTree(view2.id);
      expect(view2TabsBefore).toHaveLength(0);

      await viewManager.moveTabToView(1, view1.id, view2.id);

      const view2TabsAfter = treeStateManager.getTree(view2.id);
      expect(view2TabsAfter).toHaveLength(1);
      expect(view2TabsAfter[0].tabId).toBe(1);

      const view1TabsAfter = treeStateManager.getTree(view1.id);
      expect(view1TabsAfter).toHaveLength(0);
    });

    it('サブツリー全体を別のビューに移動できる', async () => {
      const view1 = viewManager.createView('Work', '#ff0000');
      const view2 = viewManager.createView('Personal', '#00ff00');

      await treeStateManager.addTab(
        { id: 1, url: 'https://example.com', title: 'Parent' } as chrome.tabs.Tab,
        null,
        view1.id,
      );

      await treeStateManager.addTab(
        { id: 2, url: 'https://example.com/child', title: 'Child' } as chrome.tabs.Tab,
        'node-1',
        view1.id,
      );

      const view1Tabs = treeStateManager.getTree(view1.id);
      expect(view1Tabs).toHaveLength(1);
      expect(view1Tabs[0].children).toHaveLength(1);

      await viewManager.moveTabToView(1, view1.id, view2.id);

      const view2TabsAfter = treeStateManager.getTree(view2.id);
      expect(view2TabsAfter).toHaveLength(1);
      expect(view2TabsAfter[0].tabId).toBe(1);
      expect(view2TabsAfter[0].children).toHaveLength(1);
      expect(view2TabsAfter[0].children[0].tabId).toBe(2);

      const view1TabsAfter = treeStateManager.getTree(view1.id);
      expect(view1TabsAfter).toHaveLength(0);
    });
  });

  describe('getTabsByView', () => {
    it('指定されたビューのタブを取得できる', async () => {
      const view1 = viewManager.createView('Work', '#ff0000');
      const view2 = viewManager.createView('Personal', '#00ff00');

      await treeStateManager.addTab(
        { id: 1, url: 'https://example.com', title: 'Tab 1' } as chrome.tabs.Tab,
        null,
        view1.id,
      );
      await treeStateManager.addTab(
        { id: 2, url: 'https://example.com', title: 'Tab 2' } as chrome.tabs.Tab,
        null,
        view1.id,
      );
      await treeStateManager.addTab(
        { id: 3, url: 'https://example.com', title: 'Tab 3' } as chrome.tabs.Tab,
        null,
        view2.id,
      );

      const view1Tabs = viewManager.getTabsByView(view1.id);
      expect(view1Tabs).toHaveLength(2);
      expect(view1Tabs.map((tab) => tab.tabId)).toEqual([1, 2]);

      const view2Tabs = viewManager.getTabsByView(view2.id);
      expect(view2Tabs).toHaveLength(1);
      expect(view2Tabs[0].tabId).toBe(3);
    });
  });
});
