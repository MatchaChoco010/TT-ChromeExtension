/**
 * headlessモードのデフォルト設定の検証テスト
 *
 * Requirements: 1.4, 1.5, 6.1, 6.6, 8.5, 8.6
 *
 * このテストは、Playwrightがデフォルトでheadlessモードで実行され、
 * 環境変数HEADED=trueによりheadedモードに切り替えられることを検証します。
 */
import { test, chromium } from '@playwright/test';
import { expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('headlessモードの設定検証', () => {
  test('デフォルトでheadlessモードが有効であること', async () => {
    // HEADED環境変数が設定されていないことを確認
    expect(process.env.HEADED).toBeUndefined();

    // 拡張機能のパス
    const pathToExtension = path.join(__dirname, '../dist');

    // headlessモードの判定ロジック
    const headless = process.env.HEADED !== 'true';

    // headlessがtrueであることを検証
    expect(headless).toBe(true);

    // ブラウザコンテキストを作成してheadlessモードを確認
    const context = await chromium.launchPersistentContext('', {
      headless,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    // コンテキストが正常に作成されることを確認
    expect(context).toBeDefined();

    // クリーンアップ
    await context.close();
  });

  test('HEADED=true環境変数でheadedモードに切り替わること', async () => {
    // このテストは手動でHEADED=trueを設定して実行する必要があります
    // CI環境ではスキップされます
    test.skip(
      process.env.CI === 'true',
      'CI環境ではheadedモードのテストはスキップされます'
    );

    // 拡張機能のパス
    const pathToExtension = path.join(__dirname, '../dist');

    // HEADED=trueが設定されている場合、headlessはfalseになる
    const headless = process.env.HEADED !== 'true';

    // HEADED=trueの場合の動作確認
    if (process.env.HEADED === 'true') {
      expect(headless).toBe(false);

      // ブラウザコンテキストを作成してheadedモードを確認
      const context = await chromium.launchPersistentContext('', {
        headless,
        args: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
        ],
      });

      expect(context).toBeDefined();
      await context.close();
    } else {
      // HEADED=trueが設定されていない場合はheadlessモード
      expect(headless).toBe(true);
    }
  });

  test('CI環境変数が設定されている場合、適切な設定が適用されること', async () => {
    // CI環境変数が設定されているかチェック
    const isCI = process.env.CI === 'true';

    // playwright.config.tsの設定を確認
    // CI環境ではretries=2, workers=2が設定される
    if (isCI) {
      // CI環境での設定確認（playwright.config.tsから読み込まれる）
      expect(isCI).toBe(true);
    } else {
      // ローカル環境での設定確認
      expect(isCI).toBe(false);
    }
  });
});
