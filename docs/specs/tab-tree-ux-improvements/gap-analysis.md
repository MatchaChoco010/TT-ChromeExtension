# 実装ギャップ分析レポート

## エグゼクティブサマリー

本分析は、タブツリーUX改善機能（13要件）に関する既存コードベースとのギャップを特定したものです。

**主要な発見事項:**
- **要件1（タブ表示の改善）**: 型定義（`TabInfo`）に`favIconUrl`と`title`は存在するが、`TabTreeView`コンポーネントでは`Tab {tabId}`という固定表示になっている（**重大なギャップ**）
- **要件7-8（ドラッグ&ドロップ）**: dnd-kitの基本実装は完了しているが、視覚的フィードバックとdepth選択機能は未実装
- **要件3（ビュー切り替えUI）**: 現在の`ViewSwitcher`は大きなボタン形式で、ファビコンサイズへの変更と右クリックメニューが必要
- **要件5（設定画面）**: 現在はサイドパネル内に表示、新しいタブで開く必要がある
- **要件9（複数選択）**: Shift/Ctrl選択機能は完全に未実装

---

## 要件別ギャップ分析

### Requirement 1: タブ表示の改善

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| ページタイトル表示 | `TabInfo`に`title`フィールドあり。`TreeNode.tsx`では正しく使用。しかし`TabTreeView.tsx`の`SortableTreeNodeItem`では`Tab {node.tabId}`固定表示 | **Missing** - `TabTreeView`で`TabInfo`を渡していない | High |
| ファビコン表示 | `TabInfo`に`favIconUrl`あり。`TreeNode.tsx`では正しく実装済み | **Missing** - `TabTreeView`から`TabInfo`データが渡されていない | High |
| デフォルトアイコン | `TreeNode.tsx`でファビコン取得失敗時のデフォルトアイコン実装済み | OK | - |

**技術的詳細:**
- `SortableTreeNodeItem`コンポーネント（`TabTreeView.tsx:41-175行目`）に`TabInfo`を渡す必要がある
- `TreeStateProvider`から各タブの`TabInfo`を取得する仕組みが必要
- Background Service Workerから`chrome.tabs`のタブ情報を取得・同期する必要がある

**実装アプローチ:**
- **Option A (推奨)**: `TreeStateProvider`に`tabInfoMap: Record<number, TabInfo>`を追加し、`chrome.tabs`イベントで更新
- **Option B**: 各ノードレンダリング時に`chrome.tabs.get()`を呼び出す（パフォーマンス懸念）

---

### Requirement 2: タブグループの統合表示

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| ツリー内表示 | `GroupSection.tsx`で別セクションに表示 | **Constraint** - Chrome Tab Groups API（`chrome.tabGroups`）は独自のグループ概念であり、現在の`Group`型とは異なる | Medium |
| ドラッグ&ドロップ | グループは現在ドラッグ不可 | **Missing** | Medium |
| 折りたたみ/展開 | グループ自体の展開は実装済み | Partial - タブグループ内のタブの展開表示が必要 | Medium |

**技術的詳細:**
- 現在の`Group`型（`src/types/index.ts:30-35行目`）は拡張機能独自のグループ機能
- Chromeのネイティブタブグループ（`chrome.tabGroups`）との統合が必要な可能性
- `TabNode`に`groupId`フィールドは存在（`src/types/index.ts:12行目`）

**Research Needed:**
- Chrome Tab Groups API（`chrome.tabGroups`）とVivaldiの互換性調査
- ネイティブグループと拡張機能グループの統合方針の決定

---

### Requirement 3: ビュー切り替えUIの改善

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| ファビコンサイズボタン | 現在は大きめのボタン（`px-3 py-1.5`）とテキスト表示 | **Missing** - コンパクトなアイコンベースのUIが必要 | Medium |
| ビューごとのアイコン | `View`型に`icon?: string`フィールドあり | Partial - アイコン設定UIはあるが、表示はカラーのみ | Medium |
| 右クリックメニュー | 未実装 | **Missing** | Medium |
| モーダル編集ダイアログ | インライン編集フォームで実装 | **Missing** - モーダルダイアログへの変更が必要 | Low |
| 鉛筆ボタン削除 | 各ビュー横に編集ボタンあり | **Missing** - 削除が必要 | Low |

**技術的詳細:**
- `ViewSwitcher.tsx`（290行）の大幅な改修が必要
- 右クリック用のコンテキストメニューコンポーネントを再利用可能
- モーダルダイアログコンポーネント（`ConfirmDialog.tsx`相当）の作成が必要

---

### Requirement 4: スナップショット機能のUI改善

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| トップからボタン削除 | `SnapshotSection`はセクションとして表示 | **Missing** - スナップショットボタンをUI上部から削除 | Medium |
| コンテキストメニュー追加 | コンテキストメニューに`snapshot`アクションなし | **Missing** - `MenuAction`型と`ContextMenu`への追加が必要 | Medium |

**技術的詳細:**
- `MenuAction`型（`src/types/index.ts:194-205行目`）に`'snapshot'`を追加
- `ContextMenu.tsx`にスナップショット取得ボタンを追加
- ツリービュー空白領域での右クリックハンドリングが必要

---

### Requirement 5: 設定画面の表示方法改善

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| 新しいタブで開く | サイドパネル内でオーバーレイ表示（`SidePanelRoot.tsx:134-165行目`） | **Missing** - `chrome.tabs.create()`で新しいタブを開く必要 | High |
| 全幅レイアウト | サイドパネルに最適化 | **Missing** - スタンドアロンページとしてのレイアウト調整が必要 | Medium |
| ツールバーアイコンメニュー | 未実装 | **Missing** - `chrome.action.onClicked`ハンドラーの実装が必要 | Medium |

**技術的詳細:**
- `manifest.json`に新しいHTMLページ（`settings.html`）の追加が必要
- Service Workerで`chrome.action.onClicked`イベントハンドリング
- 設定ページとサイドパネル間でのストレージ同期は既存の`StorageService`で対応可能

---

### Requirement 6: スナップショット自動保存設定

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| 自動保存設定セクション | 設定画面に`autoSnapshotInterval`はある（`UserSettings`型） | Partial - UIでの設定変更箇所が設定画面にない | Medium |
| 有効/無効トグル | `autoSnapshotInterval: 0`で無効化 | Partial - 明示的なトグルUIが必要 | Low |
| 間隔設定 | `autoSnapshotInterval: number`（分単位） | Partial - 数値入力のみ | Low |
| 最大保持数設定 | `SnapshotManager.deleteOldSnapshots()`メソッドあり | **Missing** - `UserSettings`に`maxSnapshots`フィールドがない | Medium |

**技術的詳細:**
- `UserSettings`型に`maxSnapshots?: number`を追加
- `SettingsPanel.tsx`に自動保存設定セクションを追加
- `SnapshotManager`の`startAutoSnapshot`は実装済み

---

### Requirement 7: ドラッグ&ドロップのビジュアルフィードバック改善

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| タブホバー時ハイライト | ドラッグ中は`opacity: 0.5`のみ | **Missing** - ドロップターゲットのハイライト表示が必要 | High |
| 隙間インジケーター | 未実装 | **Missing** - タブ間の隙間にドロップインジケーターが必要 | High |
| 当たり判定の最適化 | dnd-kitの`closestCenter`を使用 | **Unknown** - カスタム衝突検出が必要か調査要 | Medium |

**技術的詳細:**
- dnd-kitの`DragOverlay`コンポーネントでドラッグ中のビジュアル表示
- カスタムコリジョン検出アルゴリズムの実装が必要な可能性
- CSSでのドロップゾーンビジュアル（`border-top`/`border-bottom`など）

**Research Needed:**
- dnd-kitの`useDndMonitor`でドロップゾーンのハイライト実装方法
- カスタム衝突検出アルゴリズムの設計

---

### Requirement 8: 親子関係のあるタブのドラッグ操作改善

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| 子タブ単独移動 | 現在も子タブ単独でドラッグ可能（`SortableTreeNodeItem`は各ノード独立） | OK | - |
| 親からの切り離し | `TreeStateManager.moveNode()`で対応可能 | OK | - |
| depth選択機能 | 未実装 | **Missing** - 隙間ドロップ時のdepth選択UIが必要 | High |
| depth視覚的表示 | 未実装 | **Missing** - インジケーターでdepthを表示 | High |
| マウス左右でdepth変更 | 未実装 | **Missing** - ドラッグ中のマウスX座標でdepth変更 | High |

**技術的詳細:**
- dnd-kitの`onDragMove`イベントでマウスX座標を監視
- ドロップ位置のdepthを計算するロジックの実装
- インデント幅（現在`node.depth * 20 + 8`px）に基づくdepth判定

**Research Needed:**
- dnd-kitでの隙間（gap）へのドロップ検出方法
- マウスX座標からの動的depth計算アルゴリズム

---

### Requirement 9: タブの複数選択機能

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| Shift+クリック範囲選択 | 未実装 | **Missing** - 選択状態管理とシフトクリックハンドリング | High |
| Ctrl/Cmd+クリック追加選択 | 未実装 | **Missing** - 選択トグルロジック | High |
| 複数選択コンテキストメニュー | `ContextMenu`は`targetTabIds: number[]`を受け取る | Partial - 複数選択時の一括操作は実装済み | Medium |
| 一括閉じ | `ContextMenu`の「選択されたタブを閉じる」で対応 | OK（UI側は対応済み、選択機能が必要） | - |
| グループ化 | コンテキストメニューにグループ化オプションあり | OK（選択機能が必要） | - |

**技術的詳細:**
- 新しい状態管理が必要: `selectedTabIds: Set<number>`
- `TreeStateProvider`に選択状態管理を追加
- 各ノードクリック時にShift/Ctrl修飾キーを検出
- 範囲選択のための「最後に選択したタブ」の追跡

---

### Requirement 10: タブの閉じるボタン表示

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| ホバー時表示 | `TreeNode.tsx`では`isHovered`状態で`CloseButton`表示 | Partial - `TabTreeView.tsx`の`SortableTreeNodeItem`には未実装 | Medium |
| クリック時閉じ | `TreeNode.tsx`に`onClose`ハンドラーあり | Partial - `SortableTreeNodeItem`には未実装 | Medium |
| 非ホバー時非表示 | `TreeNode.tsx`では実装済み | Partial - `SortableTreeNodeItem`には未実装 | Medium |

**技術的詳細:**
- `SortableTreeNodeItem`と`TreeNodeItem`に`CloseButton`コンポーネントを統合
- ホバー状態の管理（`useState`で`isHovered`）
- 閉じるボタンクリック時のイベント伝播制御（`e.stopPropagation()`）

---

### Requirement 11: ダークテーマの統一

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| アクティブタブ黒系ハイライト | `bg-blue-100`（青系）を使用 | **Missing** - ダーク系のハイライト色に変更 | Medium |
| 統一ダークテーマ | Tailwind CSSで`dark:`プレフィックス使用 | Partial - 一部コンポーネントで統一されていない可能性 | Medium |
| コントラスト調整 | 未確認 | **Unknown** - 全体的なコントラスト監査が必要 | Low |

**技術的詳細:**
- `TabTreeView.tsx`の`bg-blue-100`を`bg-gray-700`等のダーク系に変更
- `ThemeProvider.tsx`でVivaldiテーマ変数の適用を強化
- 全コンポーネントでの`dark:`プレフィックス使用状況の監査

---

### Requirement 12: ピン留めタブの特別表示

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| 上部表示 | 未実装（通常タブと混在） | **Missing** - ピン留めタブの分離表示が必要 | High |
| ファビコンサイズ横並び | 未実装 | **Missing** - コンパクトな横並び表示が必要 | High |
| 区切り線 | 未実装 | **Missing** - 視覚的分離が必要 | Medium |

**技術的詳細:**
- `chrome.tabs.onUpdated`でピン状態（`tab.pinned`）を監視
- `TabNode`型に`isPinned: boolean`を追加（または`TabInfo`から取得）
- `TabTreeView`でピン留めタブとそれ以外を分離レンダリング
- 新しい`PinnedTabsSection`コンポーネントの作成

---

### Requirement 13: サイドパネルUIの簡素化

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| ヘッダー削除 | `SidePanelRoot.tsx:103-131行目`にヘッダー表示 | **Missing** - ヘッダー削除（設定ボタンの代替配置が必要） | Medium |
| ナビゲーションボタン非表示 | Chrome Side Panel自体のナビゲーション | **Constraint** - Side Panel APIの制約で制御不可の可能性 | Unknown |
| 表示領域最大化 | ヘッダー、グループセクション、スナップショットセクションが領域を占有 | Partial - 各セクションの整理が必要 | Medium |

**技術的詳細:**
- ヘッダーを削除し、設定ボタンを別の場所（ビュースイッチャー横など）に移動
- `GroupSection`と`SnapshotSection`をよりコンパクトに、または非表示オプション
- Side Panel APIのナビゲーション制御の調査が必要

**Research Needed:**
- Chrome Side Panel APIでのブラウザ組み込みUI制御の可否

---

## 実装アプローチの評価

### Option A: 既存コンポーネントの段階的拡張（推奨）

**対象要件:** 1, 6, 10, 11, 13

**概要:** 既存の`TabTreeView`、`SortableTreeNodeItem`、`SettingsPanel`を拡張

**メリット:**
- 最小限の構造変更
- 既存テストの活用可能
- 実装リスクが低い

**デメリット:**
- 一部コンポーネントの肥大化
- 複雑なprops drilling

**影響ファイル:**
- `src/sidepanel/components/TabTreeView.tsx`
- `src/sidepanel/components/SettingsPanel.tsx`
- `src/sidepanel/providers/TreeStateProvider.tsx`
- `src/types/index.ts`

---

### Option B: 新規コンポーネント作成

**対象要件:** 3, 5, 7, 8, 9, 12

**概要:** 新しいコンポーネント（ビューアイコンボタン、設定ページ、ピン留めセクション等）を作成

**メリット:**
- 既存コンポーネントへの影響が少ない
- 単体テストが容易
- 責務の明確な分離

**デメリット:**
- 新規ファイルの増加
- 統合テストの追加が必要

**新規ファイル（想定）:**
- `src/sidepanel/components/ViewIconButton.tsx`
- `src/sidepanel/components/PinnedTabsSection.tsx`
- `src/sidepanel/components/DropIndicator.tsx`
- `src/sidepanel/components/ViewEditModal.tsx`
- `src/settings/SettingsPage.tsx`（新ディレクトリ）
- `src/sidepanel/hooks/useMultiSelect.ts`
- `src/sidepanel/hooks/useDepthDrop.ts`

---

### Option C: ハイブリッドアプローチ（推奨）

**概要:** 要件の複雑度に応じてOption AとOption Bを組み合わせ

**フェーズ1（基盤整備）:**
- `TabInfo`データの統合（要件1）
- 選択状態管理の追加（要件9の基盤）
- `UserSettings`の拡張（要件6）

**フェーズ2（UI改善）:**
- `ViewSwitcher`の改修（要件3）
- 閉じるボタンの統合（要件10）
- ダークテーマ統一（要件11）

**フェーズ3（新機能）:**
- ドラッグ&ドロップの強化（要件7, 8）
- 複数選択機能（要件9）
- ピン留めタブセクション（要件12）

**フェーズ4（設定とUI整理）:**
- 設定画面の新タブ化（要件5）
- スナップショットUI改善（要件4）
- ヘッダー削除（要件13）

---

## 技術的課題とリサーチ項目

### 高優先度リサーチ

1. **dnd-kit隙間ドロップの実装方法**
   - カスタムコリジョン検出アルゴリズム
   - ドロップインジケーターの配置

2. **マウスX座標からのdepth計算**
   - `onDragMove`イベントの活用
   - インデント幅に基づく閾値設計

3. **Chrome Tab Groups API（Vivaldi互換性）**
   - `chrome.tabGroups`のVivaldiサポート状況
   - ネイティブグループとの統合方針

### 中優先度リサーチ

4. **Chrome Side Panel ナビゲーション制御**
   - ブラウザ組み込みUIの非表示可否

5. **設定ページの分離アーキテクチャ**
   - `manifest.json`でのオプションページ設定
   - サイドパネルと設定ページ間のメッセージング

---

## 工数・リスク評価

| 要件 | 工数 | リスク | 根拠 |
|------|------|--------|------|
| 1. タブ表示改善 | S | Low | 既存`TabInfo`活用、propsの追加のみ |
| 2. グループ統合 | L | High | Chrome API調査・統合方針の決定が必要 |
| 3. ビュー切り替えUI | M | Medium | UI改修とコンテキストメニュー追加 |
| 4. スナップショットUI | S | Low | コンテキストメニュー拡張のみ |
| 5. 設定画面 | M | Medium | 新ページ作成とmanifest変更 |
| 6. 自動保存設定 | S | Low | 既存機能のUI追加 |
| 7. D&Dビジュアル | M | Medium | dnd-kitカスタマイズの調査が必要 |
| 8. depth選択 | L | High | 新規コリジョン検出・UI実装 |
| 9. 複数選択 | M | Medium | 状態管理追加、標準的なパターン |
| 10. 閉じるボタン | S | Low | 既存実装の移植 |
| 11. ダークテーマ | S | Low | CSS調整のみ |
| 12. ピン留めタブ | M | Medium | 新セクション作成と状態管理 |
| 13. UI簡素化 | S | Low | レイアウト変更のみ（ナビ制御除く） |

**工数凡例:** S(1-3日), M(3-7日), L(1-2週間), XL(2週間+)
**リスク凡例:** Low(既知パターン), Medium(調査要), High(アーキテクチャ変更・未知技術)

---

## 設計フェーズへの推奨事項

1. **フェーズ分割の検討**: 13要件を一度に実装するのではなく、3-4フェーズに分割して段階的に実装することを推奨

2. **優先度の高い要件から着手:**
   - 要件1（タブ表示）- ユーザー体験への影響大
   - 要件7-8（ドラッグ&ドロップ）- コア機能の改善
   - 要件9（複数選択）- 効率的なタブ操作

3. **リサーチの事前実施:**
   - dnd-kitの高度な機能（隙間ドロップ、カスタムコリジョン）
   - Chrome Tab Groups APIのVivaldi互換性

4. **既存テストへの影響確認:**
   - UI変更に伴うE2Eテストの修正タスクを計画に含める

5. **要件2（グループ統合）の詳細仕様確認:**
   - 現在の拡張機能独自グループとの関係を明確化
   - Chrome Tab Groups APIの使用要否を決定

---

### Requirement 14: ドラッグ時の横スクロール防止

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| ドラッグ中横スクロール無効化 | 未実装 | **Missing** - ドラッグ開始時に`overflow-x: hidden`適用が必要 | Medium |
| 左右移動でスクロールしない | 未実装 | **Missing** - CSSまたはJS制御が必要 | Medium |
| ドラッグ終了で復元 | 未実装 | **Missing** - ドラッグ終了時にスクロール設定を復元 | Medium |

**技術的詳細:**
- dnd-kitの`onDragStart`/`onDragEnd`イベントでスクロール制御
- `TabTreeView`のラッパー要素に動的クラス適用
- `overflow-x`スタイルの動的切り替え

---

### Requirement 15: ツリービュー外へのドロップによる新規ウィンドウ作成

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| ビュー外ドロップ可能表示 | 未実装 | **Missing** - ドロップゾーンの視覚的フィードバック | Medium |
| 新規ウィンドウ作成 | **対応済み** - `CREATE_WINDOW_WITH_TAB`メッセージハンドラー実装 | OK | - |
| サブツリー移動 | **対応済み** - `CREATE_WINDOW_WITH_SUBTREE`メッセージハンドラー実装 | OK | - |
| タブグループ移動 | 未実装 | **Missing** - グループ対応のメッセージハンドラーが必要 | Low |
| ツリー構造維持 | **対応済み** - `handleMoveSubtreeToWindow`で実装 | OK | - |

**技術的詳細:**
- `CrossWindowDragHandler.tsx`が存在し、一部機能は実装済み
- ツリービュー外へのドロップ検出にはdnd-kitの`onDragEnd`でドロップ位置判定が必要
- ドロップゾーンUIの追加（サイドパネル下部など）

---

### Requirement 16: ドラッグ中のタブ位置固定

| 項目 | 現状 | ギャップ | 優先度 |
|------|------|---------|--------|
| ドラッグ中位置変更しない | **未確認** - dnd-kitのSortableContextはリアルタイム並べ替えを行う | **Unknown** - 挙動確認と調整が必要 | Medium |
| リアルタイム並べ替えなし | **未確認** | **Unknown** - `strategy`オプションの調整が必要か | Medium |
| ドロップ時ツリー再構築 | **対応済み** - `handleDragEnd`でツリー状態を更新 | OK | - |
| インジケーターのみ表示 | 未実装 | **Missing** - ドロップインジケーターコンポーネントが必要 | High |

**技術的詳細:**
- dnd-kitの`SortableContext`はデフォルトで`verticalListSortingStrategy`を使用
- ドラッグ中のリアルタイム並べ替えを無効化するには、カスタム`strategy`またはCSSで対応
- `DragOverlay`コンポーネントでドラッグ中のプレビュー表示
- ドロップインジケーター（水平線など）の実装

**Research Needed:**
- dnd-kitでドラッグ中の並べ替えアニメーションを無効化する方法
- `verticalListSortingStrategy`のカスタマイズ可否

---

## 追加の工数・リスク評価（要件14-16）

| 要件 | 工数 | リスク | 根拠 |
|------|------|--------|------|
| 14. 横スクロール防止 | S | Low | CSS制御とイベントハンドリングのみ |
| 15. ビュー外ドロップ | M | Medium | バックエンド実装済み、UI統合が必要 |
| 16. タブ位置固定 | M | Medium | dnd-kit挙動の調査と調整が必要 |

---

## 次のステップ

1. `/kiro:spec-design tab-tree-ux-improvements` を実行して技術設計を作成
2. 設計フェーズでリサーチ項目（dnd-kit、Chrome API）の詳細調査を実施
3. フェーズ分割と実装順序の決定
