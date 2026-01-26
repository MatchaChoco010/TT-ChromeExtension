export interface GroupInfo {
  name: string;
  color: string;
}

/**
 * タブノード（ツリー構造）
 * 階層構造は children 配列で直接表現
 */
export interface TabNode {
  tabId: number;
  isExpanded: boolean;
  groupInfo?: GroupInfo;
  children: TabNode[];
}

/**
 * UI表示用のタブノード
 * TabNodeにdepth（UI表示用のインデント深さ）を追加
 */
export interface UITabNode {
  tabId: number;
  isExpanded: boolean;
  groupInfo?: GroupInfo;
  children: UITabNode[];
  depth: number;
}

/**
 * ビュー（タブツリーのコンテナ）
 */
export interface ViewState {
  name: string;
  color: string;
  icon?: string;
  rootNodes: TabNode[];
  pinnedTabIds: number[];
}

/**
 * ウィンドウ（ビューのコンテナ）
 */
export interface WindowState {
  windowId: number;
  views: ViewState[];
  activeViewIndex: number;
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
  windowId?: number;
}

/**
 * ツリー状態（新アーキテクチャ）
 * Window → View → Tab の階層構造を直接反映
 */
export interface TreeState {
  /** ウィンドウの配列（順序を持つ） */
  windows: WindowState[];
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
  | { type: 'CREATE_GROUP'; payload: { tabIds: number[]; groupName?: string; contextMenuTabId?: number } }
  | { type: 'DISSOLVE_GROUP'; payload: { tabIds: number[] } }
  | { type: 'UPDATE_GROUP_NAME'; payload: { tabId: number; name: string } }
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
        tabId: number;
        targetParentTabId: number | null;
        windowId: number;
        selectedTabIds: number[];
      };
    }
  | {
      type: 'MOVE_NODE_AS_SIBLING';
      payload: {
        tabId: number;
        aboveTabId?: number;
        belowTabId?: number;
        windowId: number;
        selectedTabIds: number[];
      };
    }
  | {
      type: 'SWITCH_VIEW';
      payload: {
        viewIndex: number;
        windowId: number;
        previousViewIndex: number;
        activeTabId: number | null;
      };
    }
  | { type: 'CREATE_VIEW'; payload: { windowId: number } }
  | { type: 'DELETE_VIEW'; payload: { windowId: number; viewIndex: number } }
  | {
      type: 'UPDATE_VIEW';
      payload: { windowId: number; viewIndex: number; updates: Partial<View> };
    }
  | {
      type: 'TOGGLE_NODE_EXPAND';
      payload: { tabId: number; windowId: number };
    }
  | {
      type: 'MOVE_TABS_TO_VIEW';
      payload: { targetViewIndex: number; tabIds: number[]; windowId: number };
    }
  | {
      type: 'DELETE_TREE_GROUP';
      payload: { tabId: number; windowId: number };
    }
  | {
      type: 'ADD_TAB_TO_TREE_GROUP';
      payload: { tabId: number; targetGroupTabId: number; windowId: number };
    }
  | {
      type: 'REMOVE_TAB_FROM_TREE_GROUP';
      payload: { tabId: number; windowId: number };
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
 * - aboveTabId === undefined: リスト先頭（最初のタブの上）
 * - belowTabId === undefined: リスト末尾（最後のタブの下）
 * - 両方存在: タブ間の隙間
 */
export interface SiblingDropInfo {
  /** ドラッグ中のタブID */
  activeTabId: number;
  insertIndex: number;
  /** 上のタブID（リスト先頭の場合はundefined） */
  aboveTabId?: number;
  /** 下のタブID（リスト末尾の場合はundefined） */
  belowTabId?: number;
}

export interface TabTreeViewProps {
  nodes: UITabNode[];
  currentViewIndex: number;
  onNodeClick: (tabId: number) => void;
  onToggleExpand: (tabId: number) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
  onDragCancel?: () => void;
  onSiblingDrop?: (info: SiblingDropInfo) => Promise<void>;
  isTabUnread?: (tabId: number) => boolean;
  getUnreadChildCount?: (tabId: number) => number;
  activeTabId?: number;
  getTabInfo?: (tabId: number) => ExtendedTabInfo | undefined;
  isNodeSelected?: (tabId: number) => boolean;
  onSelect?: (tabId: number, modifiers: { shift: boolean; ctrl: boolean }) => void;
  getSelectedTabIds?: () => number[];
  clearSelection?: () => void;
  onSnapshot?: () => Promise<void>;
  views?: View[];
  onMoveToView?: (viewIndex: number, tabIds: number[]) => void;
  currentWindowId?: number;
  otherWindows?: WindowInfo[];
  onMoveToWindow?: (windowId: number, tabIds: number[]) => void;
  onExternalDrop?: (tabId: number) => void;
  onOutsideTreeChange?: (isOutside: boolean) => void;
  sidePanelRef?: React.RefObject<HTMLElement | null>;
  onGroupRequest?: (tabIds: number[], contextMenuTabId: number) => void;
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
  currentViewIndex?: number;
  onMoveToView?: (viewIndex: number, tabIds: number[]) => void;
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
