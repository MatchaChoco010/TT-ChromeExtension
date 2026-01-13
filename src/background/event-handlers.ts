import type { MessageType, MessageResponse, TabNode, UserSettings } from '@/types';
import { TreeStateManager } from '@/services/TreeStateManager';
import { UnreadTracker } from '@/services/UnreadTracker';
import { TitlePersistenceService } from '@/services/TitlePersistenceService';
import { SnapshotManager } from '@/services/SnapshotManager';
import { StorageService, STORAGE_KEYS } from '@/storage/StorageService';
import { downloadService } from '@/storage/DownloadService';

/**
 * タブ位置設定のデフォルト値
 * ストレージに保存された設定に不足フィールドがある場合に使用
 */
const TAB_POSITION_DEFAULTS = {
  newTabPositionFromLink: 'child' as const,
  newTabPositionManual: 'end' as const,
  duplicateTabPosition: 'sibling' as const,
};

/**
 * ストレージから読み込んだ設定に不足フィールドを補完する
 * Chrome再起動後に古い設定（新フィールドがない）が読み込まれた場合に対応
 */
function getSettingsWithDefaults(settings: UserSettings | null): {
  newTabPositionFromLink: 'child' | 'sibling' | 'end';
  newTabPositionManual: 'child' | 'sibling' | 'end';
  duplicateTabPosition: 'sibling' | 'end';
  childTabBehavior: 'promote' | 'close_all';
} {
  return {
    newTabPositionFromLink: settings?.newTabPositionFromLink ?? TAB_POSITION_DEFAULTS.newTabPositionFromLink,
    newTabPositionManual: settings?.newTabPositionManual ?? TAB_POSITION_DEFAULTS.newTabPositionManual,
    duplicateTabPosition: settings?.duplicateTabPosition ?? TAB_POSITION_DEFAULTS.duplicateTabPosition,
    childTabBehavior: settings?.childTabBehavior ?? 'promote',
  };
}

const storageService = new StorageService();
const treeStateManager = new TreeStateManager(storageService);
const unreadTracker = new UnreadTracker(storageService);
const titlePersistence = new TitlePersistenceService(storageService);
const snapshotManager = new SnapshotManager(downloadService, storageService);

unreadTracker.loadFromStorage().catch(() => {});

titlePersistence.loadFromStorage().catch(() => {});

export { storageService as testStorageService, treeStateManager as testTreeStateManager, unreadTracker as testUnreadTracker, titlePersistence as testTitlePersistence, snapshotManager as testSnapshotManager };

/**
 * イベントハンドラー完了追跡システム
 *
 * 【目的】
 * E2Eテストのリセット処理で、前のテストの非同期ハンドラーが完了してから
 * リセットを開始するために必要。本番機能には影響しない。
 *
 * 【背景】
 * Chromeはイベントリスナーのコールバック完了を待たない。
 * そのため、テストでタブを閉じた後すぐにリセット処理を開始すると、
 * handleTabRemoved等のハンドラーがバックグラウンドで実行中のまま
 * 状態がクリアされ、競合が発生する。
 *
 * 【重要】
 * Service Workerの全ての非同期イベントハンドラーはtrackHandler()で
 * ラップする必要がある。ラップし忘れると、そのハンドラーの完了を
 * waitForPendingHandlers()で待機できなくなる。
 */
let pendingHandlerCount = 0;
let pendingHandlerResolvers: (() => void)[] = [];

/**
 * 非同期イベントハンドラーをラップして完了を追跡する
 *
 * 【使用方法】
 * chrome.tabs.onCreated.addListener((tab) => {
 *   trackHandler(() => handleTabCreated(tab));
 * });
 *
 * 【注意】
 * - E2Eテストのリセット機能のためにのみ必要
 * - 本番機能の動作には影響しない
 * - 新しいイベントハンドラーを追加する際は必ずこれでラップすること
 */
export async function trackHandler<T>(fn: () => Promise<T>): Promise<T> {
  pendingHandlerCount++;
  try {
    return await fn();
  } finally {
    pendingHandlerCount--;
    if (pendingHandlerCount === 0) {
      const resolvers = pendingHandlerResolvers;
      pendingHandlerResolvers = [];
      resolvers.forEach(resolve => resolve());
    }
  }
}

/**
 * 全ての実行中イベントハンドラーの完了を待機する
 *
 * 【用途】
 * E2Eテストのリセット時に使用。前のテストで発生した非同期ハンドラーが
 * 完了してからリセット処理を開始することで、状態の競合を防ぐ。
 *
 * 【注意】
 * - 本番機能では使用しない（E2Eテスト専用）
 * - trackHandler()でラップされたハンドラーのみ追跡可能
 */
async function waitForPendingHandlers(timeoutMs: number = 5000): Promise<void> {
  if (pendingHandlerCount === 0) {
    return;
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const index = pendingHandlerResolvers.indexOf(wrappedResolve);
      if (index !== -1) {
        pendingHandlerResolvers.splice(index, 1);
      }
      reject(new Error(
        `waitForPendingHandlers timed out after ${timeoutMs}ms. ` +
        `${pendingHandlerCount} handler(s) still running.`
      ));
    }, timeoutMs);

    const wrappedResolve = () => {
      clearTimeout(timeoutId);
      resolve();
    };

    pendingHandlerResolvers.push(wrappedResolve);
  });
}

/**
 * E2Eテスト用のリセット関数
 *
 * 【機能】
 * 実行中の非同期イベントハンドラーの完了を待機
 *
 * 【用途】
 * E2Eテストのリセット処理で使用。テスト間で状態をクリーンにリセットする。
 * この関数を呼ぶことで、前のテストの副作用が次のテストに影響しない。
 *
 * 【背景】
 * Chromeはイベントリスナーの完了を待たないため、
 * ハンドラーがバックグラウンドで実行中のままリセットが始まる可能性がある
 */
async function prepareForReset(): Promise<void> {
  await waitForPendingHandlers();
}

let dragState: { tabId: number; treeData: TabNode[]; sourceWindowId: number } | null =
  null;

const DEFAULT_VIEW_ID = 'default';

/**
 * 現在アクティブなビューIDを取得する
 * ストレージからtree_stateを読み込み、指定ウィンドウのcurrentViewIdを返す
 * windowIdが指定されていれば、currentViewByWindowIdから取得
 * 存在しない場合はデフォルトビューIDを返す
 *
 * @param windowId - ウィンドウID（指定されていればそのウィンドウのビュー、なければグローバル）
 */
async function getCurrentViewId(windowId?: number): Promise<string> {
  try {
    const treeState = await storageService.get(STORAGE_KEYS.TREE_STATE);
    if (!treeState) {
      return DEFAULT_VIEW_ID;
    }

    // ウィンドウIDが指定されている場合、そのウィンドウ固有のビューを返す
    if (windowId !== undefined && treeState.currentViewByWindowId) {
      const windowViewId = treeState.currentViewByWindowId[windowId];
      if (windowViewId) {
        return windowViewId;
      }
    }

    // フォールバック: グローバルなcurrentViewIdを返す
    if (treeState.currentViewId) {
      return treeState.currentViewId;
    }
    return DEFAULT_VIEW_ID;
  } catch {
    return DEFAULT_VIEW_ID;
  }
}

const pendingTabParents = new Map<number, number>();

const pendingDuplicateSources = new Map<number, { url: string; windowId: number; isSubtreeDuplicate: boolean }>();

const pendingGroupTabIds = new Set<number>();

let isCreatingGroupTab = false;

const lastActiveTabByWindow = new Map<number, number>();

const pendingLinkClicks = new Map<number, number>();

/**
 * handleTabCreated処理の直列化キュー
 *
 * 【目的】
 * 複数のタブが同時に作成された場合（例：複数タブの一括複製）、
 * handleTabCreated内のloadStateとpersistStateの間で競合が発生する。
 *
 * 【問題の詳細】
 * 1. handleTabCreated#1: loadState() → メモリに既存ノードをロード
 * 2. handleTabCreated#2: loadState() → メモリに既存ノードをロード（#1のpersistState完了前）
 * 3. handleTabCreated#1: addTab() → ノード追加
 * 4. handleTabCreated#2: addTab() → ノード追加（古い状態から）
 * 5. handleTabCreated#2のpersistStateが#1の結果を上書き
 *
 * 【解決策】
 * handleTabCreatedの処理全体をキューで直列化し、
 * 前の処理が完了してから次の処理を開始する。
 */
let tabCreatedQueue: Promise<void> = Promise.resolve();

/**
 * スナップショット復元中のタブIDセット
 * 復元中のタブはhandleTabCreatedでスキップされる
 */
const restoringTabIds = new Set<number>();

/**
 * スナップショット復元中フラグ
 * trueの間、handleTabCreatedは新しいタブをツリーに追加しない
 */
let isRestoringSnapshot = false;

// E2Eテスト等のService Worker評価コンテキストからアクセスするためglobalThisにエクスポート
declare global {

  var pendingTabParents: Map<number, number>;

  var pendingDuplicateSources: Map<number, { url: string; windowId: number; isSubtreeDuplicate: boolean }>;

  var pendingGroupTabIds: Set<number>;

  var pendingLinkClicks: Map<number, number>;

  var treeStateManager: TreeStateManager;

  /**
   * E2Eテスト用リセット準備関数
   * - 実行中の非同期ハンドラーの完了を待機
   * - IndexedDBのキャッシュ接続を閉じる
   */
  function prepareForReset(): Promise<void>;
}
globalThis.pendingTabParents = pendingTabParents;
globalThis.pendingDuplicateSources = pendingDuplicateSources;
globalThis.pendingGroupTabIds = pendingGroupTabIds;
globalThis.pendingLinkClicks = pendingLinkClicks;
globalThis.treeStateManager = treeStateManager;
globalThis.prepareForReset = prepareForReset;

/**
 * Chromeタブイベントリスナーを登録
 * 各ハンドラーをtrackHandlerでラップして完了を追跡する
 */
export function registerTabEventListeners(): void {
  chrome.tabs.onCreated.addListener((tab) => {
    trackHandler(() => handleTabCreated(tab));
  });
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    trackHandler(() => handleTabRemoved(tabId, removeInfo));
  });
  chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
    trackHandler(() => handleTabMoved(tabId, moveInfo));
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    trackHandler(() => handleTabUpdated(tabId, changeInfo, tab));
  });
  chrome.tabs.onActivated.addListener((activeInfo) => {
    trackHandler(() => handleTabActivated(activeInfo));
  });
  chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
    trackHandler(() => handleTabDetached(tabId, detachInfo));
  });
  chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
    trackHandler(() => handleTabAttached(tabId, attachInfo));
  });
  chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
    trackHandler(() => handleTabReplaced(addedTabId, removedTabId));
  });
}

/**
 * Chromeウィンドウイベントリスナーを登録
 * 各ハンドラーをtrackHandlerでラップして完了を追跡する
 */
export function registerWindowEventListeners(): void {
  chrome.windows.onCreated.addListener((window) => {
    trackHandler(() => handleWindowCreated(window));
  });
  chrome.windows.onRemoved.addListener((windowId) => {
    trackHandler(() => handleWindowRemoved(windowId));
  });
}

/**
 * webNavigationイベントリスナーを登録
 * onCreatedNavigationTargetはリンククリックまたはwindow.open()呼び出し時に発火する。
 * 以下のケースでは発火しないため、リンククリックを確実に検出できる:
 * - chrome.tabs.create()
 * - ブックマーク
 * - アドレスバー操作
 * - Ctrl+T（新規タブ）
 */
export function registerWebNavigationListeners(): void {
  chrome.webNavigation.onCreatedNavigationTarget.addListener(handleCreatedNavigationTarget);
}

/**
 * webNavigation.onCreatedNavigationTargetイベントを処理
 * リンククリックまたはwindow.open()で新しいタブが作成された際に発火する。
 * リンククリックから開かれたタブを確実に識別するために追跡する。
 */
function handleCreatedNavigationTarget(
  details: chrome.webNavigation.WebNavigationSourceCallbackDetails
): void {
  pendingLinkClicks.set(details.tabId, details.sourceTabId);

  // onCreatedが発火しないケースに備えてクリーンアップ
  setTimeout(() => {
    pendingLinkClicks.delete(details.tabId);
  }, 5000);
}

/**
 * Chromeランタイムメッセージリスナーを登録
 */
export function registerMessageListener(): void {
  chrome.runtime.onMessage.addListener(handleMessage);
}


/**
 * グループタブ判定
 *
 * グループタブ（group.htmlを開くタブ）を検出する。
 * グループタブはhandleTabCreatedではスキップし、createGroupWithRealTabで処理される。
 */
function isGroupTabUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('/group.html');
}

export async function handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) return;

  // ブラウザ起動時の初期同期中は処理をスキップ
  // syncWithChromeTabsがすべてのタブを正しく復元するため、handleTabCreatedでの追加は不要
  // これにより、タブが間違ったビューに追加される問題と未読インジケータの問題を防ぐ
  const syncInProgress = treeStateManager.isSyncInProgress();
  const syncCompleted = treeStateManager.isSyncCompleted();
  if (syncInProgress || !syncCompleted) {
    return;
  }

  // 非同期操作の前にlastActiveTabByWindowをキャプチャ
  // onActivatedがmapを更新する前に値を取得する必要がある
  // キュー待機前にキャプチャすることで、正確なアクティブタブを取得
  const capturedLastActiveTabId = tab.windowId !== undefined
    ? lastActiveTabByWindow.get(tab.windowId)
    : undefined;

  // 複数タブ作成時の競合を防ぐため、処理をキューで直列化
  // loadStateとpersistStateの間で状態が上書きされる問題を防ぐ
  tabCreatedQueue = tabCreatedQueue
    .then(() => handleTabCreatedInternal(tab, capturedLastActiveTabId))
    .catch((error) => {
      console.error('[handleTabCreated] Error processing tab:', tab.id, error);
    });
  return tabCreatedQueue;
}

/**
 * handleTabCreatedの内部処理
 * キューで直列化された状態で呼び出される
 */
async function handleTabCreatedInternal(
  tab: chrome.tabs.Tab,
  capturedLastActiveTabId: number | undefined
): Promise<void> {
  if (!tab.id) return;

  // 以下、元のhandleTabCreatedの処理を継続
  // capturedLastActiveTabIdはキュー待機前に取得済み（引数で渡される）

  if (isCreatingGroupTab) {
    await new Promise(resolve => setTimeout(resolve, 50));
    if (pendingGroupTabIds.has(tab.id)) {
      pendingGroupTabIds.delete(tab.id);
      return;
    }
    try {
      const refreshedTab = await chrome.tabs.get(tab.id);
      if (isGroupTabUrl(refreshedTab.url) || isGroupTabUrl(refreshedTab.pendingUrl)) {
        return;
      }
    } catch {
      return;
    }
  }

  if (pendingGroupTabIds.has(tab.id)) {
    pendingGroupTabIds.delete(tab.id);
    return;
  }
  if (isGroupTabUrl(tab.url) || isGroupTabUrl(tab.pendingUrl)) {
    return;
  }

  // スナップショット復元中はスキップ（復元処理が直接ツリー状態を更新する）
  if (isRestoringSnapshot || restoringTabIds.has(tab.id)) {
    restoringTabIds.delete(tab.id);
    return;
  }

  try {
    // ストレージから最新状態を読み込む（Side Panelのドラッグ&ドロップで設定された親子関係を上書きしないため）
    await treeStateManager.loadState();

    const rawSettings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
    const effectiveSettings = getSettingsWithDefaults(rawSettings);

    // ChromeのonCreatedイベントは常にopenerTabIdを含むとは限らないため、タブを再取得して確認する
    let openerTabIdFromChrome: number | undefined = tab.openerTabId;
    if (openerTabIdFromChrome === undefined) {
      try {
        const freshTab = await chrome.tabs.get(tab.id);
        openerTabIdFromChrome = freshTab.openerTabId;
      } catch {
        // タブが既に閉じられている場合は無視
      }
    }

    const pendingOpenerTabId = pendingTabParents.get(tab.id);

    let newTabPosition: 'child' | 'sibling' | 'end';

    // chrome.webNavigation.onCreatedNavigationTargetで検出されたタブをリンククリックとして扱う
    // このAPIはリンククリック/window.open()でのみ発火し、
    // chrome.tabs.create()、ブックマーク、アドレスバー、Ctrl+Tでは発火しない
    const linkClickSourceTabId = pendingLinkClicks.get(tab.id);
    const isLinkClick = linkClickSourceTabId !== undefined;

    const effectiveOpenerTabId = isLinkClick
      ? linkClickSourceTabId
      : (pendingOpenerTabId || openerTabIdFromChrome);

    if (isLinkClick) {
      pendingLinkClicks.delete(tab.id);
    }

    if (isLinkClick) {
      newTabPosition = effectiveSettings.newTabPositionFromLink;
    } else {
      newTabPosition = effectiveSettings.newTabPositionManual;
    }

    let parentId: string | null = null;

    let isDuplicatedTab = false;
    let duplicateSourceTabId: number | null = null;
    let isSubtreeDuplicate = false;

    // 複製タブの検出: chrome.tabs.duplicate()はopenerTabIdが呼び出し元タブ（サイドパネル等）を
    // 指すことがあるため、URLとwindowIdで照合する
    const tabUrl = tab.url || tab.pendingUrl || '';
    console.log('[DEBUG handleTabCreated] Checking duplicate - tabUrl:', tabUrl, 'windowId:', tab.windowId, 'pendingDuplicateSources:', Array.from(pendingDuplicateSources.entries()));
    for (const [sourceTabId, sourceInfo] of pendingDuplicateSources.entries()) {
      if (sourceInfo.url === tabUrl && sourceInfo.windowId === tab.windowId) {
        isDuplicatedTab = true;
        duplicateSourceTabId = sourceTabId;
        isSubtreeDuplicate = sourceInfo.isSubtreeDuplicate;
        pendingDuplicateSources.delete(sourceTabId);
        console.log('[DEBUG handleTabCreated] Matched duplicate source:', sourceTabId, 'isSubtreeDuplicate:', isSubtreeDuplicate);
        break;
      }
    }

    const duplicateTabPosition = effectiveSettings.duplicateTabPosition;
    console.log('[DEBUG handleTabCreated] isDuplicatedTab:', isDuplicatedTab, 'duplicateSourceTabId:', duplicateSourceTabId, 'duplicateTabPosition:', duplicateTabPosition);

    let insertAfterNodeId: string | undefined;
    if (isDuplicatedTab && duplicateSourceTabId !== null) {
      if (duplicateTabPosition === 'sibling') {
        const openerNode = treeStateManager.getNodeByTabId(duplicateSourceTabId);
        if (openerNode) {
          parentId = openerNode.parentId;
          insertAfterNodeId = openerNode.id;
          console.log('[DEBUG handleTabCreated] Duplicate sibling - parentId:', parentId, 'insertAfterNodeId:', insertAfterNodeId);
        }
      }
      // 'end'の場合はparentIdとinsertAfterNodeIdを設定しない（ツリーの最後に追加される）
    } else if (isLinkClick && effectiveOpenerTabId && newTabPosition === 'child') {
      const parentNode = treeStateManager.getNodeByTabId(effectiveOpenerTabId);
      if (parentNode) {
        parentId = parentNode.id;
      }
    } else if (isLinkClick && effectiveOpenerTabId && newTabPosition === 'sibling') {
      const openerNode = treeStateManager.getNodeByTabId(effectiveOpenerTabId);
      if (openerNode) {
        parentId = openerNode.parentId;
        insertAfterNodeId = openerNode.id;
      }
    } else if (!isLinkClick && newTabPosition === 'child') {
      // 手動で開かれたタブで'child'設定の場合、関数先頭でキャプチャした最後のアクティブタブを親とする
      if (capturedLastActiveTabId !== undefined && capturedLastActiveTabId !== tab.id) {
        const lastActiveNode = treeStateManager.getNodeByTabId(capturedLastActiveTabId);
        if (lastActiveNode) {
          parentId = lastActiveNode.id;
        }
      }
    } else if (!isLinkClick && newTabPosition === 'sibling') {
      // 手動で開かれたタブで'sibling'設定の場合、最後のアクティブタブの兄弟として配置
      if (capturedLastActiveTabId !== undefined && capturedLastActiveTabId !== tab.id) {
        const lastActiveNode = treeStateManager.getNodeByTabId(capturedLastActiveTabId);
        if (lastActiveNode) {
          parentId = lastActiveNode.parentId;
          insertAfterNodeId = lastActiveNode.id;
        }
      }
    }

    if (pendingOpenerTabId) {
      pendingTabParents.delete(tab.id);
    }

    // 子タブは親タブのビューに追加（ビューを跨いだ親子関係を防ぐ）
    let viewId: string;
    if (parentId) {
      const parentNode = treeStateManager.getNodeById(parentId);
      viewId = parentNode?.viewId ?? await getCurrentViewId(tab.windowId);
    } else {
      viewId = await getCurrentViewId(tab.windowId);
    }

    // 通常複製（サブツリー複製ではない）の場合、タブの移動はuseMenuActionsで既に行われているためスキップ
    // handleTabCreatedでも移動すると、二重の移動で競合が発生する
    // サブツリー複製の場合はuseMenuActionsでタブ移動を行わないため、ここで移動が必要
    const isNormalDuplicate = isDuplicatedTab && !isSubtreeDuplicate;
    const shouldMoveToEnd = !isNormalDuplicate && (
      (newTabPosition === 'end' && !isDuplicatedTab) ||
      (isDuplicatedTab && duplicateTabPosition === 'end')
    );
    console.log('[DEBUG handleTabCreated] shouldMoveToEnd:', shouldMoveToEnd, 'insertAfterNodeId:', insertAfterNodeId, 'isDuplicatedTab:', isDuplicatedTab, 'isSubtreeDuplicate:', isSubtreeDuplicate, 'isNormalDuplicate:', isNormalDuplicate);

    // insertAfterNodeIdが指定されている場合、Chromeのタブも対応する位置に移動
    // これによりサイドパネルの表示順序（tab.indexでソート）が正しくなる
    // NOTE: shouldMoveToEndの場合は後で最後に移動するので、ここではスキップ
    // NOTE: 通常複製の場合はuseMenuActionsで既に移動済みなのでスキップ（サブツリー複製は除く）
    if (!shouldMoveToEnd && !isNormalDuplicate && insertAfterNodeId && tab.windowId !== undefined) {
      try {
        const insertAfterNode = treeStateManager.getNodeById(insertAfterNodeId);
        if (insertAfterNode) {
          const insertAfterTab = await chrome.tabs.get(insertAfterNode.tabId);
          if (insertAfterTab && insertAfterTab.index !== undefined) {
            console.log('[DEBUG handleTabCreated] Moving tab (insertAfterNodeId) - tabId:', tab.id, 'current index:', tab.index, 'target:', insertAfterTab.index + 1);
            await chrome.tabs.move(tab.id, { index: insertAfterTab.index + 1 });
            const afterMove = await chrome.tabs.get(tab.id);
            console.log('[DEBUG handleTabCreated] After move (insertAfterNodeId) - index:', afterMove.index);
          }
        }
      } catch {
        // タブ移動失敗は無視
      }
    } else if (isNormalDuplicate) {
      console.log('[DEBUG handleTabCreated] Skipping move for normal duplicated tab - already moved by useMenuActions');
    }

    console.log('[DEBUG handleTabCreated] Before addTab - tabId:', tab.id, 'parentId:', parentId, 'viewId:', viewId, 'insertAfterNodeId:', insertAfterNodeId);
    await treeStateManager.addTab(tab, parentId, viewId, insertAfterNodeId);
    console.log('[DEBUG handleTabCreated] After addTab - tabId:', tab.id);

    // 親ノードを自動展開（新しい子タブを見えるようにするため）
    // ただし複製タブの場合はスキップ:
    // - 単一タブ複製: 元のタブが見えている=親は既に展開済み
    // - サブツリー複製: handleDuplicateSubtreeが後で親子関係を修正する
    //   この時点で展開すると、元のタブの折りたたみ状態が壊れる
    if (parentId && !isDuplicatedTab) {
      await treeStateManager.expandNode(parentId);
    }

    if (!tab.active && tab.id) {
      await unreadTracker.markAsUnread(tab.id);
    }

    // 'end'設定の場合、最後にタブを最後尾に移動
    // NOTE: 処理の最後に移動することで、途中で他の要因（Vivaldiのタブ管理など）が
    // タブを移動しても、最終的に正しい位置に配置される
    // NOTE: 複製タブの場合はuseMenuActionsで既に移動済みなのでスキップ
    if (shouldMoveToEnd && tab.windowId !== undefined) {
      console.log('[DEBUG handleTabCreated] Moving tab to end - tabId:', tab.id);
      try {
        await chrome.tabs.move(tab.id, { index: -1 });
        const afterMove = await chrome.tabs.get(tab.id);
        console.log('[DEBUG handleTabCreated] After move to end - index:', afterMove.index);
      } catch {
        // タブ移動失敗は無視
      }
    }

    // デバッグ: 全タブの状態を確認
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    console.log('[DEBUG handleTabCreated] Final tab order:', allTabs.sort((a, b) => a.index - b.index).map(t => ({ id: t.id, index: t.index })));

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch (error) {
    console.error('[handleTabCreated] Error:', error);
  }
}

/**
 * 空ウィンドウ自動クローズ
 *
 * ウィンドウ内のタブ数を確認し、タブが残っていなければ自動的に閉じる
 * 最後のウィンドウは閉じない（ブラウザ終了防止）
 */
async function tryCloseEmptyWindow(windowId: number): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ windowId });
    if (tabs.length > 0) {
      return;
    }

    const allWindows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    if (allWindows.length <= 1) {
      return;
    }

    await chrome.windows.remove(windowId);
  } catch {
    // ウィンドウクローズ失敗は無視
  }
}

export async function handleTabRemoved(
  tabId: number,
  removeInfo: chrome.tabs.TabRemoveInfo,
): Promise<void> {
  const { windowId, isWindowClosing } = removeInfo;

  try {
    // ウィンドウが閉じられる場合はツリー状態を保持する
    // これにより、ブラウザ再起動時にtreeStructureからビュー情報を含む状態を復元できる
    // ウィンドウを閉じただけの場合はsyncWithChromeTabsで古いノードがcleanupStaleNodesでクリーンアップされる
    if (isWindowClosing) {
      // ウィンドウ閉鎖時はunreadとtitleのみクリア（ツリー状態は保持）
      if (unreadTracker.isUnread(tabId)) {
        await unreadTracker.markAsRead(tabId);
      }
      titlePersistence.removeTitle(tabId);
      chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
      return;
    }

    // ストレージから最新状態を読み込む（Side Panelのドラッグ&ドロップで設定された親子関係を上書きしないため）
    await treeStateManager.loadState();

    const rawSettings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
    const effectiveSettings = getSettingsWithDefaults(rawSettings);

    await treeStateManager.removeTab(tabId, effectiveSettings.childTabBehavior);

    if (unreadTracker.isUnread(tabId)) {
      await unreadTracker.markAsRead(tabId);
    }

    titlePersistence.removeTitle(tabId);

    // ファビコンはURLベースで保存されているため、タブ削除時には削除しない
    // 同じURLの別のタブがある場合にファビコンが消えてしまう問題を防ぐ
    // また、ブラウザ再起動後の復元にも使用されるため、キャッシュとして保持する

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});

    await tryCloseEmptyWindow(windowId);
  } catch {
    // タブ削除処理失敗は無視
  }
}

export async function handleTabMoved(
  tabId: number,
  moveInfo: chrome.tabs.TabMoveInfo,
): Promise<void> {
  void tabId;
  void moveInfo;

  try {
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch {
    // タブ移動処理失敗は無視
  }
}

export async function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab,
): Promise<void> {
  try {
    if (changeInfo.title !== undefined && tab.title) {
      titlePersistence.saveTitle(tabId, tab.title);
    }

    if (changeInfo.favIconUrl !== undefined && changeInfo.favIconUrl !== null && changeInfo.favIconUrl !== '' && tab.url) {
      try {
        // URLをキーにしてファビコンを保存（ブラウザ再起動後も復元可能にするため）
        const storedFaviconsResult = await storageService.get(STORAGE_KEYS.TAB_FAVICONS);
        const favicons = storedFaviconsResult ? { ...storedFaviconsResult } : {};
        favicons[tab.url] = changeInfo.favIconUrl;
        await storageService.set(STORAGE_KEYS.TAB_FAVICONS, favicons);
      } catch {
        // ファビコン保存失敗は無視
      }
    }

    // タイトル、URL、ステータス、ファビコン、discarded、pinnedの変更時にUI通知
    if (
      changeInfo.title !== undefined ||
      changeInfo.url !== undefined ||
      changeInfo.status !== undefined ||
      changeInfo.favIconUrl !== undefined ||
      changeInfo.discarded !== undefined ||
      changeInfo.pinned !== undefined
    ) {
      chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
    }
  } catch {
    // タブ更新処理失敗は無視
  }
}

async function handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): Promise<void> {
  try {
    // 'child'設定の手動タブ作成時に親を決定するために記録
    lastActiveTabByWindow.set(activeInfo.windowId, activeInfo.tabId);

    if (unreadTracker.isUnread(activeInfo.tabId)) {
      await unreadTracker.markAsRead(activeInfo.tabId);

      chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
    }
  } catch {
    // タブアクティブ化処理失敗は無視
  }
}

/**
 * タブがウィンドウから取り外されたときのハンドラ
 * ウィンドウ間のタブ移動で発火する（onMovedはウィンドウ内移動のみ）
 */
/**
 * ウィンドウが閉じる際にdetachされたピン留めタブを追跡するマップ
 * windowId -> Set<tabId>
 */
const detachedPinnedTabsByWindow = new Map<number, Set<number>>();

async function handleTabDetached(
  tabId: number,
  detachInfo: chrome.tabs.TabDetachInfo,
): Promise<void> {
  try {
    // ピン留めタブがdetachされた場合、元のウィンドウIDとタブIDを記録
    // ウィンドウが閉じられたときに、このタブを閉じるために使用
    const tab = await chrome.tabs.get(tabId);
    if (tab.pinned) {
      const oldWindowId = detachInfo.oldWindowId;
      if (!detachedPinnedTabsByWindow.has(oldWindowId)) {
        detachedPinnedTabsByWindow.set(oldWindowId, new Set());
      }
      detachedPinnedTabsByWindow.get(oldWindowId)!.add(tabId);
    }

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch {
    // タブが存在しない場合やメッセージ送信失敗は無視
  }
}

/**
 * タブが別のウィンドウにアタッチされたときのハンドラ
 * ウィンドウ間のタブ移動で発火する（onMovedはウィンドウ内移動のみ）
 */
async function handleTabAttached(
  tabId: number,
  _attachInfo: chrome.tabs.TabAttachInfo,
): Promise<void> {
  try {
    // タブがattachされた場合、通常のタブ移動（ウィンドウが閉じられない場合）は
    // 追跡リストからクリアしない。
    // ウィンドウが閉じられる場合のみ、handleWindowRemovedでタブを閉じる。
    // ここでは状態更新のみ行う。
    // 注: ユーザーが手動でピン留めタブを移動した場合、
    // 後でdetachedPinnedTabsByWindowをクリーンアップする必要があるが、
    // windows.getで元ウィンドウが存在するかをチェックすることで対応

    // 元のウィンドウがまだ存在する場合、ユーザーによる通常の移動なのでリストから削除
    for (const [windowId, tabIds] of detachedPinnedTabsByWindow.entries()) {
      if (tabIds.has(tabId)) {
        try {
          // 元のウィンドウがまだ存在するか確認
          await chrome.windows.get(windowId);
          // 存在する場合、ユーザーによる通常の移動なのでリストから削除
          tabIds.delete(tabId);
          if (tabIds.size === 0) {
            detachedPinnedTabsByWindow.delete(windowId);
          }
        } catch {
          // ウィンドウが存在しない場合、handleWindowRemovedで処理される
        }
        break;
      }
    }

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch {
    // メッセージ送信失敗は無視
  }
}

/**
 * タブ置換処理のキュー
 * 複数のonReplacedイベントが並行して発火した場合に競合を防ぐ
 */
let tabReplaceQueue: Promise<void> = Promise.resolve();

/**
 * タブが置き換えられたときのハンドラ
 * chrome.tabs.discard()でタブIDが変わる場合に発火する
 * 複数タブを同時にdiscardした場合の競合を防ぐため、キューで直列化
 */
async function handleTabReplaced(
  addedTabId: number,
  removedTabId: number,
): Promise<void> {
  tabReplaceQueue = tabReplaceQueue.then(async () => {
    try {
      await treeStateManager.loadState();
      await treeStateManager.replaceTabId(removedTabId, addedTabId);
      chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
    } catch {
      // タブ置換処理失敗は無視
    }
  }).catch(() => {
    // キュー処理のエラーは無視
  });
  return tabReplaceQueue;
}

async function handleWindowCreated(window: chrome.windows.Window): Promise<void> {
  try {
    // スナップショット復元中はsyncWithChromeTabsをスキップ
    // handleRestoreSnapshotが直接ツリー状態を管理するため
    if (isRestoringSnapshot) {
      return;
    }

    if (window.id !== undefined) {
      // ユーザー設定を取得してsyncWithChromeTabsに渡す
      const rawSettings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
      const syncSettings = {
        newTabPositionManual: rawSettings?.newTabPositionManual ?? 'end' as const,
      };
      await treeStateManager.syncWithChromeTabs(syncSettings);
    }

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch {
    // ウィンドウ作成処理失敗は無視
  }
}

async function handleWindowRemoved(windowId: number): Promise<void> {
  try {
    // ウィンドウが閉じられたときに、そのウィンドウからdetachされたピン留めタブを閉じる
    // これにより、ウィンドウを閉じたときにピン留めタブが他のウィンドウに移動して
    // 重複することを防ぐ
    const pinnedTabsToClose = detachedPinnedTabsByWindow.get(windowId);
    if (pinnedTabsToClose && pinnedTabsToClose.size > 0) {
      const tabIds = Array.from(pinnedTabsToClose);
      for (const tabId of tabIds) {
        try {
          await chrome.tabs.remove(tabId);
        } catch {
          // タブが既に閉じられている場合は無視
        }
      }
      detachedPinnedTabsByWindow.delete(windowId);
    }

    // currentViewByWindowIdからこのウィンドウのエントリを削除
    try {
      const treeState = await storageService.get(STORAGE_KEYS.TREE_STATE);
      if (treeState?.currentViewByWindowId && treeState.currentViewByWindowId[windowId]) {
        const newCurrentViewByWindowId = { ...treeState.currentViewByWindowId };
        delete newCurrentViewByWindowId[windowId];
        await storageService.set(STORAGE_KEYS.TREE_STATE, {
          ...treeState,
          currentViewByWindowId: Object.keys(newCurrentViewByWindowId).length > 0
            ? newCurrentViewByWindowId
            : undefined,
        });
      }
    } catch {
      // ストレージ更新失敗は無視
    }

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch {
    // メッセージ送信失敗は無視
  }
}

function handleMessage(
  message: MessageType,

  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse<unknown>) => void,
): boolean {
  try {
    switch (message.type) {
      case 'GET_STATE':
        trackHandler(() => handleGetState(sendResponse));
        break;

      case 'UPDATE_TREE':
        trackHandler(() => handleUpdateTree(message.payload, sendResponse));
        break;

      case 'ACTIVATE_TAB':
        handleActivateTab(message.payload.tabId, sendResponse);
        break;

      case 'CLOSE_TAB':
        handleCloseTab(message.payload.tabId, sendResponse);
        break;

      case 'CLOSE_SUBTREE':
        trackHandler(() => handleCloseSubtree(message.payload.tabId, sendResponse));
        break;

      case 'CLOSE_TABS_WITH_COLLAPSED_SUBTREES':
        trackHandler(() => handleCloseTabsWithCollapsedSubtrees(message.payload.tabIds, sendResponse));
        break;

      case 'MOVE_TAB_TO_WINDOW':
        handleMoveTabToWindow(
          message.payload.tabId,
          message.payload.windowId,
          sendResponse,
        );
        break;

      case 'CREATE_WINDOW_WITH_TAB':
        handleCreateWindowWithTab(message.payload.tabId, sendResponse);
        break;

      case 'CREATE_WINDOW_WITH_SUBTREE':
        trackHandler(() => handleCreateWindowWithSubtree(message.payload.tabId, message.payload.sourceWindowId, sendResponse));
        break;

      case 'MOVE_SUBTREE_TO_WINDOW':
        trackHandler(() => handleMoveSubtreeToWindow(
          message.payload.tabId,
          message.payload.windowId,
          sendResponse,
        ));
        break;

      case 'SET_DRAG_STATE':
        handleSetDragState(message.payload, sendResponse);
        break;

      case 'GET_DRAG_STATE':
        handleGetDragState(sendResponse);
        break;

      case 'CLEAR_DRAG_STATE':
        handleClearDragState(sendResponse);
        break;

      case 'SYNC_TABS':
        trackHandler(() => handleSyncTabs(sendResponse));
        break;

      case 'REFRESH_TREE_STRUCTURE':
        trackHandler(() => handleRefreshTreeStructure(sendResponse));
        break;

      case 'CREATE_GROUP':
        trackHandler(() => handleCreateGroup(message.payload.tabIds, sendResponse));
        break;

      case 'DISSOLVE_GROUP':
        trackHandler(() => handleDissolveGroup(message.payload.tabIds, sendResponse));
        break;

      case 'REGISTER_DUPLICATE_SOURCE':
        trackHandler(() => handleRegisterDuplicateSource(message.payload.sourceTabId, sendResponse));
        break;

      case 'DUPLICATE_SUBTREE':
        trackHandler(() => handleDuplicateSubtree(message.payload.tabId, sendResponse));
        break;

      case 'GET_GROUP_INFO':
        trackHandler(() => handleGetGroupInfo(message.payload.tabId, sendResponse));
        break;

      case 'CREATE_SNAPSHOT':
        trackHandler(() => handleCreateSnapshot(sendResponse));
        break;

      case 'RESTORE_SNAPSHOT':
        trackHandler(() => handleRestoreSnapshot(
          message.payload.jsonData,
          message.payload.closeCurrentTabs,
          sendResponse
        ));
        break;

      default:
        sendResponse({
          success: false,
          error: `Unknown message type: ${message.type}`,
        });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Chrome拡張APIは非同期レスポンスを示すためにtrueを返す必要がある
  return true;
}

async function handleGetState(
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.loadState();

    const tree = treeStateManager.getTree(DEFAULT_VIEW_ID);

    sendResponse({ success: true, data: { tree } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleUpdateTree(
  payload: { nodeId: string; newParentId: string | null; index: number },
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const { nodeId, newParentId, index } = payload;

    await treeStateManager.moveNode(nodeId, newParentId, index);

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function handleActivateTab(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  chrome.tabs.update(tabId, { active: true }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        error: chrome.runtime.lastError.message || 'Unknown error',
      });
    } else {
      sendResponse({ success: true, data: null });
    }
  });
}

function handleCloseTab(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  chrome.tabs.remove(tabId, () => {
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        error: chrome.runtime.lastError.message || 'Unknown error',
      });
    } else {
      sendResponse({ success: true, data: null });
    }
  });
}

/**
 * サブツリーを閉じる
 * 対象タブとその全ての子孫タブを閉じる
 */
async function handleCloseSubtree(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    // ストレージから最新状態を読み込む（テスト等で直接更新された場合に正確なサブツリーを取得するため）
    await treeStateManager.loadState();

    const subtree = treeStateManager.getSubtree(tabId);
    if (subtree.length === 0) {
      sendResponse({
        success: false,
        error: 'Tab not found',
      });
      return;
    }

    const tabIds = subtree.map((node) => node.tabId);

    await chrome.tabs.remove(tabIds);

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * 複数タブを閉じる（折りたたまれた親タブはサブツリー全体を閉じる）
 * expanded: falseの親タブが含まれている場合、そのサブツリーの子要素も閉じる
 */
async function handleCloseTabsWithCollapsedSubtrees(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    // ストレージから最新状態を読み込む
    await treeStateManager.loadState();

    const allTabIdsToClose = new Set<number>();

    for (const tabId of tabIds) {
      const node = treeStateManager.getNodeByTabId(tabId);
      if (!node) {
        // ノードが見つからない場合でもタブIDを追加
        allTabIdsToClose.add(tabId);
        continue;
      }

      // expanded: falseで子要素がある場合はサブツリー全体を閉じる
      if (!node.isExpanded && node.children.length > 0) {
        const subtree = treeStateManager.getSubtree(tabId);
        for (const subtreeNode of subtree) {
          allTabIdsToClose.add(subtreeNode.tabId);
        }
      } else {
        allTabIdsToClose.add(tabId);
      }
    }

    await chrome.tabs.remove([...allTabIdsToClose]);

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function handleMoveTabToWindow(
  tabId: number,
  windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  chrome.tabs.move(tabId, { windowId, index: -1 }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        error: chrome.runtime.lastError.message || 'Unknown error',
      });
    } else {
      sendResponse({ success: true, data: null });
    }
  });
}

function handleCreateWindowWithTab(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  chrome.windows.create({ tabId }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        error: chrome.runtime.lastError.message || 'Unknown error',
      });
    } else {
      sendResponse({ success: true, data: null });
    }
  });
}

/**
 * サブツリー全体で新しいウィンドウを作成
 * パネル外へのドロップで新しいウィンドウを作成し、サブツリー全体を移動
 * ドラッグアウト後の空ウィンドウ自動クローズ
 */
async function handleCreateWindowWithSubtree(
  tabId: number,
  sourceWindowId: number | undefined,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const subtree = treeStateManager.getSubtree(tabId);
    if (subtree.length === 0) {
      sendResponse({
        success: false,
        error: 'Tab not found',
      });
      return;
    }

    const tabIds = subtree.map((node) => node.tabId);

    chrome.windows.create({ tabId }, async (window) => {
      if (chrome.runtime.lastError || !window || !window.id) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError?.message || 'Failed to create window',
        });
        return;
      }

      if (tabIds.length > 1) {
        const remainingTabIds = tabIds.slice(1);

        for (const tid of remainingTabIds) {
          try {
            await new Promise<void>((resolve, reject) => {
              chrome.tabs.move(tid, { windowId: window.id!, index: -1 }, () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
          } catch {
            // タブ移動失敗は無視
          }
        }
      }

      if (sourceWindowId !== undefined) {
        try {
          const movedTabIds = new Set(tabIds);
          const remainingTabs = await chrome.tabs.query({ windowId: sourceWindowId });
          const actualRemainingTabs = remainingTabs.filter(
            (tab) => tab.id !== undefined && !movedTabIds.has(tab.id)
          );
          if (actualRemainingTabs.length === 0) {
            await chrome.windows.remove(sourceWindowId);
          }
        } catch {
          // ウィンドウクローズ失敗は無視
        }
      }

      sendResponse({ success: true, data: null });
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * サブツリー全体を別のウィンドウに移動
 * タブを別ウィンドウに移動し、ツリー構造を維持
 */
async function handleMoveSubtreeToWindow(
  tabId: number,
  windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const subtree = treeStateManager.getSubtree(tabId);
    if (subtree.length === 0) {
      sendResponse({
        success: false,
        error: 'Tab not found',
      });
      return;
    }

    const tabIds = subtree.map((node) => node.tabId);

    for (const tid of tabIds) {
      try {
        await new Promise<void>((resolve, reject) => {
          chrome.tabs.move(tid, { windowId, index: -1 }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || 'Unknown error'));
            } else {
              resolve();
            }
          });
        });
      } catch {
        // タブ移動失敗は無視
      }
    }

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function handleSetDragState(
  payload: { tabId: number; treeData: TabNode[]; sourceWindowId: number },
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  dragState = payload;
  sendResponse({ success: true, data: null });
}

function handleGetDragState(
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  sendResponse({ success: true, data: dragState });
}

function handleClearDragState(
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  dragState = null;
  sendResponse({ success: true, data: null });
}

export function getDragState():
  { tabId: number; treeData: TabNode[]; sourceWindowId: number } | null {
  return dragState;
}

export function setDragState(
  state: { tabId: number; treeData: TabNode[]; sourceWindowId: number } | null,
): void {
  dragState = state;
}

/**
 * SYNC_TABSメッセージを処理し、TreeStateManagerをChromeタブと同期
 */
async function handleSyncTabs(
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    // ユーザー設定を取得してsyncWithChromeTabsに渡す
    const rawSettings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
    const syncSettings = {
      newTabPositionManual: rawSettings?.newTabPositionManual ?? 'end' as const,
    };
    await treeStateManager.syncWithChromeTabs(syncSettings);
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * REFRESH_TREE_STRUCTUREメッセージを処理
 * Side Panelからのドラッグ&ドロップ操作後に呼び出す。
 * ストレージから最新の状態を読み込み、treeStructureを再構築して保存する。
 */
async function handleRefreshTreeStructure(
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.refreshTreeStructure();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * グループ作成（実タブ作成版）
 * 複数タブが選択されている状態でグループ化を実行する。
 *
 * レースコンディション対策として以下の順序で処理:
 * 1. グループタブをバックグラウンドで作成（active: false）
 * 2. ツリー状態を更新（グループ情報を登録）
 * 3. ツリー状態更新完了を待ってからアクティブ化
 */
async function handleCreateGroup(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    if (tabIds.length === 0) {
      sendResponse({
        success: false,
        error: 'No tabs specified for grouping',
      });
      return;
    }

    let windowId: number | undefined;
    let firstTabIndex: number | undefined;
    try {
      const firstTab = await chrome.tabs.get(tabIds[0]);
      windowId = firstTab.windowId;
      firstTabIndex = firstTab.index;
    } catch {
      // タブ情報取得失敗は無視
    }

    const createOptions: chrome.tabs.CreateProperties = {
      url: `chrome-extension://${chrome.runtime.id}/group.html`,
      active: false,
    };
    if (windowId !== undefined) {
      createOptions.windowId = windowId;
    }
    if (firstTabIndex !== undefined) {
      createOptions.index = firstTabIndex;
    }

    // handleTabCreatedとのレースコンディションを防止
    isCreatingGroupTab = true;
    const groupTab = await chrome.tabs.create(createOptions);

    if (!groupTab.id) {
      isCreatingGroupTab = false;
      sendResponse({
        success: false,
        error: 'Failed to create group tab',
      });
      return;
    }

    pendingGroupTabIds.add(groupTab.id);
    isCreatingGroupTab = false;

    const groupPageUrl = `chrome-extension://${chrome.runtime.id}/group.html?tabId=${groupTab.id}`;
    await chrome.tabs.update(groupTab.id, { url: groupPageUrl });

    await treeStateManager.loadState();
    const groupNodeId = await treeStateManager.createGroupWithRealTab(groupTab.id, tabIds, '新しいグループ');

    await chrome.tabs.update(groupTab.id, { active: true });

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});

    sendResponse({ success: true, data: { groupId: groupNodeId, groupTabId: groupTab.id } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * グループ解除
 * グループを解除し、子タブをルートレベルに移動
 */
async function handleDissolveGroup(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    if (tabIds.length === 0) {
      sendResponse({
        success: false,
        error: 'No tabs specified for ungrouping',
      });
      return;
    }

    await treeStateManager.loadState();
    await treeStateManager.dissolveGroup(tabIds[0]);

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * 複製元タブの登録
 * openerTabIdが正しく設定されない場合でも複製タブを識別できるよう、
 * URLとwindowIdを保存する。
 */
async function handleRegisterDuplicateSource(
  sourceTabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const tab = await chrome.tabs.get(sourceTabId);
    pendingDuplicateSources.set(sourceTabId, {
      url: tab.url || tab.pendingUrl || '',
      windowId: tab.windowId,
      isSubtreeDuplicate: false,
    });

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * サブツリーを複製
 * 対象タブとその全ての子孫タブを複製し、元のツリー構造を維持する。
 */
async function handleDuplicateSubtree(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.loadState();

    const subtree = treeStateManager.getSubtree(tabId);
    if (subtree.length === 0) {
      sendResponse({
        success: false,
        error: 'Tab not found',
      });
      return;
    }

    const tabIdToNewTabId = new Map<number, number>();

    for (const node of subtree) {
      const sourceTab = await chrome.tabs.get(node.tabId);
      pendingDuplicateSources.set(node.tabId, {
        url: sourceTab.url || '',
        windowId: sourceTab.windowId,
        isSubtreeDuplicate: true,
      });
      const duplicatedTab = await chrome.tabs.duplicate(node.tabId);
      if (duplicatedTab?.id) {
        tabIdToNewTabId.set(node.tabId, duplicatedTab.id);
      }
      // pendingDuplicateSourcesの削除はhandleTabCreated内で行われる
      // ここで削除するとhandleTabCreatedが非同期で実行される前に
      // エントリが削除されてしまうレースコンディションが発生する
    }

    // すべての複製タブがtree_stateに追加されるまでポーリングで待機
    // 固定時間待機ではなく、条件が満たされたら即座に次に進む
    const newTabIds = Array.from(tabIdToNewTabId.values());
    const maxIterations = 100; // 最大5秒 (50ms * 100)
    for (let i = 0; i < maxIterations; i++) {
      await treeStateManager.loadState();
      const allTabsInTree = newTabIds.every(tabId =>
        treeStateManager.getNodeByTabId(tabId) !== null
      );
      if (allTabsInTree) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await treeStateManager.loadState();

    const rootNode = subtree[0];
    const rootNewTabId = tabIdToNewTabId.get(rootNode.tabId);
    const rootNewNode = rootNewTabId ? treeStateManager.getNodeByTabId(rootNewTabId) : null;
    const originalRootNode = treeStateManager.getNodeByTabId(rootNode.tabId);

    if (rootNewNode && originalRootNode) {
      // ルートの複製タブを元のタブの兄弟として配置
      if (originalRootNode.parentId) {
        // 元のタブが親を持つ場合、複製タブも同じ親の子として配置
        // 元のタブの直後に配置するため、親の子リスト内でのインデックスを取得
        const parentNode = treeStateManager.getNodeById(originalRootNode.parentId);
        let insertIndex = -1;
        if (parentNode) {
          const originalIndex = parentNode.children.findIndex(
            (child) => child.id === originalRootNode.id
          );
          if (originalIndex !== -1) {
            // 元のノードの直後に挿入
            insertIndex = originalIndex + 1;
          }
        }
        await treeStateManager.moveNode(rootNewNode.id, originalRootNode.parentId, insertIndex);
      }

      // 元のルートノードの展開状態を複製ノードにコピー
      // 折りたたまれたタブを複製した場合、複製も折りたたまれた状態になるべき
      if (!originalRootNode.isExpanded) {
        // 複製ノードはデフォルトでisExpanded: trueで作成されるので、
        // 元が折りたたまれている場合のみトグルする
        await treeStateManager.toggleExpand(rootNewNode.id);
      }

      // 子孫タブを複製元のツリー構造に合わせて配置
      for (let i = 1; i < subtree.length; i++) {
        const originalNode = subtree[i];
        const newTabId = tabIdToNewTabId.get(originalNode.tabId);
        if (!newTabId) continue;

        const newNode = treeStateManager.getNodeByTabId(newTabId);
        if (!newNode) continue;

        const originalParentTabId = originalNode.parentId
          ? treeStateManager.getNodeById(originalNode.parentId)?.tabId
          : null;

        if (originalParentTabId) {
          const newParentTabId = tabIdToNewTabId.get(originalParentTabId);
          if (newParentTabId) {
            const newParentNode = treeStateManager.getNodeByTabId(newParentTabId);
            if (newParentNode) {
              await treeStateManager.moveNode(newNode.id, newParentNode.id, -1);
            }
          }
        }
      }
    }

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * グループ情報取得
 */
async function handleGetGroupInfo(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.loadState();

    const groupInfo = await treeStateManager.getGroupInfo(tabId);
    sendResponse({ success: true, data: groupInfo });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * スナップショット作成
 */
async function handleCreateSnapshot(
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const timestamp = new Date().toLocaleString();
    const name = `Manual Snapshot - ${timestamp}`;
    await snapshotManager.createSnapshot(name, false);
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * スナップショット復元
 *
 * バックグラウンドで一括処理することで、handleTabCreatedとの競合を回避
 * - 復元中フラグを設定してイベントハンドラをスキップ
 * - タブ作成後、ツリー状態を直接更新
 * - 親子関係とビュー配置を正しく復元
 *
 * @param jsonData - スナップショットJSON文字列
 * @param closeCurrentTabs - 既存タブを閉じるかどうか
 * @param sendResponse - レスポンス送信関数
 */
async function handleRestoreSnapshot(
  jsonData: string,
  closeCurrentTabs: boolean,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    isRestoringSnapshot = true;

    const parsed = JSON.parse(jsonData);
    const snapshotTabs: Array<{
      index: number;
      url: string;
      title: string;
      parentIndex: number | null;
      viewId: string;
      isExpanded: boolean;
      pinned: boolean;
      windowIndex?: number;
    }> = parsed.data.tabs;
    const snapshotViews: Array<{
      id: string;
      name: string;
      color: string;
    }> = parsed.data.views;

    if (snapshotTabs.length === 0) {
      sendResponse({ success: true, data: null });
      isRestoringSnapshot = false;
      return;
    }

    // 既存タブを取得（後で閉じるため）
    // この拡張機能のサイドパネルは操作UIなので閉じない（クエリパラメータを考慮）
    const sidePanelUrlBase = `chrome-extension://${chrome.runtime.id}/sidepanel.html`;
    const existingTabs = await chrome.tabs.query({});
    const existingTabIds = existingTabs
      .filter(t => t.id !== undefined && !t.url?.startsWith(sidePanelUrlBase))
      .map(t => t.id as number);

    // 親を持たないタブを先に作成するためソート
    const sortedTabs = [...snapshotTabs].sort((a, b) => {
      if (a.parentIndex === null && b.parentIndex !== null) return -1;
      if (a.parentIndex !== null && b.parentIndex === null) return 1;
      return a.index - b.index;
    });

    // タブを作成してマッピングを構築
    const indexToNewTabId = new Map<number, number>();
    const indexToSnapshot = new Map<number, typeof sortedTabs[0]>();

    for (const tabSnapshot of sortedTabs) {
      indexToSnapshot.set(tabSnapshot.index, tabSnapshot);
    }

    // マルチウィンドウ対応: windowIndexごとに新しいウィンドウを作成
    const windowIndexSet = new Set<number>();
    for (const tabSnapshot of sortedTabs) {
      windowIndexSet.add(tabSnapshot.windowIndex ?? 0);
    }
    const windowIndices = Array.from(windowIndexSet).sort((a, b) => a - b);

    const windowIndexToNewWindowId = new Map<number, number>();
    const blankTabsToRemove: number[] = [];

    for (const windowIndex of windowIndices) {
      try {
        const newWindow = await chrome.windows.create({});
        if (newWindow.id !== undefined) {
          windowIndexToNewWindowId.set(windowIndex, newWindow.id);
          // 新しいウィンドウに自動で作成される空白タブを記録（後で削除）
          if (newWindow.tabs && newWindow.tabs.length > 0) {
            const blankTabId = newWindow.tabs[0].id;
            if (blankTabId !== undefined) {
              blankTabsToRemove.push(blankTabId);
            }
          }
        }
      } catch (error) {
        console.error('Failed to create window for windowIndex:', windowIndex, error);
      }
    }

    for (const tabSnapshot of sortedTabs) {
      try {
        const windowIndex = tabSnapshot.windowIndex ?? 0;
        const targetWindowId = windowIndexToNewWindowId.get(windowIndex);

        const newTab = await chrome.tabs.create({
          url: tabSnapshot.url,
          active: false,
          pinned: tabSnapshot.pinned,
          windowId: targetWindowId,
        });

        if (newTab.id !== undefined) {
          indexToNewTabId.set(tabSnapshot.index, newTab.id);
          restoringTabIds.add(newTab.id);
        }
      } catch (error) {
        console.error('Failed to create tab:', tabSnapshot.url, error);
      }
    }

    // 空白タブを削除
    for (const blankTabId of blankTabsToRemove) {
      try {
        await chrome.tabs.remove(blankTabId);
      } catch {
        // 既に閉じられている場合は無視
      }
    }

    // ツリー状態を更新
    await treeStateManager.loadState();
    const treeState = await storageService.get(STORAGE_KEYS.TREE_STATE);

    if (treeState) {
      const updatedNodes: Record<string, TabNode> = closeCurrentTabs
        ? {}
        : { ...treeState.nodes };
      const updatedTabToNode: Record<number, string> = closeCurrentTabs
        ? {}
        : { ...treeState.tabToNode };

      // 新しいノードを作成
      for (const [index, newTabId] of indexToNewTabId) {
        const snapshot = indexToSnapshot.get(index);
        if (!snapshot) continue;

        const nodeId = `node-${newTabId}`;
        let parentId: string | null = null;
        let depth = 0;

        if (snapshot.parentIndex !== null) {
          const parentTabId = indexToNewTabId.get(snapshot.parentIndex);
          if (parentTabId !== undefined) {
            parentId = `node-${parentTabId}`;
            const parentNode = updatedNodes[parentId];
            if (parentNode) {
              depth = parentNode.depth + 1;
            }
          }
        }

        const newNode: TabNode = {
          id: nodeId,
          tabId: newTabId,
          parentId,
          children: [],
          isExpanded: snapshot.isExpanded,
          depth,
          viewId: snapshot.viewId,
        };

        updatedNodes[nodeId] = newNode;
        updatedTabToNode[newTabId] = nodeId;
      }

      // 親子関係を構築（childrenを設定）
      for (const nodeId of Object.keys(updatedNodes)) {
        const node = updatedNodes[nodeId];
        if (node.parentId && updatedNodes[node.parentId]) {
          const parent = updatedNodes[node.parentId];
          const childExists = parent.children.some(c => c.id === nodeId);
          if (!childExists) {
            parent.children = [...parent.children, updatedNodes[nodeId]];
          }
        }
      }

      // ビューをマージ（既存ビューを保持しつつスナップショットのビューを追加）
      const existingViewIds = new Set(treeState.views.map(v => v.id));
      const mergedViews = [...treeState.views];
      for (const view of snapshotViews) {
        if (!existingViewIds.has(view.id)) {
          mergedViews.push(view);
        }
      }

      const updatedTreeState = {
        ...treeState,
        nodes: updatedNodes,
        tabToNode: updatedTabToNode,
        views: mergedViews,
      };

      await storageService.set(STORAGE_KEYS.TREE_STATE, updatedTreeState);

      // TreeStateManagerの内部状態を同期
      // handleRestoreSnapshotは直接ストレージに保存するため、
      // TreeStateManagerの内部状態と乖離が生じる
      // loadStateを呼び出して内部状態を同期させないと、
      // 後続のpersistState呼び出し（refreshTreeStructure等）で上書きされる
      await treeStateManager.loadState();
    }

    // 既存タブを閉じる（closeCurrentTabsがtrueの場合）
    // 新しいタブは上記のforループで全て作成済み（awaitで完了を待機している）
    if (closeCurrentTabs && existingTabIds.length > 0) {
      try {
        await chrome.tabs.remove(existingTabIds);
      } catch {
        // タブ削除失敗は無視（既に閉じられている可能性）
      }
    }

    // フラグをクリア
    restoringTabIds.clear();
    isRestoringSnapshot = false;

    // 状態更新を通知
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});

    sendResponse({ success: true, data: null });
  } catch (error) {
    isRestoringSnapshot = false;
    restoringTabIds.clear();
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

