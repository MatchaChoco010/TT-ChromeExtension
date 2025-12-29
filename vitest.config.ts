import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

// サンドボックス環境対応: 一時ディレクトリをリポジトリ内に設定
const tmpDir = path.resolve(__dirname, '.vitest-tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// 環境変数を設定して一時ディレクトリを変更
process.env.TMPDIR = tmpDir;
process.env.TMP = tmpDir;
process.env.TEMP = tmpDir;

export default defineConfig({
  // キャッシュディレクトリをリポジトリ内に設定（Vite's cacheDir）
  cacheDir: path.resolve(__dirname, '.vitest-tmp/cache'),
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
