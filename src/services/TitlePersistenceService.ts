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
  private titles: TabTitlesMap = {};
  private saveTimeoutId: ReturnType<typeof setTimeout> | null = null;
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
    this.titles[tabId] = title;
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

    for (const tabId of Object.keys(this.titles).map(Number)) {
      if (!existingTabIdSet.has(tabId)) {
        staleTabIds.push(tabId);
      }
    }

    for (const tabId of staleTabIds) {
      delete this.titles[tabId];
    }

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
