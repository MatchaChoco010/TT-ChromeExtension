export interface GroupInfo {
  name: string;
  color: string;
}

export interface TabNode {
  id: string;
  tabId: number;
  parentId: string | null;
  children: TabNode[];
  isExpanded: boolean;
  depth: number;
  groupInfo?: GroupInfo;
}

export interface ViewState {
  info: View;
  rootNodeIds: string[];
  nodes: Record<string, TabNode>;
}

export interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl: string | undefined;
  status: 'loading' | 'complete';
}

export interface ExtendedTabInfo extends TabInfo {
  isPinned: boolean;
  windowId: number;
  discarded: boolean; // 休止状態のタブ（まだ読み込まれていない）
  index: number;
}

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
  newTabPosition: 'child' | 'nextSibling' | 'lastSibling' | 'end';
  closeWarningThreshold: number;
  showUnreadIndicator: boolean;
  autoSnapshotInterval: number;
  childTabBehavior: 'promote' | 'close_all';
  newTabPositionFromLink?: 'child' | 'nextSibling' | 'lastSibling' | 'end';
  newTabPositionManual?: 'child' | 'nextSibling' | 'lastSibling' | 'end';
  maxSnapshots?: number;
  duplicateTabPosition?: 'nextSibling' | 'end';
  snapshotSubfolder: string;
}

export type StorageChanges = {
  [key: string]: { oldValue: unknown; newValue: unknown };
};

/**
 * ツリー構造エントリ
 * タブの順序とURLを使って、ブラウザ再起動後の親子関係復元に使用
 */
export interface TreeStructureEntry {
  url: string;
  parentIndex: number | null;
  index: number;
  viewId: string;
  isExpanded: boolean;
  groupInfo?: GroupInfo;
}

export interface TreeState {
  /** ビューID -> ViewState のマップ。ビュー毎にタブツリーを管理 */
  views: Record<string, ViewState>;
  /** ビューの表示順序（ビューIDの配列） */
  viewOrder: string[];
  currentViewId: string;
  /**
   * ウィンドウごとの現在のビューID
   * 各ウィンドウが独立したビューを表示できるようにする
   */
  currentViewByWindowId?: Record<number, string>;
  /** タブID -> { viewId, nodeId } のマップ */
  tabToNode: Record<number, { viewId: string; nodeId: string }>;
  /**
   * ツリー構造（順序付き）
   * ブラウザ再起動時にタブIDが変わっても親子関係を復元するために使用
   */
  treeStructure: TreeStructureEntry[];
  /**
   * ウィンドウ毎のピン留めタブIDリスト（順序付き）
   * TreeStateManagerがピン留め状態のSingle Source of Truth
   */
  pinnedTabIdsByWindow?: Record<number, number[]>;
}

/** タブタイトルマップ (tabId -> title) */
export type TabTitlesMap = Record<number, string>;

/** ファビコンマップ (url -> favIconUrl) URLベースで保存しブラウザ再起動後も復元可能 */
export type TabFaviconsMap = Record<string, string>;

export interface StorageSchema {
  tree_state: TreeState;
  user_settings: UserSettings;
  unread_tabs: number[];
  groups: Record<string, Group>;
  tab_titles: TabTitlesMap;
  tab_favicons: TabFaviconsMap;
}

export type StorageKey = keyof StorageSchema;

export interface IStorageService {
  get<K extends StorageKey>(key: K): Promise<StorageSchema[K] | null>;
  set<K extends StorageKey>(key: K, value: StorageSchema[K]): Promise<void>;
  remove(key: StorageKey): Promise<void>;
  onChange(callback: (changes: StorageChanges) => void): () => void;
}

export interface TabSnapshot {
  index: number;
  url: string;
  title: string;
  parentIndex: number | null;
  viewId: string;
  isExpanded: boolean;
  pinned: boolean;
  windowIndex: number;
  groupInfo?: GroupInfo;
}

export interface SnapshotData {
  views: View[];
  tabs: TabSnapshot[];
}

export interface Snapshot {
  id: string;
  createdAt: Date;
  name: string;
  isAutoSave: boolean;
  data: SnapshotData;
}

export interface IDownloadService {
  downloadSnapshot(
    jsonContent: string,
    filename: string,
    subfolder?: string,
  ): Promise<number>;
}

export interface IUnreadTracker {
  markAsUnread(tabId: number): Promise<void>;
  markAsRead(tabId: number): Promise<void>;
  isUnread(tabId: number): boolean;
  getUnreadCount(): number;
  loadFromStorage(): Promise<void>;
  clear(): Promise<void>;
  setInitialLoadComplete(): void;
  isInitialLoadComplete(): boolean;
}

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
      payload: { tabId: number; sourceWindowId?: number };
    }
  | {
      type: 'MOVE_SUBTREE_TO_WINDOW';
      payload: { tabId: number; windowId: number };
    }
  | { type: 'CLOSE_TAB'; payload: { tabId: number } }
  | { type: 'CLOSE_SUBTREE'; payload: { tabId: number } }
  | { type: 'CLOSE_TABS_WITH_COLLAPSED_SUBTREES'; payload: { tabIds: number[] } }
  | { type: 'ACTIVATE_TAB'; payload: { tabId: number } }
  | {
      type: 'SET_DRAG_STATE';
      payload: { tabId: number; treeData: TabNode[]; sourceWindowId: number };
    }
  | { type: 'GET_DRAG_STATE' }
  | { type: 'CLEAR_DRAG_STATE' }
  | { type: 'SYNC_TABS' }
  | { type: 'REFRESH_TREE_STRUCTURE' }
  | { type: 'STATE_UPDATED' }
  | { type: 'CREATE_GROUP'; payload: { tabIds: number[]; groupName?: string } }
  | { type: 'DISSOLVE_GROUP'; payload: { tabIds: number[] } }
  | { type: 'UPDATE_GROUP_NAME'; payload: { nodeId: string; name: string } }
  | { type: 'CREATE_SNAPSHOT' }
  | {
      type: 'RESTORE_SNAPSHOT';
      payload: { jsonData: string; closeCurrentTabs: boolean };
    }
  | { type: 'REGISTER_DUPLICATE_SOURCE'; payload: { sourceTabId: number } }
  | { type: 'DUPLICATE_SUBTREE'; payload: { tabId: number } }
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
  | { type: 'GET_GROUP_INFO'; payload: { tabId: number } }
  | { type: 'NOTIFY_TREE_VIEW_HOVER'; payload: { windowId: number } }
  | { type: 'NOTIFY_DRAG_OUT' }
  | { type: 'DRAG_SESSION_ENDED' }
  | { type: 'CLOSE_OTHER_TABS'; payload: { excludeTabIds: number[] } }
  | { type: 'DUPLICATE_TABS'; payload: { tabIds: number[] } }
  | { type: 'PIN_TABS'; payload: { tabIds: number[] } }
  | { type: 'UNPIN_TABS'; payload: { tabIds: number[] } }
  | { type: 'MOVE_TABS_TO_NEW_WINDOW'; payload: { tabIds: number[] } }
  | { type: 'RELOAD_TABS'; payload: { tabIds: number[] } }
  | { type: 'DISCARD_TABS'; payload: { tabIds: number[] } }
  | { type: 'REORDER_PINNED_TAB'; payload: { tabId: number; newIndex: number } }
  | {
      type: 'MOVE_NODE';
      payload: {
        nodeId: string;
        targetParentId: string;
        viewId: string;
        selectedNodeIds: string[];
      };
    }
  | {
      type: 'MOVE_NODE_AS_SIBLING';
      payload: {
        nodeId: string;
        aboveNodeId?: string;
        belowNodeId?: string;
        viewId: string;
        selectedNodeIds: string[];
      };
    }
  | {
      type: 'SWITCH_VIEW';
      payload: {
        viewId: string;
        windowId: number;
        previousViewId: string;
        activeTabId: number | null;
      };
    }
  | { type: 'CREATE_VIEW' }
  | { type: 'DELETE_VIEW'; payload: { viewId: string } }
  | {
      type: 'UPDATE_VIEW';
      payload: { viewId: string; updates: Partial<View> };
    }
  | {
      type: 'TOGGLE_NODE_EXPAND';
      payload: { nodeId: string; viewId: string };
    }
  | {
      type: 'MOVE_TABS_TO_VIEW';
      payload: { targetViewId: string; tabIds: number[] };
    }
  | {
      type: 'DELETE_TREE_GROUP';
      payload: { nodeId: string; viewId: string };
    }
  | {
      type: 'ADD_TAB_TO_TREE_GROUP';
      payload: { nodeId: string; targetGroupNodeId: string; viewId: string };
    }
  | {
      type: 'REMOVE_TAB_FROM_TREE_GROUP';
      payload: { nodeId: string; viewId: string };
    }
  | {
      type: 'SAVE_GROUPS';
      payload: { groups: Record<string, Group> };
    }
  | {
      type: 'SAVE_USER_SETTINGS';
      payload: { settings: UserSettings };
    }
  | { type: 'CREATE_NEW_TAB' }
  | { type: 'OPEN_SETTINGS_TAB' };

export type MessageResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface DragStartEvent {
  active: {
    id: string;
  };
}

export interface DragOverEvent {
  active: {
    id: string;
  };
  over: {
    id: string;
  } | null;
}

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
  onDragStart?: (event: DragStartEvent) => void;
  onDragCancel?: () => void;
  onSiblingDrop?: (info: SiblingDropInfo) => Promise<void>;
  isTabUnread?: (tabId: number) => boolean;
  getUnreadChildCount?: (nodeId: string) => number;
  activeTabId?: number;
  getTabInfo?: (tabId: number) => ExtendedTabInfo | undefined;
  isNodeSelected?: (nodeId: string) => boolean;
  onSelect?: (nodeId: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  getSelectedTabIds?: () => number[];
  clearSelection?: () => void;
  onSnapshot?: () => Promise<void>;
  views?: View[];
  onMoveToView?: (viewId: string, tabIds: number[]) => void;
  currentWindowId?: number;
  otherWindows?: WindowInfo[];
  onMoveToWindow?: (windowId: number, tabIds: number[]) => void;
  onExternalDrop?: (tabId: number) => void;
  onOutsideTreeChange?: (isOutside: boolean) => void;
  sidePanelRef?: React.RefObject<HTMLElement | null>;
  onGroupRequest?: (tabIds: number[]) => void;
}

export type MenuAction =
  | 'close'
  | 'closeOthers'
  | 'closeSubtree'
  | 'duplicate'
  | 'pin'
  | 'unpin'
  | 'newWindow'
  | 'moveToWindow'
  | 'group'
  | 'ungroup'
  | 'editGroupTitle'
  | 'reload'
  | 'discard'
  | 'copyUrl'
  | 'snapshot';

export interface WindowInfo {
  id: number;
  tabCount: number;
  focused: boolean;
}

export interface ContextMenuProps {
  targetTabIds: number[];
  position: { x: number; y: number };
  onAction: (action: MenuAction) => void;
  onClose: () => void;
  isPinned?: boolean;
  isGrouped?: boolean;
  isGroupTab?: boolean;
  hasChildren?: boolean;
  tabUrl?: string;
  views?: View[];
  currentViewId?: string;
  onMoveToView?: (viewId: string, tabIds: number[]) => void;
  currentWindowId?: number;
  otherWindows?: WindowInfo[];
  onMoveToWindow?: (windowId: number, tabIds: number[]) => void;
}

export interface SubMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface SubMenuProps {
  label: string;
  items: SubMenuItem[];
  onSelect: (itemId: string) => void;
  onClose: () => void;
  parentRect: DOMRect;
}
