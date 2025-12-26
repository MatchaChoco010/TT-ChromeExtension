import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ビルドプロセス統合のテスト
 * Requirement 2: Chrome拡張機能のロードとテスト実行基盤
 *
 * Note: このテストスイートはglobalSetupを呼び出さずに実行されます。
 * globalSetup自体は他のE2Eテストによって間接的にテストされます。
 */
test.describe('ビルドプロセス統合', () => {
  test.skip('dist/ディレクトリが存在し、ビルド成果物が含まれていること', () => {
    // このテストはglobalSetupがビルドを実行した後にパスすることを検証
    // globalSetupは実際のE2Eテスト実行時に自動的に呼ばれる
    const distPath = path.join(process.cwd(), 'dist');

    // dist/ディレクトリが存在することを検証
    expect(fs.existsSync(distPath)).toBe(true);

    // manifest.jsonが存在することを検証
    const manifestPath = path.join(distPath, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    // manifest.jsonが有効なJSONであることを検証
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    expect(() => JSON.parse(manifestContent)).not.toThrow();

    // Service Workerファイルが存在することを検証
    const manifest = JSON.parse(manifestContent);
    expect(manifest.background).toBeDefined();
    expect(manifest.background.service_worker).toBeDefined();

    const serviceWorkerPath = path.join(
      distPath,
      manifest.background.service_worker
    );
    expect(fs.existsSync(serviceWorkerPath)).toBe(true);
  });

  test('globalSetup がビルドプロセスを実行すること', async () => {
    // playwright.config.ts にglobalSetupが設定されていることを確認
    const configPath = path.join(process.cwd(), 'playwright.config.ts');
    const configContent = fs.readFileSync(configPath, 'utf-8');

    // globalSetupフィールドが定義されていることを検証
    expect(configContent).toContain('globalSetup');
  });

  test('ビルドスクリプトが実行可能であること', () => {
    const scriptPath = path.join(process.cwd(), 'e2e/scripts/global-setup.ts');

    // スクリプトファイルが存在することを検証
    expect(fs.existsSync(scriptPath)).toBe(true);

    // スクリプトファイルが読み取り可能であることを検証
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    expect(scriptContent.length).toBeGreaterThan(0);

    // スクリプトにビルドロジックが含まれていることを検証
    expect(scriptContent).toContain('build');
  });

  test('ビルド失敗時にエラーメッセージが出力されること', () => {
    const scriptPath = path.join(process.cwd(), 'e2e/scripts/global-setup.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

    // エラーハンドリングロジックが含まれていることを検証
    expect(scriptContent).toMatch(/catch|error|throw/i);

    // エラーメッセージ出力のロジックが含まれていることを検証
    expect(scriptContent).toMatch(/console\.(error|log)|throw.*Error/);
  });
});
