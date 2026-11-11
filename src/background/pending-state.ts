/**
 * イベントハンドラー間で受け渡す、処理途中の状態
 */

/** 親子関係を指定して作成したタブ（作成したタブID → 親タブID） */
export const pendingTabParents = new Map<number, number>();

/** 複製を要求したタブの情報（複製元タブID → 複製元の情報） */
export const pendingDuplicateSources = new Map<number, { url: string; windowId: number; isSubtreeDuplicate: boolean }>();

/** リンクから開かれたタブ（作成されたタブID → リンク元タブID） */
export const pendingLinkClicks = new Map<number, number>();

/** スナップショット復元で作成中のタブ */
export const restoringTabIds = new Set<number>();

/** ウィンドウごとの直前のアクティブタブ */
export const lastActiveTabByWindow = new Map<number, number>();

/** ウィンドウを閉じる途中でChromeが別ウィンドウへ移したピン留めタブ（元のウィンドウID → タブID） */
export const detachedPinnedTabsByWindow = new Map<number, Set<number>>();

export const snapshotRestoreState = { inProgress: false };

