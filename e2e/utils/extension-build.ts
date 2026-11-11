/**
 * E2Eテストで読み込む拡張機能のビルド出力先
 *
 * ローカルのブラウザが読み込む本番用のdist/とは分ける。
 * テストのたびにdist/を上書きすると、ブラウザで動作中の拡張機能がテスト途中のビルドを読み込んでしまうため
 */
import path from 'path';
import { fileURLToPath } from 'url';

export const E2E_EXTENSION_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist-e2e');
