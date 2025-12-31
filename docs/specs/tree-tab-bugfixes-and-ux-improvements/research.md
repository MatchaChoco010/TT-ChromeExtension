# Research & Design Decisions

## Summary
- **Feature**: tree-tab-bugfixes-and-ux-improvements
- **Discovery Scope**: Extension（既存システムの拡張・バグ修正）
- **Key Findings**:
  - E2Eテストの既存ユーティリティ（`polling-utils.ts`）を活用して安定性を確保可能
  - ドラッグ操作関連はTreeStateProviderの`handleSiblingDrop`で処理されており、ブラウザタブとの同期ロジックが存在
  - グループ化機能は`CREATE_GROUP`メッセージハンドラとして実装済み、`createGroupWithRealTab`でグループタブを実際に作成
  - クロスウィンドウドラッグは`dragSessionManager`で管理されている

## Research Log

### E2Eテストのフレーキー問題
- **Context**: tab-grouping.spec.ts:853とtab-persistence.spec.ts:201が不安定
- **Sources Consulted**: `e2e/utils/polling-utils.ts`, `e2e/tab-grouping.spec.ts`, `e2e/tab-persistence.spec.ts`
- **Findings**:
  - `waitForCondition`などのポーリングユーティリティが既に存在
  - グループ化テストは15秒のタイムアウトを設定しているが、実際のグループタブ作成の完了を適切に待機していない可能性
  - タイトル永続化テストは`example.com`から`example.org`へのナビゲーション時にタイトル変更を検出している
- **Implications**: ポーリングベースの待機を確実に使用し、固定時間待機を排除する必要がある

### タブの並び替え
- **Context**: ドラッグ&ドロップでタブを並び替えてもツリービューが更新されない
- **Sources Consulted**: `src/sidepanel/providers/TreeStateProvider.tsx`, `src/background/event-handlers.ts`
- **Findings**:
  - `handleSiblingDrop`（TreeStateProvider:814行目）でドロップ処理を実施
  - `chrome.tabs.move()`でブラウザタブを移動（TreeStateProvider:943行目）
  - `chrome.tabs.onMoved`イベントハンドラが存在（TreeStateProvider:537-568行目, event-handlers.ts:276-292行目）
  - event-handlers.tsの`handleTabMoved`は`STATE_UPDATED`メッセージを送信するのみで、ツリー状態の更新は行っていない
- **Implications**: ツリー状態がブラウザのタブ順序変更に追従していない可能性がある

### タブグループ化
- **Context**: コンテキストメニューからのグループ化が動作していない
- **Sources Consulted**: `src/sidepanel/hooks/useMenuActions.ts`, `src/background/event-handlers.ts`, `src/services/TreeStateManager.ts`
- **Findings**:
  - `useMenuActions.ts:93-99`で`CREATE_GROUP`メッセージを送信
  - `handleCreateGroup`（event-handlers.ts:849-914）でグループ作成を処理
  - `createGroupWithRealTab`（TreeStateManager.ts:656-735）で実タブを使用したグループ作成
  - グループページURL: `chrome-extension://${chrome.runtime.id}/group.html`
- **Implications**: メッセージハンドリングまたはグループタブ作成フローに問題がある可能性

### クロスウィンドウドラッグ
- **Context**: 別ウィンドウからタブをドラッグしてきてもドラッグアウトと判定される
- **Sources Consulted**: `src/background/drag-session-manager.ts`, `src/sidepanel/hooks/useCrossWindowDrag.ts`
- **Findings**:
  - `dragSessionManager`がドラッグセッションを管理
  - `START_DRAG_SESSION`, `GET_DRAG_SESSION`, `BEGIN_CROSS_WINDOW_MOVE`メッセージが定義済み
  - TreeStateProviderに`handleCrossWindowDrop`が実装されている
- **Implications**: ドラッグ中に別ウィンドウへのホバーを検出するロジックに問題がある可能性

### 空ウィンドウの自動クローズ
- **Context**: ドラッグアウトで全タブを移動させたウィンドウが閉じない
- **Sources Consulted**: `src/background/event-handlers.ts`
- **Findings**:
  - `handleCreateWindowWithSubtree`（event-handlers.ts:661-735）に空ウィンドウクローズロジックが存在
  - `sourceWindowId`が指定されている場合、残りタブを確認して自動クローズ
- **Implications**: sourceWindowIdの受け渡しまたはクローズ条件判定に問題がある可能性

### ビューへの新規タブ追加
- **Context**: ビューを開いた状態で新しいタブを開くとビューが閉じてしまう
- **Sources Consulted**: `src/background/event-handlers.ts`, `src/sidepanel/providers/TreeStateProvider.tsx`
- **Findings**:
  - `handleTabCreated`（event-handlers.ts:134-226）で`getCurrentViewId()`を使用して現在のビューにタブを追加
  - `getCurrentViewId()`（event-handlers.ts:40-50）はストレージから`currentViewId`を取得
- **Implications**: ビュー状態が新規タブ作成時に適切に維持されていない可能性

### 設定タブの名前表示
- **Context**: 設定ページのタブが「新しいタブ」になっている
- **Sources Consulted**: `src/settings/SettingsPage.tsx`
- **Findings**:
  - HTMLファイルが存在しない（index.htmlは存在せず）
  - ReactのSettingsPageコンポーネントは存在するが、HTMLのtitleが設定されていない
- **Implications**: settings.htmlのHTMLファイルに`<title>設定</title>`を追加する必要がある

### 未読インジケーターのUI
- **Context**: 未読インジケーターの形と位置を変更する
- **Sources Consulted**: `src/sidepanel/components/UnreadBadge.tsx`
- **Findings**:
  - 現在は青い丸（`rounded-full`）として右側に表示
  - 左下角の三角形切り欠きに変更が必要
- **Implications**: CSSスタイリングの変更が必要

### ファビコンの永続化復元
- **Context**: ブラウザ再起動時にファビコンが復元されない
- **Sources Consulted**: `src/sidepanel/providers/TreeStateProvider.tsx`
- **Findings**:
  - `loadTabInfoMap`（TreeStateProvider:236-280）で永続化されたファビコンを取得
  - `STORAGE_KEYS.TAB_FAVICONS`に保存されている
  - 復元ロジックは存在（TreeStateProvider:257-258）
- **Implications**: 永続化データの保存または復元タイミングに問題がある可能性

### タブ複製時の配置
- **Context**: 複製したタブが子タブになる
- **Sources Consulted**: `src/sidepanel/hooks/useMenuActions.ts`, `src/background/event-handlers.ts`
- **Findings**:
  - `REGISTER_DUPLICATE_SOURCE`メッセージで複製元を登録
  - `pendingDuplicateSources`で複製元タブを追跡
  - `handleTabCreated`で複製タブを検出し、親タブを引き継ぐロジックが存在（event-handlers.ts:176-193）
- **Implications**: 複製タブの検出または配置ロジックに問題がある可能性

### 復元タブの未読状態
- **Context**: ブラウザ再起動後のタブに未読インジケーターが付く
- **Sources Consulted**: `src/background/event-handlers.ts`, `src/services/UnreadTracker.ts`
- **Findings**:
  - `handleTabCreated`（event-handlers.ts:213-217）で`tab.active`でない場合に未読としてマーク
  - セッション復元時もonCreatedイベントが発火し、未読としてマークされる可能性
- **Implications**: セッション復元時のタブを識別し、未読マークを付けないロジックが必要

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 既存パターン踏襲 | Service Worker + Side Panel React UIの既存アーキテクチャを維持 | 変更箇所が最小限、リグレッションリスクが低い | 根本的な設計問題は解決されない | 推奨：バグ修正に最適 |
| E2Eポーリングパターン | polling-utils.tsの既存ユーティリティを活用 | 安定したテスト実行、フレーキー排除 | テスト実行時間が若干増加 | 既存パターンに沿う |

## Design Decisions

### Decision: E2Eテスト安定化戦略
- **Context**: フレーキーなテストの修正と新規テストの安定性確保
- **Alternatives Considered**:
  1. 固定タイムアウト延長 — 簡単だが根本解決にならない
  2. ポーリングベース待機 — 状態変化を正確に検出
- **Selected Approach**: ポーリングベース待機を使用し、固定時間待機を完全に排除
- **Rationale**: 状態ベースの待機は実行環境の速度差に強く、安定性が高い
- **Trade-offs**: コードが若干複雑になるが、テストの信頼性が大幅に向上
- **Follow-up**: `--repeat-each=10`で10回連続成功を検証

### Decision: 未読インジケーターの位置変更
- **Context**: 右側の青丸から左下角の三角形切り欠きに変更
- **Alternatives Considered**:
  1. CSS border-cornerを使用 — 疑似要素で実装
  2. SVGアイコン — より柔軟だが複雑
- **Selected Approach**: CSS疑似要素（`::before`）で三角形を実装
- **Rationale**: 軽量で既存のスタイリングパターンに沿う
- **Trade-offs**: カスタマイズ性は低いが、要件を満たすには十分
- **Follow-up**: 実装後にE2Eテストで視覚的検証

### Decision: セッション復元タブの未読除外
- **Context**: ブラウザ再起動後に復元されたタブに未読マークを付けない
- **Alternatives Considered**:
  1. openerTabIdで判定 — 復元タブは通常openerがない
  2. 起動後一定時間内のタブを除外 — タイムベースだが不正確
  3. セッション復元フラグをストレージで管理 — 正確だが複雑
- **Selected Approach**: Service Worker起動直後のフラグと、ストレージからの既知タブIDリストを組み合わせて判定
- **Rationale**: 正確性と実装の簡潔さのバランスが良い
- **Trade-offs**: 初回起動時に若干のオーバーヘッド
- **Follow-up**: E2Eテストでセッション復元シナリオを検証

## Risks & Mitigations
- **リスク1: 既存テストへの影響** — ミティゲーション: 全E2Eテストを実行して影響を確認
- **リスク2: ドラッグ&ドロップの複雑さ** — ミティゲーション: 既存の自前D&D実装を活用し、変更を最小限に
- **リスク3: クロスウィンドウ操作の不安定さ** — ミティゲーション: ポーリングベース待機とタイムアウト設定の最適化

## References
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/reference/) — chrome.tabs, chrome.windows API仕様
- [Playwright Test](https://playwright.dev/docs/test-intro) — E2Eテストのベストプラクティス
- 既存E2Eユーティリティ: `e2e/utils/polling-utils.ts`
