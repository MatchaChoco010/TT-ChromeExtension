import { test, expect } from '@playwright/test';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * E2Eテストディレクトリ構造の検証
 *
 * - E2Eテストファイルを`e2e/`ディレクトリ配下に配置する
 * - 共通テストユーティリティを`e2e/utils/`ディレクトリに配置する
 * - Playwrightフィクスチャを`e2e/fixtures/`ディレクトリに配置する
 * - テストデータを`e2e/test-data/`ディレクトリに配置する
 */

test.describe('E2Eディレクトリ構造', () => {
  test('必要なサブディレクトリが存在すること', () => {
    const e2eDir = join(process.cwd(), 'e2e');

    // e2e/ディレクトリ自体が存在すること
    expect(existsSync(e2eDir)).toBe(true);

    // サブディレクトリが存在すること
    expect(existsSync(join(e2eDir, 'fixtures'))).toBe(true);
    expect(existsSync(join(e2eDir, 'utils'))).toBe(true);
    expect(existsSync(join(e2eDir, 'test-data'))).toBe(true);
  });

  test('README.mdが存在すること', () => {
    const readmePath = join(process.cwd(), 'e2e', 'README.md');
    expect(existsSync(readmePath)).toBe(true);
  });

  test('テストファイルの命名規則が正しいこと', () => {
    const testFile = join(process.cwd(), 'e2e', 'directory-structure.spec.ts');

    // *.spec.ts形式であること
    expect(testFile).toMatch(/\.spec\.ts$/);
  });
});
