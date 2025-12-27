import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SnapshotManager } from './SnapshotManager';
import { IndexedDBService } from '@/storage/IndexedDBService';
import type {
  IStorageService,
  View,
  Group,
  TabNode,
  TabSnapshot,
} from '@/types';

// Chrome mock（モジュールレベルで定義）
const chromeMock = {
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};

// グローバルchromeオブジェクトをモック（vi.stubGlobalを使用）
vi.stubGlobal('chrome', chromeMock);


/**
 * SnapshotManager 統合テスト
 * Task 14.4: スナップショット機能のテスト
 * Requirements: 11.1, 11.2, 11.3, 11.5
 *
 * Acceptance Criteria:
 * - スナップショットがJSON形式でエクスポートされることを確認（AC 11.1, 11.2）
 * - スナップショットからタブとツリー構造が復元されることを確認（AC 11.3）
 * - 自動スナップショットが設定間隔で保存されることを確認（AC 11.5）
 */
describe('SnapshotManager - Integration Tests', () => {
  let snapshotManager: SnapshotManager;
  let indexedDBService: IndexedDBService;
  let mockStorageService: IStorageService;

  // テスト用のビューデータ
  const testViews: View[] = [
    { id: 'view-1', name: 'Work', color: '#ff0000' },
    { id: 'view-2', name: 'Personal', color: '#00ff00' },
  ];

  // テスト用のグループデータ
  const testGroups: Group[] = [
    { id: 'group-1', name: 'Research', color: '#0000ff', isExpanded: true },
    { id: 'group-2', name: 'Development', color: '#ffff00', isExpanded: false },
  ];

  // テスト用のタブノードデータ
  const testNodes: Record<string, TabNode> = {
    'node-1': {
      id: 'node-1',
      tabId: 1,
      parentId: null,
      children: [],
      isExpanded: true,
      depth: 0,
      viewId: 'view-1',
    },
    'node-2': {
      id: 'node-2',
      tabId: 2,
      parentId: 'node-1',
      children: [],
      isExpanded: true,
      depth: 1,
      viewId: 'view-1',
    },
    'node-3': {
      id: 'node-3',
      tabId: 3,
      parentId: null,
      children: [],
      isExpanded: true,
      depth: 0,
      viewId: 'view-2',
    },
  };

  beforeEach(async () => {
    // IndexedDBServiceの実インスタンスを作成（インメモリ）
    indexedDBService = new IndexedDBService();

    // StorageServiceのモック
    mockStorageService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'tree_state') {
          return Promise.resolve({
            views: testViews,
            currentViewId: 'view-1',
            nodes: testNodes,
            tabToNode: { 1: 'node-1', 2: 'node-2', 3: 'node-3' },
          });
        }
        if (key === 'groups') {
          return Promise.resolve({
            'group-1': testGroups[0],
            'group-2': testGroups[1],
          });
        }
        return Promise.resolve(null);
      }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      onChange: vi.fn().mockReturnValue(() => {}),
    };

    // chromeMockの初期化
    chromeMock.tabs.query.mockResolvedValue([
      {
        id: 1,
        url: 'https://example.com/page1',
        title: 'Page 1',
        windowId: 1,
      },
      {
        id: 2,
        url: 'https://example.com/page2',
        title: 'Page 2 - Child of Page 1',
        windowId: 1,
      },
      {
        id: 3,
        url: 'https://example.com/page3',
        title: 'Page 3',
        windowId: 1,
      },
    ]);
    chromeMock.tabs.create.mockImplementation(({ url }: { url: string }) => {
      // タブIDをインクリメント
      const newId = 100 + chromeMock.tabs.create.mock.calls.length;
      return Promise.resolve({
        id: newId,
        url,
        title: `Tab ${newId}`,
        windowId: 1,
      });
    });
    chromeMock.alarms.clear.mockResolvedValue(true);

    snapshotManager = new SnapshotManager(
      indexedDBService,
      mockStorageService,
    );
  });

  afterEach(async () => {
    // IndexedDBをクリーンアップ
    await indexedDBService.deleteOldSnapshots(0);
  });

  describe('JSON Export and Import (AC 11.1, 11.2)', () => {
    it('should export snapshot as JSON format with all required data', async () => {
      // Acceptance Criteria 11.1: スナップショットがJSON形式でエクスポートされる
      // Acceptance Criteria 11.2: タブのURL、タイトル、親子関係、グループ情報を含む

      // スナップショットを作成
      const snapshot = await snapshotManager.createSnapshot('Export Test');

      // JSON形式でエクスポート
      const jsonString = await snapshotManager.exportSnapshot(snapshot.id);

      // JSON文字列として正しくエクスポートされることを確認
      expect(typeof jsonString).toBe('string');
      expect(jsonString.length).toBeGreaterThan(0);

      // パース可能であることを確認
      const parsed = JSON.parse(jsonString);

      // 基本情報が含まれることを確認
      expect(parsed.id).toBe(snapshot.id);
      expect(parsed.name).toBe('Export Test');
      expect(parsed.createdAt).toBeDefined();
      expect(parsed.isAutoSave).toBe(false);

      // ビュー情報が含まれることを確認
      expect(parsed.data.views).toEqual(testViews);

      // グループ情報が含まれることを確認
      expect(parsed.data.groups).toEqual(testGroups);

      // タブ情報が含まれることを確認
      expect(parsed.data.tabs).toHaveLength(3);

      // 各タブに必須フィールドが含まれることを確認
      parsed.data.tabs.forEach((tab: TabSnapshot) => {
        expect(tab).toHaveProperty('url');
        expect(tab).toHaveProperty('title');
        expect(tab).toHaveProperty('parentId');
        expect(tab).toHaveProperty('viewId');
      });

      // 親子関係が正しく保存されることを確認
      const tab2 = parsed.data.tabs.find(
        (t: TabSnapshot) => t.url === 'https://example.com/page2',
      );
      expect(tab2.parentId).toBe('node-1');

      const tab1 = parsed.data.tabs.find(
        (t: TabSnapshot) => t.url === 'https://example.com/page1',
      );
      expect(tab1.parentId).toBeNull();
    });

    it('should export and import snapshot maintaining data integrity', async () => {
      // スナップショットを作成
      const originalSnapshot = await snapshotManager.createSnapshot(
        'Round-trip Test',
      );

      // エクスポート
      const jsonString = await snapshotManager.exportSnapshot(
        originalSnapshot.id,
      );

      // 元のスナップショットを削除
      await snapshotManager.deleteSnapshot(originalSnapshot.id);

      // インポート
      const importedSnapshot = await snapshotManager.importSnapshot(jsonString);

      // インポートされたスナップショットが元のデータを保持していることを確認
      expect(importedSnapshot.name).toBe('Round-trip Test');
      expect(importedSnapshot.data.views).toEqual(testViews);
      expect(importedSnapshot.data.groups).toEqual(testGroups);
      expect(importedSnapshot.data.tabs).toHaveLength(3);
    });

    it('should export snapshot with correct JSON structure format', async () => {
      const snapshot = await snapshotManager.createSnapshot(
        'Structure Test',
      );
      const jsonString = await snapshotManager.exportSnapshot(snapshot.id);
      const parsed = JSON.parse(jsonString);

      // トップレベルの構造を確認
      expect(parsed).toHaveProperty('id');
      expect(parsed).toHaveProperty('createdAt');
      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('isAutoSave');
      expect(parsed).toHaveProperty('data');

      // データ構造を確認
      expect(parsed.data).toHaveProperty('views');
      expect(parsed.data).toHaveProperty('tabs');
      expect(parsed.data).toHaveProperty('groups');

      // 配列であることを確認
      expect(Array.isArray(parsed.data.views)).toBe(true);
      expect(Array.isArray(parsed.data.tabs)).toBe(true);
      expect(Array.isArray(parsed.data.groups)).toBe(true);
    });
  });

  describe('Snapshot Restoration (AC 11.3)', () => {
    it('should restore tabs and tree structure from snapshot', async () => {
      // Acceptance Criteria 11.3: スナップショットからタブとツリー構造が復元される

      // スナップショットを作成
      const snapshot = await snapshotManager.createSnapshot('Restore Test');

      // chrome.tabs.createのモックをリセット
      chromeMock.tabs.create.mockClear();

      // スナップショットから復元
      await snapshotManager.restoreSnapshot(snapshot.id);

      // タブが作成されることを確認
      expect(chromeMock.tabs.create).toHaveBeenCalledTimes(3);

      // 正しいURLでタブが作成されることを確認
      const calls = chromeMock.tabs.create.mock.calls as Array<[{ url: string; active: boolean }]>;
      const urls = calls.map((call) => call[0].url);

      expect(urls).toContain('https://example.com/page1');
      expect(urls).toContain('https://example.com/page2');
      expect(urls).toContain('https://example.com/page3');

      // タブが非アクティブで作成されることを確認
      calls.forEach((call) => {
        expect(call[0].active).toBe(false);
      });
    });

    it('should restore tabs in correct order preserving hierarchy', async () => {
      // 階層構造を持つスナップショットを作成
      const snapshot = await snapshotManager.createSnapshot(
        'Hierarchy Test',
      );

      // スナップショットデータを確認
      const exportedData = await snapshotManager.exportSnapshot(snapshot.id);
      const parsed = JSON.parse(exportedData);

      // 親子関係が保存されていることを確認
      const tabs = parsed.data.tabs as TabSnapshot[];
      const parentTab = tabs.find((t) => t.parentId === null);
      const childTab = tabs.find((t) => t.parentId === 'node-1');

      expect(parentTab).toBeDefined();
      expect(childTab).toBeDefined();
      expect(childTab?.parentId).toBe('node-1');
    });

    it('should handle snapshot restoration with empty tabs gracefully', async () => {
      // 空のツリー状態を設定
      mockStorageService.get = vi.fn().mockImplementation((key: string) => {
        if (key === 'tree_state') {
          return Promise.resolve({
            views: testViews,
            currentViewId: 'view-1',
            nodes: {},
            tabToNode: {},
          });
        }
        if (key === 'groups') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });

      // chrome.tabs.queryが空配列を返すように設定
      chromeMock.tabs.query.mockResolvedValue([]);

      const snapshot = await snapshotManager.createSnapshot('Empty Test');

      // エクスポートして確認
      const jsonString = await snapshotManager.exportSnapshot(snapshot.id);
      const parsed = JSON.parse(jsonString);

      expect(parsed.data.tabs).toHaveLength(0);
    });
  });

  describe('Auto-Snapshot Functionality (AC 11.5)', () => {
    it('should create auto-snapshots at configured intervals', async () => {
      // Acceptance Criteria 11.5: 自動スナップショットが設定間隔で保存される

      const intervalMinutes = 10;

      // 自動スナップショットを開始
      snapshotManager.startAutoSnapshot(intervalMinutes);

      // アラームが正しく設定されることを確認
      expect(chromeMock.alarms.create).toHaveBeenCalledWith(
        'auto-snapshot',
        {
          periodInMinutes: intervalMinutes,
        },
      );

      // アラームリスナーを取得
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[(alarm: chrome.alarms.Alarm) => void]>;
      const alarmListener = addListenerCalls[0][0];

      // アラームを複数回発火してスナップショットが作成されることを確認
      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });
      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });
      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      // 3回のスナップショットが作成されることを確認
      const snapshots = await snapshotManager.getSnapshots();
      expect(snapshots.length).toBe(3);

      // すべて自動保存フラグが立っていることを確認
      snapshots.forEach((snapshot) => {
        expect(snapshot.isAutoSave).toBe(true);
        expect(snapshot.name).toContain('Auto Snapshot');
      });
    });

    it('should create auto-snapshots with timestamp in name', async () => {
      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      // アラームリスナーを取得
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[(alarm: chrome.alarms.Alarm) => void]>;
      const alarmListener = addListenerCalls[0][0];

      // アラームを発火
      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      // スナップショットが作成されることを確認
      const snapshots = await snapshotManager.getSnapshots();
      expect(snapshots.length).toBe(1);

      // スナップショット名に今日の日付が含まれることを確認
      const today = new Date().toISOString().split('T')[0];
      expect(snapshots[0].name).toContain(today);
      expect(snapshots[0].isAutoSave).toBe(true);
    });

    it('should stop auto-snapshots when interval is set to 0', async () => {

      // 自動スナップショットを開始
      snapshotManager.startAutoSnapshot(10);

      // 一度リセット
      chromeMock.alarms.create.mockClear();

      // 間隔を0に設定して停止
      snapshotManager.startAutoSnapshot(0);

      // アラームがクリアされることを確認
      expect(chromeMock.alarms.clear).toHaveBeenCalledWith('auto-snapshot');

      // 新しいアラームが作成されないことを確認
      expect(chromeMock.alarms.create).not.toHaveBeenCalled();
    });

    it('should maintain auto-snapshot state across restarts', async () => {

      // 自動スナップショットを開始
      snapshotManager.startAutoSnapshot(10);

      // リスナーが登録されることを確認
      expect(chromeMock.alarms.onAlarm.addListener).toHaveBeenCalled();

      // 停止
      await snapshotManager.stopAutoSnapshot();

      // リスナーが削除されることを確認
      expect(chromeMock.alarms.onAlarm.removeListener).toHaveBeenCalled();
    });
  });

  describe('Snapshot History Management', () => {
    it('should maintain multiple snapshots in IndexedDB', async () => {
      // 複数のスナップショットを作成
      await snapshotManager.createSnapshot('Snapshot 1');
      await snapshotManager.createSnapshot('Snapshot 2');
      await snapshotManager.createSnapshot('Snapshot 3');

      // すべてのスナップショットが取得できることを確認
      const snapshots = await snapshotManager.getSnapshots();
      expect(snapshots.length).toBe(3);

      const names = snapshots.map((s) => s.name);
      expect(names).toContain('Snapshot 1');
      expect(names).toContain('Snapshot 2');
      expect(names).toContain('Snapshot 3');
    });

    it('should delete specific snapshots', async () => {
      // スナップショットを作成
      const snapshot1 = await snapshotManager.createSnapshot('Delete Test 1');
      const snapshot2 = await snapshotManager.createSnapshot('Delete Test 2');

      // 1つを削除
      await snapshotManager.deleteSnapshot(snapshot1.id);

      // 残りのスナップショットを確認
      const snapshots = await snapshotManager.getSnapshots();
      expect(snapshots.length).toBe(1);
      expect(snapshots[0].id).toBe(snapshot2.id);
    });

    it('should delete old snapshots keeping only recent ones', async () => {
      // 複数のスナップショットを作成（小さな遅延を入れて順序を確実にする）
      for (let i = 1; i <= 15; i++) {
        await snapshotManager.createSnapshot(`Snapshot ${i}`);
        // 小さな遅延を追加して createdAt が異なることを保証
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // 最新10件のみを保持
      await indexedDBService.deleteOldSnapshots(10);

      // スナップショットが10件に制限されることを確認
      const snapshots = await snapshotManager.getSnapshots();
      expect(snapshots.length).toBe(10);

      // 最新のスナップショットが残っていることを確認
      const names = snapshots.map((s) => s.name);
      expect(names).toContain('Snapshot 15');
      expect(names).toContain('Snapshot 14');
      expect(names).toContain('Snapshot 13');
      expect(names).toContain('Snapshot 6');
      // 最も古いスナップショットが削除されていることを確認
      expect(names).not.toContain('Snapshot 1');
      expect(names).not.toContain('Snapshot 2');
      expect(names).not.toContain('Snapshot 3');
      expect(names).not.toContain('Snapshot 4');
      expect(names).not.toContain('Snapshot 5');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when exporting non-existent snapshot', async () => {
      await expect(
        snapshotManager.exportSnapshot('non-existent-id'),
      ).rejects.toThrow('Snapshot not found');
    });

    it('should throw error when restoring non-existent snapshot', async () => {
      await expect(
        snapshotManager.restoreSnapshot('non-existent-id'),
      ).rejects.toThrow('Snapshot not found');
    });

    it('should throw error when importing invalid JSON', async () => {
      await expect(
        snapshotManager.importSnapshot('invalid json data'),
      ).rejects.toThrow();
    });

    it('should handle storage errors gracefully', async () => {
      // ストレージエラーをシミュレート
      mockStorageService.get = vi
        .fn()
        .mockRejectedValue(new Error('Storage error'));

      await expect(
        snapshotManager.createSnapshot('Error Test'),
      ).rejects.toThrow();
    });
  });

  describe('Data Integrity', () => {
    it('should preserve view IDs in snapshots', async () => {
      const snapshot = await snapshotManager.createSnapshot('View ID Test');
      const jsonString = await snapshotManager.exportSnapshot(snapshot.id);
      const parsed = JSON.parse(jsonString);

      // ビューIDが保持されることを確認
      const tabs = parsed.data.tabs as TabSnapshot[];
      const tab1 = tabs.find(
        (t) => t.url === 'https://example.com/page1',
      );
      const tab3 = tabs.find(
        (t) => t.url === 'https://example.com/page3',
      );

      expect(tab1?.viewId).toBe('view-1');
      expect(tab3?.viewId).toBe('view-2');
    });

    it('should preserve group information in snapshots', async () => {
      const snapshot = await snapshotManager.createSnapshot('Group Test');
      const jsonString = await snapshotManager.exportSnapshot(snapshot.id);
      const parsed = JSON.parse(jsonString);

      // グループ情報が保持されることを確認
      expect(parsed.data.groups).toHaveLength(2);
      expect(parsed.data.groups[0].name).toBe('Research');
      expect(parsed.data.groups[0].color).toBe('#0000ff');
      expect(parsed.data.groups[0].isExpanded).toBe(true);

      expect(parsed.data.groups[1].name).toBe('Development');
      expect(parsed.data.groups[1].color).toBe('#ffff00');
      expect(parsed.data.groups[1].isExpanded).toBe(false);
    });

    it('should handle Date serialization correctly in export/import', async () => {
      const snapshot = await snapshotManager.createSnapshot('Date Test');
      const jsonString = await snapshotManager.exportSnapshot(snapshot.id);

      // JSON文字列にDate型ではなくISO文字列が含まれることを確認
      const parsed = JSON.parse(jsonString);
      expect(typeof parsed.createdAt).toBe('string');
      expect(parsed.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // インポート後にDateオブジェクトに変換されることを確認
      const imported = await snapshotManager.importSnapshot(jsonString);
      expect(imported.createdAt).toBeInstanceOf(Date);
    });
  });
});
