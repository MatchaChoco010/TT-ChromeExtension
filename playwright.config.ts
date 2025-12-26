import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright設定ファイル
 * Chrome拡張機能のE2Eテストを実行するための設定
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // グローバルセットアップ（テスト実行前に拡張機能をビルド）
  globalSetup: './e2e/scripts/global-setup.ts',

  // テストディレクトリ
  testDir: './e2e',

  // テストファイルのパターン
  testMatch: '**/*.spec.ts',

  // グローバルタイムアウト設定
  timeout: 30000, // 30秒

  // アサーションタイムアウト
  expect: {
    timeout: 5000, // 5秒
  },

  // リトライ戦略（CI環境では2回リトライ）
  retries: process.env.CI ? 2 : 0,

  // 並列実行設定（CI環境では2ワーカー）
  workers: process.env.CI ? 2 : undefined,

  // レポート設定
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],

  // テスト実行時の共通設定
  use: {
    // トレース設定（初回リトライ時に記録）
    trace: 'on-first-retry',

    // スクリーンショット設定（失敗時のみ）
    screenshot: 'only-on-failure',

    // ビデオ録画設定（失敗時のみ保持）
    video: 'retain-on-failure',
  },

  // プロジェクト設定（Chromiumのみ）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
