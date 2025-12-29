# ギャップ分析: tab-tree-bugfixes

## 分析サマリー

**対象**: Vivaldi-TT拡張機能の14件のバグ修正・UI改善
**対象領域**: テスト品質、UIスタイリング、ドラッグ＆ドロップ操作、複数ウィンドウ対応、各種機能修正
**推奨アプローチ**: ハイブリッド（既存コンポーネント拡張 + 部分的な新規実装）
**全体工数見積**: M〜L（約1〜2週間）
**リスク**: 中程度

---

## 1. 現状調査結果

### 1.1 コードベース構造

| ディレクトリ | 役割 |
|---|---|
| `src/background/` | Service Worker（イベントハンドラ、ツリー同期） |
| `src/sidepanel/` | React UI（TabTreeView, TreeNode, DragDropなど） |
| `src/sidepanel/providers/` | 状態管理（TreeStateProvider, ThemeProvider） |
| `src/sidepanel/components/` | UIコンポーネント |
| `src/settings/` | 設定画面（独立ページ） |
| `src/popup/` | ポップアップメニュー |
| `e2e/` | Playwright E2Eテスト |

### 1.2 主要技術スタック

- React 18 + TypeScript (strict mode)
- @dnd-kit (ドラッグ＆ドロップ)
- Tailwind CSS
- Chrome Extensions API (Manifest V3)
- Vitest + Playwright (テスト)

---

## 2. 要件別ギャップ分析

### Requirement 1: テスト品質改善

**現状分析**:
以下のテストがスキップされている:
- `e2e/headless-mode.spec.ts:56` - headlessモードテスト（CI安定性のためスキップ）
- `e2e/headless-mode.spec.ts:92` - CI環境スキップ条件
- `e2e/popup-menu.spec.ts:86` - 設定ページテスト（options_page未設定のためスキップ）
- `e2e/pinned-tabs.spec.ts:300` - ピン留めタブツリービュー非表示テスト（要件1.2未実装のためスキップ）
- `src/sidepanel/components/ViewSwitching.integration.test.tsx:275, 424` - ビュー編集機能テスト（Task 7.2/7.3で再実装予定）

**ギャップ**:
- headlessモードテストはCI安定性の問題で意図的にスキップ → 修正または削除が必要
- popup-menu設定ページテストはoptions_page設定後に有効化可能
- pinned-tabs.spec.tsは実装完了後にスキップ解除
- ViewSwitching統合テストは削除されたUI関連 → テストファイル修正または削除

**アプローチ**: 既存テストの修正・削除

---

### Requirement 2: タブツリー背景色の無彩色化

**現状分析**:
- コードベース全体でTailwind CSSの`gray`パレットを使用
- `bg-gray-900`, `bg-gray-800`, `bg-gray-700`, `bg-gray-600`等が多数使用されている
- **問題**: Tailwindの`gray`パレットは純粋な無彩色ではなく、**青みを帯びている**
  - `gray-900` = `#111827` (OKLCH hue: 265.755 = 青/紫系)
  - これが「ダークブルー」に見える原因

**影響範囲**（主要ファイル）:
- `SidePanelRoot.tsx` - メイン背景 `bg-gray-900`
- `TabTreeView.tsx` - タブノード `bg-gray-600`, `hover:bg-gray-700`
- `ContextMenu.tsx` - メニュー背景 `bg-gray-800`
- `ViewSwitcher.tsx` - ビュー切替UI `bg-gray-900`, `bg-gray-800`
- `SettingsPanel.tsx` - 設定画面 `bg-gray-900`, `bg-gray-700`
- `PopupMenu.tsx` - ポップアップ `bg-gray-900`
- その他多数（約100箇所以上）

**ギャップ**:
- 全ての`gray`クラスを無彩色パレットに置き換える必要がある
- Tailwindの`neutral`パレットを使用することで純粋な無彩色を実現可能
  - `neutral-900` = 純粋な暗いグレー（青みなし）

**影響箇所の詳細**:
- `bg-gray-*`: 約100箇所以上
- `text-gray-*`: 129箇所（22ファイル）
- `border-gray-*`: 49箇所（15ファイル）
- `hover:bg-gray-*`等のバリアント: 多数
- **合計**: 約300箇所近くの修正が必要

**アプローチ**:
- **Option A（推奨）**: `tailwind.config.js`で`gray`パレットを`neutral`の値で上書き
  ```js
  theme: {
    extend: {
      colors: {
        gray: colors.neutral,  // grayをneutralの値で上書き
      },
    },
  }
  ```
  - メリット: コード変更なし、テストへの影響なし
  - デメリット: 将来的に青みのあるgrayが必要になった場合の柔軟性がない

- **Option B**: 全ての`gray-*`を`neutral-*`に一括置換（sed等で自動化可能）
  - メリット: 明示的で分かりやすい
  - デメリット: 大量のファイル変更、テストコードも修正必要

**参考**: [Tailwind CSS Colors](https://tailwindcss.com/docs/colors)

---

### Requirement 3: アクティブタブの枠線削除

**現状分析**:
- `TabTreeView.tsx:202` - `isActive ? 'bg-gray-600' : ''`
- `TabTreeView.tsx:202` - `isSelected ? 'ring-2 ring-blue-400' : ''`

**ギャップ**:
- アクティブタブに `ring-2 ring-blue-400` が適用されている可能性
- isActiveとisSelectedの両方が青系スタイルを適用

**アプローチ**: ring-2/ring-blue-400 クラスの削除、背景色のみでアクティブ表示

---

### Requirement 4: ゴーストタブの自動削除

**現状分析**:
- `service-worker.ts:23-39` に `cleanupStaleTabData()` 関数あり
- chrome.tabs.query で存在タブを取得し、`testTreeStateManager.cleanupStaleNodes(existingTabIds)` を呼び出し
- ブラウザ起動時（onInstalled, Service Worker起動時）にクリーンアップ実行

**ギャップ**:
- クリーンアップ処理は既に実装済み
- ゴーストタブが残る原因は別の箇所にある可能性（競合状態、ストレージ不整合など）

**アプローチ**: デバッグ調査 → cleanupStaleNodes処理の強化

---

### Requirement 5: 復元タブの未読インジケーター非表示

**現状分析**:
- `service-worker.ts:94-96` に `testUnreadTracker.setInitialLoadComplete()` 呼び出し
- ブラウザ起動時の既存タブには未読バッジを表示しない設計

**ギャップ**:
- 設計上は対応済み
- 実際に未読インジケーターが付く原因を調査必要

**アプローチ**: UnreadTracker の初期化タイミング・ロジック確認

---

### Requirement 6: 閉じるボタンの右端固定

**現状分析**:
- `TabTreeView.tsx:255, 467` - `<div className="flex-1 flex items-center min-w-0">`
- `TabTreeView.tsx:274, 486` - `{isHovered && <CloseButton onClose={handleCloseClick} />}`
- CloseButtonがタイトルの後に配置されているが、`flex-1` により右端固定ではない

**ギャップ**:
- 閉じるボタンがflexコンテナ内でタイトル直後に配置
- タイトルが短いと閉じるボタンが中央付近に表示される

**アプローチ**: CSSレイアウト修正（justify-between または absolute positioning）

---

### Requirement 7: ホバー時のサイズ安定化

**現状分析**:
- CloseButtonはホバー時のみ条件レンダリング `{isHovered && <CloseButton />}`
- ボタン表示時にレイアウトシフトが発生する可能性

**ギャップ**:
- 条件レンダリングによりDOM要素の追加/削除が発生
- レイアウトシフトによるガタつき

**アプローチ**: visibility/opacity制御に変更、またはplaceholder要素配置

---

### Requirement 8: ドロップ判定の修正

**現状分析**:
- `GapDropDetection.ts` に `calculateDropTarget()` 関数実装
- `DEFAULT_GAP_THRESHOLD_RATIO = 0.25` でタブ上下25%を隙間判定
- `TabTreeView.tsx` の `DragMonitor` でドロップターゲット計算

**ギャップ**:
- 判定ロジックは実装済みだが、動作不具合の報告
- タブ間ドロップのプレースホルダー表示が不正

**アプローチ**: GapDropDetection ロジックのデバッグ・修正、DropIndicator位置計算修正

---

### Requirement 9: ドラッグ中のタブサイズ固定

**現状分析**:
- `TabTreeView.tsx:155-162` - ドラッグ中のアイテム以外は transform を適用しない設計
- `shouldApplyTransform` でドラッグ中アイテムのみtransform適用

**ギャップ**:
- 設計上は対応済みだが、隙間が広がる問題が報告
- DropIndicator表示時にレイアウトが変わる可能性

**アプローチ**: DropIndicator のレイアウト影響確認・修正

---

### Requirement 10: ピン留めタブの表示分離

**現状分析**:
- `PinnedTabsSection.tsx` - ピン留めタブ専用セクション実装済み
- `SidePanelRoot.tsx:185-190` でPinnedTabsSectionを表示
- `e2e/pinned-tabs.spec.ts:300` - ツリービュー非表示テストがスキップ（未実装）

**ギャップ**:
- ピン留めタブがPinnedTabsSectionに表示されつつ、通常ツリービューにも表示されている
- TabTreeView内でピン留めタブをフィルタリングしていない

**アプローチ**: TabTreeView でピン留めタブを除外するフィルタ追加

---

### Requirement 11: 設定画面の起動修正

**現状分析**:
- `PopupMenu.tsx:66` - `chrome.runtime.openOptionsPage()` を呼び出し
- `manifest.json` - `options_page` が**未設定**

**ギャップ**:
- manifest.json に options_page の設定がない
- chrome.runtime.openOptionsPage() は options_page がないと動作しない

**アプローチ**: manifest.json に `"options_page": "settings.html"` を追加

---

### Requirement 12: 水平スクロールの禁止

**現状分析**:
- `TabTreeView.tsx:972-978` - `overflow-x-hidden` をドラッグ中に適用
- `SidePanelRoot.tsx:205` - `overflow-auto` がタブツリーコンテナに適用

**ギャップ**:
- ドラッグ中のみ `overflow-x-hidden` が適用される
- 常時水平スクロールを禁止する設定が必要

**アプローチ**: `overflow-x-hidden` を常時適用

---

### Requirement 13: ツリー外ドロップで新規ウィンドウ

**現状分析**:
- `event-handlers.ts:513` に `createNewWindow()` 関数あり
- `event-handlers.ts:548` - サブツリー移動対応の `moveSubtreeToNewWindow()` あり
- `SidePanelRoot.tsx:159-161` - ExternalDropZone関連コードは削除済み（要件6.1）

**ギャップ**:
- ツリー外ドロップの検出と新規ウィンドウ作成のUI連携がない
- dnd-kitでツリー外へのドロップ検出が必要

**アプローチ**: DndContext の onDragEnd でドロップ位置がツリー外かを判定、Service Workerへメッセージ送信

---

### Requirement 14: 複数ウィンドウ対応

**現状分析**:
- `TreeStateProvider.tsx` - 全ウィンドウで共通の TreeState を使用
- `chrome.tabs.query({ active: true, currentWindow: true })` でアクティブタブ取得
- windowId による分離処理なし

**ギャップ**:
- 現在の実装は全ウィンドウで同じタブツリーを共有
- 各ウィンドウのサイドパネルに該当ウィンドウのタブのみ表示する機能がない

**アプローチ**:
- TreeStateProvider でcurrentWindowIdを追跡
- タブノードをwindowIdでフィルタリング
- タブ情報取得時にwindowIdを含める

---

## 3. 実装アプローチオプション

### Option A: 既存コンポーネント拡張

**対象要件**: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12

**アプローチ**:
- 既存ファイルのスタイル/ロジック修正
- CSS変更、条件ロジック追加
- manifest.json設定追加

**メリット**:
- 最小限の変更
- 既存パターンの踏襲
- テスト影響が限定的

**デメリット**:
- 一部コンポーネントの責務が増加する可能性

---

### Option B: 新規コンポーネント作成

**対象要件**: 13, 14

**アプローチ**:
- ツリー外ドロップ検出コンポーネント
- ウィンドウ別タブフィルタリングロジック

**メリット**:
- 既存コード影響を最小化
- 責務の明確な分離

**デメリット**:
- 新規ファイル追加
- 統合テストの追加が必要

---

### Option C: ハイブリッド（推奨）

**アプローチ**:
- 要件1-12: 既存ファイル修正
- 要件13: TabTreeView内のドロップハンドラ拡張
- 要件14: TreeStateProvider の拡張 + windowIdフィルタリング

---

## 4. 工数・リスク評価

| 要件 | 工数 | リスク | 理由 |
|---|---|---|---|
| 1 | S | 低 | テストファイルの修正/削除のみ |
| 2 | M | 低 | 約100箇所以上のgray→neutral置換、またはtailwind.config.js設定変更 |
| 3 | S | 低 | スタイルクラス削除のみ |
| 4 | S | 中 | 原因調査が必要 |
| 5 | S | 中 | 原因調査が必要 |
| 6 | S | 低 | CSSレイアウト修正 |
| 7 | S | 低 | CSS/レンダリング方式変更 |
| 8 | M | 中 | ドロップ判定ロジック修正 |
| 9 | S | 低 | DropIndicatorレイアウト確認 |
| 10 | S | 低 | フィルタ条件追加 |
| 11 | S | 低 | manifest.json設定追加 |
| 12 | S | 低 | CSS overflow設定 |
| 13 | M | 中 | ツリー外ドロップ検出の実装 |
| 14 | L | 高 | アーキテクチャ変更が必要 |

**全体工数**: M〜L（約1〜2週間）
**全体リスク**: 中程度（要件14のアーキテクチャ変更が主なリスク要因）

---

## 5. 設計フェーズへの引き継ぎ事項

### Research Needed

1. **ゴーストタブの原因特定** (Req 4)
   - cleanupStaleNodes の実行タイミングとストレージ同期の競合
   - タブ作成/削除イベントの順序問題

2. **未読インジケーターの原因特定** (Req 5)
   - UnreadTracker.setInitialLoadComplete() の呼び出しタイミング
   - 復元タブと新規タブの判定ロジック

3. **ドロップ判定不具合の原因** (Req 8)
   - GapDropDetection のマウスY座標計算
   - DropIndicator の配置ロジック

4. **複数ウィンドウアーキテクチャ** (Req 14)
   - サイドパネルとService Worker間のwindowId伝達方法
   - ストレージ構造の変更要否（ウィンドウ別 vs 全体共有）

### 依存関係

- 要件11の修正（options_page設定）→ 要件1のポップアップテスト有効化
- 要件10の修正（ピン留めタブフィルタ）→ 要件1のピン留めテスト有効化

### 推奨実装順序

1. **Phase 1**: 要件1, 2, 3, 11, 12（低リスク、独立性高い）
2. **Phase 2**: 要件6, 7, 9, 10（UI/レイアウト関連）
3. **Phase 3**: 要件4, 5, 8（調査・デバッグ必要）
4. **Phase 4**: 要件13, 14（アーキテクチャ影響大）

---

## 6. 結論

本プロジェクトは14件の要件を含むバグ修正・UI改善タスクです。多くの要件は既存コンポーネントの軽微な修正で対応可能ですが、以下の点に注意が必要です：

- **要件2（背景色の無彩色化）** はTailwind CSSの`gray`パレットが青みを帯びているため発生。`tailwind.config.js`でパレットを上書きするか、約100箇所以上の`gray`→`neutral`置換が必要
- **要件14（複数ウィンドウ対応）** は現在のアーキテクチャの根本的な変更を必要とし、最大のリスク要因
- **要件4, 5, 8** は動作不具合の原因調査が先行して必要
- **要件1** は他の要件の実装完了後に対応可能な項目を含む

ハイブリッドアプローチを推奨し、リスクの低い要件から順次実装することで、プロジェクト全体のリスクを軽減できます。
