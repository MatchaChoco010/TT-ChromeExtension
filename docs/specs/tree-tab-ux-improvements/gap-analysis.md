# ギャップ分析レポート: Tree Tab UX Improvements

## 分析サマリー

- **スコープ**: 21個の要件（ピン留めタブ改善、ドラッグ&ドロップ改善、タブタイトル永続化、ビュー機能強化など）
- **既存実装レベル**: 多くの基盤コンポーネントが存在するため、拡張ベースの実装が可能
- **主な課題**: ピン留めタブの閉じるボタン削除、GroupSectionの構造変更、ポップアップメニューの新規作成
- **推奨アプローチ**: ハイブリッド（既存拡張 + 一部新規作成）
- **工数見積もり**: L（1〜2週間）
- **リスク**: Medium（既存パターンの活用が可能だが、一部UI構造の変更が必要）

---

## 要件と既存実装のマッピング

### Requirement 1: ピン留めタブの動作改善

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 1.1 ピン留めタブに閉じるボタンを表示しない | `PinnedTabsSection.tsx:92-103` - 閉じるボタンが実装されている | **Missing**: 閉じるボタンの削除が必要 |
| 1.2 ピン留めタブをタブツリー一覧に表示しない | `TreeStateProvider.tsx:752-756` - pinnedTabIdsで分離済み | ✅ **Exists** |
| 1.3 ピン留めタブに対する閉じる操作を無効化 | 閉じるボタンとonTabCloseが存在 | **Missing**: 閉じるボタンとハンドラの削除 |
| 1.4 ブラウザAPIでピン留めタブが閉じられた場合の同期 | `TreeStateProvider.tsx` - タブ更新リスナー存在 | ✅ **Partial**: 既存のイベントリスナーで対応可能 |
| 1.5 ピン留めタブ状態の同期 | `TreeStateProvider.tsx:331-358` - onUpdatedリスナー | ✅ **Exists** |
| 1.6 コンテキストメニューに「ピン留めを解除」 | `ContextMenu.tsx:149-165` - pin/unpin存在 | **Missing**: ピン留めタブエリア専用メニューの追加 |
| 1.7 ピン留め解除時の通常タブへの移動 | `useMenuActions.ts` - pinアクション存在 | ✅ **Partial**: chrome.tabs.update APIで対応可能 |

**ギャップ分類**: Constraint（既存UIの変更）

### Requirement 2: 古いタブデータのクリーンアップ

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 2.1 起動時のタブ一覧取得と照合 | `TreeStateManager.ts:226-280` - syncWithChromeTabs | ✅ **Exists** |
| 2.2 存在しないタブの自動削除 | 明示的なクリーンアップなし | **Missing**: 削除ロジックの追加 |
| 2.3 バックグラウンド非同期実行 | Service Worker構造 | ✅ **Exists** |

**ギャップ分類**: Missing（クリーンアップロジックの新規追加）

### Requirement 3: 閉じるボタンの位置改善

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 3.1 閉じるボタンをタブ右端に固定 | `TabTreeView.tsx:252-253` - CloseButtonは末尾に配置 | **Missing**: CSS `flex-shrink-0` と位置調整 |
| 3.2 タイトル長に関係なく右端配置 | 現在のflex構造では相対位置 | **Missing**: `position: absolute` または `margin-left: auto` |
| 3.3 非ホバー時は非表示 | `isHovered && <CloseButton>` | ✅ **Exists** |

**ギャップ分類**: Constraint（CSSスタイル調整）

### Requirement 4: タブタイトルの正確な表示

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 4.1 ロード完了時のタイトル更新 | `TreeStateProvider.tsx:331-358` - onUpdatedリスナー | ✅ **Exists** |
| 4.2 タイトル変更時の即時更新 | 同上 | ✅ **Exists** |
| 4.3 内部URLで「新しいタブ」表示 | なし | **Missing**: URL判定ロジック追加 |
| 4.4 Loading状態表示 | `TabTreeView.tsx:237` - 'Loading...'表示 | ✅ **Exists** |

**ギャップ分類**: Missing（URL判定ロジック）

### Requirement 5: タブタイトルの永続化

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 5.1 タイトルのストレージ永続化 | `TreeState.nodes`にtabId保持、タイトルは未保存 | **Missing**: タイトルの永続化フィールド |
| 5.2 起動時の復元 | なし | **Missing**: 復元ロジック |
| 5.3 再読み込み時の上書き | なし | **Missing**: 更新ロジック |
| 5.4 閉じた際のデータ削除 | `TreeStateManager.removeTab` | ✅ **Partial**: 拡張で対応可能 |

**ギャップ分類**: Missing（新しいストレージスキーマ）

### Requirement 6: 新規ウィンドウドロップエリアの削除

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 6.1 専用領域を表示しない | `ExternalDropZone.tsx` - 専用コンポーネント存在 | **Missing**: コンポーネント削除 |
| 6.2 ツリー外ドロップで新ウィンドウ | `useExternalDrop.ts` | **Missing**: ドロップ検出ロジック変更 |

**ギャップ分類**: Constraint（既存UI削除＋ロジック変更）

### Requirement 7: ドラッグ時のスクロール制御

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 7.1 スクロール範囲をコンテンツ範囲に制限 | なし | **Missing**: スクロール制限ロジック |
| 7.2 本来の範囲を超えるスクロール防止 | なし | **Missing**: 同上 |

**ギャップ分類**: Missing（新規ロジック）

### Requirement 8: ドロップ判定領域の改善

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 8.1 上下25%を兄弟挿入ゾーン | `GapDropDetection.ts:63` - DEFAULT_GAP_THRESHOLD_RATIO = 0.25 | ✅ **Exists** |
| 8.2 中央50%を子追加ゾーン | 同上 | ✅ **Exists** |
| 8.3 上部ドロップで上に兄弟挿入 | `GapDropDetection.ts:121-131` | ✅ **Exists** |
| 8.4 下部ドロップで下に兄弟挿入 | `GapDropDetection.ts:134-144` | ✅ **Exists** |

**ギャップ分類**: ✅ **Exists（実装済み）**

### Requirement 9: スクロールバーの改善

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 9.1 レイアウトシフト防止 | なし | **Missing**: `scrollbar-gutter: stable` CSS |
| 9.2 ダークモード対応 | Tailwind CSS使用 | **Missing**: カスタムスクロールバースタイル |
| 9.3 オーバーレイスタイル | なし | **Missing**: `overflow: overlay` CSS |

**ギャップ分類**: Missing（CSSスタイル追加）

### Requirement 10: タブグループの仕様変更

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 10.1 「Groups」セクションを非表示 | `GroupSection.tsx` - 独立セクションとして存在 | **Missing**: コンポーネント削除/変更 |
| 10.2 グループ用親タブをツリー内に作成 | グループはセクション外で管理 | **Missing**: TreeNode内グループ表示 |
| 10.3 グループ内タブを子要素表示 | groupIdフィールド存在 | **Missing**: レンダリングロジック変更 |

**ギャップ分類**: Constraint（大規模UI構造変更）

### Requirement 11: テキスト選択の無効化

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 11.1 タブ要素内テキスト選択無効化 | なし | **Missing**: `user-select: none` CSS |
| 11.2 コンテキストメニュー内選択無効化 | なし | **Missing**: 同上 |
| 11.3 Shift+クリック時の選択防止 | なし | **Missing**: `preventDefault` または CSS |

**ギャップ分類**: Missing（CSSスタイル追加）

### Requirement 12: 複数タブのグループ化機能

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 12.1 コンテキストメニューから「グループ化」 | `ContextMenu.tsx:189-197` - group存在 | ✅ **Exists** |
| 12.2 選択タブを新グループの子に移動 | `useMenuActions.ts` | **Missing**: 複数タブグループ化ロジック |
| 12.3 ツリーへの親子関係反映 | groupIdフィールド存在 | **Missing**: Req10と連動 |

**ギャップ分類**: Constraint（Req10と連動）

### Requirement 13: 起動時の未読バッジ制御

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 13.1 起動時に既存タブに未読バッジ非表示 | `event-handlers.ts:119-121` - 非アクティブタブを未読マーク | **Missing**: 起動フラグによる制御 |
| 13.2 起動後の新タブに未読バッジ表示 | 同上 | **Missing**: 起動完了後フラグ |
| 13.3 起動完了後タブの識別 | なし | **Missing**: 起動状態管理 |

**ギャップ分類**: Missing（起動状態フラグ追加）

### Requirement 14: ドラッグ中のタブサイズ安定化

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 14.1 ドラッグ中の他タブサイズ維持 | `TabTreeView.tsx:132-141` - transform制御 | ✅ **Partial** |
| 14.2 ホバー時サイズ変更防止 | なし | **Missing**: ホバーイベント無効化 |
| 14.3 レイアウト維持 | `globalIsDragging`フラグ存在 | ✅ **Partial** |

**ギャップ分類**: Constraint（イベントハンドラ調整）

### Requirement 15: ビュー切り替えの修正

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 15.1 現在ビューへの新タブ追加 | `event-handlers.ts:115` - DEFAULT_VIEW_ID固定 | **Missing**: currentViewId連携 |
| 15.2 ビュー追加時の永続化 | `TreeStateProvider.tsx:419-434` | ✅ **Exists** |
| 15.3 ビュー状態の正しい管理 | TreeStateで管理 | ✅ **Exists** |

**ギャップ分類**: Missing（Background-UI間連携）

### Requirement 16: ビューのスクロール切り替え

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 16.1 上スクロールで前ビュー | なし | **Missing**: wheelイベントハンドラ |
| 16.2 下スクロールで次ビュー | なし | **Missing**: 同上 |
| 16.3 端でループしない | なし | **Missing**: 境界チェック |

**ギャップ分類**: Missing（新規イベントハンドラ）

### Requirement 17: ビューのタブ数表示

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 17.1 ファビコン上にタブ数表示 | なし | **Missing**: バッジUI追加 |
| 17.2 ファビコンサイズ維持 | ViewSwitcherで32x32px | ✅ **Exists** |
| 17.3 タブ数変化時の即時更新 | TreeState連携で可能 | ✅ **Partial** |

**ギャップ分類**: Missing（バッジUI追加）

### Requirement 18: コンテキストメニューからビュー移動

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 18.1 「別のビューへ移動」サブメニュー | `ContextMenu.tsx` - サブメニューなし | **Missing**: サブメニュー実装 |
| 18.2 全ビュー（現在除く）のリスト | なし | **Missing**: ビュー一覧取得 |
| 18.3 選択タブ（複数含む）の移動 | なし | **Missing**: moveToView機能 |

**ギャップ分類**: Missing（新規メニュー機能）

### Requirement 19: ビューのカスタムアイコン

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 19.1 ライセンス準拠アイコンセット同梱 | なし | **Missing**: アイコンアセット |
| 19.2 アイコン選択UI | `ViewEditModal.tsx` - 名前/色のみ | **Missing**: アイコンピッカーUI |
| 19.3 カテゴリ別アイコン提供 | なし | **Missing**: アイコンデータ構造 |
| 19.4 カスタムアイコンの永続化 | `View.icon`フィールド存在 | ✅ **Partial** |

**ギャップ分類**: Missing（新規UI + アセット）

### Requirement 20: 設定ボタンの配置変更

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 20.1 サイドパネルに設定ボタン非表示 | `OpenSettingsButton.tsx`が存在 | **Missing**: 削除 |
| 20.2 ツールバーアイコンでポップアップ表示 | `service-worker.ts:94-101` - タブを開く | **Missing**: ポップアップ実装 |
| 20.3 ポップアップに「設定を開く」 | なし | **Missing**: popup.html/Popup.tsx |
| 20.4 設定ページを開く | chrome.runtime.openOptionsPage存在 | ✅ **Partial** |

**ギャップ分類**: Missing（新規ポップアップUI）

### Requirement 21: ポップアップメニューからのスナップショット取得

| 受入条件 | 既存実装 | ギャップ |
|---------|---------|---------|
| 21.1 ポップアップに「スナップショット取得」 | なし（Req20と同様） | **Missing**: ポップアップUI |
| 21.2 スナップショット取得実行 | `SnapshotManager.ts` | ✅ **Exists** |
| 21.3 完了通知 | なし | **Missing**: 通知UI/API |

**ギャップ分類**: Missing（Req20に依存）

---

## 実装アプローチの選択肢

### Option A: 既存コンポーネント拡張

**対象要件**: 1, 2, 3, 4, 5, 7, 9, 11, 13, 14, 15, 16, 17

**メリット**:
- 既存のファイル構造・パターンを活用
- テストの既存フレームワーク活用
- 学習コストが低い

**デメリット**:
- 一部コンポーネントが肥大化する可能性
- 既存ロジックとの整合性確認が必要

### Option B: 新規コンポーネント作成

**対象要件**: 6, 10, 18, 19, 20, 21

**メリット**:
- 責務の明確な分離
- 既存コードへの影響最小化
- 独立したテストが可能

**デメリット**:
- 新規ファイル増加
- 統合テストの追加が必要

### Option C: ハイブリッドアプローチ（推奨）

**既存拡張**:
- Requirement 1, 2, 3, 4, 5: PinnedTabsSection, TreeStateManager, TabTreeView, TreeStateProvider
- Requirement 7, 9, 11: CSSスタイル追加
- Requirement 13, 14, 15, 16, 17: event-handlers, ViewSwitcher

**新規作成**:
- Requirement 6: ExternalDropZone削除、ドロップ検出をTabTreeViewに統合
- Requirement 10, 12: GroupSection削除、GroupNodeをTreeNode内に統合
- Requirement 18: ContextMenuにサブメニュー機能追加
- Requirement 19: IconPickerModal新規作成
- Requirement 20, 21: src/popup/新規ディレクトリ、Popup.tsx作成

---

## 複雑度とリスク評価

| 要件カテゴリ | 工数 | リスク | 根拠 |
|-------------|------|--------|------|
| ピン留めタブ改善 (Req 1) | S | Low | 既存UIの部分削除・変更 |
| クリーンアップ (Req 2) | S | Low | 既存syncWithChromeTabsの拡張 |
| UI調整 (Req 3, 9, 11) | S | Low | CSS変更のみ |
| タイトル表示改善 (Req 4, 5) | M | Low | ストレージスキーマ拡張 |
| ドラッグ改善 (Req 6, 7, 8, 14) | M | Medium | 既存ドラッグロジック変更 |
| グループ構造変更 (Req 10, 12) | L | High | UI構造の大幅変更 |
| 未読バッジ制御 (Req 13) | S | Low | フラグ追加のみ |
| ビュー機能強化 (Req 15-18) | M | Medium | Background-UI連携必要 |
| カスタムアイコン (Req 19) | M | Medium | 新規UIとアセット管理 |
| ポップアップ (Req 20, 21) | M | Medium | 新規エントリーポイント |

**全体工数**: L（1〜2週間）
**全体リスク**: Medium

---

## 設計フェーズへの推奨事項

### 優先的に調査が必要な項目

1. **Requirement 10 (タブグループ構造変更)**
   - 現在のGroupSectionをどこまで再利用できるか
   - TreeNode内にグループ親ノードをどう表現するか

2. **Requirement 20, 21 (ポップアップメニュー)**
   - manifest.json `action.default_popup` の追加
   - ポップアップとService Worker間の通信設計

3. **Requirement 19 (カスタムアイコン)**
   - 使用するアイコンセットの選定（Lucide, Heroicons等）
   - ライセンス確認

### リサーチアイテム

1. **dnd-kitのスクロール制限API** - Req 7対応
2. **Chrome Extension Popup Best Practices** - Req 20, 21対応
3. **OSSアイコンライブラリの比較** - Req 19対応

---

## 次のステップ

1. **要件の承認**: 現在の要件が「generated」状態のため、承認が必要
2. **設計フェーズ**: `/kiro:spec-design tree-tab-ux-improvements` を実行
3. **優先度決定**: 21要件の実装順序を決定（依存関係考慮）
