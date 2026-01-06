import { test, expect } from '@playwright/test';
import { existsSync } from 'fs';
import { join } from 'path';

test.describe('E2Eディレクトリ構造', () => {
  test('必要なサブディレクトリが存在すること', () => {
    const e2eDir = join(process.cwd(), 'e2e');

    expect(existsSync(e2eDir)).toBe(true);

    expect(existsSync(join(e2eDir, 'fixtures'))).toBe(true);
    expect(existsSync(join(e2eDir, 'utils'))).toBe(true);
    expect(existsSync(join(e2eDir, 'test-data'))).toBe(true);
  });

  test('テストファイルの命名規則が正しいこと', () => {
    const testFile = join(process.cwd(), 'e2e', 'directory-structure.spec.ts');

    expect(testFile).toMatch(/\.spec\.ts$/);
  });
});
