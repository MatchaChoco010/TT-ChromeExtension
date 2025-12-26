/**
 * Chrome Storage API E2E Tests
 *
 * chrome.storage APIとの統合を検証するE2Eテスト
 * Task 5.4: chrome.storage API統合の実装とテスト
 * Requirement 4.4: chrome.storage API統合
 *
 * テスト対象:
 * - chrome.storage.local.set()で設定を保存
 * - chrome.storage.local.get()で設定を読み込み
 * - chrome.storage.onChangedイベントハンドリングとUIの更新
 * - 複数の設定項目を一括で保存
 */

import { test, expect } from './fixtures/extension';

test.describe('chrome.storage API統合', () => {
  test.describe('chrome.storage.local.set() / get()', () => {
    test('chrome.storage.local.set()で設定を保存した場合、設定が永続化される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      // Arrange: テスト用の設定データ
      const testSettings = {
        fontSize: 16,
        fontFamily: 'Arial, sans-serif',
        theme: 'dark',
        indentWidth: 20,
      };

      // Act: Service Workerでchrome.storage.local.setを実行
      const saveResult = await serviceWorker.evaluate(async (settings) => {
        return new Promise<{ success: boolean; error?: string }>((resolve) => {
          chrome.storage.local.set({ userSettings: settings }, () => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve({ success: true });
            }
          });
        });
      }, testSettings);

      // Assert: 保存が成功する
      expect(saveResult.success).toBe(true);
      expect(saveResult.error).toBeUndefined();

      // Verify: データが永続化されていることを確認
      const verifyResult = await serviceWorker.evaluate(async () => {
        return new Promise<{ success: boolean; data?: Record<string, unknown> }>((resolve) => {
          chrome.storage.local.get(['userSettings'], (result) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false });
            } else {
              resolve({ success: true, data: result });
            }
          });
        });
      });

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.data?.userSettings).toEqual(testSettings);
    });

    test('chrome.storage.local.get()で設定を読み込んだ場合、保存された設定値が取得される', async ({
      serviceWorker,
    }) => {
      // Arrange: 先にデータを保存
      const testData = {
        testKey: 'testValue',
        testNumber: 42,
        testBoolean: true,
        testArray: [1, 2, 3],
        testObject: { nested: 'value' },
      };

      await serviceWorker.evaluate(async (data) => {
        return new Promise<void>((resolve) => {
          chrome.storage.local.set({ storageTest: data }, () => {
            resolve();
          });
        });
      }, testData);

      // Act: chrome.storage.local.getで読み込み
      const result = await serviceWorker.evaluate(async () => {
        return new Promise<{ success: boolean; data?: unknown }>((resolve) => {
          chrome.storage.local.get(['storageTest'], (result) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false });
            } else {
              resolve({ success: true, data: result.storageTest });
            }
          });
        });
      });

      // Assert: 保存したデータが正しく取得できる
      expect(result.success).toBe(true);
      expect(result.data).toEqual(testData);
    });

    test('存在しないキーを取得した場合、undefinedが返される', async ({
      serviceWorker,
    }) => {
      // Act: 存在しないキーを取得
      const result = await serviceWorker.evaluate(async () => {
        return new Promise<{ success: boolean; data?: Record<string, unknown> }>((resolve) => {
          chrome.storage.local.get(['nonExistentKey'], (result) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false });
            } else {
              resolve({ success: true, data: result });
            }
          });
        });
      });

      // Assert: 成功するがデータはundefined
      expect(result.success).toBe(true);
      expect(result.data?.nonExistentKey).toBeUndefined();
    });

    test('デフォルト値を指定して取得した場合、存在しないキーにはデフォルト値が返される', async ({
      serviceWorker,
    }) => {
      // Arrange: 一部のデータのみ保存
      await serviceWorker.evaluate(async () => {
        return new Promise<void>((resolve) => {
          chrome.storage.local.set({ existingKey: 'existingValue' }, () => {
            resolve();
          });
        });
      });

      // Act: デフォルト値を指定して取得
      const result = await serviceWorker.evaluate(async () => {
        return new Promise<{ success: boolean; data?: Record<string, unknown> }>((resolve) => {
          chrome.storage.local.get(
            { existingKey: 'default1', nonExistentKey: 'defaultValue' },
            (result) => {
              if (chrome.runtime.lastError) {
                resolve({ success: false });
              } else {
                resolve({ success: true, data: result });
              }
            }
          );
        });
      });

      // Assert: 存在するキーは実際の値、存在しないキーはデフォルト値
      expect(result.success).toBe(true);
      expect(result.data?.existingKey).toBe('existingValue');
      expect(result.data?.nonExistentKey).toBe('defaultValue');
    });
  });

  test.describe('chrome.storage.onChanged イベントハンドリング', () => {
    test('chrome.storage.onChangedイベントが発火した場合、UIが最新の設定で更新される', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: Side Panelが表示されていることを確認
      await expect(sidePanelPage.locator('[data-testid="side-panel-root"]')).toBeVisible({
        timeout: 10000,
      });

      // 設定パネルを開く
      const settingsButton = sidePanelPage.locator('[data-testid="settings-button"]');
      await expect(settingsButton).toBeVisible({ timeout: 5000 });
      await settingsButton.click();

      await expect(sidePanelPage.locator('[data-testid="settings-panel"]')).toBeVisible({
        timeout: 3000,
      });

      // 変更前のフォントサイズを取得
      const fontSizeInput = sidePanelPage.locator('input#fontSize');
      const initialValue = await fontSizeInput.inputValue();

      // Act: Service Workerからchrome.storageを更新
      // Note: ThemeProviderは 'user_settings' キーを使用している
      await serviceWorker.evaluate(async () => {
        return new Promise<void>((resolve) => {
          chrome.storage.local.set(
            {
              user_settings: {
                fontSize: 22,
                fontFamily: 'system-ui, sans-serif',
                customCSS: '',
                newTabPosition: 'child',
                closeWarningThreshold: 3,
                showUnreadIndicator: true,
                autoSnapshotInterval: 0,
                childTabBehavior: 'promote',
              },
            },
            () => {
              resolve();
            }
          );
        });
      });

      // Assert: UIが更新される（onChangedイベントにより）
      await expect(async () => {
        const currentValue = await fontSizeInput.inputValue();
        expect(currentValue).toBe('22');
      }).toPass({ timeout: 5000 });
    });

    test('複数の設定変更が同時に行われた場合、すべてがUIに反映される', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: Side Panelが表示されていることを確認
      await expect(sidePanelPage.locator('[data-testid="side-panel-root"]')).toBeVisible({
        timeout: 10000,
      });

      // 設定パネルを開く
      const settingsButton = sidePanelPage.locator('[data-testid="settings-button"]');
      await expect(settingsButton).toBeVisible({ timeout: 5000 });
      await settingsButton.click();

      await expect(sidePanelPage.locator('[data-testid="settings-panel"]')).toBeVisible({
        timeout: 3000,
      });

      // Act: 複数の設定を同時に更新
      // Note: ThemeProviderは 'user_settings' キーを使用している
      const newSettings = {
        fontSize: 18,
        fontFamily: 'Consolas, monospace',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };

      await serviceWorker.evaluate(async (settings) => {
        return new Promise<void>((resolve) => {
          chrome.storage.local.set({ user_settings: settings }, () => {
            resolve();
          });
        });
      }, newSettings);

      // Assert: すべての設定がUIに反映される
      await expect(async () => {
        const fontSizeValue = await sidePanelPage.locator('input#fontSize').inputValue();
        expect(fontSizeValue).toBe('18');
      }).toPass({ timeout: 5000 });

      await expect(async () => {
        const fontFamilyValue = await sidePanelPage.locator('input#fontFamily').inputValue();
        expect(fontFamilyValue).toContain('Consolas');
      }).toPass({ timeout: 5000 });
    });
  });

  test.describe('複数の設定項目の一括保存', () => {
    test('複数の設定項目を一括で保存した場合、トランザクション的に処理される', async ({
      serviceWorker,
    }) => {
      // Arrange: 複数の設定項目を準備
      const multipleSettings = {
        setting1: { value: 'value1', timestamp: Date.now() },
        setting2: { value: 'value2', timestamp: Date.now() },
        setting3: { value: 'value3', timestamp: Date.now() },
        setting4: { value: 'value4', timestamp: Date.now() },
        setting5: { value: 'value5', timestamp: Date.now() },
      };

      // Act: 一括で保存
      const saveResult = await serviceWorker.evaluate(async (settings) => {
        return new Promise<{ success: boolean; error?: string }>((resolve) => {
          chrome.storage.local.set(settings, () => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve({ success: true });
            }
          });
        });
      }, multipleSettings);

      // Assert: 保存が成功する
      expect(saveResult.success).toBe(true);

      // Verify: すべての設定が保存されていることを確認
      const verifyResult = await serviceWorker.evaluate(async () => {
        return new Promise<{ success: boolean; data?: Record<string, unknown> }>((resolve) => {
          chrome.storage.local.get(
            ['setting1', 'setting2', 'setting3', 'setting4', 'setting5'],
            (result) => {
              if (chrome.runtime.lastError) {
                resolve({ success: false });
              } else {
                resolve({ success: true, data: result });
              }
            }
          );
        });
      });

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.data?.setting1).toBeDefined();
      expect(verifyResult.data?.setting2).toBeDefined();
      expect(verifyResult.data?.setting3).toBeDefined();
      expect(verifyResult.data?.setting4).toBeDefined();
      expect(verifyResult.data?.setting5).toBeDefined();
    });

    test('一括保存後に個別に読み込んでも整合性が保たれる', async ({
      serviceWorker,
    }) => {
      // Arrange: テストデータを保存
      const testData = {
        config1: { id: 1, name: 'Config 1' },
        config2: { id: 2, name: 'Config 2' },
      };

      await serviceWorker.evaluate(async (data) => {
        return new Promise<void>((resolve) => {
          chrome.storage.local.set(data, () => {
            resolve();
          });
        });
      }, testData);

      // Act: 個別に読み込み
      const result1 = await serviceWorker.evaluate(async () => {
        return new Promise<unknown>((resolve) => {
          chrome.storage.local.get(['config1'], (result) => {
            resolve(result.config1);
          });
        });
      });

      const result2 = await serviceWorker.evaluate(async () => {
        return new Promise<unknown>((resolve) => {
          chrome.storage.local.get(['config2'], (result) => {
            resolve(result.config2);
          });
        });
      });

      // Assert: 整合性が保たれている
      expect(result1).toEqual(testData.config1);
      expect(result2).toEqual(testData.config2);
    });
  });

  test.describe('chrome.storage.local.remove()', () => {
    test('指定したキーのデータを削除できる', async ({
      serviceWorker,
    }) => {
      // Arrange: データを保存
      await serviceWorker.evaluate(async () => {
        return new Promise<void>((resolve) => {
          chrome.storage.local.set({ toBeDeleted: 'value', toRemain: 'value' }, () => {
            resolve();
          });
        });
      });

      // Act: 特定のキーを削除
      const removeResult = await serviceWorker.evaluate(async () => {
        return new Promise<{ success: boolean }>((resolve) => {
          chrome.storage.local.remove(['toBeDeleted'], () => {
            if (chrome.runtime.lastError) {
              resolve({ success: false });
            } else {
              resolve({ success: true });
            }
          });
        });
      });

      // Assert: 削除が成功する
      expect(removeResult.success).toBe(true);

      // Verify: 削除されたキーはundefined、残ったキーは値がある
      const verifyResult = await serviceWorker.evaluate(async () => {
        return new Promise<Record<string, unknown>>((resolve) => {
          chrome.storage.local.get(['toBeDeleted', 'toRemain'], (result) => {
            resolve(result);
          });
        });
      });

      expect(verifyResult.toBeDeleted).toBeUndefined();
      expect(verifyResult.toRemain).toBe('value');
    });
  });

  test.describe('chrome.storage.local.clear()', () => {
    test('すべてのデータをクリアできる', async ({
      serviceWorker,
    }) => {
      // Arrange: 複数のデータを保存
      await serviceWorker.evaluate(async () => {
        return new Promise<void>((resolve) => {
          chrome.storage.local.set(
            {
              clearTest1: 'value1',
              clearTest2: 'value2',
              clearTest3: 'value3',
            },
            () => {
              resolve();
            }
          );
        });
      });

      // Act: すべてのデータをクリア
      const clearResult = await serviceWorker.evaluate(async () => {
        return new Promise<{ success: boolean }>((resolve) => {
          chrome.storage.local.clear(() => {
            if (chrome.runtime.lastError) {
              resolve({ success: false });
            } else {
              resolve({ success: true });
            }
          });
        });
      });

      // Assert: クリアが成功する
      expect(clearResult.success).toBe(true);

      // Verify: すべてのデータが削除されている
      const verifyResult = await serviceWorker.evaluate(async () => {
        return new Promise<Record<string, unknown>>((resolve) => {
          chrome.storage.local.get(['clearTest1', 'clearTest2', 'clearTest3'], (result) => {
            resolve(result);
          });
        });
      });

      expect(verifyResult.clearTest1).toBeUndefined();
      expect(verifyResult.clearTest2).toBeUndefined();
      expect(verifyResult.clearTest3).toBeUndefined();
    });
  });

  test.describe('ストレージ容量の確認', () => {
    test('chrome.storage.local.getBytesInUse()で使用容量を取得できる', async ({
      serviceWorker,
    }) => {
      // Arrange: データを保存
      await serviceWorker.evaluate(async () => {
        return new Promise<void>((resolve) => {
          chrome.storage.local.set({ bytesTestData: 'Some test data for bytes calculation' }, () => {
            resolve();
          });
        });
      });

      // Act: 使用容量を取得
      const bytesResult = await serviceWorker.evaluate(async () => {
        return new Promise<{ success: boolean; bytes?: number }>((resolve) => {
          chrome.storage.local.getBytesInUse(['bytesTestData'], (bytes) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false });
            } else {
              resolve({ success: true, bytes });
            }
          });
        });
      });

      // Assert: 使用容量が取得できる
      expect(bytesResult.success).toBe(true);
      expect(bytesResult.bytes).toBeGreaterThan(0);
    });
  });
});
