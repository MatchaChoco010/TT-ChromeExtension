# Research & Design Decisions: tab-tree-bugfixes

## Summary
- **Feature**: tab-tree-bugfixes
- **Discovery Scope**: Extension（既存システムの修正・拡張）
- **Key Findings**:
  - Tailwind CSSの`gray`パレットが青みを帯びており、これが「ダークブルー」UIの原因
  - cleanupStaleNodesとUnreadTrackerは正しく実装されているが、動作タイミングに問題がある可能性
  - 複数ウィンドウ対応にはアーキテクチャ変更が必要（windowIdフィルタリング）

---

## Research Log

### Tailwind CSSカラーパレットの青み問題

- **Context**: UIの背景色が無彩色ではなくダークブルーに見える原因調査
- **Sources Consulted**:
  - [Tailwind CSS Colors](https://tailwindcss.com/docs/colors)
  - [Tailwind CSS Customizing Colors](https://tailwindcss.com/docs/customizing-colors)
- **Findings**:
  - Tailwindの`gray`パレットは純粋な無彩色ではなく、青みを帯びている
  - `gray-900` = `#111827` (OKLCH hue: 265.755 = 青/紫系)
  - `neutral`パレットは純粋な無彩色
  - 影響箇所: `bg-gray-*`約100箇所、`text-gray-*`129箇所、`border-gray-*`49箇所
- **Implications**:
  - `tailwind.config.js`で`gray`を`neutral`で上書きする方法が最も効率的
  - コード変更なしで全体の色味を変更可能

### アクティブタブの枠線表示

- **Context**: アクティブタブに青い枠線が表示される問題
- **Sources Consulted**: `TabTreeView.tsx:202`
- **Findings**:
  - `isSelected ? 'ring-2 ring-blue-400' : ''`でSelectionに青枠が適用
  - `isActive`は`bg-gray-600`のみ適用
  - 枠線は選択状態(isSelected)で表示される
- **Implications**:
  - `ring-2 ring-blue-400`クラスを削除し、背景色変化のみで識別

### 閉じるボタンの配置問題

- **Context**: ホバー時の閉じるボタンが右端に固定されていない
- **Sources Consulted**: `TabTreeView.tsx:255, 274`
- **Findings**:
  - `<div className="flex-1 flex items-center min-w-0">`内にタイトルと閉じるボタンが配置
  - CloseButtonはタイトルの直後に配置され、`flex-1`により右端固定にならない
  - `{isHovered && <CloseButton />}`の条件レンダリングでレイアウトシフト発生
- **Implications**:
  - レイアウトを`justify-between`に変更し、CloseButtonを常にレンダリング（visibility制御）

### ゴーストタブとUnreadTrackerの動作

- **Context**: ブラウザ起動時のゴーストタブと復元タブの未読表示問題
- **Sources Consulted**:
  - `service-worker.ts:23-39, 94-96`
  - `TreeStateManager.ts:232-257`
  - `UnreadTracker.ts`
- **Findings**:
  - `cleanupStaleNodes()`は実装済みで、onInstalledとService Worker起動時に呼び出される
  - `setInitialLoadComplete()`でブラウザ起動時の既存タブは未読マークをスキップ
  - 問題はストレージからロードされた未読状態が初期化後もクリアされていない可能性
- **Implications**:
  - ブラウザ起動時にストレージの未読状態をクリアするロジックが必要
  - 競合状態の確認が必要

### ドロップ判定ロジック

- **Context**: タブ間ドロップの当たり判定が正しく動作しない
- **Sources Consulted**: `GapDropDetection.ts`, `TabTreeView.tsx`
- **Findings**:
  - `calculateDropTarget()`でマウスY座標からドロップターゲットを計算
  - `DEFAULT_GAP_THRESHOLD_RATIO = 0.25`でタブ上下25%を隙間判定
  - DropIndicatorの位置計算に問題がある可能性
- **Implications**:
  - タブ位置情報(`tabPositions`)の収集方法を確認
  - DropIndicator表示ロジックのデバッグが必要

### 複数ウィンドウ対応アーキテクチャ

- **Context**: 全ウィンドウで同じタブツリーが表示される問題
- **Sources Consulted**: `TreeStateProvider.tsx`, `event-handlers.ts`
- **Findings**:
  - 現在のTreeStateは全ウィンドウで共有される単一状態
  - `chrome.tabs.query({ currentWindow: true })`でアクティブタブのみwindowId考慮
  - タブノードにwindowId情報が含まれていない
- **Implications**:
  - サイドパネル起動時にcurrentWindowIdを取得
  - タブ情報にwindowIdを追加し、表示時にフィルタリング
  - ストレージ構造の変更は不要（フィルタリングのみで対応可能）

### manifest.jsonのoptions_page設定

- **Context**: 設定ボタンクリックで設定画面が開かない
- **Sources Consulted**: `manifest.json`, `PopupMenu.tsx:66`
- **Findings**:
  - `chrome.runtime.openOptionsPage()`が呼び出されているが、manifest.jsonに`options_page`が未設定
  - `settings.html`は存在するがmanifestに登録されていない
- **Implications**:
  - manifest.jsonに`"options_page": "settings.html"`を追加するだけで解決

---

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| tailwind.config.js上書き | grayパレットをneutralで上書き | コード変更なし、一括適用 | 将来青みのあるgrayが必要な場合の柔軟性なし | **採用** - 最小変更で効果大 |
| クラス一括置換 | gray→neutralを全ファイルで置換 | 明示的で分かりやすい | 約300箇所の変更、テストコードも修正必要 | 工数過大 |
| windowIdフィルタリング | 表示時にタブをwindowIdでフィルタ | ストレージ構造変更不要 | フィルタリングロジックの追加が必要 | **採用** - 既存アーキテクチャ維持 |
| ウィンドウ別ストレージ | ウィンドウごとに独立したツリー状態 | 完全な分離 | ストレージ構造の大幅変更、移行が複雑 | 工数過大 |

---

## Design Decisions

### Decision: Tailwindカラーパレットの無彩色化

- **Context**: UIの背景色が青みがかって見える問題を解決する
- **Alternatives Considered**:
  1. 全ファイルで`gray`→`neutral`に置換（約300箇所）
  2. `tailwind.config.js`で`gray`パレットを`neutral`の値で上書き
- **Selected Approach**: Option 2 - tailwind.config.jsでのパレット上書き
- **Rationale**: コード変更なしで全体に適用可能、テストへの影響なし
- **Trade-offs**:
  - メリット: 最小の変更で最大の効果
  - デメリット: 将来青みのあるgrayが必要になった場合に個別対応が必要
- **Follow-up**: ビルド後のCSS出力を確認し、意図通りの色になっているか検証

### Decision: 閉じるボタンの配置と表示方法

- **Context**: 閉じるボタンがタイトル直後に配置され、ホバー時にレイアウトシフトが発生
- **Alternatives Considered**:
  1. `justify-between`でタイトルと閉じるボタンを両端配置
  2. CloseButtonを常にレンダリングし、`visibility`/`opacity`で表示制御
  3. 固定幅のplaceholder要素を配置
- **Selected Approach**: Option 2 - 常にレンダリング + visibility制御
- **Rationale**: レイアウトシフトを防止しつつ、既存のFlexbox構造を維持
- **Trade-offs**:
  - メリット: ガタつきなし、アクセシビリティ維持
  - デメリット: DOM要素が常に存在（パフォーマンス影響は軽微）
- **Follow-up**: E2Eテストでホバー時の安定性を確認

### Decision: 複数ウィンドウ対応のフィルタリング方式

- **Context**: 各ウィンドウでそのウィンドウのタブのみを表示する必要がある
- **Alternatives Considered**:
  1. TreeStateをウィンドウごとに分離（ストレージ構造変更）
  2. 表示時にwindowIdでフィルタリング（現在のストレージ構造維持）
- **Selected Approach**: Option 2 - 表示時フィルタリング
- **Rationale**:
  - 既存のストレージ構造を維持できる
  - タブ移動時のデータ整合性を保ちやすい
  - 実装工数が少ない
- **Trade-offs**:
  - メリット: 移行不要、既存テストへの影響最小
  - デメリット: 毎回フィルタリング処理が必要（パフォーマンス影響は軽微）
- **Follow-up**:
  - サイドパネル起動時のwindowId取得方法を確認
  - タブ情報にwindowIdを含める実装

---

## Risks & Mitigations

- **ゴーストタブの原因が競合状態の場合** — cleanupStaleNodesの実行タイミングを調整、ストレージロード完了後に実行
- **UnreadTrackerの状態がストレージに残留** — ブラウザ起動時にストレージの未読状態をクリアするロジックを追加
- **ドロップ判定ロジックの根本原因が不明** — 詳細なデバッグログを追加し、マウス座標とタブ位置の関係を可視化
- **複数ウィンドウ対応でのパフォーマンス影響** — フィルタリングはメモ化(useMemo)を使用して最適化

---

## References

- [Tailwind CSS Colors](https://tailwindcss.com/docs/colors) — カラーパレットの定義と各種グレースケールの違い
- [Tailwind CSS Customizing Colors](https://tailwindcss.com/docs/customizing-colors) — theme.extend.colorsでのカスタマイズ方法
- [Chrome Extensions Manifest V3 - options_page](https://developer.chrome.com/docs/extensions/mv3/options/) — Options Pageの設定方法
- [@dnd-kit documentation](https://docs.dndkit.com/) — ドラッグ＆ドロップライブラリのAPI仕様
