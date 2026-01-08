/**
 * IndexedDB Test Fixtures
 *
 * IndexedDB統合E2Eテスト用のテストデータ定義
 */

export interface TreeStateTestData {
  tabs: Array<{
    url: string;
    title: string;
    parentIndex?: number; // 親タブのインデックス（undefined = ルート）
  }>;
}

export const BASIC_TREE_STATE_FIXTURE: TreeStateTestData = {
  tabs: [
    { url: 'http://127.0.0.1/page1', title: 'Page 1' },
    { url: 'http://127.0.0.1/page2', title: 'Page 2' },
    { url: 'http://127.0.0.1/page3', title: 'Page 3' },
  ],
};

export const HIERARCHICAL_TREE_STATE_FIXTURE: TreeStateTestData = {
  tabs: [
    { url: 'http://127.0.0.1/parent1', title: 'Parent 1' },
    { url: 'http://127.0.0.1/child1-1', title: 'Child 1-1', parentIndex: 0 },
    { url: 'http://127.0.0.1/child1-2', title: 'Child 1-2', parentIndex: 0 },
    { url: 'http://127.0.0.1/parent2', title: 'Parent 2' },
    { url: 'http://127.0.0.1/child2-1', title: 'Child 2-1', parentIndex: 3 },
  ],
};

/**
 * 大量データテスト用のタブ生成関数
 * @param count - 生成するタブの数
 * @returns TreeStateTestData
 */
export function generateLargeTabData(count: number): TreeStateTestData {
  const tabs: TreeStateTestData['tabs'] = [];

  for (let i = 0; i < count; i++) {
    tabs.push({
      url: `http://127.0.0.1/tab-${i}`,
      title: `Test Tab ${i}`,
    });
  }

  return { tabs };
}

export const LARGE_DATA_COUNT = 1000;

export const INDEXEDDB_SELECTORS = {
  TAB_TREE: '[data-testid="tab-tree"]',
  TAB_NODE: '[data-testid="tab-node"]',
  LOADING_INDICATOR: '[data-testid="loading-indicator"]',
  ERROR_MESSAGE: '[data-testid="error-message"]',
  ERROR_RETRY_BUTTON: '[data-testid="error-retry-button"]',
  STORAGE_SETTINGS: '[data-testid="storage-settings"]',
  CLEAR_STORAGE_BUTTON: '[data-testid="clear-storage-button"]',
  STORAGE_STATUS: '[data-testid="storage-status"]',
  STORAGE_SIZE: '[data-testid="storage-size"]',
};

export const INDEXEDDB_TIMEOUTS = {
  SAVE: 5000,
  LOAD: 10000,
  LARGE_DATA: 30000,
  RESTORE: 15000,
};

/**
 * IndexedDB データベース名（テスト対象のアプリケーションと同じ）
 */
export const DB_NAME = 'vivaldi-tt-snapshots';
export const DB_VERSION = 1;
export const STORE_NAME = 'snapshots';

export const TEST_SNAPSHOT_DATA = {
  id: 'test-snapshot-1',
  name: 'Test Snapshot',
  isAutoSave: false,
  data: {
    views: [],
    tabs: [
      {
        url: 'http://127.0.0.1/test1',
        title: 'Test Page 1',
        parentId: null,
        viewId: 'default',
      },
      {
        url: 'http://127.0.0.1/test2',
        title: 'Test Page 2',
        parentId: null,
        viewId: 'default',
      },
    ],
    groups: [],
  },
};

/**
 * 大量スナップショットデータ生成関数
 * @param count - 生成するスナップショットの数
 * @returns スナップショットデータの配列
 */
export function generateLargeSnapshotData(
  count: number
): Array<typeof TEST_SNAPSHOT_DATA> {
  const snapshots: Array<typeof TEST_SNAPSHOT_DATA> = [];

  for (let i = 0; i < count; i++) {
    snapshots.push({
      id: `test-snapshot-${i}`,
      name: `Test Snapshot ${i}`,
      isAutoSave: i % 5 === 0,
      data: {
        views: [],
        tabs: [
          {
            url: `http://127.0.0.1/snapshot-${i}-tab1`,
            title: `Snapshot ${i} Tab 1`,
            parentId: null,
            viewId: 'default',
          },
        ],
        groups: [],
      },
    });
  }

  return snapshots;
}
