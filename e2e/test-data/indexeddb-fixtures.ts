/**
 * IndexedDB Test Fixtures
 *
 * IndexedDB統合E2Eテスト用のテストデータ定義
 */

export interface TreeStateTestData {
  /**
   * テスト用のタブ情報
   */
  tabs: Array<{
    url: string;
    title: string;
    parentIndex?: number; // 親タブのインデックス（undefined = ルート）
  }>;
}

/**
 * 基本的なツリー状態テストデータ
 */
export const BASIC_TREE_STATE_FIXTURE: TreeStateTestData = {
  tabs: [
    { url: 'https://example.com/page1', title: 'Page 1' },
    { url: 'https://example.com/page2', title: 'Page 2' },
    { url: 'https://example.com/page3', title: 'Page 3' },
  ],
};

/**
 * 階層構造を持つツリー状態テストデータ
 */
export const HIERARCHICAL_TREE_STATE_FIXTURE: TreeStateTestData = {
  tabs: [
    { url: 'https://example.com/parent1', title: 'Parent 1' },
    { url: 'https://example.com/child1-1', title: 'Child 1-1', parentIndex: 0 },
    { url: 'https://example.com/child1-2', title: 'Child 1-2', parentIndex: 0 },
    { url: 'https://example.com/parent2', title: 'Parent 2' },
    { url: 'https://example.com/child2-1', title: 'Child 2-1', parentIndex: 3 },
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
      url: `https://example.com/tab-${i}`,
      title: `Test Tab ${i}`,
    });
  }

  return { tabs };
}

/**
 * 大量データテスト用フィクスチャ（1000タブ以上）
 */
export const LARGE_DATA_COUNT = 1000;

/**
 * IndexedDB UIセレクタ
 */
export const INDEXEDDB_SELECTORS = {
  // タブツリー
  TAB_TREE: '[data-testid="tab-tree"]',
  TAB_NODE: '[data-testid="tab-node"]',

  // ローディング状態
  LOADING_INDICATOR: '[data-testid="loading-indicator"]',

  // エラー表示
  ERROR_MESSAGE: '[data-testid="error-message"]',
  ERROR_RETRY_BUTTON: '[data-testid="error-retry-button"]',

  // ストレージ設定
  STORAGE_SETTINGS: '[data-testid="storage-settings"]',
  CLEAR_STORAGE_BUTTON: '[data-testid="clear-storage-button"]',

  // デバッグ情報
  STORAGE_STATUS: '[data-testid="storage-status"]',
  STORAGE_SIZE: '[data-testid="storage-size"]',
};

/**
 * IndexedDB関連のタイムアウト設定
 */
export const INDEXEDDB_TIMEOUTS = {
  /**
   * ストレージ保存の最大待機時間
   */
  SAVE: 5000,

  /**
   * ストレージ読み込みの最大待機時間
   */
  LOAD: 10000,

  /**
   * 大量データ処理の最大待機時間
   */
  LARGE_DATA: 30000,

  /**
   * ブラウザ再起動後の状態復元待機時間
   */
  RESTORE: 15000,
};

/**
 * IndexedDB データベース名（テスト対象のアプリケーションと同じ）
 */
export const DB_NAME = 'vivaldi-tt-snapshots';
export const DB_VERSION = 1;
export const STORE_NAME = 'snapshots';

/**
 * テスト用のスナップショットデータ
 */
export const TEST_SNAPSHOT_DATA = {
  id: 'test-snapshot-1',
  name: 'Test Snapshot',
  isAutoSave: false,
  data: {
    views: [],
    tabs: [
      {
        url: 'https://example.com/test1',
        title: 'Test Page 1',
        parentId: null,
        viewId: 'default',
      },
      {
        url: 'https://example.com/test2',
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
      isAutoSave: i % 5 === 0, // 5個に1個は自動保存
      data: {
        views: [],
        tabs: [
          {
            url: `https://example.com/snapshot-${i}-tab1`,
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
