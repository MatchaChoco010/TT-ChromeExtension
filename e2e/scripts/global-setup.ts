import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Playwright Global Setup
 * テスト実行前に拡張機能をビルドする
 *
 * Requirements: 2 - Chrome拡張機能のロードとテスト実行基盤
 */
async function globalSetup() {
  console.log('🔨 E2Eテスト実行前にビルドを開始します...');

  try {
    // vite build を直接実行（TypeScriptエラーがある場合でもビルド可能）
    execSync('npx vite build', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    console.log('✅ ビルドが正常に完了しました');

    // dist/ ディレクトリが存在することを確認
    const distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distPath)) {
      throw new Error(
        '❌ ビルドエラー: dist/ディレクトリが見つかりません。ビルドプロセスを確認してください。'
      );
    }

    // manifest.json が存在することを確認
    const manifestPath = path.join(distPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(
        '❌ ビルドエラー: dist/manifest.jsonが見つかりません。拡張機能のビルドが不完全です。'
      );
    }

    console.log('✅ ビルド成果物の検証が完了しました');
    console.log(`📦 拡張機能は ${distPath} にビルドされました`);
  } catch (error) {
    // ビルド失敗時の詳細なエラーメッセージ
    console.error('❌ ビルドプロセスでエラーが発生しました');

    if (error instanceof Error) {
      console.error(`エラーメッセージ: ${error.message}`);
    }

    console.error('\n📋 トラブルシューティング:');
    console.error('1. package.jsonの"build"スクリプトが正しく定義されているか確認してください');
    console.error('2. npm install で依存関係が正しくインストールされているか確認してください');
    console.error('3. TypeScriptの型エラーがないか npm run type-check で確認してください');
    console.error('4. 手動で npm run build を実行してビルドログを確認してください\n');

    // ビルドエラーでテスト実行を中止
    process.exit(1);
  }
}

export default globalSetup;
