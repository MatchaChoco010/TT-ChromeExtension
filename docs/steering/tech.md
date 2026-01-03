# Technology Stack

## Architecture

Chrome Extension Manifest V3アーキテクチャ。Service WorkerとSide Panelで構成。

## Core Technologies

- **Language**: TypeScript 5.5+ (strict mode)
- **Framework**: React 18
- **Runtime**: Chrome Extensions API (Manifest V3)
- **Build Tool**: Vite 5 + @crxjs/vite-plugin
- **Styling**: Tailwind CSS 3

## Key Libraries

- **自前D&D実装**: useDragDrop, useAutoScroll, DragOverlay
- **React Testing Library + Vitest**: コンポーネントテスト
- **Playwright**: Chrome拡張機能のE2Eテスト
- **fake-indexeddb**: ストレージテスト用モック

---

## Development Standards

### Agent Parallelization（必須）

作業並列化のためにサブエージェント（Taskツール）を起動する場合、**そのエージェントにもステアリングドキュメントを読ませること**。プロンプトに以下を含める：

```
まず docs/steering/ 配下のステアリングドキュメント（product.md, structure.md, tech.md）を読んでから作業を開始すること。
```

これにより、すべてのエージェントがプロジェクトの規約・構造・技術スタックを理解した上で作業できる。

### Type Safety（必須）

- TypeScript strict mode有効
- **型エラーゼロは必須**: `npm run type-check`がエラーなしで通過すること
- **`any`の使用禁止**: 外部ライブラリの型定義が`any`を使用している場合のみ許容

### Code Quality

- **ESLint + Prettier**: 自動フォーマット
- **コマンド**: `npm run lint`, `npm run lint:fix`

### コメント規約（必須）

**禁止**: タスク番号、Requirements番号、作業中メモ（TODO, FIXME, WIPに限らない）、デバッグログの放置、最終的なコードのコメントではなく既に消えた過去のコードとの比較に関するコメント

```typescript
// ❌ 禁止
// Task 13.1: ウィンドウID対応
// ピン留めタブは通常タブと別管理するため除外する形に変更する

// ✅ 許可: 仕様・理由の説明
// ピン留めタブは通常タブと別管理するため除外
```

### Error Handling（シンプルさ優先）

保守性を最優先。ほとんど発生しない競合状態や異常系に対して複雑なロジックを追加しない。

### リファクタリング規約（必須）

**原則: 修正量を減らすために「あるべきコードの姿」を歪めてはならない**

リファクタリングの目的は、コードを正しい状態にすることである。修正箇所が多くなることを理由に、中途半端な状態や互換性のための回避策を残すことは絶対に禁止する。修正の手間を惜しまず、技術的負債ゼロを維持すること。

**禁止される判断パターン**:
- 「修正箇所が多いから」という理由で本来不要な互換性レイヤーを追加する
- 「既存コードを壊さないため」という理由で古い構造やAPIを残す
- 「後で直す」という前提で問題を先送りにする
- 問題を解決するためのリファクタなのに、その問題を部分的に残す

**具体例**（これらは一例であり、同様の判断はすべて禁止）:
- 関数を別ファイルに移動する際、元の場所から再エクスポートして既存のインポートを維持する → 全インポート箇所を修正すべき
- 変数名を変更する際、古い名前のエイリアスを残す → 全使用箇所を修正すべき
- 型定義を変更する際、古い型との互換性のためにunion型にする → 全使用箇所を新しい型に移行すべき

---

## E2Eテスト規約（最重要）

### 事後条件確認の鉄則（絶対遵守）

**各タブ操作の直後に毎回`assertTabStructure`等のassert系関数を呼ぶこと。まとめて呼ぶのは禁止。例外はない。**

以下のタブ操作関数の直後には必ずassert系関数（`assertTabStructure`, `assertPinnedTabStructure`, `assertWindowExists`等）を呼ぶ:

| タブ操作関数 | 必須assert |
|-------------|-----------|
| `createTab` | `assertTabStructure` |
| `closeTab` | `assertTabStructure` |
| `moveTabToWindow` | `assertTabStructure`（移動元・移動先両ウィンドウ） |
| `reorderTabs` | `assertTabStructure` |
| `moveTabToParent` | `assertTabStructure` |
| `dragOutside` | `assertTabStructure` + `assertWindowExists`/`assertWindowCount` |
| `moveTabToRoot` | `assertTabStructure` |
| `pinTab` | `assertTabStructure` + `assertPinnedTabStructure` |
| `unpinTab` | `assertTabStructure` + `assertPinnedTabStructure` |
| `activateTab` | `assertTabStructure` |
| `startCrossWindowDrag` | `assertTabStructure`（ドラッグ元ウィンドウ） |
| `triggerCrossWindowDragEnter` | `assertTabStructure`（移動元・移動先両ウィンドウ） |
| `completeCrossWindowDrop` | `assertTabStructure`（移動元・移動先両ウィンドウ） |
| その他タブ操作系関数 | `assertTabStructure`（該当する場合は他のassert系も併用） |

**違反パターンの検出方法**: 上記関数の呼び出し行を検索し、直後の行にassert系関数がなければ違反

```typescript
// ✅ 正しい: 各タブ操作の直後に毎回assertTabStructure
const tab1 = await createTab(extensionContext, 'about:blank');
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: pseudoSidePanelTabId, depth: 0 },
  { tabId: tab1, depth: 0 },
], 0);

const tab2 = await createTab(extensionContext, 'about:blank');
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: pseudoSidePanelTabId, depth: 0 },
  { tabId: tab1, depth: 0 },
  { tabId: tab2, depth: 0 },
], 0);

await moveTabToParent(sidePanelPage, tab2, tab1, serviceWorker);
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: pseudoSidePanelTabId, depth: 0 },
  { tabId: tab1, depth: 0 },
  { tabId: tab2, depth: 1 },
], 0);

await closeTab(extensionContext, tab2);
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: pseudoSidePanelTabId, depth: 0 },
  { tabId: tab1, depth: 0 },
], 0);

// ❌ 禁止: 複数のタブ操作後にまとめてassertTabStructure
const tabA = await createTab(extensionContext, 'about:blank');
const tabB = await createTab(extensionContext, 'about:blank');
await assertTabStructure(...);  // tabA作成直後に呼んでいないので禁止
```

### 禁止されている確認方法

個別の`expect()`による部分確認は**事後条件確認に使用禁止**。全体構造を検証しないと見落としが発生するため。

```typescript
// ❌ 禁止: 部分的な確認（個別のexpect）
const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tab1}"]`);
await expect(tabNode1).toBeVisible();
const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tab2}"]`);
await expect(tabNode2).toBeVisible();

// ✅ 正解: 全体構造を網羅的に検証
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: pseudoSidePanelTabId, depth: 0 },
  { tabId: tab1, depth: 0 },
  { tabId: tab2, depth: 1 },
], 0);
```

### 使用すべき事後条件確認関数

`e2e/utils/assertion-utils.ts`に定義:

| 関数 | 用途 |
|------|------|
| `assertTabStructure` | 通常タブの順序・depth・アクティブビューを**網羅的に**検証 |
| `assertPinnedTabStructure` | ピン留めタブの順序・アクティブビューを**網羅的に**検証 |
| `assertViewStructure` | ビューの順序・アクティブビューを**網羅的に**検証 |
| `assertWindowClosed` | ウィンドウが閉じられたことを検証 |
| `assertWindowExists` | ウィンドウが存在することを検証 |

### waitFor*関数の正しい用途

`waitFor*`関数（polling-utils.tsで定義）は**内部状態の同期待機**に使用する。事後条件確認には使わない。

```typescript
// ✅ 正しい: D&D操作後、事後条件を網羅的に検証
await moveTabToParent(sidePanelPage, child, parent, serviceWorker);
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: pseudoSidePanelTabId, depth: 0 },
  { tabId: parent, depth: 0 },
  { tabId: child, depth: 1 },
], 0);
```

### フレーキーテスト防止

- **固定時間待機（`waitForTimeout`）禁止**: ポーリングで状態確定を待つ
- **新規テストは10回連続成功必須**: `npx playwright test --repeat-each=10 path/to/new.spec.ts`
- **Chrome Background Throttling対策**: ドラッグ操作前に`page.bringToFront()`

### テスト初期化パターン（必須）

テスト開始時は以下のパターンで初期化すること。ブラウザ起動時のデフォルトタブは必ず閉じる。

```typescript
// ウィンドウIDと擬似サイドパネルタブIDを取得
const windowId = await getCurrentWindowId(serviceWorker);
const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

// ブラウザ起動時のデフォルトタブを閉じる
const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
await closeTab(extensionContext, initialBrowserTabId);

// 初期状態を検証（擬似サイドパネルタブのみ）
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: pseudoSidePanelTabId, depth: 0 },
], 0);

// ここからテスト用のタブを作成
const tab1 = await createTab(extensionContext, 'about:blank');
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: pseudoSidePanelTabId, depth: 0 },
  { tabId: tab1, depth: 0 },
], 0);
```

**禁止**: 初期タブを動的に取得して持ち回すパターン
```typescript
// ❌ 禁止: 初期タブを動的に取得して配列に含める
const initialTabs = await serviceWorker.evaluate(...);
await assertTabStructure(sidePanelPage, windowId, [
  ...initialTabs.map(id => ({ tabId: id!, depth: 0 })),  // 禁止
  { tabId: newTab, depth: 0 },
], 0);
```

### 擬似サイドパネルタブ

PlaywrightではChrome拡張機能の本物のサイドパネルをテストできないため、`sidepanel.html`を通常のタブとして開く。このタブは`assertTabStructure`に必ず含める。

```typescript
const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: pseudoSidePanelTabId, depth: 0 },  // 常に含める
  { tabId: testTab, depth: 0 },
], 0);
```

### Playwrightデバッグコード禁止

`page.pause()`などユーザー操作を待機するデバッグ機能は使用禁止。

### E2Eテスト実行時の結果確認（必須）

テスト結果は**ログファイルに保存**してから確認する。出力を切り捨てると失敗テストの情報が失われ、再実行が必要になる。

```bash
# ✅ 正しい: ログをリポジトリ内に保存しながら実行
npm run test:e2e 2>&1 | tee e2e-test.log

# サマリーを確認
grep -E "failed|passed|skipped" e2e-test.log | tail -1

# 失敗があれば詳細を確認（ログファイルから必要な部分を読む）
cat e2e-test.log
```

```bash
# ❌ 禁止: 出力を切り捨てる方法（失敗テストの情報が失われる）
npm run test:e2e 2>&1 | tail -50
npm run test:e2e 2>&1 | head -100
npm run test:e2e 2>&1 | grep ...
```

**テスト結果の解釈**:
- `0 failed` であることを必ず確認する
- passed数だけを見て判断してはいけない（テスト総数が変動するため）

---

## 機能追加時の必須要件

1. **既存テストの通過**: `npm test` と `npm run test:e2e` が全てパス
2. **型チェック通過**: `npm run type-check` がエラーなし
3. **新機能のテスト追加**: 対応するテスト（ユニット/統合/E2E）を追加
4. **UI削除時はE2Eテストも削除**: `test.skip()`でなく完全削除

---

## Development Environment

### Required Tools

- Node.js 20+
- npm
- Vivaldi Browser（動作確認用）

### Common Commands

```bash
npm run dev        # Vite開発サーバー
npm run build      # TypeScript type-check + Vite bundle
npm test           # Vitest watch mode
npm run type-check # 型チェック
npm run test:e2e   # Playwright E2Eテスト
```

---

## Key Technical Decisions

- **Vite + @crxjs/vite-plugin**: 高速HMRと拡張機能ビルド両立
- **IndexedDB**: 大量タブデータ永続化（chrome.storageの容量制限回避）
- **Service Worker**: バックグラウンドでのタブイベント監視とツリー同期
- **Path Alias `@/`**: `./src/`へのエイリアス
- **複数ウィンドウ対応**: TreeStateProviderでwindowIdを取得し各ウィンドウで自身のタブのみをフィルタリング表示
- **DragSessionManager**: クロスウィンドウドラッグでService Workerを中継点として使用

---

## マルチウィンドウドラッグ&ドロップ設計

### 背景・制約

ブラウザのドラッグ&ドロップAPIは、各サイドパネルのコンテキストを超えることができない。そのため、通常のD&D実装ではウィンドウ間でのタブ移動を実現できない。

### 設計アプローチ

Service Workerを中継点として使用し、マルチウィンドウでのD&Dを実現する。

**フロー**:
1. **ウィンドウAでドラッグ開始**: `onDragStart`発火 → Service Workerに`START_DRAG_SESSION`を送信し、ドラッグ中のタブIDを保存
2. **ウィンドウBにマウス移動**: `mouseenter`イベント発火 → `useCrossWindowDrag`フックがService Workerからセッションを取得
3. **クロスウィンドウ検知**: セッションの`sourceWindowId`と現在のウィンドウIDを比較し、別ウィンドウからのドラッグと判定
4. **タブ移動**: `BEGIN_CROSS_WINDOW_MOVE`でタブをウィンドウBに移動し、ウィンドウBでドラッグ状態を継続
5. **ドロップ完了**: ウィンドウBでマウスアップ → 通常のドロップ処理

**主要コンポーネント**:
- `DragSessionManager`（`src/background/drag-session-manager.ts`）: セッション状態管理
- `useCrossWindowDrag`（`src/sidepanel/hooks/useCrossWindowDrag.ts`）: mouseenter検知とセッション取得
- `CrossWindowDragHandler`（`src/sidepanel/components/CrossWindowDragHandler.tsx`）: UIラッパー

### E2Eテストでの検証方法

Playwrightでは各ページのマウス状態が独立しているため、以下のフローでテスト可能:
1. ウィンドウAのSide Panelでドラッグ開始（`mousedown` + 8px移動） → Service Workerにセッション保存
2. ウィンドウBのツリービューで`mouseenter`イベントを発火 → クロスウィンドウ移動トリガー
3. ウィンドウBでドロップ位置にmove → `mouseup`でドロップ完了
4. 両ウィンドウのタブ構造を`assertTabStructure`で検証

---
_Document standards and patterns, not every dependency_
