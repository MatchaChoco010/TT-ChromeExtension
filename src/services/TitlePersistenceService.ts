import type { IStorageService, TabTitlesMap } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

export class TitlePersistenceService {
  private titles: TabTitlesMap = {};
  private saveTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 300;

  constructor(private storageService: IStorageService) {}

  saveTitle(tabId: number, title: string): void {
    this.titles[tabId] = title;
    this.debouncedSave();
  }

  getTitle(tabId: number): string | undefined {
    return this.titles[tabId];
  }

  getAllTitles(): TabTitlesMap {
    return { ...this.titles };
  }

  removeTitle(tabId: number): void {
    delete this.titles[tabId];
    this.debouncedSave();
  }

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

  private async saveToStorage(): Promise<void> {
    try {
      await this.storageService.set(STORAGE_KEYS.TAB_TITLES, { ...this.titles });
    } catch {
      // サイレント失敗（次回再試行）
    }
  }
}
