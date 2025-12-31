# Implementation Plan

## Phase 0: 事前修正タスク（dnd-kit移行前に完了）

- [x] 1. E2Eテストの安定化（フレーキーテスト修正）
- [x] 1.1 (P) タブ永続化テストのフレーキー修正
  - `tab-persistence.spec.ts:201:5`のテストがフレーキーである原因を調査
  - 固定時間待機を使用している箇所をポーリングユーティリティに置き換え
  - ページ遷移時のタイトル更新検出を確実にする待機条件を実装
  - `--repeat-each=10`で10回連続成功することを確認
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2. UIの軽微な修正
- [x] 2.1 (P) 新規タブボタンからテキストラベルを削除
  - 「新規タブ」というテキストを削除し「+」アイコンのみを表示
  - _Requirements: 8.1, 8.2_

- [x] 2.2 (P) 新規タブで開くURLをVivaldiスタートページに変更
  - `chrome://newtab/`ではなく`chrome://vivaldi-webui/startpage`を開くよう修正
  - _Requirements: 12.1, 12.2_

- [x] 2.3 (P) 未読インジケーターの位置をタブ右端に固定
  - タイトル長に関係なく未読インジケーターをタブ右端に配置するスタイル修正
  - _Requirements: 13.1, 13.2_

- [x] 2.4 (P) ビューアイコン選択の即時反映
  - プリセットからアイコン選択時に「Select」ボタン不要で即座に反映
  - ツリービューパネル上のアイコンも即座に更新
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 3. タブ位置とタイトル表示の修正
- [x] 3.1 (P) 新規タブ位置設定のロジック修正
  - リンククリックで開かれたタブは「リンククリックのタブの位置」設定に従って配置
  - 手動で開かれたタブ（新規タブボタン、設定画面など）は「手動で開かれたタブの位置」設定に従って配置
  - システムページ判定（chrome://、vivaldi://、chrome-extension://、about:スキーム）を追加
  - openerTabIdがあってもシステムページの場合は手動タブとして扱う
  - デフォルト設定を「リンククリック：子タブ」「手動：リストの最後」に設定
  - 設定画面から「デフォルトの新しいタブの位置」設定を削除
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

- [x] 3.2 (P) システムページタイトルのフレンドリー表示
  - タイトルがURL形式（スキーム://で始まる）の場合のみフレンドリー名に置き換え
  - PDFなど既にタイトルが設定されている場合はそのまま表示
  - chrome://settings → 「設定」などのマッピングを実装
  - file://スキームはタイトルがURLのままの場合のみファイル名に置き換え
  - _Requirements: 17.1.1, 17.1.2, 17.1.3, 17.1.4, 17.1.5_

- [x] 3.3 (P) 新規タブのタイトルを「スタートページ」に修正
  - 新規タブ作成時のタブタイトルがVivaldiスタートページのタイトルと一致するよう修正
  - _Requirements: 11.1, 11.2_

- [ ] 4. タブ操作の改善
- [x] 4.1 (P) 選択状態の自動解除機能を実装
  - 新しいタブが開かれたときにタブ選択状態を解除
  - タブクローズ等の操作時にも選択状態を解除
  - Note: アクティブタブ変更時の解除は、ツリー内クリック操作と競合するため未実装
  - _Requirements: 15.1, 15.2_

- [x] 4.2 (P) タブ複製時の配置を兄弟タブに修正
  - 複製されたタブを元のタブの子ではなく兄弟として配置
  - 元のタブの直下（1つ下）に表示
  - _Requirements: 16.1, 16.2, 16.3_

- [x] 4.3 (P) ビューへの新規タブ追加を修正
  - 新規タブを現在開いているビューに追加
  - ビューを開いた状態で新規タブ追加時にビューが閉じないよう修正
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 4.4 (P) ファビコンの永続化復元を実装
  - ブラウザ再起動後にファビコンを永続化データから復元
  - タブがロードされていない状態でも永続化されていた画像を表示
  - _Requirements: 14.1, 14.2_

- [ ] 5. Phase 0のE2Eテスト追加
- [x] 5.1 UI軽微修正のE2Eテスト
  - 未読インジケーター位置の検証（短いタイトル、長いタイトル両方）
  - ビューアイコン選択即時反映の検証
  - `--repeat-each=10`で10回連続成功、最適な実行時間を確認
  - _Requirements: 9.4, 9.5, 13.3, 13.4_

- [x] 5.2 タブ位置とタイトル表示のE2Eテスト
  - タブ位置設定の各シナリオ検証（リンククリック、手動タブ作成、設定変更後の反映）
  - 新規タブタイトル表示の検証
  - 新規タブURLの検証
  - `--repeat-each=10`で10回連続成功、最適な実行時間を確認
  - _Requirements: 11.3, 11.4, 12.3, 12.4, 17.8, 17.9_

- [x] 5.3 タブ操作改善のE2Eテスト
  - 各種操作後のタブ選択状態解除の検証
  - タブ複製時の配置検証
  - ビューへの新規タブ追加検証
  - ファビコン永続化と復元の検証
  - `--repeat-each=10`で10回連続成功、最適な実行時間を確認
  - _Requirements: 10.4, 10.5, 14.3, 14.4, 15.3, 15.4, 16.4, 16.5_

---

## Phase 1: 自前D&D基盤実装とTabTreeView移行

- [ ] 6. 自前ドラッグ&ドロップ基盤の実装
- [x] 6.1 useDragDropフックの実装
  - mousedown/mousemove/mouseupイベントによるD&D操作の実装
  - 8px移動検知によるドラッグ開始（誤操作防止）
  - ドラッグ状態管理（DragState）の実装
  - getItemPropsによるアイテムprops提供
  - getDragOverlayStyleによるオーバーレイスタイル計算
  - 垂直方向ドラッグのサポート
  - GapDropDetection.tsとの連携
  - _Requirements: 3.1.2, 3.1.3, 3.1.4, 3.1.5_

- [x] 6.2 useAutoScrollフックの実装
  - ドラッグ中にマウスが端に近づいたら自動スクロール
  - スクロール可能範囲内のみスクロール（clampToContent: true）
  - requestAnimationFrameによるスムーズなスクロール
  - スクロール可能量を超えるスクロールを防止（Requirement 3対応）
  - _Requirements: 3.1, 3.2, 3.1.2_

- [x] 6.3 DragOverlayコンポーネントの実装
  - ReactDOM.createPortalでbody直下に描画
  - pointer-events: noneでマウスイベントを透過
  - transformでマウス位置に追従
  - ドラッグ中の要素をクローン表示
  - _Requirements: 3.1.4_

- [x] 6.4 useDragDropフックの単体テスト実装
  - ドラッグ開始（8px移動検知）のテスト
  - ドラッグ中の状態更新テスト
  - ドラッグ終了・キャンセルのテスト
  - 垂直モードの移動距離計算テスト
  - _Requirements: 3.1.3_

- [ ] 7. TabTreeViewの自前D&D実装への移行
- [x] 7.1 TabTreeViewからdnd-kit依存を削除
  - @dnd-kit/core、@dnd-kit/sortableのインポートを削除
  - DndContext、SortableContextの使用を削除
  - useSortable、useDndMonitorの使用を削除
  - useDragDropフックに置き換え
  - DragOverlayコンポーネントを統合
  - _Requirements: 3.1.1, 3.1.7_

- [x] 7.2 ドラッグアウト判定の修正
  - サイドパネル外にドラッグした場合のみ新規ウィンドウ作成
  - サイドパネル内の空白領域（タブツリー下部）へのドラッグでは新規ウィンドウを作成しない
  - ドラッグアウト判定をサイドパネル境界基準に変更
  - useDragDropフックにdragOutBoundaryRefオプションを追加
  - TabTreeViewにsidePanelRefプロパティを追加
  - SidePanelRootからsidePanelRefをTabTreeViewに渡すように変更
  - E2Eテストを追加して動作を検証
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 7.3 タブ間ドロップ位置の修正
  - タブとタブの隙間にドロップした位置に正しくタブを配置
  - ブラウザタブがドロップ位置に対応した正しいインデックスに移動
  - ツリービューのタブ順序とブラウザタブ順序の同期
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 8. Phase 1のE2Eテスト修正（TabTreeView関連）
- [x] 8.1 e2e/utils/drag-drop-utils.tsの書き直し
  - 自前D&D実装用のドラッグ開始/移動/ドロップヘルパー関数を新規作成
  - dnd-kit固有のセレクタを使用しない実装
  - マウスイベントベースのドラッグ操作シミュレーション
  - _Requirements: 3.2.1, 3.2.2_

- [x] 8.2 (P) drag-drop-reorder.spec.tsの書き直し
  - タブ並び替えシナリオを自前D&D用に再実装
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 2.4, 2.5, 3.2.1, 3.2.3_

- [x] 8.3 (P) drag-drop-insert.spec.tsの書き直し
  - タブ挿入シナリオを自前D&D用に再実装
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 3.2.1, 3.2.3_

- [x] 8.4 (P) drag-drop-hierarchy.spec.tsの書き直し
  - 親子関係変更シナリオを自前D&D用に再実装
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 3.2.1, 3.2.3_

- [x] 8.5 (P) drag-drop-complex.spec.tsの書き直し
  - 複雑なD&Dシナリオを自前D&D用に再実装
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 3.2.1, 3.2.3_

- [x] 8.6 (P) drag-drop-external.spec.tsの書き直し
  - ツリー外ドロップ（ドラッグアウト）シナリオを自前D&D用に再実装
  - サイドパネル内外の両ケースを検証
  - `--repeat-each=10`で10回連続成功確認
  - Note: サブツリー移動テストはPhase 3で実装予定（TreeStateManager.getSubtreeの修正が必要）
  - _Requirements: 3.2.1, 3.2.3, 4.4, 4.5_

- [x] 8.7 (P) drag-drop-placeholder.spec.tsの書き直し
  - ドロップインジケーター表示シナリオを自前D&D用に再実装
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 3.2.1, 3.2.3_

- [x] 8.8 (P) drag-drop-hover.spec.tsの書き直し
  - ホバー時挙動シナリオを自前D&D用に再実装
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 3.2.1, 3.2.3_

- [x] 8.9 (P) drag-drop-scroll.spec.tsの書き直し
  - ドラッグ中スクロールシナリオを自前D&D用に再実装
  - スクロール制限の検証を含む
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 3.3, 3.4, 3.2.1, 3.2.3_

- [x] 8.10 (P) gap-drop-accuracy.spec.tsの書き直し
  - タブ間ドロップ精度シナリオを自前D&D用に再実装
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 3.2.1, 3.2.3_

- [ ] 9. Phase 1完了確認
- [x] 9.1 Phase 1のE2Eテスト全体検証
  - 修正済み全テストを`--repeat-each=10`で実行
  - cross-window関連テストは一時スキップ（Phase 3で修正）
  - TabTreeViewからdnd-kit依存が完全に削除されていることを確認
  - _Requirements: 3.2.3, 3.2.4_

---

## Phase 2: PinnedTabsSection移行

- [ ] 10. PinnedTabsSectionの自前D&D実装への移行
- [x] 10.1 useDragDropフックに水平ドラッグモードを追加
  - direction: 'horizontal'オプションの実装
  - 水平方向の移動距離計算
  - 水平方向のドロップターゲット計算
  - _Requirements: 3.1.2_

- [x] 10.2 PinnedTabsSectionからdnd-kit依存を削除
  - @dnd-kit/core、@dnd-kit/sortableのインポートを削除
  - horizontalListSortingStrategyの使用を削除
  - useDragDropフック（horizontal mode）に置き換え
  - _Requirements: 3.1.1, 3.1.7_

- [ ] 11. Phase 2のE2Eテスト検証
- [x] 11.1 ピン留めタブD&D操作の検証
  - ピン留めタブの並び替えが正しく動作することを確認
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 3.2.3_

---

## Phase 3: TabTreeViewWithGroups移行とクロスウィンドウ機能

- [ ] 12. TabTreeViewWithGroupsの自前D&D実装への移行
- [x] 12.1 TabTreeViewWithGroupsからdnd-kit依存を削除
  - dnd-kit関連のインポートと使用を削除
  - useDragDropフックに置き換え
  - _Requirements: 3.1.1, 3.1.7_

- [ ] 13. クロスウィンドウドラッグ機能の実装
- [x] 13.1 DragSessionManagerの実装
  - Service Workerでのドラッグセッション管理
  - セッションの作成・更新・終了
  - 状態マシンによる排他制御（pending_cross_window状態のロック）
  - タイムアウト処理（セッション10秒、クロスウィンドウ移動2秒）
  - ウィンドウクローズ時のセッションクリーンアップ
  - chrome.alarmsによるService Worker keep-alive
  - _Requirements: 6.1, 6.2, 6.3, 6.6, 6.7_

- [x] 13.2 useCrossWindowDragフックの実装
  - mouseenterイベントでドラッグセッションをチェック
  - 別ウィンドウからのドラッグ検知
  - DragSessionManager経由でタブ移動を実行
  - useDragDrop.startDragProgrammaticallyでドラッグ状態を継続
  - エラー時はサイレントにドラッグをキャンセル
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

- [x] 13.3 useDragDropにstartDragProgrammaticallyを実装
  - プログラマティックにドラッグを開始する機能
  - 8px移動待機をスキップして即座にドラッグ状態を開始
  - クロスウィンドウドラッグのウィンドウ間継続用
  - _Requirements: 3.1.6_

- [x] 14. 空ウィンドウの自動クローズ機能
- [x] 14.1 ドラッグアウト後の空ウィンドウ自動クローズを実装
  - ドラッグアウトにより全てのタブが移動されたウィンドウを自動的に閉じる
  - ウィンドウにタブが残っている場合は維持
  - _Requirements: 7.1, 7.2_

- [ ] 15. タブグループ化機能の修正
- [x] 15.1 グループタブ専用ページの作成
  - src/group/group.html、GroupPage.tsx、index.tsxを新規作成
  - グループ名をh1要素で表示
  - 子タブをリスト（ul/li）で表示
  - ポーリングによりツリー状態の更新を監視し子タブリストを更新
  - ローディング表示の実装
  - エラー/リトライUIの実装
  - vite.config.tsにエントリーポイントを追加
  - manifest.jsonにweb_accessible_resourcesを追加
  - _Requirements: 5.4, 5.5, 5.8, 5.9, 5.10_

- [x] 15.2 グループ化処理を実タブ作成に変更
  - chrome.tabs.create()でグループタブを作成（仮想タブID使用をやめる）
  - グループタブURLをchrome-extension://スキームに設定
  - タブをバックグラウンドで作成し、ツリー状態更新後にアクティブ化（レースコンディション対策）
  - TreeStateManager.createGroupWithRealTabの実装
  - GET_GROUP_INFOメッセージハンドラの追加
  - _Requirements: 5.1, 5.2, 5.3, 5.6, 5.7_

- [ ] 16. Phase 3のE2Eテスト書き直し
- [x] 16.1 (P) cross-window-drag-drop.spec.tsの書き直し
  - クロスウィンドウD&Dシナリオを自前D&D用に再実装
  - ウィンドウ間タブ移動の検証
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 6.8, 6.9, 3.2.1, 3.2.3_

- [x] 16.2 (P) cross-window-drag-indicator.spec.tsの書き直し
  - クロスウィンドウインジケーターシナリオを自前D&D用に再実装
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 3.2.1, 3.2.3_

- [x] 16.3 (P) drag-drop-improvements.spec.tsの書き直し
  - D&D改善機能シナリオを自前D&D用に再実装
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 3.2.1, 3.2.3_

- [x] 16.4 (P) drag-drop-child-independent.spec.tsの書き直し
  - 子タブ独立操作シナリオを自前D&D用に再実装
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 3.2.1, 3.2.3_

- [x] 16.5 (P) drag-tab-size-stability.spec.tsの書き直し
  - ドラッグ中タブサイズ安定性シナリオを自前D&D用に再実装
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 3.2.1, 3.2.3_

- [x] 16.6 グループ化機能のE2Eテスト追加
  - コンテキストメニューからのグループ化操作の検証
  - グループタブのURLがchrome-extension://であることの検証
  - グループ化後の親タブ存在検証
  - グループ化後の親子関係検証
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 5.11, 5.12, 5.13, 5.14_

- [x] 16.7 空ウィンドウ自動クローズのE2Eテスト追加
  - ドラッグアウトで全タブ移動後のウィンドウ自動クローズ検証
  - `--repeat-each=10`で10回連続成功確認
  - _Requirements: 7.3, 7.4_

---

## Phase 4: dnd-kit完全削除と最終検証

- [ ] 17. dnd-kitライブラリの完全削除
- [x] 17.1 dnd-kit関連パッケージをpackage.jsonから削除
  - @dnd-kit/core、@dnd-kit/sortable、@dnd-kit/utilitiesを削除
  - dnd-kit-sortable-tree（存在する場合）を削除
  - npm installを実行して依存関係をクリーンアップ
  - _Requirements: 3.1.1, 3.1.7_

- [x] 17.2 DragDropProvider.tsxの削除
  - src/sidepanel/providers/DragDropProvider.tsxを削除（未使用または自前実装に統合済み）
  - 関連するインポートを削除
  - _Requirements: 3.1.7_

- [x] 17.3 コードベースからdnd-kit参照を完全削除
  - dnd-kit関連のインポートがコードベースに存在しないことを確認済み
  - docs/steering/structure.mdのインポート例を自前D&D実装の型に更新
  - docs/steering/tech.mdのdnd-kit言及を汎用的な表現に更新
  - テストファイル内のdnd-kit固有用語（DndContext、SortableContext）を自前実装に合わせた用語に更新
  - _Requirements: 3.1.7_

- [ ] 18. 最終検証
- [x] 18.1 全E2Eテストの最終検証
  - 全E2Eテストを`npx playwright test --repeat-each=10`で実行
  - 実行結果: 4080 passed, 50 failed, 20 skipped（実行時間: 12.5分）
  - 失敗テスト: context-menu.spec.ts:111（サブツリーを閉じる）、tab-grouping.spec.ts（グループ化機能4テスト）
  - これらの失敗テストはPhase 5のタスク19.1および19.2で修正予定
  - Note: 固定時間待機を使用しているテストはなし、実行時間は適切
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [x] 18.2 型チェックとビルド確認
  - `npm run type-check`がエラーなしで通過
  - `npm run build`が成功
  - _Requirements: 3.1.10_

---

## Phase 5: 残存テスト修正

- [ ] 19. 失敗E2Eテストの調査と修正
- [x] 19.1 (P) context-menu.spec.tsのサブツリークローズテスト修正
  - context-menu.spec.ts:111「サブツリーを閉じる」テストが失敗している原因を調査
  - E2EテストでのopenerTabIdによる親子関係がTreeStateManagerに反映されない問題を特定
  - handleCloseSubtreeまたはテストセットアップを修正
  - `--repeat-each=10`で10回連続成功を確認
  - _Requirements: 18.1, 18.2, 18.3_

- [x] 19.2 (P) tab-grouping.spec.tsのグループ化テスト修正
  - グループ化テストが失敗している原因を調査
  - isGroupNode関数が`tabId < 0`を判定条件としていたのに対し、実タブを使用するためIDプレフィックスのみで判定するよう修正
  - `--repeat-each=10`で110テスト全てが10回連続成功を確認
  - _Requirements: 5.11, 5.12, 5.13, 5.14, 18.1_

- [x] 19.3 全E2Eテストの再検証
  - 修正後の全E2Eテストを`npx playwright test --repeat-each=10`で実行
  - 実行結果: 4130 passed, 20 skipped（8.6分）
  - 100%パスを確認（スキップされたテストは環境依存のheadlessモード検証テストのみ）
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

---

## Requirements Coverage Summary

| Requirement | Task(s) |
|-------------|---------|
| 1 (E2Eテスト安定化) | 1.1 |
| 2 (タブ間ドロップ位置) | 7.3, 8.2 |
| 3 (ドラッグ時スクロール制限) | 6.2, 8.9 |
| 3.1 (dnd-kit削除と自前D&D) | 6.1-6.4, 7.1, 10.1-10.2, 12.1, 13.3, 17.1-17.3 |
| 3.2 (E2Eテスト修正) | 8.1-8.10, 16.1-16.5 |
| 4 (ドラッグアウト判定) | 7.2, 8.6 |
| 5 (タブグループ化) | 15.1, 15.2, 16.6, 19.2 |
| 6 (クロスウィンドウドラッグ) | 13.1-13.3, 16.1-16.2 |
| 7 (空ウィンドウ自動クローズ) | 14.1, 16.7 |
| 8 (新規タブボタン簡素化) | 2.1 |
| 9 (ビューアイコン即時反映) | 2.4, 5.1 |
| 10 (ビューへの新規タブ追加) | 4.3, 5.3 |
| 11 (新規タブタイトル修正) | 3.3, 5.2 |
| 12 (新規タブURL修正) | 2.2, 5.2 |
| 13 (未読インジケーター位置) | 2.3, 5.1 |
| 14 (ファビコン永続化復元) | 4.4, 5.3 |
| 15 (選択状態自動解除) | 4.1, 5.3 |
| 16 (タブ複製配置修正) | 4.2, 5.3 |
| 17 (新規タブ位置設定) | 3.1, 3.2, 5.2 |
| 17.1 (システムページタイトル) | 3.2 |
| 18 (E2Eテスト品質基準) | 18.1, 19.1, 19.2, 19.3 |
