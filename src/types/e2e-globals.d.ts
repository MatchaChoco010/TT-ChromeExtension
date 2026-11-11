/**
 * E2Eテストが Service Worker の状態を検査・リセットするために公開するグローバル変数の型
 */
import type { TreeStateManager } from '@/services/TreeStateManager';

declare global {
  var treeStateManager: TreeStateManager;
  var pendingTabParents: Map<number, number>;
  var pendingDuplicateSources: Map<number, { url: string; windowId: number; isSubtreeDuplicate: boolean }>;
  var pendingLinkClicks: Map<number, number>;
  function prepareForReset(): Promise<void>;
  function waitForHandlers(): Promise<void>;
}

export {};
