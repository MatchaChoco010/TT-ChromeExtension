# E2Eテストディレクトリ

このディレクトリには、Playwright for Chrome Extensionsを使用したE2Eテストが含まれています。

## ディレクトリ構造

```
e2e/
├── fixtures/           # カスタムフィクスチャ（拡張機能ロード等）
├── utils/             # テストユーティリティ（タブ操作、ドラッグ&ドロップ等）
├── test-data/         # テストデータとモック
└── *.spec.ts          # テストシナリオファイル
```

## ディレクトリの役割

### `fixtures/`
拡張機能のロードとService Worker待機を自動化するカスタムフィクスチャを配置します。

- `extension.ts` - ExtensionFixture定義

### `utils/`
テストで共通して使用するヘルパー関数を配置します。

- `tab-utils.ts` - タブ作成・削除・アクティブ化などの共通操作
- `drag-drop-utils.ts` - ドラッグ&ドロップ操作のシミュレーション
- `side-panel-utils.ts` - Side Panel操作のヘルパー関数
- `window-utils.ts` - ウィンドウ操作のヘルパー関数
- `service-worker-utils.ts` - Service Worker通信のヘルパー関数

### `test-data/`
テストで使用するフィクスチャデータやシナリオを配置します。

- `tab-tree-fixtures.ts` - タブツリーのテストデータ
- `drag-drop-scenarios.ts` - ドラッグ&ドロップシナリオ

## 命名規則

- テストファイル: `*.spec.ts`
- フィクスチャ: PascalCase（例: `ExtensionFixture`）
- ユーティリティ: camelCase（例: `createTab`, `dragTabToParent`）

## テスト実行

```bash
# すべてのE2Eテストを実行
npm run test:e2e

# UIモードでテストを実行
npm run test:e2e:ui

# デバッグモードでテストを実行
npm run test:e2e:debug

# テストレポートを表示
npm run test:e2e:report
```
