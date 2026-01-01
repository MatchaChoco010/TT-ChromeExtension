# Research & Design Decisions

## Summary
- **Feature**: `tree-stability-v2`
- **Discovery Scope**: Extension（既存システムのバグ修正）
- **Key Findings**:
  - 状態同期の一貫性問題：Service Worker と Side Panel 間の状態同期タイミングによる競合状態
  - 永続化と復元のギャップ：chrome.storage.local への保存/読み込み処理のタイミング問題
  - ドラッグ＆ドロップ状態管理：DragSessionManager のステートマシンと実際のマウスイベントの不整合

## Research Log

### E2Eテストフレーキー問題
- **Context**: Requirement 1（E2Eテスト安定化）の根本原因調査
- **Sources Consulted**:
  - `/e2e/utils/polling-utils.ts` - ポーリングユーティリティ
  - `/docs/steering/tech.md` - テスト品質基準
- **Findings**:
  - 固定時間待機（`waitForTimeout`）がフレーキーの主原因
  - 状態変化をDOM属性やクラスで検出する必要がある
  - Chrome Background Throttlingによりドラッグ操作が1秒間隔にスロットリングされる
- **Implications**:
  - すべてのE2Eテストでポーリング待機パターンを使用
  - テスト前に `bringToFront()` と `window.focus()` を実行してスロットリング回避

### サブツリードラッグ移動問題
- **Context**: Requirement 2（サブツリーのドラッグ移動）のバグ調査
- **Sources Consulted**:
  - `/src/sidepanel/hooks/useDragDrop.ts` - ドラッグ＆ドロップフック
  - `/src/sidepanel/components/GapDropDetection.ts` - ドロップ位置計算
- **Findings**:
  - プレースホルダー位置計算時に子タブを持つ親タブの高さを考慮していない
  - 折りたたまれた親タブのドラッグ時、非表示の子タブを含めた移動処理が不完全
  - ドラッグ中のサブツリー全体のバウンディングボックス計算が必要
- **Implications**:
  - GapDropDetection.ts のドロップ位置計算を修正
  - サブツリー全体の高さを考慮したプレースホルダー表示

### 新規タブ作成時の親子関係維持問題
- **Context**: Requirement 3, 8（親子関係維持）のバグ調査
- **Sources Consulted**:
  - `/src/background/event-handlers.ts` - タブイベントハンドラ
  - `/src/services/TreeStateManager.ts` - ツリー状態管理
- **Findings**:
  - `handleTabCreated` で新規タブ追加時に既存ノードの参照が更新されていない可能性
  - TreeStateManager の `addTab` メソッドで children 配列の不変性が保たれていない
  - 親ノードの children 配列への追加時に既存の参照が破壊される可能性
- **Implications**:
  - TreeStateManager の状態更新でイミュータブルなパターンを徹底
  - 既存ノードへの副作用を防止

### グループ化機能問題
- **Context**: Requirement 4（タブのグループ化）のバグ調査
- **Sources Consulted**:
  - `/src/services/GroupManager.ts` - グループ管理
  - `/src/sidepanel/hooks/useMenuActions.ts` - メニューアクション
- **Findings**:
  - グループタブ作成のための `chrome.tabs.create()` が正しく呼び出されていない
  - グループページ（`group.html`）のURLパス生成に問題がある可能性
  - 選択タブの収集と親子関係設定のタイミング問題
- **Implications**:
  - GroupManager.createGroup の実装を詳細にデバッグ
  - chrome.runtime.getURL() を使用した正しいURL生成

### クロスウィンドウドラッグ問題
- **Context**: Requirement 5（クロスウィンドウドラッグ）のバグ調査
- **Sources Consulted**:
  - `/src/background/drag-session-manager.ts` - ドラッグセッション管理
  - `/src/sidepanel/hooks/useCrossWindowDrag.ts` - クロスウィンドウフック
- **Findings**:
  - DragSessionManager のステートマシン遷移で `dragging_cross_window` への遷移条件が厳しすぎる
  - `NOTIFY_TREE_VIEW_HOVER` メッセージの送信タイミングが不適切
  - ツリービュー上のホバー検出がウィンドウ境界を正しく認識していない
- **Implications**:
  - ドラッグセッションのステートマシン遷移ロジックを見直し
  - ホバー検出の精度向上

### 空ウィンドウ自動クローズ問題
- **Context**: Requirement 6（空ウィンドウの自動クローズ）のバグ調査
- **Sources Consulted**:
  - `/src/background/event-handlers.ts` - tryCloseEmptyWindow関数
- **Findings**:
  - `tryCloseEmptyWindow` の呼び出しタイミングがドラッグ完了後になっていない
  - ピン留めタブの存在チェックが不完全
  - 通常タブカウントのロジックに問題
- **Implications**:
  - ドラッグ終了時のウィンドウ状態チェックを追加
  - ピン留め/通常タブの分類ロジックを修正

### ビュー管理問題
- **Context**: Requirement 7（ビューへの新規タブ追加）のバグ調査
- **Sources Consulted**:
  - `/src/services/ViewManager.ts` - ビュー管理
  - `/src/background/event-handlers.ts` - タブ作成ハンドラ
- **Findings**:
  - 新規タブ作成時に現在のビューIDを正しく取得できていない
  - ビュー切り替え時の状態永続化タイミング問題
  - Side Panel間でビュー状態が同期されていない
- **Implications**:
  - currentViewId の取得と使用を一貫させる
  - ビュー状態の永続化タイミングを修正

### ファビコン永続化問題
- **Context**: Requirement 9（ファビコンの永続化復元）のバグ調査
- **Sources Consulted**:
  - `/src/services/TitlePersistenceService.ts` - タイトル永続化（ファビコンも含む可能性）
  - chrome.storage.local の `tab_favicons` キー
- **Findings**:
  - ファビコンの永続化自体は実装されているが、復元タイミングが遅い
  - ブラウザ起動時の初期ロードでファビコンデータを先に読み込んでいない
  - TabInfo の favIconUrl フィールドへの復元処理が不足
- **Implications**:
  - 起動時にファビコンデータを優先的に読み込み
  - TabTreeView でのファビコン表示ロジックを修正

### ツリー状態永続化問題
- **Context**: Requirement 10（ツリー状態の永続化）のバグ調査
- **Sources Consulted**:
  - `/src/services/TreeStateManager.ts` - persistState, loadState
  - `/src/storage/StorageService.ts` - ストレージ操作
- **Findings**:
  - ブラウザ終了時のpersistState呼び出しが確実に完了していない
  - chrome.runtime.onSuspend での保存処理が不十分
  - 復元時のタブID不一致処理（ブラウザ再起動でタブIDが変わる）
- **Implications**:
  - ブラウザ終了イベントでの確実な保存処理
  - タブID変更に対応した復元ロジック（URL/タイトルベースのマッチング）

### タブ複製時の配置問題
- **Context**: Requirement 11（タブ複製時の配置）のバグ調査
- **Sources Consulted**:
  - `/src/background/event-handlers.ts` - pendingDuplicateSources
- **Findings**:
  - 複製タブの検出（`pendingDuplicateSources`）が正しく機能していない
  - 複製タブを兄弟として配置するロジックが子タブ配置ロジックと競合
- **Implications**:
  - 複製タブの検出タイミングと配置ロジックを修正
  - `REGISTER_DUPLICATE_SOURCE` メッセージの送信タイミングを調整

### リンクタブ配置設定問題
- **Context**: Requirement 12（リンクから開いたタブの配置設定）のバグ調査
- **Sources Consulted**:
  - `/src/types/index.ts` - UserSettings型
  - `/src/background/event-handlers.ts` - タブ配置ロジック
- **Findings**:
  - 設定値の読み込みと適用にタイミングの問題がある
  - 「リストの最後」設定時に親タブ設定が優先されてしまう
- **Implications**:
  - 設定値に基づく条件分岐を正しく実装
  - 親タブ設定と配置設定の優先度を明確化

### 未読インジケーター復元時問題
- **Context**: Requirement 13（未読インジケーターの復元時制御）のバグ調査
- **Sources Consulted**:
  - `/src/services/UnreadTracker.ts` - 未読状態追跡
- **Findings**:
  - `initialLoadComplete` フラグの設定タイミングが遅い
  - ブラウザ復元時のタブに対して `markAsUnread` が呼ばれてしまう
- **Implications**:
  - 起動完了判定を早期に行う
  - 復元タブに対する未読マーク防止

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 既存アーキテクチャ維持 | 現在のService Worker + Side Panel構成を維持 | 既存コードの活用、リスク最小化 | 根本的な設計問題がある場合は解決困難 | 採用 - バグ修正に最適 |
| 状態管理リファクタリング | TreeStateManagerの全面書き換え | 根本解決の可能性 | 大規模変更、新規バグリスク | 不採用 - スコープ超過 |
| メッセージング改善 | Service Worker - Side Panel間通信の最適化 | 同期問題の解決 | 部分的な改善 | 部分採用 - 必要箇所のみ |

## Design Decisions

### Decision: 既存アーキテクチャ内でのバグ修正アプローチ
- **Context**: 13項目のバグ修正を効率的に実装する必要がある
- **Alternatives Considered**:
  1. 全面リファクタリング - アーキテクチャ刷新
  2. 部分的リファクタリング - 問題箇所のみ修正
  3. ピンポイント修正 - 最小限の変更で修正
- **Selected Approach**: 部分的リファクタリング（オプション2）
- **Rationale**:
  - 根本原因の修正が必要だが、全面書き換えはリスクが高い
  - 既存のテストインフラを活用できる
  - 段階的な修正と検証が可能
- **Trade-offs**:
  - 一部の設計上の問題は残る可能性
  - 修正範囲の見極めが重要
- **Follow-up**: 各修正後にE2Eテストで安定性を確認

### Decision: E2Eテスト安定化を最優先
- **Context**: フレーキーなテストがCI/CDの信頼性を低下させている
- **Alternatives Considered**:
  1. テスト修正後に機能修正
  2. 機能修正後にテスト修正
  3. 並行して修正
- **Selected Approach**: テスト修正後に機能修正（オプション1）
- **Rationale**:
  - 安定したテストがなければ修正の検証ができない
  - ポーリングユーティリティの充実が他の修正にも活用可能
- **Trade-offs**: 機能修正が遅れる可能性
- **Follow-up**: Requirement 1を最初に実装

### Decision: ツリー状態永続化でURLベースマッチングを採用
- **Context**: ブラウザ再起動後にタブIDが変わるため、親子関係の復元が困難
- **Alternatives Considered**:
  1. URLベースマッチング - URLでタブを特定
  2. インデックスベースマッチング - タブの順序で特定
  3. セッションIDベースマッチング - ブラウザセッションIDを使用
- **Selected Approach**: URLベースマッチング（オプション1）
- **Rationale**:
  - URLは再起動後も変わらない
  - Chrome Session Restore APIでURL情報が取得可能
  - インデックスは並び替えで変わる可能性
- **Trade-offs**: 同一URLの複数タブがある場合の識別が困難
- **Follow-up**: 重複URL時のフォールバック戦略を実装

## Risks & Mitigations
- **Risk 1**: 修正による新規バグの導入 — E2Eテストの`--repeat-each=10`で安定性を検証
- **Risk 2**: Chrome API の仕様変更による非互換 — Manifest V3準拠を維持
- **Risk 3**: 状態同期のレースコンディション — 適切な待機処理とロック機構の導入

## References
- [Chrome Extensions Manifest V3](https://developer.chrome.com/docs/extensions/mv3/) — Manifest V3 API仕様
- [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/tabs/) — タブ操作API
- [Playwright Testing](https://playwright.dev/) — E2Eテストフレームワーク
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/) — 永続化API
