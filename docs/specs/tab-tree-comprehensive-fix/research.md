# Research & Design Decisions

## Summary
- **Feature**: `tab-tree-comprehensive-fix`
- **Discovery Scope**: Extension（既存システムの拡張）
- **Key Findings**:
  - E2Eテストインフラは成熟しており、22種類のポーリングユーティリティが既存
  - ドラッグ&ドロップ機能は@dnd-kitベースで実装済み、GapDropDetection.tsに隙間検出ロジックあり
  - 既存UIコンポーネント（ViewSwitcher, TreeNode, ContextMenu）は拡張可能な設計

## Research Log

### E2Eテストのフレーキー問題
- **Context**: Requirement 1の3つのテスト（drag-drop-placeholder:268,318、tab-persistence:201）がフレーキー
- **Sources Consulted**:
  - `e2e/drag-drop-placeholder.spec.ts`
  - `e2e/tab-persistence.spec.ts`
  - `e2e/utils/polling-utils.ts`
  - `docs/steering/tech.md` E2Eテスト品質基準
- **Findings**:
  - 既存のポーリングユーティリティ（22種類）はrobustな設計
  - `waitForCondition`、`pollInServiceWorker`、`expect.toPass`の3層待機戦略が確立
  - 固定時間待機（`waitForTimeout`）は禁止、ポーリングで状態確定を待機する方針
  - バックグラウンドスロットリング対策として`bringToFront()`と`window.focus()`が必要
- **Implications**:
  - フレーキーテストの根本原因を特定し、ポーリング条件を改善する必要がある
  - 新規ポーリングユーティリティの追加は最小限に抑え、既存パターンを活用

### ビューのタブカウント機能
- **Context**: Requirement 2の不整合タブ削除時のカウント再計算
- **Sources Consulted**:
  - `src/sidepanel/components/ViewSwitcher.tsx`
  - `src/sidepanel/providers/TreeStateProvider.tsx`
  - `src/sidepanel/components/SidePanelRoot.tsx`
- **Findings**:
  - ViewSwitcherは`tabCounts`プロパティでビューごとのタブ数を表示
  - TreeStateProviderで`viewTabCounts`を算出し、SidePanelRootから渡している
  - 不整合タブ削除時のカウント再計算ロジックは明示的に実装されていない可能性
- **Implications**:
  - タブ削除イベント時にviewTabCountsを再計算するトリガーが必要
  - 不整合タブ（存在しないタブID）のクリーンアップ処理との連携が必要

### タブ間隙間へのドロップ
- **Context**: Requirement 3のGapドロップ精度問題
- **Sources Consulted**:
  - `src/sidepanel/components/GapDropDetection.ts`
  - `src/sidepanel/components/TabTreeView.tsx`
  - `src/sidepanel/components/DropIndicator.tsx`
  - `src/sidepanel/providers/TreeStateProvider.tsx` (handleSiblingDrop)
- **Findings**:
  - GapDropDetection.tsでY座標からドロップターゲットを計算（上下25%が隙間判定領域）
  - DropIndicator.tsxで視覚的インジケーターを表示
  - handleSiblingDropでGapドロップ時のツリー更新を処理
  - 異なる深度（depth）の選択はマウスX座標とcalculateTargetDepth.tsで処理
- **Implications**:
  - ドロップ位置計算ロジックとインジケーター表示のずれを調査・修正
  - Gapドロップのテストケースを強化してリグレッションを防止

### ドラッグ中のタブサイズ安定性
- **Context**: Requirement 4のドラッグ中サイズ変化問題
- **Sources Consulted**:
  - `src/sidepanel/components/TabTreeView.tsx`
  - `src/sidepanel/providers/DragDropProvider.tsx`
- **Findings**:
  - TabTreeViewで`shouldApplyTransform`フラグによりドラッグ中のアイテムのみtransformを適用
  - `globalIsDragging`で他のノードのtransformを無効化
  - 横スクロール防止として`overflow-x-hidden`クラスを適用
- **Implications**:
  - ドラッグ中のCSSスタイルを見直し、サイズ変化を引き起こす要因を特定
  - 親子関係形成時のホバー状態によるスタイル変化を抑制

### ドラッグ時スクロール制限
- **Context**: Requirement 5のスクロール範囲制限
- **Sources Consulted**:
  - `src/sidepanel/components/TabTreeView.tsx`
  - @dnd-kit公式ドキュメント
- **Findings**:
  - @dnd-kitのmodifiers.restrictToVerticalAxis(y: 0.15)を使用
  - コンテンツがビューポートより小さい場合のスクロール抑制は明示的に実装されていない
- **Implications**:
  - スクロール可能量の計算ロジックを追加
  - ビューポートサイズとコンテンツサイズの比較に基づくスクロール制限

### タブグループ化機能
- **Context**: Requirement 6のコンテキストメニューからのグループ化
- **Sources Consulted**:
  - `src/sidepanel/components/ContextMenu.tsx`
  - `src/sidepanel/hooks/useMenuActions.ts`
  - `src/types/index.ts`
- **Findings**:
  - ContextMenuに「グループ化」アクション（`'group'`）が既に存在
  - 複数選択時は「選択されたタブをグループ化」ボタンを表示
  - 単一選択時は「グループに追加」サブメニューを表示
  - 新規グループノード生成ロジックはuseMenuActions.tsのhandleGroupで実装
- **Implications**:
  - 新規グループ作成（親タブ生成）のロジックを確認・修正
  - グループ化後のツリー状態整合性を保証

### クロスウィンドウタブドラッグ
- **Context**: Requirement 7のウィンドウ間ドラッグ機能
- **Sources Consulted**:
  - `src/sidepanel/components/CrossWindowDragHandler.tsx`
  - `src/sidepanel/hooks/useCrossWindowDrag.ts`
  - `src/background/event-handlers.ts`
- **Findings**:
  - CrossWindowDragHandler.tsxとuseCrossWindowDrag.tsで実装済み
  - Service Workerとのメッセージングでドラッグ状態を管理
  - メッセージタイプ: SET_DRAG_STATE, GET_DRAG_STATE, MOVE_TAB_TO_WINDOW等
  - 別ウィンドウへのドロップインジケーター表示が課題
- **Implications**:
  - 受信側ウィンドウでのドロップインジケーター表示ロジックを追加
  - ウィンドウ間のドラッグ状態同期を強化

### 新規タブ追加ボタン
- **Context**: Requirement 8のタブツリー末尾の追加ボタン
- **Sources Consulted**:
  - `src/sidepanel/components/TabTreeView.tsx`
  - `src/sidepanel/components/ViewSwitcher.tsx`
- **Findings**:
  - ViewSwitcherに「新しいビュー追加」ボタンは存在するが、「新規タブ追加」ボタンはない
  - タブツリー本体には新規タブボタンが未実装
  - ブラウザ側のタブ作成（chrome.tabs.create）との連携は可能
- **Implications**:
  - TabTreeViewまたはSidePanelRootにフルワイドの新規タブ追加ボタンを追加
  - クリック時にchrome.tabs.create()を呼び出し、現在のビューに追加

### 新規タブのタイトル正確性
- **Context**: Requirement 9のスタートページタイトル表示
- **Sources Consulted**:
  - `src/sidepanel/components/TreeNode.tsx`
- **Findings**:
  - TreeNode.tsxにisStartPageUrl()ヘルパー関数が既に実装
  - スタートページURL判定パターン: `chrome://vivaldi-webui/startpage`, `vivaldi://startpage`
  - getDisplayTitle()で「スタートページ」を返す実装あり
- **Implications**:
  - 既存実装が正しく動作しているか検証
  - URL判定パターンの追加が必要な場合は拡張

### ビューへの新規タブ追加
- **Context**: Requirement 10の現在ビューへのタブ追加
- **Sources Consulted**:
  - `src/sidepanel/providers/TreeStateProvider.tsx`
  - `src/background/event-handlers.ts`
- **Findings**:
  - 新規タブ作成時のビュー割り当てロジックがService Workerに存在
  - TreeStateProviderのcurrentViewIdと連携して新規タブをビューに追加
  - ビュー切り替え時に新規タブがデフォルトビューに追加される問題の可能性
- **Implications**:
  - Service Workerでタブ作成時にcurrentViewIdを取得・適用するフローを確認
  - Side Panelとの状態同期を強化

### 未読インジケーター位置
- **Context**: Requirement 11の右端固定表示
- **Sources Consulted**:
  - `src/sidepanel/components/UnreadBadge.tsx`
  - `src/sidepanel/components/TreeNode.tsx`
- **Findings**:
  - UnreadBadgeは現在タイトルの直後（`ml-2`）に配置
  - タブの右端ではなく、タイトルの右隣に表示される実装
  - TreeNodeのレイアウトは`flex-1 flex items-center justify-between`
- **Implications**:
  - UnreadBadgeをTreeNodeのタイトルエリア外、右端固定位置に移動
  - CSSレイアウトの調整（absolute positioning または flexbox末尾配置）

### ピン留めタブの並び替え同期
- **Context**: Requirement 12のピン留めタブ順序同期
- **Sources Consulted**:
  - `src/sidepanel/components/PinnedTabsSection.tsx`
  - `src/sidepanel/providers/TreeStateProvider.tsx` (handlePinnedTabReorder)
  - `src/background/event-handlers.ts`
- **Findings**:
  - handlePinnedTabReorderでピン留めタブの並び替えを処理
  - ブラウザAPIのchrome.tabs.moveでタブ位置を変更
  - chrome.tabs.onMovedイベントで順序変更を検知し、ツリーに反映
- **Implications**:
  - ピン留めタブ移動時のイベントハンドリングを強化
  - ツリービューとブラウザタブバーの順序同期を保証

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 既存アーキテクチャの拡張 | 現在のReact + @dnd-kit構成を維持しつつ、バグ修正と機能追加 | 既存パターンとの整合性、学習コスト最小 | 大規模な変更には不向き | **採用**: 本修正の範囲に最適 |

## Design Decisions

### Decision: E2Eテスト安定化アプローチ
- **Context**: フレーキーテスト3件の修正が必要
- **Alternatives Considered**:
  1. タイムアウト値の増加 — 対症療法、根本解決にならない
  2. ポーリング条件の精緻化 — 状態確定を正確に待機
- **Selected Approach**: ポーリング条件の精緻化
- **Rationale**: steering/tech.mdの方針に従い、固定時間待機を避け、ポーリングで状態確定を待機
- **Trade-offs**: 実装コストは高いが、長期的な安定性を確保
- **Follow-up**: `--repeat-each=10`で10回連続成功を検証

### Decision: 未読インジケーター配置
- **Context**: タイトル長に関わらず右端固定表示が必要
- **Alternatives Considered**:
  1. absolute positioning — タブの右端に固定
  2. flexbox末尾配置 — justify-between活用
- **Selected Approach**: flexbox末尾配置（既存レイアウト活用）
- **Rationale**: TreeNodeの既存`justify-between`構造を活用し、CloseButtonと同じ領域に配置
- **Trade-offs**: CloseButtonとの共存レイアウト調整が必要
- **Follow-up**: ホバー時のCloseButton表示との両立を検証

### Decision: 新規タブ追加ボタン実装
- **Context**: タブツリー末尾にフルワイドボタンを追加
- **Alternatives Considered**:
  1. TabTreeView内に追加 — タブリストの一部として
  2. SidePanelRoot内に追加 — タブリストの外部として
- **Selected Approach**: TabTreeView内にスクロール領域の末尾として追加
- **Rationale**: ユーザーがタブリストをスクロールした際にも到達可能、UIの一貫性
- **Trade-offs**: スクロール位置管理が複雑化
- **Follow-up**: フルワイドスタイルとホバー効果を検証

## Risks & Mitigations
- **Risk 1: E2Eテストの過度な複雑化** — ポーリング条件を簡潔に保ち、既存ユーティリティを活用
- **Risk 2: ドラッグ&ドロップのパフォーマンス低下** — 不要な再レンダリングを避け、memoizationを活用
- **Risk 3: クロスウィンドウ同期の不整合** — Service Workerとの通信エラーハンドリングを強化

## References
- [@dnd-kit公式ドキュメント](https://docs.dndkit.com/) — ドラッグ&ドロップライブラリの使用法
- [Playwright公式ドキュメント](https://playwright.dev/) — E2Eテストフレームワーク
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/) — タブ操作、ストレージAPI
