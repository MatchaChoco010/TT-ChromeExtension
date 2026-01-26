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
  duplicateTabPosition: 'nextSibling' as const,
};

/**
 * ストレージから読み込んだ設定に不足フィールドを補完する
 * Chrome再起動後に古い設定（新フィールドがない）が読み込まれた場合に対応
 */
function getSettingsWithDefaults(settings: UserSettings | null): {
  newTabPositionFromLink: 'child' | 'nextSibling' | 'lastSibling' | 'end';
  newTabPositionManual: 'child' | 'nextSibling' | 'lastSibling' | 'end';
  duplicateTabPosition: 'nextSibling' | 'end';
  childTabBehavior: 'promote' | 'close_all';
} {
  // 古い設定からのマイグレーション: 'sibling' -> 'nextSibling'
  const migratePosition = (pos: string | undefined, defaultValue: string): string => {
    if (pos === 'sibling') return 'nextSibling';
    return pos ?? defaultValue;
  };

  return {
    newTabPositionFromLink: migratePosition(settings?.newTabPositionFromLink, TAB_POSITION_DEFAULTS.newTabPositionFromLink) as 'child' | 'nextSibling' | 'lastSibling' | 'end',
    newTabPositionManual: migratePosition(settings?.newTabPositionManual, TAB_POSITION_DEFAULTS.newTabPositionManual) as 'child' | 'nextSibling' | 'lastSibling' | 'end',
    duplicateTabPosition: migratePosition(settings?.duplicateTabPosition, TAB_POSITION_DEFAULTS.duplicateTabPosition) as 'nextSibling' | 'end',
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

// globalThisにtreeStateManagerを登録してE2Eテストからアクセス可能にする
declare global {
  var treeStateManager: TreeStateManager;
}

globalThis.treeStateManager = treeStateManager;

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
 * E2Eテストのリセット処理（autoResetフィクスチャ）でのみ使用。
 * テスト間で状態をクリーンにリセットする際に呼び出す。
 *
 * 【背景】
 * Chromeはイベントリスナーの完了を待たないため、
 * ハンドラーがバックグラウンドで実行中のままリセットが始まる可能性がある
 *
 * 【警告: 利用制限】
 * この関数はE2Eテストのextension.ts内autoResetフィクスチャのリセット処理
 * 時のみに使用すること。以下の使用は禁止:
 *
 * - createTab, closeTab等のタブ操作関数内での状態同期待機
 * - 個別のテストケース内での直接呼び出し
 * - 本番コードからの呼び出し
 *
 * E2Eテストはユーザーの挙動を再現しUIの結果を検証するもの。
 * 内部状態（ハンドラー完了）への依存は本来のユーザー体験から乖離させ、
 * フレーキーさの原因となる。タブ操作後の状態確認は必ずassertTabStructure
 * 等のUI検証関数（Playwrightの自動リトライ機能を活用）を使用すること。
 */
async function prepareForReset(): Promise<void> {
  await waitForPendingHandlers();
  isCreatingGroupTab = false;
  isRestoringSnapshot = false;
  restoringTabIds.clear();
  lastActiveTabByWindow.clear();
  detachedPinnedTabsByWindow.clear();
  dragState = null;
}

let dragState: { tabId: number; treeData: TabNode[]; sourceWindowId: number } | null =
  null;

const pendingTabParents = new Map<number, number>();

const pendingDuplicateSources = new Map<number, { url: string; windowId: number; isSubtreeDuplicate: boolean }>();

const pendingGroupTabIds = new Set<number>();

let isCreatingGroupTab = false;

const lastActiveTabByWindow = new Map<number, number>();

const pendingLinkClicks = new Map<number, number>();

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
   * - Chromeタブとツリー状態の整合性を待機
   */
  function prepareForReset(): Promise<void>;
  /**
   * E2Eテスト用ハンドラー待機関数
   * 実行中の非同期ハンドラー（handleTabCreated等）の完了を待機
   */
  function waitForHandlers(): Promise<void>;
}
globalThis.pendingTabParents = pendingTabParents;
globalThis.pendingDuplicateSources = pendingDuplicateSources;
globalThis.pendingGroupTabIds = pendingGroupTabIds;
globalThis.pendingLinkClicks = pendingLinkClicks;
globalThis.treeStateManager = treeStateManager;
globalThis.prepareForReset = prepareForReset;
globalThis.waitForHandlers = waitForPendingHandlers;

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
  chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
    handleCreatedNavigationTarget(details);
  });
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
 * 自拡張機能のURLかどうかを判定
 *
 * chrome-extension://スキームで始まり、自分のextension IDを持つURLのみを判定する。
 * これにより、一般ページの同名ファイルとは区別される。
 */
function isOwnExtensionUrl(url: string | undefined, path: string): boolean {
  if (!url) return false;
  const extensionBaseUrl = `chrome-extension://${chrome.runtime.id}`;
  return url === `${extensionBaseUrl}/${path}` || url.startsWith(`${extensionBaseUrl}/${path}?`);
}

/**
 * グループタブ判定
 *
 * グループタブ（group.htmlを開くタブ）を検出する。
 * グループタブはhandleTabCreatedではスキップし、createGroupWithRealTabで処理される。
 */
function isGroupTabUrl(url: string | undefined): boolean {
  return isOwnExtensionUrl(url, 'group.html');
}

/**
 * サイドパネルタブ判定
 *
 * サイドパネル（sidepanel.htmlを開くタブ）を検出する。
 * サイドパネルは本来UIパネルであり、タブツリーには追加しない。
 * E2Eテストでは疑似サイドパネルとして通常タブで開かれるが、
 * 本物のサイドパネルと同様にTreeStateには含めない。
 */
function isSidePanelUrl(url: string | undefined): boolean {
  return isOwnExtensionUrl(url, 'sidepanel.html');
}

export async function handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) {
    return;
  }


  // 非同期操作の前にlastActiveTabByWindowをキャプチャ
  // onActivatedがmapを更新する前に値を取得する必要がある
  const capturedLastActiveTabId = tab.windowId !== undefined
    ? lastActiveTabByWindow.get(tab.windowId)
    : undefined;

  // Service Worker初期化中は初期化完了を待機
  // これにより、初期化完了前のタブ作成イベントが失われることを防ぐ
  const initialized = treeStateManager.isInitialized();
  if (!initialized) {
    const completed = await treeStateManager.waitForInitialization(15000);
    if (!completed) {
      throw new Error(`Initialization did not complete within timeout for tab ${tab.id}`);
    }
  }

  const existingNode = treeStateManager.getNodeByTabId(tab.id);
  if (existingNode) {
    return;
  }

  if (isCreatingGroupTab) {
    await new Promise(resolve => setTimeout(resolve, 50));
    if (pendingGroupTabIds.has(tab.id)) {
      pendingGroupTabIds.delete(tab.id);
      return;
    }
    const refreshedTab = await chrome.tabs.get(tab.id);
    if (isGroupTabUrl(refreshedTab.url) || isGroupTabUrl(refreshedTab.pendingUrl)) {
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

  if (isSidePanelUrl(tab.url) || isSidePanelUrl(tab.pendingUrl)) {
    return;
  }

  // URLが空またはabout:blankの場合、タブ情報を再取得して判定
  // タブ作成直後はURLがまだ設定されていない場合がある
  // context.newPage()でタブが作成された直後はpendingUrl=about:blankになる
  const isUrlIndeterminate = (!tab.url && !tab.pendingUrl) ||
    ((!tab.url || tab.url === 'about:blank') && (!tab.pendingUrl || tab.pendingUrl === 'about:blank'));
  if (isUrlIndeterminate) {
    // 実際のURLが設定されるまでポーリング（最大500ms）
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      try {
        const refreshedTab = await chrome.tabs.get(tab.id);
        // タブ情報が取得できない場合は続行（ユニットテストのモックはnullを返す）
        if (!refreshedTab) {
          break;
        }
        const actualUrl = refreshedTab.url || refreshedTab.pendingUrl || '';
        // about:blank以外のURLが設定された場合
        if (actualUrl && actualUrl !== 'about:blank') {
          if (isSidePanelUrl(refreshedTab.url) || isSidePanelUrl(refreshedTab.pendingUrl)) {
            return;
          }
          if (isGroupTabUrl(refreshedTab.url) || isGroupTabUrl(refreshedTab.pendingUrl)) {
            return;
          }
          break;
        }
      } catch {
        // タブが閉じられた場合はツリーに追加しない
        return;
      }
    }
  }

  // スナップショット復元中はスキップ（復元処理が直接ツリー状態を更新する）
  if (isRestoringSnapshot || restoringTabIds.has(tab.id)) {
    restoringTabIds.delete(tab.id);
    return;
  }

  // ピン留めタブはTreeStateに追加しない
  // ピン留めタブはpinnedTabIdsで別途管理される
  // ウィンドウが閉じられた時に移動されたピン留めタブはdetachedPinnedTabsByWindowで追跡されている
  const tabIdForCheck = tab.id;
  const isDetachedPinnedTab = Array.from(detachedPinnedTabsByWindow.values()).some(
    tabIds => tabIds.has(tabIdForCheck)
  );
  if (isDetachedPinnedTab) {
    return;
  }

  // ピン留めタブのチェック
  try {
    const currentTab = await chrome.tabs.get(tab.id);
    if (currentTab.pinned) {
      if (currentTab.windowId !== undefined) {
        // 既にピン留めタブとして存在する場合は追加しない（Chrome再起動時の重複防止）
        if (!treeStateManager.isPinnedTabInAnyView(tab.id, currentTab.windowId)) {
          treeStateManager.updatePinnedStateFromChromeEvent(tab.id, currentTab.windowId, true);
        }
      }
      return;
    }
  } catch {
    // タブが既に閉じられている場合は続行
  }

  // 移動されたピン留めタブの検出
  // ウィンドウが閉じられる時、Chromeはピン留めタブをアンピンして別のウィンドウに移動する
  // この場合、onCreatedイベントが発火するが、TreeStateに追加すべきではない
  if (tab.windowId !== undefined && !tab.openerTabId) {
    const allWindowStates = treeStateManager.getAllWindowStates();
    for (const windowState of allWindowStates) {
      if (windowState.windowId === tab.windowId) continue;
      const activeViewState = windowState.views[windowState.activeViewIndex];
      if (!activeViewState || activeViewState.pinnedTabIds.length === 0) continue;

      // このウィンドウがChromeにまだ存在するか確認
      try {
        await chrome.windows.get(windowState.windowId);
        // ウィンドウは存在する
      } catch {
        // ウィンドウが存在しない = 閉じられている途中
        // このウィンドウにピン留めタブがあった場合、それが移動された可能性がある
        try {
          await chrome.tabs.remove(tab.id);
        } catch {
          // タブが既に閉じられている場合は無視
        }
        return;
      }
    }
  }

  try {
    const rawSettings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
    const effectiveSettings = getSettingsWithDefaults(rawSettings);

    // ChromeのonCreatedイベントは常にopenerTabIdを含むとは限らないため、タブを再取得して確認する
    let openerTabIdFromChrome: number | undefined = tab.openerTabId;
    if (openerTabIdFromChrome === undefined) {
      try {
        const freshTab = await chrome.tabs.get(tab.id);
        openerTabIdFromChrome = freshTab?.openerTabId;
      } catch {
        // タブが既に閉じられている場合は無視
      }
    }

    const pendingOpenerTabId = pendingTabParents.get(tab.id);

    let newTabPosition: 'child' | 'nextSibling' | 'lastSibling' | 'end';

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

    let parentTabId: number | null = null;

    let isDuplicatedTab = false;
    let duplicateSourceTabId: number | null = null;
    let isSubtreeDuplicate = false;

    // 複製タブの検出: chrome.tabs.duplicate()はopenerTabIdが呼び出し元タブ（サイドパネル等）を
    // 指すことがあるため、URLとwindowIdで照合する
    const tabUrl = tab.url || tab.pendingUrl || '';
    for (const [sourceTabId, sourceInfo] of pendingDuplicateSources.entries()) {
      if (sourceInfo.url === tabUrl && sourceInfo.windowId === tab.windowId) {
        isDuplicatedTab = true;
        duplicateSourceTabId = sourceTabId;
        isSubtreeDuplicate = sourceInfo.isSubtreeDuplicate;
        pendingDuplicateSources.delete(sourceTabId);
        break;
      }
    }

    const duplicateTabPosition = effectiveSettings.duplicateTabPosition;

    let insertAfterTabId: number | undefined;
    if (isDuplicatedTab && duplicateSourceTabId !== null) {
      if (duplicateTabPosition === 'nextSibling') {
        const openerResult = treeStateManager.getNodeByTabId(duplicateSourceTabId);
        if (openerResult) {
          parentTabId = treeStateManager.getParentTabId(duplicateSourceTabId);
          insertAfterTabId = duplicateSourceTabId;
        }
      }
      // 'end'の場合はparentTabIdとinsertAfterTabIdを設定しない（ツリーの最後に追加される）
    } else if (isLinkClick && effectiveOpenerTabId && newTabPosition === 'child') {
      const parentResult = treeStateManager.getNodeByTabId(effectiveOpenerTabId);
      if (parentResult) {
        parentTabId = effectiveOpenerTabId;
      }
    } else if (isLinkClick && effectiveOpenerTabId && newTabPosition === 'nextSibling') {
      const openerResult = treeStateManager.getNodeByTabId(effectiveOpenerTabId);
      if (openerResult) {
        parentTabId = treeStateManager.getParentTabId(effectiveOpenerTabId);
        insertAfterTabId = effectiveOpenerTabId;
      }
    } else if (isLinkClick && effectiveOpenerTabId && newTabPosition === 'lastSibling') {
      const openerResult = treeStateManager.getNodeByTabId(effectiveOpenerTabId);
      if (openerResult) {
        parentTabId = treeStateManager.getParentTabId(effectiveOpenerTabId);
        insertAfterTabId = treeStateManager.getLastSiblingTabId(effectiveOpenerTabId);
      }
    } else if (!isLinkClick && pendingOpenerTabId) {
      // pendingOpenerTabIdが明示的に設定されている場合は、それを親として使用
      // (テストやAPIからのプログラム的なタブ作成でopenerTabIdが指定された場合)
      const parentResult = treeStateManager.getNodeByTabId(pendingOpenerTabId);
      if (parentResult) {
        parentTabId = pendingOpenerTabId;
      }
    } else if (!isLinkClick && newTabPosition === 'child') {
      // 手動で開かれたタブで'child'設定の場合、関数先頭でキャプチャした最後のアクティブタブを親とする
      if (capturedLastActiveTabId !== undefined && capturedLastActiveTabId !== tab.id) {
        const lastActiveResult = treeStateManager.getNodeByTabId(capturedLastActiveTabId);
        if (lastActiveResult) {
          parentTabId = capturedLastActiveTabId;
        }
      }
    } else if (!isLinkClick && newTabPosition === 'nextSibling') {
      // 手動で開かれたタブで'nextSibling'設定の場合、最後のアクティブタブの直後に配置
      if (capturedLastActiveTabId !== undefined && capturedLastActiveTabId !== tab.id) {
        const lastActiveResult = treeStateManager.getNodeByTabId(capturedLastActiveTabId);
        if (lastActiveResult) {
          parentTabId = treeStateManager.getParentTabId(capturedLastActiveTabId);
          insertAfterTabId = capturedLastActiveTabId;
        }
      }
    } else if (!isLinkClick && newTabPosition === 'lastSibling') {
      // 手動で開かれたタブで'lastSibling'設定の場合、兄弟の最後に配置
      if (capturedLastActiveTabId !== undefined && capturedLastActiveTabId !== tab.id) {
        const lastActiveResult = treeStateManager.getNodeByTabId(capturedLastActiveTabId);
        if (lastActiveResult) {
          parentTabId = treeStateManager.getParentTabId(capturedLastActiveTabId);
          insertAfterTabId = treeStateManager.getLastSiblingTabId(capturedLastActiveTabId);
        }
      }
    }

    if (pendingOpenerTabId) {
      pendingTabParents.delete(tab.id);
    }

    // 通常複製（サブツリー複製ではない）の場合、タブの移動はuseMenuActionsで既に行われている
    const isNormalDuplicate = isDuplicatedTab && !isSubtreeDuplicate;

    await treeStateManager.addTab(tab, parentTabId, tab.windowId!, undefined, insertAfterTabId);

    // 親ノードを自動展開（新しい子タブを見えるようにするため）
    // ただし複製タブの場合はスキップ:
    // - 単一タブ複製: 元のタブが見えている=親は既に展開済み
    // - サブツリー複製: handleDuplicateSubtreeが後で親子関係を修正する
    //   この時点で展開すると、元のタブの折りたたみ状態が壊れる
    if (parentTabId && !isDuplicatedTab) {
      await treeStateManager.expandNode(parentTabId);
    }

    if (!tab.active && tab.id) {
      await unreadTracker.markAsUnread(tab.id);
    }

    // ツリー状態をChromeタブに同期
    // 通常複製の場合はuseMenuActionsで既に正しい位置に移動済みなのでスキップ
    if (!isNormalDuplicate) {
      await treeStateManager.syncTreeStateToChromeTabs();
    }

    treeStateManager.notifyStateChanged();
  } catch (error) {
    console.error('[handleTabCreated] Error:', error);
  }
}

export async function handleTabRemoved(
  tabId: number,
  removeInfo: chrome.tabs.OnRemovedInfo,
): Promise<void> {
  const { isWindowClosing } = removeInfo;

  // ウィンドウが閉じられる場合はツリー状態を保持する
  // これにより、ブラウザ再起動時にtreeStructureからビュー情報を含む状態を復元できる
  if (isWindowClosing) {
    // ウィンドウ閉鎖時はunreadとtitleのみクリア（ツリー状態は保持）
    if (unreadTracker.isUnread(tabId)) {
      await unreadTracker.markAsRead(tabId);
    }
    titlePersistence.removeTitle(tabId);
    treeStateManager.notifyStateChanged();
    return;
  }

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

  // syncTreeStateToChromeTabs内でcloseEmptyWindowsが呼ばれ、空ウィンドウが自動クローズされる
  await treeStateManager.syncTreeStateToChromeTabs();

  treeStateManager.notifyStateChanged();
}

export async function handleTabMoved(
  tabId: number,
  moveInfo: chrome.tabs.OnMovedInfo,
): Promise<void> {
  // ピン留め操作時のスキップ判定
  // ピン留め操作時はonMoved→onUpdatedの順でイベントが発火し、
  // onMovedの時点ではTreeStateにピン留め状態が反映されていないため、
  // syncTreeStateToChrobeTabsがタブをunpinしてしまう
  // ただし、既にTreeStateでピン留めされているタブの移動は通常通り同期する
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.pinned && tab.windowId !== undefined) {
      // TreeStateでピン留めされているか確認
      const isPinnedInTreeState = treeStateManager.isPinnedTabInAnyView(tabId, tab.windowId);
      if (!isPinnedInTreeState) {
        // ピン留め操作中（TreeStateにまだ反映されていない）なのでスキップ
        treeStateManager.notifyStateChanged();
        return;
      }
      // 既にピン留めされているタブの移動は下で通常通り同期される
    }
  } catch {
    // タブが存在しない場合は続行
  }

  // ツリービューが常に正。Chromeのタブ順序変更はツリーに反映せず、
  // ツリー状態をChromeに再同期して元に戻す
  try {
    await treeStateManager.syncTreeStateToChromeTabs(moveInfo.windowId);
  } catch {
    // 同期失敗は無視
  }
  treeStateManager.notifyStateChanged();
}

export async function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo,
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

    // ピン留め状態の変更をTreeStateManagerに反映
    if (changeInfo.pinned !== undefined && tab.windowId !== undefined) {
      treeStateManager.updatePinnedStateFromChromeEvent(tabId, tab.windowId, changeInfo.pinned);
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
      treeStateManager.notifyStateChanged();
    }
  } catch {
    // タブ更新処理失敗は無視
  }
}

async function handleTabActivated(activeInfo: chrome.tabs.OnActivatedInfo): Promise<void> {
  try {
    // 'child'設定の手動タブ作成時に親を決定するために記録
    lastActiveTabByWindow.set(activeInfo.windowId, activeInfo.tabId);

    if (unreadTracker.isUnread(activeInfo.tabId)) {
      await unreadTracker.markAsRead(activeInfo.tabId);

      treeStateManager.notifyStateChanged();
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
  detachInfo: chrome.tabs.OnDetachedInfo,
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

    treeStateManager.notifyStateChanged();
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
  attachInfo: chrome.tabs.OnAttachedInfo,
): Promise<void> {
  // ピン留めタブ（detachされたもの）は通常のタブ移動処理をスキップ
  // handleWindowRemovedで閉じられるか、ユーザーによる移動の場合は除外処理される
  const isDetachedPinnedTab = Array.from(detachedPinnedTabsByWindow.values()).some(
    tabIds => tabIds.has(tabId)
  );

  if (!isDetachedPinnedTab) {
    // 親タブが同じウィンドウに存在するか確認
    const parentTabId = await treeStateManager.getParentTabId(tabId);
    let parentInSameWindow = false;

    if (parentTabId !== null) {
      try {
        const parentTab = await chrome.tabs.get(parentTabId);
        parentInSameWindow = parentTab.windowId === attachInfo.newWindowId;
      } catch {
        // 親タブが存在しない場合は無視
      }
    }

    // 親タブが同じウィンドウにない場合のみ、新しいウィンドウのルートノードの最後尾に移動
    if (!parentInSameWindow) {
      await treeStateManager.moveTabToRootEnd(tabId, attachInfo.newWindowId);
    }

    // ツリービューが常に正。ツリー状態をChromeに再同期
    await treeStateManager.syncTreeStateToChromeTabs(attachInfo.newWindowId);
  }

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

  // ツリービューが常に正。Chromeのタブ順序変更はツリーに反映しない
  treeStateManager.notifyStateChanged();
}

/**
 * タブが置き換えられたときのハンドラ
 * chrome.tabs.discard()でタブIDが変わる場合に発火する
 */
async function handleTabReplaced(
  addedTabId: number,
  removedTabId: number,
): Promise<void> {
  await treeStateManager.replaceTabId(removedTabId, addedTabId);
  treeStateManager.notifyStateChanged();
}

async function handleWindowCreated(_window: chrome.windows.Window): Promise<void> {
  // ウィンドウ作成時は特別な処理不要
  // タブが追加されるときにgetOrCreateWindowStateでウィンドウも自動作成される
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

    // ウィンドウ状態を削除（pinnedTabIdsも削除される）
    await treeStateManager.removeWindow(windowId);

    // TreeStateに存在しないタブを閉じる
    // ウィンドウクローズ時にChromeが自動的に移動したピン留めタブは
    // TreeStateには存在しないため、ここで閉じられる
    await treeStateManager.syncTreeStateToChromeTabs();

    treeStateManager.notifyStateChanged();
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
        trackHandler(() => handleCreateWindowWithSubtree(message.payload.tabId, sendResponse));
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
        trackHandler(() => handleCreateGroup(message.payload.tabIds, message.payload.groupName, message.payload.contextMenuTabId, sendResponse));
        break;

      case 'DISSOLVE_GROUP':
        trackHandler(() => handleDissolveGroup(message.payload.tabIds, sendResponse));
        break;

      case 'UPDATE_GROUP_NAME':
        trackHandler(() => handleUpdateGroupName(message.payload.tabId, message.payload.name, sendResponse));
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

      case 'CLOSE_OTHER_TABS':
        trackHandler(() => handleCloseOtherTabs(message.payload.excludeTabIds, sendResponse));
        break;

      case 'DUPLICATE_TABS':
        trackHandler(() => handleDuplicateTabs(message.payload.tabIds, sendResponse));
        break;

      case 'PIN_TABS':
        trackHandler(() => handlePinTabs(message.payload.tabIds, sendResponse));
        break;

      case 'UNPIN_TABS':
        trackHandler(() => handleUnpinTabs(message.payload.tabIds, sendResponse));
        break;

      case 'MOVE_TABS_TO_NEW_WINDOW':
        trackHandler(() => handleMoveTabsToNewWindow(message.payload.tabIds, sendResponse));
        break;

      case 'RELOAD_TABS':
        trackHandler(() => handleReloadTabs(message.payload.tabIds, sendResponse));
        break;

      case 'DISCARD_TABS':
        trackHandler(() => handleDiscardTabs(message.payload.tabIds, sendResponse));
        break;

      case 'REORDER_PINNED_TAB':
        trackHandler(() => handleReorderPinnedTab(message.payload.tabId, message.payload.newIndex, sendResponse));
        break;

      case 'MOVE_NODE':
        trackHandler(() => handleMoveNode(
          message.payload.tabId,
          message.payload.targetParentTabId,
          message.payload.windowId,
          message.payload.selectedTabIds,
          sendResponse
        ));
        break;

      case 'MOVE_NODE_AS_SIBLING':
        trackHandler(() => handleMoveNodeAsSibling(
          message.payload.tabId,
          message.payload.aboveTabId,
          message.payload.belowTabId,
          message.payload.windowId,
          message.payload.selectedTabIds,
          sendResponse
        ));
        break;

      case 'SWITCH_VIEW':
        trackHandler(() => handleSwitchView(
          message.payload.viewIndex,
          message.payload.windowId,
          message.payload.previousViewIndex,
          message.payload.activeTabId,
          sendResponse
        ));
        break;

      case 'CREATE_VIEW':
        trackHandler(() => handleCreateView(message.payload.windowId, sendResponse));
        break;

      case 'DELETE_VIEW':
        trackHandler(() => handleDeleteView(message.payload.windowId, message.payload.viewIndex, sendResponse));
        break;

      case 'UPDATE_VIEW':
        trackHandler(() => handleUpdateView(
          message.payload.windowId,
          message.payload.viewIndex,
          message.payload.updates,
          sendResponse
        ));
        break;

      case 'TOGGLE_NODE_EXPAND':
        trackHandler(() => handleToggleNodeExpand(
          message.payload.tabId,
          message.payload.windowId,
          sendResponse
        ));
        break;

      case 'MOVE_TABS_TO_VIEW':
        trackHandler(() => handleMoveTabsToView(
          message.payload.windowId,
          message.payload.targetViewIndex,
          message.payload.tabIds,
          sendResponse
        ));
        break;

      case 'DELETE_TREE_GROUP':
        trackHandler(() => handleDeleteTreeGroup(
          message.payload.tabId,
          message.payload.windowId,
          sendResponse
        ));
        break;

      case 'ADD_TAB_TO_TREE_GROUP':
        trackHandler(() => handleAddTabToTreeGroup(
          message.payload.tabId,
          message.payload.targetGroupTabId,
          message.payload.windowId,
          sendResponse
        ));
        break;

      case 'REMOVE_TAB_FROM_TREE_GROUP':
        trackHandler(() => handleRemoveTabFromTreeGroup(
          message.payload.tabId,
          message.payload.windowId,
          sendResponse
        ));
        break;

      case 'SAVE_GROUPS':
        trackHandler(() => handleSaveGroups(message.payload.groups, sendResponse));
        break;

      case 'SAVE_USER_SETTINGS':
        trackHandler(() => handleSaveUserSettings(message.payload.settings, sendResponse));
        break;

      case 'CREATE_NEW_TAB':
        trackHandler(() => handleCreateNewTab(sendResponse));
        break;

      case 'OPEN_SETTINGS_TAB':
        trackHandler(() => handleOpenSettingsTab(sendResponse));
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
    const state = treeStateManager.toJSON();
    sendResponse({ success: true, data: state });
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

    // nodeIdはtabId（文字列として渡される）
    const tabId = parseInt(nodeId, 10);
    const newParentTabId = newParentId !== null ? parseInt(newParentId, 10) : null;

    await treeStateManager.moveNode(tabId, newParentTabId, index);

    treeStateManager.notifyStateChanged();

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
    const allTabIdsToClose = new Set<number>();

    for (const tabId of tabIds) {
      const nodeResult = treeStateManager.getNodeByTabId(tabId);
      if (!nodeResult) {
        // ノードが見つからない場合でもタブIDを追加
        allTabIdsToClose.add(tabId);
        continue;
      }

      // expanded: falseで子要素がある場合はサブツリー全体を閉じる
      if (!nodeResult.node.isExpanded && nodeResult.node.children.length > 0) {
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

async function handleMoveTabToWindow(
  tabId: number,
  windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.moveTabToWindow(tabId, windowId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleCreateWindowWithTab(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.createWindowWithTab(tabId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * サブツリー全体で新しいウィンドウを作成
 * パネル外へのドロップで新しいウィンドウを作成し、サブツリー全体を移動
 * createWindowWithSubtree内でsyncTreeStateToChromeTabs→closeEmptyWindowsが呼ばれ、空ウィンドウが自動クローズされる
 */
async function handleCreateWindowWithSubtree(
  tabId: number,
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

    const newWindowId = await treeStateManager.createWindowWithSubtree(tabId);

    if (newWindowId === undefined) {
      sendResponse({
        success: false,
        error: 'Failed to create window',
      });
      return;
    }

    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
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

    await treeStateManager.moveSubtreeToWindow(tabId, windowId);
    treeStateManager.notifyStateChanged();
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
    // ユーザー設定を取得してrestoreStateAfterRestartに渡す
    const rawSettings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
    const syncSettings = {
      newTabPositionManual: rawSettings?.newTabPositionManual ?? 'end' as const,
    };
    await treeStateManager.restoreStateAfterRestart(syncSettings);
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
 * また、内部ツリーの順序をChromeタブに反映する。
 */
async function handleRefreshTreeStructure(
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.refreshTreeStructure();
    await treeStateManager.syncTreeStateToChromeTabs();

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
  groupName: string | undefined,
  contextMenuTabId: number | undefined,
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

    // コンテキストメニューを開いたタブの情報を取得
    const targetTabId = contextMenuTabId ?? tabIds[0];
    let windowId: number | undefined;
    let targetTabIndex: number | undefined;
    try {
      const targetTab = await chrome.tabs.get(targetTabId);
      windowId = targetTab.windowId;
      targetTabIndex = targetTab.index;
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
    if (targetTabIndex !== undefined) {
      createOptions.index = targetTabIndex;
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

    const groupPageUrl = `chrome-extension://${chrome.runtime.id}/group.html`;
    await chrome.tabs.update(groupTab.id, { url: groupPageUrl });

    await treeStateManager.createGroupWithRealTab(groupTab.id, tabIds, groupName ?? 'グループ', windowId!, targetTabId);

    await chrome.tabs.update(groupTab.id, { active: true });

    treeStateManager.notifyStateChanged();

    sendResponse({ success: true, data: { groupTabId: groupTab.id } });
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

    await treeStateManager.dissolveGroup(tabIds[0]);

    treeStateManager.notifyStateChanged();

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * グループ名更新
 */
async function handleUpdateGroupName(
  tabId: number,
  name: string,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const updated = await treeStateManager.updateGroupName(tabId, name || 'グループ');
    if (!updated) {
      sendResponse({
        success: false,
        error: 'Group not found',
      });
      return;
    }

    treeStateManager.notifyStateChanged();

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
    const subtree = treeStateManager.getSubtree(tabId);
    if (subtree.length === 0) {
      sendResponse({
        success: false,
        error: 'Tab not found',
      });
      return;
    }

    const oldTabIdToNewTabId = new Map<number, number>();

    for (const node of subtree) {
      const sourceTab = await chrome.tabs.get(node.tabId);
      pendingDuplicateSources.set(node.tabId, {
        url: sourceTab.url || '',
        windowId: sourceTab.windowId,
        isSubtreeDuplicate: true,
      });
      const duplicatedTab = await chrome.tabs.duplicate(node.tabId);
      if (duplicatedTab?.id) {
        oldTabIdToNewTabId.set(node.tabId, duplicatedTab.id);
      }
    }

    // すべての複製タブがtree_stateに追加されるまでポーリングで待機
    const newTabIds = Array.from(oldTabIdToNewTabId.values());
    const maxIterations = 100;
    for (let i = 0; i < maxIterations; i++) {
      const allTabsInTree = newTabIds.every(tid =>
        treeStateManager.getNodeByTabId(tid) !== null
      );
      if (allTabsInTree) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const rootNode = subtree[0];
    const rootNewTabId = oldTabIdToNewTabId.get(rootNode.tabId);
    const rootNewNodeResult = rootNewTabId ? treeStateManager.getNodeByTabId(rootNewTabId) : null;
    const originalRootNodeResult = treeStateManager.getNodeByTabId(rootNode.tabId);

    if (rootNewNodeResult && originalRootNodeResult) {
      // ルートの複製タブを元のタブの兄弟として配置
      const originalParentTabId = treeStateManager.getParentTabId(rootNode.tabId);
      if (originalParentTabId !== null) {
        // 元のタブが親を持つ場合、複製タブも同じ親の子として配置（元のタブの直後）
        const originalSiblingIndex = treeStateManager.getSiblingIndex(rootNode.tabId);
        await treeStateManager.moveNode(rootNewTabId!, originalParentTabId, originalSiblingIndex + 1);
      }

      // 元のルートノードの展開状態を複製ノードにコピー
      if (!originalRootNodeResult.node.isExpanded) {
        await treeStateManager.toggleExpand(rootNewTabId!);
      }

      // 子孫タブを複製元のツリー構造に合わせて配置
      for (let i = 1; i < subtree.length; i++) {
        const originalNode = subtree[i];
        const newTabId = oldTabIdToNewTabId.get(originalNode.tabId);
        if (!newTabId) continue;

        // 元のノードの親tabIdを取得
        const originalParentTabId2 = treeStateManager.getParentTabId(originalNode.tabId);
        if (originalParentTabId2 !== null) {
          // 元の親に対応する新しい親タブを見つける
          const newParentTabId = oldTabIdToNewTabId.get(originalParentTabId2);
          if (newParentTabId) {
            await treeStateManager.moveNode(newTabId, newParentTabId, -1);
          }
        }
      }
    }

    treeStateManager.notifyStateChanged();
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
        if (newWindow && newWindow.id !== undefined) {
          windowIndexToNewWindowId.set(windowIndex, newWindow.id);
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

    // ツリー状態を更新（TreeStateManager経由）
    await treeStateManager.restoreTreeStateFromSnapshot(
      snapshotViews,
      indexToNewTabId,
      indexToSnapshot,
      closeCurrentTabs,
      windowIndexToNewWindowId
    );

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
    treeStateManager.notifyStateChanged();

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

async function handleCloseOtherTabs(
  excludeTabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const excludeSet = new Set(excludeTabIds);
    const tabsToClose = tabs
      .filter(tab => tab.id !== undefined && !excludeSet.has(tab.id))
      .map(tab => tab.id as number);

    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
    }

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleDuplicateTabs(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    for (const tabId of tabIds) {
      const tab = await chrome.tabs.get(tabId);
      pendingDuplicateSources.set(tabId, {
        url: tab.url || tab.pendingUrl || '',
        windowId: tab.windowId,
        isSubtreeDuplicate: false,
      });
      await chrome.tabs.duplicate(tabId);
    }
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handlePinTabs(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    // タブの情報を取得してウィンドウIDを特定
    const tabsByWindow = new Map<number, number[]>();
    for (const tabId of tabIds) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.windowId !== undefined) {
          const windowTabs = tabsByWindow.get(tab.windowId) ?? [];
          windowTabs.push(tabId);
          tabsByWindow.set(tab.windowId, windowTabs);
        }
      } catch {
        // タブが存在しない場合は無視
      }
    }

    // 各ウィンドウのピン留めタブをTreeStateManagerに登録
    for (const [windowId, windowTabIds] of tabsByWindow) {
      await treeStateManager.pinTabs(windowTabIds, windowId);
    }

    // Chromeタブに同期
    await treeStateManager.syncTreeStateToChromeTabs();
    treeStateManager.notifyStateChanged();

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleUnpinTabs(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    // タブの情報を取得してウィンドウIDを特定
    const tabsByWindow = new Map<number, number[]>();
    for (const tabId of tabIds) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.windowId !== undefined) {
          const windowTabs = tabsByWindow.get(tab.windowId) ?? [];
          windowTabs.push(tabId);
          tabsByWindow.set(tab.windowId, windowTabs);
        }
      } catch {
        // タブが存在しない場合は無視
      }
    }

    // 各ウィンドウからピン留めを解除
    for (const [windowId, windowTabIds] of tabsByWindow) {
      await treeStateManager.unpinTabs(windowTabIds, windowId);
    }

    // Chromeタブに同期
    await treeStateManager.syncTreeStateToChromeTabs();
    treeStateManager.notifyStateChanged();

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleMoveTabsToNewWindow(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    if (tabIds.length === 0) {
      sendResponse({ success: true, data: null });
      return;
    }

    const newWindowId = await treeStateManager.moveTabsToNewWindow(tabIds);
    if (newWindowId === undefined) {
      sendResponse({
        success: false,
        error: 'Failed to create new window',
      });
      return;
    }

    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleReloadTabs(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    for (const tabId of tabIds) {
      await chrome.tabs.reload(tabId);
    }
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleDiscardTabs(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const activeTab = tabs.find(tab => tab.active);
    const tabIdSet = new Set(tabIds);

    // アクティブタブは休止できないため、先に別のタブをアクティブにする
    if (activeTab?.id && tabIdSet.has(activeTab.id)) {
      const alternativeTab = tabs.find(tab =>
        tab.id &&
        !tabIdSet.has(tab.id) &&
        !tab.discarded &&
        !tab.pinned
      );

      const alternativeTabWithPinned = alternativeTab ?? tabs.find(tab =>
        tab.id &&
        !tabIdSet.has(tab.id) &&
        !tab.discarded
      );

      if (alternativeTabWithPinned?.id) {
        await chrome.tabs.update(alternativeTabWithPinned.id, { active: true });
      }
    }

    for (const tabId of tabIds) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab.active) {
          await chrome.tabs.discard(tabId);
        }
      } catch {
        // タブが既に休止されている場合などはエラーを無視
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

async function handleReorderPinnedTab(
  tabId: number,
  newIndex: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    // タブのウィンドウIDを取得
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId === undefined) {
      sendResponse({ success: false, error: 'Tab has no window' });
      return;
    }

    // TreeStateManagerのピン留めタブ順序を更新
    await treeStateManager.reorderPinnedTab(tabId, newIndex, tab.windowId);

    // Chromeタブに同期
    await treeStateManager.syncTreeStateToChromeTabs();
    treeStateManager.notifyStateChanged();

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reorder pinned tab',
    });
  }
}

/**
 * ノードを指定した親の子として移動（D&Dの子としてドロップ）
 */
async function handleMoveNode(
  tabId: number,
  targetParentTabId: number | null,
  _windowId: number,
  selectedTabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.moveNodeToParent(tabId, targetParentTabId, selectedTabIds);
    await treeStateManager.syncTreeStateToChromeTabs();
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * ノードを兄弟として指定位置に挿入（D&DのGapドロップ）
 */
async function handleMoveNodeAsSibling(
  tabId: number,
  aboveTabId: number | undefined,
  belowTabId: number | undefined,
  _windowId: number,
  selectedTabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.moveNodeAsSibling(tabId, aboveTabId, belowTabId, selectedTabIds);
    await treeStateManager.syncTreeStateToChromeTabs();
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * ビューを切り替え
 */
async function handleSwitchView(
  viewIndex: number,
  windowId: number,
  _previousViewIndex: number,
  _activeTabId: number | null,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.switchView(windowId, viewIndex);
    await treeStateManager.syncTreeStateToChromeTabs(windowId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * ビューを作成
 */
async function handleCreateView(
  windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const newViewIndex = await treeStateManager.createViewWithAutoColor(windowId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: { viewIndex: newViewIndex } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * ビューを削除
 */
async function handleDeleteView(
  windowId: number,
  viewIndex: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.deleteView(windowId, viewIndex);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * ビューを更新
 */
async function handleUpdateView(
  windowId: number,
  viewIndex: number,
  updates: { name?: string; color?: string; icon?: string },
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.updateView(windowId, viewIndex, updates);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * ノードの展開状態を切り替え
 */
async function handleToggleNodeExpand(
  tabId: number,
  _windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.toggleExpand(tabId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * タブを別のビューに移動
 */
async function handleMoveTabsToView(
  windowId: number,
  targetViewIndex: number,
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.moveTabsToViewInternal(tabIds, windowId, targetViewIndex);
    await treeStateManager.syncTreeStateToChromeTabs(windowId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * ツリーグループを削除
 */
async function handleDeleteTreeGroup(
  tabId: number,
  _windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.deleteTreeGroup(tabId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * タブをツリーグループに追加
 */
async function handleAddTabToTreeGroup(
  tabId: number,
  targetGroupTabId: number,
  _windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.addTabToTreeGroup(tabId, targetGroupTabId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * タブをツリーグループから削除
 */
async function handleRemoveTabFromTreeGroup(
  tabId: number,
  _windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.removeTabFromTreeGroup(tabId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * グループ情報を保存
 * Side Panelからのchrome.storage.local.set呼び出しをServiceWorker経由に集約
 */
async function handleSaveGroups(
  groups: Record<string, { id: string; name: string; color: string; isExpanded: boolean }>,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await storageService.set(STORAGE_KEYS.GROUPS, groups);
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * ユーザー設定を保存
 * Side Panelからのchrome.storage.local.set呼び出しをServiceWorker経由に集約
 */
async function handleSaveUserSettings(
  settings: UserSettings,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await storageService.set(STORAGE_KEYS.USER_SETTINGS, settings);
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleCreateNewTab(
  sendResponse: (response: MessageResponse<{ tabId: number }>) => void,
): Promise<void> {
  try {
    const tab = await chrome.tabs.create({
      active: true,
      url: 'chrome://vivaldi-webui/startpage',
    });
    sendResponse({ success: true, data: { tabId: tab.id ?? -1 } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleOpenSettingsTab(
  sendResponse: (response: MessageResponse<{ tabId: number }>) => void,
): Promise<void> {
  try {
    const settingsUrl = chrome.runtime.getURL('settings.html');
    const tab = await chrome.tabs.create({ url: settingsUrl });
    sendResponse({ success: true, data: { tabId: tab.id ?? -1 } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
