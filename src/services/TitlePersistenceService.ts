import type { IStorageService, TabTitlesMap } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

/**
 * タブタイトル永続化サービス
 *
 * タブタイトルの永続化と復元を担当
 * - タブのタイトルが確定した場合、タイトルをストレージに永続化
 * - ブラウザ起動時に永続化されたタイトルを復元して表示
 * - タブが再読み込みされ新しいタイトルが取得された場合、永続化データを上書き
 * - タブが閉じられた際に該当タブのタイトルデータを削除
 */
export class TitlePersistenceService {
  /** タイトルマップ（メモリキャッシュ） */
  private titles: TabTitlesMap = {};

  /** デバウンス用タイマーID */
  private saveTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /** デバウンス間隔（ミリ秒） */
  private readonly DEBOUNCE_MS = 300;

  constructor(private storageService: IStorageService) {}

  /**
   * タイトルを永続化
   *
   * タブのタイトルが確定した場合、タイトルをストレージに永続化
   * タブが再読み込みされた場合、永続化データを上書き
   *
   * @param tabId - タブID
   * @param title - タイトル
   */
  saveTitle(tabId: number, title: string): void {
    // メモリキャッシュを更新
    this.titles[tabId] = title;

    // デバウンスで書き込み頻度を制限
    this.debouncedSave();
  }

  /**
   * 永続化タイトルを取得
   *
   * @param tabId - タブID
   * @returns タイトルまたはundefined
   */
  getTitle(tabId: number): string | undefined {
    return this.titles[tabId];
  }

  /**
   * 全タイトルを取得（起動時復元用）
   *
   * ブラウザ起動時に永続化されたタイトルを復元
   *
   * @returns タブIDからタイトルへのマップ
   */
  getAllTitles(): TabTitlesMap {
    return { ...this.titles };
  }

  /**
   * タイトルを削除
   *
   * タブが閉じられた際に該当タブのタイトルデータを削除
   *
   * @param tabId - タブID
   */
  removeTitle(tabId: number): void {
    delete this.titles[tabId];

    // デバウンスで書き込み頻度を制限
    this.debouncedSave();
  }

  /**
   * 存在しないタブのタイトルをクリーンアップ
   *
   * @param existingTabIds - 現在存在するタブIDの配列
   */
  cleanup(existingTabIds: number[]): void {
    const existingTabIdSet = new Set(existingTabIds);
    const staleTabIds: number[] = [];

    // 存在しないタブIDを特定
    for (const tabId of Object.keys(this.titles).map(Number)) {
      if (!existingTabIdSet.has(tabId)) {
        staleTabIds.push(tabId);
      }
    }

    // 存在しないタブのタイトルを削除
    for (const tabId of staleTabIds) {
      delete this.titles[tabId];
    }

    // 変更があった場合のみ保存
    if (staleTabIds.length > 0) {
      this.debouncedSave();
    }
  }

  /**
   * ストレージからタイトルを読み込み
   *
   * ブラウザ起動時に永続化されたタイトルを復元
   */
  async loadFromStorage(): Promise<void> {
    const storedTitles = await this.storageService.get(STORAGE_KEYS.TAB_TITLES);
    if (storedTitles) {
      this.titles = { ...storedTitles };
    }
  }

  /**
   * デバウンスされたストレージ書き込み
   *
   * 300msの間隔で書き込み頻度を制限し、パフォーマンスを最適化
   */
  private debouncedSave(): void {
    if (this.saveTimeoutId !== null) {
      clearTimeout(this.saveTimeoutId);
    }

    this.saveTimeoutId = setTimeout(() => {
      this.saveToStorage();
      this.saveTimeoutId = null;
    }, this.DEBOUNCE_MS);
  }

  /**
   * ストレージに保存
   */
  private async saveToStorage(): Promise<void> {
    try {
      await this.storageService.set(STORAGE_KEYS.TAB_TITLES, { ...this.titles });
    } catch (_error) {
      // サイレント失敗（次回再試行）
    }
  }
}
