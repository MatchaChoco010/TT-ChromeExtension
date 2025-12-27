# Implementation Plan

## タスク概要

本仕様では、Playwright for Chrome Extensionsを活用した真のE2Eテスト環境を構築します。実ブラウザ（Chromium）上でChrome拡張機能として動作するVivaldi-TTの主要機能を自動検証し、既存のVitestテストと共存する形で段階的に導入します。

**重要**: 全てのE2Eテストタスクは、テストコードの実装だけでなく、テストをPASS(GREEN状態)にするために必要な機能実装も含みます。タスク完了の条件は「全てのテストがヘッドレスモードで成功すること」です。

## 実装タスク

- [x] 1. Playwrightテスト環境の基盤構築
- [x] 1.1 (P) Playwrightパッケージのインストールと設定ファイル作成
  - `@playwright/test`パッケージをdevDependenciesに追加
  - `playwright.config.ts`を作成し、Chromiumブラウザ設定、タイムアウト（30秒）、リトライ戦略（CI環境で2回）を定義
  - headless/headedモードの環境変数制御、レポート設定（HTML、JUnit XML）、失敗時のスクリーンショット・トレース保存を含める
  - _Requirements: 1, 6, 8, 9_

- [x] 1.2 (P) npmスクリプトの追加
  - `package.json`に`test:e2e`, `test:e2e:ui`, `test:e2e:debug`, `test:e2e:report`, `test:all`スクリプトを追加
  - `test:e2e`でPlaywrightテストを実行、`test:all`でVitestとPlaywrightの両方を順次実行
  - _Requirements: 1, 7_

- [x] 1.3 (P) E2Eテストディレクトリ構造の作成
  - `e2e/`ディレクトリをプロジェクトルートに作成
  - `e2e/fixtures/`, `e2e/utils/`, `e2e/test-data/`サブディレクトリを作成
  - `tsconfig.json`の`include`配列に`"e2e/**/*"`を追加
  - _Requirements: 5_

- [x] 1.4 (P) headlessモードのデフォルト設定の実装と検証
  - `playwright.config.ts`でブラウザ起動時にデフォルトでheadlessモードを有効にする設定を実装
  - ExtensionFixtureで`headless: process.env.HEADED !== 'true'`を実装し、環境変数によるheadedモードへの切り替えを可能にする
  - `test:e2e`スクリプトがデフォルトでheadlessモードで実行されることを検証するテストを作成
  - `test:e2e:debug`スクリプトが`HEADED=true`環境変数を設定してheadedモードで実行されることを検証
  - CI環境変数`CI=true`が設定されている場合、適切な設定（並列実行、リトライ等）が自動適用されることを確認
  - headless/headedモード切り替えの動作を検証する簡単なE2Eテストを作成
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 1.4, 1.5, 6.1, 6.6, 8.5, 8.6_

- [x] 2. 拡張機能ロード基盤の実装
- [x] 2.1 ExtensionFixtureの実装
  - `e2e/fixtures/extension.ts`を作成し、カスタムフィクスチャを定義
  - `launchPersistentContext`でChromiumブラウザを起動し、`dist/`ディレクトリから拡張機能をロード
  - `waitForEvent('serviceworker')`でService Workerの起動完了を待機し、Extension IDを抽出
  - `extensionContext`, `extensionId`, `serviceWorker`, `sidePanelPage`フィクスチャを提供
  - テスト終了後のブラウザコンテキストクリーンアップを実装
  - _Requirements: 2_

- [x] 2.2 ビルドプロセスの統合
  - テスト実行前に`npm run build`を自動実行するスクリプトを作成（`e2e/scripts/pre-test.sh`）
  - `playwright.config.ts`の`globalSetup`でビルドプロセスを統合
  - ビルド失敗時の明確なエラーメッセージ出力を実装
  - _Requirements: 2_

- [x] 3. テストユーティリティの実装
- [x] 3.1 (P) TabTestUtilsの実装
  - `e2e/utils/tab-utils.ts`を作成
  - タブ作成（`createTab`）、削除（`closeTab`）、アクティブ化（`activateTab`）の共通ヘルパー関数を実装
  - ツリー内のタブノード検証（`assertTabInTree`, `assertTabNotInTree`）を実装
  - 未読バッジ検証（`assertUnreadBadge`）を実装
  - `waitForSelector`で要素の出現を待機し、タブIDとツリーノードの`data-tab-id`属性を紐付けて検証
  - _Requirements: 3.1, 3.13, 4.1_

- [x] 3.2 (P) DragDropUtilsの実装
  - `e2e/utils/drag-drop-utils.ts`を作成
  - ドラッグ開始（`startDrag`）、ホバー（`hoverOverTab`）、ドロップ（`dropTab`）のシミュレーション関数を実装
  - 同階層並び替え（`reorderTabs`）、親子関係作成（`moveTabToParent`）の高レベルヘルパー関数を実装
  - ドロップインジケータ検証（`assertDropIndicator`）、ホバー自動展開検証（`assertAutoExpand`）を実装
  - Playwrightの`locator.dragTo()`または低レベルマウスイベント（`mouse.down()`, `mouse.move()`, `mouse.up()`）を使用
  - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [x] 3.3 (P) SidePanelUtilsの実装
  - `e2e/utils/side-panel-utils.ts`を作成
  - Side Panelを開く（`openSidePanel`）、ツリー表示検証（`assertTreeVisible`）を実装
  - リアルタイム更新検証（`assertRealTimeUpdate`）、スクロール動作検証（`assertSmoothScrolling`）を実装
  - `chrome-extension://${extensionId}/sidepanel.html`をPage.gotoで開き、`waitForSelector`でツリー表示を待機
  - _Requirements: 3.7_

- [x] 3.4 (P) WindowTestUtilsの実装
  - `e2e/utils/window-utils.ts`を作成
  - 新しいウィンドウ作成（`createWindow`）、タブのウィンドウ間移動（`moveTabToWindow`）を実装
  - クロスウィンドウドラッグ&ドロップ（`dragTabToWindow`）、ウィンドウツリー同期検証（`assertWindowTreeSync`）を実装
  - Chrome Windows APIとPlaywright Context APIを組み合わせて複数Pageを管理
  - _Requirements: 3.6, 4.2_

- [x] 3.5 (P) ServiceWorkerUtilsの実装
  - `e2e/utils/service-worker-utils.ts`を作成
  - Service Workerへのメッセージ送信（`sendMessageToServiceWorker`）、メッセージ待機（`waitForMessageFromServiceWorker`）を実装
  - イベントリスナー登録検証（`assertEventListenersRegistered`）、ライフサイクル検証（`assertServiceWorkerLifecycle`）を実装
  - Playwright Worker APIの`worker.evaluate()`でService Worker内のコード実行
  - _Requirements: 4.5_

- [x] 4. コアユーザーフローのE2Eテスト実装と機能実装

**重要**: 本セクションの全てのタスクは、E2Eテストの実装に加えて、テストをPASSさせるために必要な機能（Side Panel UI、ドラッグ&ドロップ、ビュー切り替え等）の実装も含みます。タスク完了の条件は「全てのテストが `npm run test:e2e` (ヘッドレスモード) で成功すること」です。

- [x] 4.1 (P) タブライフサイクルとツリー構造の基本操作の実装とテスト
  - `e2e/tab-lifecycle.spec.ts`を作成し、タブライフサイクルとツリー構造の基本操作を検証するE2Eテストを実装
  - Side Panel UIにTabTreeViewコンポーネントを統合し、タブツリーをリアルタイムで表示する機能を実装
  - タブ作成時のツリーノード追加、親タブからの子タブ作成時の親子関係確立を実装
  - タブ削除時のツリーノード削除、タブタイトル・URL変更時のリアルタイム更新、タブアクティブ化時のハイライト表示を実装
  - TabTestUtilsとSidePanelUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 3.1_

- [x] 4.2 (P) ドラッグ&ドロップによるタブの並び替え（同階層）の実装とテスト
  - `e2e/drag-drop-reorder.spec.ts`を作成し、同階層でのタブ並び替えを検証するE2Eテストを実装
  - ドラッグ&ドロップによる同階層でのタブ並び替え機能を実装
  - ルートレベルのタブ間での並び替え、同じ親の子タブ間での並び替え、ドロップインジケータの表示を実装
  - DragDropUtilsとTabTestUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 3.2_

- [x] 4.3 (P) ドラッグ&ドロップによる階層変更（親子関係の作成）の実装とテスト
  - `e2e/drag-drop-hierarchy.spec.ts`を作成し、親子関係の作成を検証するE2Eテストを実装
  - ドラッグ&ドロップによる親子関係作成機能を実装
  - タブを別のタブに重ねてドロップした際の親子関係作成、展開/折りたたみアイコン表示、自動展開を実装
  - DragDropUtilsとTabTestUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 3.3_

- [x] 4.4 (P) ドラッグ&ドロップによる複雑なツリー移動の実装とテスト
  - `e2e/drag-drop-complex.spec.ts`を作成し、複雑なツリー移動を検証するE2Eテストを実装
  - サブツリー全体の一括移動、depth再計算、循環参照防止、展開状態保持の機能を実装
  - DragDropUtilsとTabTestUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 3.4_

- [x] 4.5 (P) ドラッグ&ドロップのホバー自動展開の実装とテスト
  - `e2e/drag-drop-hover.spec.ts`を作成し、ホバー自動展開を検証するE2Eテストを実装
  - 折りたたまれた親タブ上でのホバー時の自動展開機能を実装
  - タイムアウト前のホバー離脱時のキャンセル、深いツリー構造での順次自動展開を実装
  - DragDropUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 3.5_

- [x] 4.6 (P) クロスウィンドウドラッグ&ドロップの実装とテスト
  - `e2e/cross-window.spec.ts`を作成し、クロスウィンドウドラッグ&ドロップを検証するE2Eテストを実装
  - タブのパネル外ドラッグアウト時の新しいウィンドウ作成機能を実装
  - タブの別ウィンドウへの移動、サブツリー一括移動、ウィンドウツリー状態同期を実装
  - WindowTestUtilsとDragDropUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 3.6_

- [x] 4.7 (P) Side Panelの表示とリアルタイム更新の実装とテスト
  - `e2e/side-panel.spec.ts`を作成し、Side Panelの表示とリアルタイム更新を検証するE2Eテストを実装
  - Side Panelでの現在のタブツリー表示、リアルタイム更新、favIcon更新を実装
  - 大量タブ（100個以上）のスムーズなスクロール・レンダリング、展開/折りたたみアニメーションを実装
  - SidePanelUtilsとTabTestUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 3.7_

- [x] 4.8 (P) ビュー切り替え機能の実装とテスト
  - `e2e/view-switching.spec.ts`を作成し、ビュー切り替え機能を検証するE2Eテストを実装
  - "All Tabs"/"Current Window"ビューの切り替え機能を実装
  - カスタムビューの作成、削除、名前・色変更機能を実装
  - SidePanelUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 3.8_

- [x] 4.9 (P) グループ機能の実装とテスト
  - `e2e/groups.spec.ts`を作成し、グループ機能を検証するE2Eテストを実装
  - タブのグループ追加、グループ作成、展開/折りたたみ機能を実装
  - グループ削除、タブのグループ間移動機能を実装
  - TabTestUtilsとSidePanelUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 3.9_

- [x] 4.10 (P) スナップショット機能の実装とテスト
  - `e2e/snapshots.spec.ts`を作成し、スナップショット機能を検証するE2Eテストを実装
  - スナップショットの保存、復元、削除機能を実装
  - 複数スナップショットの管理、自動スナップショット機能を実装
  - `e2e/test-data/snapshot-fixtures.ts`でテストデータを定義
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 3.10_

- [x] 4.11 (P) コンテキストメニュー操作の実装とテスト
  - `e2e/context-menu.spec.ts`を作成し、コンテキストメニュー操作を検証するE2Eテストを実装
  - タブノード右クリック時のコンテキストメニュー表示機能を実装
  - "タブを閉じる"、"サブツリーを閉じる"、"グループに追加"、"新しいウィンドウで開く"、"URLをコピー"の各機能を実装
  - TabTestUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 3.11_

- [x] 4.12 (P) 設定変更とUI/UXカスタマイゼーションの実装とテスト
  - `e2e/settings.spec.ts`を作成し、設定変更とカスタマイゼーションを検証するE2Eテストを実装
  - 設定パネルの表示、フォントサイズ・ファミリー変更機能を実装
  - テーマ（ライト/ダーク）切り替え、カスタムカラー設定、インデント幅変更機能を実装
  - 設定の永続化機能を実装
  - SidePanelUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 3.12_

- [x] 4.13 (P) 未読インジケータ機能の実装とテスト
  - `e2e/unread-indicator.spec.ts`を作成し、未読インジケータ機能を検証するE2Eテストを実装
  - タブのバックグラウンド読み込み時の未読バッジ表示機能を実装
  - 未読タブアクティブ化時のバッジ消去、親タブへの未読インジケータ表示、未読数カウント表示を実装
  - TabTestUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 3.13_

- [x] 4.14 (P) エラーハンドリングとエッジケースの実装とテスト
  - `e2e/error-handling.spec.ts`を作成し、エラーハンドリングとエッジケースを検証するE2Eテストを実装
  - ネットワークエラー時のエラーアイコン表示、IndexedDB書き込み失敗時のエラーメッセージ表示を実装
  - 拡張機能の権限不足時の警告表示、長いタブタイトルのテキスト省略、無効なURLのデフォルトアイコン表示を実装
  - TabTestUtilsとSidePanelUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 3.14_

- [x] 5. ブラウザAPI統合テストと機能実装

**重要**: 本セクションの全てのタスクは、E2Eテストの実装に加えて、テストをPASSさせるために必要なChrome API統合機能の実装も含みます。タスク完了の条件は「全てのテストが `npm run test:e2e` (ヘッドレスモード) で成功すること」です。

- [x] 5.1 (P) chrome.tabs API統合の実装とテスト
  - `e2e/chrome-api-tabs.spec.ts`を作成し、chrome.tabs APIとの統合を検証するE2Eテストを実装
  - `chrome.tabs.create()`, `chrome.tabs.remove()`, `chrome.tabs.update()`, `chrome.tabs.query()`の統合機能を実装
  - `chrome.tabs.onCreated`, `onRemoved`, `onUpdated`, `onActivated`イベントハンドリングとツリーリアルタイム更新を実装
  - TabTestUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 4.1_

- [x] 5.2 (P) chrome.windows API統合の実装とテスト
  - `e2e/chrome-api-windows.spec.ts`を作成し、chrome.windows APIとの統合を検証するE2Eテストを実装
  - `chrome.windows.create()`, `chrome.windows.remove()`, `chrome.windows.update()`, `chrome.windows.getAll()`の統合機能を実装
  - 複数ウィンドウ存在時の各ウィンドウのタブツリーの独立管理を実装
  - WindowTestUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 4.2_

- [x] 5.3 (P) IndexedDB統合の実装とテスト
  - `e2e/indexeddb.spec.ts`を作成し、IndexedDB統合を検証するE2Eテストを実装
  - ツリー状態のIndexedDB保存・読み込み機能を実装
  - 大量のタブデータ（1000個以上）の処理、クォータ超え時のエラーハンドリング、ブラウザ再起動後の状態復元を実装
  - `e2e/test-data/indexeddb-fixtures.ts`でテストデータを定義
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 4.3_

- [x] 5.4 (P) chrome.storage API統合の実装とテスト
  - `e2e/chrome-storage.spec.ts`を作成し、chrome.storage APIとの統合を検証するE2Eテストを実装
  - `chrome.storage.local.set()`, `chrome.storage.local.get()`の統合機能を実装
  - `chrome.storage.onChanged`イベントハンドリングとUIの更新を実装
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 4.4_

- [x] 5.5 (P) Service Workerとの通信の実装とテスト
  - `e2e/service-worker.spec.ts`を作成し、Service Workerとの通信を検証するE2Eテストを実装
  - Side PanelからService Workerへのメッセージ送信機能を実装
  - Service WorkerからSide Panelへのメッセージ送信、タブイベント処理時のツリー状態バックグラウンド同期を実装
  - Service Worker再起動時の状態復元、長時間非アクティブ後の通信再確立を実装
  - ServiceWorkerUtilsを活用
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 4.5_

- [x] 6. CI/CD統合とレポート生成
- [x] 6.1 GitHub Actionsワークフローの作成
  - `.github/workflows/e2e-tests.yml`を作成
  - Node.js 20のセットアップ、依存関係インストール（`npm ci`）、Playwrightブラウザインストール（`npx playwright install --with-deps chromium`）を定義
  - 拡張機能ビルド（`npm run build`）、E2Eテスト実行（`npx playwright test`）、環境変数`CI=true`の設定を定義
  - 失敗時のPlaywrightレポートとトレースのアーティファクトアップロード（7日間保持）を定義
  - `push`イベント（`main`, `develop`ブランチ）と`pull_request`イベント（`main`ブランチ）でのトリガーを設定
  - **CI/CDでのE2Eテストは常にヘッドレスモードで実行されること（`CI=true`環境変数により自動適用）**
  - _Requirements: 6, 8, 9_

- [x] 6.2 レポート生成とアーティファクトアップロード設定の検証
  - `playwright.config.ts`のレポート設定（HTML、JUnit XML）が正しく機能することをローカルで検証
  - 失敗時のスクリーンショット、トレース、ビデオが正しく保存されることを検証
  - GitHub Actionsでのアーティファクトアップロードが正しく機能することを検証（テストPR作成）
  - **全てのテストがヘッドレスモード(`npm run test:e2e`)でPASSすることを確認**
  - _Requirements: 6, 8_

- [x] 7. 既存テストとの統合と棲み分け
- [x] 7.1 package.jsonスクリプトの整理
  - `package.json`の`scripts`セクションを更新し、`test`コマンドがVitestのみを実行することを確認
  - `test:e2e`コマンドがPlaywrightのみを実行、`test:all`コマンドがVitestとPlaywrightを順次実行することを確認
  - 各コマンドのヘルプテキストやドキュメントを更新（必要に応じて）
  - _Requirements: 7_

- [x] 7.2 TypeScript設定の更新
  - `tsconfig.json`の`include`配列に`"e2e/**/*"`が追加されていることを確認
  - `exclude`配列に`"playwright-report"`, `"test-results"`が追加されていることを確認
  - E2Eテストファイルで型エラーが発生しないことを検証
  - _Requirements: 5, 7_

## 要件カバレッジマトリクス

| 要件ID | タスク番号 | 概要 |
|--------|-----------|------|
| 1 | 1.1, 1.2, 1.4 | Playwrightテスト環境のセットアップ |
| 2 | 2.1, 2.2 | Chrome拡張機能のロードとテスト実行基盤 |
| 3.1 | 3.1, 4.1 | タブライフサイクルとツリー構造の基本操作 |
| 3.2 | 3.2, 4.2 | ドラッグ&ドロップによるタブの並び替え（同階層） |
| 3.3 | 3.2, 4.3 | ドラッグ&ドロップによる階層変更（親子関係の作成） |
| 3.4 | 3.2, 4.4 | ドラッグ&ドロップによる複雑なツリー移動 |
| 3.5 | 3.2, 4.5 | ドラッグ&ドロップのホバー自動展開 |
| 3.6 | 3.4, 4.6 | クロスウィンドウドラッグ&ドロップ |
| 3.7 | 3.3, 4.7 | Side Panelの表示とリアルタイム更新 |
| 3.8 | 4.8 | ビュー切り替え機能（All Tabs / Current Window / Groups） |
| 3.9 | 4.9 | グループ機能 |
| 3.10 | 4.10 | スナップショット機能 |
| 3.11 | 4.11 | コンテキストメニュー操作 |
| 3.12 | 4.12 | 設定変更とUI/UXカスタマイゼーション |
| 3.13 | 3.1, 4.13 | 未読インジケータ機能 |
| 3.14 | 4.14 | エラーハンドリングとエッジケース |
| 4.1 | 3.1, 5.1 | chrome.tabs API統合 |
| 4.2 | 3.4, 5.2 | chrome.windows API統合 |
| 4.3 | 5.3 | IndexedDB統合 |
| 4.4 | 5.4 | chrome.storage API統合 |
| 4.5 | 3.5, 5.5 | Service Workerとの通信 |
| 5 | 1.3, 7.2 | テスト構造とファイル組織 |
| 6 | 1.1, 1.4, 6.1, 6.2 | CI/CD統合とレポート生成 |
| 7 | 1.2, 7.1, 7.2 | 既存テストとの共存と棲み分け |
| 8 | 1.1, 1.4, 6.1, 6.2 | デバッグとトラブルシューティング支援 |
| 9 | 1.1, 1.4, 6.1 | パフォーマンスと安定性の確保 |

## 実装フェーズガイド

本タスクリストは、設計書のMigration Strategyに従って以下のフェーズで段階的に実装することを推奨します:

**Phase 1: 基盤構築** (タスク 1.1-1.4, 2.1-2.2)
- Playwrightインストールと設定ファイル作成
- headlessモードのデフォルト設定と環境変数制御の実装
- ExtensionFixtureの実装
- Smoke Testの作成（拡張機能ロードと基本表示のみ）

**Phase 2: コアシナリオ実装** (タスク 3.1-3.5, 4.1-4.3, 4.7)
- テストユーティリティの実装（TabTestUtils, DragDropUtils, SidePanelUtils等）
- タブライフサイクル（4.1）のテストと機能実装
- ドラッグ&ドロップ基本操作（4.2, 4.3）のテストと機能実装
- Side Panel表示（4.7）のテストと機能実装

**Phase 3: 高度なシナリオ実装** (タスク 4.4-4.14, 5.1-5.5)
- 複雑なドラッグ&ドロップ（4.4, 4.5）のテストと機能実装
- クロスウィンドウ（4.6）のテストと機能実装
- ビュー切り替え（4.8）、グループ（4.9）、スナップショット（4.10）のテストと機能実装
- Chrome APIs統合（5.1-5.5）のテストと機能実装

**Phase 4: CI/CD統合** (タスク 6.1-6.2, 7.1-7.2)
- GitHub Actionsワークフロー追加
- レポート生成とアーティファクトアップロード
- 既存テストとの統合確認

## 8. テスト失敗の調査と修正

**重要**: 本セクションは、実装検証で発見された22件のテスト失敗を修正するためのタスクです。各タスクは対象テストが `npm run test:e2e` でPASSするまで調査・修正を行います。

### 8.1 config-validation.spec.ts の修正

- [x] 8.1.1 (P) package.jsonのE2Eテストスクリプト検証テストの修正
  - `e2e/config-validation.spec.ts:48` の失敗を調査
  - テストが期待する `test:e2e` スクリプトの値と実際の値の不整合を修正
  - テストコードまたは package.json スクリプト定義を修正してテストをPASSさせる
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 1, 7_

### 8.2 tab-lifecycle.spec.ts の修正

- [x] 8.2.1 (P) 新しいタブ作成テストの修正
  - `e2e/tab-lifecycle.spec.ts:21` の失敗を調査
  - タブ作成時のツリーノード追加検証ロジックを確認
  - テストコードまたは機能実装を修正してテストをPASSさせる
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.1_

- [x] 8.2.2 (P) タブタイトル・URL変更反映テストの修正
  - `e2e/tab-lifecycle.spec.ts:165` の失敗を調査
  - タブのタイトルまたはURL変更時のリアルタイム更新検証ロジックを確認
  - テストコードまたは機能実装を修正してテストをPASSさせる
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.1_

### 8.3 drag-drop-reorder.spec.ts の修正

- [x] 8.3.1 (P) ルートレベルタブ並び替えテストの修正
  - `e2e/drag-drop-reorder.spec.ts:19` の失敗を調査
  - ルートレベルのタブを別のルートレベルのタブ間にドロップする際の順序変更検証ロジックを確認
  - ドラッグ&ドロップのシミュレーション方法またはアサーション条件を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [x] 8.3.2 (P) 子タブ間並び替えテストの修正
  - `e2e/drag-drop-reorder.spec.ts:51` の失敗を調査
  - 同じ親の子タブ間での並び替え検証ロジックを確認
  - ドラッグ&ドロップのシミュレーション方法またはアサーション条件を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [x] 8.3.3 (P) サブツリー内タブ並び替えテストの修正
  - `e2e/drag-drop-reorder.spec.ts:88` の失敗を調査
  - 複数の子を持つサブツリー内でのタブ並び替え検証ロジックを確認
  - ドラッグ&ドロップのシミュレーション方法またはアサーション条件を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [x] 8.3.4 (P) ドロップインジケータ表示テストの修正
  - `e2e/drag-drop-reorder.spec.ts:131` の失敗を調査
  - ドラッグ中のドロップインジケータ表示検証ロジックを確認
  - ドロップインジケータのセレクタまたは表示タイミングの条件を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

### 8.4 drag-drop-complex.spec.ts の修正

- [x] 8.4.1 (P) 折りたたみ状態サブツリー移動テストの修正
  - `e2e/drag-drop-complex.spec.ts:368` の失敗を調査
  - 折りたたまれた状態のサブツリーを移動した際の展開状態保持検証ロジックを確認
  - テストコードまたは機能実装を修正してテストをPASSさせる
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.4_

### 8.5 utils/tab-utils.spec.ts の修正

- [x] 8.5.1 (P) createTabユーティリティテストの修正
  - `e2e/utils/tab-utils.spec.ts:20` の失敗を調査
  - `createTab`関数の実装またはテストアサーションを修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.1, 4.1_

- [x] 8.5.2 (P) createTab（親タブ指定）ユーティリティテストの修正
  - `e2e/utils/tab-utils.spec.ts:34` の失敗を調査
  - 親タブを指定して子タブを作成する`createTab`関数の実装またはテストを修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.1, 4.1_

- [x] 8.5.3 (P) closeTabユーティリティテストの修正
  - `e2e/utils/tab-utils.spec.ts:53` の失敗を調査
  - `closeTab`関数の実装またはテストアサーションを修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.1, 4.1_

- [x] 8.5.4 (P) activateTabユーティリティテストの修正
  - `e2e/utils/tab-utils.spec.ts:70` の失敗を調査
  - `activateTab`関数の実装またはテストアサーションを修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.1, 4.1_

- [x] 8.5.5 (P) assertTabInTreeユーティリティテストの修正
  - `e2e/utils/tab-utils.spec.ts:86` の失敗を調査
  - `assertTabInTree`関数の実装またはテストアサーションを修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.1, 4.1_

- [x] 8.5.6 (P) assertUnreadBadgeユーティリティテストの修正
  - `e2e/utils/tab-utils.spec.ts:115` の失敗を調査
  - `assertUnreadBadge`関数で未読数の検証ロジックを修正
  - 未読バッジのテキスト内容検証方法を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.13_

### 8.6 utils/drag-drop-utils.spec.ts の修正

- [x] 8.6.1 (P) startDragユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:15` の失敗を調査
  - `startDrag`関数のドラッグ開始シミュレーション実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [x] 8.6.2 (P) hoverOverTabユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:31` の失敗を調査
  - `hoverOverTab`関数のホバーシミュレーション実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [x] 8.6.3 (P) dropTabユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:53` の失敗を調査
  - `dropTab`関数のドロップシミュレーション実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [x] 8.6.4 (P) reorderTabs（before）ユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:69` の失敗を調査
  - `reorderTabs`関数（before位置）の並び替え実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [x] 8.6.5 (P) reorderTabs（after）ユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:87` の失敗を調査
  - `reorderTabs`関数（after位置）の並び替え実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [x] 8.6.6 (P) moveTabToParentユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:106` の失敗を調査
  - `moveTabToParent`関数の親子関係作成実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.3_

- [x] 8.6.7 (P) assertDropIndicatorユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:126` の失敗を調査
  - `assertDropIndicator`関数のドロップインジケータ検証実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [x] 8.6.8 (P) assertAutoExpandユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:148` の失敗を調査
  - `assertAutoExpand`関数のホバー自動展開検証実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.5_

## 9. 既存Vitestテストの修正

**重要**: E2Eテスト実装に伴い、TreeStateProviderやコンポーネントの変更により既存のVitestテストが失敗しています。各テストファイルを個別に修正し、`npm test` でPASSさせます。

**根本原因**: E2E対応で追加されたchrome.tabs.onActivated, chrome.runtime.sendMessageなどのChrome APIコールに対し、既存のchrome-mock.tsが対応していないため、テスト時にundefinedエラーが発生しています。

### 9.1 Chrome Mockの拡張

- [x] 9.1.1 (P) chrome-mock.tsへのchrome.tabs.onActivatedモック追加
  - `src/test/chrome-mock.ts`を更新し、`chrome.tabs.onActivated`イベントリスナーのモックを追加
  - `addListener`, `removeListener`, `hasListeners`メソッドを実装
  - TreeStateProviderで使用されているイベントパターンに対応
  - **`npm test`でTreeStateProvider関連のテストがPASSすることを確認**

- [x] 9.1.2 (P) chrome-mock.tsへのchrome.runtime.sendMessageモック追加
  - `src/test/chrome-mock.ts`を更新し、`chrome.runtime.sendMessage`関数のモックを追加
  - Promise形式のレスポンスを返すモック実装
  - TreeStateProviderのタブ同期処理に対応
  - **`npm test`でTreeStateProvider関連のテストがPASSすることを確認**

### 9.2 TreeStateProvider.test.tsx の修正

- [x] 9.2.1 (P) TreeStateProvider初期ロードテストの修正
  - `src/sidepanel/providers/TreeStateProvider.test.tsx`の「初期ロード時にストレージからツリー状態を読み込む」テストを修正
  - chrome.tabs.query, chrome.tabs.onActivatedのモックを適切に設定
  - **テストがPASSすることを確認**

- [x] 9.2.2 (P) TreeStateProvider STATE_UPDATEDテストの修正
  - `src/sidepanel/providers/TreeStateProvider.test.tsx`の「STATE_UPDATED メッセージを受信したときにストレージから状態を再読み込みする」テストを修正
  - chrome.runtime.onMessageのモックを適切に設定
  - **テストがPASSすることを確認**

- [x] 9.2.3 (P) TreeStateProvider storage.onChangedテストの修正
  - `src/sidepanel/providers/TreeStateProvider.test.tsx`の「storage.onChanged イベントを受信したときに状態を更新する」テストを修正
  - chrome.storage.onChangedのモックを適切に設定
  - **テストはit.skipとして意図的にスキップ（機能が一時的に無効化されているため）**

### 9.3 DragDropTreeIntegration.test.tsx の修正

- [x] 9.3.1 (P) ドラッグ&ドロップ子配置テストの修正
  - `src/sidepanel/components/DragDropTreeIntegration.test.tsx`の「タブを別のタブの子として配置できる」テストを修正
  - TreeStateProviderのセットアップにchrome APIモックを追加
  - **テストがPASSすることを確認**

- [x] 9.3.2 (P) ドラッグ&ドロップ順序変更テストの修正
  - `src/sidepanel/components/DragDropTreeIntegration.test.tsx`の「タブを同階層で順序変更できる」テストを修正
  - **テストがPASSすることを確認**

- [x] 9.3.3 (P) ドラッグ&ドロップ循環参照防止テストの修正
  - `src/sidepanel/components/DragDropTreeIntegration.test.tsx`の「循環参照を防ぐ」テストを修正
  - **テストがPASSすることを確認**

### 9.4 PanelDragDropIntegration.test.tsx の修正

- [x] 9.4.1 (P) パネル内D&D統合テスト（シナリオ1）の修正
  - `src/sidepanel/components/PanelDragDropIntegration.test.tsx`の「シナリオ1: タブを子として配置、同階層で移動を連続して実行」テストを修正
  - TreeStateProviderのセットアップにchrome APIモックを追加
  - **テストがPASSすることを確認**

- [x] 9.4.2 (P) パネル内D&D統合テスト（AC 3.2）の修正
  - `src/sidepanel/components/PanelDragDropIntegration.test.tsx`の「Acceptance Criteria 3.2: タブをドラッグして別のタブの子として配置できる」テストを修正
  - **テストがPASSすることを確認**

- [x] 9.4.3 (P) パネル内D&D統合テスト（AC 3.3）の修正
  - `src/sidepanel/components/PanelDragDropIntegration.test.tsx`の「Acceptance Criteria 3.3: タブを同階層で順序変更できる」テストを修正
  - **テストがPASSすることを確認**

- [x] 9.4.4 (P) パネル内D&D統合テスト（AC 3.4）の修正
  - `src/sidepanel/components/PanelDragDropIntegration.test.tsx`の「Acceptance Criteria 3.4: ホバー時にブランチが自動展開される」テストを修正
  - **テストがPASSすることを確認**

- [x] 9.4.5 (P) パネル内D&D統合テスト（循環参照）の修正
  - `src/sidepanel/components/PanelDragDropIntegration.test.tsx`のエラーケース「循環参照を防ぐ」テストを修正
  - **テストがPASSすることを確認**

- [x] 9.4.6 (P) パネル内D&D統合テスト（同ノードドロップ）の修正
  - `src/sidepanel/components/PanelDragDropIntegration.test.tsx`のエラーケース「同じノードへのドロップは操作をキャンセルする」テストを修正
  - **テストがPASSすることを確認**

### 9.5 BasicUI.integration.test.tsx の修正

- [x] 9.5.1 (P) タブツリー表示テストの修正
  - `src/sidepanel/components/BasicUI.integration.test.tsx`の「現在のウィンドウの全タブをツリー構造で表示すること」テストを修正
  - TreeNodeコンポーネントのdata-testidがtabIdを使用していることに合わせてテストのセレクタを修正
  - **テストがPASSすることを確認**

- [x] 9.5.2 (P) ファビコン・タイトル表示テストの修正
  - `src/sidepanel/components/BasicUI.integration.test.tsx`の「各タブのファビコン、タイトル、階層レベルを表示すること」テストを修正
  - **テストがPASSすることを確認**

- [x] 9.5.3 (P) リアルタイム更新テストの修正
  - `src/sidepanel/components/BasicUI.integration.test.tsx`の「タブが開かれたり閉じられたりしたときにサイドパネルがリアルタイムで更新されること」テストを修正
  - **テストがPASSすることを確認**

- [x] 9.5.4 (P) タブアクティブ化テストの修正
  - `src/sidepanel/components/BasicUI.integration.test.tsx`の「サイドパネル内のタブをクリックしたときに対応するタブがアクティブになること」テストを修正
  - **テストがPASSすることを確認**

### 9.6 DragHoverAutoExpand.test.tsx の修正

- [x] 9.6.1 (P) ドラッグホバー自動展開テストの修正
  - `src/sidepanel/components/DragHoverAutoExpand.test.tsx`の「折りたたまれたブランチを持つノードが正しくレンダリングされる」テストを修正
  - TreeStateProviderのセットアップにchrome APIモックを追加
  - **テストがPASSすることを確認**

### 9.7 TabCloseFeature.integration.test.tsx の修正

- [x] 9.7.1 (P) タブ閉じるボタン表示テストの修正
  - `src/sidepanel/components/TabCloseFeature.integration.test.tsx`の「タブノードにマウスをホバーすると、閉じるボタンが表示される」テストを修正
  - TreeNodeコンポーネントがtab.idを使ったdata-testidを生成するため、テストのセレクタを`tree-node-node-1`から`tree-node-1`に修正
  - **テストがPASSすることを確認**

- [x] 9.7.2 (P) タブ閉じるボタン非表示テストの修正
  - `src/sidepanel/components/TabCloseFeature.integration.test.tsx`の「タブノードからマウスを離すと、閉じるボタンが非表示になる」テストを修正
  - data-testidセレクタを修正
  - **テストがPASSすることを確認**

- [x] 9.7.3 (P) 閉じるボタンクリックコールバックテストの修正
  - `src/sidepanel/components/TabCloseFeature.integration.test.tsx`の「閉じるボタンをクリックすると、onCloseコールバックが呼ばれる」テストを修正
  - data-testidセレクタを修正
  - **テストがPASSすることを確認**

- [x] 9.7.4 (P) 確認ダイアログ表示テストの修正
  - `src/sidepanel/components/TabCloseFeature.integration.test.tsx`の確認ダイアログ関連テスト（6件）を修正
  - 折りたたまれた子タブを持つ親タブ、確認ダイアログOK/キャンセル、展開された親タブ等のケースのdata-testidセレクタを修正
  - **テストがPASSすることを確認**

- [x] 9.7.5 (P) 警告閾値テストの修正
  - `src/sidepanel/components/TabCloseFeature.integration.test.tsx`の警告閾値関連テスト（3件）を修正
  - 閾値未満、閾値以上、閾値1の場合のケースのdata-testidセレクタを修正
  - **テストがPASSすることを確認**

- [x] 9.7.6 (P) エッジケーステストの修正
  - `src/sidepanel/components/TabCloseFeature.integration.test.tsx`のエッジケーステスト（2件）を修正
  - 単一タブ閉じ、クリックイベント伝播防止のケースのdata-testidセレクタを修正
  - **テストがPASSすることを確認**

### 9.8 TabTreeView.test.tsx の修正

- [x] 9.8.1 (P) 単一タブノード表示テストの修正
  - `src/sidepanel/components/TabTreeView.test.tsx`の「単一のタブノードを表示できること」テストを修正
  - TreeStateProviderのセットアップにchrome APIモックを追加
  - **テストがPASSすることを確認**

- [x] 9.8.2 (P) ビューフィルタリングテストの修正
  - `src/sidepanel/components/TabTreeView.test.tsx`の「currentViewIdに一致するノードのみを表示すること」テストを修正
  - **テストがPASSすることを確認**

- [x] 9.8.3 (P) 子ノード再帰表示テストの修正
  - `src/sidepanel/components/TabTreeView.test.tsx`の「子ノードを再帰的に表示できること」テストを修正
  - **テストがPASSすることを確認**

- [x] 9.8.4 (P) 折りたたみ表示テストの修正
  - `src/sidepanel/components/TabTreeView.test.tsx`の「折りたたまれたノードの子を非表示にできること」テストを修正
  - **テストがPASSすることを確認**

- [x] 9.8.5 (P) ノードクリックコールバックテストの修正
  - `src/sidepanel/components/TabTreeView.test.tsx`の「ノードクリック時にonNodeClickが呼ばれること」テストを修正
  - **テストがPASSすることを確認**

- [x] 9.8.6 (P) 展開トグルテストの修正
  - `src/sidepanel/components/TabTreeView.test.tsx`の「展開/折りたたみトグルクリック時にonToggleExpandが呼ばれること」テストを修正
  - **テストがPASSすることを確認**

- [x] 9.8.7 (P) 深い階層レンダリングテストの修正
  - `src/sidepanel/components/TabTreeView.test.tsx`の「深い階層のツリーを正しくレンダリングできること」テストを修正
  - **テストがPASSすることを確認**

- [x] 9.8.8 (P) SortableTree統合テストの修正
  - `src/sidepanel/components/TabTreeView.test.tsx`のSortableTree Integration関連テスト（3件）を修正
  - ドラッグ可能アイテム、ハイライト表示、ドロップ位置視覚化のケースを修正
  - **テストがPASSすることを確認**

### 9.9 TreeNode.test.tsx の修正

- [x] 9.9.1 (P) インデント適用テストの修正
  - `src/sidepanel/components/TreeNode.test.tsx`の「depthに基づいてインデントを適用できること」テストを修正
  - TreeStateProviderのセットアップにchrome APIモックを追加
  - **テストがPASSすることを確認**

- [x] 9.9.2 (P) 展開トグルボタンテストの修正
  - `src/sidepanel/components/TreeNode.test.tsx`の展開/折りたたみトグル関連テスト（3件）を修正
  - 展開トグル表示、クリックコールバック、アイコン変更のケースを修正
  - **テストがPASSすることを確認**

- [x] 9.9.3 (P) タブアクティブ化テストの修正
  - `src/sidepanel/components/TreeNode.test.tsx`のタブアクティブ化関連テスト（2件）を修正
  - onActivateコールバック、アクティブスタイルのケースを修正
  - **テストがPASSすることを確認**

- [x] 9.9.4 (P) タブを閉じる機能テストの修正
  - `src/sidepanel/components/TreeNode.test.tsx`のタブを閉じる機能関連テスト（3件）を修正
  - ホバー時閉じるボタン表示、クリックコールバック、子ノード情報のケースを修正
  - **テストがPASSすることを確認**

- [x] 9.9.5 (P) 確認ダイアログ統合テストの修正
  - `src/sidepanel/components/TreeNode.test.tsx`の確認ダイアログ統合テスト（6件）を修正
  - ダイアログ表示、タブ数表示、OK/キャンセル、展開ブランチ、子なしのケースを修正
  - **テストがPASSすることを確認**

- [x] 9.9.6 (P) 警告閾値テストの修正
  - `src/sidepanel/components/TreeNode.test.tsx`の警告閾値関連テスト（4件）を修正
  - 閾値未満、閾値以上、閾値ちょうど、デフォルト値のケースを修正
  - **テストがPASSすることを確認**

### 9.10 UnreadIndicator.e2e.test.tsx の修正

- [x] 9.10.1 (P) 未読インジケータタブアクティブ化テストの修正
  - `src/sidepanel/components/UnreadIndicator.e2e.test.tsx`の「タブをクリックしてアクティブ化すると未読バッジが削除される」テストを修正
  - TreeStateProviderのセットアップにchrome APIモックを追加
  - **テストがPASSすることを確認**

- [x] 9.10.2 (P) 複数未読タブアクティブ化テストの修正
  - `src/sidepanel/components/UnreadIndicator.e2e.test.tsx`の「複数の未読タブから1つをアクティブ化すると、そのタブだけ既読になる」テストを修正
  - **テストがPASSすることを確認**

### 9.11 全テスト統合検証

- [x] 9.11.1 全Vitestテストの実行と検証
  - `npm test`を実行し、全ての既存テスト（約50ファイル）がPASSすることを確認
  - 失敗しているテストがあれば個別に修正
  - **全464件以上のテストがPASSすることを確認**

- [x] 9.11.2 全E2Eテストの実行と検証
  - `npm run test:e2e`を実行し、全てのE2Eテスト（224件）がPASSすることを確認
  - 既存テスト修正による影響がないことを確認
  - **全てのテストがヘッドレスモードでPASSすることを確認**

- [x] 9.11.3 全テスト統合実行
  - `npm run test:all`を実行し、VitestとPlaywrightの両方が順次実行されPASSすることを確認
  - CI/CD環境での実行を想定した最終検証
  - **全てのテストがPASSすることを確認**

## 10. スキップテストの調査と解消

**重要**: 全てのテストがスキップなしでPASSすることが、機能追加完了の最終条件です。本セクションでは、現在スキップされている4件のテスト（Vitest 3件、E2E 1件）を調査し、修正または正当な理由を文書化します。

### 10.1 スキップテストの調査と対応方針決定

- [x] 10.1.1 (P) スキップテストの一覧と原因調査レポート作成
  - 現在スキップされている全テスト（4件）をリストアップし、各テストのスキップ理由を調査
  - 対象テスト:
    1. `TreeStateProvider.test.tsx:163` - storage.onChangedイベントハンドリング
    2. `error-handling.test.tsx:242` - 親ノードを自分の子として移動（循環参照検出）
    3. `error-handling.test.tsx:331` - ノードを自分自身の親にしようとした場合
    4. `build-process.spec.ts:13` - dist/ディレクトリ存在検証
  - 各テストについて以下を調査:
    - スキップの技術的理由（コードコメント、関連Issue等）
    - テスト対象の機能が実際に動作しているかどうか
    - 修正可能かどうか、または設計上の制約でテスト不可能かどうか
  - 調査結果を文書化（このタスクファイルの下部に調査レポートセクションを追加）
  - _Requirements: 7_

### 10.2 TreeStateProvider storage.onChanged テストの解消

- [x] 10.2.1 storage.onChanged機能の有効化とテスト修正
  - `src/sidepanel/providers/TreeStateProvider.tsx:288-297`のコメントアウトされたstorage.onChangedハンドリングコードを調査
  - 「TEMPORARILY DISABLED to debug depth issue」の根本原因を特定
  - ローカル状態更新とストレージ更新間のレースコンディションを解決
  - storage.onChangedハンドリングを有効化し、`TreeStateProvider.test.tsx:163`のテストをスキップ解除してPASSさせる
  - **または**: 修正不可能な場合、技術的理由を文書化し、テストコードを削除
  - **全てのテストがPASSすることを確認**
  - _Requirements: 7_
  - **実装完了 (2025-12-27)**: isLocalUpdateRefフラグを追加してローカル更新中はstorage.onChangedからの更新をスキップするように修正。レースコンディションを解決しテストがPASS。

### 10.3 循環参照検出テストの解消

- [x] 10.3.1 (P) isDescendant関数の循環参照検出ロジック修正
  - `src/services/TreeStateManager.ts:437`の`isDescendant`関数を調査
  - 「KNOWN ISSUE: 循環参照検出が正しく動作していない」の根本原因を特定
  - 親子関係更新前にチェックしている問題を修正
  - `error-handling.test.tsx:242`（親ノードを自分の子として移動）のテストをスキップ解除してPASSさせる
  - **または**: 修正不可能な場合、技術的理由を文書化し、テストコードを削除
  - **全てのテストがPASSすることを確認**
  - _Requirements: 7_
  - **実装完了 (2025-12-27)**: isDescendant関数の引数順序を修正。移動先の親(newParentId)が移動対象ノード(nodeId)の子孫かどうかをチェックするように変更。また自己参照チェックを追加。テストがPASS。

- [x] 10.3.2 (P) 自己参照検出テストの解消
  - `error-handling.test.tsx:331`（ノードを自分自身の親にしようとした場合）のテストを調査
  - 上記10.3.1の修正が適用された場合、このテストも同時にPASSするか確認
  - スキップを解除してテストをPASSさせる
  - **または**: 修正不可能な場合、技術的理由を文書化し、テストコードを削除
  - **全てのテストがPASSすることを確認**
  - _Requirements: 7_
  - **実装完了 (2025-12-27)**: 10.3.1で追加した自己参照チェック(`newParentId === nodeId`)により、テストがPASS。

### 10.4 E2E build-process.spec.ts テストの解消

- [x] 10.4.1 ビルドプロセス検証テストの設計見直しと修正
  - `e2e/build-process.spec.ts:13`のテストがスキップされている理由を分析
  - 現在の問題: globalSetupがテスト実行前に呼ばれないため、dist/ディレクトリが存在しない
  - 解決策を検討:
    1. テスト内でビルドを実行する方法
    2. globalSetupに依存しない形でテストを書き換える方法
    3. 他のE2Eテストで間接的に検証されている場合、このテストを削除する方法
  - 選択した解決策を実装し、テストをスキップ解除してPASSさせる
  - **または**: テスト不可能な場合、正当な理由を文書化し、テストコードを削除
  - **全てのテストがPASSすることを確認**
  - _Requirements: 2, 7_
  - **実装完了 (2025-12-27)**: 当初の問題分析が誤っていた。globalSetupはPlaywrightがテスト実行前に必ず呼び出すため、テスト実行時点ではdist/ディレクトリは存在する。test.skipをtestに変更し、コメントを更新してテストがPASS。E2Eテスト225件全てがスキップなしでPASS。

### 10.5 最終検証とテストコード品質保証

- [x] 10.5.1 全スキップテスト解消の最終確認
  - `npm test -- --run`を実行し、スキップテストが0件であることを確認
  - `npm run test:e2e`を実行し、スキップテストが0件であることを確認
  - 全てのテストがPASS（GREEN状態）であることを確認
  - テスト不可能と判断したテストがあれば、その理由がタスクファイルに文書化されていることを確認
  - **全てのテストがスキップなしでPASSすることを確認**
  - _Requirements: 7_
  - **実装完了 (2025-12-27)**: 全てのテストがスキップなしでPASSすることを確認。
    - Vitestテスト: 523件全てPASS、スキップ0件
    - E2Eテスト (Playwright): 225件全てPASS、スキップ0件
    - 意図的なスキップ: headless-mode.spec.ts:50のみ（CI環境でheadedモードテストはスキップ、これは意図的な設計上のスキップ）

---

## スキップテスト調査レポート

**調査日時**: 2025-12-27
**調査者**: AI実装タスク 10.1.1

### 現在のテスト状況

- **Vitestテスト**: 523 passed, 0 skipped (合計 523 tests) ※2025-12-27更新
- **E2Eテスト (Playwright)**: 225 passed, 0 skipped (合計 225 tests) ※2025-12-27更新

**注記**: 意図的なスキップ（headless-mode.spec.ts:50、CI環境でheadedモードテストをスキップ）を除く

### 調査対象テスト一覧

| No | テストファイル | テスト名 | スキップ理由 | 修正可否 | 対応方針 | 状態 |
|----|--------------|---------|------------|---------|---------|------|
| 1 | TreeStateProvider.test.tsx:163 | storage.onChangedイベントハンドリング | 機能が一時的に無効化 | 修正可能（要設計検討） | 後続タスクで対応 | **解決済** |
| 2 | error-handling.test.tsx:242 | 親ノードを自分の子として移動 | isDescendant関数のロジック問題 | 修正可能 | 後続タスクで対応 | **解決済** |
| 3 | error-handling.test.tsx:331 | ノードを自分自身の親にする | 上記と同一の原因 | 修正可能 | 後続タスクで対応 | **解決済** |
| 4 | build-process.spec.ts:13 | dist/ディレクトリ存在検証 | globalSetup実行タイミング問題 | 設計上の制約 | 削除を検討 | **解決済** (問題分析誤り、test.skipをtestに変更) |
| 5 | headless-mode.spec.ts:50 | HEADED=trueでheadedモードに切替 | CI環境では実行不可 | 意図的なスキップ | 現状維持 | 意図的スキップ |

### 調査結果詳細

#### 1. TreeStateProvider.test.tsx:163 - storage.onChangedイベントハンドリング

**スキップ理由**:
- `src/sidepanel/providers/TreeStateProvider.tsx`の288-297行目で、storage.onChangedハンドリングが一時的に無効化されている
- コメント: "TEMPORARILY DISABLED to debug depth issue"
- ローカル状態更新とストレージ更新間のレースコンディションが原因

**技術的詳細**:
```typescript
// TEMPORARILY DISABLED to debug depth issue
// TODO: Re-enable after fixing the race condition between local state updates and storage updates
/*
if (changes.tree_state && changes.tree_state.newValue) {
  const reconstructedState = reconstructChildrenReferences(changes.tree_state.newValue);
  setTreeState(reconstructedState);
}
*/
```

**修正可否**: 修正可能
**対応方針**: タスク10.2.1で対応。レースコンディションの解決が必要。

---

#### 2. error-handling.test.tsx:242 - 親ノードを自分の子として移動

**スキップ理由**:
- `TreeStateManager.isDescendant()`関数が循環参照を正しく検出できていない
- コメント: "KNOWN ISSUE: 循環参照検出が正しく動作していない"
- isDescendantは子ノードの配列をチェックしているが、親子関係が更新される前にチェックしている可能性がある

**技術的詳細**:
- `TreeStateManager.moveNode()`の166-170行目で循環参照チェックを実施
- `isDescendant(newParentId, nodeId)`の引数順序は正しいが、チェックタイミングに問題がある可能性
- テストケース: A -> B -> C の構造で、AをCの子に移動しようとする場合

**修正可否**: 修正可能
**対応方針**: タスク10.3.1で対応。isDescendant関数のロジック修正が必要。

---

#### 3. error-handling.test.tsx:331 - ノードを自分自身の親にする

**スキップ理由**:
- 上記No.2と同一の原因（循環参照検出の問題）
- 自己参照は循環参照の特殊ケース

**修正可否**: 修正可能
**対応方針**: タスク10.3.2で対応。No.2の修正と同時に解決される見込み。

---

#### 4. build-process.spec.ts:13 - dist/ディレクトリ存在検証

**スキップ理由**:
- テストがglobalSetupの実行を前提としているが、単体テストとして実行される際にglobalSetupが呼ばれない
- コメント: "globalSetupは実際のE2Eテスト実行時に自動的に呼ばれる"

**技術的詳細**:
- このテストはビルドプロセスの統合を検証するもの
- 他のE2Eテストが成功している時点で、ビルドプロセスは間接的に検証されている
- 同一ファイル内の他のテスト（globalSetup設定確認、スクリプト存在確認）は正常にパス

**修正可否**: 設計上の制約により修正困難
**対応方針**: タスク10.4.1で対応。テストの削除または設計見直しを検討。

---

#### 5. headless-mode.spec.ts:50 - HEADED=trueでheadedモードに切替

**スキップ理由**:
- CI環境ではheadedモード（ブラウザ画面表示）でのテスト実行ができない
- `test.skip(process.env.CI === 'true', 'CI環境ではheadedモードのテストはスキップされます')`

**技術的詳細**:
- CI環境では表示デバイスがないため、headedモードは実行不可
- ローカル環境で`HEADED=true`を設定して手動実行することで検証可能
- これは意図的な設計上のスキップであり、修正対象ではない

**修正可否**: 意図的なスキップ（修正不要）
**対応方針**: 現状維持。CI環境でのスキップは適切な設計判断。

---

### 優先順位と対応計画

1. **優先度高**: No.2, No.3 - 循環参照検出の修正（コア機能に関わる問題）
2. **優先度中**: No.1 - storage.onChangedハンドリングの有効化（レースコンディション解決）
3. **優先度低**: No.4 - ビルドプロセステストの設計見直し
4. **対応不要**: No.5 - 意図的なスキップのため現状維持

---

## タスク完了基準

**重要**: 全てのE2Eテストタスク（4.1-4.14, 5.1-5.5）は、以下の条件を全て満たした場合にのみ完了とみなします:

1. ✅ **テストコードの実装**: E2Eテストファイル（`.spec.ts`）が作成され、要求される全ての検証が含まれている
2. ✅ **機能の実装**: テストをPASSさせるために必要な機能（UI、ロジック、API統合等）が実装されている
3. ✅ **テストのPASS**: 全てのテストが `npm run test:e2e` (ヘッドレスモード) で成功する（GREEN状態）
4. ✅ **要件の充足**: Requirements で定義された全ての受入基準が満たされている
5. ✅ **スキップテストの解消**: 全てのテストがスキップなしで実行される、またはテスト不可能な理由が文書化されている

**テスト実行コマンド**:
- ヘッドレスモード（推奨）: `npm run test:e2e`
- デバッグモード（必要時のみ）: `npm run test:e2e:debug`
- UIモード: `npm run test:e2e:ui`
- 全テスト実行: `npm run test:all` (Vitest + Playwright)
