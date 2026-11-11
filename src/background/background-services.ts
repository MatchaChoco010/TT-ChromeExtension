/**
 * Service Worker全体で共有するサービスのインスタンス
 */
import { TreeStateManager } from '@/services/TreeStateManager';
import { UnreadTracker } from '@/services/UnreadTracker';
import { TitlePersistenceService } from '@/services/TitlePersistenceService';
import { SnapshotManager } from '@/services/SnapshotManager';
import { StorageService } from '@/storage/StorageService';
import { downloadService } from '@/storage/DownloadService';

export const storageService = new StorageService();
export const treeStateManager = new TreeStateManager(storageService);
export const unreadTracker = new UnreadTracker(storageService);
export const titlePersistence = new TitlePersistenceService(storageService);
export const snapshotManager = new SnapshotManager(downloadService, storageService);
