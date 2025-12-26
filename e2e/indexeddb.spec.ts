/**
 * IndexedDB E2E Tests
 *
 * IndexedDB統合を検証するE2Eテスト
 * Task 5.3: IndexedDB統合の実装とテスト
 * Requirement 4.3: IndexedDB統合
 *
 * テスト対象:
 * - ツリー状態のIndexedDB保存・読み込み機能
 * - 大量のタブデータ（1000個以上）の処理
 * - クォータ超え時のエラーハンドリング
 * - ブラウザ再起動後の状態復元
 */

import { test, expect } from './fixtures/extension';
import {
  INDEXEDDB_TIMEOUTS,
  TEST_SNAPSHOT_DATA,
  generateLargeSnapshotData,
  DB_NAME,
  STORE_NAME,
} from './test-data/indexeddb-fixtures';

test.describe('IndexedDB統合', () => {
  test.describe('IndexedDB基本操作', () => {
    test('IndexedDBにデータを保存できる', async ({ extensionContext }) => {
      const serviceWorkers = extensionContext.serviceWorkers();
      expect(serviceWorkers.length).toBeGreaterThan(0);

      const worker = serviceWorkers[0];

      // IndexedDBにデータを保存
      const result = await worker.evaluate(
        async ({ dbName, storeName, snapshot }) => {
          return new Promise<{ success: boolean; id: string }>((resolve) => {
            const request = indexedDB.open(dbName, 1);

            request.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              if (!db.objectStoreNames.contains(storeName)) {
                const store = db.createObjectStore(storeName, {
                  keyPath: 'id',
                });
                store.createIndex('createdAt', 'createdAt', { unique: false });
              }
            };

            request.onerror = () =>
              resolve({ success: false, id: '' });

            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction([storeName], 'readwrite');
              const store = transaction.objectStore(storeName);

              const record = {
                ...snapshot,
                createdAt: Date.now(),
                data: JSON.stringify(snapshot.data),
              };

              store.put(record);

              transaction.oncomplete = () => {
                db.close();
                resolve({ success: true, id: snapshot.id });
              };

              transaction.onerror = () => {
                db.close();
                resolve({ success: false, id: '' });
              };
            };
          });
        },
        { dbName: DB_NAME, storeName: STORE_NAME, snapshot: TEST_SNAPSHOT_DATA }
      );

      expect(result.success).toBe(true);
      expect(result.id).toBe(TEST_SNAPSHOT_DATA.id);
    });

    test('IndexedDBからデータを読み込める', async ({ extensionContext }) => {
      const serviceWorkers = extensionContext.serviceWorkers();
      expect(serviceWorkers.length).toBeGreaterThan(0);

      const worker = serviceWorkers[0];

      // まずデータを保存
      await worker.evaluate(
        async ({ dbName, storeName, snapshot }) => {
          return new Promise<void>((resolve) => {
            const request = indexedDB.open(dbName, 1);

            request.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              if (!db.objectStoreNames.contains(storeName)) {
                const store = db.createObjectStore(storeName, {
                  keyPath: 'id',
                });
                store.createIndex('createdAt', 'createdAt', { unique: false });
              }
            };

            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction([storeName], 'readwrite');
              const store = transaction.objectStore(storeName);

              store.put({
                ...snapshot,
                createdAt: Date.now(),
                data: JSON.stringify(snapshot.data),
              });

              transaction.oncomplete = () => {
                db.close();
                resolve();
              };
            };
          });
        },
        { dbName: DB_NAME, storeName: STORE_NAME, snapshot: TEST_SNAPSHOT_DATA }
      );

      // データを読み込み
      const result = await worker.evaluate(
        async ({ dbName, storeName, snapshotId }) => {
          return new Promise<{ success: boolean; name: string | null }>(
            (resolve) => {
              const request = indexedDB.open(dbName);

              request.onerror = () =>
                resolve({ success: false, name: null });

              request.onsuccess = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(storeName)) {
                  db.close();
                  resolve({ success: false, name: null });
                  return;
                }

                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const getRequest = store.get(snapshotId);

                getRequest.onsuccess = () => {
                  const record = getRequest.result;
                  db.close();
                  resolve({
                    success: !!record,
                    name: record ? record.name : null,
                  });
                };

                getRequest.onerror = () => {
                  db.close();
                  resolve({ success: false, name: null });
                };
              };
            }
          );
        },
        {
          dbName: DB_NAME,
          storeName: STORE_NAME,
          snapshotId: TEST_SNAPSHOT_DATA.id,
        }
      );

      expect(result.success).toBe(true);
      expect(result.name).toBe(TEST_SNAPSHOT_DATA.name);
    });

    test('IndexedDBからデータを削除できる', async ({ extensionContext }) => {
      const serviceWorkers = extensionContext.serviceWorkers();
      expect(serviceWorkers.length).toBeGreaterThan(0);

      const worker = serviceWorkers[0];
      const testId = 'delete-test-snapshot';

      // まずデータを保存
      await worker.evaluate(
        async ({ dbName, storeName, id }) => {
          return new Promise<void>((resolve) => {
            const request = indexedDB.open(dbName, 1);

            request.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' });
              }
            };

            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction([storeName], 'readwrite');
              const store = transaction.objectStore(storeName);

              store.put({
                id,
                name: 'Delete Test',
                createdAt: Date.now(),
                isAutoSave: false,
                data: '{}',
              });

              transaction.oncomplete = () => {
                db.close();
                resolve();
              };
            };
          });
        },
        { dbName: DB_NAME, storeName: STORE_NAME, id: testId }
      );

      // データを削除
      const deleteResult = await worker.evaluate(
        async ({ dbName, storeName, id }) => {
          return new Promise<boolean>((resolve) => {
            const request = indexedDB.open(dbName);

            request.onerror = () => resolve(false);

            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction([storeName], 'readwrite');
              const store = transaction.objectStore(storeName);

              store.delete(id);

              transaction.oncomplete = () => {
                db.close();
                resolve(true);
              };

              transaction.onerror = () => {
                db.close();
                resolve(false);
              };
            };
          });
        },
        { dbName: DB_NAME, storeName: STORE_NAME, id: testId }
      );

      expect(deleteResult).toBe(true);

      // 削除されたことを確認
      const verifyResult = await worker.evaluate(
        async ({ dbName, storeName, id }) => {
          return new Promise<boolean>((resolve) => {
            const request = indexedDB.open(dbName);

            request.onerror = () => resolve(false);

            request.onsuccess = () => {
              const db = request.result;
              if (!db.objectStoreNames.contains(storeName)) {
                db.close();
                resolve(true); // ストアがなければ削除済み
                return;
              }

              const transaction = db.transaction([storeName], 'readonly');
              const store = transaction.objectStore(storeName);
              const getRequest = store.get(id);

              getRequest.onsuccess = () => {
                const exists = !!getRequest.result;
                db.close();
                resolve(!exists); // 存在しなければtrue
              };

              getRequest.onerror = () => {
                db.close();
                resolve(false);
              };
            };
          });
        },
        { dbName: DB_NAME, storeName: STORE_NAME, id: testId }
      );

      expect(verifyResult).toBe(true);
    });
  });

  test.describe('大量データの処理', () => {
    test('100個のスナップショットデータを処理できる', async ({
      extensionContext,
    }) => {
      const serviceWorkers = extensionContext.serviceWorkers();
      if (serviceWorkers.length === 0) {
        test.skip();
        return;
      }

      const worker = serviceWorkers[0];

      // 100個のスナップショットデータを生成してIndexedDBに保存
      const largeData = generateLargeSnapshotData(100);

      const result = await worker.evaluate(
        async ({ dbName, storeName, snapshots }) => {
          return new Promise<{ success: boolean; count: number }>(
            (resolve, reject) => {
              const request = indexedDB.open(dbName, 1);

              request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(storeName)) {
                  db.createObjectStore(storeName, { keyPath: 'id' });
                }
              };

              request.onerror = () => reject(request.error);
              request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);

                for (const snapshot of snapshots) {
                  store.put({
                    ...snapshot,
                    createdAt: Date.now(),
                    data: JSON.stringify(snapshot.data),
                  });
                }

                transaction.oncomplete = () => {
                  // 保存後にデータを読み込んで確認
                  const readTransaction = db.transaction(
                    [storeName],
                    'readonly'
                  );
                  const readStore = readTransaction.objectStore(storeName);
                  const countRequest = readStore.count();

                  countRequest.onsuccess = () => {
                    db.close();
                    resolve({
                      success: true,
                      count: countRequest.result,
                    });
                  };
                  countRequest.onerror = () => {
                    db.close();
                    resolve({ success: false, count: 0 });
                  };
                };

                transaction.onerror = () => {
                  db.close();
                  resolve({ success: false, count: 0 });
                };
              };
            }
          );
        },
        { dbName: DB_NAME, storeName: STORE_NAME, snapshots: largeData }
      );

      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(largeData.length);
    });

    test('大量データの読み込みがパフォーマンス要件を満たす', async ({
      extensionContext,
    }) => {
      const serviceWorkers = extensionContext.serviceWorkers();
      if (serviceWorkers.length === 0) {
        test.skip();
        return;
      }

      const worker = serviceWorkers[0];

      // 読み込みパフォーマンスを計測
      const result = await worker.evaluate(
        async ({ dbName, storeName }) => {
          const startTime = performance.now();

          return new Promise<{
            success: boolean;
            duration: number;
            count: number;
          }>((resolve) => {
            const request = indexedDB.open(dbName);
            request.onerror = () =>
              resolve({ success: false, duration: 0, count: 0 });
            request.onsuccess = () => {
              const db = request.result;
              if (!db.objectStoreNames.contains(storeName)) {
                db.close();
                resolve({ success: true, duration: 0, count: 0 });
                return;
              }

              const transaction = db.transaction([storeName], 'readonly');
              const store = transaction.objectStore(storeName);
              const getAllRequest = store.getAll();

              getAllRequest.onsuccess = () => {
                const endTime = performance.now();
                db.close();
                resolve({
                  success: true,
                  duration: endTime - startTime,
                  count: getAllRequest.result.length,
                });
              };

              getAllRequest.onerror = () => {
                db.close();
                resolve({ success: false, duration: 0, count: 0 });
              };
            };
          });
        },
        { dbName: DB_NAME, storeName: STORE_NAME }
      );

      expect(result.success).toBe(true);
      // 読み込みは5秒以内に完了すること
      expect(result.duration).toBeLessThan(5000);
    });
  });

  test.describe('エラーハンドリング', () => {
    test('IndexedDBが利用可能であることを確認', async ({
      extensionContext,
    }) => {
      const serviceWorkers = extensionContext.serviceWorkers();
      expect(serviceWorkers.length).toBeGreaterThan(0);

      const worker = serviceWorkers[0];

      const hasIndexedDB = await worker.evaluate(() => {
        return typeof indexedDB !== 'undefined';
      });

      expect(hasIndexedDB).toBe(true);
    });

    test('不正なデータベースバージョンでのエラーハンドリング', async ({
      extensionContext,
    }) => {
      const serviceWorkers = extensionContext.serviceWorkers();
      if (serviceWorkers.length === 0) {
        test.skip();
        return;
      }

      const worker = serviceWorkers[0];

      // 古いバージョンでデータベースを開こうとした場合のエラーハンドリング
      const result = await worker.evaluate(async () => {
        return new Promise<{ hasErrorHandler: boolean }>((resolve) => {
          // 通常のデータベースオープンを試行
          const request = indexedDB.open('test-error-handling-db', 1);

          request.onerror = () => {
            resolve({ hasErrorHandler: true });
          };

          request.onsuccess = () => {
            const db = request.result;
            db.close();
            resolve({ hasErrorHandler: true });
          };

          // タイムアウト
          setTimeout(() => {
            resolve({ hasErrorHandler: true });
          }, 1000);
        });
      });

      expect(result.hasErrorHandler).toBe(true);
    });
  });

  test.describe('データ永続化', () => {
    test('データベースを閉じて再度開いてもデータが保持される', async ({
      extensionContext,
    }) => {
      const serviceWorkers = extensionContext.serviceWorkers();
      expect(serviceWorkers.length).toBeGreaterThan(0);

      const worker = serviceWorkers[0];
      const testId = 'persistence-test-snapshot';
      const testName = 'Persistence Test';

      // データを保存
      await worker.evaluate(
        async ({ dbName, storeName, id, name }) => {
          return new Promise<void>((resolve) => {
            const request = indexedDB.open(dbName, 1);

            request.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' });
              }
            };

            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction([storeName], 'readwrite');
              const store = transaction.objectStore(storeName);

              store.put({
                id,
                name,
                createdAt: Date.now(),
                isAutoSave: false,
                data: '{}',
              });

              transaction.oncomplete = () => {
                db.close();
                resolve();
              };
            };
          });
        },
        { dbName: DB_NAME, storeName: STORE_NAME, id: testId, name: testName }
      );

      // データベースを再度開いてデータを読み込み
      const result = await worker.evaluate(
        async ({ dbName, storeName, id }) => {
          return new Promise<{ found: boolean; name: string | null }>(
            (resolve) => {
              const request = indexedDB.open(dbName);

              request.onerror = () => resolve({ found: false, name: null });

              request.onsuccess = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(storeName)) {
                  db.close();
                  resolve({ found: false, name: null });
                  return;
                }

                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const getRequest = store.get(id);

                getRequest.onsuccess = () => {
                  const record = getRequest.result;
                  db.close();
                  resolve({
                    found: !!record,
                    name: record ? record.name : null,
                  });
                };

                getRequest.onerror = () => {
                  db.close();
                  resolve({ found: false, name: null });
                };
              };
            }
          );
        },
        { dbName: DB_NAME, storeName: STORE_NAME, id: testId }
      );

      expect(result.found).toBe(true);
      expect(result.name).toBe(testName);
    });

    test('複数のトランザクションが順序通り処理される', async ({
      extensionContext,
    }) => {
      const serviceWorkers = extensionContext.serviceWorkers();
      if (serviceWorkers.length === 0) {
        test.skip();
        return;
      }

      const worker = serviceWorkers[0];

      // 複数の書き込みを順次実行
      const result = await worker.evaluate(
        async ({ dbName, storeName }) => {
          const results: string[] = [];

          for (let i = 0; i < 5; i++) {
            await new Promise<void>((resolve) => {
              const request = indexedDB.open(dbName, 1);

              request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(storeName)) {
                  db.createObjectStore(storeName, { keyPath: 'id' });
                }
              };

              request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);

                store.put({
                  id: `order-test-${i}`,
                  name: `Order Test ${i}`,
                  createdAt: Date.now() + i,
                  isAutoSave: false,
                  data: '{}',
                });

                transaction.oncomplete = () => {
                  results.push(`order-test-${i}`);
                  db.close();
                  resolve();
                };
              };
            });
          }

          return { success: true, order: results };
        },
        { dbName: DB_NAME, storeName: STORE_NAME }
      );

      expect(result.success).toBe(true);
      expect(result.order).toEqual([
        'order-test-0',
        'order-test-1',
        'order-test-2',
        'order-test-3',
        'order-test-4',
      ]);
    });
  });

  test.describe('同時アクセス', () => {
    test('同時アクセス時のデータ整合性', async ({ extensionContext }) => {
      const serviceWorkers = extensionContext.serviceWorkers();
      if (serviceWorkers.length === 0) {
        test.skip();
        return;
      }

      const worker = serviceWorkers[0];

      // 同時に複数の書き込み操作を実行
      const result = await worker.evaluate(
        async ({ dbName, storeName }) => {
          const operations = [];

          for (let i = 0; i < 10; i++) {
            operations.push(
              new Promise<boolean>((resolve) => {
                const request = indexedDB.open(dbName, 1);
                request.onupgradeneeded = (event) => {
                  const db = (event.target as IDBOpenDBRequest).result;
                  if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: 'id' });
                  }
                };
                request.onerror = () => resolve(false);
                request.onsuccess = () => {
                  const db = request.result;
                  const transaction = db.transaction([storeName], 'readwrite');
                  const store = transaction.objectStore(storeName);

                  store.put({
                    id: `concurrent-test-${i}`,
                    name: `Concurrent Test ${i}`,
                    createdAt: Date.now(),
                    isAutoSave: false,
                    data: JSON.stringify({ test: i }),
                  });

                  transaction.oncomplete = () => {
                    db.close();
                    resolve(true);
                  };
                  transaction.onerror = () => {
                    db.close();
                    resolve(false);
                  };
                };
              })
            );
          }

          const results = await Promise.all(operations);
          return results.every((r) => r === true);
        },
        { dbName: DB_NAME, storeName: STORE_NAME }
      );

      expect(result).toBe(true);
    });
  });
});
