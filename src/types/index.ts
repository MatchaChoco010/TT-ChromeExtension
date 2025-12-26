// Type definitions for Vivaldi-TT

export interface TabNode {
  id: string;
  tabId: number;
  parentId: string | null;
  children: TabNode[];
  isExpanded: boolean;
  depth: number;
  viewId: string;
}

export interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl: string | undefined;
  status: 'loading' | 'complete';
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
  childTabBehavior: 'promote' | 'close_all'; // Requirement 2.3: 親タブ閉じ時の子タブ処理方法
  // Task 12.2 (Requirements 9.2, 9.3, 9.4): タブ開き方別の位置ルール
  newTabPositionFromLink?: 'child' | 'sibling' | 'end'; // リンククリックから開かれたタブ
  newTabPositionManual?: 'child' | 'sibling' | 'end'; // 手動で開かれたタブ(アドレスバー、新規タブボタンなど)
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

export interface StorageSchema {
  tree_state: TreeState;
  user_settings: UserSettings;
  unread_tabs: number[];
  groups: Record<string, Group>;
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
      payload: { tabId: number };
    }
  | {
      type: 'MOVE_SUBTREE_TO_WINDOW';
      payload: { tabId: number; windowId: number };
    }
  | { type: 'CLOSE_TAB'; payload: { tabId: number } }
  | { type: 'ACTIVATE_TAB'; payload: { tabId: number } }
  | {
      type: 'SET_DRAG_STATE';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: { tabId: number; treeData: any; sourceWindowId: number };
    }
  | { type: 'GET_DRAG_STATE' }
  | { type: 'CLEAR_DRAG_STATE' }
  | { type: 'STATE_UPDATED' };

export type MessageResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Drag and Drop types
import type {
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';

export interface DragDropCallbacks {
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
}

export interface DragEndResult {
  activeId: string;
  overId: string | null;
  newParentId: string | null;
  newIndex: number;
}

export interface TabTreeViewProps {
  nodes: TabNode[];
  currentViewId: string;
  onNodeClick: (tabId: number) => void;
  onToggleExpand: (nodeId: string) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
}

// Context Menu types
export type MenuAction =
  | 'close'
  | 'closeOthers'
  | 'duplicate'
  | 'pin'
  | 'unpin'
  | 'newWindow'
  | 'group'
  | 'ungroup'
  | 'reload';

export interface ContextMenuProps {
  targetTabIds: number[];
  position: { x: number; y: number };
  onAction: (action: MenuAction) => void;
  onClose: () => void;
  isPinned?: boolean;
  isGrouped?: boolean;
}
