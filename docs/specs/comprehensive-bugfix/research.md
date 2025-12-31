# Research & Design Decisions: comprehensive-bugfix

## Summary
- **Feature**: comprehensive-bugfix（包括的バグ修正）
- **Discovery Scope**: Extension（既存システムの修正・拡張）
- **Key Findings**:
  1. 既存のE2Eテストインフラ（polling-utils.ts）が充実しており、新規テストは同パターンで追加可能
  2. ほとんどのバグ修正は既存コードの小規模な修正で対応可能
  3. クロスウィンドウドラッグ（要件4）のみ複雑性が高く、詳細調査が必要

---

## Research Log

### E2Eテスト安定性（要件1）
- **Context**: `tab-persistence.spec.ts:201:5`のテストが不安定と報告
- **Sources Consulted**: `e2e/tab-persistence.spec.ts`、`e2e/utils/polling-utils.ts`
- **Findings**:
  - 該当テストはタイトル永続化更新テスト（Requirement 1.3）
  - `waitForCondition`でポーリング待機を使用しており、パターンは正しい
  - timeout設定（10000ms）は十分
  - 問題はネットワーク遅延やタイトル更新タイミングの可能性
- **Implications**: 条件関数の厳密化とリトライロジックの調整が必要

### サブツリードラッグ移動（要件2）
- **Context**: 子タブを持つ親タブを下方向にドラッグすると移動数が不正確
- **Sources Consulted**: `src/sidepanel/hooks/useDragDrop.ts`、`GapDropDetection.ts`
- **Findings**:
  - `useDragDrop`はドロップ位置計算を`calculateDropTarget`に委譲
  - サブツリーの移動はタブ単位のchrome.tabs.moveで処理
  - 移動数計算時にサブツリーサイズを考慮していない可能性
- **Implications**: moveNode時にサブツリー全体のサイズを計算し、移動インデックスを調整

### グループ化機能（要件3）
- **Context**: 選択タブをグループ化する際のロジックバグ
- **Sources Consulted**: `src/services/GroupManager.ts`、`src/background/event-handlers.ts`
- **Findings**:
  - `GroupManager.createGroup`はグループメタデータのみ管理
  - 実際のタブ親子関係はTreeStateManagerが管理
  - グループタブ（親タブ）の作成とchrome.tabs.createの連携が必要
- **Implications**: グループ化フローの見直し：親タブ作成→子タブ移動→UI更新

### クロスウィンドウドラッグ（要件4）
- **Context**: 別ウィンドウからのドラッグ受け入れ
- **Sources Consulted**: `src/background/drag-session-manager.ts`、`src/sidepanel/hooks/useCrossWindowDrag.ts`
- **Findings**:
  - `DragSessionManager`は状態マシンでセッション管理
  - `beginCrossWindowMove`でchrome.tabs.moveを実行
  - ウィンドウ間通信はService Workerを経由
  - ドラッグ中のウィンドウ判定は`currentWindowId`で追跡
- **Implications**: ウィンドウ進入時のセッション更新とドロップ受け入れロジックの追加が必要

### 空ウィンドウ自動クローズ（要件5）
- **Context**: タブ全移動後のウィンドウ自動クローズ
- **Sources Consulted**: `src/background/event-handlers.ts`
- **Findings**:
  - `handleTabRemoved`でタブ削除を処理
  - ウィンドウ内タブ数チェックは実装されていない
- **Implications**: タブ削除時にウィンドウ内残タブ数をチェックし、0なら`chrome.windows.remove`を呼び出す

### タイトル表示（要件7, 8）
- **Context**: 設定タブと内部ページのタイトル表示
- **Sources Consulted**: `src/sidepanel/components/TreeNode.tsx`
- **Findings**:
  - `SYSTEM_URL_FRIENDLY_NAMES`マッピングが存在
  - 拡張機能URL（chrome-extension://）パターンは未対応
  - `vivaldi://calendar`等のパターンも追加が必要
- **Implications**: マッピングへのパターン追加のみで対応可能

### 未読インジケーター位置（要件9）
- **Context**: depthに応じたインジケーター位置
- **Sources Consulted**: `src/sidepanel/components/UnreadBadge.tsx`
- **Findings**:
  - 現在は`left: 0`固定
  - `depth`プロパティはUnreadBadgeに渡されていない
- **Implications**: TreeNode→UnreadBadgeにdepthを伝播し、left値を動的計算

### ビューのタブ数表示（要件17）
- **Context**: タブ数バッジの視認性
- **Sources Consulted**: `src/sidepanel/components/ViewSwitcher.tsx:228-235`
- **Findings**:
  - バッジは`absolute -top-1 -right-1`で配置
  - min-width=16pxは2桁まで対応
  - 3桁以上で見切れる可能性
- **Implications**: min-width調整とposition微調整で対応

---

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 既存パターン拡張 | 現在のアーキテクチャを維持し、各バグを個別に修正 | 変更最小、リスク低 | 一貫性確保が課題 | 推奨 |
| リファクタリング先行 | 共通パターンを抽出してから修正 | 長期的な保守性向上 | 工数増大 | 今回は不採用 |

**選択**: 既存パターン拡張アプローチを採用。17項目のバグ修正は独立性が高く、既存アーキテクチャ内で個別対応可能。

---

## Design Decisions

### Decision: E2Eテストの待機戦略
- **Context**: フレーキーテスト回避のための待機方法
- **Alternatives Considered**:
  1. 固定時間待機（waitForTimeout）— 禁止
  2. ポーリング待機（waitForCondition）— 既存パターン
  3. イベント駆動待機（waitForEvent）— 一部で有効
- **Selected Approach**: ポーリング待機を標準とし、条件関数を厳密に定義
- **Rationale**: 既存のpolling-utils.tsが充実しており、パターンが確立されている
- **Trade-offs**: ポーリング間隔によるオーバーヘッドあり、ただし信頼性を優先
- **Follow-up**: 新規テストは`--repeat-each=10`で安定性を検証

### Decision: サブツリー移動のインデックス計算
- **Context**: 折りたたみ/展開状態でのサブツリー移動
- **Alternatives Considered**:
  1. 可視ノードのみでインデックス計算
  2. 全ノード（非表示含む）でインデックス計算
- **Selected Approach**: 全ノードでインデックス計算
- **Rationale**: 折りたたみ状態でも正確な移動を保証
- **Trade-offs**: 計算コスト増加、ただし正確性を優先

### Decision: 未読インジケーターのdepth反映
- **Context**: インジケーターをタブ階層に合わせて配置
- **Alternatives Considered**:
  1. CSSのcalc()でleftを動的計算
  2. inline styleでleft値を直接設定
- **Selected Approach**: inline styleでleft値を直接設定
- **Rationale**: 既存のUnreadBadgeスタイルパターンと一貫性を維持
- **Trade-offs**: スタイルの一元管理が難しくなる、ただし実装がシンプル

---

## Risks & Mitigations

1. **E2Eテストの不安定化リスク** — 新規テストは`--repeat-each=10`で検証、既存テストへの影響を監視
2. **サブツリー移動の回帰リスク** — 既存のdrag-drop-hierarchy.spec.tsを拡充
3. **クロスウィンドウドラッグの複雑性** — 状態マシンのログ強化とタイムアウト処理の見直し
4. **UI変更の視覚的回帰** — スクリーンショット比較テストの追加を検討

---

## References

- [Playwright Testing Library](https://playwright.dev/) — E2Eテストフレームワーク
- [Chrome Extensions API: tabs.move](https://developer.chrome.com/docs/extensions/reference/tabs/#method-move) — タブ移動API
- [Chrome Extensions API: windows.remove](https://developer.chrome.com/docs/extensions/reference/windows/#method-remove) — ウィンドウ削除API
- 既存テストパターン: `e2e/utils/polling-utils.ts` — ポーリング待機ユーティリティ
