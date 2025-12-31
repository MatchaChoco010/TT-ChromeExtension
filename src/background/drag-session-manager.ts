/**
 * DragSessionManager - Service Worker level drag session management
 *
 * Task 13.1: DragSessionManagerの実装
 * Requirements: 6.1, 6.2, 6.3, 6.6, 6.7
 *
 * クロスウィンドウドラッグのための状態マシンによる排他制御を実装
 */

import type { TabNode } from '@/types';

/**
 * ドラッグセッションの状態
 */
export type DragSessionState =
  | 'idle'
  | 'pending_drag'
  | 'dragging_local'
  | 'pending_cross_window'
  | 'dragging_cross_window'
  | 'dropped_local'
  | 'dropped_external';

/**
 * ドラッグセッション
 */
export interface DragSession {
  /** セッションID（一意識別子） */
  sessionId: string;
  /** ドラッグ中のタブID */
  tabId: number;
  /** 現在のセッション状態 */
  state: DragSessionState;
  /** ドラッグを開始したウィンドウID */
  sourceWindowId: number;
  /** 現在のウィンドウID（クロスウィンドウ移動後は変わる） */
  currentWindowId: number;
  /** セッション開始タイムスタンプ */
  startedAt: number;
  /** 最終更新タイムスタンプ */
  updatedAt: number;
  /** タブのツリーデータ（サブツリー含む） */
  treeData: TabNode[];
  /** ロック状態（tabs.move中はtrue） */
  isLocked: boolean;
}

/**
 * セッション操作のエラー
 */
export type DragSessionError =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_LOCKED'
  | 'INVALID_STATE_TRANSITION'
  | 'TAB_NOT_FOUND'
  | 'WINDOW_NOT_FOUND'
  | 'TIMEOUT';

/**
 * DragSessionManager - クロスウィンドウドラッグのセッション管理
 *
 * 状態マシンによる排他制御で、タイミング問題を解決する
 */
export class DragSessionManager {
  private session: DragSession | null = null;
  private readonly SESSION_TIMEOUT_MS = 10000; // 10秒でタイムアウト
  private readonly CROSS_WINDOW_TIMEOUT_MS = 2000; // クロスウィンドウ移動は2秒
  private readonly KEEP_ALIVE_ALARM_NAME = 'drag-session-keep-alive';
  private timeoutCheckInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * コンストラクタ
   */
  constructor() {
    // タイムアウトチェックの開始は startTimeoutCheck で行う
    // Service Worker起動時に自動で呼び出される
  }

  /**
   * タイムアウト監視を開始
   * Service Worker起動時に呼び出す
   */
  startTimeoutCheck(): void {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
    }

    this.timeoutCheckInterval = setInterval(() => {
      this.checkSessionTimeout();
    }, 500);
  }

  /**
   * タイムアウト監視を停止
   */
  stopTimeoutCheck(): void {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = null;
    }
  }

  /**
   * セッションのタイムアウトをチェック
   */
  private checkSessionTimeout(): void {
    if (!this.session) return;

    const elapsed = Date.now() - this.session.updatedAt;

    // pending_cross_window状態が長すぎる場合
    if (
      this.session.state === 'pending_cross_window' &&
      elapsed > this.CROSS_WINDOW_TIMEOUT_MS
    ) {
      console.warn(
        '[DragSession] Cross-window move timeout, reverting to local drag',
      );
      this.session.state = 'dragging_local';
      this.session.isLocked = false;
      this.session.updatedAt = Date.now();
    }

    // 全体のタイムアウト
    if (elapsed > this.SESSION_TIMEOUT_MS) {
      console.warn('[DragSession] Session timeout, ending session');
      void this.endSession('TIMEOUT');
    }
  }

  /**
   * UUIDを生成（crypto.randomUUIDが使えない環境用のフォールバック付き）
   */
  private generateSessionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // フォールバック: 簡易UUID生成
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }

  /**
   * ドラッグセッションを開始
   *
   * @param tabId - ドラッグ中のタブID
   * @param windowId - ドラッグを開始したウィンドウID
   * @param treeData - タブのツリーデータ（サブツリー含む）
   * @returns 開始されたセッション
   */
  async startSession(
    tabId: number,
    windowId: number,
    treeData: TabNode[],
  ): Promise<DragSession> {
    // 既存セッションがあれば終了
    if (this.session) {
      await this.endSession('SESSION_REPLACED');
    }

    const now = Date.now();
    this.session = {
      sessionId: this.generateSessionId(),
      tabId,
      state: 'dragging_local',
      sourceWindowId: windowId,
      currentWindowId: windowId,
      startedAt: now,
      updatedAt: now,
      treeData,
      isLocked: false,
    };

    // keep-aliveアラームを開始（Service Workerを維持）
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      try {
        await chrome.alarms.create(this.KEEP_ALIVE_ALARM_NAME, {
          periodInMinutes: 0.4, // 24秒間隔
        });
      } catch (_error) {
        // アラーム作成に失敗しても続行
      }
    }

    console.log(`[DragSession] Started: ${this.session.sessionId}`);
    return this.session;
  }

  /**
   * クロスウィンドウ移動を開始（排他制御付き）
   *
   * @param targetWindowId - 移動先のウィンドウID
   * @throws DragSessionError - セッションがない、ロック中、または無効な状態遷移の場合
   */
  async beginCrossWindowMove(targetWindowId: number): Promise<void> {
    if (!this.session) {
      throw new Error('SESSION_NOT_FOUND');
    }
    if (this.session.isLocked) {
      throw new Error('SESSION_LOCKED');
    }

    // 状態遷移の検証
    if (
      this.session.state !== 'dragging_local' &&
      this.session.state !== 'dragging_cross_window'
    ) {
      throw new Error('INVALID_STATE_TRANSITION');
    }

    // ロックを取得
    this.session.isLocked = true;
    this.session.state = 'pending_cross_window';
    this.session.updatedAt = Date.now();

    try {
      // タブを移動（実際のChrome API呼び出し）
      await chrome.tabs.move(this.session.tabId, {
        windowId: targetWindowId,
        index: -1, // 末尾に追加
      });

      // 移動成功：状態更新
      this.session.currentWindowId = targetWindowId;
      this.session.state = 'dragging_cross_window';
    } catch (error) {
      // 移動失敗：元の状態に戻す
      this.session.state = 'dragging_local';
      throw error;
    } finally {
      // ロック解除
      this.session.isLocked = false;
      this.session.updatedAt = Date.now();
    }
  }

  /**
   * セッション情報を取得（ロック中は待機）
   *
   * @param maxWaitMs - 最大待機時間（デフォルト: 500ms）
   * @returns セッション情報、または待機タイムアウト時はnull
   */
  async getSession(maxWaitMs: number = 500): Promise<DragSession | null> {
    const startTime = Date.now();

    while (this.session?.isLocked) {
      if (Date.now() - startTime > maxWaitMs) {
        return null; // タイムアウト
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return this.session;
  }

  /**
   * セッション情報を即座に取得（待機なし）
   *
   * @returns 現在のセッション情報
   */
  getSessionImmediate(): DragSession | null {
    return this.session;
  }

  /**
   * セッションの状態を更新
   *
   * @param state - 新しい状態
   */
  updateSessionState(state: DragSessionState): void {
    if (!this.session) return;

    this.session.state = state;
    this.session.updatedAt = Date.now();
  }

  /**
   * セッション終了
   *
   * @param reason - 終了理由
   */
  async endSession(reason: string = 'COMPLETED'): Promise<void> {
    if (this.session) {
      console.log(
        `[DragSession] Ended: ${this.session.sessionId}, reason: ${reason}`,
      );

      // keep-aliveアラームをクリア
      if (typeof chrome !== 'undefined' && chrome.alarms) {
        try {
          await chrome.alarms.clear(this.KEEP_ALIVE_ALARM_NAME);
        } catch (_error) {
          // アラームクリアに失敗しても続行
        }
      }

      this.session = null;
    }
  }

  /**
   * ウィンドウクローズ時のクリーンアップ
   *
   * @param windowId - クローズされたウィンドウID
   */
  handleWindowRemoved(windowId: number): void {
    if (this.session && this.session.currentWindowId === windowId) {
      console.log('[DragSession] Window closed during drag, ending session');
      void this.endSession('WINDOW_CLOSED');
    }
  }

  /**
   * タブ削除時のクリーンアップ
   *
   * @param tabId - 削除されたタブID
   */
  handleTabRemoved(tabId: number): void {
    if (this.session && this.session.tabId === tabId) {
      console.log('[DragSession] Tab removed during drag, ending session');
      void this.endSession('TAB_REMOVED');
    }
  }

  /**
   * アラームハンドラ（keep-alive用）
   *
   * @param alarm - アラーム情報
   */
  handleAlarm(alarm: chrome.alarms.Alarm): void {
    if (alarm.name === this.KEEP_ALIVE_ALARM_NAME) {
      // セッションがアクティブな間はService Workerを維持
      if (this.session) {
        console.log('[DragSession] Keep-alive ping');
      } else {
        // セッションがない場合はアラームをクリア
        if (typeof chrome !== 'undefined' && chrome.alarms) {
          void chrome.alarms.clear(this.KEEP_ALIVE_ALARM_NAME);
        }
      }
    }
  }
}

// シングルトンインスタンス
export const dragSessionManager = new DragSessionManager();
