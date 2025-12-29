# Research & Design Decisions

## Summary
- **Feature**: tree-tab-ux-improvements
- **Discovery Scope**: Extension（既存システムの拡張）
- **Key Findings**:
  - 既存アーキテクチャはChrome Extension Manifest V3を採用し、Service Worker + Side Panel構成で責務を明確に分離
  - ピン留めタブ、ビュー機能、ドラッグ&ドロップなど多数の機能が既に実装されており、21の要件の多くは既存パターンを拡張する形で対応可能
  - E2Eテスト基盤（Playwright）とポーリングユーティリティが整備されており、新機能のテストは既存パターンに従って実装

## Research Log

### 既存アーキテクチャパターン
- **Context**: 21の要件を既存システムにどう統合するか判断するため
- **Sources Consulted**: `src/` ディレクトリ構成、`docs/steering/` ドキュメント
- **Findings**:
  - レイヤー構成: Background（Service Worker）、UI（React Side Panel）、Services（ビジネスロジック）、Storage（永続化）
  - 状態管理: `TreeStateProvider`（タブツリー）、`ThemeProvider`（設定・テーマ）
  - メッセージング: `chrome.runtime.sendMessage` による双方向通信
  - ストレージ: `chrome.storage.local`（ツリー状態）、IndexedDB（スナップショット）
- **Implications**: 新機能は既存レイヤーに統合可能。新規レイヤーは不要。

### ピン留めタブ機能の現状分析
- **Context**: Requirements 1.x（ピン留めタブ動作改善）への対応方針決定
- **Sources Consulted**: `PinnedTabsSection.tsx`, `ContextMenu.tsx`, `useMenuActions.ts`, E2Eテスト
- **Findings**:
  - 現状: ピン留めタブは専用セクション（`PinnedTabsSection`）に表示、ホバー時に閉じるボタン表示
  - 要件1.1-1.3への対応: 閉じるボタン非表示化、ツリー一覧からの除外は既に実装済み（条件変更のみ）
  - 要件1.6-1.7: コンテキストメニューに「ピン留めを解除」は既に実装済み（`unpin`アクション）
- **Implications**: ピン留め関連はUIの微調整が中心。大規模な設計変更は不要。

### ドラッグ&ドロップ機能の調査
- **Context**: Requirements 6-8, 14（ドロップ判定、スクロール制御、サイズ安定化）への対応
- **Sources Consulted**: `@dnd-kit` ドキュメント、`ExternalDropZone.tsx`, `GapDropDetection.ts`
- **Findings**:
  - ライブラリ: `@dnd-kit/core` + `dnd-kit-sortable-tree`
  - 現状のドロップ判定: タブ高さの25%を上下隙間として使用（`GapDropDetection.ts`）
  - ExternalDropZone: サイドパネル下部に専用エリアあり（要件6.1で削除対象）
  - ドラッグ中スクロール: `@dnd-kit`の`AutoScrollActivator`で制御可能
- **Implications**: 既存のGapDropDetection.tsを改良するだけで要件8達成可能。スクロール制御は@dnd-kitのAPI活用。

### ビュー機能の拡張方針
- **Context**: Requirements 15-19（ビュー関連機能拡張）への対応
- **Sources Consulted**: `ViewSwitcher.tsx`, `ViewContextMenu.tsx`, `ViewEditModal.tsx`
- **Findings**:
  - 現在の構成: ファビコンサイズのアイコンボタン、右クリックメニュー、編集モーダル
  - 要件16: ホイールスクロールでビュー切り替え → ViewSwitcherにonWheelハンドラ追加
  - 要件17: タブ数表示 → 各ビューボタンにバッジを追加
  - 要件18: 「別のビューへ移動」サブメニュー → ContextMenuにサブメニューコンポーネント追加
  - 要件19: カスタムアイコン → 既存のview.iconフィールドを活用、IconPickerコンポーネント新規作成
- **Implications**: ビュー機能はコンポーネント単位の拡張で対応。新規コンポーネントはIconPickerのみ。

### タブタイトル永続化の設計
- **Context**: Requirements 4-5（タブタイトル表示・永続化）への対応
- **Sources Consulted**: `TreeStateProvider.tsx`, `StorageService.ts`, Chrome APIs
- **Findings**:
  - 現状: `tabInfoMap`にタイトル保持（メモリのみ、永続化なし）
  - Chrome API: `tabs.onUpdated`でタイトル変更を検知可能
  - ストレージ戦略: `STORAGE_KEYS`に`TAB_TITLES`を追加、Map<number, string>形式で永続化
- **Implications**: 新規ストレージキー追加、Service Workerでタイトル変更時に永続化、起動時に復元。

### コンテキストメニュー拡張
- **Context**: Requirements 12, 18（グループ化、ビュー移動）への対応
- **Sources Consulted**: `ContextMenu.tsx`, `useMenuActions.ts`
- **Findings**:
  - 現状構造: 単一レベルのメニュー項目
  - 要件18: サブメニュー必要 → `SubMenu`コンポーネント追加、ホバーで展開
  - 要件12: グループ化は既存`group`アクションを拡張
- **Implications**: ContextMenuにサブメニュー対応を追加。useMenuActionsに`moveToView`アクション追加。

### 未読バッジ制御
- **Context**: Requirement 13（起動時の未読バッジ制御）への対応
- **Sources Consulted**: `UnreadTracker.ts`, `event-handlers.ts`
- **Findings**:
  - 現状: バックグラウンドで作成されたタブを未読マーク
  - 問題: ブラウザ起動時の既存タブも未読マークされる可能性
  - 解決策: 起動時フラグ（`isInitialLoad`）を導入、起動完了後のタブのみ未読マーク
- **Implications**: Service Workerに起動フラグ追加、handleTabCreatedで条件分岐。

### ポップアップメニューの新規実装
- **Context**: Requirements 20-21（設定ボタン移動、スナップショット取得）への対応
- **Sources Consulted**: Chrome Extension Manifest V3 documentation
- **Findings**:
  - `action.default_popup`でポップアップHTML指定
  - ポップアップ内から`chrome.runtime.openOptionsPage()`で設定ページを開く
  - スナップショット取得は既存`SnapshotManager.createSnapshot()`を呼び出し
- **Implications**: 新規ファイル: `popup/PopupMenu.tsx`, `popup/index.html`。manifest.jsonに`action.default_popup`追加。

### アイコンセット選定
- **Context**: Requirement 19（カスタムアイコン）への対応
- **Sources Consulted**: オープンソースアイコンライブラリ
- **Findings**:
  - 候補1: Lucide Icons（MIT License）- シンプルで一貫性あり
  - 候補2: Heroicons（MIT License）- Tailwind互換
  - 候補3: Material Icons（Apache 2.0）- 種類豊富
  - 推奨: Lucide Icons - 軽量、React対応済み、MIT License
- **Implications**: lucide-reactをdependenciesに追加、IconPickerで選択可能に。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 既存パターン拡張 | 現行のReact Context + Service Worker構成を維持 | 学習コスト低、一貫性維持 | 機能増加による複雑化 | 推奨 |
| 状態管理ライブラリ導入 | Zustand/Jotaiなどを採用 | より洗練された状態管理 | 既存コード全面改修必要 | 不採用 |

## Design Decisions

### Decision: 既存アーキテクチャパターンの維持
- **Context**: 21の要件は新規アーキテクチャを必要とするか
- **Alternatives Considered**:
  1. 状態管理ライブラリ（Zustand等）導入
  2. 既存React Context + Service Worker構成の維持
- **Selected Approach**: 既存パターン維持
- **Rationale**: 要件の大半は既存コンポーネントの拡張で対応可能。アーキテクチャ変更のオーバーヘッドは正当化できない。
- **Trade-offs**: TreeStateProviderの肥大化リスクあり。必要に応じてカスタムフックへの分離を検討。
- **Follow-up**: 実装後にTreeStateProviderの行数が500行を超える場合はリファクタリングを検討。

### Decision: ポップアップメニューの新規追加
- **Context**: 設定ボタンをサイドパネルからポップアップに移動（Requirement 20）
- **Alternatives Considered**:
  1. サイドパネル内にボタン残す（現状維持）
  2. ポップアップメニュー新規追加
- **Selected Approach**: ポップアップメニュー新規追加
- **Rationale**: 要件20の明示的な指定。サイドパネルのスペース節約にも寄与。
- **Trade-offs**: 新規ファイル（popup/）の追加が必要。ビルド設定の変更あり。
- **Follow-up**: manifest.jsonのaction設定を確認。

### Decision: Lucide Iconsの採用
- **Context**: カスタムアイコン用のアイコンセット選定（Requirement 19）
- **Alternatives Considered**:
  1. Lucide Icons
  2. Heroicons
  3. Material Icons
- **Selected Approach**: Lucide Icons
- **Rationale**: MIT License、軽量、React対応済み、一貫したデザイン言語。
- **Trade-offs**: アイコン数はMaterial Iconsより少ない（十分な数は確保）。
- **Follow-up**: lucide-reactをpackage.jsonに追加。

### Decision: タブタイトル永続化のストレージ戦略
- **Context**: タブタイトルの永続化方法（Requirement 5）
- **Alternatives Considered**:
  1. chrome.storage.local（既存ツリー状態と同様）
  2. IndexedDB（スナップショットと同様）
- **Selected Approach**: chrome.storage.local
- **Rationale**: タブタイトルは軽量データ（数百KB以下）。既存のStorageServiceインフラを活用可能。
- **Trade-offs**: ストレージ容量は5MBまで（十分）。
- **Follow-up**: STORAGE_KEYS.TAB_TITLESを追加。

### Decision: サブメニューコンポーネントの実装方針
- **Context**: ビュー移動のためのサブメニュー実装（Requirement 18）
- **Alternatives Considered**:
  1. 既存ContextMenuに直接実装
  2. 汎用SubMenuコンポーネントを作成
- **Selected Approach**: 汎用SubMenuコンポーネント作成
- **Rationale**: 将来的な拡張性（他のサブメニューが必要になる可能性）。コンポーネントの責務分離。
- **Trade-offs**: 新規コンポーネント作成のコスト。
- **Follow-up**: SubMenu.tsxをsidepanel/components/に追加。

## Risks & Mitigations
- **Risk 1**: TreeStateProviderの複雑化 — 必要に応じてカスタムフックへ分離
- **Risk 2**: E2Eテストのフレーキー化 — 既存ポーリングユーティリティを活用、`waitForTimeout`禁止を遵守
- **Risk 3**: アイコンセット追加によるバンドルサイズ増加 — tree-shakingで使用アイコンのみインポート
- **Risk 4**: ポップアップメニュー追加によるビルド設定変更 — vite.config.ts、manifest.jsonの慎重な更新

## References
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/) — Extension API reference
- [@dnd-kit Documentation](https://docs.dndkit.com/) — ドラッグ&ドロップライブラリ
- [Lucide Icons](https://lucide.dev/) — MIT License アイコンセット
- [Vivaldi Browser](https://vivaldi.com/blog/vivaldi-on-mobile/) — Vivaldi拡張機能対応情報
