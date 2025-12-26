# 実装タスク - Vivaldi-TT

## 実装順序の方針

本タスクリストは、以下の順序で段階的に機能を構築します:

1. プロジェクト基盤とビルド環境の構築
2. ストレージレイヤーとService Workerの実装
3. 基本的なサイドパネルUIとタブツリー表示
4. ツリー状態管理とドラッグ&ドロップ
5. 高度な機能（ビュー切り替え、グループ化、スナップショット）
6. UI/UXカスタマイズとコンテキストメニュー
7. 統合とエンドツーエンドテスト

並列実行可能なタスクには `(P)` マークを付与しています。

---

## タスク一覧

### 1. プロジェクトセットアップとビルド環境構築

- [x] 1.1 (P) プロジェクト初期化とビルド設定
  - Vite 5.x + CRXJS プラグインでプロジェクトを初期化
  - TypeScript 5.x、React 18.x、TailwindCSS 3.x の依存関係を追加
  - manifest.json を Manifest V3 形式で作成（permissions: sidePanel, tabs, storage, unlimitedStorage, alarms）
  - ホットリロード機能を開発モードで有効化する設定を追加
  - _Requirements: 13.1, 13.2_

- [x] 1.2 (P) プロジェクト構造の構築
  - src/background/, src/sidepanel/, src/services/, src/storage/, src/types/, src/utils/ ディレクトリを作成
  - TypeScript設定でパスエイリアスを設定（@/で src/ を参照）
  - ESLint、Prettier の設定を追加
  - _Requirements: 13.3_

### 2. ストレージレイヤーの実装

- [x] 2.1 (P) StorageService の実装
  - chrome.storage.local の型安全なラッパーを実装
  - get/set/remove メソッドと onChange リスナーを実装
  - ストレージキーの定数定義（tree_state, user_settings, unread_tabs, groups）
  - _Requirements: 全体（状態永続化基盤）_

- [x] 2.2 (P) IndexedDBService の実装
  - vivaldi-tt-snapshots データベースとスキーマを定義
  - snapshots オブジェクトストアの作成（key path: id, indexes: createdAt, isAutoSave）
  - CRUD操作メソッドを実装（saveSnapshot, getSnapshot, getAllSnapshots, deleteSnapshot）
  - 古いスナップショット削除機能を実装（deleteOldSnapshots）
  - _Requirements: 11.4, 11.5, 11.6_

### 3. Service Worker の実装

- [x] 3.1 Service Worker 基盤とタブイベント処理
  - chrome.tabs イベント（onCreated, onRemoved, onMoved, onUpdated, onActivated）のリスナーを実装
  - chrome.windows イベント（onCreated, onRemoved）のリスナーを実装
  - サイドパネルとのメッセージングインターフェース（runtime.sendMessage/onMessage）を実装
  - _Requirements: 1.1, 1.4_

- [x] 3.2 クロスウィンドウドラッグ状態管理
  - Service Worker にグローバルドラッグ状態（dragState: { tabId, treeData, sourceWindowId } | null）を実装
  - SET_DRAG_STATE, GET_DRAG_STATE, CLEAR_DRAG_STATE メッセージハンドラを実装
  - ウィンドウ間通信による状態同期機能を実装
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

### 4. 基本的なサイドパネルUIの構築

- [x] 4.1 (P) SidePanelRoot コンポーネントの実装
  - サイドパネルのエントリーポイント（index.tsx）とルートレイアウトを作成
  - TreeStateProvider、ThemeProvider のコンテキストプロバイダーを設定
  - ローディング状態とエラー境界を実装
  - _Requirements: 1.1, 1.2_

- [x] 4.2 (P) TabTreeView コンポーネントの実装
  - タブツリーの再帰的レンダリングロジックを実装
  - currentViewId によるフィルタリング機能を実装
  - 展開/折りたたみ状態の管理を実装
  - _Requirements: 1.2, 1.3, 2.4_

- [x] 4.3 (P) TreeNode コンポーネントの実装
  - ファビコン、タイトル、インデント表示を実装
  - 展開/折りたたみトグルボタンを実装
  - ノードクリックによるタブアクティブ化を実装
  - _Requirements: 1.3, 1.5, 2.4_

- [x]* 4.4 基本UI表示のテスト
  - サイドパネルが正しく開くことを確認
  - 現在のウィンドウのタブがツリー表示されることを確認（Acceptance Criteria 1.2）
  - タブクリックでアクティブ化されることを確認（Acceptance Criteria 1.5）
  - _Requirements: 1.2, 1.3, 1.5_

### 5. ツリー状態管理の実装

- [x] 5.1 TreeStateManager サービスの実装
  - タブとツリーノードのマッピング管理（nodes Map, tabToNode Map）を実装
  - getTree, getNodeByTabId メソッドを実装
  - addTab, removeTab, moveNode, toggleExpand メソッドを実装
  - StorageService との連携による状態永続化を実装
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5.2 新規タブの親子関係構築
  - chrome.tabs.onCreated で openerTabId から親タブを特定
  - 新規タブを親タブの子として配置するロジックを実装（設定に応じて）
  - Service Worker から UI へのリアルタイム更新通知を実装
  - _Requirements: 2.2, 9.2_

- [x] 5.3 タブ閉じ時の子タブ処理
  - 親タブ閉じ時の子タブ昇格または一括閉じのロジックを実装
  - 設定による処理方法の切り替えを実装
  - _Requirements: 2.3_

- [x] 5.4 ツリー同期とリアルタイム更新
  - chrome.tabs API とツリー状態の同期機能（syncWithChromeTabs）を実装
  - タブ移動、更新時のツリー状態更新を実装
  - サイドパネルへの更新通知とUIリレンダリングを実装
  - _Requirements: 1.4, 2.1_

- [x]* 5.5 ツリー状態管理のユニットテスト
  - ノード追加/削除/移動のロジックをテスト
  - 親子関係の整合性をテスト
  - ストレージ永続化をテスト
  - _Requirements: 2.1, 2.2, 2.3_

### 6. ドラッグ&ドロップ（パネル内）の実装

- [x] 6.1 DragDropProvider の実装
  - @dnd-kit/core の DndContext とセンサー設定を実装
  - ポインターセンサー、キーボードセンサーを設定
  - 衝突検出アルゴリズムを設定
  - _Requirements: 3.1_

- [x] 6.2 SortableTree コンポーネントの統合
  - dnd-kit-sortable-tree ライブラリを TabTreeView に統合
  - ドラッグ開始時のハイライト表示を実装
  - ドラッグ中のドロップ可能位置の視覚化（ドロップライン）を実装
  - _Requirements: 3.1, 3.5_

- [x] 6.3 ドラッグ&ドロップによるツリー再構成
  - onDragEnd イベントハンドラで新しいツリー構造を計算
  - タブを別タブの子として配置する処理を実装
  - タブを同階層で順序変更する処理を実装
  - TreeStateManager と連携してツリー状態を更新
  - _Requirements: 3.2, 3.3_

- [x] 6.4 ドラッグホバー時のブランチ自動展開
  - ホバー検出とタイマー管理を実装
  - ホバー時間が閾値（1秒）を超えた場合に折りたたまれたブランチを展開
  - _Requirements: 3.4_

- [x]* 6.5 パネル内D&Dの統合テスト
  - タブをドラッグして別のタブの子として配置できることを確認（Acceptance Criteria 3.2）
  - タブを同階層で順序変更できることを確認（Acceptance Criteria 3.3）
  - ホバー時にブランチが自動展開されることを確認（Acceptance Criteria 3.4）
  - _Requirements: 3.2, 3.3, 3.4_

### 7. クロスウィンドウドラッグ&ドロップの実装

- [x] 7.1 CrossWindowDragHandler の実装
  - パネル外へのドラッグ検出（dragend イベント）を実装
  - Service Worker のドラッグ状態と連携
  - 別ウィンドウのサイドパネルへのドロップ検出を実装
  - _Requirements: 4.1, 4.2_

- [x] 7.2 新しいウィンドウでタブを開く機能
  - パネル外へのドロップ時に chrome.windows.create を呼び出し
  - chrome.tabs.move で新しいウィンドウにタブを移動
  - _Requirements: 4.2_

- [x] 7.3 サブツリー全体の移動
  - 親タブとその子タブをすべて取得
  - 親子関係を維持しながら別ウィンドウに移動
  - 移動先でツリー構造を復元
  - _Requirements: 4.3, 4.4_

- [x]* 7.4 クロスウィンドウD&Dのテスト
  - タブを別ウィンドウに移動できることを確認（Acceptance Criteria 4.1）
  - パネル外へのドロップで新しいウィンドウが作成されることを確認（Acceptance Criteria 4.2）
  - 親タブとサブツリーが一緒に移動することを確認（Acceptance Criteria 4.3）
  - _Requirements: 4.1, 4.2, 4.3_

### 8. ビュー切り替え機能の実装

- [x] 8.1 ViewManager サービスの実装
  - 複数ビューの作成・削除・切り替えロジックを実装
  - 各タブノードに viewId プロパティを追加
  - タブの物理的削除なしでビュー間を切り替える機能を実装
  - getTabsByView メソッドで指定ビューのタブを取得
  - _Requirements: 6.1, 6.2, 6.5_

- [x] 8.2 ViewSwitcher UI コンポーネントの実装
  - サイドパネル上部の横スクロール可能なタブバー UI を実装
  - ビュークリックによる切り替え機能を実装
  - アクティブビューのハイライト表示を実装
  - 新しいビュー追加ボタンを実装
  - _Requirements: 6.3_

- [x] 8.3 ビューのカスタマイズ機能
  - ビュー名と色の編集機能を実装
  - カスタムアイコンURL設定（オプション）を実装
  - StorageService によるビュー設定の永続化を実装
  - _Requirements: 6.4_

- [x] 8.4 ビュー間のタブ移動
  - タブを別のビューに移動する機能（moveTabToView）を実装
  - ビュー切り替え時の UI フィルタリングを実装（currentViewId ベース）
  - _Requirements: 6.5_

- [x]* 8.5 ビュー切り替えのテスト
  - 新しいビューを作成できることを確認（Acceptance Criteria 6.2）
  - ビュー切り替えで対応するタブツリーが表示されることを確認（Acceptance Criteria 6.3）
  - ビュー名と色を設定できることを確認（Acceptance Criteria 6.4）
  - _Requirements: 6.2, 6.3, 6.4_

### 9. グループ化機能の実装

- [x] 9.1 GroupManager サービスの実装
  - グループノードの作成・編集・削除ロジックを実装
  - 複数タブを選択してグループ化するロジックを実装
  - グループページの作成とタブの配下配置を実装
  - _Requirements: 5.1, 5.2_

- [x] 9.2 GroupNode UI コンポーネントの実装
  - グループページのカスタマイズ可能なタイトルと色の表示を実装
  - グループページクリック時の概要表示を実装
  - グループの展開/折りたたみ機能を実装
  - _Requirements: 5.2, 5.3, 5.4_

- [x] 9.3 グループ閉じ時の確認ダイアログ
  - グループページ閉じ時の確認ダイアログを実装
  - グループ内のすべてのタブを一括閉じる機能を実装
  - _Requirements: 5.5_

- [x]* 9.4 グループ化機能のテスト
  - 複数タブをグループ化してグループページが作成されることを確認（Acceptance Criteria 5.1）
  - グループのタイトルと色をカスタマイズできることを確認（Acceptance Criteria 5.2）
  - グループを折りたたむとタブが非表示になることを確認（Acceptance Criteria 5.4）
  - _Requirements: 5.1, 5.2, 5.4_

### 10. 未読タブインジケータの実装

- [x] 10.1 (P) UnreadTracker サービスの実装
  - タブ作成時に未読としてマークする機能を実装
  - タブアクティブ化時に既読としてマークする機能を実装
  - 未読タブIDの Set を管理
  - StorageService による未読状態の永続化を実装
  - _Requirements: 7.1, 7.2_

- [x] 10.2 (P) UnreadBadge UI コンポーネントの実装
  - TreeNode に未読インジケータ（バッジまたは色変更）を表示
  - 未読タブ数のカウント表示機能を実装
  - 設定による未読インジケータの表示/非表示切り替えを実装
  - _Requirements: 7.1, 7.3, 7.4_

- [x]* 10.3 未読インジケータのテスト
  - 新規タブに未読インジケータが表示されることを確認（Acceptance Criteria 7.1）
  - タブアクティブ化で未読インジケータが削除されることを確認（Acceptance Criteria 7.2）
  - _Requirements: 7.1, 7.2_

### 11. タブ閉じる機能と警告の実装

- [x] 11.1 (P) CloseButton コンポーネントの実装
  - TreeNode のホバー時に閉じるボタンを表示
  - クリック時にタブを閉じる処理を実装
  - _Requirements: 8.1, 8.2_

- [x] 11.2 (P) ConfirmDialog コンポーネントの実装
  - 折りたたまれたブランチを持つ親タブ閉じ時の確認ダイアログを実装
  - 配下のタブ数を表示
  - OK選択時に親タブとすべての子タブを閉じる処理を実装
  - _Requirements: 8.3, 8.4_

- [x] 11.3 (P) 警告閾値のカスタマイズ設定
  - UserSettings に closeWarningThreshold を追加
  - 設定パネルで閾値（例: 3タブ以上）をカスタマイズできる UI を実装
  - _Requirements: 8.5_

- [x]* 11.4 タブ閉じる機能のテスト
  - マウスホバー時に閉じるボタンが表示されることを確認（Acceptance Criteria 8.1）
  - 折りたたまれたブランチ閉じ時に確認ダイアログが表示されることを確認（Acceptance Criteria 8.3）
  - _Requirements: 8.1, 8.3_

### 12. 新しいタブの位置調整機能の実装

- [x] 12.1 (P) 新規タブ位置設定の実装
  - UserSettings に newTabPosition（child/sibling/end）を追加
  - 設定パネルで新規タブ挿入位置を選択できる UI を実装
  - _Requirements: 9.1_

- [x] 12.2 (P) タブ開き方別の位置ルール適用
  - リンククリックから開かれたタブの位置制御を実装
  - 手動で開かれたタブの位置制御を実装
  - 異なるタブ開き方に対して個別のルールを適用
  - _Requirements: 9.2, 9.3, 9.4_

- [x]* 12.3 新規タブ位置のテスト
  - 設定が「子として配置」の場合に新規タブが元のタブの子になることを確認（Acceptance Criteria 9.2）
  - 設定が「リストの最後」の場合に新規タブがツリーの最後に配置されることを確認（Acceptance Criteria 9.3）
  - _Requirements: 9.2, 9.3_

### 13. UI/UXカスタマイズ機能の実装

- [x] 13.1 (P) SettingsPanel コンポーネントの実装
  - 設定パネルのレイアウトと UI を実装
  - 設定の保存と読み込みを StorageService と連携
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 13.2 (P) フォントカスタマイズ機能
  - フォントサイズ調整（小、中、大、カスタムpx値）の UI を実装
  - フォントファミリー選択（システムフォント、カスタムフォント名）の UI を実装
  - 変更時にサイドパネル全体のフォントを更新
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 13.3 (P) ThemeProvider とカスタムCSS機能
  - ThemeProvider でテーマ設定を提供
  - カスタムCSSファイルのロード機能を実装
  - カスタムCSS適用時のエラー検出と通知を実装
  - Vivaldiのテーマ設定と調和するデフォルトスタイルを実装
  - _Requirements: 10.4, 10.5, 10.6, 14.4_

- [x]* 13.4 UI/UXカスタマイズのテスト
  - フォントサイズ変更がすべてのタブアイテムに適用されることを確認（Acceptance Criteria 10.2）
  - カスタムCSSが適用されてスタイルがオーバーライドされることを確認（Acceptance Criteria 10.5）
  - _Requirements: 10.2, 10.5_

### 14. スナップショット機能の実装

- [x] 14.1 SnapshotManager サービスの実装
  - 現在状態のJSON形式スナップショット作成（createSnapshot）を実装
  - スナップショットからのセッション復元（restoreSnapshot）を実装
  - IndexedDBService と連携してスナップショットを保存・取得
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 14.2 自動スナップショット機能
  - chrome.alarms による定期実行スケジューリングを実装
  - UserSettings の autoSnapshotInterval に基づいて自動保存
  - startAutoSnapshot/stopAutoSnapshot メソッドを実装
  - _Requirements: 11.4, 11.5_

- [x] 14.3 スナップショット履歴管理
  - 古いスナップショット削除機能（例: 最新10件を保持）を実装
  - スナップショット一覧表示 UI を実装
  - スナップショット削除とエクスポート/インポート UI を実装
  - _Requirements: 11.6_

- [x]* 14.4 スナップショット機能のテスト
  - スナップショットがJSON形式でエクスポートされることを確認（Acceptance Criteria 11.1, 11.2）
  - スナップショットからタブとツリー構造が復元されることを確認（Acceptance Criteria 11.3）
  - 自動スナップショットが設定間隔で保存されることを確認（Acceptance Criteria 11.5）
  - _Requirements: 11.1, 11.2, 11.3, 11.5_

### 15. コンテキストメニューの実装

- [x] 15.1 (P) ContextMenu コンポーネントの実装
  - 右クリック時のメニュー表示と位置計算を実装
  - メニュー外クリックで閉じる処理を実装
  - _Requirements: 12.1_

- [x] 15.2 (P) MenuActions とメニュー項目の実装
  - タブを閉じる、複製、ピン留め、新しいウィンドウで開く、グループ化などのアクションを実装
  - 選択状態に応じたメニュー項目の動的生成を実装
  - 複数タブ選択時の一括操作を実装
  - _Requirements: 12.2, 12.3, 12.4_

- [x]* 15.3 コンテキストメニューのテスト
  - 右クリックでコンテキストメニューが表示されることを確認（Acceptance Criteria 12.1）
  - メニューから操作を選択すると対応するアクションが実行されることを確認（Acceptance Criteria 12.3）
  - _Requirements: 12.1, 12.3_

### 16. 統合とエンドツーエンドテスト

- [x] 16.1 全機能の統合テスト
  - サイドパネル表示からタブツリー操作まで一連のフローをテスト
  - ドラッグ&ドロップによるツリー再構成の動作確認
  - ビュー切り替えとグループ化の連携確認
  - スナップショット保存と復元の動作確認
  - _Requirements: 全体_

- [x] 16.2 パフォーマンステスト
  - 100タブ以上でのレンダリング性能を測定（目標: 500ms以内）
  - ドラッグ中のフレームレート測定（目標: 60fps維持）
  - IndexedDB操作の性能測定（目標: 100ms以内）
  - 必要に応じて React.memo や仮想スクロールを導入
  - _Requirements: 全体（パフォーマンス要件）_

- [x] 16.3 Vivaldi互換性テスト
  - Vivaldiブラウザ最新版での全機能動作確認
  - Vivaldiのテーマ設定との視覚的調和の確認
  - サイドパネルAPIの正常動作確認
  - 標準Chrome拡張機能APIの互換性確認
  - _Requirements: 14.1, 14.2, 14.4_

- [x] 16.4 エラーハンドリングとエッジケースのテスト
  - タブAPI失敗時の挙動確認
  - ストレージ容量超過時の警告表示確認
  - 循環参照検出の動作確認
  - カスタムCSSエラー時のフォールバック確認
  - _Requirements: 全体（エラーハンドリング）_

---

## 要件カバレッジマトリクス

| Requirement | Summary | 対応タスク |
|-------------|---------|----------|
| 1.1 - 1.5 | サイドパネル表示 | 1.1, 3.1, 4.1, 4.2, 4.3, 4.4 |
| 2.1 - 2.5 | ツリー構造管理 | 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5 |
| 3.1 - 3.5 | ドラッグ&ドロップ（パネル内） | 6.1, 6.2, 6.3, 6.4, 6.5 |
| 4.1 - 4.4 | クロスウィンドウD&D | 3.2, 7.1, 7.2, 7.3, 7.4 |
| 5.1 - 5.5 | グループ化 | 9.1, 9.2, 9.3, 9.4 |
| 6.1 - 6.5 | ビュー切り替え | 8.1, 8.2, 8.3, 8.4, 8.5 |
| 7.1 - 7.4 | 未読インジケータ | 10.1, 10.2, 10.3 |
| 8.1 - 8.5 | タブ閉じる警告 | 11.1, 11.2, 11.3, 11.4 |
| 9.1 - 9.4 | 新規タブ位置 | 5.2, 12.1, 12.2, 12.3 |
| 10.1 - 10.6 | UI/UXカスタマイズ | 13.1, 13.2, 13.3, 13.4 |
| 11.1 - 11.6 | スナップショット | 2.2, 14.1, 14.2, 14.3, 14.4 |
| 12.1 - 12.4 | コンテキストメニュー | 15.1, 15.2, 15.3 |
| 13.1 - 13.5 | ホットリロード | 1.1, 1.2 |
| 14.1 - 14.5 | Vivaldi互換性 | 13.3, 16.3 |

すべての要件が実装タスクでカバーされています。

---

## 実装ガイドライン

### タスク実行の推奨順序

1. **Phase 1: 基盤構築** (Tasks 1-3) - プロジェクトセットアップ、ストレージ、Service Worker
2. **Phase 2: 基本UI** (Tasks 4-5) - サイドパネル表示とツリー状態管理
3. **Phase 3: コアインタラクション** (Tasks 6-7) - ドラッグ&ドロップ
4. **Phase 4: 高度な機能** (Tasks 8-12) - ビュー、グループ、未読、閉じる、位置調整
5. **Phase 5: カスタマイズ** (Tasks 13-15) - UI/UX、スナップショット、コンテキストメニュー
6. **Phase 6: 統合と検証** (Task 16) - テストと最適化

### 並列実行の推奨

- `(P)` マークの付いたタスクは並列実行可能です
- 例: Tasks 2.1, 2.2 は並列実行可能
- 例: Tasks 4.1, 4.2, 4.3 は並列実行可能

### テストタスクについて

- `- [ ]*` マークの付いたテストタスクは、コア実装後に実施できるオプショナルなテストです
- MVP配信を優先する場合、これらのテストは後回しにできます
- ただし、統合テスト (Task 16) は必須です
