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

### バグ修正時の行動規範（必須）

**バグ修正作業を開始する前に、必ず`docs/steering/bug-fixing-rules.md`を読み込むこと。**

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

**comment-rules.md遵守（必須）**: コメントを残すかどうかは`docs/steering/comment-rules.md`の判定フローに従って判断すること。タスク完了後は、追加したコードに対してcomment-rules.mdのルールに違反するコメントが存在しないかを必ずチェックし、違反コメントが見つかった場合は削除すること。

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
| `moveTabToWindowViaContextMenu` | `assertTabStructure`（移動元・移動先両ウィンドウ） |
| `moveTabToNewWindowViaContextMenu` | `assertTabStructure` + `assertWindowExists` |
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
  { tabId: pseudoSidePanelTabId, depth: 0 },
  { tabId: tab2, depth: 0 },
  { tabId: tab1, depth: 0, expanded: true },    // 子を持つタブはexpanded必須
  { tabId: child1, depth: 1 },                   // 子を持たないタブはexpanded不可
  { tabId: child2, depth: 1, expanded: true },   // 子を持つタブはexpanded必須
  { tabId: grandchild1, depth: 2 },
], 0);

// ✅ 正しい: 折りたたまれた場合は子タブを含めない
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: pseudoSidePanelTabId, depth: 0 },
  { tabId: parent, depth: 0, expanded: false },  // 子タブは見えていないので含めない
], 0);
```

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
- **テストは10回連続成功必須**: `npm run test:e2e`を10回連続実行して全て成功することを確認
- **Chrome Background Throttling対策**: ドラッグ操作前に`page.bringToFront()`
- **リトライ追加禁止**: テストにリトライを安易に追加してはならない。リトライはフレーキーさの根本原因を隠蔽し、問題の発覚を遅らせるだけである。テストがフレーキーな場合は、リトライを追加せずに根本的な原因を特定し修正すること

### テスト初期化パターン（必須）

テスト開始時は以下のパターンで初期化すること。ブラウザ起動時のデフォルトタブは閉じずに、assertTabStructureに含める。

```typescript
// ウィンドウIDと各種タブIDを取得
const windowId = await getCurrentWindowId(serviceWorker);
const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);

// ここからテスト用のタブを作成
const tab1 = await createTab(extensionContext, 'about:blank');
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: pseudoSidePanelTabId, depth: 0 },
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
- **chrome.downloads API**: スナップショットをJSONファイルとしてダウンロードフォルダに保存
- **Service Worker**: バックグラウンドでのタブイベント監視とツリー同期
- **Path Alias `@/`**: `./src/`へのエイリアス
- **複数ウィンドウ対応**: TreeStateProviderでwindowIdを取得し各ウィンドウで自身のタブのみをフィルタリング表示
- **ウィンドウ間タブ移動**: コンテキストメニューから「別のウィンドウに移動」「新しいウィンドウに移動」で実現
- **リンククリック検出**: `chrome.webNavigation.onCreatedNavigationTarget` APIを使用。このAPIはリンククリックまたは`window.open()`の場合のみ発火し、`chrome.tabs.create()`・ブックマーク・アドレスバー・Ctrl+Tでは発火しない。これにより「リンクから開いたタブ」と「手動で開いたタブ」を正確に区別し、それぞれの設定（`newTabPositionFromLink` / `newTabPositionManual`）を適用する

---

## 技術的制約

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
_Document standards and patterns, not every dependency_
