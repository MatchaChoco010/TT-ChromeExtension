import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { E2E_EXTENSION_DIR } from '../utils/extension-build';

async function globalSetup() {
  const playwrightTmpDir = path.join(process.cwd(), '.playwright-tmp');
  if (fs.existsSync(playwrightTmpDir)) {
    fs.rmSync(playwrightTmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(playwrightTmpDir, { recursive: true });

  console.log('🔨 E2Eテスト実行前にビルドを開始します...');

  try {
    execSync(`npx vite build --outDir "${E2E_EXTENSION_DIR}" --emptyOutDir`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    console.log('✅ ビルドが正常に完了しました');

    const distPath = E2E_EXTENSION_DIR;
    if (!fs.existsSync(distPath)) {
      throw new Error(
        `❌ ビルドエラー: ${distPath} が見つかりません。ビルドプロセスを確認してください。`
      );
    }

    const manifestPath = path.join(distPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(
        `❌ ビルドエラー: ${manifestPath} が見つかりません。拡張機能のビルドが不完全です。`
      );
    }

    console.log('✅ ビルド成果物の検証が完了しました');
    console.log(`📦 拡張機能は ${distPath} にビルドされました`);
  } catch (error) {
    console.error('❌ ビルドプロセスでエラーが発生しました');

    if (error instanceof Error) {
      console.error(`エラーメッセージ: ${error.message}`);
    }

    console.error('\n📋 トラブルシューティング:');
    console.error('1. package.jsonの"build"スクリプトが正しく定義されているか確認してください');
    console.error('2. npm install で依存関係が正しくインストールされているか確認してください');
    console.error('3. TypeScriptの型エラーがないか npm run type-check で確認してください');
    console.error('4. 手動で npm run build を実行してビルドログを確認してください\n');

    process.exit(1);
  }
}

export default globalSetup;
