# Gap Analysis: comprehensive-bugfix

## 概要サマリー

- **スコープ**: 17項目のバグ修正とE2Eテストの安定化・追加
- **主な課題**: 既存実装のバグ修正が中心。機能は概ね実装済みで、テスト追加とロジック修正が主な作業
- **推奨アプローチ**: ハイブリッドアプローチ（既存コード修正 + テスト追加）
- **工数見積**: M（3〜7日）
- **リスク**: 低〜中（既存パターンの拡張、テストでカバー可能）

---

## 1. 現状調査

### 1.1 プロジェクト構造

| ディレクトリ | 目的 | 主要ファイル数 |
|-------------|------|--------------|
| `src/background/` | Service Worker（イベント処理、ドラッグ管理） | 5+ |
| `src/sidepanel/components/` | Reactコンポーネント（UI層） | 20+ |
| `src/sidepanel/hooks/` | カスタムフック（D&D、メニュー等） | 5+ |
| `src/sidepanel/providers/` | 状態管理（TreeState、Theme等） | 3+ |
| `src/services/` | ビジネスロジック | 7+ |
| `src/storage/` | 永続化層（chrome.storage ラッパー） | 3+ |
| `e2e/` | PlaywrightによるE2Eテスト | 58+ .spec.ts |
| `e2e/utils/` | テストユーティリティ | 8+ |

### 1.2 既存パターン・規約

- **TypeScript strict mode**: 有効、`any`禁止
- **React 18**: 関数コンポーネント、カスタムフック
- **状態管理**: React Contextによるプロバイダーパターン
- **テスト**: Vitest（単体）、Playwright（E2E）
- **E2Eテスト規約**:
  - ポーリングベース待機（`polling-utils.ts`）
  - 固定時間待機（`waitForTimeout`）禁止
  - `--repeat-each=10`で安定性検証

### 1.3 既存E2Eテストカバレッジ

| 機能領域 | テストファイル | カバレッジ状況 |
|---------|--------------|--------------|
| ドラッグ&ドロップ | 10+ spec.ts | ✓ 充実 |
| クロスウィンドウ | 3 spec.ts | ✓ 充実 |
| タブ永続化 | tab-persistence.spec.ts | ✓ 存在 |
| ファビコン復元 | favicon-restore.spec.ts | ✓ 存在 |
| ビュー機能 | 4+ spec.ts | ✓ 充実 |
| グループ化 | tab-grouping.spec.ts | ✓ 存在 |
| 未読インジケーター | unread-indicator.spec.ts | ✓ 存在 |
| タブ複製 | tab-duplicate.spec.ts | ✓ 存在 |
| 設定 | settings.spec.ts | △ 部分的 |

---

## 2. 要件別フィージビリティ分析

### 要件1: E2Eテストの安定化と品質基準

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | 既存テストの安定性検証、フレーキーテスト特定・修正 |
| **既存資産** | `polling-utils.ts`に豊富なポーリングユーティリティ |
| **ギャップ** | `tab-persistence.spec.ts:201:5`の特定テストの不安定性 |
| **複雑度** | 単純（既存パターンの適用） |

**アクション**: 問題のテストを特定し、ポーリングベース待機に修正

---

### 要件2: サブツリーのドラッグ＆ドロップ移動

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | サブツリー全体の移動ロジック修正 |
| **既存資産** | `useDragDrop.ts`（自前D&D実装）、`drag-drop-*.spec.ts`（10+テスト） |
| **ギャップ** | 下方向ドラッグ時の移動数計算バグの可能性 |
| **複雑度** | 中（サブツリー計算ロジックの調査・修正） |

**関連ファイル**:
- `src/sidepanel/hooks/useDragDrop.ts` - ドラッグロジック
- `src/background/event-handlers.ts` - タブ移動処理
- `e2e/drag-drop-hierarchy.spec.ts` - 既存テスト

---

### 要件3: タブのグループ化機能

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | グループ化時の親タブ生成、子タブ配置 |
| **既存資産** | `GroupManager.ts`、`tab-grouping.spec.ts`、`ContextMenu.tsx` |
| **ギャップ** | グループ化ロジックのバグ調査が必要 |
| **複雑度** | 中（既存実装の修正） |

**関連ファイル**:
- `src/services/GroupManager.ts` - グループ管理サービス
- `src/sidepanel/components/ContextMenu.tsx` - グループ化アクション
- `src/group/GroupPage.tsx` - グループページ

---

### 要件4: クロスウィンドウドラッグ

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | ウィンドウ間でのドラッグ＆ドロップ |
| **既存資産** | `DragSessionManager`、`cross-window-drag-drop.spec.ts` |
| **ギャップ** | ドラッグ中のウィンドウ判定・受け入れロジックの調査 |
| **複雑度** | 高（Service Workerとの連携） |

**関連ファイル**:
- `src/background/drag-session-manager.ts` - セッション管理
- `src/sidepanel/hooks/useCrossWindowDrag.ts` - UIフック
- `src/background/event-handlers.ts` - メッセージハンドリング

---

### 要件5: 空ウィンドウの自動クローズ

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | タブ全移動後のウィンドウ自動クローズ |
| **既存資産** | `empty-window-auto-close.spec.ts`、`event-handlers.ts` |
| **ギャップ** | `onTabRemoved`ハンドラーでのウィンドウクローズ条件の調査 |
| **複雑度** | 低（既存ロジックの修正） |

---

### 要件6: ビューへの新規タブ追加

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | 現在ビューへの新規タブ追加 |
| **既存資産** | `ViewManager.ts`、`view-new-tab.spec.ts`、`TreeStateProvider.tsx` |
| **ギャップ** | 新規タブ作成時のビュー割り当てロジック調査 |
| **複雑度** | 低（既存パターンの修正） |

---

### 要件7: 設定タブのタイトル表示

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | `chrome-extension://[ID]/settings.html`を「設定」と表示 |
| **既存資産** | `TreeNode.tsx`の`SYSTEM_URL_FRIENDLY_NAMES`マッピング |
| **ギャップ** | **E2Eテストなし**、拡張機能URLパターンの追加が必要 |
| **複雑度** | 低（マッピング追加） |

**アクション**:
1. `SYSTEM_URL_FRIENDLY_NAMES`に拡張機能設定ページのパターン追加
2. E2Eテスト新規作成

---

### 要件8: 内部ページのタイトル表示

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | `vivaldi:calendar`等の内部ページにブラウザ同等のタイトル表示 |
| **既存資産** | `TreeNode.tsx`の`getDisplayTitle()`、`start-page-title.spec.ts` |
| **ギャップ** | **E2Eテストなし**、`vivaldi://`パターンの対応拡充 |
| **複雑度** | 低（マッピング追加） |

**アクション**:
1. `SYSTEM_URL_FRIENDLY_NAMES`に`vivaldi://calendar`等を追加
2. E2Eテスト新規作成

---

### 要件9: 未読インジケーターの位置調整

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | depth考慮したインジケーター位置 |
| **既存資産** | `UnreadBadge.tsx`（現在は`left: 0`固定）、`TreeNode.tsx` |
| **ギャップ** | インジケーター位置計算に`depth`を反映する必要 |
| **複雑度** | 低（CSS調整） |

**現状コード分析**:
```tsx
// UnreadBadge.tsx - 現在は左端固定
const triangleStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,  // ← depth考慮が必要
  bottom: 0,
  ...
};
```

**アクション**: `depth`を`UnreadBadge`に渡し、`left`値を動的に計算

---

### 要件10: 新規タブ作成時のツリー展開

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | リンククリックで子タブ作成時、親を自動展開 |
| **既存資産** | `event-handlers.ts`の`onTabCreated`、`TreeStateManager.ts` |
| **ギャップ** | **E2Eテストなし**、親展開ロジックの確認・修正 |
| **複雑度** | 低（既存ロジックの拡張） |

---

### 要件11: ドラッグによる親子関係解消の永続化

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | ドラッグで解消した親子関係が後続操作で復活しない |
| **既存資産** | `TreeStateManager.ts`、`drag-drop-child-independent.spec.ts` |
| **ギャップ** | `openerTabId`による親子復活を防ぐロジック |
| **複雑度** | 中（親子関係の追跡ロジック） |

**要調査**: 元子タブから新規リンクを開いた際の親子関係決定ロジック

---

### 要件12: ファビコンの永続化復元

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | 再起動後のファビコン復元 |
| **既存資産** | `favicon-restore.spec.ts`、`event-handlers.ts`での`tab_favicons`永続化 |
| **ギャップ** | バグの特定が必要（既存テストはパスしている可能性） |
| **複雑度** | 低（既存実装の検証） |

---

### 要件13: ツリー状態の永続化

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | 親子関係・折りたたみ状態の永続化 |
| **既存資産** | `TreeStateManager.ts`、`tab-persistence.spec.ts` |
| **ギャップ** | バグの特定が必要（既存テストの拡充） |
| **複雑度** | 低（既存実装の検証） |

---

### 要件14: タブ複製時の配置

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | 複製タブを兄弟として配置 |
| **既存資産** | `tab-duplicate.spec.ts`、`pendingDuplicateSources` Set |
| **ギャップ** | バグの特定が必要（既存テストはパスしている可能性） |
| **複雑度** | 低（既存実装の検証） |

---

### 要件15: リンクから開いたタブの配置設定

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | 設定に基づくタブ配置（子/兄弟/最後） |
| **既存資産** | `tab-position-settings.spec.ts`、`UserSettings.newTabPositionFromLink` |
| **ギャップ** | 設定が正しく反映されない問題の調査 |
| **複雑度** | 中（設定→ロジック連携の検証） |

**関連ファイル**:
- `src/types/index.ts` - `UserSettings`型定義
- `src/background/event-handlers.ts` - 位置決定ロジック
- `src/settings/SettingsPage.tsx` - 設定UI

---

### 要件16: 不要なバッジ表示の削除

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | 未読子タブのバッジを親に表示しない |
| **既存資産** | `UnreadBadge.tsx`、`UnreadTracker.ts` |
| **ギャップ** | **E2Eテストなし**、親への伝播ロジックの削除 |
| **複雑度** | 低（ロジック削除） |

---

### 要件17: ビューのタブ数表示の視認性向上

| 項目 | 状況 |
|------|------|
| **技術的ニーズ** | タブ数バッジの視認性向上 |
| **既存資産** | `ViewSwitcher.tsx`、`view-tab-count.spec.ts` |
| **ギャップ** | CSSレイアウト調整（バッジ位置・サイズ） |
| **複雑度** | 低（CSS調整） |

**現状コード**:
```tsx
// ViewSwitcher.tsx:228-235
{tabCount > 0 && (
  <span
    className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 ..."
    data-testid={`tab-count-badge-${view.id}`}
  >
    {tabCount}
  </span>
)}
```

**アクション**: バッジの位置を内側に調整、数字が見切れないようmin-width調整

---

## 3. 実装アプローチオプション

### Option A: 既存コード修正のみ（拡張アプローチ）

**対象**: 要件 1, 5, 6, 7, 8, 9, 12, 13, 14, 16, 17

**メリット**:
- ✅ 新規ファイル最小限
- ✅ 既存パターン活用
- ✅ 変更箇所が明確

**デメリット**:
- ❌ 既存コードの複雑化リスク

### Option B: テスト先行（TDD風）

**対象**: 全要件

**メリット**:
- ✅ 要件の明確化
- ✅ リグレッション防止
- ✅ 品質保証

**デメリット**:
- ❌ 初期工数増加

### Option C: ハイブリッド（推奨）

**戦略**:
1. **Phase 1**: E2Eテストの安定化（要件1）
2. **Phase 2**: 簡単な修正（要件7, 8, 9, 16, 17）+ E2Eテスト追加
3. **Phase 3**: 中程度の修正（要件2, 3, 10, 11, 15）+ E2Eテスト追加
4. **Phase 4**: 検証と既存テスト通過確認（要件5, 6, 12, 13, 14）
5. **Phase 5**: 複雑な修正（要件4）

**メリット**:
- ✅ 段階的な品質向上
- ✅ リスク分散
- ✅ 早期フィードバック

---

## 4. 工数・リスク評価

| 要件 | 工数 | リスク | 理由 |
|-----|------|-------|------|
| 1 | S | Low | 既存パターン適用 |
| 2 | M | Medium | サブツリー計算の複雑さ |
| 3 | M | Medium | グループロジックの調査 |
| 4 | M | High | クロスウィンドウ連携の複雑さ |
| 5 | S | Low | 既存ロジック修正 |
| 6 | S | Low | 既存パターン修正 |
| 7 | S | Low | マッピング追加のみ |
| 8 | S | Low | マッピング追加のみ |
| 9 | S | Low | CSS調整 |
| 10 | S | Low | ロジック追加 |
| 11 | M | Medium | 親子関係追跡の複雑さ |
| 12 | S | Low | 既存実装検証 |
| 13 | S | Low | 既存実装検証 |
| 14 | S | Low | 既存実装検証 |
| 15 | M | Medium | 設定連携の調査 |
| 16 | S | Low | ロジック削除 |
| 17 | S | Low | CSS調整 |

**総合評価**:
- **工数**: M（3〜7日）
- **リスク**: 中（未知の依存関係の可能性あるが、テストでカバー可能）

---

## 5. 設計フェーズへの推奨事項

### 推奨アプローチ
**Option C: ハイブリッド**を推奨

### 優先実装順序
1. **要件1**（E2Eテスト安定化）- 他の全要件の基盤
2. **要件7, 8, 9, 16, 17**（低リスク・低工数）- 早期成果
3. **要件10, 11, 15**（中リスク）- 段階的対応
4. **要件2, 3, 5, 6, 12, 13, 14**（バグ調査・修正）
5. **要件4**（高リスク）- 最後に着手

### 調査が必要な項目
- [ ] `tab-persistence.spec.ts:201:5`の不安定テストの原因
- [ ] サブツリー移動時の移動数計算ロジック
- [ ] `openerTabId`による親子関係復活の条件
- [ ] クロスウィンドウドラッグ時のウィンドウ受け入れ判定

### E2Eテスト追加が必要な要件
- 要件7: 設定タブタイトル表示
- 要件8: 内部ページタイトル表示
- 要件10: 新規タブ作成時のツリー展開
- 要件16: 不要なバッジ非表示

---

## 6. 要件-資産マップ

| 要件 | 主要ファイル | 既存テスト | ギャップ |
|-----|------------|----------|---------|
| 1 | e2e/utils/polling-utils.ts | 58 spec.ts | フレーキーテスト特定 |
| 2 | src/sidepanel/hooks/useDragDrop.ts | drag-drop-*.spec.ts | 移動数計算バグ |
| 3 | src/services/GroupManager.ts | tab-grouping.spec.ts | ロジックバグ |
| 4 | src/background/drag-session-manager.ts | cross-window-*.spec.ts | ウィンドウ判定 |
| 5 | src/background/event-handlers.ts | empty-window-auto-close.spec.ts | 条件判定 |
| 6 | src/services/ViewManager.ts | view-new-tab.spec.ts | ビュー割り当て |
| 7 | src/sidepanel/components/TreeNode.tsx | なし | **テスト不足** |
| 8 | src/sidepanel/components/TreeNode.tsx | なし | **テスト不足** |
| 9 | src/sidepanel/components/UnreadBadge.tsx | unread-indicator.spec.ts | depth考慮 |
| 10 | src/background/event-handlers.ts | なし | **テスト不足** |
| 11 | src/services/TreeStateManager.ts | drag-drop-child-independent.spec.ts | 永続化確認 |
| 12 | src/background/event-handlers.ts | favicon-restore.spec.ts | バグ特定 |
| 13 | src/services/TreeStateManager.ts | tab-persistence.spec.ts | バグ特定 |
| 14 | src/background/event-handlers.ts | tab-duplicate.spec.ts | バグ特定 |
| 15 | src/settings/SettingsPage.tsx | tab-position-settings.spec.ts | 設定連携 |
| 16 | src/sidepanel/components/UnreadBadge.tsx | なし | **テスト不足** |
| 17 | src/sidepanel/components/ViewSwitcher.tsx | view-tab-count.spec.ts | CSS調整 |
