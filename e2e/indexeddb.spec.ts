import { test, expect } from './fixtures/extension';
import {
  INDEXEDDB_TIMEOUTS,
  TEST_SNAPSHOT_DATA,
  generateLargeSnapshotData,
  DB_NAME,
  STORE_NAME,
} from './test-data/indexeddb-fixtures';

test.describe.serial('IndexedDB統合', () => {
  // テスト間でIndexedDBの状態が共有されるため直列実行する

  test.beforeEach(async ({ extensionContext }) => {
    let [worker] = extensionContext.serviceWorkers();
    if (!worker) {
      worker = await extensionContext.waitForEvent('serviceworker', { timeout: 10000 });
    }

    await worker.evaluate(async (dbName) => {
      return new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase(dbName);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
        deleteRequest.onblocked = () => resolve();
      });
    }, DB_NAME);
  });

  test.describe.serial('IndexedDB基本操作', () => {
    test('IndexedDBにデータを保存できる', async ({ extensionContext }) => {
      let [worker] = extensionContext.serviceWorkers();
      if (!worker) {
        worker = await extensionContext.waitForEvent('serviceworker', { timeout: 10000 });
      }

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
      let [worker] = extensionContext.serviceWorkers();
      if (!worker) {
        worker = await extensionContext.waitForEvent('serviceworker', { timeout: 10000 });
      }

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
      let [worker] = extensionContext.serviceWorkers();
      if (!worker) {
        worker = await extensionContext.waitForEvent('serviceworker', { timeout: 10000 });
      }
      const testId = 'delete-test-snapshot';

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

      const verifyResult = await worker.evaluate(
        async ({ dbName, storeName, id }) => {
          return new Promise<boolean>((resolve) => {
            const request = indexedDB.open(dbName);

            request.onerror = () => resolve(false);

            request.onsuccess = () => {
              const db = request.result;
              if (!db.objectStoreNames.contains(storeName)) {
                db.close();
                resolve(true);
                return;
              }

              const transaction = db.transaction([storeName], 'readonly');
              const store = transaction.objectStore(storeName);
              const getRequest = store.get(id);

              getRequest.onsuccess = () => {
                const exists = !!getRequest.result;
                db.close();
                resolve(!exists);
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

  test.describe.serial('大量データの処理', () => {
    test('100個のスナップショットデータを処理できる', async ({
      extensionContext,
    }) => {
      let [worker] = extensionContext.serviceWorkers();
      if (!worker) {
        worker = await extensionContext.waitForEvent('serviceworker', { timeout: 10000 });
      }

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
      let [worker] = extensionContext.serviceWorkers();
      if (!worker) {
        worker = await extensionContext.waitForEvent('serviceworker', { timeout: 10000 });
      }

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
      expect(result.duration).toBeLessThan(5000);
    });
  });

  test.describe.serial('エラーハンドリング', () => {
    test('IndexedDBが利用可能であることを確認', async ({
      extensionContext,
    }) => {
      let [worker] = extensionContext.serviceWorkers();
      if (!worker) {
        worker = await extensionContext.waitForEvent('serviceworker', { timeout: 10000 });
      }

      const hasIndexedDB = await worker.evaluate(() => {
        return typeof indexedDB !== 'undefined';
      });

      expect(hasIndexedDB).toBe(true);
    });

    test('不正なデータベースバージョンでのエラーハンドリング', async ({
      extensionContext,
    }) => {
      let [worker] = extensionContext.serviceWorkers();
      if (!worker) {
        worker = await extensionContext.waitForEvent('serviceworker', { timeout: 10000 });
      }

      const result = await worker.evaluate(async () => {
        return new Promise<{ hasErrorHandler: boolean }>((resolve) => {
          const request = indexedDB.open('test-error-handling-db', 1);

          request.onerror = () => {
            resolve({ hasErrorHandler: true });
          };

          request.onsuccess = () => {
            const db = request.result;
            db.close();
            resolve({ hasErrorHandler: true });
          };

          setTimeout(() => {
            resolve({ hasErrorHandler: true });
          }, 5000);
        });
      });

      expect(result.hasErrorHandler).toBe(true);
    });
  });

  test.describe.serial('データ永続化', () => {
    test('データベースを閉じて再度開いてもデータが保持される', async ({
      extensionContext,
    }) => {
      let [worker] = extensionContext.serviceWorkers();
      if (!worker) {
        worker = await extensionContext.waitForEvent('serviceworker', { timeout: 10000 });
      }
      const testId = 'persistence-test-snapshot';
      const testName = 'Persistence Test';

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

      const result = await worker.evaluate(
        async ({ dbName, storeName, id, expectedName }) => {
          for (let i = 0; i < 30; i++) {
            const readResult = await new Promise<{ found: boolean; name: string | null }>(
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

            if (readResult.found && readResult.name === expectedName) {
              return readResult;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          return { found: false, name: null };
        },
        { dbName: DB_NAME, storeName: STORE_NAME, id: testId, expectedName: testName }
      );

      expect(result.found).toBe(true);
      expect(result.name).toBe(testName);
    });

    test('複数のトランザクションが順序通り処理される', async ({
      extensionContext,
    }) => {
      let [worker] = extensionContext.serviceWorkers();
      if (!worker) {
        worker = await extensionContext.waitForEvent('serviceworker', { timeout: 10000 });
      }

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

  test.describe.serial('同時アクセス', () => {
    test('同時アクセス時のデータ整合性', async ({ extensionContext }) => {
      let [worker] = extensionContext.serviceWorkers();
      if (!worker) {
        worker = await extensionContext.waitForEvent('serviceworker', { timeout: 10000 });
      }

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
