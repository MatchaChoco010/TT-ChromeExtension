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
  sidePanelRoot: '[data-testid="side-panel-root"]',
  tabTreeView: '[data-testid="tab-tree-view"]',

  settingsButton: '[data-testid="open-settings-button"]',
  settingsPanel: '[data-testid="settings-panel"]',
  settingsCloseButton: '[data-testid="settings-close-button"]',
  themeToggle: '[data-testid="theme-toggle"]',
  openSettingsButton: '[data-testid="open-settings-button"]',

  groupColorIndicator: '[data-testid="group-color-indicator"]',
  groupIcon: '[data-testid="group-icon"]',

  /** ツリーノードのプレフィックス（tabIdが続く） */
  treeNodePrefix: '[data-testid^="tree-node-"]',
  /** グループノードのプレフィックス（groupIdが続く） */
  groupNodePrefix: '[data-testid^="group-node-"]',
  expandButton: '[data-testid="expand-button"]',
  /** 閉じるボタンのプレフィックス（idが続く） */
  closeButtonPrefix: '[data-testid^="close-button-"]',

  unreadBadge: '[data-testid="unread-badge"]',
  unreadCount: '[data-testid="unread-count"]',
  unreadChildIndicator: '[data-testid="unread-child-indicator"]',

  viewSwitcherContainer: '[data-testid="view-switcher-container"]',
  viewEditForm: '[data-testid="view-edit-form"]',

  snapshotSection: '[data-testid="snapshot-section"]',
  snapshotCreateButton: '[data-testid="create-snapshot-button"]',
  snapshotList: '[data-testid="snapshot-list"]',

  /** コンテキストメニュー（roleベース） */
  contextMenu: '[role="menu"]',

  loadingText: 'text=Loading',
  reactRoot: '#root',
} as const;

/**
 * 共通タイムアウト値定義（ミリ秒）
 *
 * テスト全体で使用される待機時間を定義
 */
export const COMMON_TIMEOUTS = {
  short: 3000,
  medium: 5000,
  long: 10000,
  veryLong: 30000,
} as const;

/**
 * aria-label属性を使用するセレクタ
 *
 * ボタンやインタラクティブ要素のアクセシビリティラベル
 */
export const ARIA_LABELS = {
  addNewView: '[aria-label="Add new view"]',
  viewName: '[aria-label="View Name"]',
  viewColor: '[aria-label="View Color"]',
  save: '[aria-label="Save"]',
  cancel: '[aria-label="Cancel"]',
  deleteView: '[aria-label="Delete view"]',
} as const;

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
  blank: 'about:blank',
  example: 'https://example.com',
  exampleOrg: 'https://example.org',
} as const;

/**
 * フォーム入力要素のセレクタ
 *
 * 設定パネル等で使用されるフォーム入力要素
 */
export const FORM_INPUTS = {
  fontSize: 'input#fontSize',
  fontFamily: 'input#fontFamily',
  indentWidth: 'input#indentWidth',
  customCSS: 'textarea#customCSS',
} as const;
