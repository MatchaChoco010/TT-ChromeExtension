/**
 * E2E テスト用型定義
 *
 * src/types/index.ts の型定義を E2E テストで利用するためのエクスポート
 * evaluate() 内では使用できないが、戻り値のキャストに使用する
 */

// メインの型定義を再エクスポート
export type {
  TabNode,
  TreeState,
  View,
  Group,
  MessageType,
  MessageResponse,
  StorageSchema,
} from '../../src/types';

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
  groups?: Record<string, Group>;
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
}

/**
 * TreeState 型を再定義（evaluate 内で使用するため）
 * src/types/index.ts と同じ構造
 */
export interface E2ETreeState {
  views: Array<{
    id: string;
    name: string;
    color: string;
    icon?: string;
  }>;
  currentViewId: string;
  nodes: Record<string, E2ETabNode>;
  tabToNode: Record<number, string>;
}

/**
 * TabNode 型を再定義（evaluate 内で使用するため）
 * src/types/index.ts と同じ構造
 */
export interface E2ETabNode {
  id: string;
  tabId: number;
  parentId: string | null;
  children: E2ETabNode[];
  isExpanded: boolean;
  depth: number;
  viewId: string;
  groupId?: string;
}

/**
 * Group 型を再定義
 */
export interface E2EGroup {
  id: string;
  name: string;
  color: string;
  isExpanded: boolean;
}

// TreeState をインポートして E2ETreeState と互換性を保つ
import type { TreeState } from '../../src/types';

// 型ガード関数
export function isTreeState(value: unknown): value is TreeState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    'nodes' in obj &&
    'tabToNode' in obj &&
    'views' in obj &&
    'currentViewId' in obj
  );
}

/**
 * Window型の拡張
 * E2Eテストでwindowにプロパティを追加する際に型安全を保つ
 */
declare global {
  interface Window extends TestGlobals {}

  // globalThis用の型拡張
  // eslint-disable-next-line no-var
  var receivedMessages: TestGlobals['receivedMessages'];
  // eslint-disable-next-line no-var
  var listenerReady: TestGlobals['listenerReady'];
  // eslint-disable-next-line no-var
  var stateUpdatedReceived: TestGlobals['stateUpdatedReceived'];
  // eslint-disable-next-line no-var
  var stateUpdateCount: TestGlobals['stateUpdateCount'];
  // eslint-disable-next-line no-var
  var testState: TestGlobals['testState'];
  // eslint-disable-next-line no-var
  var messageLog: TestGlobals['messageLog'];
  // eslint-disable-next-line no-var
  var receivedCount: TestGlobals['receivedCount'];
  // eslint-disable-next-line no-var
  var pendingTabParents: TestGlobals['pendingTabParents'];
}
