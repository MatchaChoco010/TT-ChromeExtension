export interface TabNode {
  id: string;
  tabId: number;
  parentId: string | null;
  children: TabNode[];
  isExpanded: boolean;
  depth: number;
  viewId: string;
  groupId?: string;
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
  newTabPosition: 'child' | 'sibling' | 'end';
  closeWarningThreshold: number;
  showUnreadIndicator: boolean;
  autoSnapshotInterval: number; // minutes, 0 = disabled
  childTabBehavior: 'promote' | 'close_all';
  newTabPositionFromLink?: 'child' | 'sibling' | 'end';
  newTabPositionManual?: 'child' | 'sibling' | 'end';
  maxSnapshots?: number; // デフォルト: 10
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
}

export interface TreeState {
  views: View[];
  currentViewId: string;
  nodes: Record<string, TabNode>;
  tabToNode: Record<number, string>;
  /**
   * ツリー構造（順序付き）
   * ブラウザ再起動時にタブIDが変わっても親子関係を復元するために使用
   */
  treeStructure?: TreeStructureEntry[];
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
  | { type: 'CREATE_GROUP'; payload: { tabIds: number[] } }
  | { type: 'DISSOLVE_GROUP'; payload: { tabIds: number[] } }
  | { type: 'CREATE_SNAPSHOT' }
  | { type: 'REGISTER_DUPLICATE_SOURCE'; payload: { sourceTabId: number } }
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
  | { type: 'DRAG_SESSION_ENDED' };

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
  onSnapshot?: () => Promise<void>;
  groups?: Record<string, Group>;
  onGroupToggle?: (groupId: string) => void;
  onAddToGroup?: (groupId: string, tabIds: number[]) => void;
  views?: View[];
  onMoveToView?: (viewId: string, tabIds: number[]) => void;
  currentWindowId?: number;
  otherWindows?: WindowInfo[];
  onMoveToWindow?: (windowId: number, tabIds: number[]) => void;
  onExternalDrop?: (tabId: number) => void;
  onOutsideTreeChange?: (isOutside: boolean) => void;
  sidePanelRef?: React.RefObject<HTMLElement | null>;
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
  | 'reload'
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
  hasChildren?: boolean;
  tabUrl?: string;
  views?: View[];
  currentViewId?: string;
  onMoveToView?: (viewId: string, tabIds: number[]) => void;
  groups?: Record<string, Group>;
  onAddToGroup?: (groupId: string, tabIds: number[]) => void;
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
