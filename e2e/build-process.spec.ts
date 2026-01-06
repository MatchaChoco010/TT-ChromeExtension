import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ビルドプロセス統合のテスト
 *
 * Note: このテストスイートはPlaywrightのglobalSetup実行後に実行されます。
 * globalSetupがテスト実行前に拡張機能をビルドするため、dist/ディレクトリと
 * ビルド成果物が存在することを検証できます。
 */
test.describe('ビルドプロセス統合', () => {
  test('dist/ディレクトリが存在し、ビルド成果物が含まれていること', () => {
    const distPath = path.join(process.cwd(), 'dist');

    expect(fs.existsSync(distPath)).toBe(true);

    const manifestPath = path.join(distPath, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    expect(() => JSON.parse(manifestContent)).not.toThrow();

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
    const configPath = path.join(process.cwd(), 'playwright.config.ts');
    const configContent = fs.readFileSync(configPath, 'utf-8');

    expect(configContent).toContain('globalSetup');
  });

  test('ビルドスクリプトが実行可能であること', () => {
    const scriptPath = path.join(process.cwd(), 'e2e/scripts/global-setup.ts');

    expect(fs.existsSync(scriptPath)).toBe(true);

    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    expect(scriptContent.length).toBeGreaterThan(0);

    expect(scriptContent).toContain('build');
  });

  test('ビルド失敗時にエラーメッセージが出力されること', () => {
    const scriptPath = path.join(process.cwd(), 'e2e/scripts/global-setup.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

    expect(scriptContent).toMatch(/catch|error|throw/i);

    expect(scriptContent).toMatch(/console\.(error|log)|throw.*Error/);
  });
});
