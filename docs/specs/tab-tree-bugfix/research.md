# Research & Design Decisions

## Summary
- **Feature**: `tab-tree-bugfix`
- **Discovery Scope**: Extension（既存システムへの修正・機能追加）
- **Key Findings**:
  1. 余分な「Loading」タブの原因: TreeStateProviderがタブステータス変更を監視していない
  2. DnD関連バグ: dnd-kitの`event.over`はツリー外でもnullにならない仕様のため、独自検知が必要
  3. 複数ウィンドウ対応: `currentWindowId`がnullのままフィルタリングが無効化されている

## Research Log

### タブ状態の永続化と復元
- **Context**: 「Loading」タブが余分に表示される問題の調査
- **Sources Consulted**:
  - `src/storage/IndexedDBService.ts`
  - `src/storage/StorageService.ts`
  - `src/sidepanel/providers/TreeStateProvider.tsx`
  - `src/background/event-handlers.ts`
- **Findings**:
  - Service Workerは`changeInfo.status`変更を検知してSTATE_UPDATEDを送信（行220-224）
  - TreeStateProviderの`handleTabUpdated()`はステータス変更を条件に含めていない（行384）
  - 結果: タブがローディング完了しても`tabInfoMap`が更新されず「Loading...」表示が残る
- **Implications**: TreeStateProviderのタブ更新条件に`changeInfo.status`を追加する必要あり

### ファビコン永続化
- **Context**: ブラウザ再起動時にファビコンが復元されない問題
- **Sources Consulted**:
  - `src/storage/StorageService.ts` - STORAGE_KEYS
  - `src/sidepanel/providers/TreeStateProvider.tsx` - loadTabInfoMap
- **Findings**:
  - 現在の永続化キー: `TREE_STATE`, `USER_SETTINGS`, `UNREAD_TABS`, `GROUPS`, `TAB_TITLES`
  - ファビコン専用の永続化キーが存在しない
  - `loadTabInfoMap()`は`chrome.tabs.query`から直接取得しており、永続化データを使用していない
- **Implications**: `TAB_FAVICONS`キーの追加と、タイトル永続化と同様のフローでファビコン永続化を実装

### タイトル永続化の更新タイミング
- **Context**: ページ遷移後のタイトル変更が永続化に反映されない問題
- **Sources Consulted**:
  - `src/background/event-handlers.ts` - handleTabUpdated
  - `src/services/TitlePersistenceService.ts`
- **Findings**:
  - `titlePersistence.saveTitle()`は`handleTabUpdated()`内で呼び出されている
  - 300msのデバウンス処理あり
  - 現在の実装は正しく動作しているはず
- **Implications**: 実際の挙動を確認し、問題があれば修正。E2Eテストで検証

### ドラッグ＆ドロップ - プレースホルダー表示
- **Context**: プレースホルダーの表示位置がおかしい問題
- **Sources Consulted**:
  - `src/sidepanel/components/GapDropDetection.ts`
  - `src/sidepanel/components/TabTreeView.tsx` - DragMonitor
  - `src/sidepanel/components/DropIndicator.tsx`
- **Findings**:
  - `calculateDropTarget()`でマウスY座標をコンテナ相対で計算（行602-604）
  - スクロール位置を反映した計算に誤差がある可能性
  - `getBoundingClientRect()`の結果はビューポート相対、スクロールオフセットの加算が不完全
- **Implications**: マウスY座標計算時にスクロールオフセットを正しく反映する修正が必要

### ドラッグ＆ドロップ - ドロップ処理
- **Context**: ドロップしてもタブが挿入されない問題
- **Sources Consulted**:
  - `src/sidepanel/components/TabTreeView.tsx` - handleDragEnd, handleSiblingDrop
  - `src/sidepanel/providers/TreeStateProvider.tsx` - handleSiblingDrop
- **Findings**:
  - `onSiblingDrop`は呼び出されている
  - TreeStateProvider内でツリー構造は更新されている
  - しかし、ブラウザタブの実際の順序（`chrome.tabs.move()`）との同期処理が不完全
- **Implications**: ドロップ後に`chrome.tabs.move()`でブラウザタブの順序も同期する処理を追加

### ドラッグ＆ドロップ - スクロール制限
- **Context**: ドラッグ中に必要以上にスクロールする問題
- **Sources Consulted**:
  - `src/sidepanel/components/TabTreeView.tsx` - AUTO_SCROLL_CONFIG
- **Findings**:
  - 現在の設定: `threshold: { x: 0.1, y: 0.15 }`, `acceleration: 5`, `interval: 10`
  - dnd-kitのautoScroll機能がコンテンツ範囲を超えてスクロールを許可している可能性
  - 横スクロール禁止は`overflow-x-hidden`で対応済みだが、autoScrollのx閾値が動作
- **Implications**: autoScroll設定の見直し、またはカスタムスクロールハンドラの実装

### ツリービュー外へのドロップ検知
- **Context**: ツリービュー外にドロップして新ウィンドウを作成する機能
- **Sources Consulted**:
  - `src/sidepanel/components/TabTreeView.tsx` - handleDragEnd（行855-885）
  - dnd-kit公式ドキュメント
- **Findings**:
  - 現在の実装: `!event.over`でツリー外を判定（行854）
  - **問題**: dnd-kitの仕様上、`event.over`はツリー外でもnullにならない
  - ドラッグ中はマウスが最後に触れた要素を保持し続ける
- **Implications**: マウス座標をリアルタイムで追跡し、コンテナ境界との比較で独自にツリー外判定を実装

### フォントサイズ設定
- **Context**: フォントサイズ設定がタブタイトルに反映されない問題
- **Sources Consulted**:
  - `src/sidepanel/providers/ThemeProvider.tsx` - CSS変数設定
  - `src/sidepanel/components/TabTreeView.tsx` - タブタイトル表示
- **Findings**:
  - ThemeProviderでCSS変数`--font-size`を設定し、`body`に適用（行120-130）
  - TabTreeViewのタブタイトルは`text-sm`クラスを使用（行263）
  - Tailwindの`text-sm`（0.875rem）がCSS変数より優先度が高い
- **Implications**: `text-sm`クラスを削除し、CSS変数またはinline styleでフォントサイズを適用

### 休止タブの視覚的区別
- **Context**: 休止タブをグレーアウト表示する機能
- **Sources Consulted**:
  - Chrome Tabs API - `discarded`プロパティ
  - `src/sidepanel/components/TabTreeView.tsx`
  - `src/types/index.ts`
- **Findings**:
  - Chrome Tabs APIは`discarded`フラグを提供
  - 現在のコードベースでは`discarded`を使用していない
  - `tabInfoMap`に`discarded`プロパティが含まれていない
- **Implications**: `ExtendedTabInfo`型に`discarded`を追加し、UIでグレーアウト表示を実装

### 新しいタブのタイトル表示
- **Context**: スタートページのタイトルがURLで表示される問題
- **Sources Consulted**:
  - `src/sidepanel/components/TreeNode.tsx` - getDisplayTitle, isInternalOrNewTabUrl
  - `src/sidepanel/components/TabTreeView.tsx`
- **Findings**:
  - TreeNode.tsxには`isInternalOrNewTabUrl()`と`getDisplayTitle()`が実装済み
  - TabTreeViewはこれらの関数を使用せず、`tabInfo.title`を直接表示
  - 正規表現パターンはクエリパラメータ付きURLに対応していない可能性
- **Implications**: TabTreeViewでも同様のタイトル変換ロジックを適用、またはTreeNodeの関数を共有

### テキスト選択の禁止
- **Context**: Shift+クリックで複数選択時にテキストが選択される問題
- **Sources Consulted**:
  - `src/sidepanel/components/TabTreeView.tsx` - タブノード要素
  - `src/sidepanel/components/TreeNode.tsx`
  - `src/sidepanel/components/ContextMenu.tsx`
- **Findings**:
  - ContextMenuには`select-none`クラスが適用済み
  - 古いTreeNodeには`select-none`クラスがある（行169）
  - TabTreeViewのSortableTreeNodeItem/TreeNodeItemには`select-none`がない
- **Implications**: TabTreeViewのタブノード要素に`select-none`クラスを追加

### アクティブタブのハイライト
- **Context**: ピン留めタブのハイライトが動作しない問題
- **Sources Consulted**:
  - `src/sidepanel/components/PinnedTabsSection.tsx`
  - `src/sidepanel/components/TabTreeView.tsx`
- **Findings**:
  - 通常タブ: `isActive ? 'bg-gray-600' : ''`で正しくハイライト
  - ピン留めタブ: `hover:bg-gray-700`のみで、アクティブ状態の条件がない
  - PinnedTabsSectionに`activeTabId`propが存在しない
- **Implications**: PinnedTabsSectionに`activeTabId`propを追加し、アクティブ時のスタイルを適用

### ピン留めタブの並び替え
- **Context**: ピン留めタブのドラッグ＆ドロップ並び替え機能
- **Sources Consulted**:
  - `src/sidepanel/components/PinnedTabsSection.tsx`
  - Chrome Tabs API
- **Findings**:
  - PinnedTabsSectionはdnd-kitを使用していない静的表示
  - ピン留めタブの順序変更には`chrome.tabs.move()`が必要
  - 並び替え後の順序を永続化する仕組みがない
- **Implications**: PinnedTabsSectionにdnd-kit統合を追加、`chrome.tabs.move()`で順序を同期

### タブグループ化機能
- **Context**: 複数タブのグループ化が動作しない問題
- **Sources Consulted**:
  - `src/sidepanel/hooks/useMenuActions.ts`
  - `src/background/event-handlers.ts` - handleCreateGroup
  - `src/services/TreeStateManager.ts` - createGroupFromTabs
- **Findings**:
  - CREATE_GROUPメッセージは送信されている
  - TreeStateManager.createGroupFromTabsは正しくグループノードを作成
  - UI更新の同期に遅延がある、またはメッセージ応答の処理が不完全
- **Implications**: グループ作成後のUI更新フローを確認し、同期処理を修正

### グループに追加機能
- **Context**: シングルタブをグループに追加できない問題
- **Sources Consulted**:
  - `src/sidepanel/components/ContextMenu.tsx`
  - `src/sidepanel/hooks/useMenuActions.ts`
- **Findings**:
  - コンテキストメニューの「グループに追加」は`'group'`アクションを実行
  - `'group'`アクションは新規グループ作成のみ
  - 既存グループ一覧を表示するサブメニューがない
  - `addTabToGroup`メソッドは存在するがUI連携がない
- **Implications**: グループ選択サブメニューの実装と、既存グループへの追加処理を実装

### 複数ウィンドウ対応
- **Context**: 複数ウィンドウで全タブが表示される問題
- **Sources Consulted**:
  - `src/sidepanel/providers/TreeStateProvider.tsx` - loadCurrentWindowId
  - Chrome Windows API
- **Findings**:
  - `loadCurrentWindowId()`はURLパラメータから`windowId`を取得
  - URLパラメータがない場合、`currentWindowId`はnullのまま
  - nullの場合、フィルタリングが無効化され全ウィンドウのタブが表示
  - `chrome.windows.getCurrent()`を呼び出していない
- **Implications**: `chrome.windows.getCurrent()`で現在のウィンドウIDを取得し、フィルタリングを有効化

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 既存パターン維持 | TreeStateProvider + Service Worker + Storage の現行アーキテクチャを踏襲 | 変更範囲最小化、既存テストとの互換性 | 大規模な構造変更が必要な場合は限界 | 今回のバグ修正には十分 |
| イベント駆動強化 | 状態変更の通知をより細粒度化 | 即座のUI更新、同期問題の解消 | 複雑性増加、パフォーマンスへの影響 | 一部採用（ステータス更新通知） |

## Design Decisions

### Decision: タブステータス変更の監視追加
- **Context**: Loading状態が解除されてもUIが更新されない
- **Alternatives Considered**:
  1. TreeStateProviderの条件に`changeInfo.status`を追加
  2. Service Workerから完全なタブ情報を送信
- **Selected Approach**: Option 1 - 条件追加
- **Rationale**: 最小限の変更で問題解決、既存パターンと整合性
- **Trade-offs**: 追加の条件チェックによる微小なオーバーヘッド
- **Follow-up**: E2Eテストでステータス変更の反映を検証

### Decision: ツリー外ドロップ検知の独自実装
- **Context**: dnd-kitの`event.over`ではツリー外判定ができない
- **Alternatives Considered**:
  1. onDragMoveでマウス位置を追跡し、外部フラグを管理
  2. onDragEndでactivatorEventからマウス座標を取得し判定
  3. カスタムセンサーの実装
- **Selected Approach**: Option 1 - onDragMoveでの追跡
- **Rationale**: リアルタイムでのフィードバックが可能、ドラッグ中の視覚的表示にも活用可能
- **Trade-offs**: 状態管理の複雑化
- **Follow-up**: パフォーマンステストでイベント頻度を確認

### Decision: 複数ウィンドウ対応の修正
- **Context**: currentWindowIdがnullで全タブが表示される
- **Alternatives Considered**:
  1. `chrome.windows.getCurrent()`で現在のウィンドウIDを取得
  2. URLパラメータでウィンドウIDを明示的に渡す
  3. Service Workerからウィンドウ情報を取得
- **Selected Approach**: Option 1 - chrome.windows.getCurrent()
- **Rationale**: 標準APIの活用、追加設定不要
- **Trade-offs**: API呼び出しの非同期処理
- **Follow-up**: 複数ウィンドウでのE2Eテストを追加

## Risks & Mitigations
- **dnd-kit更新による破壊的変更** — ドロップ検知ロジックをカスタム実装で隔離し、ライブラリ依存を最小化
- **パフォーマンス低下（多数タブ環境）** — 状態更新のバッチ処理、メモ化の活用
- **複数ウィンドウ間の状態競合** — ウィンドウIDベースの名前空間分離、ストレージキーのプレフィックス化
- **E2Eテストのフレーキー化** — ポーリングユーティリティの活用、固定時間待機の排除

## References
- [dnd-kit Documentation](https://docs.dndkit.com/) — ドラッグ＆ドロップライブラリの公式ドキュメント
- [Chrome Extensions API - Tabs](https://developer.chrome.com/docs/extensions/reference/tabs/) — タブ操作API
- [Chrome Extensions API - Windows](https://developer.chrome.com/docs/extensions/reference/windows/) — ウィンドウ操作API
- `docs/steering/tech.md` — プロジェクト技術スタック
- `docs/steering/structure.md` — プロジェクト構造パターン
