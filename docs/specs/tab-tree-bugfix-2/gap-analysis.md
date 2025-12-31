# ギャップ分析レポート

## 概要

本レポートは、Vivaldi-TT拡張機能のバグ修正仕様（tab-tree-bugfix-2）について、requirements.mdの17要件に対する既存コードベースとのギャップを分析した結果です。

---

## 分析サマリー

- **対象要件数**: 18件（Requirement 1〜18）
- **主要な修正対象**: UIコンポーネント、Service Worker、E2Eテスト
- **推定工数**: M〜L（1〜2週間）
- **リスク**: 中程度（多数のバグ修正だが、既存パターンの範囲内）

### 主要な課題

1. **グループ化機能が未実装**: `GroupManager.ts`はスタブ実装のみ
2. **クロスウィンドウドラッグ**: 一部実装済みだが、UI側の受信処理が不完全
3. **E2Eテストの安定化**: フレーキーテストの根本原因調査が必要
4. **設定反映の不整合**: 新規タブ位置設定の反映に問題あり

---

## 要件別ギャップ分析

### Requirement 1: E2Eテストの安定化

| 項目 | 内容 |
|------|------|
| **現状** | `tab-persistence.spec.ts:201:5`でフレーキーテスト発生 |
| **ギャップ** | タイトル永続化のデバウンスタイミング問題の可能性 |
| **関連ファイル** | `e2e/tab-persistence.spec.ts`、`e2e/utils/polling-utils.ts` |
| **アプローチ** | Option A: 既存テストの修正（ポーリング条件の見直し） |
| **工数** | S（1〜3日） |
| **リスク** | 低 |

---

### Requirement 2: タブ間ドロップ位置の修正

| 項目 | 内容 |
|------|------|
| **現状** | `GapDropDetection`モジュール、`handleDragEnd`で隙間処理実装済み |
| **ギャップ** | ブラウザタブ順序の同期精度、ドロップ位置計算の検証が必要 |
| **関連ファイル** | `src/sidepanel/components/TabTreeView.tsx:1080-1105` |
| **アプローチ** | Option A: 既存実装の修正 |
| **工数** | S〜M（1〜5日） |
| **リスク** | 中（dnd-kitとの相互作用） |

**調査結果**:
- `calculateDropTarget`関数で隙間位置を計算
- `DropTargetType.Gap`時に`gapIndex`を使用して配置
- E2Eテスト（`gap-drop-accuracy.spec.ts`）が存在

---

### Requirement 3: ドラッグ時スクロール制限

| 項目 | 内容 |
|------|------|
| **現状** | `AUTO_SCROLL_CONFIG`で制御、加速度3に制限済み |
| **ギャップ** | スクロール可能範囲の物理的制限が未実装 |
| **関連ファイル** | `src/sidepanel/components/TabTreeView.tsx:42-56` |
| **アプローチ** | Option A: 既存設定の拡張 |
| **工数** | S（1〜3日） |
| **リスク** | 中（dnd-kitのカスタマイズ） |

**現在の設定**:
```typescript
const AUTO_SCROLL_CONFIG = {
  threshold: { x: 0, y: 0.15 },
  acceleration: 3,
  interval: 15,
  layoutShiftCompensation: false,
};
```

**必要な修正**:
- コンテンツ高さとコンテナ高さの比較によるスクロール上限設定

---

### Requirement 4: ドラッグアウト判定の修正

| 項目 | 内容 |
|------|------|
| **現状** | `isOutsideTreeRef`で外部ドロップを検出 |
| **ギャップ** | サイドパネル外とツリー下部空白の区別が不十分 |
| **関連ファイル** | `src/sidepanel/components/TabTreeView.tsx:920, 1042` |
| **アプローチ** | Option A: 境界判定ロジックの修正 |
| **工数** | S〜M（1〜5日） |
| **リスク** | 中 |

**問題点**:
- ツリー下部の空白領域がドラッグアウトとして判定されている
- サイドパネルの境界を基準とすべき

---

### Requirement 5: タブグループ化機能の修正

| 項目 | 内容 |
|------|------|
| **現状** | `GroupManager.ts`はスタブ実装のみ |
| **ギャップ** | グループタブ作成、親子関係確立が未実装、拡張機能専用ページの作成が必要 |
| **関連ファイル** | `src/services/GroupManager.ts`、`src/background/event-handlers.ts:357-361`、`manifest.json` |
| **アプローチ** | Option B: 新規実装（拡張機能専用ページを含む） |
| **工数** | M〜L（3〜10日） |
| **リスク** | 高（複雑な機能、新規ページ作成） |

**ギャップ詳細**:
```typescript
// GroupManager.ts - 現在はスタブ
async createGroup(_tabIds: number[], name: string, color: string): Promise<Group>
// _tabIds が未使用（スタブ）
```

**要件追加（AC 3-5）**:
- グループタブは`chrome-extension://`スキームのURLで作成すること
- グループ管理用のUIを表示する拡張機能専用ページであること
- E2EテストでグループタブのURLが拡張機能専用ページであることを検証すること

**必要な実装**:
1. **グループタブ用の拡張機能専用ページ作成**
   - `src/group-tab/` ディレクトリを新規作成
   - `group-tab.html`、`GroupTabPage.tsx` を作成
   - `manifest.json` に専用ページを登録
2. グループタブ（`chrome-extension://[ext-id]/group-tab.html`）の作成
3. 選択タブを子タブとして配置
4. ツリー構造の更新
5. E2E検証（URLスキーム、親子関係）

---

### Requirement 6: クロスウィンドウドラッグの実装

| 項目 | 内容 |
|------|------|
| **現状** | `dragState`グローバル変数、メッセージングが一部実装済み |
| **ギャップ** | UI側でのドラッグ受信ハンドラが不完全 |
| **関連ファイル** | `src/background/event-handlers.ts:28`、`e2e/cross-window-drag-drop.spec.ts` |
| **アプローチ** | Option A: 既存実装の拡張 |
| **工数** | M（3〜7日） |
| **リスク** | 高（複数ウィンドウ間の同期） |

**既存実装**:
- `SET_DRAG_STATE`メッセージで他ウィンドウとドラッグ状態共有
- `GET_DRAG_STATE`で状態取得
- `CLEAR_DRAG_STATE`で状態クリア

---

### Requirement 7: 空ウィンドウの自動クローズ

| 項目 | 内容 |
|------|------|
| **現状** | 未実装 |
| **ギャップ** | タブが0になった時の自動クローズロジックがない |
| **関連ファイル** | `src/background/event-handlers.ts`（`handleTabRemoved`） |
| **アプローチ** | Option B: 新規実装 |
| **工数** | S（1〜3日） |
| **リスク** | 低 |

**必要な実装**:
- ドラッグアウト後にソースウィンドウのタブ数をチェック
- タブ数が0の場合、`chrome.windows.remove()`を呼び出し

---

### Requirement 8: 新規タブボタンの簡素化

| 項目 | 内容 |
|------|------|
| **現状** | 「+」アイコンと「新規タブ」テキストが表示 |
| **ギャップ** | テキストラベルが不要 |
| **関連ファイル** | `src/sidepanel/components/NewTabButton.tsx:55-56` |
| **アプローチ** | Option A: 1行削除 |
| **工数** | S（数時間） |
| **リスク** | 低 |

**現在の実装**:
```tsx
<span className="mr-2 text-lg">+</span>
<span className="text-sm">新規タブ</span>  // 削除対象
```

---

### Requirement 9: ビューアイコン選択の即時反映

| 項目 | 内容 |
|------|------|
| **現状** | `IconPicker.tsx`で`onSelect`コールバック実装済み |
| **ギャップ** | 選択時の即時反映が不完全、ツリービューパネルでの更新問題 |
| **関連ファイル** | `src/sidepanel/components/IconPicker.tsx` |
| **アプローチ** | Option A: 既存実装の修正 |
| **工数** | S（1〜3日） |
| **リスク** | 低 |

---

### Requirement 10: ビューへの新規タブ追加

| 項目 | 内容 |
|------|------|
| **現状** | `getCurrentViewId()`実装済み、`handleTabCreated`で割り当て |
| **ギャップ** | 新規タブボタンクリック時にビューが閉じる問題 |
| **関連ファイル** | `src/background/event-handlers.ts:109-115, 139-142` |
| **アプローチ** | Option A: 既存実装の修正 |
| **工数** | S〜M（1〜5日） |
| **リスク** | 中 |

**問題点**:
- `NewTabButton`から作成時に`currentViewId`が保持されない
- `openerTabId`がないため手動タブ扱いになる

---

### Requirement 11: 新規タブのタイトル修正

| 項目 | 内容 |
|------|------|
| **現状** | タイトル永続化機能は実装済み |
| **ギャップ** | Vivaldiスタートページのタイトル（「スタートページ」）の設定 |
| **関連ファイル** | `src/services/TitlePersistenceService.ts` |
| **アプローチ** | Option A: 設定値の修正 |
| **工数** | S（数時間） |
| **リスク** | 低 |

---

### Requirement 12: 新規タブURLのVivaldiスタートページ対応

| 項目 | 内容 |
|------|------|
| **現状** | `chrome.tabs.create()`にURL未指定 |
| **ギャップ** | VivaldiスタートページURLの指定が必要 |
| **関連ファイル** | `src/sidepanel/components/NewTabButton.tsx:34-36` |
| **アプローチ** | Option A: URL追加 |
| **工数** | S（数時間） |
| **リスク** | 低 |

**現在**:
```typescript
await chrome.tabs.create({
  active: true,
});
```

**修正後**:
```typescript
await chrome.tabs.create({
  url: 'chrome://vivaldi-webui/startpage?section=Speed-dials&background-color=#2e2f37',
  active: true,
});
```

---

### Requirement 13: 未読インジケーター位置の修正

| 項目 | 内容 |
|------|------|
| **現状** | `ml-2`で左マージン設定、フレックスレイアウト |
| **ギャップ** | タイトルが短い場合に右端に固定されない |
| **関連ファイル** | `src/sidepanel/components/UnreadBadge.tsx:43-45` |
| **アプローチ** | Option A: CSSの修正（position: absolute等） |
| **工数** | S（1〜3日） |
| **リスク** | 低 |

---

### Requirement 14: ファビコンの永続化復元

| 項目 | 内容 |
|------|------|
| **現状** | `tab_favicons`ストレージキーで保存、`TreeNode.tsx`で表示 |
| **ギャップ** | ブラウザ起動時の復元タイミングに問題の可能性 |
| **関連ファイル** | `src/sidepanel/components/TreeNode.tsx:214-217`、永続化サービス |
| **アプローチ** | Option A: 復元タイミングの修正 |
| **工数** | S〜M（1〜5日） |
| **リスク** | 中 |

---

### Requirement 15: 選択状態の自動解除

| 項目 | 内容 |
|------|------|
| **現状** | 複数選択機能実装済み、操作後のクリアロジックなし |
| **ギャップ** | 各種操作後の選択状態クリアが未実装 |
| **関連ファイル** | 選択状態管理コンポーネント（SidePanelRoot等） |
| **アプローチ** | Option A: イベントハンドラへのクリア処理追加 |
| **工数** | S（1〜3日） |
| **リスク** | 低 |

---

### Requirement 16: タブ複製時の配置修正

| 項目 | 内容 |
|------|------|
| **現状** | タブ複製機能の詳細実装が不明 |
| **ギャップ** | 複製時に兄弟タブとして配置するロジックが必要 |
| **関連ファイル** | `src/sidepanel/hooks/useMenuActions.ts`、コンテキストメニュー |
| **アプローチ** | Option A: 既存複製機能の修正 |
| **工数** | S〜M（1〜5日） |
| **リスク** | 中 |

---

### Requirement 17: 新規タブ位置設定の修正

| 項目 | 内容 |
|------|------|
| **現状** | `newTabPositionFromLink`、`newTabPositionManual`実装済み |
| **ギャップ** | 設定画面の整理、設定反映の確実性 |
| **関連ファイル** | `src/background/event-handlers.ts:100-116`、`src/settings/` |
| **アプローチ** | Option A: 既存実装の修正・テスト拡充 |
| **工数** | M（3〜7日） |
| **リスク** | 中 |

**必要な作業**:
1. 「デフォルト」設定の削除確認
2. リンククリック、手動作成の区別確認
3. E2Eテストの拡充

---

### Requirement 18: E2Eテスト品質基準

| 項目 | 内容 |
|------|------|
| **現状** | ポーリングユーティリティ実装済み |
| **ギャップ** | 新規テストの`--repeat-each=10`検証が必要 |
| **関連ファイル** | `e2e/utils/polling-utils.ts`、各E2Eテストファイル |
| **アプローチ** | 各要件のE2Eテスト作成時に適用 |
| **工数** | 各要件に含まれる |
| **リスク** | 低 |

---

## 要件-アセットマップ

| 要件 | 主要ファイル | ギャップ | 状態 |
|------|------------|---------|------|
| Req 1 | e2e/tab-persistence.spec.ts | ポーリング条件 | 修正 |
| Req 2 | TabTreeView.tsx | ドロップ位置計算 | 修正 |
| Req 3 | TabTreeView.tsx | スクロール制限 | 修正 |
| Req 4 | TabTreeView.tsx | 境界判定 | 修正 |
| Req 5 | GroupManager.ts, manifest.json, src/group-tab/ | グループ作成、拡張機能専用ページ | 未実装 |
| Req 6 | event-handlers.ts | UI受信処理 | 不完全 |
| Req 7 | event-handlers.ts | 自動クローズ | 未実装 |
| Req 8 | NewTabButton.tsx | テキスト削除 | 修正 |
| Req 9 | IconPicker.tsx | 即時反映 | 修正 |
| Req 10 | event-handlers.ts | ビュー維持 | 修正 |
| Req 11 | NewTabButton.tsx | タイトル設定 | 修正 |
| Req 12 | NewTabButton.tsx | URL設定 | 修正 |
| Req 13 | UnreadBadge.tsx | 位置固定 | 修正 |
| Req 14 | TreeNode.tsx | 復元タイミング | 修正 |
| Req 15 | 選択状態管理 | クリア処理 | 未実装 |
| Req 16 | useMenuActions.ts | 複製配置 | 修正 |
| Req 17 | settings/, event-handlers.ts | 設定反映 | 修正 |
| Req 18 | e2e/*.spec.ts | 品質基準適用 | 継続 |

---

## 実装アプローチの推奨

### Option A: 既存コンポーネントの拡張（推奨）
**対象**: Requirement 1-4, 8-17

大部分の要件は既存のコードベースパターンを踏襲して修正可能。

**利点**:
- 既存パターンの活用で実装速度向上
- テストカバレッジの維持が容易
- リスクが低い

**注意点**:
- 各修正が他機能に影響しないか確認が必要

### Option B: 新規実装
**対象**: Requirement 5（グループ化）、Requirement 7（空ウィンドウ自動クローズ）

これらは新規ロジックの追加が必要。

**利点**:
- 明確な責務分離
- テストしやすい

**注意点**:
- グループ化機能は複雑で、設計フェーズでの詳細検討が必要

---

## 工数・リスク概要

| カテゴリ | 工数 | リスク | 備考 |
|---------|------|--------|------|
| 簡単な修正（Req 8, 11, 12） | S | 低 | 数時間〜1日 |
| テスト修正（Req 1, 18） | S | 低 | ポーリング調整 |
| UI修正（Req 9, 13, 15） | S | 低 | CSS/ロジック修正 |
| ドラッグ関連（Req 2, 3, 4） | S〜M | 中 | dnd-kit連携 |
| 設定・ビュー（Req 10, 17） | M | 中 | 複数ファイル修正 |
| 永続化（Req 14） | S〜M | 中 | タイミング調整 |
| タブ操作（Req 16） | S〜M | 中 | ツリー構造変更 |
| クロスウィンドウ（Req 6） | M | 高 | 複数ウィンドウ同期 |
| グループ化（Req 5） | M〜L | 高 | 新規実装 |
| 空ウィンドウ（Req 7） | S | 低 | シンプルな追加 |

**総工数見積**: M〜L（1〜2週間）

---

## 設計フェーズへの引き継ぎ事項

### 要調査項目

1. **グループ化機能の詳細設計**
   - グループタブは拡張機能専用ページ（`chrome-extension://`スキーム）として作成
   - `src/group-tab/` ディレクトリ構成とReactコンポーネント設計
   - グループ管理UIの機能範囲（グループ名編集、色設定、子タブ一覧表示など）
   - `manifest.json` への登録方法
   - ツリー構造での親子関係管理方法

2. **クロスウィンドウドラッグのUI実装**
   - ホバー検出とウィンドウアクティベーションのタイミング
   - ドラッグ状態の同期方法

3. **dnd-kitのスクロール制限**
   - カスタムスクロール関数の実装方法
   - 既存設定との整合性

### 設計上の決定事項

1. **Vivaldiスタートページ**: URL決め打ち vs 動的取得
2. **選択状態クリア**: 全操作でクリアか、特定操作のみか
3. **空ウィンドウクローズ**: 確認ダイアログの有無

---

## 次のステップ

1. `/kiro:spec-design tab-tree-bugfix-2` で技術設計書を作成
2. 設計レビュー後、`/kiro:spec-tasks tab-tree-bugfix-2` でタスク生成
3. 実装フェーズへ進行
