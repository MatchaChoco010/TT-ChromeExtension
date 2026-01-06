import type { Snapshot, IIndexedDBService } from '@/types';

const DB_NAME = 'vivaldi-tt-snapshots';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

interface SnapshotRecord {
  id: string;
  createdAt: number;
  name: string;
  isAutoSave: boolean;
  data: string; // JSON stringified SnapshotData
}

/**
 * IndexedDB を使用したスナップショット管理サービス
 * スナップショットの保存、取得、削除、履歴管理機能を提供
 */
export class IndexedDBService implements IIndexedDBService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

          store.createIndex('createdAt', 'createdAt', { unique: false });

          store.createIndex('isAutoSave', 'isAutoSave', { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  private snapshotToRecord(snapshot: Snapshot): SnapshotRecord {
    return {
      id: snapshot.id,
      createdAt: snapshot.createdAt.getTime(),
      name: snapshot.name,
      isAutoSave: snapshot.isAutoSave,
      data: JSON.stringify(snapshot.data),
    };
  }

  private recordToSnapshot(record: SnapshotRecord): Snapshot {
    return {
      id: record.id,
      createdAt: new Date(record.createdAt),
      name: record.name,
      isAutoSave: record.isAutoSave,
      data: JSON.parse(record.data),
    };
  }

  /**
   * スナップショットを保存
   * 同じ ID のスナップショットが存在する場合は上書き
   */
  async saveSnapshot(snapshot: Snapshot): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record = this.snapshotToRecord(snapshot);
      store.put(record);

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
          console.error('saveSnapshot transaction error:', transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error('saveSnapshot error:', error);
      throw error;
    }
  }

  /**
   * ID でスナップショットを取得
   * 存在しない場合は null を返す
   */
  async getSnapshot(id: string): Promise<Snapshot | null> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.get(id);

        request.onsuccess = () => {
          const record = request.result as SnapshotRecord | undefined;
          resolve(record ? this.recordToSnapshot(record) : null);
        };

        request.onerror = () => {
          console.error('getSnapshot error:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('getSnapshot error:', error);
      throw error;
    }
  }

  /**
   * すべてのスナップショットを取得
   * createdAt で降順ソート（新しいものから順に）
   */
  async getAllSnapshots(): Promise<Snapshot[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('createdAt');

      return new Promise((resolve, reject) => {
        const request = index.openCursor(null, 'prev');
        const snapshots: Snapshot[] = [];

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const record = cursor.value as SnapshotRecord;
            snapshots.push(this.recordToSnapshot(record));
            cursor.continue();
          } else {
            resolve(snapshots);
          }
        };

        request.onerror = () => {
          console.error('getAllSnapshots error:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('getAllSnapshots error:', error);
      throw error;
    }
  }

  /**
   * ID でスナップショットを削除
   * 存在しない場合でもエラーを発生させない
   */
  async deleteSnapshot(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      store.delete(id);

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
          console.error('deleteSnapshot transaction error:', transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error('deleteSnapshot error:', error);
      throw error;
    }
  }

  /**
   * 古いスナップショットを削除
   * keepCount で指定した数の最新スナップショットを残し、それ以外を削除
   * @param keepCount - 保持するスナップショット数（0 の場合はすべて削除）
   */
  async deleteOldSnapshots(keepCount: number): Promise<void> {
    try {
      const allSnapshots = await this.getAllSnapshots();

      const snapshotsToDelete = allSnapshots.slice(keepCount);

      for (const snapshot of snapshotsToDelete) {
        await this.deleteSnapshot(snapshot.id);
      }
    } catch (error) {
      console.error('deleteOldSnapshots error:', error);
      throw error;
    }
  }
}

export const indexedDBService = new IndexedDBService();
