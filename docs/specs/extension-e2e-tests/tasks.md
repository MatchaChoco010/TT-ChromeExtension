# Implementation Plan

## タスク概要

本仕様では、Playwright for Chrome Extensionsを活用した真のE2Eテスト環境を構築します。実ブラウザ（Chromium）上でChrome拡張機能として動作するVivaldi-TTの主要機能を自動検証し、既存のVitestテストと共存する形で段階的に導入します。

**重要**: 全てのE2Eテストタスクは、テストコードの実装だけでなく、テストをPASS(GREEN状態)にするために必要な機能実装も含みます。タスク完了の条件は「全てのテストがヘッドレスモードで成功すること」です。

## 実装タスク

- [ ] 1. Playwrightテスト環境の基盤構築
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

- [ ] 2. 拡張機能ロード基盤の実装
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

- [ ] 3. テストユーティリティの実装
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

- [ ] 4. コアユーザーフローのE2Eテスト実装と機能実装

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

- [ ] 5. ブラウザAPI統合テストと機能実装

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

- [ ] 6. CI/CD統合とレポート生成
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

- [ ] 7. 既存テストとの統合と棲み分け
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

- [ ] 8.1.1 (P) package.jsonのE2Eテストスクリプト検証テストの修正
  - `e2e/config-validation.spec.ts:48` の失敗を調査
  - テストが期待する `test:e2e` スクリプトの値と実際の値の不整合を修正
  - テストコードまたは package.json スクリプト定義を修正してテストをPASSさせる
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 1, 7_

### 8.2 tab-lifecycle.spec.ts の修正

- [ ] 8.2.1 (P) 新しいタブ作成テストの修正
  - `e2e/tab-lifecycle.spec.ts:21` の失敗を調査
  - タブ作成時のツリーノード追加検証ロジックを確認
  - テストコードまたは機能実装を修正してテストをPASSさせる
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.1_

- [ ] 8.2.2 (P) タブタイトル・URL変更反映テストの修正
  - `e2e/tab-lifecycle.spec.ts:165` の失敗を調査
  - タブのタイトルまたはURL変更時のリアルタイム更新検証ロジックを確認
  - テストコードまたは機能実装を修正してテストをPASSさせる
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.1_

### 8.3 drag-drop-reorder.spec.ts の修正

- [ ] 8.3.1 (P) ルートレベルタブ並び替えテストの修正
  - `e2e/drag-drop-reorder.spec.ts:19` の失敗を調査
  - ルートレベルのタブを別のルートレベルのタブ間にドロップする際の順序変更検証ロジックを確認
  - ドラッグ&ドロップのシミュレーション方法またはアサーション条件を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [ ] 8.3.2 (P) 子タブ間並び替えテストの修正
  - `e2e/drag-drop-reorder.spec.ts:51` の失敗を調査
  - 同じ親の子タブ間での並び替え検証ロジックを確認
  - ドラッグ&ドロップのシミュレーション方法またはアサーション条件を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [ ] 8.3.3 (P) サブツリー内タブ並び替えテストの修正
  - `e2e/drag-drop-reorder.spec.ts:88` の失敗を調査
  - 複数の子を持つサブツリー内でのタブ並び替え検証ロジックを確認
  - ドラッグ&ドロップのシミュレーション方法またはアサーション条件を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [ ] 8.3.4 (P) ドロップインジケータ表示テストの修正
  - `e2e/drag-drop-reorder.spec.ts:131` の失敗を調査
  - ドラッグ中のドロップインジケータ表示検証ロジックを確認
  - ドロップインジケータのセレクタまたは表示タイミングの条件を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

### 8.4 drag-drop-complex.spec.ts の修正

- [ ] 8.4.1 (P) 折りたたみ状態サブツリー移動テストの修正
  - `e2e/drag-drop-complex.spec.ts:368` の失敗を調査
  - 折りたたまれた状態のサブツリーを移動した際の展開状態保持検証ロジックを確認
  - テストコードまたは機能実装を修正してテストをPASSさせる
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.4_

### 8.5 utils/tab-utils.spec.ts の修正

- [ ] 8.5.1 (P) createTabユーティリティテストの修正
  - `e2e/utils/tab-utils.spec.ts:20` の失敗を調査
  - `createTab`関数の実装またはテストアサーションを修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.1, 4.1_

- [ ] 8.5.2 (P) createTab（親タブ指定）ユーティリティテストの修正
  - `e2e/utils/tab-utils.spec.ts:34` の失敗を調査
  - 親タブを指定して子タブを作成する`createTab`関数の実装またはテストを修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.1, 4.1_

- [ ] 8.5.3 (P) closeTabユーティリティテストの修正
  - `e2e/utils/tab-utils.spec.ts:53` の失敗を調査
  - `closeTab`関数の実装またはテストアサーションを修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.1, 4.1_

- [ ] 8.5.4 (P) activateTabユーティリティテストの修正
  - `e2e/utils/tab-utils.spec.ts:70` の失敗を調査
  - `activateTab`関数の実装またはテストアサーションを修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.1, 4.1_

- [ ] 8.5.5 (P) assertTabInTreeユーティリティテストの修正
  - `e2e/utils/tab-utils.spec.ts:86` の失敗を調査
  - `assertTabInTree`関数の実装またはテストアサーションを修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.1, 4.1_

- [ ] 8.5.6 (P) assertUnreadBadgeユーティリティテストの修正
  - `e2e/utils/tab-utils.spec.ts:115` の失敗を調査
  - `assertUnreadBadge`関数で未読数の検証ロジックを修正
  - 未読バッジのテキスト内容検証方法を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.13_

### 8.6 utils/drag-drop-utils.spec.ts の修正

- [ ] 8.6.1 (P) startDragユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:15` の失敗を調査
  - `startDrag`関数のドラッグ開始シミュレーション実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [ ] 8.6.2 (P) hoverOverTabユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:31` の失敗を調査
  - `hoverOverTab`関数のホバーシミュレーション実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [ ] 8.6.3 (P) dropTabユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:53` の失敗を調査
  - `dropTab`関数のドロップシミュレーション実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [ ] 8.6.4 (P) reorderTabs（before）ユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:69` の失敗を調査
  - `reorderTabs`関数（before位置）の並び替え実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [ ] 8.6.5 (P) reorderTabs（after）ユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:87` の失敗を調査
  - `reorderTabs`関数（after位置）の並び替え実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [ ] 8.6.6 (P) moveTabToParentユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:106` の失敗を調査
  - `moveTabToParent`関数の親子関係作成実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.3_

- [ ] 8.6.7 (P) assertDropIndicatorユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:126` の失敗を調査
  - `assertDropIndicator`関数のドロップインジケータ検証実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.2_

- [ ] 8.6.8 (P) assertAutoExpandユーティリティテストの修正
  - `e2e/utils/drag-drop-utils.spec.ts:148` の失敗を調査
  - `assertAutoExpand`関数のホバー自動展開検証実装を修正
  - **テストがヘッドレスモードでPASSすることを確認**
  - _Requirements: 3.5_

## タスク完了基準

**重要**: 全てのE2Eテストタスク（4.1-4.14, 5.1-5.5）は、以下の条件を全て満たした場合にのみ完了とみなします:

1. ✅ **テストコードの実装**: E2Eテストファイル（`.spec.ts`）が作成され、要求される全ての検証が含まれている
2. ✅ **機能の実装**: テストをPASSさせるために必要な機能（UI、ロジック、API統合等）が実装されている
3. ✅ **テストのPASS**: 全てのテストが `npm run test:e2e` (ヘッドレスモード) で成功する（GREEN状態）
4. ✅ **要件の充足**: Requirements で定義された全ての受入基準が満たされている

**テスト実行コマンド**:
- ヘッドレスモード（推奨）: `npm run test:e2e`
- デバッグモード（必要時のみ）: `npm run test:e2e:debug`
- UIモード: `npm run test:e2e:ui`
- 全テスト実行: `npm run test:all` (Vitest + Playwright)
