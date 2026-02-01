export type {
  TabNode,
  TreeState,
  View,
  Group,
  MessageType,
  MessageResponse,
  StorageSchema,
} from '../../src/types';

export interface E2ETabNode {
  id: string;
  tabId: number;
  parentId: string | null;
  children: E2ETabNode[];
  isExpanded: boolean;
  depth: number;
  groupInfo?: {
    name: string;
    color: string;
  };
}

export interface E2EGroup {
  id: string;
  name: string;
  color: string;
  isExpanded: boolean;
}

export interface E2EViewInfo {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface E2EViewState {
  info: E2EViewInfo;
  rootNodeIds: string[];
  nodes: Record<string, E2ETabNode>;
}

export interface E2ENewTabNode {
  tabId: number;
  isExpanded: boolean;
  groupInfo?: { name: string; color: string };
  children: E2ENewTabNode[];
}

export interface E2ENewViewState {
  name: string;
  color: string;
  icon?: string;
  rootNodes: E2ENewTabNode[];
}

export interface E2ENewWindowState {
  windowId: number;
  views: E2ENewViewState[];
  activeViewIndex: number;
  pinnedTabIds: number[];
}

export interface E2ETreeState {
  windows: E2ENewWindowState[];
}

/**
 * @deprecated 旧構造用のインターフェース。互換性のため残存
 */
export interface E2ELegacyTreeState {
  views: Record<string, E2EViewState>;
  viewOrder: string[];
  currentViewId: string;
  currentViewByWindowId?: Record<number, string>;
  tabToNode: Record<number, { viewId: string; nodeId: string }>;
  treeStructure?: Array<{ tabId: number; depth: number }>;
}

/**
 * chrome.storage.local.get('tree_state') の戻り値の型
 */
export interface TreeStateResult {
  tree_state?: TreeState;
}

/**
 * chrome.storage.local.get('groups') の戻り値の型
 */
export interface GroupsResult {
  groups?: Record<string, E2EGroup>;
}

/**
 * テスト用のグローバル拡張
 * window や globalThis に追加されるテスト用プロパティの型定義
 */
export interface TestGlobals {
  receivedMessages?: Array<{ type: string; [key: string]: unknown }>;
  listenerReady?: boolean;
  stateUpdatedReceived?: boolean;
  stateUpdateCount?: number;
  testState?: { initialized: boolean; timestamp: number };
  messageLog?: Array<{ type: string; timestamp: number }>;
  receivedCount?: number;
  pendingTabParents?: Map<number, number>;
  pendingDuplicateSources?: Set<number>;
}

import type { TreeState } from '../../src/types';

export function isTreeState(value: unknown): value is TreeState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return 'windows' in obj && Array.isArray(obj.windows);
}

/**
 * Window型の拡張
 * E2Eテストでwindowにプロパティを追加する際に型安全を保つ
 */
declare global {
  interface Window extends TestGlobals {}


  var receivedMessages: TestGlobals['receivedMessages'];

  var listenerReady: TestGlobals['listenerReady'];

  var stateUpdatedReceived: TestGlobals['stateUpdatedReceived'];

  var stateUpdateCount: TestGlobals['stateUpdateCount'];

  var testState: TestGlobals['testState'];

  var messageLog: TestGlobals['messageLog'];

  var receivedCount: TestGlobals['receivedCount'];

  var pendingTabParents: TestGlobals['pendingTabParents'];

  var pendingDuplicateSources: TestGlobals['pendingDuplicateSources'];
}
