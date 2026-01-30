# Product Overview

Vivaldi-TTは、Vivaldiブラウザ向けのツリー型タブマネージャーです。タブを階層構造で管理し、効率的なブラウジング体験を提供します。

## Core Capabilities

- **階層的タブ管理**: タブを親子関係で整理し、ツリー構造で可視化。ページタイトルとファビコンで直感的にタブを識別。タブグループもツリー内で統合表示。休止タブはグレーアウト表示で視覚的に区別
- **ドラッグ&ドロップ操作**: 直感的なUI操作でタブの並び替えや階層変更が可能。ドロップインジケーターによる視覚的フィードバック、depth選択機能（マウス左右移動で階層変更）、ドラッグ中のタブ位置固定、ツリービュー外へのドロップで新規ウィンドウ作成（サブツリーごと移動）、空ウィンドウの自動クローズ
- **複数選択操作**: Shift+クリックで範囲選択、Ctrl+クリックで追加/解除。選択タブの一括クローズやグループ化に対応
- **ピン留めタブ**: 重要なタブをファビコンサイズで上部セクションに横並び表示。通常タブツリーからは完全に分離され、ピン留めセクションでのみ表示
- **複数ウィンドウ対応**: 各ブラウザウィンドウで独立したタブツリーを表示。ウィンドウ間でタブツリーは共有されない
- **ビュー/グループ機能**: タブをテーマ別、プロジェクト別に分類・管理。ファビコンサイズのアイコンボタンで切り替え、右クリックで編集
- **スナップショット**: タブセッションの自動/手動保存・復元によるワークフロー管理。自動保存の間隔・最大保持数を設定可能
- **カスタマイズ可能なUI**: フォント、スタイル、ダークテーマ配色などの細かな調整に対応。独立した設定画面（Options Page）で管理

## Target Use Cases

- **リサーチワーク**: 複数の関連ページを階層的に整理しながらブラウジング
- **プロジェクト管理**: 案件ごとにタブをグループ化し、コンテキストスイッチを効率化
- **情報整理**: 大量のタブを構造化して見通しを改善

## Value Proposition

Vivaldi独自のサイドパネルAPIを活用し、ブラウザネイティブな統合感を実現。軽量かつレスポンシブなツリーUIにより、数百タブでも快適に操作できます。

---

# Project Structure

## Organization Philosophy

機能ドメイン別の階層構造を採用。拡張機能の実行コンテキスト（Background / UI）と責務（Services / Storage / Types）を明確に分離しています。

## Directory Patterns

### Background Logic (`/src/background/`)
**Purpose**: Service Worker実行環境のコード（タブイベント処理、ツリー同期、ウィンドウ間状態管理）
**Key Components**:
- `event-handlers.ts`: Chrome APIイベントハンドリング
- `drag-session-manager.ts`: クロスウィンドウドラッグのセッション管理

**Example**: `service-worker.ts`, `event-handlers.ts`, `drag-session-manager.ts`

### Side Panel UI (`/src/sidepanel/`)
**Purpose**: Reactベースのユーザーインターフェース（メインのサイドパネル）
**Subdirectories**:
- `components/`: UIコンポーネント（TreeNode, TabTreeView, SettingsPanel等）
- `providers/`: Reactコンテキストプロバイダー（TreeStateProvider, ThemeProvider）
- `hooks/`: カスタムフック（useMenuActions等）
- `utils/`: UI固有のユーティリティ関数

**Example**: `components/TreeNode.tsx`, `providers/TreeStateProvider.tsx`

### Settings Page (`/src/settings/`)
**Purpose**: 独立した設定画面（chrome.runtime.openOptionsPage()で開く）
**Scope**: フォントカスタマイズ、テーマ設定、新規タブ位置設定などのユーザー設定UI

**Example**: `SettingsPage.tsx`, `index.tsx`

### Group Page (`/src/group/`)
**Purpose**: グループタブ専用ページ（chrome-extension://スキームで表示）
**Scope**: タブグループの親タブとして機能する拡張機能内ページ。グループ名と子タブリストを表示

**Example**: `GroupPage.tsx`, `index.tsx`

### Services (`/src/services/`)
**Purpose**: ビジネスロジック層（スナップショット管理、ツリー状態管理等）
**Key Components**:
- `TreeStateManager.ts`: タブツリー状態の集中管理と永続化（ビュー管理を含む）
- `SnapshotManager.ts`: スナップショットの保存・復元

**Example**: `TreeStateManager.ts`, `SnapshotManager.ts`

### Storage (`/src/storage/`)
**Purpose**: データ永続化の抽象化層（chrome.storage、chrome.downloads API操作）
**Example**: `StorageService.ts`, `DownloadService.ts`

### Types (`/src/types/`)
**Purpose**: 型定義の集約（プロジェクト全体で共有）
**Key Types**:
- `TreeState`, `WindowState`, `ViewState`: 状態管理の階層構造
- `TabNode`, `UITabNode`: タブノード（UITabNodeはdepth付き）
- `TabInfo`, `ExtendedTabInfo`: タブ情報
- `UserSettings`: ユーザー設定

**Example**: `index.ts`

### Testing (`/src/test/`)
**Purpose**: クロスカッティングな統合テスト（パフォーマンス、互換性）
**Example**: `performance.test.tsx`, `vivaldi-compatibility.test.tsx`

### E2E Tests (`/e2e/`)
**Purpose**: Playwrightによる実ブラウザE2Eテスト
**Subdirectories**:
- `fixtures/`: カスタムフィクスチャ（拡張機能ロード等）
- `utils/`: テストユーティリティ（tab-utils, drag-drop-utils, polling-utils等）
- `test-data/`: テストデータとフィクスチャ
- `types/`: E2Eテスト用の型定義
- `scripts/`: E2Eテスト用のヘルパースクリプト

**Example**: `tab-lifecycle.spec.ts`, `drag-drop-reorder.spec.ts`, `utils/polling-utils.ts`

## Naming Conventions

- **Components**: PascalCase（`TreeNode.tsx`, `SettingsPanel.tsx`）
- **Unit/Integration Tests**: `*.test.ts(x)` (unit), `*.integration.test.tsx` (integration)
- **E2E Tests**: `e2e/*.spec.ts`（Playwright形式）
- **Services/Utilities**: PascalCase for classes, camelCase for functions
- **Types**: PascalCase interfaces/types（`TabNode`, `UserSettings`）

## Import Organization

```typescript
// 外部ライブラリ
import React from 'react';

// 内部モジュール（@/ alias使用）
import type { TabNode, TabInfo, DragEndEvent } from '@/types';
import { TreeStateProvider } from '@/sidepanel/providers/TreeStateProvider';
import UnreadBadge from './UnreadBadge'; // 同階層コンポーネントは相対パス
```

**Path Aliases**:
- `@/`: `./src/` へのマッピング（tsconfig.json + vite.config.ts）

## Code Organization Principles

- **Context分離**: Background（Service Worker）とSidepanel（React UI）は独立して動作
- **Type-first**: 共通型は`@/types`に集約、import時はtype-only importを活用
- **Colocation**: コンポーネントとテストは同ディレクトリに配置（関連性を明示）
- **Provider Pattern**: グローバル状態はReact Contextで管理（TreeState, DragDrop, Theme）

---

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

### 実現可能性の事前検討（最重要・必須）

**すべての新規機能実装・バグ修正は、実装を開始する前に実現可能性を検討すること。**

技術的に実現不可能な場合は、**実装を開始する前にユーザーに報告する義務がある**。実装を進めてから「不可能でした」と報告するのは遅すぎる。

**検討すべき項目**:
1. **技術的制約**: Chrome Extension API の制限、サイドパネルの制約、ブラウザの仕様上の制限
2. **実装コスト**: 機能の価値に対して実装コストが見合うか
3. **代替案**: 要件を達成する別のアプローチは存在するか

**プロセス**:
1. 要件を受け取ったら、まず実現可能性を検討する
2. 技術的制約がある場合、その理由と代替案を整理する
3. 実現不可能または高コストな場合、実装前にユーザーに報告する
4. ユーザーの判断を仰いでから実装を開始する

**禁止事項**:
- 実現可能性を検討せずに実装を開始すること
- 実装を進めてから「技術的に不可能」と報告すること
- 不可能な要件に対して中途半端な実装を繰り返すこと

### バグ修正時の行動規範（必須）

**バグ修正作業を開始する前に、必ず`# バグ修正時の行動規範`の章を読み込むこと。**

このドキュメントには以下の重要な規範が定められている：
- 根本原因の特定を最優先する（場当たり的な修正の禁止）
- フォールバックによる問題の隠蔽を禁止する
- 仮説の検証を徹底する（「テストが通った = 原因が正しかった」の禁止）
- デバッグ用コードの管理を徹底する（放置禁止）

**この規範に従わないバグ修正は、たとえテストが通っても完了とは認められない。**

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

**comment-rules.md遵守（必須）**: コメントを残すかどうかは`docs/comment-rules.md`の判定フローに従って判断すること。タスク完了後は、追加したコードに対してcomment-rules.mdのルールに違反するコメントが存在しないかを必ずチェックし、違反コメントが見つかった場合は削除すること。

### Error Handling（シンプルさ優先）

保守性を最優先。ほとんど発生しない競合状態や異常系に対して複雑なロジックを追加しない。

**本番コードでの例外の握りつぶし禁止（必須）**:
- `.catch(() => {})` や `try { } catch { }` で例外を握りつぶすことは本番コードでは禁止
- **異常系で例外が発生する場合**: 握りつぶさずに素通しする。これにより問題を検知しやすくなる
- **正常系で例外が発生する場合**: 適切にハンドルする（ログ出力、フォールバック値の返却など）

```typescript
// ❌ 禁止: 例外の握りつぶし
await someOperation().catch(() => {});

// ✅ 正しい: 異常系の例外は素通し
await someOperation();

// ✅ 正しい: 正常系の例外は適切にハンドル
try {
  await someOperation();
} catch (error) {
  logger.warn('Operation failed, using fallback', error);
  return fallbackValue;
}
```

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

### 既存の問題への対応（必須）

**原則: 問題を見つけたら修正する。「既存だから」「今回の修正範囲外だから」は理由にならない。**

**禁止事項**:
- **「既存のコードだから」という理由で問題を放置することの禁止**: 既存のデバッグログ、コメント規約違反、コードスメルを見つけた場合、今回の修正の一環として修正すること
- **「修正対象外」という概念の禁止**: コードを触る際は、周辺コードも含めて品質基準を満たす責任がある
- **問題の先送りの禁止**: 「後で直す」「別のPRで対応する」として問題を残すことは禁止

**必須事項**:
- 作業中に発見した問題（デバッグログ、コメント規約違反、型安全性の問題など）は、その場で修正する
- 修正範囲が大きくなる場合でも、問題を放置せずに修正する
- 既存のコードに問題があることを発見した場合、それを報告するだけでなく修正する義務がある

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
| `moveTabToWindowViaContextMenu` | `assertTabStructure`（移動元・移動先両ウィンドウ） |
| `moveTabToNewWindowViaContextMenu` | `assertTabStructure` + `assertWindowExists` |
| その他タブ操作系関数 | `assertTabStructure`（該当する場合は他のassert系も併用） |

**違反パターンの検出方法**: 上記関数の呼び出し行を検索し、直後の行にassert系関数がなければ違反

```typescript
// ✅ 正しい: 各タブ操作の直後に毎回assertTabStructure
const tab1 = await createTab(extensionContext, 'about:blank');
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: tab1, depth: 0 },
], 0);

const tab2 = await createTab(extensionContext, 'about:blank');
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: tab1, depth: 0 },
  { tabId: tab2, depth: 0 },
], 0);

await moveTabToParent(sidePanelPage, tab2, tab1, serviceWorker);
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: tab1, depth: 0, expanded: true },
  { tabId: tab2, depth: 1 },
], 0);

await closeTab(extensionContext, tab2);
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
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
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: tab1, depth: 0, expanded: true },
  { tabId: tab2, depth: 1 },
], 0);
```

### 使用すべき事後条件確認関数

`e2e/utils/assertion-utils.ts`に定義:

| 関数 | 用途 |
|------|------|
| `assertTabStructure` | 通常タブの順序・depth・expanded・アクティブビューを**網羅的に**検証 |
| `assertPinnedTabStructure` | ピン留めタブの順序・アクティブビューを**網羅的に**検証 |
| `assertViewStructure` | ビューの順序・アクティブビューを**網羅的に**検証 |
| `assertWindowClosed` | ウィンドウが閉じられたことを検証 |
| `assertWindowExists` | ウィンドウが存在することを検証 |

### assertTabStructureのexpandedオプション

`assertTabStructure`は各タブに`expanded`オプションを指定できる:

- **子タブを持つタブ**: `expanded`は**必須**（`true`または`false`）
- **子タブを持たないタブ**: `expanded`は**指定不可**（undefinedのみ）

`assertTabStructure`はDOM上に見えている要素の事後条件を確認する関数であるため、`expanded: false`の場合は子タブがDOM上に表示されない。したがって折りたたまれた子タブは`assertTabStructure`に含めない。

```typescript
// ✅ 正しい: expandedの指定
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: tab2, depth: 0 },
  { tabId: tab1, depth: 0, expanded: true },    // 子を持つタブはexpanded必須
  { tabId: child1, depth: 1 },                   // 子を持たないタブはexpanded不可
  { tabId: child2, depth: 1, expanded: true },   // 子を持つタブはexpanded必須
  { tabId: grandchild1, depth: 2 },
], 0);

// ✅ 正しい: 折りたたまれた場合は子タブを含めない
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: parent, depth: 0, expanded: false },  // 子タブは見えていないので含めない
], 0);
```

### waitFor*関数の正しい用途

`waitFor*`関数（polling-utils.tsで定義）は**内部状態の同期待機**に使用する。事後条件確認には使わない。

```typescript
// ✅ 正しい: D&D操作後、事後条件を網羅的に検証
await moveTabToParent(sidePanelPage, child, parent, serviceWorker);
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: parent, depth: 0, expanded: true },
  { tabId: child, depth: 1 },
], 0);
```

### Service Workerイベントハンドラーの必須パターン（E2Eテスト対応）

Service Workerの全ての非同期イベントハンドラーは`trackHandler()`でラップする必要がある。これはE2Eテストのリセット処理が正しく動作するために必須。

**背景**: Chromeはイベントリスナーのコールバック完了を待たない。そのため、テスト間のリセット処理中に前のテストのハンドラーがバックグラウンドで実行され続け、状態の競合が発生する。

```typescript
// ✅ 正しい: trackHandlerでラップ
chrome.tabs.onCreated.addListener((tab) => {
  trackHandler(() => handleTabCreated(tab));
});

// ❌ 禁止: 直接呼び出し
chrome.tabs.onCreated.addListener((tab) => {
  handleTabCreated(tab);
});
```

**新しいイベントハンドラーを追加する際のチェックリスト**:
- [ ] `event-handlers.ts`で`trackHandler()`を使用してラップしているか
- [ ] `registerTabEventListeners()`または`registerWindowEventListeners()`内で登録しているか

### フレーキーテスト防止

- **固定時間待機（`waitForTimeout`）禁止**: ポーリングで状態確定を待つ
- **テストは10回連続成功必須**: `npm run test:e2e`を10回連続実行して全て成功することを確認（フレーキーが見つかっていない場合の目安）
- **Chrome Background Throttling対策**: ドラッグ操作前に`page.bringToFront()`
- **リトライ追加禁止**: テストにリトライを安易に追加してはならない。リトライはフレーキーさの根本原因を隠蔽し、問題の発覚を遅らせるだけである。テストがフレーキーな場合は、リトライを追加せずに根本的な原因を特定し修正すること

### フレーキーテストの扱い（絶対遵守）

**テストが1回でも失敗した場合、それは「フレーキー」であり、必ず根本原因を特定して修正すること。**

- **「フレーキーだから」「一時的だから」「再実行したら通った」は修正しない理由にならない**
- フレーキーは「原因不明の失敗」であり、原因不明のまま放置することは絶対に許されない
- 50回連続成功しても、1回の失敗の原因が不明なら問題は未解決である

**確認回数の基準**:
- **フレーキーが見つかっていない場合**: 10回連続成功で確認完了
- **1回でも失敗が発生した場合（フレーキー確定）**: 10回では不足。50回以上繰り返し実行し、フレーキーが本当に存在しないと言えるまで修正を続けること

**禁止される判断パターン**:
- 「5回成功したからおそらく大丈夫」
- 「一時的なフレーキーでした」
- 「再現しないから放置」

### フレーキーテスト修正の手順（必須）

フレーキーテストは発生確率が低いため、何度もテストを実行して失敗を待つのは非現実的かつ非効率である。**漫然とテストを何度も繰り返すことは厳に禁止する。**

#### 修正の正しい手順

1. **網羅的なログの埋め込み**
   - フレーキーテストを修正する前に、**すべての関連箇所にログを仕込む**
   - 「すべての箇所」とは文字通りすべての箇所である。可能性のある経路をすべて網羅すること
   - 各関数の事前条件・事後条件、状態の変化、分岐の結果などを記録する
   - 目的：**1回のフレーキー発生時に、何が起きているかを完全に把握できる状態にする**

2. **ログを確認可能な状態でテストを実行**
   - ログを仕込んだ状態でテストを実行し、フレーキーが発生するまで待つ
   - フレーキーが発生したら、収集したログから**実際に何が起きているか**を分析する

3. **根本原因の特定と修正**
   - ログから根本原因を特定し、論理的に説明できる状態にする
   - 原因が特定できてから初めて修正を行う

#### 禁止事項

- **ログを確認せずに当てずっぽうで修正することの禁止**
  - 「おそらくこれが原因だろう」という推測だけで修正してはならない
  - 修正後にテストが通っても、それが「たまたま通った」のか「本当に修正された」のか判別できない

- **ログが読めないことを理由にした妥協の禁止**
  - ログがCLIの標準出力に表示されずブラウザのDevToolsにしか表示されない場合でも、ログを読まずに修正を進めてはならない
  - ログを確認する手段を必ず確保すること

#### ログが確認できない場合の対処

1. **まずログを確認できる方法を探す**
   - Service Workerのログは`console.log`で出力し、Playwrightの`serviceWorker.evaluate()`内で取得できないか検討する
   - ログをファイルに書き出す、メッセージで送信する等の代替手段を検討する

2. **それでも確認できない場合はユーザーに依頼する**
   - ユーザーへの確認依頼は**最後の手段**である
   - 「DevToolsでこのログを確認してください」と具体的に依頼する
   - 確認してもらった結果を元に原因を特定する

#### 修正完了の判定

フレーキーテスト修正が完了したと言えるのは、以下をすべて満たす場合のみ：
- ログから根本原因を**確定的に**特定し、論理的に説明できる
- 修正内容が根本原因を**直接**解決している
- 修正後、50回以上のテスト実行で失敗が0回である

### テスト初期化パターン（必須）

テスト開始時は以下のパターンで初期化すること。ブラウザ起動時のデフォルトタブは閉じずに、assertTabStructureに含める。

```typescript
// ウィンドウIDと初期タブIDを取得
const windowId = await getCurrentWindowId(serviceWorker);
const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);

// ここからテスト用のタブを作成
const tab1 = await createTab(extensionContext, 'about:blank');
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
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

### 擬似サイドパネルタブとTreeState

PlaywrightではChrome拡張機能の本物のサイドパネルをテストできないため、`sidepanel.html`を通常のタブとして開く（擬似サイドパネルタブ）。

**重要**: サイドパネルタブ（`sidepanel.html`を開いているタブ）はTreeStateから**自動的に除外**される。これは`isOwnExtensionUrl()`と`isSidePanelUrl()`による判定で実現される。

- 本番環境: サイドパネルは実際のサイドパネルAPIで開かれるためタブとして存在しない
- E2Eテスト環境: 擬似サイドパネルタブはTreeStateから除外されるが、Chromeのタブとしては存在する

```typescript
// assertTabStructureにはサイドパネルタブを含めない
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: testTab, depth: 0 },
], 0);

// Chromeタブ数とTreeStateタブ数を比較する場合は、サイドパネルタブを除外する
const browserTabCount = await serviceWorker.evaluate(async (windowId) => {
  const extensionId = chrome.runtime.id;
  const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
  const tabs = await chrome.tabs.query({ windowId });
  return tabs.filter(t => {
    const url = t.url || t.pendingUrl || '';
    return !url.startsWith(sidePanelUrlPrefix);
  }).length;
}, windowId);
```

### Playwrightデバッグコード禁止

`page.pause()`などユーザー操作を待機するデバッグ機能は使用禁止。

### リンククリックには`noWaitAfter: true`必須

リンクをクリックする際は`page.click(selector, { noWaitAfter: true })`を使用する。`noWaitAfter`なしだと`context.close()`が約4〜5秒遅延する。

`e2e/utils/tab-utils.ts`の`clickLinkToOpenTab`・`clickLinkToNavigate`は内部で対応済み。

### E2Eテスト実行時の結果確認（必須）

テスト結果は**リポジトリ内のログファイルに保存**してから確認する。出力を切り捨てると失敗テストの情報が失われ、再実行が必要になる。

**重要**: ログファイルは必ずリポジトリ内に保存すること。`/tmp/`や他のリポジトリ外のディレクトリへの書き込みは禁止。

```bash
# ✅ 正しい: ログをリポジトリ内に保存しながら実行
npm run test:e2e 2>&1 | tee e2e-test.log

# サマリーを確認
grep -E "failed|passed|skipped" e2e-test.log
```

```bash
# ❌ 禁止: 出力を切り捨てる方法（失敗テストの情報が失われる）
npm run test:e2e 2>&1 | tail -50
npm run test:e2e 2>&1 | head -100
npm run test:e2e 2>&1 | grep ...

# ❌ 禁止: リポジトリ外への書き込み
npm run test:e2e 2>&1 | tee /tmp/e2e-test.log
```

**テスト結果の解釈**:
- `0 failed` であることを必ず確認する
- passed数だけを見て判断してはいけない（テスト総数が変動するため）

#### 複数回実行時のログ保存（必須）

フレーキーテスト確認のために複数回実行する場合、**各実行のログを個別ファイルに保存**すること。

```bash
# ✅ 正しい: 各実行のログを個別ファイルに保存
for i in {1..10}; do
  npm run test:e2e 2>&1 | tee e2e-run-$i.log
  grep -E "failed|passed" e2e-run-$i.log
done

# ✅ 正しい: 失敗が見つかったら保存済みログから調査
# 例: Run 3で失敗した場合
grep -B30 "failed" e2e-run-3.log  # エラー詳細を確認
```

```bash
# ❌ 禁止: ログを保存せずにサマリーだけを収集
for i in {1..10}; do
  npm run test:e2e 2>&1 | grep -E "passed|failed"
done

# ❌ 禁止: 失敗を検知しても詳細を追跡できない方法
for i in {1..10}; do
  echo "Run $i: $(npm run test:e2e 2>&1 | tail -1)"
done
```

**失敗時の調査ワークフロー**:
1. 失敗が発生したら、保存済みのログファイルから詳細を確認する
2. エラーメッセージ、スタックトレース、失敗したテスト名を特定する
3. 確率的に再現しない失敗でも、最初に保存したログから原因を調査できる状態にする
4. ログを保存せずに実行して失敗した場合、調査に必要な情報が失われる

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

### データ構造（最重要）

**Window → View → Tab の階層構造**

```typescript
// TreeState: 全体の状態
interface TreeState {
  windows: WindowState[];  // ウィンドウ配列（順序を持つ）
}

// WindowState: ウィンドウごとの状態
interface WindowState {
  windowId: number;
  views: ViewState[];      // ビュー配列（インデックスで参照）
  activeViewIndex: number; // 現在アクティブなビューのインデックス
}

// ViewState: ビューごとの状態
interface ViewState {
  name: string;
  color: string;
  icon?: string;
  rootNodes: TabNode[];    // ツリー構造を直接保持
  pinnedTabIds: number[];  // ピン留めタブのID配列
}

// TabNode: タブノード（ツリー構造）
interface TabNode {
  tabId: number;           // Chrome tabIdを直接識別子として使用
  isExpanded: boolean;
  groupInfo?: GroupInfo;
  children: TabNode[];     // 親子関係はchildren配列で直接表現
}

// UITabNode: UI表示用（TabNode + depth）
interface UITabNode extends TabNode {
  depth: number;           // UI表示用のインデント深度
  children: UITabNode[];
}
```

**識別子体系**:
- **タブ識別**: `tabId: number`（Chrome tabIdを直接使用。文字列nodeIdは使用しない）
- **ビュー識別**: `viewIndex: number`（配列インデックス。文字列viewIdは使用しない）
- **親子関係**: `children: TabNode[]`（parentIdによる間接参照ではなく、配列で直接表現）

**設計原則**:
- マッピングテーブル（旧`tabToNode`）は不要。ツリー構造から直接検索
- `depth`はTabNodeに含めない。UI層で計算するか、UITabNodeを使用
- ビューはウィンドウごとに独立。ウィンドウ間でビューは共有しない

### 状態管理アーキテクチャ（最重要）

**TreeStateManager（Service Worker）がSingle Source of Truth**

すべての状態変更は以下のフローに従う：

```
Action（UI操作/Chromeイベント）
    │
    ▼
Service Worker (event-handlers.ts)
    │
    ▼
TreeStateManager
    │
    ├──→ メモリ上の状態を変更（純粋な状態変更）
    │    ※例外: addTab/duplicateTabのみtabId取得のためChrome API呼び出し
    │
    ├──→ syncTreeStateToChromeTabs() → Chrome APIs
    │         TreeStateManagerの状態を正として、Chromeタブを同期
    │         - 順序（chrome.tabs.move）
    │         - ピン留め（chrome.tabs.update({pinned})）
    │         - ウィンドウ配置（chrome.tabs.move({windowId})）
    │
    ├──→ persistState() → chrome.storage.local (永続化)
    │
    └──→ sendMessage({ type: 'STATE_UPDATED', payload: state })
              │
              ▼
         Side Panel (React state更新 → UI再レンダリング)
```

**原則**:
1. **TreeStateManager（Service Worker）がSingle Source of Truth**
2. **TreeStateManagerのメソッドは純粋にメモリ上の状態変更のみ**（addTab/duplicateTabのみ例外：tabIdを得るためChrome APIが必要）
3. **`syncTreeStateToChromeTabs()`でChromeタブの状態をTreeStateManagerに合わせる** - 順序、ピン留め、ウィンドウ配置など全てを同期
4. **Chrome APIを直接呼ぶのはsyncメソッド内のみ**（addTab/duplicateTabの例外を除く）
5. chrome.storage.localは永続化専用（ブラウザ再起動時の復元用）
6. リアルタイム同期にはメッセージの引数（payload）を使用
7. Side Panelは読み取り専用（状態変更はService Workerにメッセージを送信）

**Side Panel側の禁止事項**:
- `chrome.storage.local.set()`を直接呼び出すこと
- `chrome.tabs.move()`、`chrome.tabs.update()`、`chrome.tabs.create()`を直接呼び出すこと
- `chrome.windows.create()`を直接呼び出すこと
- TreeStateManagerを経由しない状態変更

**ServiceWorker側の禁止事項**:
- イベントハンドラから直接`chrome.tabs.move()`、`chrome.tabs.update({pinned})`、`chrome.windows.create()`を呼び出すこと
- これらの操作はTreeStateManagerのメソッドでメモリ状態を変更後、`syncTreeStateToChromeTabs()`で一括反映する
- **Chrome → TreeStateManager 方向の同期は原則禁止**: 通常運用ではTreeStateManagerが正であり、Chromeタブの状態からTreeStateManagerを更新してはならない

**唯一の例外: 拡張機能の新規インストール時**:
- `chrome.runtime.onInstalled`で`details.reason === 'install'`の場合のみ、`initializeFromChromeTabs()`でChromeタブをTreeStateManagerに取り込む
- これは拡張機能インストール前から存在するタブをサイドパネルに表示するための唯一の例外
- Chrome再起動、ServiceWorker再起動、拡張機能アップデート時にはこの方向の同期は行わない

**理由**: Side PanelとService Workerは別プロセスで動作する。共有メモリ（chrome.storage.local）を介した非同期処理はレースコンディションの温床となる。

### chrome.storage.localの役割

**永続化専用**（ブラウザ再起動時の状態復元のため）

| 用途 | 使用するもの |
|------|-------------|
| 永続化（再起動時の復元） | chrome.storage.local |
| リアルタイム同期（状態変更通知） | メッセージの引数（payload） |

**リアルタイム同期でストレージを使わない理由**:
- 「書き込み → 通知 → 読み込み」の間に別の書き込みが入る可能性
- 複数の非同期処理が同時に走るとレースコンディションが発生
- メッセージと状態の1対1対応が保証されない

### その他の技術決定

- **Vite + @crxjs/vite-plugin**: 高速HMRと拡張機能ビルド両立
- **chrome.downloads API**: スナップショットをJSONファイルとしてダウンロードフォルダに保存
- **Service Worker**: バックグラウンドでのタブイベント監視とツリー同期
- **Path Alias `@/`**: `./src/`へのエイリアス
- **複数ウィンドウ対応**: TreeState.windows配列でウィンドウごとに独立した状態を管理。各サイドパネルは自身のwindowIdに対応するWindowStateのみを表示
- **ウィンドウ間タブ移動**: コンテキストメニューから「別のウィンドウに移動」「新しいウィンドウに移動」で実現
- **リンククリック検出**: `chrome.webNavigation.onCreatedNavigationTarget` APIを使用。このAPIはリンククリックまたは`window.open()`の場合のみ発火し、`chrome.tabs.create()`・ブックマーク・アドレスバー・Ctrl+Tでは発火しない。これにより「リンクから開いたタブ」と「手動で開いたタブ」を正確に区別し、それぞれの設定（`newTabPositionFromLink` / `newTabPositionManual`）を適用する
- **ストレージ設計**: `chrome.storage.local`を使用（`unlimitedStorage`権限あり）。IndexedDBは使用しない。想定最大タブ数は2500。15秒ごとの定期永続化でブラウザクラッシュ時のデータロスを最小化。ファビコンはURL文字列（またはdata:URL）として保存
- **タブ休止（discard）時のtabId変更**: `chrome.tabs.discard()`でタブを休止すると、ChromeはtabIdを変更する。この変更は`chrome.tabs.onReplaced`イベントで検知する。`onReplaced(addedTabId, removedTabId)`が発火したら、TreeStateManagerで旧tabIdを新tabIdに置き換える。Service Worker内ではイベントハンドラが逐次実行されるため、明示的なキューは不要
- **TreeStateManager→UI/Chrome一方通行同期**: タブの順序・構造はTreeStateManager（Service Worker）が常に正（Single Source of Truth）。Chrome側でタブを直接操作（D&D、ピン留め解除など）した場合、TreeStateManagerの状態をChromeに再同期して元に戻す。これにより、Chrome側操作での親子関係やビュー整合性の破綻を防ぐ
- **サイドパネルタブのTreeState除外**: 拡張機能自身のサイドパネルURLを持つタブは、TreeStateに追加しない。`isOwnExtensionUrl()`で自拡張機能のURLか判定し、`isSidePanelUrl()`でサイドパネルURLか判定する。本番環境ではサイドパネルAPIで開かれるためタブとして存在しないが、E2Eテストでは擬似サイドパネルタブとして通常タブで開くため、この除外ロジックが必要
- **Chrome再起動時のタブイベント抑制**: Chrome再起動時、セッション復元で作成されたタブの`onCreated`イベントをTreeStateに反映させないため、`isRestoringState`フラグを使用。Service Worker初期化の**最初**（await前）に`setRestoringState(true)`を設定し、`restoreStateAfterRestart()`完了後に`false`に戻す。`handleTabCreated`は`waitForInitialization()`の**前**にこのフラグをキャプチャし、復元中に発火したイベントをスキップする。これにより、`rebuildTabIds()`でtabIdがマッピングされた後に重複してタブが追加されることを防ぐ

---

## 技術的制約

### サイドパネル外クリックの検出は不可能

**結論**: ブラウザ拡張機能のサイドパネルにおいて、「ページ内クリック」を検出することは技術的に不可能である。

**技術的理由**:
- サイドパネルとページコンテンツは完全に分離されたウィンドウコンテキストを持つ
- サイドパネルは独自の `window` オブジェクトを持ち、ページ内のイベントは伝播しない
- サイドパネルからページ内のイベントを監視する手段が存在しない

**検討した代替案と却下理由**:
1. **window.blur**: ページ内クリックではサイドパネルのblurイベントは発火しない
2. **chrome.tabs.onActivated**: 同じタブ内のクリックでは発火しない（タブ切り替えではない）
3. **content script を全ページに注入**: コストが機能の価値に見合わない
   - メモリ使用量の増加（全タブでスクリプト実行）
   - 過剰な権限要求（`<all_urls>`）によるセキュリティ・審査の問題
   - CSPとの競合、ページスクリプトとの干渉リスク
   - 単一機能のために全ページへの注入は過剰

**採用した設計**: サイドパネル内の空白クリックでのみ選択解除
- サイドパネル内のタブノード以外の領域（ViewSwitcher下、ツリービュー下の空白など）をクリックすると選択解除
- 実装: `SidePanelRoot.tsx` の onClick で `!target.closest('[data-tab-id]')` をチェック

**関連ファイル**: `src/sidepanel/components/SidePanelRoot.tsx`

---

### クロスウィンドウドラッグ&ドロップは実装不可能

**結論**: ブラウザ拡張機能において、ドラッグ&ドロップでウィンドウ間のタブ移動を実現することは技術的に不可能である。

**調査結果**:

1. **OSレベルのマウスキャプチャ**
   - ブラウザでドラッグ操作が開始されると、OSがマウスイベントをキャプチャする
   - ドラッグ中は別ウィンドウの`mouseenter`, `mouseover`, `mousemove`などのマウスイベントが一切発火しない
   - `pointerenter`, `pointermove`なども同様に発火しない
   - `setPointerCapture()`は`dragstart`後に呼び出しても機能しない

2. **HTML5 Drag and Drop APIの制限**
   - `dragenter`, `dragover`イベントは内部的には発火するが、Chrome拡張のサイドパネル間では検知できない
   - `dataTransfer`を使用した方法もサイドパネル間では機能しない

3. **`preventDefault()`の無効性**
   - `dragstart`イベントで`preventDefault()`を呼んでも、マウスボタンを押したまま移動するとOSレベルのドラッグが開始される
   - これはブラウザとOSの相互作用によるもので、JavaScript側で制御できない

4. **VSCode/Electronの事例**
   - VSCodeもウィンドウ間タブD&Dを完全には実装できていない
   - Electronアプリでこれを実現するには、Win32 API（Windows）やCocoa/AppKit（macOS）などのネイティブコードが必要
   - Chrome拡張機能はネイティブコードを実行できないため、この方法は使用不可能

**代替実装**:
- コンテキストメニューから「別のウィンドウに移動」を選択してタブを移動
- コンテキストメニューから「新しいウィンドウに移動」を選択して新規ウィンドウを作成

**参考資料**:
- Electron Issue: "Dragging tabs between windows" - ネイティブコード必須と結論
- MDN Web Docs: Drag and Drop API - イベントキャプチャの制限について記載

---

# バグ修正時の行動規範

このドキュメントは、バグ修正作業を行う際に必ず遵守すべき規範を定めたものである。
バグ修正を開始する前に、必ずこのドキュメントを読み込み、以下の規範に従って作業を行うこと。

## 1. 根本原因の特定を最優先する

### 禁止事項
- **場当たり的な修正の禁止**: 表面的な症状を解消するだけの修正を行ってはならない
- **推測に基づく修正の禁止**: 「おそらくこれが原因だろう」という推測だけで修正を行ってはならない
- **時間ベースの待機追加の禁止**: `setTimeout`、`sleep`、固定時間待機などを「安定させるため」という理由で追加してはならない

### 必須事項
- バグの再現条件を明確に特定する
- データフローを追跡し、どこで期待値と実際の値が乖離するかを特定する
- ログやデバッガを使用して、実際の実行パスと値を確認する
- 「なぜそうなるのか」を説明できるまで調査を続ける

## 2. フォールバックによる問題の隠蔽を禁止する

### 禁止事項
- **事前条件の不正をフォールバックで吸収することの禁止**: 事前条件が満たされていない場合、フォールバック値を返してテストを通すことは禁止
- **nullチェックの安易な追加禁止**: 「nullの場合は何もしない」というコードを、なぜnullになるかを調査せずに追加してはならない
- **try-catchによる例外の握りつぶし禁止**: 例外が発生する根本原因を調査せずに、catchで握りつぶしてはならない

### 必須事項
- 事前条件が満たされない場合は、**なぜ満たされないのか**を調査する
- フォールバックを追加する場合は、それが**設計上正当な理由**があることを説明できなければならない
- 予期しない状態の場合は、エラーを投げるか、明確なログを出力して問題を可視化する

## 3. 仮説の検証を徹底する

### 禁止事項
- **「テストが通った = 原因が正しかった」という短絡的結論の禁止**: テストが通っても、その修正が本当の原因を解決したとは限らない
- **副作用による解決の見落とし禁止**: 修正が意図しない副作用で問題を解決している可能性を常に考慮する
- **仮説を立てたらすぐに修正に着手することの禁止**: 仮説を立てたら、まずその仮説が正しいかを検証する方法を考える

### 必須事項

#### 仮説検証のプロセス
1. **仮説を明文化する**: 「〜が原因で〜が起きている」という形で仮説を明確に記述する
2. **仮説を検証する方法を考える**: 修正前に、その仮説が正しいことを確認するための検証方法を考える
3. **最小限の修正で検証する**: 仮説を検証するために、最小限の変更で効果を確認する
4. **修正後も仮説を疑う**: 修正後、以下の質問に答えられなければならない：
   - この修正がなぜ問題を解決するのか、論理的に説明できるか？
   - 他の原因が同時に解決されている可能性はないか？
   - この修正を元に戻したら、確実に問題が再発するか？

#### 検証の具体的手法
- 修正前後でログを比較し、期待通りのデータフローになっているか確認する
- 修正を一部だけ適用して、どの部分が効果的かを切り分ける
- 問題の再現テストを複数回実行し、統計的に有意な結果を得る

## 3.5 推測と検証の精度に関する必須要件（最重要）

試行錯誤ループ自体は禁止しないが、**推測の精度が十分でない状態での検証は禁止する**。

### 禁止されるパターン

1. **表面的な挙動だけからの推測**
   - ❌「タイムアウトしてるからイベント発火が遅いのかも」
   - ✅ コードパスを追跡し「この行でこの値がこうなるからタイムアウトする」と特定

2. **「気になったから試す」**
   - ❌ コードを見て気になる箇所があったから変更して実行
   - ✅ コードパスを完全に理解し「ここでバグが起きるはず」という確信を得てから検証

3. **テスト結果の統計で判断**
   - 「10回中1回→2回になったので悪化」は統計的に無意味
   - 「失敗率が改善した」は根本解決の証明にならない
   - 判断基準：**失敗が1回でもあれば未解決。0回でも原因不明なら未解決**

### 推測前の必須調査プロセス

1. **観察**: ログ追加・デバッガ等で、問題発生時に**実際に何が起きているか**を記録する
2. **追跡**: 問題が発生するコードパスを**完全に**追跡し、各ステップで変数・状態がどう変化するかを理解する
3. **特定**: 「この行で、この条件で、この値になるから問題が起きる」と言えるまで調査する
4. **説明**: **「なぜそうなるか」を論理的に説明できる状態**になってから、初めて修正を検討する

### 検証の正しい手順

1. 原因を特定し、**なぜその原因で問題が起きるか**を説明できる
2. 修正内容が**なぜその原因を解決するか**を説明できる
3. その状態で初めて修正コードを書き、テストで確認する
4. テストが通っても、上記の説明ができなければ**未解決として扱う**

## 4. デバッグ用コードの管理を徹底する

### 禁止事項
- **デバッグ用コードの放置禁止**: 調査のために追加した関数、ログ出力、一時的な変数を放置してはならない
- **「後で消す」の禁止**: デバッグ用コードを「後で消す」つもりで残してはならない。調査が終わったら即座に削除する
- **検証用関数の本番コード混入禁止**: 検証のために一時的に追加した関数を、本番のロジックで使用してはならない

### 必須事項

#### デバッグコードの追跡
- デバッグ用コードを追加する際は、`[DEBUG]`プレフィックスや専用のコメントで明示的にマークする
- デバッグコードを追加したファイルと行番号を記録しておく
- 調査が完了したら、追加したデバッグコードを**全て**削除する

#### 検証用コードの扱い
- 検証用に追加した関数は、検証が終わったら即座に削除する
- 検証用関数が有用だと判断した場合は、正式な設計レビューを経て本番コードに組み込む
- 一時的な修正が効果的だった場合でも、それが正しい解決策かを再評価する

## 5. 修正方法の複数案検討を必須とする

### 禁止事項
- **原因特定後の即座のコーディング禁止**: 原因が分かった後に、修正方法を深く検討せずにすぐにコードを書き始めてはならない
- **最初に思いついた方法での修正禁止**: 最初に思いついた修正方法が最善とは限らない。必ず複数の選択肢を検討する
- **修正方法の比較検討なしの実装禁止**: 複数案のPros/Consを比較せずに修正を開始してはならない

### 必須事項

#### 修正方法検討のプロセス
1. **複数の修正案を列挙する**: 最低2つ以上の修正方法を考える
2. **各案のPros/Consを明確にする**: それぞれの修正方法の長所と短所を書き出す
3. **「あるべき姿」を基準に評価する**: 修正後のコードが設計として正しい状態になるかを評価する
4. **最善の方法を選択する**: Pros/Consを踏まえて、最も適切な修正方法を選択する

#### 検討すべき観点
- この修正は根本的な解決か、それとも対症療法か？
- 修正後のコードは、バグがなかったとしたら書いたであろうコードになっているか？
- 将来の拡張性や保守性に問題はないか？
- 同様のバグが他の箇所で発生する可能性はないか？その場合、より広範な修正が必要ではないか？

## 6. 修正範囲の大きさを恐れない

### 禁止事項
- **修正範囲を理由にした妥協の禁止**: 「影響範囲が大きくなるから」という理由で、中途半端な修正を選択してはならない
- **ユーザー確認なしの回避禁止**: 根本的な修正が必要だと分かっているのに、ユーザーに確認せずに小さな修正で済ませてはならない
- **編集範囲をマイナス要素として評価することの禁止**: 複数案を比較する際、編集範囲の大きさをマイナス要素として考えてはならない

### 必須事項

#### 修正範囲に関する原則
- バグの根本原因を修正し、コードを「あるべき姿」にすることが最優先
- 影響範囲が大きくなることは、正しい修正を行うための必要なコストである
- 全体設計を見直す必要がある場合は、それを避けずに正面から取り組む

#### 大規模な修正が必要な場合のプロセス
1. **修正の必要性を明確にする**: なぜ大規模な修正が必要なのかを説明できるようにする
2. **設計方針をユーザーに確認する**: 根本的な書き換えが必要な場合は、その設計方針についてユーザーの承認を得る
3. **段階的に実装する**: 大規模な修正を適切な単位に分割して実装する
4. **各段階でテストを実行する**: 修正の各段階でテストが通ることを確認する

#### 禁止される判断パターン
- 「この修正は大きすぎるから、とりあえずこの範囲だけ直そう」
- 「全部直すと時間がかかるから、最小限の修正にしよう」
- 「他の部分に影響が出るから、ここだけ特別な処理を入れよう」

## 7. バグ修正の完了条件

バグ修正が完了したと言えるのは、以下の全ての条件を満たした場合のみである：

### 7.1 絶対的な完了条件

1. **根本原因の確定的な特定**: バグの根本原因を**推測ではなく確定的に**特定し、説明できる
   - 「〜の可能性がある」「〜かもしれない」という表現での原因説明は認めない
   - 「〜が原因である。なぜなら〜」という確定的な説明ができなければならない
   - デバッグログ、コード追跡、または再現テストにより原因を**実証**していること

2. **修正と原因の直接的な対応**: 修正内容が根本原因を**直接**解決している
   - 修正が原因に対して「直接的」であり、「間接的」や「副次的」な効果に依存していないこと
   - 修正コードのどの部分が、原因のどの部分を解決するのか、1対1で説明できること

3. **再発防止の証明**: 同じコードパスで同じ問題が**二度と起きない**ことを証明できる
   - 修正後、問題の発生条件を意図的に作り出しても問題が起きないことを確認
   - 単に「テストが通った」だけでは証明にならない

### 7.2 禁止される完了宣言パターン

以下のパターンでの完了宣言は**絶対に禁止**：

- 「修正したらテストが通るようになった」→ たまたま通っただけの可能性を排除できていない
- 「〜の可能性があったので修正した」→ 可能性ではなく確定的な原因特定が必要
- 「問題が再現しなくなった」→ 再現しなくなった理由を説明できなければならない
- 「複数回テストを実行して全部成功した」→ 統計的成功は根本解決の証明にならない

### 7.3 標準的な完了条件

4. **複数案の検討**: 複数の修正方法を検討し、Pros/Consを比較した上で最善の方法を選択した
5. **修正の妥当性**: その修正がなぜ問題を解決するのか、論理的に説明できる
6. **あるべき姿の実現**: 修正後のコードが「バグがなかったとしたら書いたであろうコード」になっている
7. **全テストのオールグリーン**: 修正後、**全てのテストが成功**していること
   - 修正対象のバグに関連するテストだけでなく、**プロジェクト全体のテストがパスしていること**が必要
   - 修正と関係なく失敗しているテストがある場合でも、それを放置してはならない
   - 全テストがオールグリーンの状態を維持することがバグ修正完了の必須条件である
8. **副作用の確認**: 修正が他の機能に悪影響を与えていないことを確認する
9. **デバッグコードの除去**: 調査のために追加したコードが全て削除されている
10. **コードの清潔さ**: 不要なフォールバック、一時的な修正、コメントアウトされたコードが残っていない

### 7.4 完了報告の必須要素

バグ修正の完了を報告する際は、以下の要素を**必ず**含めること：

1. **根本原因の説明**: 確定的な原因の説明（推測ではない）
2. **原因の実証方法**: どのようにしてその原因を特定したか（ログ、トレース等）
3. **修正内容と原因の対応関係**: 修正のどの部分が原因のどの部分を解決するか
4. **再発防止の証明方法**: 同じ問題が起きないことをどのように確認したか

## 8. バグ修正時のチェックリスト

バグ修正作業を行う前に、以下のチェックリストを確認すること：

### 調査フェーズ
- [ ] バグの再現手順を明確にしたか？
- [ ] ログやデバッガを使用して実際の動作を確認したか？
- [ ] データフローを追跡して、どこで問題が発生しているか特定したか？
- [ ] 「なぜそうなるのか」を説明できるか？

### 仮説フェーズ
- [ ] 仮説を明文化したか？
- [ ] 仮説を検証する方法を考えたか？
- [ ] 場当たり的な修正ではなく、根本原因に対する修正か？

### 修正方法検討フェーズ
- [ ] 複数の修正案（最低2つ以上）を列挙したか？
- [ ] 各案のPros/Consを明確にしたか？
- [ ] 修正後のコードが「あるべき姿」になるかを評価したか？
- [ ] 編集範囲の大きさをマイナス要素として考えずに評価したか？
- [ ] 同様のバグが他の箇所で発生する可能性を検討したか？

### 修正フェーズ
- [ ] 根本原因に対する修正か（対症療法ではないか）？
- [ ] フォールバックで問題を隠蔽していないか？
- [ ] 固定時間待機を追加していないか？
- [ ] 修正範囲が大きくなることを理由に妥協していないか？
- [ ] 大規模な修正が必要な場合、ユーザーに設計方針を確認したか？

### 検証フェーズ
- [ ] 修正がなぜ問題を解決するのか論理的に説明できるか？
- [ ] 修正を元に戻したら問題が再発することを確認したか？
- [ ] 他の副作用で解決されている可能性を排除したか？
- [ ] 統計的に有意な回数のテストを実行したか？

### フレーキーテストの確認方法
**重要**: Playwrightの`--repeat-each`オプションは使用しないこと。`--repeat-each`を使用すると、Service Workerのライフサイクル管理の問題でフレーキーが発生する可能性がある。

代わりに、複数回コマンドを実行する形でフレーキーを確認する：
```bash
for i in {1..50}; do npm run test:e2e -- --grep "テスト名" && echo "Run $i passed" || echo "Run $i FAILED"; done
```

**確認回数の決定基準**（「フレーキーテストの扱い」セクション参照）:
- フレーキーが見つかっていない通常確認: 10回
- 1回でも失敗が発生した後の確認: 50回以上（フレーキーが完全に解消されたと言えるまで）

### 完了フェーズ
- [ ] デバッグ用コードを全て削除したか？
- [ ] 不要なフォールバックや一時的なコードが残っていないか？
- [ ] コードがクリーンな状態か？
- [ ] 修正後のコードは「バグがなかったとしたら書いたであろうコード」になっているか？

---

**このドキュメントに記載された規範に従わないバグ修正は、たとえテストが通っても完了とは認められない。**
