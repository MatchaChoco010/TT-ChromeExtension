/**
 * Common Constants for E2E Tests
 *
 * E2Eテスト全体で共通使用されるセレクタ、タイムアウト値、ヘルパー関数
 * 保守性向上のため、ハードコードされた値を一元管理
 */

/**
 * 共通セレクタ定義
 *
 * テスト全体で使用されるDOM要素のセレクタを定義
 */
export const COMMON_SELECTORS = {
  // Side Panel関連
  /** Side Panelのルート要素 */
  sidePanelRoot: '[data-testid="side-panel-root"]',
  /** タブツリービュー */
  tabTreeView: '[data-testid="tab-tree-view"]',

  // 設定関連
  /** 設定ボタン */
  settingsButton: '[data-testid="open-settings-button"]',
  /** 設定パネル */
  settingsPanel: '[data-testid="settings-panel"]',
  /** 設定閉じるボタン */
  settingsCloseButton: '[data-testid="settings-close-button"]',
  /** テーマ切り替えトグル */
  themeToggle: '[data-testid="theme-toggle"]',
  /** 新規タブで設定を開くボタン */
  openSettingsButton: '[data-testid="open-settings-button"]',

  // グループ関連
  /** グループカラーインジケータ */
  groupColorIndicator: '[data-testid="group-color-indicator"]',
  /** グループアイコン */
  groupIcon: '[data-testid="group-icon"]',

  // ツリーノード関連（プレフィックス）
  /** ツリーノードのプレフィックス（tabIdが続く） */
  treeNodePrefix: '[data-testid^="tree-node-"]',
  /** グループノードのプレフィックス（groupIdが続く） */
  groupNodePrefix: '[data-testid^="group-node-"]',
  /** 展開ボタン */
  expandButton: '[data-testid="expand-button"]',
  /** 閉じるボタンのプレフィックス（idが続く） */
  closeButtonPrefix: '[data-testid^="close-button-"]',

  // 未読関連
  /** 未読バッジ */
  unreadBadge: '[data-testid="unread-badge"]',
  /** 未読カウント表示 */
  unreadCount: '[data-testid="unread-count"]',
  /** 未読子タブインジケータ */
  unreadChildIndicator: '[data-testid="unread-child-indicator"]',

  // ビュースイッチャー関連
  /** ビュースイッチャーコンテナ */
  viewSwitcherContainer: '[data-testid="view-switcher-container"]',
  /** ビュー編集フォーム */
  viewEditForm: '[data-testid="view-edit-form"]',

  // スナップショット関連
  /** スナップショットセクション */
  snapshotSection: '[data-testid="snapshot-section"]',
  /** スナップショット作成ボタン */
  snapshotCreateButton: '[data-testid="create-snapshot-button"]',
  /** スナップショットリスト */
  snapshotList: '[data-testid="snapshot-list"]',

  // コンテキストメニュー関連
  /** コンテキストメニュー（roleベース） */
  contextMenu: '[role="menu"]',

  // ローディング関連
  /** ローディングテキスト */
  loadingText: 'text=Loading',
  /** Reactルート要素 */
  reactRoot: '#root',
} as const;

/**
 * 共通タイムアウト値定義（ミリ秒）
 *
 * テスト全体で使用される待機時間を定義
 */
export const COMMON_TIMEOUTS = {
  /** 短い待機時間（クイック操作用）: 3000ms */
  short: 3000,
  /** 標準待機時間（一般的な操作用）: 5000ms */
  medium: 5000,
  /** 長い待機時間（遅い操作用）: 10000ms */
  long: 10000,
  /** 非常に長い待機時間（ナビゲーション等）: 30000ms */
  veryLong: 30000,
} as const;

/**
 * aria-label属性を使用するセレクタ
 *
 * ボタンやインタラクティブ要素のアクセシビリティラベル
 */
export const ARIA_LABELS = {
  // ビュー関連
  /** 新しいビュー追加ボタン */
  addNewView: '[aria-label="Add new view"]',
  /** ビュー名入力 */
  viewName: '[aria-label="View Name"]',
  /** ビューカラー入力 */
  viewColor: '[aria-label="View Color"]',
  /** 保存ボタン */
  save: '[aria-label="Save"]',
  /** キャンセルボタン */
  cancel: '[aria-label="Cancel"]',
  /** ビュー削除ボタン */
  deleteView: '[aria-label="Delete view"]',
} as const;

/**
 * 動的セレクタ生成関数
 */

/**
 * 特定のタブIDに対応するツリーノードセレクタを生成
 *
 * @param tabId - タブのID
 * @returns ツリーノードのセレクタ文字列
 *
 * @example
 * ```ts
 * const selector = getTreeNodeSelector(123);
 * // Returns: '[data-testid="tree-node-123"]'
 * ```
 */
export function getTreeNodeSelector(tabId: number): string {
  return `[data-testid="tree-node-${tabId}"]`;
}

/**
 * 特定のグループIDに対応するグループノードセレクタを生成
 *
 * @param groupId - グループのID
 * @returns グループノードのセレクタ文字列
 *
 * @example
 * ```ts
 * const selector = getGroupNodeSelector('group-abc123');
 * // Returns: '[data-testid="group-node-group-abc123"]'
 * ```
 */
export function getGroupNodeSelector(groupId: string): string {
  return `[data-testid="group-node-${groupId}"]`;
}

/**
 * 特定のIDに対応する閉じるボタンセレクタを生成
 *
 * @param id - タブIDまたはグループID
 * @returns 閉じるボタンのセレクタ文字列
 *
 * @example
 * ```ts
 * const selector = getCloseButtonSelector(123);
 * // Returns: '[data-testid="close-button-123"]'
 *
 * const selectorStr = getCloseButtonSelector('group-abc');
 * // Returns: '[data-testid="close-button-group-abc"]'
 * ```
 */
export function getCloseButtonSelector(id: string | number): string {
  return `[data-testid="close-button-${id}"]`;
}

/**
 * 特定のグループIDに対応する展開トグルセレクタを生成
 *
 * @param groupId - グループのID
 * @returns 展開トグルボタンのセレクタ文字列
 *
 * @example
 * ```ts
 * const selector = getToggleExpandSelector('group-abc123');
 * // Returns: '[data-testid="toggle-expand-group-abc123"]'
 * ```
 */
export function getToggleExpandSelector(groupId: string): string {
  return `[data-testid="toggle-expand-${groupId}"]`;
}

/**
 * 特定のビュー名に対応するビュー切り替えボタンセレクタを生成
 *
 * @param viewName - ビューの名前
 * @returns ビュー切り替えボタンのセレクタ文字列（aria-labelベース）
 *
 * @example
 * ```ts
 * const selector = getViewSwitchButtonSelector('Default');
 * // Returns: '[aria-label="Switch to Default view"]'
 * ```
 */
export function getViewSwitchButtonSelector(viewName: string): string {
  return `[aria-label="Switch to ${viewName} view"]`;
}

/**
 * 特定のビュー名に対応するビュー編集ボタンセレクタを生成
 *
 * @param viewName - ビューの名前
 * @returns ビュー編集ボタンのセレクタ文字列（aria-labelベース）
 *
 * @example
 * ```ts
 * const selector = getViewEditButtonSelector('Default');
 * // Returns: '[aria-label="Edit view Default"]'
 * ```
 */
export function getViewEditButtonSelector(viewName: string): string {
  return `[aria-label="Edit view ${viewName}"]`;
}

/**
 * テスト用URL定義
 *
 * テストで頻繁に使用されるURL
 */
export const TEST_URLS = {
  /** 空白ページ */
  blank: 'about:blank',
  /** Example.comのベースURL */
  example: 'https://example.com',
  /** Example.orgのベースURL */
  exampleOrg: 'https://example.org',
} as const;

/**
 * フォーム入力要素のセレクタ
 *
 * 設定パネル等で使用されるフォーム入力要素
 */
export const FORM_INPUTS = {
  /** フォントサイズ入力 */
  fontSize: 'input#fontSize',
  /** フォントファミリー入力 */
  fontFamily: 'input#fontFamily',
  /** インデント幅入力 */
  indentWidth: 'input#indentWidth',
  /** カスタムCSSテキストエリア */
  customCSS: 'textarea#customCSS',
} as const;
