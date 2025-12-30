# ギャップ分析レポート

## 概要

本ドキュメントは、`tab-tree-comprehensive-fix`仕様書の要件と既存コードベースを分析し、実装上のギャップを明らかにするものです。

## 分析サマリー

- **スコープ**: 12の修正項目（E2Eテストフレーキー、ドラッグ&ドロップ、UI表示、機能追加）
- **主な課題**: E2Eテスト安定性、未実装機能（グループ化、新規タブボタン）、UI配置修正
- **推奨アプローチ**: ハイブリッド方式（既存コンポーネント拡張 + 新規コンポーネント追加）
- **複雑度**: M〜L（1〜2週間）
- **リスク**: 中程度（E2Eテスト安定化には試行錯誤が必要）

---

## 要件と既存アセットのマッピング

### Requirement 1: E2Eテストのフレーキー問題修正

| 要件項目 | 関連アセット | ギャップ |
|---------|-------------|---------|
| AC1: `drag-drop-placeholder.spec.ts:268` | `e2e/drag-drop-placeholder.spec.ts:268` | **調査必要**: テスト不安定の根本原因を特定する必要あり |
| AC2: `drag-drop-placeholder.spec.ts:318` | `e2e/drag-drop-placeholder.spec.ts:318` | **調査必要**: プレースホルダー位置変更検知のタイミング問題 |
| AC3: `tab-persistence.spec.ts:201` | `e2e/tab-persistence.spec.ts:201` | **調査必要**: タイトル永続化のポーリング条件を確認 |
| AC4: 固定時間待機禁止 | `e2e/utils/polling-utils.ts` | **既存**: ポーリングユーティリティは整備済み |

**既存アセット分析**:
- `e2e/utils/polling-utils.ts`: `waitForCondition`, `waitForTabInTreeState`など多数のポーリングユーティリティが存在
- 既存テストは`waitForTimeout`を使用していない設計だが、タイミング問題が残存している可能性

**ギャップ**: フレーキー問題の具体的原因（DOM状態、ネットワーク、dnd-kit衝突検出タイミング）を特定し、適切なポーリング条件を設定する必要がある

---

### Requirement 2: ビューのタブカウント正確性

| 要件項目 | 関連アセット | ギャップ |
|---------|-------------|---------|
| AC1: 不整合タブ削除時の再計算 | `src/sidepanel/components/ViewSwitcher.tsx` | **調査必要**: tabCounts propsは渡されているが、再計算トリガーを確認 |
| AC2: タブ追加・削除時の即時更新 | `src/sidepanel/providers/TreeStateProvider.tsx` | **既存**: `viewTabCounts`は算出されている |
| AC3: 実存タブのみカウント | 同上 | **確認必要**: ゴーストタブ除外ロジックの確認 |

**既存アセット分析**:
- `ViewSwitcher.tsx:159`: `const tabCount = tabCounts?.[view.id] ?? 0;` でバッジ表示
- `SidePanelRoot.tsx:240`: `tabCounts={viewTabCounts}` でprops連携済み
- `TreeStateProvider.tsx`: `viewTabCounts`はツリー状態から算出

**ギャップ**: 不整合タブ（存在しないタブID）がツリーから削除された際のタブカウント再計算パスを検証する必要がある

---

### Requirement 3: タブ間隙間へのドロップ正確性

| 要件項目 | 関連アセット | ギャップ |
|---------|-------------|---------|
| AC1-3: 隙間ドロップ位置 | `src/sidepanel/components/GapDropDetection.ts` | **既存**: 隙間判定ロジック実装済み |
| 同上 | `src/sidepanel/components/TabTreeView.tsx:1080-1103` | **既存**: `onSiblingDrop`ハンドラ実装済み |
| AC4-6: E2Eテスト | `e2e/drag-drop-placeholder.spec.ts` | **追加必要**: 正確な位置配置のテストケース |

**既存アセット分析**:
- `GapDropDetection.ts`: `calculateDropTarget`関数でタブ/隙間判定を実装
- `TabTreeView.tsx:1080-1103`: Gap判定時に`onSiblingDrop`を呼び出し
- `DropIndicator.tsx`: 視覚的フィードバック用コンポーネント

**ギャップ**: 既存実装は隙間判定機能を持つが、ドロップ後の実際の位置配置が正確かどうかをE2Eテストで検証する必要がある

---

### Requirement 4: ドラッグ中のタブサイズ安定性

| 要件項目 | 関連アセット | ギャップ |
|---------|-------------|---------|
| AC1-3: サイズ一定性 | `src/sidepanel/components/TabTreeView.tsx:167-174` | **調査必要**: `shouldApplyTransform`ロジックを確認 |

**既存アセット分析**:
- `TabTreeView.tsx:167-174`: ドラッグ中のスタイル制御
```typescript
const shouldApplyTransform = isDragging || (isActiveItem && globalIsDragging);
const style = {
  transform: shouldApplyTransform ? CSS.Transform.toString(transform) : undefined,
  transition: shouldApplyTransform ? transition : undefined,
  opacity: isDragging ? 0.5 : 1,
};
```

**ギャップ**: 親子関係形成時（ホバーターゲット変化時）にタブサイズが変化する問題の原因を特定する必要がある。CSSクラス`isDragHighlighted`適用時のスタイル変化が関係している可能性

---

### Requirement 5: ドラッグ時スクロール制限

| 要件項目 | 関連アセット | ギャップ |
|---------|-------------|---------|
| AC1-3: スクロール範囲制限 | `src/sidepanel/components/TabTreeView.tsx:41-56` | **既存**: `AUTO_SCROLL_CONFIG`で設定済み |

**既存アセット分析**:
- `TabTreeView.tsx:41-56`: dnd-kitのautoScroll設定
```typescript
const AUTO_SCROLL_CONFIG = {
  threshold: { x: 0, y: 0.15 },  // 横スクロール無効化
  acceleration: 3,
  interval: 15,
  layoutShiftCompensation: false,  // スクロール範囲制限
}
```

**ギャップ**: 既存設定で横スクロールは無効化されているが、コンテンツ末尾を超えるスクロールが発生していないか確認が必要

---

### Requirement 6: タブグループ化機能

| 要件項目 | 関連アセット | ギャップ |
|---------|-------------|---------|
| AC1-4: コンテキストメニューからグループ化 | `src/sidepanel/components/ContextMenu.tsx:278-320` | **部分的**: 「グループに追加」は実装済みだが「タブをグループ化」が不足 |
| AC5-8: E2Eテスト | `e2e/tab-grouping.spec.ts` | **確認必要**: 既存テストのカバレッジを確認 |

**既存アセット分析**:
- `ContextMenu.tsx:278-320`:
  - 複数選択時: 「選択されたタブをグループ化」ボタン（`group`アクション）
  - 単一選択時: 「グループに追加」サブメニュー
- `useMenuActions.ts:86-92`: `group`アクションは`CREATE_GROUP`メッセージを送信

**ギャップ**:
- **欠落**: 単一タブ選択時の「新規グループ作成」オプションが不足
- 現状は複数選択時のみ新規グループ作成が可能

---

### Requirement 7: クロスウィンドウタブドラッグ

| 要件項目 | 関連アセット | ギャップ |
|---------|-------------|---------|
| AC1-3: 別ウィンドウへのドラッグ移動 | `src/sidepanel/hooks/useCrossWindowDrag.ts` | **部分的**: 同一ウィンドウ外へのドロップは実装済み |
| 同上 | `src/sidepanel/components/CrossWindowDragHandler.tsx` | **確認必要**: 別ウィンドウのツリービューへのドロップ |
| AC4-6: E2Eテスト | `e2e/cross-window.spec.ts` | **確認必要**: テストカバレッジ |

**既存アセット分析**:
- `useCrossWindowDrag.ts`:
  - `handleDragStart`: ドラッグ状態をService Workerに保存
  - `handleDragEnd`: ツリー外ドロップで新規ウィンドウ作成
  - `handleDropFromOtherWindow`: 別ウィンドウからのタブ受け入れ
- `CrossWindowDragHandler.tsx`: クロスウィンドウドラッグのUI連携

**ギャップ**:
- 別ウィンドウのツリービューへドラッグした際のドロップインジケーター表示が未実装の可能性
- 要件では「ウィンドウBのツリービューにドロップインジケーターを表示」が求められている

---

### Requirement 8: 新規タブ追加ボタン

| 要件項目 | 関連アセット | ギャップ |
|---------|-------------|---------|
| AC1-4: ツリー末尾に追加ボタン | なし | **欠落**: 新規タブ追加ボタンは未実装 |
| AC5-7: E2Eテスト | なし | **追加必要** |

**既存アセット分析**:
- `ViewSwitcher.tsx:219-241`: ビュー追加ボタン（+アイコン）は存在するが、これはタブ追加ではなくビュー追加
- タブツリー末尾に新規タブ追加ボタンは存在しない

**ギャップ**:
- **完全欠落**: タブツリー末尾の新規タブ追加ボタンを新規実装する必要がある
- 実装場所: `SidePanelRoot.tsx`の`TabTreeView`コンポーネントの後に配置

---

### Requirement 9: 新規タブのタイトル正確性

| 要件項目 | 関連アセット | ギャップ |
|---------|-------------|---------|
| AC1-3: スタートページタイトル表示 | `src/services/TitlePersistenceService.ts` | **調査必要**: Vivaldiスタートページのタイトル取得 |
| AC4-5: E2Eテスト | なし | **追加必要** |

**既存アセット分析**:
- `TitlePersistenceService.ts`: タブタイトルの永続化サービス
- `TreeNode.tsx`: タイトル表示ロジック
- Vivaldiスタートページの特殊URL（`vivaldi://startpage`）の処理が必要

**ギャップ**:
- Vivaldiスタートページのタイトル取得方法を調査する必要がある
- `chrome.tabs.Tab.title`が空または異なる値を返す場合の対応

---

### Requirement 10: ビューへの新規タブ追加

| 要件項目 | 関連アセット | ギャップ |
|---------|-------------|---------|
| AC1-3: 現在ビューにタブ追加 | `src/background/event-handlers.ts:138-142` | **既存**: `getCurrentViewId()`で現在ビューを取得 |
| AC4-6: E2Eテスト | なし | **追加必要** |

**既存アセット分析**:
- `event-handlers.ts:138-142`:
```typescript
// Requirement 15.1: 現在アクティブなビューIDを取得し、新しいタブをそのビューに追加
const currentViewId = await getCurrentViewId();
await treeStateManager.addTab(tab, parentId, currentViewId);
```

**ギャップ**:
- 基本実装は存在するが、E2Eテストで動作検証が必要
- ビュー切り替え直後の新規タブ追加が正しく動作するか確認

---

### Requirement 11: 未読インジケーター位置

| 要件項目 | 関連アセット | ギャップ |
|---------|-------------|---------|
| AC1-4: 右端固定表示 | `src/sidepanel/components/UnreadBadge.tsx` | **調査必要**: 現在のCSS配置を確認 |
| AC5-6: E2Eテスト | `e2e/unread-indicator.spec.ts` | **追加必要**: 位置検証テスト |

**既存アセット分析**:
- `UnreadBadge.tsx:43-45`:
```typescript
const defaultClassName = displayCount
  ? 'ml-2 min-w-[20px] h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 px-1.5'
  : 'ml-2 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0';
```
- `TabTreeView.tsx:283`: タイトルの後に`<UnreadBadge>`を配置

**ギャップ**:
- 現在の実装では`ml-2`でタイトル末尾に配置されているが、要件ではタブの「右端」に固定配置が求められている
- Flexboxレイアウトの調整が必要

---

### Requirement 12: ピン留めタブの並び替え同期

| 要件項目 | 関連アセット | ギャップ |
|---------|-------------|---------|
| AC1-4: 順序同期 | `src/sidepanel/components/PinnedTabsSection.tsx:184-208` | **既存**: ドラッグ&ドロップ並び替え実装済み |
| AC5-8: E2Eテスト | `e2e/pinned-tab-reorder.spec.ts` | **確認必要**: テストカバレッジ |

**既存アセット分析**:
- `PinnedTabsSection.tsx:184-208`: `handleDragEnd`でピン留めタブ並び替え
- `SidePanelRoot.tsx:259`: `onPinnedTabReorder={handlePinnedTabReorder}`

**ギャップ**:
- 基本実装は存在するが、ブラウザ側での並び替え → ツリービュー同期の方向を検証する必要がある
- E2Eテストで3つ以上のピン留めタブでの各位置移動を検証

---

## 実装アプローチ評価

### Option A: 既存コンポーネント拡張

**適用項目**: Requirements 1-5, 9-12

**内容**:
- E2Eテストの修正・安定化
- `ViewSwitcher`のタブカウント再計算トリガー追加
- `GapDropDetection`の精度向上
- `UnreadBadge`のCSS配置修正
- ピン留めタブ同期の検証・修正

**トレードオフ**:
- ✅ 既存コードベースへの影響が限定的
- ✅ テスト資産を活用可能
- ❌ 根本原因特定に時間がかかる可能性

### Option B: 新規コンポーネント追加

**適用項目**: Requirement 8（新規タブ追加ボタン）

**内容**:
- `AddTabButton`コンポーネント新規作成
- `SidePanelRoot`への統合

**トレードオフ**:
- ✅ クリーンな実装が可能
- ✅ 既存コードへの影響なし
- ❌ 新しいテスト作成が必要

### Option C: ハイブリッドアプローチ（推奨）

**内容**:
- Requirements 1-5, 9-12: 既存コンポーネント拡張
- Requirements 6-7: 既存機能の検証・拡張
- Requirement 8: 新規コンポーネント追加

**トレードオフ**:
- ✅ 各項目に最適なアプローチを適用
- ✅ リスクを分散
- ❌ 計画・調整が必要

---

## 複雑度・リスク評価

### 工数見積もり: M〜L（1〜2週間）

| カテゴリ | 項目 | 工数 |
|---------|------|------|
| E2Eテスト安定化 | Req 1 | M |
| 軽微なバグ修正 | Req 2, 4, 5, 9, 11, 12 | S〜M |
| 機能検証・修正 | Req 3, 6, 7, 10 | M |
| 新規機能実装 | Req 8 | S |
| E2Eテスト追加 | 各要件 | M |

### リスク評価: 中程度

| リスク項目 | レベル | 理由 |
|-----------|--------|------|
| E2Eテストフレーキー | 高 | 根本原因特定に試行錯誤が必要 |
| クロスウィンドウドラッグ | 中 | Playwright複数ウィンドウテストの複雑さ |
| Vivaldiスタートページ | 中 | ブラウザ固有の動作調査が必要 |
| 未読インジケーター位置 | 低 | CSS修正で対応可能 |
| 新規タブボタン | 低 | 既存パターンに従い実装可能 |

---

## 設計フェーズへの推奨事項

### 優先度高（まず取り組むべき項目）

1. **Requirement 1: E2Eテストフレーキー問題**
   - 調査: 該当テストのログ収集、タイミング問題の特定
   - 対策: ポーリング条件の見直し、DOM状態監視の強化

2. **Requirement 8: 新規タブ追加ボタン**
   - 新規コンポーネント設計
   - `chrome.tabs.create`との連携

### 優先度中（並行して進められる項目）

3. **Requirements 2-5: ドラッグ&ドロップ関連**
   - 既存実装の検証とE2Eテスト追加
   - 必要に応じて修正

4. **Requirement 11: 未読インジケーター位置**
   - CSS修正のみで対応可能

### 優先度低（後半で対応する項目）

5. **Requirements 6-7, 10, 12: 機能検証**
   - E2Eテストによる動作確認
   - 必要に応じて修正

6. **Requirement 9: スタートページタイトル**
   - Vivaldi固有動作の調査

---

## Research Needed（設計フェーズで調査が必要な項目）

1. **E2Eテストフレーキーの根本原因**
   - dnd-kit衝突検出のタイミング
   - Playwrightのマウス移動と実際のDOM更新の同期

2. **Vivaldiスタートページのタイトル取得**
   - `vivaldi://startpage` URLでの`chrome.tabs.Tab.title`の値
   - 代替手段（ハードコード or 設定）

3. **クロスウィンドウドラッグのインジケーター表示**
   - 別ウィンドウでのドラッグイベント受信方法
   - Service Worker経由の状態共有

4. **ピン留めタブのブラウザ → ツリー同期**
   - `chrome.tabs.onMoved`イベントでのピン留めタブ順序変更検知
