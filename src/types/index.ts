// Type definitions for Vivaldi-TT

export interface TabNode {
  id: string;
  tabId: number;
  parentId: string | null;
  children: TabNode[];
  isExpanded: boolean;
  depth: number;
  viewId: string;
  // グループ機能
  groupId?: string;
}

export interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl: string | undefined;
  status: 'loading' | 'complete';
}

// 拡張タブ情報（ピン状態を含む）
// windowIdを追加（複数ウィンドウ対応）
// discardedを追加（休止タブの視覚的区別）
// indexを追加（ピン留めタブの順序同期）
export interface ExtendedTabInfo extends TabInfo {
  isPinned: boolean;
  windowId: number;
  discarded: boolean; // 休止状態のタブ（まだ読み込まれていない）
  index: number; // タブのインデックス（ピン留めタブの順序同期に使用）
}

// タブ情報マップ
export interface TabInfoMap {
  [tabId: number]: ExtendedTabInfo;
}

export interface View {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface Group {
  id: string;
  name: string;
  color: string;
  isExpanded: boolean;
}

export interface UserSettings {
  fontSize: number;
  fontFamily: string;
  customCSS: string;
  newTabPosition: 'child' | 'sibling' | 'end';
  closeWarningThreshold: number;
  showUnreadIndicator: boolean;
  autoSnapshotInterval: number; // minutes, 0 = disabled
  childTabBehavior: 'promote' | 'close_all'; // 親タブ閉じ時の子タブ処理方法
  // タブ開き方別の位置ルール
  newTabPositionFromLink?: 'child' | 'sibling' | 'end'; // リンククリックから開かれたタブ
  newTabPositionManual?: 'child' | 'sibling' | 'end'; // 手動で開かれたタブ(アドレスバー、新規タブボタンなど)
  // スナップショット最大保持数
  maxSnapshots?: number; // デフォルト: 10
}

// Storage types
export type StorageChanges = {
  [key: string]: { oldValue: unknown; newValue: unknown };
};

export interface TreeState {
  views: View[];
  currentViewId: string;
  nodes: Record<string, TabNode>;
  tabToNode: Record<number, string>;
}

/** タブタイトルマップ (tabId -> title) */
export type TabTitlesMap = Record<number, string>;

/** ファビコンマップ (tabId -> favIconUrl) */
export type TabFaviconsMap = Record<number, string>;

export interface StorageSchema {
  tree_state: TreeState;
  user_settings: UserSettings;
  unread_tabs: number[];
  groups: Record<string, Group>;
  /** タブタイトル永続化 */
  tab_titles: TabTitlesMap;
  /** ファビコン永続化 */
  tab_favicons: TabFaviconsMap;
}

export type StorageKey = keyof StorageSchema;

export interface IStorageService {
  get<K extends StorageKey>(key: K): Promise<StorageSchema[K] | null>;
  set<K extends StorageKey>(key: K, value: StorageSchema[K]): Promise<void>;
  remove(key: StorageKey): Promise<void>;
  onChange(callback: (changes: StorageChanges) => void): () => void;
}

// Snapshot types
export interface TabSnapshot {
  url: string;
  title: string;
  parentId: string | null;
  viewId: string;
}

export interface SnapshotData {
  views: View[];
  tabs: TabSnapshot[];
  groups: Group[];
}

export interface Snapshot {
  id: string;
  createdAt: Date;
  name: string;
  isAutoSave: boolean;
  data: SnapshotData;
}

export interface IIndexedDBService {
  saveSnapshot(snapshot: Snapshot): Promise<void>;
  getSnapshot(id: string): Promise<Snapshot | null>;
  getAllSnapshots(): Promise<Snapshot[]>;
  deleteSnapshot(id: string): Promise<void>;
  deleteOldSnapshots(keepCount: number): Promise<void>;
}

// UnreadTracker Service Interface
export interface IUnreadTracker {
  markAsUnread(tabId: number): Promise<void>;
  markAsRead(tabId: number): Promise<void>;
  isUnread(tabId: number): boolean;
  getUnreadCount(): number;
  loadFromStorage(): Promise<void>;
  clear(): Promise<void>;
  /** 起動完了フラグを設定 */
  setInitialLoadComplete(): void;
  /** 起動完了かどうかを取得 */
  isInitialLoadComplete(): boolean;
}

// Service Worker Message Types
export interface TreeUpdatePayload {
  nodeId: string;
  newParentId: string | null;
  index: number;
}

export type MessageType =
  | { type: 'GET_STATE' }
  | { type: 'UPDATE_TREE'; payload: TreeUpdatePayload }
  | { type: 'MOVE_TAB_TO_WINDOW'; payload: { tabId: number; windowId: number } }
  | {
      type: 'CREATE_WINDOW_WITH_TAB';
      payload: { tabId: number };
    }
  | {
      type: 'CREATE_WINDOW_WITH_SUBTREE';
      // sourceWindowIdを追加（空ウィンドウ自動クローズ用）
      payload: { tabId: number; sourceWindowId?: number };
    }
  | {
      type: 'MOVE_SUBTREE_TO_WINDOW';
      payload: { tabId: number; windowId: number };
    }
  | { type: 'CLOSE_TAB'; payload: { tabId: number } }
  | { type: 'CLOSE_SUBTREE'; payload: { tabId: number } }
  | { type: 'ACTIVATE_TAB'; payload: { tabId: number } }
  | {
      type: 'SET_DRAG_STATE';
      payload: { tabId: number; treeData: TabNode[]; sourceWindowId: number };
    }
  | { type: 'GET_DRAG_STATE' }
  | { type: 'CLEAR_DRAG_STATE' }
  | { type: 'SYNC_TABS' }
  | { type: 'STATE_UPDATED' }
  // グループ化機能
  | { type: 'CREATE_GROUP'; payload: { tabIds: number[] } }
  | { type: 'DISSOLVE_GROUP'; payload: { tabIds: number[] } }
  // ポップアップからスナップショット取得
  | { type: 'CREATE_SNAPSHOT' }
  // タブ複製時の兄弟配置
  | { type: 'REGISTER_DUPLICATE_SOURCE'; payload: { sourceTabId: number } }
  // クロスウィンドウドラッグセッション管理
  | {
      type: 'START_DRAG_SESSION';
      payload: { tabId: number; windowId: number; treeData: TabNode[] };
    }
  | { type: 'GET_DRAG_SESSION' }
  | { type: 'END_DRAG_SESSION'; payload: { reason?: string } }
  | {
      type: 'BEGIN_CROSS_WINDOW_MOVE';
      payload: { targetWindowId: number };
    }
  // グループ情報取得
  | { type: 'GET_GROUP_INFO'; payload: { tabId: number } }
  // ツリービュー上のホバー検知
  | { type: 'NOTIFY_TREE_VIEW_HOVER'; payload: { windowId: number } }
  | { type: 'NOTIFY_DRAG_OUT' };

export type MessageResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Drag and Drop types - 自前D&D実装用の型定義
// dnd-kitを削除し自前の型を使用

/**
 * ドラッグ開始イベント
 */
export interface DragStartEvent {
  active: {
    id: string;
  };
}

/**
 * ドラッグ中のイベント（ホバー時）
 */
export interface DragOverEvent {
  active: {
    id: string;
  };
  over: {
    id: string;
  } | null;
}

/**
 * ドラッグ終了イベント
 */
export interface DragEndEvent {
  active: {
    id: string;
  };
  over: {
    id: string;
  } | null;
}

export interface DragEndResult {
  activeId: string;
  overId: string | null;
  newParentId: string | null;
  newIndex: number;
}

/**
 * 兄弟ドロップ情報（Gapドロップ専用）
 *
 * タブ間の隙間へのドロップ情報を表現。
 * タブ上へのドロップ（子として配置）はDropTargetType.Tab + onDragEndで別途処理。
 *
 * ドロップ位置の判定:
 * - aboveNodeId === undefined: リスト先頭（最初のタブの上）
 * - belowNodeId === undefined: リスト末尾（最後のタブの下）
 * - 両方存在: タブ間の隙間
 */
export interface SiblingDropInfo {
  /** ドラッグ中のノードID */
  activeNodeId: string;
  /** 挿入先のインデックス（gapIndex） */
  insertIndex: number;
  /** 上のノードのID（リスト先頭の場合はundefined） */
  aboveNodeId?: string;
  /** 下のノードのID（リスト末尾の場合はundefined） */
  belowNodeId?: string;
}

export interface TabTreeViewProps {
  nodes: TabNode[];
  currentViewId: string;
  onNodeClick: (tabId: number) => void;
  onToggleExpand: (nodeId: string) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  // ドラッグ開始/終了コールバック（外部ドロップ連携用）
  onDragStart?: (event: DragStartEvent) => void;
  onDragCancel?: () => void;
  // 兄弟としてドロップ（Gapドロップ）時のコールバック
  onSiblingDrop?: (info: SiblingDropInfo) => Promise<void>;
  // 未読状態管理
  isTabUnread?: (tabId: number) => boolean;
  getUnreadChildCount?: (nodeId: string) => number;
  // アクティブタブID
  activeTabId?: number;
  // タブ情報取得関数
  getTabInfo?: (tabId: number) => ExtendedTabInfo | undefined;
  // 選択状態管理（複数選択対応）
  isNodeSelected?: (nodeId: string) => boolean;
  onSelect?: (nodeId: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  // 選択されたすべてのタブIDを取得する関数
  getSelectedTabIds?: () => number[];
  // スナップショット取得コールバック
  onSnapshot?: () => Promise<void>;
  // グループ機能をツリー内に統合表示
  groups?: Record<string, Group>;
  onGroupToggle?: (groupId: string) => void;
  // タブをグループに追加するコールバック
  onAddToGroup?: (groupId: string, tabIds: number[]) => void;
  // ビュー移動サブメニュー用
  views?: View[];
  onMoveToView?: (viewId: string, tabIds: number[]) => void;
  // ツリー外ドロップで新規ウィンドウ作成
  onExternalDrop?: (tabId: number) => void;
  // ツリービュー外へのドロップ検知
  // ドラッグ中にマウスがツリービュー外に移動したかどうかを通知するコールバック
  onOutsideTreeChange?: (isOutside: boolean) => void;
  // サイドパネル境界参照
  // ドラッグアウト判定はサイドパネル全体の境界を基準にする
  sidePanelRef?: React.RefObject<HTMLElement | null>;
}

// Context Menu types
export type MenuAction =
  | 'close'
  | 'closeOthers'
  | 'closeSubtree'
  | 'duplicate'
  | 'pin'
  | 'unpin'
  | 'newWindow'
  | 'group'
  | 'ungroup'
  | 'reload'
  | 'copyUrl'
  | 'snapshot';

export interface ContextMenuProps {
  targetTabIds: number[];
  position: { x: number; y: number };
  onAction: (action: MenuAction) => void;
  onClose: () => void;
  isPinned?: boolean;
  isGrouped?: boolean;
  hasChildren?: boolean;
  tabUrl?: string;
  /** ビュー移動サブメニュー用 - 全ビューリスト */
  views?: View[];
  /** 現在のビューID（サブメニューで除外する） */
  currentViewId?: string;
  /** タブをビューに移動するコールバック */
  onMoveToView?: (viewId: string, tabIds: number[]) => void;
  /** グループ一覧（シングルタブのグループ追加用） */
  groups?: Record<string, Group>;
  /** タブをグループに追加するコールバック */
  onAddToGroup?: (groupId: string, tabIds: number[]) => void;
}

// SubMenu types

/**
 * サブメニュー項目
 */
export interface SubMenuItem {
  /** 項目のID */
  id: string;
  /** 表示ラベル */
  label: string;
  /** 無効化フラグ */
  disabled?: boolean;
}

/**
 * SubMenuコンポーネントのProps
 */
export interface SubMenuProps {
  /** サブメニューのラベル */
  label: string;
  /** サブメニュー項目 */
  items: SubMenuItem[];
  /** 項目選択時のコールバック */
  onSelect: (itemId: string) => void;
  /** メニューを閉じるコールバック */
  onClose: () => void;
  /** 親メニューからの相対位置 */
  parentRect: DOMRect;
}
