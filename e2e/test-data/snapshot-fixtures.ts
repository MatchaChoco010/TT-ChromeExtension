/**
 * Snapshot Test Fixtures
 *
 * スナップショット機能E2Eテスト用のテストデータ定義
 * Task 4.10: スナップショット機能の実装とテスト
 * Requirement 3.10: スナップショット機能
 */

export interface SnapshotTestData {
  /**
   * スナップショット名
   */
  name: string;

  /**
   * 自動保存フラグ
   */
  isAutoSave: boolean;

  /**
   * テスト用のタブURL一覧
   */
  tabUrls: string[];
}

/**
 * テスト用のスナップショット名
 */
export const TEST_SNAPSHOT_NAMES = {
  MANUAL_1: 'Manual Snapshot 1',
  MANUAL_2: 'Manual Snapshot 2',
  MANUAL_3: 'Manual Snapshot 3',
  AUTO_1: 'Auto Snapshot 1',
  AUTO_2: 'Auto Snapshot 2',
};

/**
 * 手動スナップショットのテストデータ
 */
export const MANUAL_SNAPSHOT_FIXTURE: SnapshotTestData = {
  name: TEST_SNAPSHOT_NAMES.MANUAL_1,
  isAutoSave: false,
  tabUrls: [
    'https://example.com/page1',
    'https://example.com/page2',
    'https://example.com/page3',
  ],
};

/**
 * 自動スナップショットのテストデータ
 */
export const AUTO_SNAPSHOT_FIXTURE: SnapshotTestData = {
  name: TEST_SNAPSHOT_NAMES.AUTO_1,
  isAutoSave: true,
  tabUrls: [
    'https://example.com/auto1',
    'https://example.com/auto2',
  ],
};

/**
 * 複数スナップショット管理用のテストデータ
 */
export const MULTIPLE_SNAPSHOTS_FIXTURE: SnapshotTestData[] = [
  {
    name: TEST_SNAPSHOT_NAMES.MANUAL_1,
    isAutoSave: false,
    tabUrls: ['https://example.com/snapshot1-1'],
  },
  {
    name: TEST_SNAPSHOT_NAMES.MANUAL_2,
    isAutoSave: false,
    tabUrls: ['https://example.com/snapshot2-1', 'https://example.com/snapshot2-2'],
  },
  {
    name: TEST_SNAPSHOT_NAMES.AUTO_1,
    isAutoSave: true,
    tabUrls: ['https://example.com/auto1-1'],
  },
];

/**
 * エクスポート/インポートテスト用のスナップショットJSON
 */
export const EXPORT_SNAPSHOT_FIXTURE = {
  id: 'snapshot-test-export',
  createdAt: '2025-01-01T00:00:00.000Z',
  name: 'Exported Snapshot',
  isAutoSave: false,
  data: {
    views: [],
    tabs: [
      {
        url: 'https://example.com/exported1',
        title: 'Exported Page 1',
        parentId: null,
        viewId: 'default',
      },
      {
        url: 'https://example.com/exported2',
        title: 'Exported Page 2',
        parentId: null,
        viewId: 'default',
      },
    ],
    groups: [],
  },
};

/**
 * 自動スナップショット間隔テスト用の設定
 */
export const AUTO_SNAPSHOT_INTERVALS = {
  /**
   * テスト用の短い間隔（1分）
   */
  SHORT: 1,

  /**
   * 無効化
   */
  DISABLED: 0,
};

/**
 * スナップショットUIセレクタ
 */
export const SNAPSHOT_SELECTORS = {
  // スナップショットセクション
  SECTION: '[data-testid="snapshot-section"]',

  // スナップショット作成ボタン
  CREATE_BUTTON: '[data-testid="create-snapshot-button"]',

  // スナップショット名入力
  NAME_INPUT: '[data-testid="snapshot-name-input"]',

  // スナップショットリスト
  LIST: '[data-testid="snapshot-list"]',

  // スナップショットアイテム
  ITEM: '[data-testid="snapshot-item"]',

  // 復元ボタン
  RESTORE_BUTTON: '[data-testid="snapshot-restore-button"]',

  // 削除ボタン
  DELETE_BUTTON: '[data-testid="snapshot-delete-button"]',

  // エクスポートボタン
  EXPORT_BUTTON: '[data-testid="snapshot-export-button"]',

  // インポートボタン
  IMPORT_BUTTON: '[data-testid="snapshot-import-button"]',

  // インポート入力（hidden）
  IMPORT_INPUT: '[data-testid="snapshot-import-input"]',

  // 自動保存バッジ
  AUTO_BADGE: '[data-testid="snapshot-auto-badge"]',

  // 自動スナップショット設定
  AUTO_SNAPSHOT_TOGGLE: '[data-testid="auto-snapshot-toggle"]',
  AUTO_SNAPSHOT_INTERVAL: '[data-testid="auto-snapshot-interval"]',

  // 確認ダイアログ
  CONFIRM_DIALOG: '[data-testid="snapshot-confirm-dialog"]',
  CONFIRM_YES: '[data-testid="snapshot-confirm-yes"]',
  CONFIRM_NO: '[data-testid="snapshot-confirm-no"]',

  // 復元オプション
  RESTORE_OPTION_CLOSE: '[data-testid="restore-option-close"]',
  RESTORE_OPTION_KEEP: '[data-testid="restore-option-keep"]',
};

/**
 * スナップショット関連のタイムアウト設定
 */
export const SNAPSHOT_TIMEOUTS = {
  /**
   * スナップショット作成の最大待機時間
   */
  CREATE: 5000,

  /**
   * スナップショット復元の最大待機時間
   */
  RESTORE: 10000,

  /**
   * 自動スナップショット発火待機時間（テスト用に短縮）
   */
  AUTO_SNAPSHOT: 70000, // 約1分 + バッファ
};
